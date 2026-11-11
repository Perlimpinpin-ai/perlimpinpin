"use client";

import { useEffect, useState } from "react";
import { liensAdhesion, retourCourant } from "@/lib/brouillon-club";
import { moiClub } from "@/lib/moi-club";
import { LienVersExpert } from "@/components/VueAnalyseProvider";

// Encadré jaune clair « Cette analyse est ouverte à la critique » d'une fiche
// publiée (Club ouvert), en haut de la vue experte et, s'il y en a une, de la
// vue basique (avec un lien qui bascule vers la vue experte, seule annotable).
//   - Visiteur : « Se connecter » (discret) et « Rejoindre le Club » (jaune).
//     Le retour se fait sur cette fiche, dans la vue affichée au moment du clic.
//   - Adhérent connecté : « Merci de faire partie du Club ! ».
// Les boutons n'apparaissent qu'une fois la session vérifiée (rien ne change
// sous les yeux). Absent du PDF (print:hidden).

export const ID_ENCART_EXPERT = "encart-critique";

export default function EncartAnalyseOuverte({ retour, vue = "expert" }) {
  const [membre, setMembre] = useState(null); // null = pas encore vérifié

  useEffect(() => {
    let annule = false;
    moiClub().then((moi) => !annule && setMembre(Boolean(moi)));
    return () => {
      annule = true;
    };
  }, []);

  // Adresse calculée au clic : la vue a pu changer depuis l'affichage.
  const versLien = (type) => (event) => {
    event.currentTarget.href = liensAdhesion(retourCourant(retour))[type];
  };

  return (
    <aside
      id={vue === "expert" ? ID_ENCART_EXPERT : undefined}
      className="mb-4 scroll-mt-24 rounded-2xl border border-yellow-200 bg-yellow-50/70 px-4 py-3 text-sm leading-6 text-zinc-700 print:hidden"
    >
      <p className="font-semibold text-zinc-900">Cette analyse est ouverte à la critique.</p>
      <p className="mt-1">
        Un chiffre vous semble faux, une source manque, un biais ou une erreur a été repéré ? Sélectionnez un passage
        pour l’annoter et l’envoyer au comité éditorial.
      </p>
      {vue === "basique" ? (
        <LienVersExpert
          cible={ID_ENCART_EXPERT}
          className="mt-2 font-semibold text-zinc-900 underline decoration-yellow-400 decoration-2 underline-offset-4 hover:decoration-zinc-900"
        >
          Annoter en vue experte
        </LienVersExpert>
      ) : null}
      {membre === true ? <p className="mt-3 font-semibold text-zinc-900">Merci de faire partie du Club !</p> : null}
      {membre === false ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <a
            href={liensAdhesion(retour).connexion}
            onClick={versLien("connexion")}
            className="rounded-full px-3 py-1.5 text-sm font-medium text-zinc-600 underline decoration-zinc-300 underline-offset-4 hover:text-zinc-900"
          >
            Se connecter
          </a>
          <a
            href={liensAdhesion(retour).adherer}
            onClick={versLien("adherer")}
            className="inline-flex rounded-full bg-yellow-300 px-4 py-1.5 text-sm font-semibold text-zinc-900 transition-colors hover:bg-yellow-400"
          >
            Rejoindre le Club
          </a>
        </div>
      ) : null}
    </aside>
  );
}
