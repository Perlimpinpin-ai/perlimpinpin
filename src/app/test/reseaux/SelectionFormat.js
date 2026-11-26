"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { genererProgrammeAction, genererThematiqueAction } from "./formats-actions";

// Sélection des fiches d'un carrousel de la charte RS, puis génération (un
// seul appel à Claude, lancé par le bouton) :
//  - programme : 6 fiches publiées du candidat, sur 6 thèmes différents, et
//    leur rang (champ de tri à la main : l'ordre où le candidat les met en avant) ;
//  - thématique : 4 à 8 candidats, et pour chacun la fiche publiée sur le
//    thème ou « pas de proposition publiée ».
// Le résultat revient dans l'URL (?e=…) : rien n'est écrit en base.
// `fiches` (programme) : [{ id, titre, themeNom, score }] ;
// `candidats` (thématique) : [{ nom, fiches: [{ id, titre, score }] }].
export default function SelectionFormat({ format, cle, fiches = [], candidats = [], demo = false, initial = {} }) {
  const router = useRouter();
  const [ordres, setOrdres] = useState(initial.ordres ?? {});
  const [choix, setChoix] = useState(initial.choix ?? {});
  const [etat, setEtat] = useState(null);
  const [enCours, demarrer] = useTransition();

  function generer() {
    if (!demo && !window.confirm("Lancer la génération ? Un appel à Claude (environ 0,05 $).")) return;
    demarrer(async () => {
      const r = format === "programme" ? await genererProgrammeAction(cle, ordres) : await genererThematiqueAction(cle, choix);
      setEtat(r);
      if (r.ok && r.e) router.push(`?e=${r.e}`);
    });
  }

  const ordreValide = (v) => ["", "1", "2", "3", "4", "5", "6"].includes(String(v));

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 text-sm">
      {format === "programme" ? (
        <>
          <p className="text-zinc-600">Choisissez 6 fiches publiées, sur 6 thèmes différents, et donnez à chacune son rang (1 à 6) : l’ordre où le candidat les met en avant. Pas de fiche publiée, pas de note.</p>
          <table className="w-full text-left">
            <thead className="text-xs text-zinc-500">
              <tr>
                <th className="py-1 pr-2">Rang</th>
                <th className="py-1 pr-2">Thème</th>
                <th className="py-1 pr-2">Fiche</th>
                <th className="py-1">Note</th>
              </tr>
            </thead>
            <tbody>
              {fiches.map((f) => (
                <tr key={f.id} className="border-t border-zinc-100">
                  <td className="py-1 pr-2">
                    <input value={ordres[f.id] ?? ""} onChange={(e) => ordreValide(e.target.value) && setOrdres({ ...ordres, [f.id]: e.target.value === "" ? undefined : Number(e.target.value) })} className="w-12 rounded border border-zinc-300 px-2 py-1" inputMode="numeric" aria-label={`Rang de « ${f.titre} »`} />
                  </td>
                  <td className="py-1 pr-2">{f.themeNom}</td>
                  <td className="py-1 pr-2">{f.titre}</td>
                  <td className="py-1">{f.score}/100</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <>
          <p className="text-zinc-600">Cochez 4 à 8 candidats. Pour chacun, la fiche publiée sur ce thème, ou « pas de proposition publiée ». Les slides suivent l’ordre alphabétique ; le classement par note n’apparaît que sur le comparatif.</p>
          <ul className="flex flex-col gap-1">
            {candidats.map((c) => {
              const coche = Object.hasOwn(choix, c.nom);
              return (
                <li key={c.nom} className="flex flex-wrap items-center gap-2">
                  <label className="flex w-56 items-center gap-2">
                    <input
                      type="checkbox"
                      checked={coche}
                      onChange={(e) => {
                        const suivant = { ...choix };
                        if (e.target.checked) suivant[c.nom] = c.fiches[0]?.id ?? null;
                        else delete suivant[c.nom];
                        setChoix(suivant);
                      }}
                    />
                    {c.nom}
                  </label>
                  {coche ? (
                    <select value={choix[c.nom] ?? ""} onChange={(e) => setChoix({ ...choix, [c.nom]: e.target.value === "" ? null : Number(e.target.value) })} className="rounded border border-zinc-300 px-2 py-1">
                      <option value="">Pas de proposition publiée sur ce thème</option>
                      {c.fiches.map((f) => (
                        <option key={f.id} value={f.id}>
                          {`${f.titre} (${f.score}/100)`}
                        </option>
                      ))}
                    </select>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={generer} disabled={enCours} className="rounded-lg bg-zinc-900 px-4 py-2 font-semibold text-white disabled:opacity-50">
          {enCours ? "Génération…" : demo ? "Afficher la démonstration (réponse simulée)" : "Générer le carrousel (un appel à Claude)"}
        </button>
        {etat && !etat.ok ? <span className="font-semibold text-red-700">{etat.erreur}</span> : null}
        {etat?.ok && etat.message ? <span className="text-zinc-600">{etat.message}</span> : null}
        {etat?.cout ? <span className="text-zinc-500">{`coût : ${etat.cout.toFixed(3)} $`}</span> : null}
      </div>
    </div>
  );
}
