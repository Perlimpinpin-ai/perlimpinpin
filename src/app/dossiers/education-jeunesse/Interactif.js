"use client";

import { useState } from "react";

// Parties à onglets du dossier « Éducation et jeunesse » : les face-à-face
// (un onglet par sujet comparé) et le parcours en huit étapes. Les données
// arrivent prêtes du serveur (page.js) : chaque mesure porte déjà sa fiche
// publiée (`fiche`, lue en base) ou rien, auquel cas « Analyse à venir ».

const ANALYSE_A_VENIR = "Analyse à venir";

// Note et appréciation d'une fiche publiée, ou « Analyse à venir ».
function Note({ fiche, grande = false }) {
  if (!fiche) {
    return (
      <span className="w-fit rounded-full border border-dashed border-(--ms-gris400) px-3 py-1 text-xs font-semibold text-(--ms-gris600)">
        {ANALYSE_A_VENIR}
      </span>
    );
  }
  return (
    <span className="flex flex-wrap items-baseline gap-2.5">
      <span className={`${grande ? "text-4xl" : "text-xl"} font-black tracking-[-0.03em] ${fiche.classeScore}`}>
        {fiche.score}
        <span className={`${grande ? "text-base" : "text-sm"} font-semibold text-(--ms-gris600)`}>/100</span>
      </span>
      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${fiche.classeBadge}`}>{fiche.appreciation}</span>
    </span>
  );
}

export function FaceAFace({ items }) {
  const [actif, setActif] = useState(0);
  const item = items[actif];
  return (
    <div className="flex flex-col gap-5">
      <div role="tablist" aria-label="Sujets comparés" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {items.map((it, i) => {
          const choisi = i === actif;
          return (
            <button
              key={it.titre}
              type="button"
              role="tab"
              id={`fa-onglet-${i}`}
              aria-selected={choisi}
              aria-controls="fa-panneau"
              onClick={() => setActif(i)}
              className={`flex min-h-14 items-start gap-3 rounded-2xl bg-white px-4 py-3.5 text-left transition-colors ${
                choisi ? "border-2 border-(--ms-noir)" : "border border-(--ms-gris200) hover:border-(--ms-gris400)"
              }`}
            >
              <span
                className={`inline-flex h-7 min-w-7 flex-none items-center justify-center rounded-md font-mono text-sm font-bold text-(--ms-noir) ${
                  choisi ? "bg-(--ms-jaune)" : "bg-(--ms-gris200)"
                }`}
              >
                {i + 1}
              </span>
              <span className="flex flex-col gap-1">
                <span className="text-[15px] font-bold leading-snug text-(--ms-noir)">{it.titre}</span>
                <span className="text-xs text-(--ms-gris600)">{it.qui}</span>
              </span>
            </button>
          );
        })}
      </div>
      <div
        id="fa-panneau"
        role="tabpanel"
        aria-labelledby={`fa-onglet-${actif}`}
        className="flex flex-col gap-5 rounded-3xl border border-(--ms-gris200) bg-white p-6 sm:p-8"
      >
        <div className="flex flex-col gap-2">
          <h3 className="text-2xl font-extrabold tracking-[-0.02em] text-(--ms-noir)">{item.titre}</h3>
          <p className="max-w-3xl text-[15px] leading-relaxed text-(--ms-gris600)">{item.chapo}</p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {item.mesures.map((m) => (
            <article key={m.candidat + m.mesure} className="flex flex-col gap-3 rounded-2xl border border-(--ms-gris200) bg-(--ms-gris50) p-5">
              <div className="flex items-baseline gap-2 border-b-2 border-(--ms-noir) pb-2.5">
                <span className="text-lg font-extrabold text-(--ms-noir)">{m.candidat}</span>
                <span className="text-xs text-(--ms-gris600)">{m.parti}</span>
              </div>
              <p className="text-base font-bold leading-snug text-(--ms-noir)">{m.mesure}</p>
              <div className="mt-auto flex flex-col gap-2 pt-1">
                <Note fiche={m.fiche} grande />
                {m.fiche ? (
                  <a
                    href={m.fiche.url}
                    className="w-fit text-sm font-semibold text-(--ms-noir) underline decoration-(--ms-jaune) decoration-2 underline-offset-4"
                  >
                    Lire la fiche complète <span aria-hidden="true">→</span>
                  </a>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Parcours({ etapes, etapeParDefaut = 0, libelleNonAnalysee }) {
  const [actif, setActif] = useState(Math.min(etapeParDefaut, etapes.length - 1));
  const etape = etapes[actif];
  const reste = etape.total - etape.phares.length;
  const pluriel = reste > 1 ? "s" : "";
  return (
    <div className="flex flex-col gap-5">
      <div className="w-full min-w-0 overflow-x-auto pb-1">
        <div role="tablist" aria-label="Étapes du parcours" className="grid min-w-[880px] grid-cols-8">
          {etapes.map((e, i) => {
            const choisi = i === actif;
            return (
              <button
                key={e.titre}
                type="button"
                role="tab"
                id={`pa-onglet-${i}`}
                aria-selected={choisi}
                aria-controls="pa-panneau"
                onClick={() => setActif(i)}
                className="flex min-h-12 flex-col items-center gap-2.5 px-1.5 text-center"
              >
                <span className="flex w-full items-center">
                  <span className={`h-[3px] flex-1 ${i === 0 ? "bg-transparent" : "bg-(--ms-gris200)"}`} />
                  <span
                    className={`inline-flex flex-none items-center justify-center rounded-full font-extrabold text-(--ms-noir) ${
                      choisi
                        ? "h-12 w-12 border-2 border-(--ms-noir) bg-(--ms-jaune) text-lg"
                        : "h-10 w-10 border-[1.5px] border-(--ms-gris400) bg-white text-sm"
                    }`}
                  >
                    {e.total}
                  </span>
                  <span className={`h-[3px] flex-1 ${i === etapes.length - 1 ? "bg-transparent" : "bg-(--ms-gris200)"}`} />
                </span>
                <span className={`text-[13px] leading-snug text-(--ms-noir) ${choisi ? "font-extrabold" : "font-medium"}`}>{e.titre}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-(--ms-gris600)">
                  {e.phares.length} notée{e.phares.length > 1 ? "s" : ""}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div
        id="pa-panneau"
        role="tabpanel"
        aria-labelledby={`pa-onglet-${actif}`}
        className="flex flex-col gap-4 rounded-3xl border border-(--ms-gris200) bg-white p-6 sm:p-8"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-2">
          <h3 className="text-2xl font-extrabold tracking-[-0.02em] text-(--ms-noir)">{etape.titre}</h3>
          <span className="text-[13px] text-(--ms-gris600)">
            {etape.total} propositions · {etape.repartition}
          </span>
        </div>
        <p className="max-w-3xl text-[15px] leading-relaxed text-(--ms-gris600)">{etape.chapo}</p>
        <p className="mt-1 font-mono text-xs font-semibold uppercase tracking-[0.1em] text-(--ms-gris600)">{"// Mesures phares notées"}</p>
        <ul className="flex flex-col">
          {etape.phares.map((m) => (
            <li key={m.candidat + m.mesure} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-(--ms-gris200) py-3.5">
              <span className="w-40 flex-none text-[15px] font-extrabold text-(--ms-noir)">{m.candidat}</span>
              <span className="min-w-0 flex-[999_1_280px] text-[15px] leading-snug text-(--ms-gris900)">
                {m.fiche ? (
                  <a href={m.fiche.url} className="underline decoration-(--ms-jaune) decoration-2 underline-offset-4">
                    {m.mesure}
                  </a>
                ) : (
                  m.mesure
                )}
              </span>
              <Note fiche={m.fiche} />
            </li>
          ))}
        </ul>
        <div className="flex flex-col border-t border-(--ms-gris200) pt-3.5">
          <p className="text-[15px] font-bold text-(--ms-noir)">
            {reste > 0
              ? `${reste} autre${pluriel} proposition${pluriel} recensée${pluriel}, non analysée${pluriel}`
              : "Aucune autre proposition retenue"}
          </p>
          {etape.autres.length ? (
            <ul className="mt-2 flex flex-col">
              {etape.autres.map((o) => (
                <li key={o.candidat + o.mesure} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-dashed border-(--ms-gris200) py-2.5">
                  <span className="w-40 flex-none text-sm font-bold text-(--ms-noir)">{o.candidat}</span>
                  <span className="min-w-0 flex-[999_1_280px] text-sm text-(--ms-gris900)">{o.mesure}</span>
                  <span className="font-mono text-[11px] text-(--ms-gris600)">{libelleNonAnalysee}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  );
}
