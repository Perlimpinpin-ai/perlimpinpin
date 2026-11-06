"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { connexion } from "../actions";
import { buttonClass, inputClass, labelClass } from "../ui";

export default function ConnexionForm() {
  const [state, formAction, pending] = useActionState(connexion, null);

  // Connexion réussie : le cookie est posé, on charge /relectures (fichier
  // statique) par une vraie navigation de page, que le proxy laisse passer.
  useEffect(() => {
    if (state?.ok) window.location.assign(state.redirectTo ?? "/relectures");
  }, [state]);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div>
        <label htmlFor="relecture-email" className={labelClass}>
          Adresse e-mail
        </label>
        <input
          id="relecture-email"
          name="email"
          type="email"
          required
          autoFocus
          defaultValue={state?.email ?? ""}
          autoComplete="username"
          className={inputClass}
        />
      </div>
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor="relecture-password" className={labelClass}>
            Mot de passe
          </label>
          <Link
            href="/relectures/mot-de-passe-oublie"
            className="text-[13px] text-zinc-500 underline decoration-zinc-300 underline-offset-4 hover:text-zinc-900 hover:decoration-zinc-900"
          >
            Mot de passe oublié ?
          </Link>
        </div>
        <input
          id="relecture-password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className={inputClass}
        />
      </div>

      {state?.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending || state?.ok} className={buttonClass}>
        {pending ? "Connexion…" : "Se connecter"}
      </button>
    </form>
  );
}
