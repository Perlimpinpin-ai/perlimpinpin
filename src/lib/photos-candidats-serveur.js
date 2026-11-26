import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { dossierPhoto, PHOTOS_COMMONS, photosDuTirage, VARIANTES_PHOTO } from "./photos-candidats.js";

// Tirage des photos des candidats côté serveur, au rendu (routes des
// carrousels et des Reels, actions de /test/reseaux) : à partir des dossiers
// préparés présents dans public/carrousel/candidats/<slug>/<n>/
// (scripts/preparer-photos-candidats.py), moins les photos écartées de
// src/lib/photos-candidats.js. Rien dans le navigateur. Sur Vercel, les
// fichiers lus ici sont embarqués par outputFileTracingIncludes
// (next.config.mjs) : chaque route n'embarque que la variante qu'elle affiche.

const RACINE = join(process.cwd(), "public", "carrousel", "candidats");
const NUMERO = /^\d+$/;

// [{ slug, n }] des photos préparées dont le fichier de la variante existe.
export function photosSurDisque(variante = "mesure") {
  const fichier = VARIANTES_PHOTO[variante] ?? VARIANTES_PHOTO.mesure;
  const trouvees = [];
  let slugs = [];
  try {
    slugs = readdirSync(RACINE, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  } catch {
    return trouvees;
  }
  for (const slug of slugs) {
    let numeros = [];
    try {
      numeros = readdirSync(join(RACINE, slug), { withFileTypes: true }).filter((d) => d.isDirectory() && NUMERO.test(d.name)).map((d) => d.name);
    } catch {
      continue;
    }
    for (const n of numeros) if (existsSync(join(RACINE, slug, n, fichier))) trouvees.push({ slug, n: Number(n) });
  }
  return trouvees;
}

// Bibliothèque du tirage pour une variante : photos Commons et photos
// déposées préparées, non écartées.
export function photosTirage(variante = "mesure") {
  return [...PHOTOS_COMMONS, ...photosDuTirage(photosSurDisque(variante))];
}

// Cadrage mesuré d'une photo déposée (cadrage.json, écrit par
// scripts/preparer-photos-candidats.py --mesurer) : position de la tête dans
// detoure-liseré-blanc.png, pour normaliser la silhouette sur la couverture
// (src/lib/mise-en-page-carrousel.js, placementCandidat). null s'il manque.
export function cadragePhoto(photo) {
  if (!photo?.deposee) return null;
  return cadrageDuFichier(join(dossierPhoto(photo), "x.png"));
}

// Même chose à partir d'un fichier de la photo (relatif à public/).
export function cadrageDuFichier(fichier) {
  if (!fichier) return null;
  try {
    return JSON.parse(readFileSync(join(process.cwd(), "public", dirname(fichier), "cadrage.json"), "utf-8"));
  } catch {
    return null;
  }
}
