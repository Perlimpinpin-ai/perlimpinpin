import { empreinte } from "./carte.js";
import { choisirEnRotation } from "./rotation-images.js";

// Bibliothèque des photos des candidats (couverture du carrousel détaillé et
// fenêtre du candidat dans les Reels) : photos libres de Wikimedia Commons,
// validées à la main, détourées en noir et blanc en local.
//
//  1. node scripts/chercher-photos-candidats.js <slug>
//       → API Wikimedia Commons, catégorie du candidat (src/lib/candidats-commons.js),
//         15 à 20 propositions (licence libre, ≥ 800 px, auteur et licence
//         clairs) dans data/photos-candidats/candidates/<slug>.json ;
//  2. /test/photos-candidats : on coche celles qu'on garde (portrait de face
//     ou de trois quarts, expression neutre, pas de logo de parti visible)
//     → data/photos-candidats/selection/<slug>.json ;
//  3. node scripts/chercher-photos-candidats.js <slug> --telecharger
//       → télécharge les retenues dans data/photos-candidats/originaux/<slug>/<n>.jpg
//         et réécrit la liste ci-dessous (entre les repères) ;
//  4. python scripts/detourer-candidats.py --photos <slug>
//       → public/carrousel/candidats/<slug>/<n>.png (détouré, noir et blanc).
// Rien n'entre dans la bibliothèque sans cette validation. Fonctions PURES,
// testées par scripts/carrousel-detaille.test.js.

export const PHOTOS_MIN = 3;
// Photo du dernier carrousel de chaque candidat, mémorisée dans le navigateur
// (clé + slug) au téléchargement de l'archive, pour ne pas la reprendre.
export const CLE_DERNIERE_PHOTO = "perlimpinpin.carrousel.dernierePhoto.";

// --- Liste de la bibliothèque --------------------------------------------------------
// Écrite par scripts/chercher-photos-candidats.js --telecharger : ne pas modifier à la
// main entre les deux repères (sauf pour retirer une photo).
// Chaque entrée : { id, slug, n, fichier (relatif à public/), source, titre, auteur,
//   licence, lienLicence, lien (page Commons), modification }.
// DEBUT LISTE PHOTOS
export const PHOTOS_CANDIDATS = [];
// FIN LISTE PHOTOS

export function photosDuCandidat(slug, liste = PHOTOS_CANDIDATS) {
  return liste.filter((p) => p.slug === slug).sort((a, b) => a.n - b.n);
}

// Photo de la couverture :
//  - celle demandée (numéro n, bouton « Changer de photo ») ;
//  - sinon celle retenue à la génération de cette version (numéro stocké
//    dans contenuComplet.reseaux_recit.photo) ;
//  - sinon un tirage stable pour cette version (graine), en écartant les
//    photos des 2 derniers carrousels du candidat (`recentes` : numéros, le
//    plus récent d'abord), ou la moins récemment utilisée
//    (src/lib/rotation-images.js).
// Renvoie la photo ou null (aucune photo : vignette actuelle).
export function choisirPhoto({ slug, demandee = null, retenue = null, recentes = [], graine = "", liste = PHOTOS_CANDIDATS }) {
  const photos = photosDuCandidat(slug, liste);
  if (photos.length === 0) return null;
  for (const n of [demandee, retenue]) {
    const voulue = n === null || n === undefined ? null : photos.find((p) => String(p.n) === String(n));
    if (voulue) return voulue;
  }
  const alea = parseInt(empreinte(String(graine)).slice(0, 8), 16) / 0x100000000;
  return choisirEnRotation(photos, { cle: (p) => p.n, recentes, alea });
}

// Photo suivante pour « Changer de photo », en évitant `eviter` (celle du
// carrousel précédent du candidat) quand c'est possible.
export function photoSuivante(numeros, actuelle, eviter = null) {
  const liste = [...numeros].sort((a, b) => a - b);
  if (liste.length <= 1) return liste[0] ?? null;
  const depart = Math.max(0, liste.indexOf(Number(actuelle)));
  for (let k = 1; k <= liste.length; k++) {
    const n = liste[(depart + k) % liste.length];
    if (n !== Number(eviter) || liste.length === 2) return n;
  }
  return liste[(depart + 1) % liste.length];
}

// Crédits d'une photo : une seule ligne sur la couverture (« Photo : auteur,
// licence, Wikimedia Commons ») et le crédit complet, avec la modification et
// le lien, dans credits.txt et à la fin de la légende. null si l'auteur ou la
// licence manque.
export function creditsPhoto(photo) {
  if (!photo?.auteur || !photo?.licence) return null;
  return {
    court: `Photo : ${photo.auteur}, ${photo.licence}, Wikimedia Commons`,
    complet: `Photo : ${photo.auteur}, ${photo.licence}, Wikimedia Commons (${photo.modification ?? "photo modifiée : détourage, noir et blanc"}) ${photo.lien ?? ""}`.trim(),
  };
}
