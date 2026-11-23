import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, parse } from "node:path";
import { slugCandidat } from "./carte.js";

// Images déjà prêtes du carrousel détaillé (préparées une fois, en local, par
// scripts/preparer-images-carrousel.js et scripts/detourer-candidats.py) :
// le rendu (next/og) ne fait que les empiler. Côté serveur seulement.

export const CHEMIN_PAPIER = join("carrousel", "papier-dechire.png");
export const CHEMIN_GRAIN = join("carrousel", "grain.png");

// Illustration de la bibliothèque, déjà teintée de jaune et tramée :
// public/illustrations/<thème>/traitees/<nom>.png.
export function cheminIllustrationTraitee(fichier) {
  const { dir, name } = parse(fichier);
  return join(dir, "traitees", `${name}.png`);
}

// Vignette actuelle en tirage noir et blanc (sans photo détourée).
export function cheminVignetteNb(candidat) {
  return join("carrousel", "vignettes-nb", `${slugCandidat(candidat)}.jpg`);
}

export function existe(chemin) {
  return Boolean(chemin) && existsSync(join(process.cwd(), "public", chemin));
}

const cache = new Map();
const tailles = new Map();

// Largeur et hauteur d'un PNG (en-tête IHDR), sans le décoder.
async function taillePng(chemin) {
  if (!tailles.has(chemin)) {
    tailles.set(
      chemin,
      readFile(join(process.cwd(), "public", chemin))
        .then((o) => ({ largeur: o.readUInt32BE(16), hauteur: o.readUInt32BE(20) }))
        .catch(() => null),
    );
  }
  return tailles.get(chemin);
}

// Image du candidat pour la couverture : { image, detoure, largeur, hauteur }
// (photo détourée déjà traitée, sinon la vignette en tirage), ou null.
export async function imageCandidatPrete({ detoure, vignette }) {
  if (detoure && existe(detoure)) {
    const [image, taille] = await Promise.all([imagePrete(detoure), taillePng(detoure)]);
    if (image && taille) return { image, detoure: true, ...taille };
  }
  const image = vignette ? await imagePrete(vignette) : null;
  return image ? { image, detoure: false } : null;
}

// Fichier de public/ en data URI (mis en mémoire), ou null s'il manque.
export function imagePrete(chemin) {
  if (!chemin) return Promise.resolve(null);
  if (!cache.has(chemin)) {
    cache.set(
      chemin,
      readFile(join(process.cwd(), "public", chemin))
        .then((octets) => `data:image/${/\.jpe?g$/i.test(chemin) ? "jpeg" : "png"};base64,${octets.toString("base64")}`)
        .catch(() => {
          cache.delete(chemin);
          return null;
        }),
    );
  }
  return cache.get(chemin);
}
