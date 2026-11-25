"use client";

import { useSyncExternalStore } from "react";
import EncartDon from "@/components/EncartDon";

// Encart de don de la page d'accueil, avec un compte à rebours jusqu'au
// premier tour de la présidentielle (18 avril 2027, date officialisée par le
// gouvernement).
//
// Le nombre de jours est recalculé dans le navigateur, à la date de Paris :
// la page d'accueil est mise en cache côté serveur, le chiffre resterait
// sinon figé sur le jour de la mise en cache.
const PREMIER_TOUR = "2027-04-18";

function joursRestants() {
  // Date du jour à Paris, au format AAAA-MM-JJ (fr-CA donne ce format).
  const aujourdhui = new Intl.DateTimeFormat("fr-CA", {
    timeZone: "Europe/Paris",
  }).format(new Date());
  const ecart = Date.parse(PREMIER_TOUR) - Date.parse(aujourdhui);
  return Math.round(ecart / 86_400_000);
}

// Rien à écouter : le chiffre est lu une fois, au rendu dans le navigateur.
const sAbonner = () => () => {};

export default function EncartDonCompteARebours({ className = "" }) {
  // null côté serveur (et à l'hydratation), puis le vrai nombre de jours.
  const jours = useSyncExternalStore(sAbonner, joursRestants, () => null);

  // Avant le calcul (premier rendu) ou après le premier tour : message sans
  // compte à rebours.
  const titre =
    jours !== null && jours > 1
      ? `J-${jours} avant le premier tour.`
      : jours === 1
        ? "Demain, le premier tour."
        : "2027 se jouera sur des promesses.";

  return (
    <EncartDon
      titre={titre}
      texte="Chaque don, c’est une promesse de plus vérifiée."
      emplacement="accueil"
      pleineLargeur
      className={`justify-between ${className}`}
    />
  );
}
