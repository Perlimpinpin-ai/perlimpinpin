import Link from "next/link";
import { getScoreBadge, getScoreBands, PLAFOND_DECLENCHEUR_LABELS } from "@/lib/score";
import {
  NEUTRAL_BADGE,
  NEUTRAL_BAR,
  OPERATIONNALITE,
  criteresPrincipaux,
  pourcentage,
  qualificationBadge,
} from "@/lib/criteresScore";

// Bloc "Détail du score" de la fiche déclaration, barème 2026 (5 critères
// sur 100, voir data/prompt-methodologie.md) — maquette : barre, note et
// badge de qualification par critère, sous-composantes d'Opérationnalité &
// Moyens en retrait, échelle des 6 paliers du score total, état de la
// RÈGLE DE PLAFOND. Données, qualifications et couleurs : src/lib/
// criteresScore.js (partagées avec le récap "En bref" de la carte score).

// Une ligne critère. Mobile : libellé + badge sur une ligne, barre + note
// (largeur fixe, pour que les barres restent alignées) en dessous. À partir
// de sm : 4 colonnes alignées (libellé, barre, note, badge) — les deux
// conteneurs passent en display: contents pour que leurs enfants
// deviennent des cellules de la grille, replacées par order. Colonnes
// libellé/note/badge au plus juste (texte sm/xs) : le bloc vit dans la
// colonne principale, à côté de la carte "Score Perlimpinpin", et chaque
// pixel gagné va à la barre.
function CritereRow({ label, note, max, badge, isSub = false }) {
  const pct = pourcentage(note, max);
  return (
    <div className="flex flex-col gap-1.5 py-2 sm:grid sm:grid-cols-[12.5rem_minmax(0,1fr)_3rem_8.75rem] sm:items-center sm:gap-x-3 sm:py-1.5">
      <div className="flex items-center justify-between gap-3 sm:contents">
        <p className={`text-sm sm:order-1 ${isSub ? "pl-4 text-zinc-600" : "text-zinc-900"}`}>
          {isSub ? (
            <span aria-hidden="true" className="mr-1 text-zinc-400">
              ↳
            </span>
          ) : null}
          {label}
        </p>
        <span className="shrink-0 sm:order-4">
          {badge ? (
            <span
              className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${badge.className}`}
            >
              {badge.label}
            </span>
          ) : null}
        </span>
      </div>

      <div className="flex items-center gap-4 sm:contents">
        <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-zinc-100 sm:order-2">
          <div className={`h-full rounded-full ${badge?.bar ?? NEUTRAL_BAR}`} style={{ width: `${pct}%` }} />
        </div>
        <p className="w-12 shrink-0 text-right font-mono text-sm sm:order-3 sm:w-auto">
          <span className="font-semibold text-zinc-900">{note ?? "—"}</span>
          <span className="text-zinc-400">/{max}</span>
        </p>
      </div>
    </div>
  );
}

// Échelle des 6 paliers (src/lib/score.js), du plus bas au plus haut, largeur
// de chaque segment proportionnelle à l'étendue de son intervalle. Le palier
// du score total est mis en évidence (trait foncé + libellé en gras).
function ScoreScale({ score }) {
  const bands = getScoreBands().slice().reverse();
  // Même règle que getScoreBadge : un score décimal (ex. 79.5) reste dans son palier.
  const actif = getScoreBadge(score).label;
  return (
    <ol className="grid grid-cols-3 gap-x-2 gap-y-4 sm:flex sm:gap-1.5">
      {bands.map((band) => {
        const active = band.label === actif;
        return (
          <li
            key={band.label}
            style={{ flexGrow: band.max - band.min + 1, flexBasis: 0 }}
            className={`border-t-[3px] pt-2 ${active ? "border-zinc-900" : "border-zinc-200"}`}
            aria-current={active ? "true" : undefined}
          >
            <p className={`text-xs leading-snug ${active ? "font-semibold text-zinc-900" : "text-zinc-500"}`}>{band.label}</p>
            <p className={`mt-1 font-mono text-xs ${active ? "text-zinc-900" : "text-zinc-400"}`}>
              {band.min} à {band.max}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

export default function ScoreDetail({ notation, score }) {
  const plafondLabel = PLAFOND_DECLENCHEUR_LABELS[notation.plafond_declencheur] ?? notation.plafond_declencheur;
  const [operationnalite, ...criteres] = criteresPrincipaux(notation);

  return (
    <section>
      <h2 className="text-2xl font-bold tracking-tight text-zinc-900">Détail du score</h2>

      <div className="mt-4 flex flex-col">
        <CritereRow
          label={operationnalite.label}
          note={operationnalite.note}
          max={operationnalite.max}
          badge={{ label: "Somme de 3 volets", className: NEUTRAL_BADGE, bar: operationnalite.bar }}
        />
        {OPERATIONNALITE.sousCriteres.map(({ key, label, max, qualif }) => (
          <CritereRow
            key={key}
            label={label}
            note={notation[key]}
            max={max}
            badge={qualificationBadge(notation[qualif])}
            isSub
          />
        ))}
        {criteres.map(({ key, label, note, max, badge }) => (
          <CritereRow key={key} label={label} note={note} max={max} badge={badge} />
        ))}
      </div>

      <div className="mt-6">
        <ScoreScale score={score} />
      </div>

      <p className="mt-5 font-mono text-sm text-zinc-500">
        {notation.plafond_applique
          ? `Le plafond d'opérationnalité est déclenché (volet jugé fragile : ${plafondLabel ?? "?"}) : Opérationnalité & Moyens est limité à 10/30.`
          : "Le plafond d'opérationnalité n'est pas déclenché."}
      </p>

      <Link
        href="/methode"
        className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 transition-colors hover:text-blue-800"
      >
        Voir comment nous notons
        <span aria-hidden="true">→</span>
      </Link>
    </section>
  );
}
