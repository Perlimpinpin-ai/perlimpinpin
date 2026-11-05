// Retour vers la fiche d'origine après une adhésion au Club. Fonctions PURES,
// testées par scripts/club-retour.test.js.
//
// Parcours : sur une fiche, le bouton « Adhérer » mène à
// /relectures/adherer?retour=/declarations/12 ; cette route mémorise la fiche
// dans un cookie (club_retour) puis envoie vers HelloAsso. Après le paiement,
// l'adhérent reçoit le mail de bienvenue ; quand il choisit son mot de passe
// (/relectures/activer), il est renvoyé vers la fiche mémorisée. Le cookie ne
// contient qu'un chemin du site, jamais de donnée personnelle.
//
// Seuls les chemins de fiche publiés sont acceptés (/declarations/<nombre>,
// éventuellement ?vue=expert) : jamais d'adresse externe ni de chemin
// arbitraire, pour que le lien ne puisse pas servir à rediriger ailleurs.

export const COOKIE_RETOUR = "club_retour";
// Même durée que le lien d'activation du mail de bienvenue
export const DUREE_RETOUR_S = 7 * 24 * 60 * 60;

// Page HelloAsso d'adhésion. CLUB_ADHESION_URL (adresse publique, pas un
// secret) permet de viser le formulaire exact ; sinon, page de l'association.
export const ADHESION_URL_DEFAUT = "https://www.helloasso.com/associations/perlimpinpin-ai";
const HOTES_HELLOASSO = new Set(["www.helloasso.com", "www.helloasso-sandbox.com"]);

const CHEMIN_FICHE = /^\/declarations\/[1-9]\d{0,9}(?:\?vue=expert)?$/;

// Le chemin s'il est une fiche du site, sinon null.
export function retourValide(chemin) {
  if (typeof chemin !== "string" || chemin.length > 60) return null;
  return CHEMIN_FICHE.test(chemin) ? chemin : null;
}

export function urlAdhesion(env = process.env) {
  const brute = env.CLUB_ADHESION_URL?.trim();
  if (!brute) return ADHESION_URL_DEFAUT;
  try {
    const url = new URL(brute);
    if (url.protocol === "https:" && HOTES_HELLOASSO.has(url.hostname)) return url.toString();
  } catch {
    // adresse illisible : page par défaut
  }
  return ADHESION_URL_DEFAUT;
}

export function optionsCookieRetour() {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: DUREE_RETOUR_S,
  };
}
