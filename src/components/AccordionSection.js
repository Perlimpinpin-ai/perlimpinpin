"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import ArrowIcon from "./ArrowIcon";

// Dupliqué depuis declarations/[id]/page.js : ce composant vit côté client
// (état d'ouverture) alors que la page est un composant serveur, donc pas de
// partage direct de fonction de rendu entre les deux — même règle de gras
// minimal **...** et même repli liste à puces que TextOrList/renderRichText
// là-bas.
function renderRichText(text) {
  if (typeof text !== "string") return text;
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
    const match = part.match(/^\*\*([^*]+)\*\*$/);
    return match ? (
      <strong key={index} className="font-semibold text-slate-700">
        {match[1]}
      </strong>
    ) : (
      <span key={index}>{part}</span>
    );
  });
}

function TextOrListContent({ value }) {
  if (!value) {
    return <p className="text-zinc-400">Non renseigné.</p>;
  }
  if (Array.isArray(value)) {
    return (
      <ul className="flex flex-col gap-2">
        {value.map((item, index) => (
          <li key={index} className="flex items-start gap-2">
            <span
              className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400"
              aria-hidden="true"
            />
            <span>{renderRichText(item)}</span>
          </li>
        ))}
      </ul>
    );
  }
  return <p>{renderRichText(value)}</p>;
}

// Même découpage en phrases/paragraphes que ContextText (page.js), pour les
// sections dont le texte complet est un long paragraphe unique (Contexte
// national/international) — voir splitParagraphs plus bas.
function splitSentences(text) {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const matches = trimmed.match(/[^.!?]+[.!?]+(?:["'"»)\]]*)(?:\s+|$)/g);
  return matches ? matches.map((sentence) => sentence.trim()).filter(Boolean) : [trimmed];
}

function ParagraphedContent({ value }) {
  if (Array.isArray(value) || typeof value !== "string") {
    return <TextOrListContent value={value} />;
  }
  const sentences = splitSentences(value);
  if (sentences.length <= 3) return <p>{renderRichText(value)}</p>;
  const paragraphs = [];
  for (let i = 0; i < sentences.length; i += 3) {
    paragraphs.push(sentences.slice(i, i + 3).join(" "));
  }
  return (
    <div className="flex flex-col gap-3">
      {paragraphs.map((paragraph, index) => (
        <p key={index}>{renderRichText(paragraph)}</p>
      ))}
    </div>
  );
}

// Rend une section narrative de la fiche au format { synthese, texte }
// (voir data/prompt-methodologie.md, section SECTIONS EN ACCORDÉON) : la
// synthèse (1 phrase) reste visible en permanence, le texte complet se
// déplie au clic. `splitParagraphs` réutilise le découpage en paragraphes
// déjà en place pour Contexte national/international (texte souvent long,
// plusieurs idées enchaînées).
//
// Repli ascendant : si `value` est encore une chaîne ou un tableau simple
// (fiches publiées avant ce format), tout est affiché directement, sans
// accordéon — jamais de crash sur une ancienne fiche.
//
// Le texte complet reste TOUJOURS dans la page (masqué par `hidden` quand
// l'accordéon est fermé) : les annotations du Club (public/club/annotations.js)
// sont ancrées par position dans le texte de la section, qui ne doit donc pas
// changer selon que l'accordéon est ouvert ou fermé. Un passage annoté dans
// un accordéon fermé l'ouvre via l'évènement « club-deplier » (AnnotationsFiche).
export default function AccordionSection({ value, splitParagraphs = false }) {
  const [open, setOpen] = useState(false);
  const racine = useRef(null);

  useEffect(() => {
    const el = racine.current;
    if (!el) return undefined;
    const deplier = () => setOpen(true);
    el.addEventListener("club-deplier", deplier);
    return () => el.removeEventListener("club-deplier", deplier);
  }, []);
  // Impression / export PDF (bouton « PDF » ou Ctrl+P) : tout est déplié le
  // temps de l'impression, puis l'état d'avant est rétabli. flushSync : le
  // contenu doit être dans le DOM avant que le navigateur ne mette en page.
  const [impression, setImpression] = useState(false);
  useEffect(() => {
    const avant = () => flushSync(() => setImpression(true));
    const apres = () => setImpression(false);
    window.addEventListener("beforeprint", avant);
    window.addEventListener("afterprint", apres);
    return () => {
      window.removeEventListener("beforeprint", avant);
      window.removeEventListener("afterprint", apres);
    };
  }, []);
  const deplie = open || impression;

  if (!value) {
    return <p className="text-zinc-400">Non renseigné.</p>;
  }
  if (typeof value === "string" || Array.isArray(value)) {
    return splitParagraphs ? <ParagraphedContent value={value} /> : <TextOrListContent value={value} />;
  }

  const { synthese, texte } = value;

  return (
    <div ref={racine} data-accordeon={open ? "ouvert" : "ferme"}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <p className="flex-1 font-medium text-slate-700">{renderRichText(synthese)}</p>
        <ArrowIcon
          direction="down"
          className={`mt-0.5 h-4 w-4 shrink-0 text-zinc-400 transition-transform ${deplie ? "rotate-180" : ""}`}
        />
      </button>
      {/* Texte toujours présent (ancrage des annotations du Club), masqué tant
          que l'accordéon est fermé ; déplié aussi le temps d'une impression. */}
      <div hidden={!deplie} className="mt-3 border-t border-zinc-100 pt-3">
        {splitParagraphs ? <ParagraphedContent value={texte} /> : <TextOrListContent value={texte} />}
      </div>
    </div>
  );
}
