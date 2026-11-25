"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { login } from "./actions";

export default function LoginForm({ next = "/live" }) {
  const [state, formAction, pending] = useActionState(login, null);

  // Connexion réussie : le cookie est posé, on charge /live par une vraie
  // navigation de page (le proxy voit alors le cookie sur une requête normale).
  useEffect(() => {
    if (state?.ok) window.location.assign(state.redirectTo ?? "/live");
  }, [state]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <div>
        <label htmlFor="live-email" className="text-sm font-medium text-zinc-700">
          Adresse e-mail
        </label>
        <input
          id="live-email"
          name="email"
          type="email"
          required
          autoFocus
          defaultValue={state?.email ?? ""}
          autoComplete="username"
          className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
      </div>
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor="live-password" className="text-sm font-medium text-zinc-700">
            Mot de passe
          </label>
          <Link
            href="/live/login/mot-de-passe-oublie"
            className="text-[13px] text-zinc-500 underline decoration-zinc-300 underline-offset-4 hover:text-zinc-900 hover:decoration-zinc-900"
          >
            Mot de passe oublié ?
          </Link>
        </div>
        <input
          id="live-password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
      </div>

      {state?.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || state?.ok}
        className="mt-1 rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending ? "Connexion…" : "Se connecter"}
      </button>
    </form>
  );
}
