"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { estimerTweetLongAction, genererTweetLongAction } from "./actions";

// Bouton « Générer le tweet long » / « Régénérer » de la section 5 de
// /test/reseaux/<id> : un appel à Claude dédié (data/prompt-tweet-long.md).
// Confirmation avec le coût estimé, puis génération ; le coût réel
// s'affiche ensuite. Un verrou empêche un second envoi (pas de double
// paiement). Texte refusé : rien n'est enregistré, la raison est écrite sous
// le bouton, qui propose « Régénérer ».

function dollars(montant) {
  return montant.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 3 });
}

export default function BoutonGenererTweetLong({ propositionId, brouillon = false, aDejaUnTweetLong = false, demo = false }) {
  const router = useRouter();
  const verrou = useRef(false);
  const [etat, setEtat] = useState("repos"); // repos | estimation | generation
  const [retour, setRetour] = useState(null); // { type: "ok" | "erreur", texte }

  async function lancer() {
    if (verrou.current) return;
    verrou.current = true;
    setRetour(null);
    try {
      setEtat("estimation");
      const estimation = await estimerTweetLongAction(propositionId, brouillon);
      if (!estimation.ok) {
        setRetour({ type: "erreur", texte: estimation.erreur });
        return;
      }
      const question = estimation.aDejaUnTweetLong ? "Régénérer le tweet long ? Le nouveau remplacera l’actuel." : "Générer le tweet long ?";
      const lien = estimation.publie ? "" : "\nFiche pas encore publiée : le lien de la signature pointera vers https://perlimpinpin.ai.";
      const simule = demo ? " (simulé : aucun appel réel)" : "";
      if (!window.confirm(`${question}\nCoût estimé ≈ ${dollars(estimation.min)} à ${dollars(estimation.max)} $${simule}.${lien}`)) return;

      setEtat("generation");
      const resultat = await genererTweetLongAction(propositionId, brouillon);
      if (!resultat.ok) {
        const cout = resultat.cout ? ` (coût de l’appel : ${dollars(resultat.cout)} $)` : "";
        setRetour({ type: "erreur", texte: `${resultat.erreur}${cout}` });
        return;
      }
      const details = [
        resultat.cout !== undefined ? `coût : ${dollars(resultat.cout)} $` : null,
        resultat.avertissements?.length ? `${resultat.avertissements.length} avertissement(s) à relire` : null,
        resultat.simulation || demo ? null : resultat.sauvegarde ? "sauvegarde faite" : "sauvegarde impossible sur ce serveur",
      ].filter(Boolean);
      setRetour({ type: "ok", texte: `${resultat.message}${details.length ? ` (${details.join(", ")})` : ""}` });
      router.refresh();
    } catch (error) {
      setRetour({ type: "erreur", texte: `Erreur : ${error.message}` });
    } finally {
      setEtat("repos");
      verrou.current = false;
    }
  }

  const occupe = etat !== "repos";
  const relancer = aDejaUnTweetLong || retour?.type === "erreur";
  const libelle = etat === "generation" ? "Génération en cours…" : etat === "estimation" ? "Calcul du coût…" : relancer ? "Régénérer" : "Générer le tweet long";

  return (
    <span className="flex flex-col gap-1">
      <button
        type="button"
        onClick={lancer}
        disabled={occupe}
        aria-busy={occupe}
        className={`self-start rounded-full px-4 py-1.5 text-xs font-semibold transition-opacity disabled:cursor-wait disabled:opacity-60 ${
          relancer ? "border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-100" : "border border-zinc-900 bg-zinc-900 text-white hover:opacity-80"
        }`}
      >
        {libelle}
      </button>
      {etat === "generation" ? <span className="text-xs text-zinc-500">20 s à 1 min, ne fermez pas la page.</span> : null}
      {retour ? (
        <span role="status" className={`max-w-xl text-xs ${retour.type === "ok" ? "text-emerald-700" : "text-red-700"}`}>
          {retour.texte}
        </span>
      ) : null}
    </span>
  );
}
