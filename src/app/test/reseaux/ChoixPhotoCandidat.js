"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CLE_DERNIERE_PHOTO, photoSuivante } from "@/lib/photos-candidats";

// Photo du candidat sur la couverture du carrousel détaillé (/test/reseaux/<id>) :
//  - au chargement, si le tirage retombe sur la photo du carrousel précédent
//    de ce candidat (mémorisée dans ce navigateur au téléchargement de
//    l'archive), une autre photo est prise ;
//  - bouton « Changer de photo » : la suivante, en évitant celle du carrousel
//    précédent.
// La photo voulue passe dans l'adresse (?photo=<n>) : slides, légende et
// credits.txt sont recalculés par le serveur pour cette photo.
// `numeros` : photos du candidat ; `actuelle` : numéro affiché ; `cle` : slug.

function lireDernierePhoto(cle) {
  try {
    return window.localStorage.getItem(CLE_DERNIERE_PHOTO + cle);
  } catch {
    return null;
  }
}

export default function ChoixPhotoCandidat({ cle, numeros, actuelle, credit }) {
  const router = useRouter();
  const chemin = usePathname();
  const recherche = useSearchParams();

  function aller(n) {
    const params = new URLSearchParams(recherche.toString());
    params.set("photo", String(n));
    router.replace(`${chemin}?${params}`, { scroll: false });
  }

  useEffect(() => {
    if (recherche.get("photo") || numeros.length < 2) return;
    const derniere = lireDernierePhoto(cle);
    if (derniere && Number(derniere) === Number(actuelle)) aller(photoSuivante(numeros, actuelle, derniere));
    // Une seule vérification au chargement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!numeros.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3 text-sm">
      <span>
        Photo du candidat : <strong>n° {actuelle}</strong> sur {numeros.length}
        {credit ? <span className="ml-2 text-xs text-zinc-500">{credit}</span> : null}
      </span>
      <button
        type="button"
        onClick={() => aller(photoSuivante(numeros, actuelle, lireDernierePhoto(cle)))}
        disabled={numeros.length < 2}
        className="rounded-full border border-zinc-900 px-3 py-1 text-xs font-semibold hover:bg-zinc-100 disabled:opacity-50"
      >
        Changer de photo
      </button>
    </div>
  );
}
