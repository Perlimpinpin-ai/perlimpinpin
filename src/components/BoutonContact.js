"use client";

import { useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { track } from "@vercel/analytics";
import ContactModal from "@/components/ContactModal";

// Bouton « Nous contacter » : même forme que « Je soutiens » (EncartDon), en
// bulle blanche. Il ouvre la fenêtre de contact du site (ContactModal, la même
// que le lien du pied de page, voir ContactFooterButton). Chaque clic est
// compté dans Vercel Analytics (événement « contact_clic », propriété
// `emplacement`).
//
// `taille` : classes de padding et de police de la pilule (par défaut, celles
// de « Je soutiens »). Le filet gris est un contour intérieur (ring-inset)
// plutôt qu'une bordure : même rendu, sans ajouter 2 px de hauteur et de
// largeur par rapport à « Je soutiens ».
export default function BoutonContact({
  emplacement = "inconnu",
  taille = "px-5 py-2.5 text-sm",
  className = "",
}) {
  const [ouvert, setOuvert] = useState(false);
  // Identité stable : ContactModal l'a en dépendance de ses effets.
  const fermer = useCallback(() => setOuvert(false), []);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          track("contact_clic", { emplacement });
          setOuvert(true);
        }}
        className={`inline-flex shrink-0 cursor-pointer items-center justify-center whitespace-nowrap rounded-full bg-white font-semibold text-[#111827] ring-1 ring-inset ring-zinc-200 transition-colors hover:bg-zinc-50 ${taille} ${className}`}
      >
        Nous contacter
      </button>
      {/* Rendue dans <body> : la fenêtre n'hérite ni de l'alignement à droite
          du bloc contact (carte du score) ni d'une éventuelle transformation
          d'un parent (encart en fondu), qui fausserait son `position: fixed`. */}
      {ouvert ? createPortal(<ContactModal open onClose={fermer} />, document.body) : null}
    </>
  );
}
