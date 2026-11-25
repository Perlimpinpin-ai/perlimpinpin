import { createHash, createHmac, timingSafeEqual } from "node:crypto";

// « Mot de passe oublié » de /relectures (adhérents) et de /live (équipe) :
// fonctions PURES (ni Next, ni cookies, ni base) pour pouvoir les tester avec
// `node --test` (scripts/mot-de-passe-oublie.test.js).
//
// Aucune table en base : le lien envoyé par e-mail contient un jeton signé
// HMAC-SHA256 avec AUTH_SECRET, sur le même modèle que les sessions de
// /relectures. La signature est liée au hachage ACTUEL du mot de passe : dès que
// le mot de passe change, tous les liens déjà envoyés deviennent invalides. Un
// lien ne sert donc qu'une fois, sans rien stocker.

export const DUREE_JETON_MS = 60 * 60 * 1000; // 1 heure

// Les deux espaces ont leurs propres comptes (Adherent / LiveUser) : un jeton
// émis pour l'un ne vaut jamais pour l'autre (le nom de l'espace est signé).
export const ESPACES = {
  relectures: {
    pageNouveauMotDePasse: "/relectures/nouveau-mot-de-passe",
    pageDemande: "/relectures/mot-de-passe-oublie",
  },
  live: {
    pageNouveauMotDePasse: "/live/login/nouveau-mot-de-passe",
    pageDemande: "/live/login/mot-de-passe-oublie",
  },
};

export function espaceValide(espace) {
  return Object.hasOwn(ESPACES, espace);
}

export function secretUtilisable(secret) {
  return typeof secret === "string" && secret.length > 0;
}

function idValide(id) {
  return Number.isSafeInteger(id) && id > 0;
}

function sha256Hex(texte) {
  return createHash("sha256").update(texte, "utf8").digest("hex");
}

// Préfixe « reinit| » : une signature de session (« relecture|… »,
// « test-edit|… ») ne peut jamais être rejouée comme jeton, et inversement.
function signature(secret, espace, id, expiration, motDePasseHash) {
  return createHmac("sha256", secret)
    .update(`reinit|${espace}|${id}|${expiration}|${sha256Hex(motDePasseHash)}`)
    .digest("base64url");
}

// Jeton « <id>.<expiration en ms>.<signature> », à mettre dans le lien.
// Exige un mot de passe existant : un compte jamais activé n'a pas de jeton
// (l'adhérent passe par /relectures/inscription).
export function creerJeton({ secret, espace, id, motDePasseHash, maintenant = Date.now() }) {
  if (!secretUtilisable(secret) || !espaceValide(espace) || !idValide(id)) {
    throw new Error("Jeton de réinitialisation : secret, espace ou identifiant invalide.");
  }
  if (typeof motDePasseHash !== "string" || motDePasseHash.length === 0) {
    throw new Error("Jeton de réinitialisation : compte sans mot de passe.");
  }
  const expiration = maintenant + DUREE_JETON_MS;
  return `${id}.${expiration}.${signature(secret, espace, id, expiration, motDePasseHash)}`;
}

// Première lecture, SANS secret ni base : { id, expiration, recue } si le jeton a
// la bonne forme, sinon null. Sert à savoir quel compte charger avant de
// vérifier la signature avec jetonValide().
export function analyserJeton(valeur) {
  if (typeof valeur !== "string" || valeur.length > 200) return null;
  const morceaux = valeur.split(".");
  if (morceaux.length !== 3) return null;
  const [texteId, texteExpiration, recue] = morceaux;
  if (!/^[1-9]\d{0,15}$/.test(texteId) || !/^\d{1,16}$/.test(texteExpiration)) return null;
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(recue)) return null;
  const id = Number(texteId);
  if (!idValide(id)) return null;
  return { id, expiration: Number(texteExpiration), recue };
}

// Vrai si le jeton (déjà analysé) est signé avec ce secret, pour cet espace et
// ce compte, avec le mot de passe ACTUEL du compte, et pas expiré.
// Fail closed : secret absent, compte sans mot de passe → faux.
export function jetonValide({ secret, espace, jeton, motDePasseHash, maintenant = Date.now() }) {
  if (!secretUtilisable(secret) || !espaceValide(espace) || !jeton) return false;
  if (typeof motDePasseHash !== "string" || motDePasseHash.length === 0) return false;
  if (!Number.isFinite(jeton.expiration) || jeton.expiration <= maintenant) return false;
  // Expiration trop lointaine : jamais émise par creerJeton (qui donne 1 h)
  if (jeton.expiration > maintenant + DUREE_JETON_MS) return false;

  const attendue = Buffer.from(signature(secret, espace, jeton.id, jeton.expiration, motDePasseHash));
  const recue = Buffer.from(jeton.recue);
  // timingSafeEqual exige des longueurs identiques (sinon il lève une erreur).
  if (attendue.length !== recue.length) return false;
  return timingSafeEqual(attendue, recue);
}

// Adresse du site à mettre dans les liens envoyés par e-mail. Jamais déduite de
// l'en-tête Host de la requête (qui peut être falsifié pour envoyer le lien vers
// un autre site) : uniquement des variables fixées par Vercel ou par nous.
//   - production Vercel → https://perlimpinpin.ai ;
//   - preview Vercel → l'URL de la branche (pour tester avant la mise en ligne) ;
//   - en local → SITE_URL_LOCAL ou http://localhost:3000.
export const URL_PRODUCTION = "https://perlimpinpin.ai";

export function urlSite(env = process.env) {
  if (env.VERCEL_ENV === "production") return URL_PRODUCTION;
  const hotePreview = env.VERCEL_BRANCH_URL || env.VERCEL_URL;
  if (env.VERCEL_ENV === "preview" && hotePreview) return `https://${hotePreview}`;
  if (env.VERCEL_ENV) return URL_PRODUCTION; // autre environnement Vercel : prudence
  return (env.SITE_URL_LOCAL || "http://localhost:3000").replace(/\/+$/, "");
}

// Lien complet de la page « nouveau mot de passe ».
export function lienNouveauMotDePasse({ espace, jeton, env = process.env }) {
  const url = new URL(ESPACES[espace].pageNouveauMotDePasse, urlSite(env));
  url.searchParams.set("jeton", jeton);
  return url.toString();
}

// En développement local seulement (npm run dev, hors Vercel) : si le mail ne
// peut pas partir (CLUB_SMTP_* absentes), le lien est affiché dans le terminal
// pour pouvoir tester le parcours. Jamais sur Vercel (ni preview, ni production).
export function lienAfficheEnLocal(env = process.env) {
  return !env.VERCEL_ENV && !env.VERCEL && env.NODE_ENV === "development";
}
