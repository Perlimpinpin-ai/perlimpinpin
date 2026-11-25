import { createHash } from "node:crypto";

// Limite des tentatives de connexion au Club (/relectures/connexion) :
// au plus 5 essais ratés par quart d'heure pour une même adresse e-mail, et
// 10 pour une même adresse IP (plusieurs comptes visés depuis un même poste).
// Au-delà, la connexion est refusée jusqu'à la fin du quart d'heure, avec un
// message qui ne dit jamais si l'adresse a un compte.
// Fonctions PURES, testées par scripts/limite-connexion.test.js.
//
// Ni l'adresse e-mail ni l'IP ne sont gardées en clair : seulement une
// empreinte SHA-256 salée avec AUTH_SECRET (illisible sans le secret).

export const FENETRE_MS = 15 * 60 * 1000;
export const MAX_ECHECS_EMAIL = 5;
export const MAX_ECHECS_IP = 10;
export const MESSAGE_TROP_DE_TENTATIVES =
  "Trop de tentatives de connexion. Réessayez dans un quart d'heure, ou utilisez « Mot de passe oublié ».";

export function empreinte(type, valeur, sel) {
  if (typeof valeur !== "string" || !valeur) return null;
  return createHash("sha256").update(`limite-connexion|${type}|${sel ?? ""}|${valeur}`, "utf8").digest("hex");
}

// Première adresse de « x-forwarded-for » (posée par Vercel), sinon null.
export function ipDeLaRequete(enTetes) {
  const brut = enTetes?.get?.("x-forwarded-for") ?? enTetes?.get?.("x-real-ip") ?? "";
  const ip = String(brut).split(",")[0].trim();
  return ip && ip.length <= 64 ? ip : null;
}

export function depuis(maintenant = Date.now()) {
  return new Date(maintenant - FENETRE_MS);
}

export function estBloque({ echecsEmail = 0, echecsIp = 0 }) {
  return echecsEmail >= MAX_ECHECS_EMAIL || echecsIp >= MAX_ECHECS_IP;
}
