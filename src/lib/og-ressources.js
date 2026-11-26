import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { slugCandidat } from "./carte.js";
import { POLICES } from "./charte-rs.js";

// Ressources des images next/og (cartes X, carrousel Instagram) : polices du
// site et portrait bleu du candidat. Côté serveur seulement (lecture de
// fichiers dans public/).

let policesEnCache = null;

// Inter ExtraBold (800) et Medium (500), chargées une fois par instance.
export function polices() {
  policesEnCache ??= Promise.all(
    [
      ["Inter-ExtraBold.otf", 800],
      ["Inter-Medium.otf", 500],
    ].map(async ([fichier, weight]) => ({
      name: "Inter",
      data: await readFile(join(process.cwd(), "public", "fonts", fichier)),
      weight,
      style: "normal",
    })),
  );
  return policesEnCache;
}

let policesCarrouselEnCache = null;

// Polices des carrousels Instagram : titres en Source Serif 4 Semibold
// (« Serif », licence SIL OFL 1.1, public/fonts/SourceSerif4-LICENSE.md),
// étiquettes en Geist Mono (OFL, public/fonts/Geist-OFL.txt), texte courant
// en Inter (« Texte », OFL, public/fonts/OFL.txt). Geist était prévu pour le
// texte courant, mais ses fichiers .ttf donnent des espaces irréguliers entre
// les mots dans Satori (le moteur de next/og) ; Inter s'y affiche correctement.
export function policesCarrousel() {
  policesCarrouselEnCache ??= Promise.all(
    [
      ["SourceSerif4-Semibold.ttf", "Serif", 600],
      ["Inter-Medium.otf", "Texte", 500],
      ["Inter-ExtraBold.otf", "Texte", 800],
      ["GeistMono-Medium.ttf", "GeistMono", 500],
    ].map(async ([fichier, name, weight]) => ({
      name,
      data: await readFile(join(process.cwd(), "public", "fonts", fichier)),
      weight,
      style: "normal",
    })),
  );
  return policesCarrouselEnCache;
}

let policesCharteEnCache = null;

// Polices des carrousels de la charte RS (src/lib/charte-rs.js, POLICES) :
// Inter Display (500, 700, 900), DM Serif Display, JetBrains Mono, tirées des
// kits (OFL). Silkscreen, réservée aux Reels, n'y figure pas.
export function policesCharteRS() {
  policesCharteEnCache ??= Promise.all(
    Object.values(POLICES).map(async (p) => ({ name: p.famille, data: await readFile(join(process.cwd(), "public", p.fichier)), weight: p.graisse, style: "normal" })),
  );
  return policesCharteEnCache;
}

// Portrait bleu détouré (public/portraits-bleus/<slug>.png), en data URI.
// Fichier absent : null (l'image s'affiche sans portrait).
export async function portraitBleu(candidat) {
  try {
    const png = await readFile(join(process.cwd(), "public", "portraits-bleus", `${slugCandidat(candidat)}.png`));
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    return null;
  }
}

// Fichier de l'illustration du candidat, relatif à public/ : celle des
// vignettes du site (public/photos/vignettes/<slug>.webp, 128 × 160), prise en
// pleine taille (public/photos/<slug>.jpg, 800 × 1000, même cadrage 4:5, même
// traitement, même fond) : la vignette serait floue sur une slide 1080 × 1350.
export function cheminIllustration(candidat) {
  return join("photos", `${slugCandidat(candidat)}.jpg`);
}

// Fichier en data URI (chemin relatif à public/), ou null s'il manque.
async function dataUri(chemin, type) {
  try {
    const octets = await readFile(join(process.cwd(), "public", chemin));
    return `data:${type};base64,${octets.toString("base64")}`;
  } catch {
    return null;
  }
}

// Images de la couverture en collage, préparées par scripts/images-couverture.js :
// portrait détouré noir et blanc, photo du thème en duotone, sticker du thème.
export function cheminPortraitNoirBlanc(candidat) {
  return join("portraits-nb", `${slugCandidat(candidat)}.png`);
}

export function cheminImageTheme(theme) {
  return join("carrousel", "themes", `${theme}.jpg`);
}

export function cheminStickerTheme(theme) {
  return join("carrousel", "themes", `${theme}-sticker.png`);
}

export function portraitNoirBlanc(candidat) {
  return dataUri(cheminPortraitNoirBlanc(candidat), "image/png");
}

// Sans détourage : l'illustration entière en noir et blanc, posée en tirage.
export function cheminPortraitCadre(candidat) {
  return join("portraits-nb", `${slugCandidat(candidat)}-cadre.jpg`);
}

export function portraitCadre(candidat) {
  return dataUri(cheminPortraitCadre(candidat), "image/jpeg");
}

export function imageTheme(theme) {
  return theme ? dataUri(cheminImageTheme(theme), "image/jpeg") : null;
}

export function stickerTheme(theme) {
  return theme ? dataUri(cheminStickerTheme(theme), "image/png") : null;
}

// Illustration du candidat en data URI, ou null si le fichier manque.
export async function illustrationCandidat(candidat) {
  try {
    const jpg = await readFile(join(process.cwd(), "public", cheminIllustration(candidat)));
    return `data:image/jpeg;base64,${jpg.toString("base64")}`;
  } catch {
    return null;
  }
}
