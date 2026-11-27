"use client";

import { track } from "@vercel/analytics";

// Bouton « Nous contacter » : même forme que « Je soutiens » (EncartDon), en
// bulle blanche. Le site n'a pas de page de contact : le lien ouvre la
// messagerie vers l'adresse de contact (celle des mentions légales et de la
// page confidentialité). Chaque clic est compté dans Vercel Analytics
// (événement « contact_clic », propriété `emplacement`).
const CONTACT_EMAIL = "perlimpinpin.admin@gmail.com";

export default function BoutonContact({ emplacement = "inconnu", className = "" }) {
  return (
    <a
      href={`mailto:${CONTACT_EMAIL}`}
      onClick={() => track("contact_clic", { emplacement })}
      className={`inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-full border border-zinc-200 bg-white px-5 py-2.5 text-sm font-semibold text-[#111827] transition-colors hover:bg-zinc-50 ${className}`}
    >
      Nous contacter
    </a>
  );
}
