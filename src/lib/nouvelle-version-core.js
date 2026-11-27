// Nouvelle version d'une fiche DÉJÀ PUBLIÉE quand le CANDIDAT a modifié sa
// mesure (ex. programme publié après la première analyse). Logique PURE, sans
// base : testée par scripts/nouvelle-version.test.js.
//
// Une telle version est une Analyse ordinaire, rattachée à la même Proposition
// (même adresse /declarations/<slug>), créée en brouillon par
// scripts/nouvelle-version-fiche.js puis publiée par le bouton « Publier » de
// /test (src/lib/test-publier.js). Ce qui la distingue d'un brouillon normal :
// le bloc contenuComplet.changement_version, qui porte
//   - motif_public  : phrase affichée À TOUS en haut de la fiche ;
//   - raison        : phrase de l'historique des versions (réservé au Club) ;
//   - analyse_precedente_id : la version en ligne qu'elle remplace (garde-fou
//                     de la publication : elle doit toujours être la version publiée) ;
//   - score_avant / score_apres / criteres_modifies : calculés par le code ;
//   - mesure_initiale / titre : nouvelle mesure et nouveau titre, écrits sur
//                     la Proposition au clic « Publier » (jamais avant) ;
//   - mesure_avant / titre_avant : ceux de la version remplacée, gardés pour
//                     l'historique (la Proposition ne garde que le dernier).
// Aucune migration : tout est dans contenuComplet.

export const CLE_CHANGEMENT = "changement_version";

// Notes des critères du barème 2026 (mêmes clés que notation_detaillee).
export const NOTES_CRITERES = [
  "operationnalite_juridique",
  "operationnalite_budgetaire",
  "operationnalite_moyens_humains",
  "efficacite",
  "effets_rebonds_externalites",
  "degre_preparation",
  "alignement_logique",
];

const texteNonVide = (v) => typeof v === "string" && v.trim().length > 0;

// Critères dont la note change entre deux notations (calcul du code, jamais du modèle).
export function criteresModifies(avant, apres) {
  return NOTES_CRITERES.filter((cle) => avant?.[cle] !== apres?.[cle]).map((cle) => ({
    critere: cle,
    ancienneNote: avant?.[cle] ?? null,
    nouvelleNote: apres?.[cle] ?? null,
  }));
}

// Bloc changement_version lu dans un contenuComplet, ou null s'il est absent ou
// incomplet (un bloc incomplet ne débloque jamais la publication).
export function lireChangementVersion(contenu) {
  const cv = contenu?.[CLE_CHANGEMENT];
  if (!cv || typeof cv !== "object" || Array.isArray(cv)) return null;
  if (!Number.isInteger(cv.analyse_precedente_id) || cv.analyse_precedente_id <= 0) return null;
  if (!texteNonVide(cv.motif_public) || !texteNonVide(cv.raison)) return null;
  if (!texteNonVide(cv.mesure_initiale) || !texteNonVide(cv.titre)) return null;
  return cv;
}

// Construit le bloc à partir de la version publiée remplacée et de la nouvelle notation.
//   precedente  : { id, scoreFaisabilite, contenuComplet }
//   proposition : { texteOriginal, titre } (valeurs actuelles, celles de la version remplacée)
//   notation    : notation_detaillee de la nouvelle version, score déjà calculé par le code
export function construireChangementVersion({ precedente, proposition, notation, mesureInitiale, titre, raison, motifPublic }) {
  if (!Number.isInteger(precedente?.id)) throw new Error("Version précédente introuvable.");
  if (!Number.isInteger(notation?.score_total)) throw new Error("Nouvelle notation sans score_total.");
  for (const [nom, valeur] of Object.entries({ mesureInitiale, titre, raison, motifPublic })) {
    if (!texteNonVide(valeur)) throw new Error(`Champ manquant : ${nom}.`);
  }
  return {
    analyse_precedente_id: precedente.id,
    motif_public: motifPublic.trim(),
    raison: raison.trim(),
    score_avant: precedente.scoreFaisabilite,
    score_apres: notation.score_total,
    criteres_modifies: criteresModifies(precedente.contenuComplet?.notation_detaillee, notation),
    mesure_initiale: mesureInitiale.trim(),
    mesure_avant: proposition?.texteOriginal ?? null,
    titre: titre.trim(),
    titre_avant: proposition?.titre ?? null,
  };
}

// Phrase affichée en haut de la fiche : « Version 3 du 27/11/2026. <motif> ».
// Sans numéro ni date (cas improbable) : le motif seul.
export function texteAvisVersion({ numero, dateLabel, motif }) {
  if (!texteNonVide(motif)) return null;
  const tete = Number.isInteger(numero) && numero > 0 ? `Version ${numero}${dateLabel ? ` du ${dateLabel}` : ""}. ` : "";
  return `${tete}${motif.trim()}`;
}

// Titre et mesure affichés pour une analyse : ceux de sa nouvelle version si
// elle en porte une (aperçu /test d'un brouillon, avant que la Proposition ne
// soit mise à jour), sinon ceux de la Proposition.
export function titreEtMesureAffiches(proposition, contenu) {
  const cv = lireChangementVersion(contenu);
  return {
    titre: cv ? cv.titre : null,
    texteOriginal: cv ? cv.mesure_initiale : proposition.texteOriginal,
  };
}
