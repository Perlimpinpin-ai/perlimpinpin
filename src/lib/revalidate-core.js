import { createHash, timingSafeEqual } from "node:crypto";

// Contrôle d'accès de /api/revalidate, sans dépendance à Next : testé par
// scripts/revalidate.test.js.
//
// En-tête attendu : « Authorization: Bearer <REVALIDATE_SECRET> ». Secret absent
// ou vide côté serveur : personne n'entre (fail closed). Comparaison à temps
// constant sur des hachés (longueurs égales, et la longueur du secret ne se
// devine pas au temps de réponse).
export function autorisationValide(entete, secret) {
  if (typeof secret !== "string" || secret.length === 0) return false;
  if (typeof entete !== "string") return false;
  const correspondance = /^Bearer\s+(.+)$/i.exec(entete.trim());
  if (!correspondance) return false;
  const h = (s) => createHash("sha256").update(s, "utf8").digest();
  return timingSafeEqual(h(correspondance[1]), h(secret));
}
