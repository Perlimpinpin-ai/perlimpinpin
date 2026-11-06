import { createHash, createHmac, timingSafeEqual } from "node:crypto";

// Cœur de la session adhérent de /relectures : fonctions PURES (ni Next, ni
// cookies, ni base) pour pouvoir les tester avec `node --test`
// (scripts/relecture-auth.test.js). La lecture du cookie de la requête et la
// vérification du compte en base sont dans src/lib/relecture-auth.js.
//
// Session volontairement séparée de /live (Auth.js) : un simple cookie signé
// HMAC-SHA256 avec AUTH_SECRET, sur le même modèle que src/lib/test-auth-core.js.

export const RELECTURE_COOKIE_NAME = "relecture_auth";
export const RELECTURE_SESSION_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours

// Le secret de signature (AUTH_SECRET, partagé avec /live et /test) doit
// exister. Sinon, échec fermé : personne ne peut se connecter.
export function secretUtilisable(secret) {
  return typeof secret === "string" && secret.length > 0;
}

function idValide(id) {
  return Number.isSafeInteger(id) && id > 0;
}

// Préfixe dédié : une signature produite pour /test (« test-edit|… ») ne peut
// jamais être rejouée ici, et inversement.
function signature(secret, adherentId, expiration) {
  return createHmac("sha256", secret)
    .update(`relecture|${adherentId}|${expiration}`)
    .digest("base64url");
}

// Valeur du cookie : « <adherentId>.<expiration en ms>.<signature> ».
export function creerSession({ secret, adherentId, maintenant = Date.now() }) {
  if (!secretUtilisable(secret) || !idValide(adherentId)) {
    throw new Error("Session adhérent : secret ou identifiant invalide.");
  }
  const expiration = maintenant + RELECTURE_SESSION_MS;
  return `${adherentId}.${expiration}.${signature(secret, adherentId, expiration)}`;
}

// { adherentId, emiseLe } si la valeur est bien signée avec ce secret et pas
// expirée, sinon null (absente, mal formée, falsifiée, expirée, secret absent).
// `emiseLe` (ms) sert à invalider les sessions ouvertes avant une
// réinitialisation du compte (voir getAdherent).
export function lireSession({ secret, valeur, maintenant = Date.now() }) {
  if (!secretUtilisable(secret)) return null;
  if (typeof valeur !== "string") return null;

  const morceaux = valeur.split(".");
  if (morceaux.length !== 3) return null;
  const [texteId, texteExpiration, recue] = morceaux;
  if (!/^[1-9]\d{0,15}$/.test(texteId) || !/^\d{1,16}$/.test(texteExpiration)) return null;

  const adherentId = Number(texteId);
  if (!idValide(adherentId)) return null;

  const attendue = Buffer.from(signature(secret, texteId, texteExpiration));
  const recueBuffer = Buffer.from(recue);
  // timingSafeEqual exige des longueurs identiques (sinon il lève une erreur).
  if (attendue.length !== recueBuffer.length) return null;
  if (!timingSafeEqual(attendue, recueBuffer)) return null;

  const expiration = Number(texteExpiration);
  if (expiration <= maintenant) return null;
  return { adherentId, emiseLe: expiration - RELECTURE_SESSION_MS };
}

// Pages de l'espace adhérents accessibles sans être connecté.
const PAGES_PUBLIQUES = new Set([
  "/relectures/connexion",
  "/relectures/inscription",
  "/relectures/deconnexion",
  "/relectures/mot-de-passe-oublie",
  "/relectures/nouveau-mot-de-passe",
]);

// Le proxy doit-il exiger une session pour ce chemin ? Protégé par défaut : tout
// /relectures (y compris /relectures/index.html, servi depuis public/) sauf les
// pages ci-dessus. Comparaison en minuscules et sans « / » final, pour
// qu'une variante d'écriture de l'URL ne contourne pas la protection.
function normaliserChemin(pathname) {
  return pathname.toLowerCase().replace(/\/+$/, "");
}

export function cheminRelectureProtege(pathname) {
  if (typeof pathname !== "string") return true;
  const chemin = normaliserChemin(pathname);
  if (chemin !== "/relectures" && !chemin.startsWith("/relectures/")) return false;
  return !PAGES_PUBLIQUES.has(chemin);
}

// Lecture de la page par le comité, sans compte adhérent : c'est ce que fait
// `node scripts/relecture.js lancer` pour vérifier qu'une fiche est en ligne
// avant de lancer son chrono. L'en-tête x-relecture-admin-code (comparé à
// RELECTURE_ADMIN_CODE) ouvre UNIQUEMENT la lecture (GET/HEAD) de la page
// elle-même : ni cookie posé, ni /api/relectures/* (non couvert par le proxy,
// les routes exigent un adhérent), ni aucune autre page.
export const ADMIN_CODE_MIN_LENGTH = 12;
const PAGES_LECTURE_COMITE = new Set(["/relectures", "/relectures/index.html"]);

function sha256(texte) {
  return createHash("sha256").update(texte, "utf8").digest();
}

// Code trop court ou absent côté serveur : personne n'entre (fail closed).
// Comparaison à temps constant sur les empreintes (longueur fixe).
export function codeAdminValide(recu, attendu) {
  if (typeof attendu !== "string" || attendu.length < ADMIN_CODE_MIN_LENGTH) return false;
  if (typeof recu !== "string" || recu.length === 0) return false;
  return timingSafeEqual(sha256(recu), sha256(attendu));
}

export function lectureComiteAutorisee({ methode, pathname, codeRecu, codeAdmin }) {
  if (methode !== "GET" && methode !== "HEAD") return false;
  if (typeof pathname !== "string" || !PAGES_LECTURE_COMITE.has(normaliserChemin(pathname))) return false;
  return codeAdminValide(codeRecu, codeAdmin);
}

// Options du cookie de session (httpOnly : illisible par le JavaScript de la page).
export function optionsCookie() {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: RELECTURE_SESSION_MS / 1000,
  };
}
