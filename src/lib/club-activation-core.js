import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { analyserJeton, secretUtilisable, urlSite } from "./mot-de-passe-oublie-core.js";

// Lien « Choisir mon mot de passe » du mail de bienvenue (nouvel adhérent
// HelloAsso). Fonctions PURES (ni Next, ni base), testées par
// scripts/club-activation.test.js.
//
// Même principe que le « mot de passe oublié » (mot-de-passe-oublie-core.js) :
// aucun stockage, un jeton signé HMAC-SHA256 avec AUTH_SECRET dans le lien.
// Différences :
//   - préfixe « activation| » : un jeton de réinitialisation ou une session
//     ne peut jamais servir d'activation, et inversement ;
//   - valable 7 jours (le mail de bienvenue n'est pas toujours lu tout de suite) ;
//   - signé avec l'adresse e-mail du compte ;
//   - ne sert qu'UNE fois : il n'active qu'un compte SANS mot de passe (la
//     condition est dans la requête d'écriture, voir club-activation.js). Une
//     fois le mot de passe choisi, le lien ne fait plus rien.
// Passé 7 jours, /relectures/inscription reste possible (adresse + mot de passe).

export const DUREE_ACTIVATION_MS = 7 * 24 * 60 * 60 * 1000;
export const PAGE_ACTIVATION = "/relectures/activer";

function idValide(id) {
  return Number.isSafeInteger(id) && id > 0;
}

function sha256Hex(texte) {
  return createHash("sha256").update(texte, "utf8").digest("hex");
}

function signature(secret, id, expiration, email) {
  return createHmac("sha256", secret)
    .update(`activation|${id}|${expiration}|${sha256Hex(email)}`)
    .digest("base64url");
}

// Jeton « <id>.<expiration en ms>.<signature> » (même forme que les jetons de
// réinitialisation : analyserJeton sert aux deux).
export function creerJetonActivation({ secret, adherentId, email, maintenant = Date.now() }) {
  if (!secretUtilisable(secret) || !idValide(adherentId)) {
    throw new Error("Jeton d'activation : secret ou identifiant invalide.");
  }
  if (typeof email !== "string" || !email.includes("@")) {
    throw new Error("Jeton d'activation : adresse e-mail invalide.");
  }
  const expiration = maintenant + DUREE_ACTIVATION_MS;
  return `${adherentId}.${expiration}.${signature(secret, adherentId, expiration, email)}`;
}

// Vrai si la valeur du lien est un jeton d'activation signé avec ce secret,
// pour ce compte (id et e-mail), et pas expiré. Ne dit rien de l'état du
// compte (déjà activé ou non) : c'est à l'appelant de le vérifier.
export function jetonActivationValide({ secret, valeur, adherentId, email, maintenant = Date.now() }) {
  if (!secretUtilisable(secret)) return false;
  const jeton = analyserJeton(valeur);
  if (!jeton || jeton.id !== adherentId) return false;
  if (typeof email !== "string" || !email.includes("@")) return false;
  if (!Number.isFinite(jeton.expiration) || jeton.expiration <= maintenant) return false;
  // Expiration trop lointaine : jamais émise par creerJetonActivation
  if (jeton.expiration > maintenant + DUREE_ACTIVATION_MS) return false;

  const attendue = Buffer.from(signature(secret, jeton.id, jeton.expiration, email));
  const recue = Buffer.from(jeton.recue);
  if (attendue.length !== recue.length) return false;
  return timingSafeEqual(attendue, recue);
}

// Lien complet à mettre dans le mail de bienvenue. Adresse du site jamais
// déduite de la requête (voir urlSite).
export function lienActivation({ jeton, env = process.env }) {
  const url = new URL(PAGE_ACTIVATION, urlSite(env));
  url.searchParams.set("jeton", jeton);
  return url.toString();
}
