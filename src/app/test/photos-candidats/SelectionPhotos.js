"use client";

/* eslint-disable @next/next/no-img-element -- aperçus servis par upload.wikimedia.org (domaine externe). */
import { useState } from "react";
import { PHOTOS_MIN } from "@/lib/photos-candidats";
import { enregistrerSelectionPhotosAction } from "./actions";

// Grille des photos proposées pour un candidat : on coche celles à garder,
// puis « Enregistrer la sélection ». Rien n'est téléchargé ici.
export default function SelectionPhotos({ slug, candidates, dejaRetenues }) {
  const [coches, setCoches] = useState(() => new Set(dejaRetenues));
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
    const r = await enregistrerSelectionPhotosAction(slug, [...coches]);
    setOccupe(false);
    setRetour(
      r.ok
        ? { ok: true, texte: `${r.nombre} photo(s) retenue(s). Étape suivante : node scripts/chercher-photos-candidats.js ${slug} --telecharger` }
        : { ok: false, texte: r.erreur },
    );
  }

  if (candidates.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-xl border border-zinc-200 bg-white p-4 text-sm">
        <p>Aucune photo proposée pour ce candidat. En ligne de commande :</p>
        <code className="rounded bg-zinc-100 px-2 py-1">node scripts/chercher-photos-candidats.js {slug}</code>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {candidates.map((c) => {
          const coche = coches.has(c.id);
          return (
            <li key={c.id} className={`flex flex-col gap-2 rounded-xl border bg-white p-2 ${coche ? "border-emerald-500 ring-2 ring-emerald-200" : "border-zinc-200"}`}>
              <label className="flex cursor-pointer flex-col gap-2">
                <img src={c.apercu} alt={c.titre} className="aspect-[4/5] w-full rounded-lg bg-zinc-100 object-cover object-top" loading="lazy" referrerPolicy="no-referrer" />
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <input type="checkbox" checked={coche} onChange={() => basculer(c.id)} />
                  Garder
                </span>
              </label>
              <p className="text-xs leading-snug text-zinc-600">
                <a href={c.lien} target="_blank" rel="noreferrer" className="underline">
                  {c.titre}
                </a>
                <br />
                {c.auteur} · {c.licence} · {c.largeur} × {c.hauteur}
              </p>
            </li>
          );
        })}
      </ul>
      <div className="sticky bottom-3 flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 bg-white/95 p-3 shadow-sm">
        <button type="button" onClick={enregistrer} disabled={occupe} className="rounded-full border border-zinc-900 bg-zinc-900 px-4 py-1.5 text-xs font-semibold text-white hover:opacity-80 disabled:opacity-60">
          Enregistrer la sélection ({coches.size})
        </button>
        {coches.size > 0 && coches.size < PHOTOS_MIN ? <span className="text-xs font-semibold text-amber-700">Au moins {PHOTOS_MIN} photos par candidat.</span> : null}
        {retour ? <span className={`text-xs ${retour.ok ? "text-emerald-700" : "text-red-700"}`}>{retour.texte}</span> : null}
      </div>
    </div>
  );
}
