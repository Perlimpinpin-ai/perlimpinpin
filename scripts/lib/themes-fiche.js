// Thème d'une fiche (bloc `relecture.theme`) → thème du site (src/lib/themes.js).
// Sans dépendance lourde : importé par le robot de révision
// (scripts/lib/revision-relecture.js) et par le contrôle de la file d'attente
// des fiches d'étape 1 (src/lib/controle-fiche-etape1.js, aussi utilisé par le site).

import { THEMES } from "../../src/lib/themes.js";

export const THEMES_SITE = THEMES.map((t) => t.name);

// Thèmes des fiches (13 catégories d'objectif, scoring.js) absents de la liste
// des thèmes du site (src/lib/themes.js) : correspondance explicite.
export const TABLE_THEMES = {
  "Santé": "Santé & Hôpital",
  "Emploi et chômage": "Emploi & Chômage",
  "Éducation": "Éducation nationale",
  "Énergie et climat": "Énergie & Climat",
  "Alimentation et agriculture": "Alimentation & Agriculture",
  "Fiscalité et pouvoir d'achat": "Perspectives économiques, pouvoir d'achat, inflation & fiscalité",
  "Dette et finances publiques": "Perspectives économiques, pouvoir d'achat, inflation & fiscalité",
  "Sécurité et justice": "Sécurité & Justice",
  "Numérique et intelligence artificielle": "IA & Numérique",
};

// { theme, remplace } (remplace = true si la table a servi), ou null si le thème est inconnu.
export function themeFiche(theme) {
  const t = String(theme ?? "").trim();
  if (THEMES_SITE.includes(t)) return { theme: t, remplace: false };
  if (TABLE_THEMES[t]) return { theme: TABLE_THEMES[t], remplace: true };
  return null;
}
