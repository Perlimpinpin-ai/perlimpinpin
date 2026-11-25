"use client";

import { useState, useTransition } from "react";
import { publierBrouillon, reessayerFusion } from "./actions";

// Bouton « Publier sur le site » avec confirmation dans la page (pas de
// window.confirm). Affiché seulement aux personnes déverrouillées, mais c'est
// l'action serveur qui vérifie vraiment l'accès. En cas de succès, l'action
// redirige vers la page de partage des publications X (/test/reseaux/[id]), qui
// confirme la publication ; sinon elle renvoie un message à afficher ici.
//
// Fiche issue d'une révision (`revision`) : la publication fusionne aussi la PR
// « Révision <slug> ». Si la fiche est publiée mais que la fusion échoue,
// l'action renvoie un avertissement (orange) et on propose « Réessayer la fusion ».
//
// Brouillon sans version basique (`sansVersionBasique`, 24/10/2026, fiche Le
// Pen « agences et intercos » publiée sans elle) : avertissement permanent et
// rappel dans la confirmation, avec le lien vers le workflow de rattrapage.
// La publication reste possible : c'est un avertissement, pas un blocage.
const DEPOT_PUBLIC =
  process.env.NEXT_PUBLIC_VERCEL_GIT_REPO_OWNER && process.env.NEXT_PUBLIC_VERCEL_GIT_REPO_SLUG
    ? `${process.env.NEXT_PUBLIC_VERCEL_GIT_REPO_OWNER}/${process.env.NEXT_PUBLIC_VERCEL_GIT_REPO_SLUG}`
    : "Perlimpinpin-ai/perlimpinpin";
const LIEN_RATTRAPAGE = `https://github.com/${DEPOT_PUBLIC}/actions/workflows/version-basique.yml`;

export default function PublishBox({ analyseId, candidatNom, simulation, revision = false, sansVersionBasique = false }) {
  const [confirmation, setConfirmation] = useState(false);
  const [message, setMessage] = useState(null);
  const [enCours, startTransition] = useTransition();

  function publier() {
    setMessage(null);
    startTransition(async () => {
      const resultat = await publierBrouillon(analyseId);
      // Si la publication a réussi, on n'arrive jamais ici : la page a été redirigée.
      if (resultat) setMessage(resultat);
      setConfirmation(false);
    });
  }

  function reessayer() {
    startTransition(async () => {
      const resultat = await reessayerFusion(analyseId);
      // Fusion réussie : la page a été redirigée vers la fiche publique. Un échec
      // garde l'avertissement pour pouvoir réessayer encore.
      if (resultat) setMessage(resultat.ok ? resultat : { ...resultat, avertissement: true });
    });
  }

  // Fiche publiée, réponses non publiées : plus de bouton « Publier ».
  const publieeSansFusion = Boolean(message?.avertissement);
  const texte = message?.ok && typeof message.avertissement === "string" ? message.avertissement : message?.message;
  const lienPR = message?.lienPR || message?.revision?.lienPR;

  return (
    <div className="flex flex-col gap-2">
      {publieeSansFusion ? null : !confirmation ? (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setMessage(null);
              setConfirmation(true);
            }}
            disabled={enCours}
            className="rounded-full bg-zinc-900 px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Publier sur le site
          </button>
          {simulation ? (
            <span className="text-xs font-semibold">
              Mode simulation : rien ne sera écrit en base.
            </span>
          ) : null}
        </div>
      ) : (
        <div
          role="alertdialog"
          aria-label="Confirmer la publication"
          className="flex flex-col gap-3 rounded-xl border border-amber-400 bg-white p-4 text-zinc-900"
        >
          <p className="text-sm font-semibold">Publier cette analyse ?</p>
          <p className="text-sm">
            Elle sera visible par tout le monde sur le site public et comptera
            dans la moyenne de {candidatNom}.
            {revision
              ? " Les réponses aux commentaires du Club seront aussi publiées sur /relectures."
              : ""}
          </p>
          {sansVersionBasique ? (
            <p className="text-sm font-semibold text-orange-800">
              Attention : cette fiche n&rsquo;a pas de version basique. Elle restera rattrapable après publication, mais
              il vaut mieux la rattraper avant.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={publier}
              disabled={enCours}
              className="rounded-full bg-zinc-900 px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {enCours ? "Envoi…" : "Confirmer la publication"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmation(false)}
              disabled={enCours}
              className="rounded-full border border-zinc-300 px-4 py-1.5 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {sansVersionBasique && !publieeSansFusion ? (
        <p className="text-sm font-semibold text-orange-800">
          Pas de version basique : la fiche serait publiée sans la bascule basique / expert. Avant de publier, lance{" "}
          <a href={LIEN_RATTRAPAGE} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
            le rattrapage « Version basique manquante »
          </a>{" "}
          avec le numéro {analyseId}, puis recharge cette page.
        </p>
      ) : null}

      {message ? (
        <div role="status" className="flex flex-col gap-2">
          <p
            className={`text-sm font-semibold ${
              publieeSansFusion ? "text-orange-700" : message.ok ? "text-emerald-900" : "text-red-800"
            }`}
          >
            {texte}
          </p>
          {message.lienReseaux ? (
            <a href={message.lienReseaux} className="text-sm font-semibold underline underline-offset-2">
              Préparer les publications X
            </a>
          ) : null}
          {publieeSansFusion || lienPR ? (
            <div className="flex flex-wrap items-center gap-3">
              {publieeSansFusion ? (
                <button
                  type="button"
                  onClick={reessayer}
                  disabled={enCours}
                  className="rounded-full bg-orange-700 px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-orange-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {enCours ? "Fusion…" : "Réessayer la fusion"}
                </button>
              ) : null}
              {lienPR ? (
                <a
                  href={lienPR}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm underline underline-offset-2"
                >
                  Voir la PR
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
