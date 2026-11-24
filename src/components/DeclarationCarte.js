import { cheminFiche } from "@/lib/slug";
import Link from "next/link";
import MonoTag from "@/components/MonoTag";
import { getScoreBadge } from "@/lib/score";
import { vignettePhoto } from "@/lib/photo-vignette";

// Carte d'une déclaration analysée publiée (pages /declarations et
// /candidats/[id]). `d` : une entrée de getPublishedDeclarations() ou de
// getCandidatAvecDeclarations() — id (proposition), rang, titre, candidatNom,
// candidatParti, candidatPhotoUrl, theme, dateLabel, score.
export default function DeclarationCarte({ d }) {
  const badge = getScoreBadge(d.score);
  return (
    <Link
      href={cheminFiche(d)}
      prefetch={false}
      className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-6 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <img
            src={vignettePhoto(d.candidatPhotoUrl) || "/avatar-placeholder.svg"}
            alt={d.candidatNom}
            className="h-9 w-9 shrink-0 rounded-lg object-cover object-top"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-zinc-900">
              {d.candidatNom}
            </p>
            <p className="text-xs text-zinc-400">{d.candidatParti}</p>
          </div>
        </div>
        <MonoTag className="shrink-0">
          {`ANALYSE_${String(d.rang).padStart(3, "0")}`}
        </MonoTag>
      </div>

      <p className="line-clamp-2 text-base font-semibold leading-snug text-zinc-900">
        {d.titre}
      </p>

      <div className="flex items-center gap-2">
        <span className={`text-2xl font-extrabold tracking-tight ${badge.scoreClass}`}>
          {d.score}
          <span className="text-sm font-semibold text-zinc-400">/100</span>
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badge.badgeClass}`}
        >
          {badge.label}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-400">
          {d.theme} · {d.dateLabel}
        </p>
        <span aria-hidden="true" className="text-zinc-400">
          →
        </span>
      </div>
    </Link>
  );
}
