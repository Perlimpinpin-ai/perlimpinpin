"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import ArrowIcon from "@/components/ArrowIcon";
import {
  getStoredConsent,
  storeConsent,
  REOPEN_CONSENT_EVENT,
} from "@/lib/cookieConsent";

// Les deux choix ont le même gabarit (taille, padding, flèche, texte blanc,
// fond plein) : seule la couleur de fond change. Exigence CNIL, le refus
// doit être aussi simple et visible que l'acceptation.
const CHOICE_BUTTON_BASE =
  "inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold text-white shadow-[0_2px_10px_rgb(0_0_0/0.08)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 sm:flex-none sm:min-w-[150px]";

export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    function checkConsent() {
      if (!getStoredConsent()) setVisible(true);
    }
    checkConsent();
  }, []);

  // Permet de rouvrir la carte après coup (lien "Gérer les cookies" du
  // footer) sans recharger la page.
  useEffect(() => {
    function handleReopen() {
      setVisible(true);
    }
    window.addEventListener(REOPEN_CONSENT_EVENT, handleReopen);
    return () => window.removeEventListener(REOPEN_CONSENT_EVENT, handleReopen);
  }, []);

  // Porte le focus sur la carte à son apparition, sans piéger le focus
  // (ce n'est pas une modale bloquante) : la page reste utilisable derrière.
  useEffect(() => {
    if (visible) panelRef.current?.focus();
  }, [visible]);

  if (!visible) return null;

  function acceptAll() {
    storeConsent({ analytics: true });
    setVisible(false);
  }

  function refuseAll() {
    storeConsent({ analytics: false });
    setVisible(false);
  }

  // Fermeture sans choix : rien n'est enregistré, la carte réapparaîtra à
  // la prochaine visite tant qu'aucun choix explicite n'a été fait.
  function dismiss() {
    setVisible(false);
  }

  function handleKeyDown(event) {
    if (event.key === "Escape") dismiss();
  }

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookie-consent-title"
      aria-describedby="cookie-consent-description"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className="print:hidden fixed inset-x-4 bottom-4 z-50 rounded-[28px] border border-white/70 bg-white/75 p-6 text-zinc-900 shadow-[0_12px_40px_rgb(0_0_0/0.18)] focus:outline-none sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[440px] sm:p-7"
      style={{
        WebkitBackdropFilter: "blur(20px) saturate(160%)",
        backdropFilter: "blur(20px) saturate(160%)",
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <img
          src="/logo/perlimpinpin-logo.png"
          alt="Perlimpinpin"
          className="h-[15px] w-auto"
        />
        <button
          type="button"
          onClick={dismiss}
          aria-label="Fermer sans choisir"
          className="-mr-2 -mt-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-900/5 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
            aria-hidden="true"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <h2
        id="cookie-consent-title"
        className="mt-5 text-[28px] font-bold leading-tight tracking-tight sm:text-[32px]"
      >
        <span className="text-zinc-950">Mesure</span>{" "}
        <span className="text-zinc-500">d&apos;audience</span>
      </h2>

      <p
        id="cookie-consent-description"
        className="mt-3 text-[15px] leading-relaxed text-zinc-600"
      >
        Nous mesurons l&apos;audience du site de manière anonyme.
        Acceptez-vous des cookies pour nous aider à améliorer notre
        analyse ?{" "}
        <Link
          href="/confidentialite"
          className="rounded-sm text-zinc-700 underline underline-offset-2 transition-colors hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          En savoir plus
        </Link>
        .
      </p>

      <div className="mt-6 flex gap-3 sm:justify-between">
        <button
          type="button"
          onClick={refuseAll}
          className={`${CHOICE_BUTTON_BASE} bg-zinc-600 hover:bg-zinc-700`}
        >
          Refuser
          <ArrowIcon direction="right" />
        </button>
        <button
          type="button"
          onClick={acceptAll}
          className={`${CHOICE_BUTTON_BASE} bg-blue-600 hover:bg-blue-700`}
        >
          Accepter
          <ArrowIcon direction="right" />
        </button>
      </div>
    </div>
  );
}
