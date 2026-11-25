"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { deposerEquipeAction, estimerEquipeAction } from "./actions";

// Mode B « Script et voix off de l'équipe » : le script (texte collé ou
// fichier .txt) et minutage.json (produit en local par scripts/caler-voix.py).
// Claude découpe le texte sans le réécrire ; le contrôle mot pour mot est
// bloquant (l'écart est donné en clair sous le bouton). Les fichiers sont lus
// dans le navigateur et envoyés en texte.

function dollars(m) {
  return m.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function DepotEquipe({ propositionId, brouillon = false }) {
  const router = useRouter();
  const verrou = useRef(false);
  const [script, setScript] = useState("");
  const [minutage, setMinutage] = useState({ nom: "", texte: "" });
  const [etat, setEtat] = useState("repos");
  const [retour, setRetour] = useState(null);

  async function lireFichier(evenement, cible) {
    const fichier = evenement.target.files?.[0];
    if (!fichier) return;
    const texte = await fichier.text();
    if (cible === "script") setScript(texte);
    else setMinutage({ nom: fichier.name, texte });
  }

  async function envoyer() {
    if (verrou.current) return;
    verrou.current = true;
    setRetour(null);
    const fichiers = { script, minutage: minutage.texte || null };
    try {
      setEtat("estimation");
      const estimation = await estimerEquipeAction(propositionId, brouillon, fichiers);
      if (!estimation.ok) return setRetour({ type: "erreur", texte: estimation.erreur });
      const question = `Découper le script de l’équipe en storyboard (mode B) ?\nCoût estimé ≈ ${dollars(estimation.min)} à ${dollars(estimation.max)} $.${estimation.aDejaUnReel ? "\nL’ancien Reel sera gardé (reelPrecedent)." : ""}`;
      if (!window.confirm(question)) return;
      setEtat("generation");
      const resultat = await deposerEquipeAction(propositionId, brouillon, fichiers);
      if (!resultat.ok) return setRetour({ type: "erreur", texte: `${resultat.erreur}${resultat.cout ? ` (coût : ${dollars(resultat.cout)} $)` : ""}` });
      setRetour({ type: "ok", texte: resultat.message, lien: resultat.lien });
      if (resultat.lien) router.push(`/test/reels/${propositionId}${resultat.lien}${brouillon ? "&brouillon=1" : ""}`);
      else router.refresh();
    } catch (e) {
      setRetour({ type: "erreur", texte: `Erreur : ${e.message}` });
    } finally {
      setEtat("repos");
      verrou.current = false;
    }
  }

  const occupe = etat !== "repos";
  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-semibold">Script de la voix off</span>
        <textarea
          value={script}
          onChange={(e) => setScript(e.target.value)}
          rows={6}
          placeholder="Collez ici le texte exact de la voix off…"
          className="rounded-lg border border-zinc-300 bg-white p-2 font-sans text-sm"
        />
      </label>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-zinc-600">ou un fichier .txt</span>
          <input type="file" accept=".txt,text/plain" onChange={(e) => lireFichier(e, "script")} className="text-xs" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-zinc-600">minutage.json (scripts/caler-voix.py)</span>
          <input type="file" accept=".json,application/json" onChange={(e) => lireFichier(e, "minutage")} className="text-xs" />
          {minutage.nom ? <span className="text-xs text-zinc-500">{minutage.nom} chargé</span> : <span className="text-xs text-zinc-400">Sans lui : durées estimées à 3 mots par seconde.</span>}
        </label>
      </div>
      <button
        type="button"
        onClick={envoyer}
        disabled={occupe || !script.trim()}
        className="self-start rounded-full border border-zinc-900 bg-zinc-900 px-4 py-1.5 text-xs font-semibold text-white hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {etat === "generation" ? "Découpage en cours…" : etat === "estimation" ? "Calcul du coût…" : "Découper en storyboard"}
      </button>
      {retour ? (
        <p role="status" className={`max-w-xl text-xs ${retour.type === "ok" ? "text-emerald-700" : "text-red-700"}`}>
          {retour.texte}
        </p>
      ) : null}
    </div>
  );
}
