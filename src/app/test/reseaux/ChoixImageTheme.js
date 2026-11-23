"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cleSuivante } from "@/lib/rotation-images";

// Image de thème sur la couverture du carrousel détaillé (/test/reseaux/<id>) :
// bouton « Changer d'image » → l'image suivante du thème (ou du dossier de
// secours). L'image voulue passe dans l'adresse (?image=<fichier>) : slides,
// légende et credits.txt sont recalculés par le serveur pour cette image.
// Rien n'est écrit en base : l'image retenue à la génération reste celle qui
// compte pour la rotation des carrousels suivants.
// `fichiers` : images possibles ; `actuelle` : fichier affiché ; `credit` :
// ligne de crédit de l'image affichée.

export default function ChoixImageTheme({ fichiers, actuelle, credit }) {
  const router = useRouter();
  const chemin = usePathname();
  const recherche = useSearchParams();

  function changer() {
    const suivante = cleSuivante(fichiers, actuelle);
    if (!suivante) return;
    const params = new URLSearchParams(recherche.toString());
    params.set("image", suivante);
    router.replace(`${chemin}?${params}`, { scroll: false });
  }

  if (!fichiers?.length) return null;
  const rang = fichiers.indexOf(actuelle) + 1;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3 text-sm">
      <span>
        Image de thème : <strong>{rang > 0 ? `n° ${rang}` : "aucune"}</strong> sur {fichiers.length}
        {credit ? <span className="ml-2 text-xs text-zinc-500">{credit}</span> : null}
      </span>
      <button
        type="button"
        onClick={changer}
        disabled={fichiers.length < 2}
        className="rounded-full border border-zinc-900 px-3 py-1 text-xs font-semibold hover:bg-zinc-100 disabled:opacity-50"
      >
        Changer d’image
      </button>
    </div>
  );
}
