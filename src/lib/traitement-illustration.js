import { readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { couleursProches } from "./couleurs-candidats.js";

// Traitement commun des images de thème de la couverture (le même pour
// toutes : c'est ce qui rend l'ensemble cohérent) : la photo de la
// bibliothèque (public/illustrations/…) est passée en bichromie, puis
// recouverte d'une trame de points dont la taille suit l'ombre de la photo
// (similigravure), comme la caisse et les billets du modèle. Satori (next/og)
// n'applique aucun filtre : le traitement est fait ici avec sharp, à la
// demande, et gardé en mémoire. Côté serveur seulement.
//
// Deux teintes :
//  - « jaune » (par défaut) : fond jaune, points ocre foncé ;
//  - « candidat » : fond papier, points de la couleur du candidat, quand le
//    fond de la couverture est déjà proche du jaune (le panneau jaune ne se
//    verrait plus).

export const LARGEUR_PANNEAU = 780;
export const HAUTEUR_PANNEAU = 550;
const PAS_TRAME = 11;

const JAUNE = { clair: [255, 226, 122], sombre: [214, 160, 18], points: "#4a3206" };
const PAPIER = { clair: [247, 242, 230], sombre: [214, 206, 188] };

function rvb(hex) {
  const n = parseInt(String(hex).replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Teinte à utiliser selon le fond de la couverture.
export function teinteIllustration(fondCouverture) {
  return fondCouverture && couleursProches(fondCouverture, "#ffd23f", 140) ? "candidat" : "jaune";
}

// Image traitée (octets JPEG) à partir des octets de la photo.
export async function traiterIllustration(octets, { teinte = "jaune", couleurCandidat = "#1b2a4a" } = {}) {
  const couleurs = teinte === "candidat" ? { ...PAPIER, points: couleurCandidat } : JAUNE;
  const { data, info } = await sharp(octets)
    .rotate()
    .resize(LARGEUR_PANNEAU, HAUTEUR_PANNEAU, { fit: "cover", position: "attention" })
    .grayscale()
    .normalise()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Bichromie douce (le fond du panneau).
  const fond = Buffer.alloc(info.width * info.height * 3);
  for (let i = 0; i < info.width * info.height; i++) {
    const t = data[i * info.channels] / 255;
    for (let c = 0; c < 3; c++) fond[i * 3 + c] = Math.round(couleurs.sombre[c] + (couleurs.clair[c] - couleurs.sombre[c]) * t);
  }

  // Trame : un point par case, rayon selon l'ombre moyenne de la case.
  const cercles = [];
  for (let y = 0; y < info.height; y += PAS_TRAME) {
    const decalage = (y / PAS_TRAME) % 2 ? PAS_TRAME / 2 : 0;
    for (let x = decalage; x < info.width; x += PAS_TRAME) {
      const px = Math.min(info.width - 1, Math.round(x + PAS_TRAME / 2));
      const py = Math.min(info.height - 1, Math.round(y + PAS_TRAME / 2));
      const ombre = 1 - data[(py * info.width + px) * info.channels] / 255;
      const r = (PAS_TRAME / 2) * 1.05 * Math.sqrt(ombre);
      if (r > 0.6) cercles.push(`<circle cx="${(x + PAS_TRAME / 2).toFixed(1)}" cy="${(y + PAS_TRAME / 2).toFixed(1)}" r="${r.toFixed(2)}"/>`);
    }
  }
  const trame = `<svg xmlns="http://www.w3.org/2000/svg" width="${info.width}" height="${info.height}"><g fill="${couleurs.points}">${cercles.join("")}</g></svg>`;

  return sharp(fond, { raw: { width: info.width, height: info.height, channels: 3 } })
    .composite([{ input: Buffer.from(trame) }])
    .jpeg({ quality: 84 })
    .toBuffer();
}

const cache = new Map();

// Data URI de l'illustration traitée (fichier relatif à public/), ou null si
// le fichier manque.
export async function illustrationTraitee(fichier, options = {}) {
  if (!fichier) return null;
  const cle = `${fichier}|${options.teinte ?? "jaune"}|${options.couleurCandidat ?? ""}`;
  if (!cache.has(cle)) {
    cache.set(
      cle,
      readFile(join(process.cwd(), "public", fichier))
        .then((octets) => traiterIllustration(octets, options))
        .then((jpeg) => `data:image/jpeg;base64,${jpeg.toString("base64")}`)
        .catch(() => {
          cache.delete(cle);
          return null;
        }),
    );
  }
  return cache.get(cle);
}
