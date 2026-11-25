"use client";

import { useActionState, useState } from "react";
import { deverrouiller, verrouiller } from "./actions";

// Barre du « mode édition » de /test. Le serveur décide de l'afficher (seulement si
// le code d'édition est configuré) et dit si la personne est déjà déverrouillée.
// Ici on ne fait que l'interface : le vrai contrôle est dans les actions serveur.
export default function EditorBar({ editeur }) {
  const [ouvert, setOuvert] = useState(false);
  const [etat, formAction, enCours] = useActionState(deverrouiller, null);

  if (editeur) {
    return (
      <form action={verrouiller} className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">
          {/* Cadenas ouvert */}
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="4" y="11" width="16" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 7.8-1.2" />
          </svg>
          Mode édition
        </span>
        <button
          type="submit"
          className="text-xs font-medium text-zinc-500 underline underline-offset-2 transition-colors hover:text-zinc-800"
        >
          Se verrouiller
        </button>
      </form>
    );
  }

  if (!ouvert) {
    return (
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="text-xs font-medium underline underline-offset-2 opacity-70 transition-opacity hover:opacity-100"
      >
        Mode édition
      </button>
    );
  }

  return (
    <form
      action={formAction}
      className="flex flex-wrap items-center justify-end gap-2"
    >
      <label htmlFor="test-edit-code" className="sr-only">
        Code d&rsquo;édition
      </label>
      <input
        id="test-edit-code"
        name="code"
        type="password"
        required
        autoFocus
        autoComplete="off"
        placeholder="Code d'édition"
        className="w-48 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
      />
      <button
        type="submit"
        disabled={enCours}
        className="rounded-full bg-zinc-900 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {enCours ? "Vérification…" : "Déverrouiller"}
      </button>
      {etat?.ok === false ? (
        <p role="alert" className="text-xs font-semibold text-red-700">
          {etat.message}
        </p>
      ) : null}
    </form>
  );
}
