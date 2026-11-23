import Link from "next/link";
import Header from "@/components/Header";
import MonoTag from "@/components/MonoTag";
import ArrowIcon from "@/components/ArrowIcon";
import { getScoreExtremes, getVoteMesureLeaderboard } from "@/lib/queries";
import { getScoreBadge } from "@/lib/score";
import { vignettePhoto } from "@/lib/photo-vignette";

// ISR : servie depuis le cache du CDN, recalculée au plus tard une fois par jour,
// aussitôt après chaque publication (src/lib/rafraichir-public.js) et après
// chaque vote sur une mesure (/api/vote-mesure).
export const revalidate = 86400;

const ICON_FLAG = (
  <path
    strokeLinecap="round"
    strokeLinejoin="round"
    d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5"
  />
);

const EXTREME_TINTS = {
  green: { flag: "text-green-600", border: "border-l-green-500" },
  red: { flag: "text-red-600", border: "border-l-red-500" },
};

function ExtremeCard({ label, tint, card }) {
  const tintClasses = EXTREME_TINTS[tint];

  return (
    <div>
      <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-zinc-500">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          className={`h-3.5 w-3.5 ${tintClasses.flag}`}
          aria-hidden="true"
        >
          {ICON_FLAG}
        </svg>
        {label}
      </span>

      {card ? (
        <ExtremeCardContent card={card} border={tintClasses.border} />
      ) : (
        <div className={`mt-3 flex h-full min-h-[180px] items-center justify-center rounded-2xl border border-l-4 border-zinc-200 bg-white p-6 text-center ${tintClasses.border}`}>
          <p className="text-sm text-zinc-500">
            Pas encore assez de déclarations publiées.
          </p>
        </div>
      )}
    </div>
  );
}

function ExtremeCardContent({ card, border }) {
  const badge = getScoreBadge(card.score);

  return (
    <div className={`mt-3 rounded-2xl border border-l-4 border-zinc-200 bg-white p-6 ${border}`}>
      <div className="flex items-center gap-3">
        <img
          src={vignettePhoto(card.candidatPhotoUrl) || "/avatar-placeholder.svg"}
          alt={card.candidatNom}
          className="h-10 w-10 shrink-0 rounded-lg object-cover object-top"
        />
        <p className="text-sm font-semibold text-zinc-900">{card.candidatNom}</p>
      </div>

      <p className="mt-3 line-clamp-2 text-base font-semibold leading-snug text-zinc-900">
        {card.titre}
      </p>

      <div className="mt-4 flex items-center gap-2">
        <span className={`text-3xl font-extrabold tracking-tight ${badge.scoreClass}`}>
          {card.score}
          <span className="text-sm font-semibold text-zinc-400">/100</span>
        </span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badge.badgeClass}`}>
          {badge.label}
        </span>
      </div>

      <Link
        href={`/declarations/${card.propositionId}`}
        className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-blue-600 underline decoration-blue-200 underline-offset-2 transition-colors hover:text-blue-800"
      >
        Voir l&apos;analyse →
      </Link>
    </div>
  );
}

function VoteColumn({ title, cards, countLabel, pctLabel, direction }) {
  if (cards.length === 0) {
    return (
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">{title}</p>
        <p className="mt-4 text-sm text-zinc-500">Pas encore assez de votes.</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">{title}</p>
      <ol className="mt-4 flex flex-col gap-4">
        {cards.map((card, index) => (
          <li key={card.propositionId}>
            <Link
              href={`/declarations/${card.propositionId}`}
              className="-m-2 flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-zinc-50"
            >
              <span className="w-5 shrink-0 text-sm font-bold text-zinc-400">
                {String(index + 1).padStart(2, "0")}
              </span>
              <img
                src={vignettePhoto(card.candidatPhotoUrl) || "/avatar-placeholder.svg"}
                alt={card.candidatNom}
                className="h-9 w-9 shrink-0 rounded-lg object-cover object-top"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-zinc-900">{card.candidatNom}</p>
                <p className="truncate text-xs text-zinc-500">{card.titre}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="flex items-center gap-1 text-sm font-semibold text-zinc-700">
                  <ArrowIcon direction={direction} className="h-3.5 w-3.5 text-zinc-400" />
                  {countLabel(card).toLocaleString("fr-FR")}
                </span>
                <span className="text-xs font-medium text-zinc-400">
                  {pctLabel(card)}%
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default async function PrixPerlimpinpinPage() {
  const [scoreExtremes, voteMesureLeaderboard] = await Promise.all([
    getScoreExtremes(),
    getVoteMesureLeaderboard(),
  ]);

  return (
    <div className="flex min-h-screen flex-col bg-page-gradient font-sans">
      <Header />

      <main className="w-full px-6 py-12 sm:px-8 sm:py-16">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-14">
          <div>
            <MonoTag>Classements</MonoTag>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-4xl">
              Prix Perlimpinpin
            </h1>
            <p className="mt-2 text-sm text-zinc-500">
              Le classement des déclarations les plus (et les moins)
              plébiscitées par les visiteurs.
            </p>
          </div>

          <div>
            <MonoTag>Score_perlimpinpin</MonoTag>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-zinc-900 sm:text-3xl">
              Les extrêmes du score
            </h2>
            <hr className="mt-4 border-zinc-200" />

            <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
              <ExtremeCard label="Plus haut score" tint="green" card={scoreExtremes.highest} />
              <ExtremeCard label="Plus bas score" tint="red" card={scoreExtremes.lowest} />
            </div>
          </div>

          <div>
            <MonoTag>Vote_public</MonoTag>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-zinc-900 sm:text-3xl">
              Le choix des visiteurs
            </h2>
            <p className="mt-2 text-sm text-zinc-500">
              Indépendamment du score Perlimpinpin, les visiteurs expriment
              leur opinion.
            </p>

            <div className="mt-6 grid grid-cols-1 gap-8 sm:grid-cols-2 sm:divide-x sm:divide-zinc-200">
              <div className="sm:pr-8">
                <VoteColumn
                  title="Le plus apprécié"
                  cards={voteMesureLeaderboard.topAccord}
                  countLabel={(card) => card.accord}
                  pctLabel={(card) => card.accordPct}
                  direction="up"
                />
              </div>
              <div className="sm:pl-8">
                <VoteColumn
                  title="Le plus contesté"
                  cards={voteMesureLeaderboard.topDesaccord}
                  countLabel={(card) => card.desaccord}
                  pctLabel={(card) => card.desaccordPct}
                  direction="down"
                />
              </div>
            </div>
          </div>

          <p className="text-center text-xs text-zinc-400">
            <span className="font-mono font-semibold text-zinc-500">score ≠ opinion</span>{" "}
            — Le score Perlimpinpin évalue la solidité des déclarations
            selon notre méthode. Les votes reflètent l&apos;opinion des
            visiteurs.
          </p>
        </div>
      </main>
    </div>
  );
}
