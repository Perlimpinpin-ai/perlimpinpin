import { avertissementsFil, couleursCandidat, REGISTRE_CANDIDATS } from "./charte-rs.js";

// Couleurs des carrousels de la charte RS : le REGISTRE des candidats de
// src/lib/charte-rs.js est la source unique (page 7 de docs/charte-rs.pdf).
// Couverture et fin dans la couleur du candidat, slides de contenu sur papier
// crème avec la couleur en accent ; bloc d'accent derrière le candidat.
// Candidat absent du registre : le carrousel ne se génère pas (controleRegistre).
// Le carrousel 6 slides garde src/lib/couleurs-candidats.js. Fonctions PURES.

// { nom: { fond, bloc } } (pour les listes de la page de partage).
export const COULEURS_CARROUSEL_CANDIDATS = Object.fromEntries(Object.entries(REGISTRE_CANDIDATS).map(([nom, c]) => [nom, { fond: c.fond, bloc: c.accent }]));

// Couleur du carrousel d'un candidat ({ fond, bloc, accent, texte, surlignage,
// accentCreme, clair }) ou null s'il n'est pas au registre.
// `table` : registre de remplacement (tests), au format de REGISTRE_CANDIDATS.
export function couleurCarrousel(candidatNom, { table = REGISTRE_CANDIDATS } = {}) {
  return couleursCandidat(candidatNom, table);
}

// Vrai si la couleur est la même (ou presque) que celle d'un des 2 derniers
// carrousels publiés (`derniers` : couleurs de fond, la plus récente d'abord).
export function memeCouleurQueDerniers(fond, derniers = []) {
  return avertissementsFil(fond, derniers).some((a) => a.cle === "meme");
}

// Avertissements du fil (même couleur, deux posts chauds ou froids de suite).
export { avertissementsFil };
