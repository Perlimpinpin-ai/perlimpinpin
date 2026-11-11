import { NextResponse } from "next/server";
import { COOKIE_RETOUR, optionsCookieRetour, retourValide, urlAdhesion } from "@/lib/club-retour-core";

// « Adhérer au Club » depuis une fiche : /relectures/adherer?retour=/declarations/12
// Mémorise la fiche (cookie club_retour, chemin de fiche uniquement) puis
// envoie vers la page d'adhésion HelloAsso. Sans retour valable, on envoie
// quand même vers HelloAsso, sans rien mémoriser. Route publique (voir
// PAGES_PUBLIQUES, relecture-auth-core.js) ; aucune base, aucun mail.
export function GET(request) {
  const retour = retourValide(request.nextUrl.searchParams.get("retour"));
  const reponse = NextResponse.redirect(urlAdhesion(), 303);
  if (retour) reponse.cookies.set(COOKIE_RETOUR, retour, optionsCookieRetour());
  return reponse;
}
