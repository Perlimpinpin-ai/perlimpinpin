"use client";

import { useActionState, useEffect } from "react";
import { inscription } from "../actions";
import { buttonClass, inputClass, labelClass } from "../ui";

// minLength vient de la page serveur (live-password importe bcrypt : pas côté client).
export default function InscriptionForm({ minLength }) {
  const [state, formAction, pending] = useActionState(inscription, null);

  // Compte activé : le cookie est posé, on charge /relectures par une vraie navigation.
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
        <label htmlFor="relecture-password" className={labelClass}>
          Mot de passe
        </label>
        <input
          id="relecture-password"
          name="password"
          type="password"
          required
          minLength={minLength}
          autoComplete="new-password"
          aria-describedby="relecture-password-aide"
          className={inputClass}
        />
        <p id="relecture-password-aide" className="mt-1.5 text-xs text-zinc-500">
          Au moins {minLength} caractères.
        </p>
      </div>
      <div>
        <label htmlFor="relecture-confirmation" className={labelClass}>
          Confirmer le mot de passe
        </label>
        <input
          id="relecture-confirmation"
          name="confirmation"
          type="password"
          required
          autoComplete="new-password"
          className={inputClass}
        />
      </div>

      {state?.refus ? (
        <p role="alert" className="text-sm text-red-600">
          Cette adresse ne peut pas créer de compte. Si vous êtes adhérent, contactez{" "}
          <a href="mailto:perlimpinpin.admin@gmail.com" className="underline underline-offset-2">
            perlimpinpin.admin@gmail.com
          </a>
          .
        </p>
      ) : (
        state?.error && (
          <p role="alert" className="text-sm text-red-600">
            {state.error}
          </p>
        )
      )}

      <button type="submit" disabled={pending || state?.ok} className={buttonClass}>
        {pending ? "Création…" : "Créer mon mot de passe"}
      </button>
    </form>
  );
}
