"use client";

import { useEffect, useState } from "react";
import { liensAdhesion } from "@/lib/brouillon-club";
import { moiClub } from "@/lib/moi-club";

// Encadré jaune clair en haut de la vue experte d'une fiche publiée (Club
// ouvert) : invite à annoter. Visiteur : lien « Rejoindre le Club » (retour
// sur la fiche après l'adhésion). Adhérent connecté : « Merci de faire partie
// du Club ! ». La fin de l'encadré n'apparaît qu'une fois la session vérifiée
// (pas de lien qui change sous les yeux). Absent du PDF (print:hidden).

export default function EncartAnalyseOuverte({ retour }) {
  const [membre, setMembre] = useState(null); // null = pas encore vérifié

  useEffect(() => {
    let annule = false;
    moiClub().then((moi) => !annule && setMembre(Boolean(moi)));
    return () => {
      annule = true;
    };
  }, []);

  return (
    <aside className="mb-4 rounded-2xl border border-yellow-200 bg-yellow-50/70 px-4 py-3 text-sm leading-6 text-zinc-700 print:hidden">
      <p>
        Cette analyse est ouverte à la critique. Un chiffre vous semble faux, une source manque, un biais ou une erreur
        a été repéré ? Sélectionnez un passage pour l’annoter et l’envoyer au comité éditorial. Le Club Perlimpinpin
        challenge les analyses pour les rendre plus solides, et chaque remarque retenue améliore la fiche.
        {membre === true ? <span className="ml-1 font-semibold text-zinc-900">Merci de faire partie du Club !</span> : null}
        {membre === false ? (
          <a
            href={liensAdhesion(retour).adherer}
            className="ml-1 font-semibold text-zinc-900 underline decoration-yellow-400 decoration-2 underline-offset-4 hover:decoration-zinc-900"
          >
            Rejoindre le Club
          </a>
        ) : null}
      </p>
    </aside>
  );
}
