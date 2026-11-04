"use client";

import { useEffect, useRef, useState } from "react";
import { track } from "@vercel/analytics";

// Encart « Soutenez-nous » : lien vers le formulaire de don HelloAsso.
//
// Réutilisé à plusieurs endroits du site, avec un message propre à chaque
// page (props `titre` et `texte`). Chaque clic est compté dans Vercel
// Analytics (événement « don_clic », propriété `emplacement`) pour savoir
// quel emplacement rapporte vraiment.
//
// Props :
// - titre, texte : le message (par défaut « Soutenez-nous ! »).
// - bouton : texte du bouton (par défaut « Je soutiens → »).
// - emplacement : nom court de la page (ex. "fiche", "methode") — sert au
//   suivi des clics.
// - format : "carte" (par défaut, petite carte verticale) ou "bandeau"
//   (horizontal, pleine largeur, pour le bas d'une page).
// - pleineLargeur : la carte prend toute la largeur de son conteneur (au lieu
//   d'être plafonnée à 320px à partir de md).
// - apparition : l'encart n'apparaît (en fondu) qu'une fois arrivé à l'écran,
//   quand le lecteur a déroulé la page jusqu'à lui.
// - className : classes en plus sur l'élément racine.
const LIEN_DON =
  "https://www.helloasso.com/associations/perlimpinpin-ai/formulaires/2";

// Cœur orange entouré de petits traits (effet « rayonnant »).
function CoeurRayonnant() {
  return (
    <svg
      viewBox="0 0 48 48"
      aria-hidden="true"
      className="h-12 w-12 shrink-0"
      fill="none"
    >
      <g stroke="#F0612E" strokeWidth="2" strokeLinecap="round">
        <line x1="24" y1="3" x2="24" y2="8" />
        <line x1="9" y1="9" x2="12.5" y2="12.5" />
        <line x1="39" y1="9" x2="35.5" y2="12.5" />
        <line x1="3" y1="24" x2="7" y2="24" />
        <line x1="45" y1="24" x2="41" y2="24" />
      </g>
      <path
        d="M24 40c-1-.8-13-8.6-13-17.2C11 18.5 14.2 15 18.2 15c2.5 0 4.6 1.3 5.8 3.3 1.2-2 3.3-3.3 5.8-3.3 4 0 7.2 3.5 7.2 7.8C37 31.4 25 39.2 24 40z"
        fill="#F0612E"
      />
    </svg>
  );
}

// Fait apparaître l'encart en fondu quand il entre dans l'écran (une seule
// fois). Sans IntersectionObserver (très vieux navigateurs), il reste visible.
function useApparition(actif) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(!actif);

  useEffect(() => {
    if (!actif) return undefined;
    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entrees) => {
        if (entrees.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [actif]);

  return [ref, visible];
}

export default function EncartDon({
  titre = "Soutenez-nous !",
  texte = "Faites un don sur HelloAsso !",
  bouton = "Je soutiens →",
  emplacement = "inconnu",
  format = "carte",
  pleineLargeur = false,
  apparition = false,
  className = "",
}) {
  const [ref, visible] = useApparition(apparition);

  const classesApparition = apparition
    ? `transition-all duration-700 ease-out motion-reduce:transition-none ${
        visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
      }`
    : "";

  const lien = (
    <a
      href={LIEN_DON}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => track("don_clic", { emplacement })}
      className="inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-[#111827] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-700"
    >
      {bouton}
    </a>
  );

  if (format === "bandeau") {
    return (
      <aside
        ref={ref}
        className={`w-full rounded-2xl bg-gradient-to-br from-[#FFF4EE] to-[#FDE6DA] p-6 sm:p-8 ${classesApparition} ${className}`}
      >
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
          <div className="flex items-start gap-4">
            <CoeurRayonnant />
            <div>
              <p className="text-lg font-bold leading-snug text-zinc-900 sm:text-xl">
                {titre}
              </p>
              <p className="mt-1 text-sm text-zinc-600 sm:text-base">{texte}</p>
            </div>
          </div>
          <div className="self-start sm:self-auto">{lien}</div>
        </div>
      </aside>
    );
  }

  return (
    <aside
      ref={ref}
      className={`flex w-full flex-col rounded-2xl bg-gradient-to-br from-[#FFF4EE] to-[#FDE6DA] p-6 ${
        pleineLargeur ? "" : "md:max-w-[320px]"
      } ${classesApparition} ${className}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-lg font-bold leading-snug text-zinc-900">{titre}</p>
          <p className="mt-1 text-sm text-zinc-600">{texte}</p>
        </div>
        <CoeurRayonnant />
      </div>
      <div className="mt-4">{lien}</div>
    </aside>
  );
}
