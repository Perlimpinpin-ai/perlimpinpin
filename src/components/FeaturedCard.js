"use client";

import { cheminFiche } from "@/lib/slug";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getScoreBadge } from "@/lib/score";
import AvancementDossier from "@/components/AvancementDossier";
import TitreAvecItalique from "@/components/TitreAvecItalique";
import { DOSSIER, JAUNE_DOSSIER } from "@/lib/couleurs-dossier";

const SWIPE_THRESHOLD_PX = 40;
// Délai avant d'afficher une flèche : évite les clignotements quand la
// souris ne fait que traverser le bord de la carte.
const ARROW_REVEAL_DELAY_MS = 100;

// Carte unique "Prix Perlimpinpin de la semaine" : photo à gauche (~40%,
// ratio fixe quel que soit le candidat), contenu à droite (titre tronqué à
// 3 lignes, teaser d'accueil affiché en entier), score + bouton en pied de carte. Navigation par des
// flèches discrètes révélées au survol des tiers gauche/droit, au clavier
// (← →) et au swipe sur mobile.
// Reçoit l'état du carrousel (index/total/callbacks) depuis FeaturedCarousel.
// `dossier` (getHorsSeriesAccueil, src/lib/hors-series.js) : la carte
// présente alors un dossier, avec sa couleur propre (jaune), une barre
// d'avancement et un bouton « Lire le dossier », mais les mêmes dimensions
// et la même navigation que les autres cartes.
export default function FeaturedCard({
  dossier,
  propositionId,
  slug,
  quoteText,
  personName,
  personPhotoUrl,
  score,
  verdictDescription,
  currentIndex = 0,
  total = 0,
  direction = "next",
  onPrev,
  onNext,
}) {
  const touchStartX = useRef(null);
  // Côté survolé ("left" / "right" / null) une fois le délai écoulé, et
  // côté en attente pendant ce délai.
  const [hoverSide, setHoverSide] = useState(null);
  const pendingSide = useRef(null);
  const revealTimer = useRef(null);

  useEffect(() => () => clearTimeout(revealTimer.current), []);

  function handleMouseMove(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width;
    const side = ratio < 1 / 3 ? "left" : ratio > 2 / 3 ? "right" : null;
    if (side === pendingSide.current) return;

    pendingSide.current = side;
    clearTimeout(revealTimer.current);
    if (side === null) {
      setHoverSide(null);
    } else {
      revealTimer.current = setTimeout(() => setHoverSide(side), ARROW_REVEAL_DELAY_MS);
    }
  }

  function handleMouseLeave() {
    pendingSide.current = null;
    clearTimeout(revealTimer.current);
    setHoverSide(null);
  }

  function handleKeyDown(event) {
    if (total <= 1) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      onPrev?.();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      onNext?.();
    }
  }

  function handleArrowClick(event, navigate) {
    event.preventDefault();
    event.stopPropagation();
    navigate?.();
  }

  function handleTouchStart(event) {
    touchStartX.current = event.touches[0].clientX;
  }

  function handleTouchEnd(event) {
    if (touchStartX.current === null) return;
    const deltaX = event.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;

    if (total <= 1) return;
    if (deltaX > SWIPE_THRESHOLD_PX) onPrev?.();
    else if (deltaX < -SWIPE_THRESHOLD_PX) onNext?.();
  }

  if (!quoteText && !dossier) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-zinc-200 bg-white p-6 text-center">
        <span className="text-xs font-bold uppercase tracking-widest text-red-600">
          Prix Perlimpinpin de la semaine
        </span>
        <p className="mt-4 text-sm text-zinc-500">
          Aucune analyse publiée pour le moment. Revenez bientôt.
        </p>
      </div>
    );
  }

  const badge = dossier ? null : getScoreBadge(score);
  // Anime l'entrée de la nouvelle carte à chaque changement d'index : le
  // remount déclenché par key={index} côté FeaturedCarousel relance
  // l'animation CSS à chaque fois, sans état de transition manuel à gérer.
  const slideAnimationClass =
    direction === "prev" ? "animate-slide-in-left" : "animate-slide-in-right";

  return (
    // Maquette oct. 2026 : carte seule, sans halo décoratif. Le conteneur
    // externe reste monté d'une carte à l'autre (survol, focus, flèches) ;
    // seule la carte interne est remontée (key) pour rejouer l'animation.
    <div
      className="relative rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-blue-950 focus-visible:ring-offset-2"
      tabIndex={total > 1 ? 0 : undefined}
      role={total > 1 ? "region" : undefined}
      aria-roledescription={total > 1 ? "carrousel" : undefined}
      aria-label={total > 1 ? `Prix Perlimpinpin de la semaine, carte ${currentIndex + 1} sur ${total}` : undefined}
      onMouseMove={total > 1 ? handleMouseMove : undefined}
      onMouseLeave={total > 1 ? handleMouseLeave : undefined}
      onKeyDown={handleKeyDown}
    >
      <div
        key={currentIndex}
        className={`flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_-30px_rgba(30,41,82,0.35)] sm:min-h-[540px] sm:flex-row ring-1 ring-zinc-100 ${slideAnimationClass}`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {dossier ? (
          <ContenuDossier dossier={dossier} />
        ) : (
        <>
        {/* Photo : sur desktop, étirée sur toute la hauteur de la carte
            (sm:h-auto + étirement flex par défaut), elle-même de 540 px au
            minimum — sm:min-h-[540px] ci-dessus — pour rester constante d'un
            candidat à l'autre. Hauteur minimale et non fixe : un teaser
            d'accueil long (jusqu'à 200 caractères, affiché sans coupure)
            agrandit la carte au lieu de rogner le bouton. Sur mobile
            (empilé), pas de risque d'étirement croisé : aspect-ratio suffit. */}
        <div className="relative aspect-[4/5] w-full shrink-0 sm:aspect-auto sm:h-auto sm:w-2/5">
          <img
            src={personPhotoUrl || "/avatar-placeholder.svg"}
            alt={personName}
            className="absolute inset-0 h-full w-full object-cover object-top"
          />
        </div>

        {/* Marge droite élargie (souris uniquement) : réserve la place de
            la flèche "suivante" pour qu'elle ne recouvre ni texte ni bouton. */}
        <div className="flex flex-1 flex-col p-6 sm:p-8 [@media(hover:hover)]:pr-14!">
          <p className="text-lg font-medium tracking-tight text-zinc-900">{personName}</p>
          <blockquote className="mt-2 line-clamp-3 shrink-0 pb-0.5 font-sans text-2xl font-bold leading-tight tracking-tight text-blue-950 sm:text-[1.7rem]">
            {quoteText}
          </blockquote>
          {verdictDescription ? (
            <p className="mb-4 mt-3 text-base leading-snug text-slate-500">
              {verdictDescription}
            </p>
          ) : null}

          {/* Le score est l'info la plus importante après le titre : mis en
              valeur juste avant le bouton, pas relégué dans une barre basse.
              Même traitement que la carte score sticky des pages de
              déclaration (voir StickyScoreCard), pour une identité visuelle
              cohérente du "score Perlimpinpin" à travers le site. */}
          <div className="mt-auto border-t border-zinc-200 pt-5 max-sm:mt-2">
            <span className="font-mono text-xs uppercase tracking-widest text-slate-500">
              Score Perlimpinpin
            </span>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className={`text-5xl font-extrabold tracking-tight ${badge.scoreClass}`}>
                {score}
              </span>
              <span className="text-lg font-semibold text-zinc-400">/100</span>
            </div>
            <div
              className={`mt-3 inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-semibold ${badge.badgeClass}`}
            >
              {badge.label}
            </div>
          </div>

          <Link
            href={cheminFiche({ id: propositionId, slug })}
            className="mt-5 flex w-full items-center justify-between gap-2 rounded-xl bg-blue-950 px-6 py-3.5 text-base font-medium text-white transition-colors hover:bg-blue-900"
          >
            Voir l&apos;analyse complète
            <span aria-hidden="true">→</span>
          </Link>
        </div>
        </>
        )}
      </div>

      {/* Zones de survol (tiers gauche / droit) : purement positionnelles,
          pointer-events: none pour ne jamais intercepter un clic sur la
          carte. Seule la flèche, une fois visible, est cliquable. */}
      {total > 1 ? (
        <>
          <div className="pointer-events-none absolute inset-y-0 left-0 flex w-1/3 items-center justify-start pl-3">
            <CarouselArrow
              side="left"
              visible={hoverSide === "left"}
              onClick={(event) => handleArrowClick(event, onPrev)}
            />
          </div>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex w-1/3 items-center justify-end pr-3">
            <CarouselArrow
              side="right"
              visible={hoverSide === "right"}
              onClick={(event) => handleArrowClick(event, onNext)}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}

// Contenu de la carte quand elle présente un dossier : même gabarit et
// mêmes dimensions que la carte d'une déclaration (image sur les 2/5 à
// gauche, titre limité à 3 lignes, bloc en pied, bouton), dans le jaune
// propre aux dossiers (JAUNE_DOSSIER, le jaune de l'illustration). Le bloc
// « Score » est remplacé par l'avancement du dossier, la note globale
// n'existant qu'une fois toutes les fiches publiées.
function ContenuDossier({ dossier }) {
  const href = `/dossiers/${dossier.slug}`;
  const alt = dossier.photo?.alt ?? dossier.candidat?.nom ?? "";
  return (
    <>
      {/* Image du dossier, jamais recadrée sur les côtés. Sur téléphone
          (image au-dessus du texte) : l'illustration 4:5 (`photo.src`),
          comme les portraits des autres cartes. Dès sm (colonne de gauche,
          2/5 de la carte comme les autres) : la version verticale 1:2
          (`photo.srcVertical`), calée en haut et en position absolue pour
          ne jamais imposer sa hauteur à la carte ; le fond jaune de la
          colonne prolonge son bandeau jaune jusqu'en bas. */}
      <div
        className="relative w-full shrink-0 overflow-hidden sm:w-2/5"
        style={{ backgroundColor: dossier.photo?.fondVertical ?? JAUNE_DOSSIER }}
      >
        <img
          src={dossier.photo?.src || "/avatar-placeholder.svg"}
          alt={alt}
          className={`block aspect-[4/5] w-full object-cover object-top ${dossier.photo?.srcVertical ? "sm:hidden" : "sm:absolute sm:inset-0 sm:h-full"}`}
        />
        {dossier.photo?.srcVertical ? (
          <img
            src={dossier.photo.srcVertical}
            alt={alt}
            className="absolute left-0 top-0 hidden h-auto w-full sm:block"
          />
        ) : null}
      </div>

      {/* Même structure que le texte d'une carte déclaration ; marge
          droite élargie (souris uniquement) pour la flèche « suivante ». */}
      <div className="flex flex-1 flex-col p-6 sm:p-8 [@media(hover:hover)]:pr-14!">
        <span
          className={`w-fit rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-widest text-zinc-950 ${DOSSIER.fond}`}
        >
          Dossier n°{dossier.numero}
        </span>
        <p className="mt-3 line-clamp-3 shrink-0 pb-0.5 font-sans text-2xl font-bold leading-tight tracking-tight text-zinc-950 sm:text-[1.7rem]">
          <TitreAvecItalique titre={dossier.titre} motItalique={dossier.motItalique} />
        </p>
        {dossier.accroche ? (
          <p className="mb-4 mt-3 text-base leading-snug text-slate-500">{dossier.accroche}</p>
        ) : null}

        <div className="mt-auto border-t border-zinc-200 pt-5 max-sm:mt-2">
          <span className="font-mono text-xs uppercase tracking-widest text-slate-500">
            Avancement du dossier
          </span>
          <AvancementDossier
            avancement={dossier.avancement}
            texte={dossier.texteAvancement}
            className="mt-3"
          />
        </div>

        <Link
          href={href}
          className={`mt-5 flex w-full items-center justify-between gap-2 rounded-xl px-6 py-3.5 text-base font-semibold text-zinc-950 transition-colors ${DOSSIER.fond} ${DOSSIER.fondSurvol}`}
        >
          Lire le dossier
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </>
  );
}

function CarouselArrow({ side, visible, onClick }) {
  const isLeft = side === "left";
  return (
    <button
      type="button"
      aria-label={isLeft ? "Carte précédente" : "Carte suivante"}
      data-visible={visible}
      onClick={onClick}
      className="carousel-arrow flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-blue-950 shadow-md ring-1 ring-black/5 backdrop-blur-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-950"
    >
      <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
        <path d={isLeft ? "M12.5 4.5 7 10l5.5 5.5" : "M7.5 4.5 13 10l-5.5 5.5"} />
      </svg>
    </button>
  );
}
