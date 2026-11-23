import { distanceCouleurs } from "./couleurs-candidats.js";
import { DISTANCE_PROCHES } from "./couleur-dominante.js";

// Couleurs du carrousel détaillé : la couverture et la fin entièrement dans
// la couleur du candidat, les slides 2 à 7 sur papier crème avec cette
// couleur en accent ; le bloc derrière le candidat, même teinte plus foncée.
// Chaque candidat prend la couleur principale de son illustration
// (public/photos/vignettes), calculée par scripts/couleurs-candidats.js
// (contraste ≥ 4,5:1 avec le titre blanc, jamais proche du jaune des
// surlignages) puis recopiée ici après validation d'Arno. Un carrousel ne
// reprend jamais la couleur d'un des 2 derniers publiés (contrôle sur
// /test/reseaux/<id>, mémorisé dans le navigateur). Le carrousel 6 slides
// garde src/lib/couleurs-candidats.js. Fonctions PURES.

// Clé : nom exact en base (Candidat.nom) ; { fond, bloc }. Validées par Arno
// le 23/11/2026 : la couleur principale de l'illustration ; pour les
// portraits de la charte bleue, la couleur hors bleu (vêtement, accent) quand
// elle existe et reste distincte, sinon une couleur de remplacement, pour 12
// couleurs bien distinctes (écart minimal 76, scripts/couleurs-candidats.js).
//   Riner : bleu de la charte gardé (son accent orange est celui de Glucksmann) ;
//   Retailleau : aucun autre accent, bleu nuit ;
//   Villepin, Philippe : accent beige, trop proche du taupe de Zemmour →
//     ardoise et magenta prune ; Lisnard : aucun autre accent → olive ;
//   Le Pen : rose gardé en framboise ; Glucksmann : orange plus vif (loin d'Attal).
export const COULEURS_CARROUSEL_CANDIDATS = {
  "Bruno Retailleau": { fond: "#183450", bloc: "#0D1A27" },
  "David Lisnard": { fond: "#5E6420", bloc: "#2E3012" },
  "Dominique de Villepin": { fond: "#4A5568", bloc: "#262B33" },
  "Édouard Philippe": { fond: "#8E2D7A", bloc: "#45193C" },
  "Éric Zemmour": { fond: "#88725E", bloc: "#433930" },
  "Fabien Roussel": { fond: "#8C352A", bloc: "#441C17" },
  "Gabriel Attal": { fond: "#956F0B", bloc: "#473609" },
  "Jean-Luc Mélenchon": { fond: "#402C77", bloc: "#21183A" },
  "Marine Le Pen": { fond: "#B03A5B", bloc: "#55202F" },
  "Marine Tondelier": { fond: "#235A3D", bloc: "#132C1F" },
  "Raphaël Glucksmann": { fond: "#B4561C", bloc: "#562C12" },
  "Teddy Riner": { fond: "#365F96", bloc: "#1D3049" },
};

// Couleur de repli tant qu'un candidat n'a pas de couleur : encre neutre,
// signalée comme avertissement fort sur la page.
export const COULEUR_NEUTRE = { fond: "#2B2A33", bloc: "#14131A" };

function cle(nom) {
  return String(nom ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function valide(hex) {
  return /^#[0-9a-f]{6}$/i.test(String(hex ?? ""));
}

// Couleur du carrousel d'un candidat : { fond, bloc } ou null.
export function couleurCarrousel(candidatNom, { table = COULEURS_CARROUSEL_CANDIDATS } = {}) {
  const valeur = Object.entries(table ?? {}).find(([nom]) => cle(nom) === cle(candidatNom))?.[1];
  return valeur && valide(valeur.fond) && valide(valeur.bloc) ? { fond: valeur.fond.toUpperCase(), bloc: valeur.bloc.toUpperCase() } : null;
}

// Vrai si la couleur est la même (ou presque) que celle d'un des 2 derniers
// carrousels publiés (`derniers` : couleurs de fond, la plus récente d'abord).
export function memeCouleurQueDerniers(fond, derniers = []) {
  if (!valide(fond)) return false;
  return derniers
    .slice(0, 2)
    .filter(valide)
    .some((d) => distanceCouleurs(fond, d) < DISTANCE_PROCHES);
}
