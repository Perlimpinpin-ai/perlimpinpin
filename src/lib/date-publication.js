// Date de publication d'une analyse (Analyse.publieLe = moment du clic
// « Publier »), sans dépendance à Next ni à la base : testée par
// scripts/date-publication.test.js.
//
// À NE PAS confondre avec Proposition.dateDeclaration (date à laquelle le
// candidat a fait sa déclaration), qui n'est jamais modifiée par la publication.

// Date de mise en ligne d'une analyse publiée. Repli sur createdAt pour une
// analyse publiée avant la migration 20261119100000_add_analyse_publie_le si le
// rattrapage n'avait pas été fait (ou une ligne oubliée) : l'ordre reste alors
// celui d'avant.
export function datePublication(analyse) {
  return analyse.publieLe ?? analyse.createdAt;
}

// Tri Prisma des « dernières publications » : la plus récemment publiée
// d'abord ; createdAt départage (et sert de repli si publieLe est nul).
export const ORDRE_DERNIERES_PUBLICATIONS = [
  { publieLe: { sort: "desc", nulls: "last" } },
  { createdAt: "desc" },
];

// Même tri, en mémoire (listes déjà chargées).
export function comparerPublications(a, b) {
  return datePublication(b) - datePublication(a);
}

// « 19 novembre 2026 », heure de Paris.
const formatLong = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Paris",
});

// « 19/11/2026 », heure de Paris.
const formatChiffres = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Europe/Paris",
});

// « 19/11/2026 à 14:32 », heure de Paris (message de la simulation).
const formatHeure = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

export function dateLongue(date) {
  return formatLong.format(date);
}

export function dateChiffres(date) {
  return formatChiffres.format(date);
}

export function dateEtHeure(date) {
  return `${formatChiffres.format(date)} à ${formatHeure.format(date)}`;
}
