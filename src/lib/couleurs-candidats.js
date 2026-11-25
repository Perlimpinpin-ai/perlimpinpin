import { appreciationCarte } from "./carte.js";

// Couleur de chaque candidat, pour reconnaître ses posts d'un coup d'œil
// (carrousels Instagram, src/lib/carrousel.js et src/lib/carrousel-recit.js).
// Source unique : toute page du site qui voudra afficher la couleur d'un
// candidat la lira ici. Clé : nom exact du candidat en base (Candidat.nom).
//
// Couleurs tirées de la charte des vignettes du site
// (public/photos/vignettes/) et validées par Arno le 21/11/2026 : couleur
// dominante du fond de chaque vignette (bords et coins), sauf Mélenchon
// (violet), Tondelier (vert des chevrons) et Teddy Riner (bleu de
// l'illustration), retenus pour leur teinte franche. Tout nouveau candidat
// vaut null tant que sa couleur n'est pas choisie : ses carrousels gardent
// alors le style neutre (bleu nuit) et la page de partage le signale.
export const COULEURS_CANDIDATS = {
  "Bruno Retailleau": "#1a3552",
  "David Lisnard": "#afbac3",
  "Dominique de Villepin": "#d7d3ca",
  "Édouard Philippe": "#4f6078",
  "Éric Zemmour": "#232121",
  "Fabien Roussel": "#c24935",
  "Gabriel Attal": "#fcedc1",
  "Jean-Luc Mélenchon": "#6f4896",
  "Marine Le Pen": "#fde3cf",
  "Marine Tondelier": "#346649",
  "Raphaël Glucksmann": "#c98d4d",
  "Teddy Riner": "#2b548d",
};

// Couleurs de texte possibles sur un fond de la couleur du candidat.
export const TEXTE_CLAIR = "#ffffff";
export const TEXTE_FONCE = "#18181b"; // zinc-900

function cle(nom) {
  return String(nom ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function rvb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex ?? "").trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// « #rrggbb » (minuscules) si la couleur du candidat est renseignée et valide, sinon null.
export function couleurCandidat(nom, table = COULEURS_CANDIDATS) {
  const entree = Object.entries(table ?? {}).find(([candidat]) => cle(candidat) === cle(nom));
  const valeur = entree?.[1];
  return rvb(valeur) ? `#${String(valeur).trim().replace(/^#/, "").toLowerCase()}` : null;
}

// Luminance relative (WCAG 2.1), de 0 (noir) à 1 (blanc).
export function luminance(hex) {
  const canaux = rvb(hex);
  if (!canaux) return null;
  const [r, g, b] = canaux.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Rapport de contraste WCAG entre deux couleurs (1 à 21).
export function contraste(hexA, hexB) {
  const a = luminance(hexA);
  const b = luminance(hexB);
  if (a === null || b === null) return null;
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

// Texte lisible sur ce fond : blanc ou zinc-900, celui qui contraste le plus.
export function texteSur(fond) {
  return contraste(fond, TEXTE_CLAIR) >= contraste(fond, TEXTE_FONCE) ? TEXTE_CLAIR : TEXTE_FONCE;
}

// Distance entre deux couleurs (« rouge moyen » pondéré, 0 à ~765) : en
// dessous de SEUIL_PROCHES, l'œil les confond.
export const SEUIL_PROCHES = 150;

export function distanceCouleurs(hexA, hexB) {
  const a = rvb(hexA);
  const b = rvb(hexB);
  if (!a || !b) return null;
  const rMoyen = (a[0] + b[0]) / 2;
  const [dr, dg, db] = [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  return Math.sqrt((2 + rMoyen / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rMoyen) / 256) * db * db);
}

export function couleursProches(hexA, hexB, seuil = SEUIL_PROCHES) {
  const d = distanceCouleurs(hexA, hexB);
  return d !== null && d < seuil;
}

// Thème des slides d'un candidat, ou null (style neutre) :
//   couleur : fond de la couverture, filet, intitulés ;
//   texte : texte sur ce fond (blanc ou zinc-900, contraste calculé) ;
//   accentSurClair : la couleur elle-même si elle se lit sur le fond clair
//     des slides (contraste ≥ 3), sinon null (pagination et intitulés restent gris) ;
//   noteNeutre : vrai si la couleur est proche de celle du palier de la note
//     (src/lib/score.js via appreciationCarte) : la slide de la note revient au neutre.
export function themeCandidat({ candidatNom, score, table = COULEURS_CANDIDATS, fondClair = "#fbfaf8" }) {
  const couleur = couleurCandidat(candidatNom, table);
  if (!couleur) return null;
  return {
    couleur,
    texte: texteSur(couleur),
    accentSurClair: contraste(couleur, fondClair) >= 3 ? couleur : null,
    noteNeutre: couleursProches(couleur, appreciationCarte(Number(score)).score),
  };
}
