// Estimation de coût et choix des fiches de scripts/reel.js : fonctions PURES
// (ni base, ni appel à Claude, ni fichiers), testées par scripts/reel-lot.test.js.

// Caractères par token, pour un texte français mêlé de JSON (valeur prudente :
// un peu moins que la moyenne, pour ne pas sous-estimer).
export const CARACTERES_PAR_TOKEN = 3.2;
// Tokens de sortie d'une réponse (8 scènes, voix et sous-titres, JSON).
export const TOKENS_SORTIE = 1500;

// Usage estimé (au format de l'API) du meilleur cas (premier essai accepté)
// et du pire cas (second essai, qui renvoie aussi la réponse refusée et les
// erreurs), à partir de la taille du message du premier essai.
export function usageEstimeReel(caracteresMessage) {
  const entree = Math.ceil(caracteresMessage / CARACTERES_PAR_TOKEN);
  return {
    min: { input_tokens: entree, output_tokens: TOKENS_SORTIE },
    max: { input_tokens: 2 * entree + TOKENS_SORTIE + 300, output_tokens: 2 * TOKENS_SORTIE },
  };
}

// `analyses` : analyses publiées, de la plus récente à la plus ancienne, avec
// { id, proposition: { id } }. Garde la dernière analyse publiée de chaque
// fiche, écarte celles qui ont déjà un `reel` (ids dans `avecReel`), puis les
// `n` premières.
export function choisirFichesReel(analyses, avecReel, n) {
  const vues = new Set();
  const dernieres = analyses.filter(({ proposition }) => !vues.has(proposition.id) && vues.add(proposition.id));
  return dernieres.filter((analyse) => !avecReel.has(analyse.id)).slice(0, n);
}
