"use client";

import { useActionState } from "react";

// Formulaire « Mot de passe oublié » commun à /relectures et /live : l'action
// serveur et les classes de style viennent de la page.
// Après envoi, le message est le même qu'un compte existe ou non.
export default function MotDePasseOublieForm({ action, idPrefix, labelClass, inputClass, buttonClass }) {
  const [state, formAction, pending] = useActionState(action, null);

  if (state?.ok) {
    return (
      <div role="status" className="text-[15px] leading-relaxed text-zinc-700">
        <p className="font-medium text-zinc-900">Vérifiez votre boîte mail.</p>
        <p className="mt-2">
          Si un compte correspond à <strong className="font-medium text-zinc-900">{state.email}</strong>, vous allez
          recevoir un e-mail avec un lien pour choisir un nouveau mot de passe. Il est valable 1 heure.
        </p>
        <p className="mt-2 text-sm text-zinc-500">
          Rien reçu d&apos;ici quelques minutes ? Regardez dans les courriers indésirables, ou vérifiez l&apos;adresse
          et recommencez.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div>
        <label htmlFor={`${idPrefix}-email`} className={labelClass}>
          Adresse e-mail
        </label>
        <input
          id={`${idPrefix}-email`}
          name="email"
          type="email"
          required
          autoFocus
          defaultValue={state?.email ?? ""}
          autoComplete="username"
          className={inputClass}
        />
      </div>

      {state?.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Envoi…" : "Recevoir un lien"}
      </button>
    </form>
  );
}
