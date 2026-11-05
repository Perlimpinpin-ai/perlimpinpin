"use client";

import { useEffect, useRef, useState } from "react";

// Boutons « Partager » et « PDF » d'une fiche, posés à côté de la bascule
// « Résumé basique / Résumé expert » (src/app/declarations/[id]/page.js).
//
// Partager : sur téléphone (écran tactile + feuille de partage native), ouvre
// la feuille de partage du système ; ailleurs, un petit menu de réseaux
// sociaux (X, LinkedIn, Facebook, Bluesky, WhatsApp, e-mail, copier le lien).
// Le lien partagé est toujours l'adresse publique de la fiche (`chemin`),
// sans ?vue= ni autre paramètre.
//
// PDF : lance l'impression du navigateur (« Enregistrer au format PDF »). Les
// éléments marqués print:hidden (en-tête, pied de page, encarts…) sont
// retirés, et les accordéons s'ouvrent le temps de l'impression (voir
// AccordionSection). La vue imprimée est celle affichée (basique ou expert).

const ICONE_PARTAGER =
  "M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z";
const ICONE_PDF =
  "M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m.75 12 3 3m0 0 3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z";

const CLASSE_BOUTON =
  "inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 sm:flex-none";

function Icone({ d }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

function liensReseaux(url, texte) {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(texte);
  return [
    { nom: "X", href: `https://x.com/intent/post?text=${t}&url=${u}&via=PerlimpinpinAI` },
    { nom: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}` },
    { nom: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
    { nom: "Bluesky", href: `https://bsky.app/intent/compose?text=${encodeURIComponent(`${texte} ${url}`)}` },
    { nom: "WhatsApp", href: `https://wa.me/?text=${encodeURIComponent(`${texte} ${url}`)}` },
    { nom: "E-mail", href: `mailto:?subject=${t}&body=${encodeURIComponent(`${texte}\n\n${url}`)}` },
  ];
}

// chemin : adresse publique de la fiche (ex. /declarations/42).
// texte : phrase d'accroche du partage. partage = false : bouton PDF seul
// (aperçu /test, dont l'adresse n'est pas publique).
export default function ActionsFiche({ chemin, texte, partage = true }) {
  const [menuOuvert, setMenuOuvert] = useState(false);
  const [copie, setCopie] = useState(false);
  const conteneur = useRef(null);

  // Fermeture du menu : clic à l'extérieur ou touche Échap.
  useEffect(() => {
    if (!menuOuvert) return undefined;
    function surClic(event) {
      if (!conteneur.current?.contains(event.target)) setMenuOuvert(false);
    }
    function surTouche(event) {
      if (event.key === "Escape") setMenuOuvert(false);
    }
    document.addEventListener("mousedown", surClic);
    document.addEventListener("keydown", surTouche);
    return () => {
      document.removeEventListener("mousedown", surClic);
      document.removeEventListener("keydown", surTouche);
    };
  }, [menuOuvert]);

  const url = () => `${window.location.origin}${chemin}`;

  async function partager() {
    const tactile = window.matchMedia?.("(pointer: coarse)").matches;
    if (tactile && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: texte, text: texte, url: url() });
        return;
      } catch (erreur) {
        // Partage annulé par la personne : on s'arrête là. Autre échec : menu.
        if (erreur?.name === "AbortError") return;
      }
    }
    setMenuOuvert((valeur) => !valeur);
  }

  async function copierLien() {
    try {
      await navigator.clipboard.writeText(url());
      setCopie(true);
      setTimeout(() => setCopie(false), 2000);
    } catch {
      // Presse-papiers indisponible : on ignore plutôt que de bloquer l'UI.
    }
  }

  return (
    <div ref={conteneur} className="relative flex gap-2 print:hidden">
      {partage ? (
        <button
          type="button"
          onClick={partager}
          aria-haspopup="menu"
          aria-expanded={menuOuvert}
          className={CLASSE_BOUTON}
        >
          <Icone d={ICONE_PARTAGER} />
          Partager
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => window.print()}
        aria-label="Exporter la fiche en PDF"
        title="Exporter en PDF"
        className={CLASSE_BOUTON}
      >
        <Icone d={ICONE_PDF} />
        PDF
      </button>

      {menuOuvert ? (
        <div
          role="menu"
          className="absolute left-0 top-full z-20 mt-2 w-56 overflow-hidden rounded-xl border border-zinc-200 bg-white py-1 shadow-lg"
        >
          {liensReseaux(url(), texte).map((lien) => (
            <a
              key={lien.nom}
              role="menuitem"
              href={lien.href}
              target={lien.nom === "E-mail" ? undefined : "_blank"}
              rel="noopener noreferrer"
              onClick={() => setMenuOuvert(false)}
              className="block px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
            >
              {lien.nom}
            </a>
          ))}
          <button
            type="button"
            role="menuitem"
            onClick={copierLien}
            className="block w-full border-t border-zinc-100 px-4 py-2 text-left text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            {copie ? "Lien copié !" : "Copier le lien"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
