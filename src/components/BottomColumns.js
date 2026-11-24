import { cheminFiche } from "@/lib/slug";
import Link from "next/link";
import { formatScore, getScoreBadge, getScoreBands } from "@/lib/score";
import { vignettePhoto } from "@/lib/photo-vignette";
import ListeDeroulante from "./ListeDeroulante";
import { textesParDefaut } from "@/lib/textes-site";

function ColumnHeader({ title, subtitle, icon }) {
  return (
    <div className="mb-6">
      <h2 className="flex items-center gap-2 text-base font-bold text-zinc-900">
        {icon}
        {title}
      </h2>
      {subtitle ? (
        <p className="mt-0.5 text-xs text-zinc-400">{subtitle}</p>
      ) : null}
    </div>
  );
}

// Lien gris discret sous une liste (« Voir toutes les analyses → »…).
function VoirTout({ label, href }) {
  if (!label) return null;
  return (
    <Link
      href={href}
      prefetch={false}
      className="mt-6 inline-block text-sm font-semibold text-zinc-500 transition-colors hover:text-zinc-900"
    >
      {label}
    </Link>
  );
}

function TopDeclarationsColumn({ declarations, t }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6">
      <ColumnHeader
        title={t["colonnes.declarations.titre"]}
      />

      {declarations.length === 0 ? (
        <p className="text-sm text-zinc-500">
          {t["colonnes.declarations.vide"]}
        </p>
      ) : (
        <ul className="flex flex-col gap-5">
          {declarations.map((item, index) => {
            const badge = getScoreBadge(item.score);
            return (
              <li key={`${item.name}-${index}`}>
                <Link
                  href={cheminFiche(item)}
                  className="-m-2 flex flex-wrap items-start gap-3 rounded-xl p-2 transition-colors hover:bg-zinc-50"
                >
                  <img
                    src={vignettePhoto(item.photoUrl) || "/avatar-placeholder.svg"}
                    alt={item.name}
                    className="h-9 w-9 shrink-0 rounded-lg object-cover object-top"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-zinc-900">
                      {item.name}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-sm font-medium text-zinc-800">
                      &ldquo;{item.quote}&rdquo;
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-sm font-bold text-zinc-900">
                      {item.score}
                      <span className="text-xs font-medium text-zinc-400">
                        /100
                      </span>
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badge.badgeClass}`}
                    >
                      {badge.label}
                    </span>
                  </div>
                  {/* Date + catégorie sur une seule ligne, sur toute la largeur
                      (sous le texte et le score), alignée avec le texte. */}
                  <p className="-mt-2 basis-full truncate pl-12 text-xs text-zinc-400">
                    <span className="whitespace-nowrap">{item.date}</span> · {item.theme}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <VoirTout label={t["colonnes.declarations.lien"]} href="/declarations" />
    </div>
  );
}

// Version minimaliste : sans icône, une ligne par palier (fourchette +
// libellé) et une mini phrase (champ `courte` de src/lib/score.js) — le
// détail complet est sur /methode.
function ScoreExplainerColumn({ t }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6">
      <ColumnHeader title={t["colonnes.score.titre"]} />

      <p className="mb-5 text-sm leading-relaxed text-zinc-500">
        {t["colonnes.score.texte"]}
      </p>

      <ul className="flex flex-col divide-y divide-zinc-100">
        {getScoreBands().map((item) => (
          <li key={item.label} className="py-2.5">
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-sm tabular-nums text-zinc-500">
                {item.min}–{item.max}
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${item.badge}`}
              >
                {item.label}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-zinc-400">{item.courte}</p>
          </li>
        ))}
      </ul>

      <VoirTout label={t["colonnes.score.lien"]} href="/methode" />
    </div>
  );
}

function TrendIndicator({ trend, delta }) {
  if (!trend) {
    return <span className="text-xs font-medium text-zinc-300">—</span>;
  }

  const isUp = trend === "up";
  return (
    <span
      className={`flex items-center gap-0.5 text-xs font-semibold ${isUp ? "text-green-600" : "text-red-600"}`}
    >
      {isUp ? "↗" : "↘"}
      {delta}
    </span>
  );
}

// Nombre de candidats affichés avant « Dérouler ».
const CANDIDATS_VISIBLES = 5;

// Une ligne du classement : rang, photo, nom, nombre de déclarations, score.
function LigneCandidat({ candidate, rang }) {
  return (
    <li className="flex items-center gap-3">
      <span className="w-4 shrink-0 text-sm font-semibold text-zinc-400">
        {rang}
      </span>
      <Link
        href={`/declarations?candidat=${encodeURIComponent(candidate.name)}`}
        prefetch={false}
        className="flex min-w-0 flex-1 items-center gap-3 transition-opacity hover:opacity-70"
      >
        <img
          src={vignettePhoto(candidate.photoUrl) || "/avatar-placeholder.svg"}
          alt={candidate.name}
          className="h-9 w-9 shrink-0 rounded-lg object-cover object-top"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-zinc-900">
            {candidate.name}
          </p>
          <p className="mt-0.5 text-xs text-zinc-400">
            {candidate.declarations} déclarations analysées
          </p>
        </div>
      </Link>
      <div className="flex shrink-0 items-center gap-3">
        <TrendIndicator trend={candidate.trend} delta={candidate.delta} />
        {candidate.avgScore == null ? (
          <span className="text-xs font-medium text-zinc-400">
            Pas encore noté
          </span>
        ) : (
          <span
            className={`text-sm font-bold ${getScoreBadge(candidate.avgScore).scoreClass}`}
          >
            {formatScore(candidate.avgScore)}
            <span className="text-xs font-medium text-zinc-400">
              /100
            </span>
          </span>
        )}
      </div>
    </li>
  );
}

function ReliabilityIndexColumn({ candidates, t }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6">
      <ColumnHeader
        title={t["colonnes.candidats.titre"]}
        subtitle={t["colonnes.candidats.soustitre"]}
      />

      {candidates.length === 0 ? (
        <p className="text-sm text-zinc-500">{t["colonnes.candidats.vide"]}</p>
      ) : (
        <ListeDeroulante
          suite={candidates.slice(CANDIDATS_VISIBLES).map((candidate, index) => (
            <LigneCandidat
              key={candidate.name}
              candidate={candidate}
              rang={CANDIDATS_VISIBLES + index + 1}
            />
          ))}
        >
          {candidates.slice(0, CANDIDATS_VISIBLES).map((candidate, index) => (
            <LigneCandidat key={candidate.name} candidate={candidate} rang={index + 1} />
          ))}
        </ListeDeroulante>
      )}

      <div>
        <VoirTout label={t["colonnes.candidats.lien"]} href="/candidats" />
      </div>

      <p className="mt-6 border-t border-zinc-100 pt-4 text-xs leading-relaxed text-zinc-400">
        {t["colonnes.candidats.note"]}
      </p>
    </div>
  );
}

// `textes` : textes de la page d'accueil (src/lib/textes/accueil.js), lus en
// base par la page. Les textes par défaut servent de secours.
export default function BottomColumns({ topDeclarations, rankedCandidates, textes }) {
  const t = { ...textesParDefaut("accueil"), ...textes };
  return (
    <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-3">
      <TopDeclarationsColumn declarations={topDeclarations} t={t} />
      <ScoreExplainerColumn t={t} />
      <ReliabilityIndexColumn candidates={rankedCandidates} t={t} />
    </div>
  );
}
