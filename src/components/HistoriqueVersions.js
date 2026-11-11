"use client";

import { useEffect, useState } from "react";

// Historique des versions d'une fiche publiée (Club ouvert, lot 5).
// Le numéro de version est visible de tous (carte du score). Le détail
// (dates, critères modifiés, raisons, crédits, annotations archivées et
// réponses de l'équipe) est réservé aux adhérents : il n'est chargé que par
// /api/fiches/<id>/historique, qui exige la session du Club. Les autres
// visiteurs ne voient qu'une invitation à adhérer.

const dateFr = (iso) => {
  try {
    return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" });
  } catch {
    return "";
  }
};

export default function HistoriqueVersions({ propositionId, numeroVersion, retour }) {
  const [etat, setEtat] = useState({ chargement: true, versions: null, membre: false });

  useEffect(() => {
    let annule = false;
    fetch(`/api/fiches/${propositionId}/historique`, { cache: "no-store", credentials: "same-origin" })
      .then(async (r) => {
        if (annule) return;
        if (r.status === 401) return setEtat({ chargement: false, versions: null, membre: false });
        const data = r.ok ? await r.json().catch(() => null) : null;
        if (!annule) setEtat({ chargement: false, versions: data?.versions ?? [], membre: true });
      })
      .catch(() => !annule && setEtat({ chargement: false, versions: null, membre: false }));
    return () => {
      annule = true;
    };
  }, [propositionId]);

  return (
    <section id="historique" className="scroll-mt-24 print:hidden" aria-label="Historique des versions">
      <h2 className="font-sans text-2xl font-bold text-zinc-900">
        Historique des versions{" "}
        <span className="ml-1 rounded-full border border-yellow-300 bg-yellow-100 px-2 py-0.5 align-middle font-mono text-sm font-semibold text-zinc-800">
          V{numeroVersion ?? 1}
        </span>
      </h2>

      {etat.chargement ? null : !etat.membre ? (
        <div className="mt-3 rounded-2xl border border-yellow-200 bg-yellow-50/60 p-4 text-sm text-zinc-700">
          <p>
            Cette analyse évolue grâce aux membres du Club. L&rsquo;historique détaillé (critères modifiés, raisons,
            contributeurs et réponses de l&rsquo;équipe) est réservé au Club.
          </p>
          <a
            href={`/relectures/adherer?retour=${encodeURIComponent(retour)}`}
            className="mt-3 inline-flex rounded-full bg-yellow-300 px-4 py-2 font-semibold text-zinc-900 hover:bg-yellow-400"
          >
            Adhérer au Club
          </a>
        </div>
      ) : (
        <ol className="mt-4 flex flex-col gap-4">
          {[...(etat.versions ?? [])].reverse().map((v) => (
            <li key={v.analyseId} className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm">
              <p className="font-semibold text-zinc-900">
                V{v.numero} · {dateFr(v.date)}
                {v.scoreAvant != null && v.scoreApres != null ? (
                  <span className="ml-2 font-normal text-zinc-600">
                    score {v.scoreAvant} → {v.scoreApres}
                  </span>
                ) : null}
              </p>
              {v.raison ? <p className="mt-1 text-zinc-700">{v.raison}</p> : null}
              {v.criteresModifies.length > 0 ? (
                <ul className="mt-2 list-disc pl-5 text-zinc-700">
                  {v.criteresModifies.map((c) => (
                    <li key={c.critere}>
                      {c.critere} : {c.ancienneNote} → {c.nouvelleNote}
                    </li>
                  ))}
                </ul>
              ) : null}
              {v.credits.length > 0 ? (
                <p className="mt-2 text-zinc-600">Merci à {v.credits.join(", ")} pour leur contribution.</p>
              ) : null}
              {v.annotations.length > 0 ? (
                <details className="mt-3">
                  <summary className="cursor-pointer font-semibold text-zinc-700">
                    Annotations traitées sur cette version et réponses de l&rsquo;équipe
                  </summary>
                  <ul className="mt-2 flex flex-col gap-2">
                    {v.annotations.map((a) => (
                      <li key={a.id} className="rounded-xl bg-yellow-50/70 p-3">
                        <p className="text-xs text-zinc-500">
                          {a.auteur}
                          {a.section ? ` · ${a.section}` : ""}
                          {a.retenu ? " · a fait évoluer la fiche" : ""}
                        </p>
                        {a.passage ? <p className="mt-1 italic text-zinc-500">« {a.passage} »</p> : null}
                        <p className="mt-1 whitespace-pre-wrap text-zinc-800">{a.annotation}</p>
                        {a.reponse ? (
                          <p className="mt-2 border-l-2 border-yellow-300 pl-2 text-zinc-700">
                            <b>Réponse de l&rsquo;équipe :</b> {a.reponse}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
