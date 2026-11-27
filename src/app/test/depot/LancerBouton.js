"use client";

import { useState, useTransition } from "react";
import { lancerFileAttente } from "./actions";

// Événement écouté par RafraichissementAuto : après un lancement, la liste se
// rafraîchit même avant que la première fiche passe « en cours » (~1 min).
export const EVENEMENT_LANCEMENT = "file-attente-lancee";

const prix = (n) => `~${n.toFixed(2)} $`;

// « Lancer les étapes 2 et 3 » (slug) ou « Traiter toute la file » (toute).
// Confirmation dans la page, puis déclenchement du workflow GitHub.
// enAttente : nombre de fiches en attente (toute la file) ; max : garde-fou.
export default function LancerBouton({ slug = null, toute = false, enAttente = 1, max = 5, coutEstime = null, libelle, bloque = null }) {
  const [etape, setEtape] = useState("repos"); // repos | confirmer | lance
  const [erreur, setErreur] = useState(null);
  const [lien, setLien] = useState(null);
  const [enCours, startTransition] = useTransition();

  const nombre = toute ? Math.min(enAttente, max) : 1;

  function lancer() {
    setErreur(null);
    startTransition(async () => {
      try {
        const r = await lancerFileAttente(toute ? { toute: true } : { slug });
        if (r?.ok && !r.simulation) {
          setLien(r.lien);
          setEtape("lance");
          window.dispatchEvent(new Event(EVENEMENT_LANCEMENT));
        } else {
          setErreur(r?.message || "Erreur inattendue.");
          setLien(r?.lien ?? null);
          setEtape("repos");
        }
      } catch {
        setErreur("Envoi impossible (connexion ou serveur). Réessayez.");
        setEtape("repos");
      }
    });
  }

  if (etape === "lance") {
    return (
      <p className="text-sm font-medium text-zinc-800" aria-live="polite">
        Lancé — suivi sur GitHub{lien ? " : " : "."}
        {lien ? (
          <a href={lien} target="_blank" rel="noreferrer" className="font-semibold underline">
            voir le run
          </a>
        ) : null}
      </p>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2">
      {etape === "repos" ? (
        <button
          type="button"
          disabled={Boolean(bloque) || enCours}
          title={bloque ?? undefined}
          onClick={() => setEtape("confirmer")}
          className="rounded-full bg-yellow-300 px-4 py-1.5 text-sm font-semibold text-zinc-900 transition-colors hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {libelle}
        </button>
      ) : (
        <div className="w-full max-w-xl rounded-xl border border-yellow-200 bg-yellow-50/60 p-4 text-sm text-zinc-800" role="group" aria-label="Confirmation du lancement">
          <p className="font-semibold text-zinc-900">
            {toute ? `Lancer les étapes 2 et 3 pour ${nombre} fiche${nombre > 1 ? "s" : ""} ?` : `Lancer les étapes 2 et 3 pour « ${slug} » ?`}
          </p>
          {toute && enAttente > max ? (
            <p className="mt-1">
              La file compte {enAttente} fiches en attente : seules les {max} plus anciennes seront traitées. Relancez ensuite pour les suivantes.
            </p>
          ) : null}
          <p className="mt-1">
            {coutEstime != null
              ? `Coût estimé : ${prix(coutEstime)} par fiche${nombre > 1 ? `, soit ${prix(coutEstime * nombre)}` : ""} (moyenne des 20 dernières analyses). Appels payants.`
              : "Coût estimé : inconnu (aucune analyse récente avec un coût). Appels payants."}
          </p>
          <p className="mt-1 text-zinc-600">Le traitement tourne sur GitHub et prend plusieurs minutes par fiche ; le brouillon arrive sur /test.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={enCours}
              onClick={lancer}
              className="rounded-full bg-yellow-300 px-4 py-1.5 text-sm font-semibold text-zinc-900 transition-colors hover:bg-yellow-400 disabled:cursor-wait disabled:opacity-60"
            >
              {enCours ? "Lancement…" : "Confirmer le lancement"}
            </button>
            <button
              type="button"
              disabled={enCours}
              onClick={() => setEtape("repos")}
              className="rounded-full border border-zinc-300 bg-white px-4 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-60"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
      {erreur ? (
        <p className="text-sm text-red-700" aria-live="polite">
          {erreur}
          {lien ? (
            <>
              {" "}
              <a href={lien} target="_blank" rel="noreferrer" className="underline">
                Voir sur GitHub
              </a>
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
