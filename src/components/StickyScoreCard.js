"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useVueAnalyse } from "@/components/VueAnalyseProvider";
import ScoreEnBref from "@/components/ScoreEnBref";

// Carte sticky de la colonne latérale : affiche le score en permanence, et
// bascule son contenu secondaire (commentaire + bouton -> mini sommaire de
// navigation) une fois que le lecteur a dépassé le résumé IA en haut de
// page. Détecté via un écouteur de scroll qui compare la position d'une
// sentinelle posée par la page (id="resume-sentinel") au viewport, plutôt
// qu'un IntersectionObserver — la position de scroll seule suffit ici, pas
// besoin de dépendre du pipeline de rendu/compositing.
//
// Fiche avec version basique (VueAnalyseProvider présent) : en vue basique, le
// sommaire affiche sectionsBasique et le bouton du bas bascule vers la vue
// expert. La sentinelle n'existe que dans la vue basique : masquée (vue
// expert), elle renvoie top = 0 et le sommaire reste caché, comme avant. Sans
// version basique (pas de contexte), rien ne change.
export default function StickyScoreCard({
  score,
  badge,
  scoreComment,
  sections,
  sectionsBasique,
  versionMethodologie,
  generationDateLabel,
  enBrefNotation,
}) {
  const [scrolledPast, setScrolledPast] = useState(false);
  const vueAnalyse = useVueAnalyse();
  const vueBasique = vueAnalyse?.vue === "basique";
  const sectionsAffichees = vueBasique && sectionsBasique ? sectionsBasique : sections;

  useEffect(() => {
    const sentinel = document.getElementById("resume-sentinel");
    if (!sentinel) return undefined;

    const checkPosition = () => setScrolledPast(sentinel.getBoundingClientRect().top < 0);
    checkPosition();

    window.addEventListener("scroll", checkPosition, { passive: true });
    window.addEventListener("resize", checkPosition);
    return () => {
      window.removeEventListener("scroll", checkPosition);
      window.removeEventListener("resize", checkPosition);
    };
    // Revérifié à chaque bascule : la sentinelle apparaît ou disparaît avec la vue basique.
  }, [vueAnalyse?.vue]);

  return (
    <div className="break-inside-avoid rounded-2xl border border-zinc-200 bg-white p-6">
      <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">
        Score Perlimpinpin
      </span>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className={`text-[3.6rem] font-extrabold tracking-tight ${badge.scoreClass}`}>
          {score}
        </span>
        <span className="text-lg font-semibold text-zinc-400">/100</span>
      </div>
      <div
        className={`mt-3 inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-semibold ${badge.badgeClass}`}
      >
        {badge.label}
      </div>

      {/* Récap "En bref" des 5 critères : seulement si la page le fournit
          (barème 2026, carte de l'aside lg+). */}
      {enBrefNotation ? <ScoreEnBref notation={enBrefNotation} /> : null}

      {scrolledPast ? (
        <nav className="mt-4 flex flex-col gap-1 border-t border-zinc-100 pt-4 print:hidden">
          <span className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Sur cette page
          </span>
          {sectionsAffichees.map(({ id, label }) => (
            <a
              key={id}
              href={`#${id}`}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 font-mono text-sm text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-blue-700"
            >
              <span aria-hidden="true" className="text-zinc-400">
                &gt;
              </span>
              {label}
            </a>
          ))}
        </nav>
      ) : scoreComment ? (
        <p className="mt-4 text-sm leading-relaxed text-zinc-500">{scoreComment}</p>
      ) : null}

      {/* Filet d'audit visible : mêmes champs (versionMethodologie,
          generationDateLabel) qu'affichés en haut de fiche avant la refonte
          du Bloc A — juste déplacés ici, dans la sidebar, plutôt que
          disparus. "Tagadaaa" : nom de code fixe du projet, pas une valeur
          dérivée de versionMethodologie (voir la demande d'origine). */}
      {versionMethodologie && generationDateLabel ? (
        <div className="mt-4 font-mono text-xs text-zinc-400">
          <p>
            Analyse réalisée le {generationDateLabel} avec Perlimpinpin{" "}
            {versionMethodologie} · Tagadaaa
          </p>
        </div>
      ) : null}

      {vueBasique ? (
        <button
          type="button"
          onClick={() => vueAnalyse.basculer("expert", { defiler: true })}
          className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 print:hidden"
        >
          Lire l&apos;analyse détaillée
          <span aria-hidden="true">→</span>
        </button>
      ) : (
        <Link
          href="#raisonnement-complet"
          className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 print:hidden"
        >
          Lire l&apos;analyse détaillée
          <span aria-hidden="true">→</span>
        </Link>
      )}
    </div>
  );
}
