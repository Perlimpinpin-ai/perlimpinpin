"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { changerPhotoAction } from "./actions";

// Photo du candidat sur la couverture du carrousel détaillé (/test/reseaux/<id>),
// affichée sous l'aperçu : numéro et crédit de la photo tirée. Le tirage se
// fait côté serveur (à la génération, parmi les photos préparées non
// écartées, hors de celle du carrousel précédent) et la photo est mémorisée
// dans le carrousel. « Changer de photo » en tire une autre au hasard, côté
// serveur, et la mémorise à son tour : rien n'est gardé dans le navigateur.
// `nombre` : photos du candidat dans le tirage ; `actuelle` : numéro affiché.
export default function ChoixPhotoCandidat({ propositionId, brouillon, nombre, actuelle, credit }) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState(null);

  function changer() {
    setErreur(null);
    demarrer(async () => {
      const r = await changerPhotoAction(propositionId, brouillon);
      if (!r?.ok) setErreur(r?.erreur ?? "Changement impossible.");
      else router.refresh();
    });
  }

  if (!nombre) {
    return <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Aucune photo préparée (non écartée) pour ce candidat : silhouette grise sur la couverture.</p>;
  }
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3 text-sm">
      <span>
        Photo du candidat : <strong>n° {actuelle}</strong> <span className="text-zinc-500">(tirée parmi {nombre})</span>
        {credit ? <span className="ml-2 text-xs text-zinc-600">{credit}</span> : null}
      </span>
      <button
        type="button"
        onClick={changer}
        disabled={nombre < 2 || enCours}
        className="rounded-full border border-zinc-900 px-3 py-1 text-xs font-semibold hover:bg-zinc-100 disabled:opacity-50"
      >
        {enCours ? "Tirage…" : "Changer de photo"}
      </button>
      {erreur ? <span className="text-xs text-red-700">{erreur}</span> : null}
    </div>
  );
}
