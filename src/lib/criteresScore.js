// Données et couleurs des 5 critères du barème 2026 (100 points, voir
// data/prompt-methodologie.md), partagées entre le bloc "Détail du score"
// (ScoreDetail) et le récap "En bref" de la carte score (ScoreEnBref).
//
// Les badges reprennent tels quels les champs qualification_* stockés dans
// contenuComplet.notation_detaillee (étape 3 du pipeline) : aucune
// qualification n'est jamais déduite de la note. Valeur absente ou non
// reconnue → pas de badge et barre neutre. `barLight` : teinte atténuée de
// la barre agrégée d'Opérationnalité & Moyens (total calculé, pas un
// critère noté indépendamment). Ordre des clés = du plus favorable au plus
// défavorable (utilisé par worstQualification).
export const QUALIFICATIONS = {
  SOLIDE: {
    label: "Solide",
    badge: "bg-green-50 text-green-700",
    bar: "bg-green-700",
    barLight: "bg-green-300",
  },
  INCERTAIN: {
    label: "Incertain documenté",
    badge: "bg-amber-50 text-amber-700",
    bar: "bg-amber-700",
    barLight: "bg-amber-300",
  },
  FRAGILE: { label: "Fragile", badge: "bg-red-50 text-red-700", bar: "bg-red-700", barLight: "bg-red-300" },
};
const QUALIFICATION_ORDER = Object.keys(QUALIFICATIONS);

// Qualification la plus défavorable parmi celles reconnues (null si aucune) :
// même logique que la RÈGLE DE PLAFOND, où un seul volet FRAGILE suffit à
// pénaliser tout Opérationnalité & Moyens.
function worstQualification(values) {
  const ranks = values.map((value) => QUALIFICATION_ORDER.indexOf(value)).filter((rank) => rank >= 0);
  return ranks.length ? QUALIFICATION_ORDER[Math.max(...ranks)] : null;
}

export const NEUTRAL_BADGE = "bg-zinc-100 text-zinc-600";
export const NEUTRAL_BAR = "bg-zinc-400";

// Clés de notation_detaillee : note, note maximale, qualification associée.
export const OPERATIONNALITE = {
  key: "operationnalite_moyens_total",
  label: "Opérationnalité & Moyens",
  max: 30,
  sousCriteres: [
    { key: "operationnalite_juridique", label: "Juridique", max: 10, qualif: "qualification_juridique" },
    { key: "operationnalite_budgetaire", label: "Budgétaire", max: 10, qualif: "qualification_budgetaire" },
    {
      key: "operationnalite_moyens_humains",
      label: "Moyens humains",
      max: 10,
      qualif: "qualification_moyens_humains",
    },
  ],
};

const CRITERES = [
  { key: "efficacite", label: "Efficacité", max: 30, qualif: "qualification_efficacite" },
  {
    key: "effets_rebonds_externalites",
    label: "Effets rebonds & Externalités",
    max: 20,
    qualif: "qualification_effets_rebonds",
  },
  { key: "degre_preparation", label: "Degré de préparation", max: 10, qualif: "qualification_preparation" },
  { key: "alignement_logique", label: "Alignement & Logique globale", max: 10, qualif: "qualification_alignement" },
];

// Largeur de barre en % (0 si note absente).
export function pourcentage(note, max) {
  return typeof note === "number" ? Math.min(100, Math.max(0, (note / max) * 100)) : 0;
}

export function qualificationBadge(value) {
  const entry = QUALIFICATIONS[value];
  return entry ? { label: entry.label, className: entry.badge, bar: entry.bar } : null;
}

// Les 5 critères principaux, dans l'ordre d'affichage : { key, label, note,
// max, bar, badge }. Opérationnalité & Moyens n'a pas de badge de
// qualification propre (badge null) ; sa barre prend la teinte atténuée de
// son volet le plus défavorable.
export function criteresPrincipaux(notation) {
  const operationnaliteQualif = worstQualification(
    OPERATIONNALITE.sousCriteres.map(({ qualif }) => notation[qualif]),
  );
  return [
    {
      key: OPERATIONNALITE.key,
      label: OPERATIONNALITE.label,
      note: notation[OPERATIONNALITE.key],
      max: OPERATIONNALITE.max,
      bar: QUALIFICATIONS[operationnaliteQualif]?.barLight ?? NEUTRAL_BAR,
      badge: null,
    },
    ...CRITERES.map(({ key, label, max, qualif }) => {
      const badge = qualificationBadge(notation[qualif]);
      return { key, label, note: notation[key], max, bar: badge?.bar ?? NEUTRAL_BAR, badge };
    }),
  ];
}
