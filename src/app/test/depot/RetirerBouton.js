"use client";

import { useState, useTransition } from "react";
import { retirerFiche } from "./actions";

// « Retirer » : la fiche passe en « ignorée » (rien n'est supprimé).
export default function RetirerBouton({ id, slug }) {
  const [message, setMessage] = useState(null);
  const [enCours, startTransition] = useTransition();

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={enCours}
        onClick={() => {
          if (!window.confirm(`Retirer « ${slug} » de la file ? Elle ne sera pas traitée (rien n'est supprimé).`)) return;
          startTransition(async () => {
            const r = await retirerFiche(id);
            setMessage(r?.ok && !r.simulation ? null : r?.message || "Erreur inattendue.");
          });
        }}
        className="text-xs font-medium text-zinc-500 underline underline-offset-2 transition-colors hover:text-red-700 disabled:opacity-50"
      >
        {enCours ? "Retrait…" : "Retirer"}
      </button>
      {message ? <span className="text-xs text-red-700">{message}</span> : null}
    </span>
  );
}
