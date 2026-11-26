"use client";

/* eslint-disable @next/next/no-img-element -- aperçus de fichiers préparés (public/), affichés tels quels. */
import { useState } from "react";
import { CREDIT_A_COMPLETER, PHOTOS_CONSEILLEES } from "@/lib/photos-candidats";
import { enregistrerPhotosDeposeesAction } from "./actions";

// Onglet « Photos déposées » de /test/photos-candidats : pour chaque photo
// préparée par scripts/preparer-photos-candidats.py, le détouré liseré blanc
// (couverture « une mesure ») et le médaillon côte à côte, la case « Garder »
// (décochée par défaut) et le crédit. Seules les photos gardées entrent dans
// le tirage. `photos` : [{ slug, n, origine, prepareLe, source, credit,
// garder, liseré, medaillon }] (adresses des aperçus).
export default function PhotosDeposees({ slug, photos }) {
  const [choix, setChoix] = useState(() => Object.fromEntries(photos.map((p) => [p.n, { garder: p.garder === true, credit: p.credit ?? CREDIT_A_COMPLETER }])));
  const [retour, setRetour] = useState(null);
  const [occupe, setOccupe] = useState(false);
  const gardees = Object.values(choix).filter((c) => c.garder).length;

  function changer(n, valeur) {
    setChoix((avant) => ({ ...avant, [n]: { ...avant[n], ...valeur } }));
    setRetour(null);
  }

  async function enregistrer() {
    setOccupe(true);
    const r = await enregistrerPhotosDeposeesAction(
      slug,
      photos.map((p) => ({ n: p.n, ...choix[p.n] })),
    );
    setOccupe(false);
    setRetour(r.ok ? { ok: true, texte: `Enregistré : ${r.gardees} photo(s) gardée(s) dans src/lib/photos-candidats.js.` } : { ok: false, texte: r.erreur });
  }

  if (!photos.length) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-xl border border-zinc-200 bg-white p-4 text-sm">
        <p>Aucune photo préparée pour ce candidat. Déposez les originaux dans photos-sources/{slug}/, puis :</p>
        <code className="rounded bg-zinc-100 px-2 py-1">.venv-photos\Scripts\python scripts/preparer-photos-candidats.py {slug}</code>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className={`rounded-full px-3 py-1 font-semibold ${gardees < PHOTOS_CONSEILLEES ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-900"}`}>
          {gardees} gardée(s) sur {photos.length}
        </span>
        {gardees < PHOTOS_CONSEILLEES ? <span className="text-xs font-semibold text-amber-700">Moins de {PHOTOS_CONSEILLEES} photos gardées : la couverture changera peu d’un carrousel à l’autre.</span> : null}
      </div>
      <ul className="grid gap-4 md:grid-cols-2">
        {photos.map((p) => {
          const c = choix[p.n];
          const aCompleter = !c.credit.trim() || c.credit.trim().toLowerCase() === CREDIT_A_COMPLETER;
          return (
            <li key={p.n} className={`flex flex-col gap-3 rounded-xl border bg-white p-3 text-sm ${c.garder ? "border-emerald-500 ring-2 ring-emerald-200" : "border-zinc-200"}`}>
              <div className="flex gap-3">
                <div className="flex h-56 flex-1 items-end justify-center overflow-hidden rounded-lg bg-[#2b4a8b]">
                  <img src={p.lisere} alt={`Détouré n° ${p.n}`} className="max-h-full max-w-full object-contain" />
                </div>
                <div className="flex h-56 w-40 items-center justify-center rounded-lg bg-zinc-100">
                  <div className="h-36 w-36 overflow-hidden rounded-full border-[6px] border-[#FFD23F] bg-[#2b4a8b]">
                    <img src={p.medaillon} alt={`Médaillon n° ${p.n}`} className="h-full w-full object-cover" />
                  </div>
                </div>
              </div>
              <label className="flex items-center gap-2 font-semibold">
                <input type="checkbox" checked={c.garder} onChange={(e) => changer(p.n, { garder: e.target.checked })} className="h-4 w-4" />
                Garder
                <span className="ml-auto font-mono text-xs font-normal text-zinc-500">n° {p.n}</span>
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-semibold text-zinc-700">Crédit (« Photo : … » sur la couverture et dans credits.txt)</span>
                <input
                  type="text"
                  value={c.credit}
                  onChange={(e) => changer(p.n, { credit: e.target.value })}
                  className={`rounded border px-2 py-1 text-sm ${aCompleter ? "border-orange-400 bg-orange-50" : "border-zinc-300"}`}
                />
              </label>
              <p className="break-all text-xs text-zinc-500">
                Original : {p.origine} · préparé le {p.prepareLe} · source : {p.source}
              </p>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={enregistrer} disabled={occupe} className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-50">
          {occupe ? "Enregistrement…" : "Enregistrer"}
        </button>
        {retour ? <span className={`text-sm ${retour.ok ? "text-emerald-700" : "text-red-700"}`}>{retour.texte}</span> : null}
      </div>
    </div>
  );
}
