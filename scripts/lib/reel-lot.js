// Estimation de coût et choix des fiches de scripts/reel.js : fonctions PURES
// (ni base, ni appel à Claude, ni fichiers), testées par scripts/reel-lot.test.js.

// Estimation du coût : partagée avec le bouton du site (src/lib/reel-generation.js).
export { CARACTERES_PAR_TOKEN, TOKENS_SORTIE, usageEstimeReel } from "../../src/lib/reel-generation.js";

// `analyses` : analyses publiées, de la plus récente à la plus ancienne, avec
// { id, proposition: { id } }. Garde la dernière analyse publiée de chaque
// fiche, écarte celles qui ont déjà un `reel` (ids dans `avecReel`), puis les
// `n` premières.
export function choisirFichesReel(analyses, avecReel, n) {
  const vues = new Set();
  const dernieres = analyses.filter(({ proposition }) => !vues.has(proposition.id) && vues.add(proposition.id));
  return dernieres.filter((analyse) => !avecReel.has(analyse.id)).slice(0, n);
}
