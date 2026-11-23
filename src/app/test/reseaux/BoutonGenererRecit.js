"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { estimerRecitAction, genererRecitAction } from "./actions";

// Bouton « Générer le carrousel détaillé » / « Générer à nouveau » de /test/reseaux/<id> :
// un seul appel à Claude pour le carrousel détaillé (8 slides) et le tweet
// long. Confirmation avec le coût estimé, puis génération (30 s à 2 min) ;
// le coût réel s'affiche ensuite. Un verrou empêche un second envoi (pas de
// double paiement). À la fin, la page est rechargée ou l'erreur est écrite
// en clair sous le bouton.

function dollars(montant) {
  return montant.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 3 });
}

export default function BoutonGenererRecit({ propositionId, brouillon = false, aDejaUnRecit = false, demo = false }) {
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
      const estimation = await estimerRecitAction(propositionId, brouillon);
      if (!estimation.ok) {
        setRetour({ type: "erreur", texte: estimation.erreur });
        return;
      }
      const question = estimation.aDejaUnRecit
        ? "Générer à nouveau le carrousel détaillé (8 slides) et le tweet long ?"
        : "Générer le carrousel détaillé (8 slides) et le tweet long ?";
      const remplace = estimation.aDejaUnRecit ? "\nL’ancienne version sera gardée comme version précédente." : "";
      const simule = demo ? " (simulé : aucun appel réel)" : "";
      if (!window.confirm(`${question}\nCoût estimé ≈ ${dollars(estimation.min)} à ${dollars(estimation.max)} $${simule}.${remplace}`)) return;

      setEtat("generation");
      const resultat = await genererRecitAction(propositionId, brouillon);
      if (!resultat.ok) {
        const cout = resultat.cout ? ` (coût de l’appel : ${dollars(resultat.cout)} $)` : "";
        setRetour({ type: "erreur", texte: `${resultat.erreur}${cout}` });
        return;
      }
      const details = [
        resultat.cout !== undefined ? `coût : ${dollars(resultat.cout)} $` : null,
        resultat.avertissements?.length ? `${resultat.avertissements.length} avertissement(s) à relire` : null,
        resultat.simulation ? null : resultat.sauvegarde ? "sauvegarde faite" : "sauvegarde impossible sur ce serveur",
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
  const libelle =
    etat === "generation" ? "Génération en cours…" : etat === "estimation" ? "Calcul du coût…" : aDejaUnRecit ? "Générer à nouveau" : "Générer le carrousel détaillé";

  return (
    <span className="flex flex-col gap-1">
      <button
        type="button"
        onClick={lancer}
        disabled={occupe}
        aria-busy={occupe}
        className={`self-start rounded-full px-4 py-1.5 text-xs font-semibold transition-opacity disabled:cursor-wait disabled:opacity-60 ${
          aDejaUnRecit ? "border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-100" : "border border-zinc-900 bg-zinc-900 text-white hover:opacity-80"
        }`}
      >
        {libelle}
      </button>
      {etat === "generation" ? <span className="text-xs text-zinc-500">30 s à 2 min, ne fermez pas la page.</span> : null}
      {retour ? (
        <span role="status" className={`max-w-xl text-xs ${retour.type === "ok" ? "text-emerald-700" : "text-red-700"}`}>
          {retour.texte}
        </span>
      ) : null}
    </span>
  );
}
