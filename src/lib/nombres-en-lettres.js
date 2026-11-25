// Nombres en toutes lettres, pour la voix off des Reels (ElevenLabs lit mieux
// « trente-huit » que « 38 »). Orthographe traditionnelle : « vingt et un »,
// « soixante et onze », « quatre-vingts », « quatre-vingt-un ».
// Fonctions PURES, testées par scripts/nombres-en-lettres.test.js.

const UNITES = [
  "zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf",
  "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize",
  "dix-sept", "dix-huit", "dix-neuf",
];
const DIZAINES = { 2: "vingt", 3: "trente", 4: "quarante", 5: "cinquante", 6: "soixante" };

// Entier de 0 à 100. Lève une erreur hors de cette plage.
export function nombreEnLettres(n) {
  if (!Number.isInteger(n) || n < 0 || n > 100) {
    throw new RangeError(`nombreEnLettres : entier de 0 à 100 attendu (reçu ${n}).`);
  }
  if (n < 20) return UNITES[n];
  if (n === 100) return "cent";
  if (n < 70) {
    const dizaine = DIZAINES[Math.floor(n / 10)];
    const unite = n % 10;
    if (unite === 0) return dizaine;
    if (unite === 1) return `${dizaine} et un`;
    return `${dizaine}-${UNITES[unite]}`;
  }
  if (n < 80) {
    // 70 à 79 : soixante-dix, soixante et onze, soixante-douze…
    const reste = n - 60;
    return reste === 11 ? "soixante et onze" : `soixante-${UNITES[reste]}`;
  }
  // 80 à 99 : quatre-vingts, quatre-vingt-un, quatre-vingt-dix…
  const reste = n - 80;
  return reste === 0 ? "quatre-vingts" : `quatre-vingt-${UNITES[reste]}`;
}

// Score affiché (une décimale au plus, comme formatScore) en lettres :
// 38 → « trente-huit », 38.5 → « trente-huit virgule cinq ».
export function scoreEnLettres(score) {
  const arrondi = Number(Number(score).toFixed(1));
  if (!Number.isFinite(arrondi) || arrondi < 0 || arrondi > 100) {
    throw new RangeError(`scoreEnLettres : score de 0 à 100 attendu (reçu ${score}).`);
  }
  const entier = Math.trunc(arrondi);
  const decimale = Math.round((arrondi - entier) * 10);
  return decimale === 0 ? nombreEnLettres(entier) : `${nombreEnLettres(entier)} virgule ${nombreEnLettres(decimale)}`;
}
