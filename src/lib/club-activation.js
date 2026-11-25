import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/live-password";
import { analyserJeton } from "@/lib/mot-de-passe-oublie-core";
import { jetonActivationValide } from "@/lib/club-activation-core";

// Activation d'un compte adhérent par le lien du mail de bienvenue, côté
// serveur. Le cœur (jeton signé) est dans club-activation-core.js.
// Écriture : uniquement motDePasseHash et activatedAt d'un compte existant
// SANS mot de passe (comme /relectures/inscription) ; jamais de création ni
// de suppression, aucun changement de schéma.

// { etat: "valable" | "dejaActive" | "invalide", id? }
export async function etatDuLienActivation(valeur) {
  const jeton = analyserJeton(valeur);
  if (!jeton) return { etat: "invalide" };
  const compte = await prisma.adherent.findUnique({
    where: { id: jeton.id },
    select: { id: true, email: true, motDePasseHash: true },
  });
  if (!compte) return { etat: "invalide" };
  const ok = jetonActivationValide({
    secret: process.env.AUTH_SECRET,
    valeur,
    adherentId: compte.id,
    email: compte.email,
  });
  if (!ok) return { etat: "invalide" };
  return { etat: compte.motDePasseHash ? "dejaActive" : "valable", id: compte.id };
}

// Pose le mot de passe du compte du lien. Renvoie l'id du compte, ou null
// (lien invalide, expiré, ou compte déjà activé). La condition « pas encore de
// mot de passe » est dans la requête elle-même : deux envois simultanés du
// même lien ne peuvent pas réussir tous les deux.
export async function activerCompte(valeur, motDePasse) {
  const { etat, id } = await etatDuLienActivation(valeur);
  if (etat !== "valable") return null;
  const motDePasseHash = await hashPassword(motDePasse);
  const { count } = await prisma.adherent.updateMany({
    where: { id, motDePasseHash: null },
    data: { motDePasseHash, activatedAt: new Date() },
  });
  if (count !== 1) return null;
  console.log(`[club] compte activé par le lien du mail de bienvenue (adhérent n°${id})`);
  return id;
}
