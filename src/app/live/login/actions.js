"use server";

import { cookies } from "next/headers";
import { after } from "next/server";
import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
import { postLoginPath } from "@/lib/live-redirect";
import { normalizeEmail, passwordProblem } from "@/lib/live-password";
import { changerMotDePasse, envoyerLienSiCompte } from "@/lib/mot-de-passe-oublie";
import { SCOPE_COOKIE_NAME } from "@/lib/live-scope";

// La portée des listes (« Mes analyses » / « Toutes ») est une préférence PAR PERSONNE :
// elle est remise à zéro à chaque connexion et déconnexion, pour qu'un journaliste qui
// se connecte sur le même navigateur retrouve toujours « Mes analyses » par défaut.
async function resetScopePreference() {
  (await cookies()).delete({ name: SCOPE_COOKIE_NAME, path: "/live" });
}

// Message unique pour « adresse inconnue » et « mauvais mot de passe » : on ne révèle
// jamais quelles adresses ont un compte.
const BAD_CREDENTIALS = "E-mail ou mot de passe incorrect.";

export async function login(_previousState, formData) {
  const email = normalizeEmail(formData.get("email"));
  const password = formData.get("password");
  // L'adresse saisie est renvoyée avec l'erreur pour ne pas avoir à la retaper
  const typed = typeof formData.get("email") === "string" ? formData.get("email").slice(0, 254) : "";
  if (!email || typeof password !== "string" || password.length === 0) {
    return { error: BAD_CREDENTIALS, email: typed };
  }

  try {
    // redirect: false : Auth.js pose le cookie de session et rend la main
    await signIn("credentials", { email, password, redirect: false });
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.type === "CredentialsSignin") return { error: BAD_CREDENTIALS, email: typed };
      console.error("[live] connexion impossible :", error);
      return { error: "Connexion indisponible pour le moment (accès /live non configuré côté serveur).", email: typed };
    }
    throw error;
  }

  await resetScopePreference();

  // Pas de redirect() ici : c'est le client qui charge la page suivante par une navigation
  // complète (voir LoginForm), pour ne dépendre ni du rechargement interne de la cible
  // par Next ni de la navigation RSC côté client. Destination revalidée ici (le champ du
  // formulaire peut avoir été modifié) : une page interne de /live, ou /live par défaut.
  return { ok: true, redirectTo: postLoginPath(formData.get("next")) };
}

// Déconnexion : supprime le cookie de session. Le client charge ensuite /live/login.
export async function logout() {
  await signOut({ redirect: false });
  await resetScopePreference();
  return { ok: true };
}

const INDISPONIBLE = "Service indisponible pour le moment (accès /live non configuré côté serveur).";

function authSecretPresent() {
  return typeof process.env.AUTH_SECRET === "string" && process.env.AUTH_SECRET.length > 0;
}

// « Mot de passe oublié » : la réponse est TOUJOURS la même (on ne révèle jamais
// quelles adresses ont un compte). La recherche du compte et l'envoi du mail se
// font après la réponse (after), pour que le délai soit le même aussi.
export async function demanderNouveauMotDePasse(_previousState, formData) {
  const email = normalizeEmail(formData.get("email"));
  const typed = typeof formData.get("email") === "string" ? formData.get("email").slice(0, 254) : "";
  if (!email) return { error: "Adresse e-mail invalide.", email: typed };
  if (!authSecretPresent()) {
    console.error("[live] AUTH_SECRET absent : mot de passe oublié impossible.");
    return { error: INDISPONIBLE, email: typed };
  }
  after(() => envoyerLienSiCompte("live", email));
  return { ok: true, email: typed };
}

const LIEN_INVALIDE = "Ce lien n'est plus valable (expiré ou déjà utilisé). Demandez-en un nouveau.";

// Page « nouveau mot de passe » (lien reçu par e-mail). Une fois le mot de passe
// changé, le lien ne marche plus et la personne est connectée.
export async function choisirNouveauMotDePasse(_previousState, formData) {
  const jeton = formData.get("jeton");
  const password = formData.get("password");
  const confirmation = formData.get("confirmation");

  const probleme = passwordProblem(password);
  if (probleme) return { error: probleme };
  if (password !== confirmation) return { error: "Les deux mots de passe ne correspondent pas." };
  if (!authSecretPresent()) {
    console.error("[live] AUTH_SECRET absent : changement de mot de passe impossible.");
    return { error: INDISPONIBLE };
  }

  let compte;
  try {
    compte = await changerMotDePasse("live", jeton, password);
  } catch (error) {
    console.error("[live] changement de mot de passe impossible :", error);
    return { error: INDISPONIBLE };
  }
  if (!compte) return { error: LIEN_INVALIDE, lienInvalide: true };

  // Connexion directe avec le nouveau mot de passe. En cas d'échec, le mot de
  // passe est tout de même changé : on renvoie vers la page de connexion.
  try {
    await signIn("credentials", { email: compte.email, password, redirect: false });
    await resetScopePreference();
    return { ok: true, redirectTo: "/live" };
  } catch (error) {
    if (!(error instanceof AuthError)) throw error;
    console.error("[live] connexion après changement de mot de passe impossible :", error);
    return { ok: true, redirectTo: "/live/login" };
  }
}
