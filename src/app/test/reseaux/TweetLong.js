"use client";

import { useState } from "react";
import { lienIntentionX, longueurX } from "@/lib/reseaux";
import { URL_INTENTION_MAX } from "@/lib/recit";
import { TWEET_LONG_MAX, TWEET_LONG_MIN } from "@/lib/tweet-long";

// Tweet long de la section 5 de /test/reseaux/<id> : zone modifiable,
// compteur (caractères comptés comme X), « Copier » et « Ouvrir dans X ». Le
// compte est abonné : un tweet long passe en un seul message. Au-delà de
// URL_INTENTION_MAX caractères d'URL, le lien peut être tronqué : il reste
// actif, mais la page conseille « Copier ». Les modifications à la main ne
// sont jamais écrites en base.
export default function TweetLong({ texteInitial, libelle = "Tweet long" }) {
  const [texte, setTexte] = useState(texteInitial);
  const [copie, setCopie] = useState(null);
  const longueur = longueurX(texte);
  const horsCible = longueur < TWEET_LONG_MIN || longueur > TWEET_LONG_MAX;
  const lien = lienIntentionX(texte);
  const lienTropLong = lien.length > URL_INTENTION_MAX;
  const modifie = texte !== texteInitial;

  async function copier() {
    try {
      await navigator.clipboard.writeText(texte);
      setCopie("Copié");
    } catch {
      setCopie("Copie impossible : sélectionnez le texte à la main");
    }
    setTimeout(() => setCopie(null), 2500);
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
        <span className="font-semibold uppercase tracking-wide">
          {libelle}
          {modifie ? <span className="ml-2 normal-case text-amber-700">modifié (non enregistré)</span> : null}
        </span>
        <span aria-live="polite" className={horsCible ? "font-semibold text-amber-700" : ""}>
          {longueur.toLocaleString("fr-FR")} caractères (cible {TWEET_LONG_MIN.toLocaleString("fr-FR")} à {TWEET_LONG_MAX.toLocaleString("fr-FR")})
        </span>
      </div>
      <textarea
        value={texte}
        onChange={(event) => setTexte(event.target.value)}
        rows={Math.max(12, texte.split("\n").length + 2)}
        aria-label="Texte du tweet long"
        className="w-full resize-y rounded-lg border border-zinc-200 p-2 text-sm leading-relaxed text-zinc-900 focus:border-zinc-400 focus:outline-none"
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={copier}
          className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-zinc-800"
        >
          Copier
        </button>
        <a
          href={lien}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full border border-zinc-300 px-3 py-1 text-xs font-semibold text-zinc-800 transition-colors hover:bg-zinc-100"
        >
          Ouvrir dans X
        </a>
        {modifie ? (
          <button
            type="button"
            onClick={() => setTexte(texteInitial)}
            className="text-xs font-semibold text-zinc-600 underline underline-offset-2 hover:text-zinc-900"
          >
            Revenir au texte proposé
          </button>
        ) : null}
        {copie ? (
          <span role="status" className="text-xs text-zinc-600">
            {copie}
          </span>
        ) : null}
      </div>
      {lienTropLong ? (
        <p className="text-xs text-amber-800">
          Texte long : le lien « Ouvrir dans X » risque d’être coupé. Préférez « Copier », puis collez dans X.
        </p>
      ) : null}
    </div>
  );
}
