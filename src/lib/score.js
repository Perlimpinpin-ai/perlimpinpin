// Barème officiel du Score Perlimpinpin, 6 paliers (voir la page /methode,
// section "La note finale"). Source unique de vérité pour tout badge de
// score affiché sur le site — le prompt d'analyse IA (scripts/analyze.js,
// fichier texte, pas d'import possible) doit être tenu à jour manuellement
// en miroir de cette table. Le score numérique stocké (0-100) ne change
// jamais : seuls le libellé, la couleur et la description dépendent de
// cette table, recalculés à l'affichage.
const SCORE_BANDS = [
  {
    min: 80,
    max: 100,
    label: "Exemplaire",
    // Version courte de la description (colonne de la page d'accueil).
    courte: "Pertinente, documentée et facile à appliquer.",
    color: "green-dark",
    description:
      "La mesure est à la fois pertinente, bien conçue, documentée et facilement applicable.",
  },
  {
    min: 65,
    max: 79,
    label: "Solide et chiffré",
    courte: "Étayée par des données solides et réaliste.",
    color: "green",
    description:
      "La mesure est étayée par des données robustes et réaliste dans le cadre actuel.",
  },
  {
    min: 50,
    max: 64,
    label: "Plausible sous condition",
    courte: "Cohérente, mais dépend de conditions incertaines.",
    color: "amber",
    description:
      "La mesure est globalement cohérente mais dépend de conditions de mise en œuvre ou de ressources incertaines.",
  },
  {
    min: 35,
    max: 49,
    label: "Partiellement fondé",
    courte: "Des bases solides, mais des points fragiles.",
    color: "orange",
    description:
      "Une partie des règles proposées existe déjà ou repose sur des bases solides, mais des points restent fragiles.",
  },
  {
    min: 20,
    max: 34,
    label: "Fragile",
    courte: "Trop d’incertitudes ou de contradictions.",
    color: "red",
    description:
      "De nombreuses incertitudes ou contradictions affaiblissent fortement la proposition.",
  },
  {
    min: 0,
    max: 19,
    label: "Irréaliste",
    courte: "Hors-sol ou contraire aux faits ou au droit.",
    color: "red-dark",
    description:
      "La mesure est hors-sol ou en contradiction majeure avec les faits ou le cadre légal.",
  },
];

// Classes Tailwind associées à chaque couleur — définies une seule fois ici
// plutôt que recopiées dans chaque composant qui affiche un score. 6
// couleurs distinctes (et non 3 partagées par 2 paliers) pour que les
// paliers voisins (ex. Fragile/Irréaliste, Exemplaire/Solide et chiffré)
// restent visuellement différenciables partout où ils apparaissent
// côte à côte (classement, tableau /methode).
const COLOR_CLASSES = {
  "red-dark": {
    score: "text-red-800",
    badge: "bg-red-100 text-red-800",
    border: "border-l-red-800",
    flag: "text-red-800",
  },
  red: {
    score: "text-red-600",
    badge: "bg-rose-100 text-rose-700",
    border: "border-l-red-500",
    flag: "text-red-600",
  },
  orange: {
    score: "text-orange-600",
    badge: "bg-orange-50 text-orange-700",
    border: "border-l-orange-500",
    flag: "text-orange-500",
  },
  amber: {
    score: "text-amber-600",
    badge: "bg-amber-50 text-amber-700",
    border: "border-l-amber-500",
    flag: "text-amber-500",
  },
  green: {
    score: "text-green-600",
    badge: "bg-green-50 text-green-700",
    border: "border-l-green-500",
    flag: "text-green-600",
  },
  "green-dark": {
    score: "text-emerald-800",
    badge: "bg-emerald-100 text-emerald-800",
    border: "border-l-emerald-700",
    flag: "text-emerald-700",
  },
};

// Libellés lisibles pour plafond_declencheur ("juridique" | "budgetaire" |
// "moyens_humains") de la RÈGLE DE PLAFOND d'Opérationnalité & Moyens (voir
// data/prompt-methodologie.md) — partagés par la fiche déclaration et
// ScoreDetail.
export const PLAFOND_DECLENCHEUR_LABELS = {
  juridique: "faisabilité juridique",
  budgetaire: "faisabilité budgétaire",
  moyens_humains: "moyens humains",
};

// Formate un score pour l'affichage : arrondi à 1 décimale max, sans
// décimale du tout quand elle est nulle (66, pas 66.0). Le score stocké
// en base reste inchangé, seul l'arrondi visuel est concerné.
export function formatScore(score) {
  return Number(score.toFixed(1));
}

export function getScoreBadge(score) {
  const band =
    SCORE_BANDS.find((entry) => score >= entry.min) ??
    SCORE_BANDS[SCORE_BANDS.length - 1];
  const classes = COLOR_CLASSES[band.color];
  return {
    label: band.label,
    color: band.color,
    description: band.description,
    scoreClass: classes.score,
    badgeClass: classes.badge,
    flagClass: classes.flag,
  };
}

// Couleur de verdict (champ `color` renvoyé par getScoreBadge) -> classe de
// fond pleine, pour les surfaces colorées par verdict (ex. la barre de
// décomposition des pages /hors-serie). Table à part : COLOR_CLASSES et
// getScoreBadge restent inchangés.
export const VERDICT_BG_CLASSES = {
  "red-dark": "bg-red-800",
  red: "bg-red-500",
  orange: "bg-orange-500",
  amber: "bg-amber-500",
  green: "bg-green-500",
  "green-dark": "bg-emerald-700",
};

// Tous les paliers avec leurs classes, pour les tableaux qui affichent le
// barème complet (ex: /methode, colonne "Comment fonctionne le score ?").
// Renvoyés du plus haut score au plus bas ; utiliser .slice().reverse()
// si un affichage du plus bas au plus haut est nécessaire.
export function getScoreBands() {
  return SCORE_BANDS.map((band) => ({
    ...band,
    ...COLOR_CLASSES[band.color],
  }));
}
