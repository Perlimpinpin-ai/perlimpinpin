"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { estimerReelAction, genererReelAction } from "./actions";

// Bouton « Générer le Reel » / « Générer à nouveau » : confirmation avec le coût
// estimé, puis génération (30 s à 2 min). Le bouton reste désactivé pendant
// tout ce temps, et un verrou empêche un second envoi (pas de double paiement).
// À la fin, la page est rechargée (le Reel s'affiche) ou l'erreur est écrite
// en clair sous le bouton.

function dollars(montant) {
  return montant.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function BoutonGenererReel({ propositionId, brouillon = false, aDejaUnReel = false, discret = false }) {
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
      const estimation = await estimerReelAction(propositionId, brouillon);
      if (!estimation.ok) {
        setRetour({ type: "erreur", texte: estimation.erreur });
        return;
      }
      const question = estimation.aDejaUnReel ? "Générer à nouveau le Reel de cette fiche ?" : "Générer le Reel de cette fiche ?";
      const remplace = estimation.aDejaUnReel
        ? "\nL’ancien Reel sera gardé (reelPrecedent). Le nouveau changera de variantes de phrases et de question de couverture."
        : "";
      const confirme = window.confirm(`${question}\nCoût estimé ≈ ${dollars(estimation.min)} à ${dollars(estimation.max)} $.${remplace}`);
      if (!confirme) return;

      setEtat("generation");
      const resultat = await genererReelAction(propositionId, brouillon);
      if (!resultat.ok) {
        const cout = resultat.cout ? ` (coût de l’appel : ${dollars(resultat.cout)} $)` : "";
        setRetour({ type: "erreur", texte: `${resultat.erreur}${cout}` });
        return;
      }
      const details = [
        resultat.cout !== undefined ? `coût : ${dollars(resultat.cout)} $` : null,
        resultat.avertissements?.length ? `${resultat.avertissements.length} avertissement(s) à relire` : null,
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
    etat === "generation"
      ? "Génération en cours…"
      : etat === "estimation"
        ? "Calcul du coût…"
        : aDejaUnReel
          ? "Générer à nouveau"
          : "Générer le Reel";

  return (
    <span className="flex flex-col gap-1 sm:items-end">
      <button
        type="button"
        onClick={lancer}
        disabled={occupe}
        aria-busy={occupe}
        className={`rounded-full px-3 py-1 text-xs font-semibold transition-opacity disabled:cursor-wait disabled:opacity-60 ${
          discret ? "border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-100" : "border border-zinc-900 bg-zinc-900 text-white hover:opacity-80"
        }`}
      >
        {libelle}
      </button>
      {etat === "generation" ? <span className="text-xs text-zinc-500">30 s à 2 min, ne fermez pas la page.</span> : null}
      {retour ? (
        <span role="status" className={`max-w-sm text-xs ${retour.type === "ok" ? "text-emerald-700" : "text-red-700"}`}>
          {retour.texte}
        </span>
      ) : null}
    </span>
  );
}
