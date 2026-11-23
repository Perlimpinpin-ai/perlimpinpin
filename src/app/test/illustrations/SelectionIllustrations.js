"use client";

/* eslint-disable @next/next/no-img-element -- aperçus Commons ou Pexels (domaines externes) ou SVG simulés. */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { enregistrerSelectionAction, garderSelectionAction, rechercheSimuleeAction } from "./actions";

// Grille des propositions d'un thème : on coche celles à garder, on corrige le
// mot-clé, puis « Garder les images cochées » : elles sont téléchargées dans
// public/illustrations/<thème>/ (JPEG qualité 82, < 400 Ko, avec leur version
// traitée) et ajoutées à src/lib/illustrations.js. Écriture sur le disque :
// seulement sur le poste local (`localSeulement` : serveur sans disque
// inscriptible, comme Vercel). `dejaGardees` : pages Commons/Pexels déjà dans
// la bibliothèque.
export default function SelectionIllustrations({ theme, candidates, dejaRetenues, simulation, localSeulement = false, dejaGardees = [] }) {
  const router = useRouter();
  const [coches, setCoches] = useState(() => new Set(dejaRetenues.map((c) => c.id)));
  const [mots, setMots] = useState(() => Object.fromEntries(candidates.map((c) => [c.id, dejaRetenues.find((r) => r.id === c.id)?.motCle ?? c.motCle])));
  const [retour, setRetour] = useState(null);
  const [occupe, setOccupe] = useState(false);

  function basculer(id) {
    setCoches((avant) => {
      const apres = new Set(avant);
      if (apres.has(id)) apres.delete(id);
      else apres.add(id);
      return apres;
    });
  }

  async function enregistrer() {
    setOccupe(true);
    const r = await enregistrerSelectionAction(theme, [...coches].map((id) => ({ id, motCle: mots[id] })));
    setOccupe(false);
    setRetour(
      r.ok
        ? {
            ok: true,
            texte: `${r.nombre} image(s) retenue(s).${r.simulees ? ` (${r.simulees} simulée(s) : jamais téléchargées.)` : ""} Étape suivante : node scripts/chercher-illustrations.js ${theme} --telecharger`,
          }
        : { ok: false, texte: r.erreur },
    );
  }

  async function garder() {
    setOccupe(true);
    const r = await garderSelectionAction(theme, [...coches].map((id) => ({ id, motCle: mots[id] })));
    setOccupe(false);
    setRetour(
      r.ok
        ? { ok: true, texte: `${r.ajoutees} image(s) ajoutée(s) à la bibliothèque.${r.erreurs?.length ? ` En échec : ${r.erreurs.join(" ; ")}` : ""}` }
        : { ok: false, texte: r.erreur },
    );
    if (r.ok) router.refresh();
  }

  async function simuler() {
    setOccupe(true);
    const r = await rechercheSimuleeAction(theme);
    setOccupe(false);
    if (!r.ok) setRetour({ ok: false, texte: r.erreur });
    else router.refresh();
  }

  const boutonSimulation = (
    <button type="button" onClick={simuler} disabled={occupe} className="rounded-full border border-zinc-300 bg-white px-4 py-1.5 text-xs font-semibold hover:bg-zinc-100 disabled:opacity-60">
      {candidates.length ? "Nouvelle recherche simulée" : "Recherche simulée (sans appel à Pexels)"}
    </button>
  );

  if (candidates.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-xl border border-zinc-200 bg-white p-4 text-sm">
        <p>Aucune proposition pour ce thème. En ligne de commande (Wikimedia Commons, sans clé) :</p>
        <code className="rounded bg-zinc-100 px-2 py-1">node scripts/chercher-illustrations.js {theme}</code>
        {boutonSimulation}
        {retour ? <p className={retour.ok ? "text-emerald-700" : "text-red-700"}>{retour.texte}</p> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {simulation ? (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Recherche simulée : propositions factices, aucune n’est téléchargeable. Relancez{" "}
          <code>node scripts/chercher-illustrations.js {theme}</code>.
        </p>
      ) : null}
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {candidates.map((c) => {
          const coche = coches.has(c.id);
          const gardee = dejaGardees.includes(c.lien);
          return (
            <li key={c.id} className={`flex flex-col gap-2 rounded-xl border bg-white p-2 ${coche ? "border-emerald-500 ring-2 ring-emerald-200" : "border-zinc-200"}`}>
              <label className="flex cursor-pointer flex-col gap-2">
                <img src={c.apercu} alt={c.description} className="aspect-[3/2] w-full rounded-lg object-cover" loading="lazy" />
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <input type="checkbox" checked={coche} onChange={() => basculer(c.id)} />
                  Garder
                  {gardee ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">dans la bibliothèque</span> : null}
                </span>
              </label>
              <label className="flex items-center gap-2 text-xs text-zinc-600">
                Mot-clé
                <input value={mots[c.id] ?? ""} onChange={(e) => setMots((m) => ({ ...m, [c.id]: e.target.value }))} className="min-w-0 flex-1 rounded border border-zinc-300 px-2 py-1 text-xs" />
              </label>
              <p className="text-xs text-zinc-500">
                « {c.requete} » ·{" "}
                {c.lien ? (
                  <a href={c.lien} target="_blank" rel="noreferrer" className="underline">
                    {c.auteur}, {c.licence}, {c.source}
                  </a>
                ) : (
                  `${c.auteur}, ${c.licence}, ${c.source}`
                )}
                {c.largeur ? ` · ${c.largeur} × ${c.hauteur} px` : ""}
              </p>
              {c.description ? <p className="line-clamp-2 text-xs text-zinc-400">{c.description}</p> : null}
            </li>
          );
        })}
      </ul>
      <div className="sticky bottom-3 flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 bg-white/95 p-3 shadow-sm">
        <button type="button" onClick={garder} disabled={occupe || localSeulement || simulation} className="rounded-full border border-zinc-900 bg-zinc-900 px-4 py-1.5 text-xs font-semibold text-white hover:opacity-80 disabled:opacity-60">
          {occupe ? "…" : `Garder les images cochées (${coches.size})`}
        </button>
        <button type="button" onClick={enregistrer} disabled={occupe || localSeulement} className="rounded-full border border-zinc-300 bg-white px-4 py-1.5 text-xs font-semibold hover:bg-zinc-100 disabled:opacity-60">
          Enregistrer la sélection sans télécharger
        </button>
        {boutonSimulation}
        {retour ? <span className={`text-xs ${retour.ok ? "text-emerald-700" : "text-red-700"}`}>{retour.texte}</span> : null}
      </div>
    </div>
  );
}
