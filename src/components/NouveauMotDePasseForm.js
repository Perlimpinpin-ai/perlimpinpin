"use client";

import { useActionState, useEffect } from "react";

// Formulaire « Nouveau mot de passe » (lien reçu par e-mail), commun à
// /relectures et /live. Le jeton du lien est renvoyé dans un champ caché.
// minLength vient de la page serveur (live-password importe bcrypt : pas côté client).
export default function NouveauMotDePasseForm({
  action,
  jeton,
  minLength,
  idPrefix,
  lienNouvelleDemande,
  labelClass,
  inputClass,
  buttonClass,
}) {
  const [state, formAction, pending] = useActionState(action, null);

  // Mot de passe changé : la session est ouverte, on charge l'espace par une vraie navigation.
  useEffect(() => {
    if (state?.ok) window.location.assign(state.redirectTo);
  }, [state]);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="jeton" value={jeton} />
      <div>
        <label htmlFor={`${idPrefix}-password`} className={labelClass}>
          Nouveau mot de passe
        </label>
        <input
          id={`${idPrefix}-password`}
          name="password"
          type="password"
          required
          autoFocus
          minLength={minLength}
          autoComplete="new-password"
          aria-describedby={`${idPrefix}-password-aide`}
          className={inputClass}
        />
        <p id={`${idPrefix}-password-aide`} className="mt-1.5 text-xs text-zinc-500">
          Au moins {minLength} caractères.
        </p>
      </div>
      <div>
        <label htmlFor={`${idPrefix}-confirmation`} className={labelClass}>
          Confirmer le mot de passe
        </label>
        <input
          id={`${idPrefix}-confirmation`}
          name="confirmation"
          type="password"
          required
          autoComplete="new-password"
          className={inputClass}
        />
      </div>

      {state?.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
          {state.lienInvalide && (
            <>
              {" "}
              <a href={lienNouvelleDemande} className="font-medium underline underline-offset-2">
                Nouvelle demande
              </a>
            </>
          )}
        </p>
      )}

      <button type="submit" disabled={pending || state?.ok} className={buttonClass}>
        {pending ? "Enregistrement…" : "Enregistrer le mot de passe"}
      </button>
    </form>
  );
}
