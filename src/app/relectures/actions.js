"use server";

import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, normalizeEmail, passwordProblem, verifyPassword } from "@/lib/live-password";
import { secretUtilisable } from "@/lib/relecture-auth-core";
import { ouvrirSession } from "@/lib/relecture-auth";
import { changerMotDePasse, envoyerLienSiCompte } from "@/lib/mot-de-passe-oublie";

// Connexion et inscription de l'espace adhérents (/relectures). Session séparée
// de /live : cookie signé relecture_auth (voir src/lib/relecture-auth-core.js).

// Message unique pour « adresse inconnue » et « mauvais mot de passe » : on ne
// révèle jamais quelles adresses ont un compte.
const BAD_CREDENTIALS = "E-mail ou mot de passe incorrect.";
// Message unique pour « adresse hors liste » et « compte déjà activé ».
const INSCRIPTION_REFUSEE =
  "Cette adresse ne peut pas créer de compte. Si vous êtes adhérent, contactez perlimpinpin.admin@gmail.com.";
const INDISPONIBLE = "Connexion indisponible pour le moment. Réessayez plus tard.";

// L'adresse saisie est renvoyée avec l'erreur pour ne pas avoir à la retaper
function adresseSaisie(formData) {
  const valeur = formData.get("email");
  return typeof valeur === "string" ? valeur.slice(0, 254) : "";
}

export async function connexion(_previousState, formData) {
  const email = normalizeEmail(formData.get("email"));
  const password = formData.get("password");
  const typed = adresseSaisie(formData);
  if (!email || typeof password !== "string" || password.length === 0) {
    return { error: BAD_CREDENTIALS, email: typed };
  }
  if (!secretUtilisable(process.env.AUTH_SECRET)) {
    console.error("[relectures] AUTH_SECRET absent : connexion impossible.");
    return { error: INDISPONIBLE, email: typed };
  }

  let adherent;
  try {
    adherent = await prisma.adherent.findUnique({ where: { email }, select: { id: true, motDePasseHash: true } });
  } catch (error) {
    console.error("[relectures] connexion impossible :", error);
    return { error: INDISPONIBLE, email: typed };
  }

  // Compte inconnu ou pas encore activé : verifyPassword compare quand même à un
  // faux hachage (même temps de réponse) puis répond faux.
  if (!(await verifyPassword(password, adherent?.motDePasseHash ?? null))) {
    return { error: BAD_CREDENTIALS, email: typed };
  }

  await ouvrirSession(adherent.id);
  // Pas de redirect() : /relectures est un fichier statique, le client le charge
  // par une navigation complète (voir ConnexionForm).
  return { ok: true, redirectTo: "/relectures" };
}

export async function inscription(_previousState, formData) {
  const email = normalizeEmail(formData.get("email"));
  const password = formData.get("password");
  const confirmation = formData.get("confirmation");
  const typed = adresseSaisie(formData);

  if (!email) return { error: "Adresse e-mail invalide.", email: typed };
  const probleme = passwordProblem(password);
  if (probleme) return { error: probleme, email: typed };
  if (password !== confirmation) {
    return { error: "Les deux mots de passe ne correspondent pas.", email: typed };
  }
  if (!secretUtilisable(process.env.AUTH_SECRET)) {
    console.error("[relectures] AUTH_SECRET absent : inscription impossible.");
    return { error: INDISPONIBLE, email: typed };
  }

  // Hachage calculé AVANT de regarder la base : sinon une adresse de la liste
  // répondrait nettement plus lentement (bcrypt) qu'une adresse inconnue.
  const motDePasseHash = await hashPassword(password);

  let adherentId = null;
  try {
    const adherent = await prisma.adherent.findUnique({ where: { email }, select: { id: true } });
    if (adherent) {
      // Condition « pas encore de mot de passe » dans la requête elle-même : deux
      // inscriptions simultanées pour la même adresse ne peuvent pas réussir toutes les deux.
      const { count } = await prisma.adherent.updateMany({
        where: { id: adherent.id, motDePasseHash: null },
        data: { motDePasseHash, activatedAt: new Date() },
      });
      if (count === 1) adherentId = adherent.id;
    }
  } catch (error) {
    console.error("[relectures] inscription impossible :", error);
    return { error: INDISPONIBLE, email: typed };
  }

  if (!adherentId) return { error: INSCRIPTION_REFUSEE, refus: true, email: typed };

  await ouvrirSession(adherentId);
  return { ok: true, redirectTo: "/relectures" };
}

// « Mot de passe oublié » : la réponse est TOUJOURS la même (on ne révèle
// jamais quelles adresses ont un compte). La recherche du compte et l'envoi du
// mail se font après la réponse (after), pour que le délai soit le même aussi.
export async function demanderNouveauMotDePasse(_previousState, formData) {
  const email = normalizeEmail(formData.get("email"));
  const typed = adresseSaisie(formData);
  if (!email) return { error: "Adresse e-mail invalide.", email: typed };
  if (!secretUtilisable(process.env.AUTH_SECRET)) {
    console.error("[relectures] AUTH_SECRET absent : mot de passe oublié impossible.");
    return { error: INDISPONIBLE, email: typed };
  }
  after(() => envoyerLienSiCompte("relectures", email));
  return { ok: true, email: typed };
}

const LIEN_INVALIDE = "Ce lien n'est plus valable (expiré ou déjà utilisé). Demandez-en un nouveau.";

// Page « nouveau mot de passe » (lien reçu par e-mail). Une fois le mot de
// passe changé, le lien ne marche plus et l'adhérent est connecté.
export async function choisirNouveauMotDePasse(_previousState, formData) {
  const jeton = formData.get("jeton");
  const password = formData.get("password");
  const confirmation = formData.get("confirmation");

  const probleme = passwordProblem(password);
  if (probleme) return { error: probleme };
  if (password !== confirmation) return { error: "Les deux mots de passe ne correspondent pas." };
  if (!secretUtilisable(process.env.AUTH_SECRET)) {
    console.error("[relectures] AUTH_SECRET absent : changement de mot de passe impossible.");
    return { error: INDISPONIBLE };
  }

  let compte;
  try {
    compte = await changerMotDePasse("relectures", jeton, password);
  } catch (error) {
    console.error("[relectures] changement de mot de passe impossible :", error);
    return { error: INDISPONIBLE };
  }
  if (!compte) return { error: LIEN_INVALIDE, lienInvalide: true };

  await ouvrirSession(compte.id);
  return { ok: true, redirectTo: "/relectures" };
}
