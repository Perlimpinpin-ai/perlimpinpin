"use client";

/* eslint-disable @next/next/no-img-element -- aperçu d'un fichier de public/. */
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cleSuivante } from "@/lib/rotation-images";

// Image de la couverture du carrousel détaillé (/test/reseaux/<id>) :
//  - le sujet de la mesure et les mots-clés retenus par le modèle, l'image
//    choisie (ou « Pas d'image », papier jaune tramé seul) ;
//  - bouton « Changer d'image » → l'image suivante parmi celles des
//    mots-clés (sinon celles du thème). L'image voulue passe dans l'adresse
//    (?image=<fichier>) : slides, légende et credits.txt sont recalculés.
// Rien n'est écrit en base : l'image retenue à la génération reste celle qui
// compte pour la rotation des carrousels suivants.
// `fichiers` : images possibles ; `actuelle` : fichier affiché (null : aucune) ;
// `credit` : ligne de crédit ; `sujet`, `motsCles` : choix du modèle.

export default function ChoixImageTheme({ fichiers, actuelle, credit, sujet = "", motsCles = [] }) {
  const router = useRouter();
  const chemin = usePathname();
  const recherche = useSearchParams();

  function changer() {
    const suivante = actuelle ? cleSuivante(fichiers, actuelle) : fichiers[0];
    if (!suivante) return;
    const params = new URLSearchParams(recherche.toString());
    params.set("image", suivante);
    router.replace(`${chemin}?${params}`, { scroll: false });
  }

  const rang = actuelle ? fichiers.indexOf(actuelle) + 1 : 0;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3 text-sm">
      {actuelle ? <img src={`/${actuelle}`} alt="" className="h-14 w-20 rounded object-cover" /> : null}
      <div className="flex flex-col gap-0.5">
        <span>
          Image de couverture : <strong>{actuelle ? `${actuelle.split("/").at(-1)}${rang > 0 ? ` (n° ${rang} sur ${fichiers.length})` : ""}` : "aucune (papier jaune tramé seul)"}</strong>
        </span>
        <span className="text-xs text-zinc-500">
          Sujet de la mesure : <strong>{sujet || "—"}</strong> · mots-clés retenus : <strong>{motsCles.length ? motsCles.join(", ") : "aucun"}</strong>
          {credit ? <span className="ml-2">· {credit}</span> : null}
        </span>
      </div>
      <button
        type="button"
        onClick={changer}
        disabled={actuelle ? fichiers.length < 2 : fichiers.length === 0}
        className="rounded-full border border-zinc-900 px-3 py-1 text-xs font-semibold hover:bg-zinc-100 disabled:opacity-50"
      >
        Changer d’image
      </button>
    </div>
  );
}
