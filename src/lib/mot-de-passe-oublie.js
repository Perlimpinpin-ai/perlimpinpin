import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/live-password";
import {
  analyserJeton,
  creerJeton,
  jetonValide,
  lienAfficheEnLocal,
  lienNouveauMotDePasse,
  urlSite,
} from "@/lib/mot-de-passe-oublie-core";
import { envoyerMailMotDePasse } from "@/lib/mail-mot-de-passe";

// « Mot de passe oublié », côté serveur : lecture des comptes en base et envoi
// du mail. Le cœur (jetons signés, URL du site) est dans mot-de-passe-oublie-core.js.
// Lecture et écriture : uniquement le champ motDePasseHash d'un compte existant
// (jamais de création, jamais de suppression, aucun changement de schéma).

// Table de comptes de chaque espace.
function table(espace) {
  if (espace === "relectures") return prisma.adherent;
  if (espace === "live") return prisma.liveUser;
  throw new Error(`Espace inconnu : ${espace}`);
}

const REF = { relectures: "adhérent", live: "compte live" };

// Envoie le mail ; en local sans SMTP, affiche le lien dans le terminal.
async function envoyer(params) {
  const { statut } = await envoyerMailMotDePasse(params);
  if (statut === "non-configure" && lienAfficheEnLocal()) {
    console.log(`[${params.espace}] (local, SMTP non configuré) lien à ouvrir : ${params.lien}`);
  }
}

// Envoie le lien à cette adresse si un compte existe, sinon ne fait rien. À
// appeler APRÈS la réponse (after() de next/server) : la page répond toujours
// pareil et dans le même délai, qu'il existe un compte ou non.
export async function envoyerLienSiCompte(espace, email) {
  try {
    const compte = await table(espace).findUnique({
      where: { email },
      select: { id: true, email: true, nom: true, motDePasseHash: true },
    });
    if (!compte) return; // adresse inconnue : aucun mail, aucune trace de l'adresse

    const ref = `${REF[espace]} n°${compte.id}`;

    // Adhérent jamais activé : rien à réinitialiser, on l'envoie créer son mot de passe
    if (!compte.motDePasseHash) {
      if (espace !== "relectures") return;
      const lien = new URL("/relectures/inscription", urlSite()).toString();
      await envoyer({ espace, type: "activation", email: compte.email, nom: compte.nom, lien, ref });
      return;
    }

    const jeton = creerJeton({
      secret: process.env.AUTH_SECRET,
      espace,
      id: compte.id,
      motDePasseHash: compte.motDePasseHash,
    });
    const lien = lienNouveauMotDePasse({ espace, jeton });
    await envoyer({ espace, email: compte.email, nom: compte.nom, lien, ref });
  } catch (error) {
    // Jamais l'adresse dans les journaux
    console.error(`[${espace}] mot de passe oublié : envoi impossible :`, error?.message ?? error);
  }
}

// Compte { id, email, motDePasseHash } si le lien est valable (bonne signature,
// pas expiré, mot de passe pas encore changé depuis), sinon null.
export async function compteDuLien(espace, valeurJeton) {
  const jeton = analyserJeton(valeurJeton);
  if (!jeton) return null;
  const compte = await table(espace).findUnique({
    where: { id: jeton.id },
    select: { id: true, email: true, motDePasseHash: true },
  });
  if (!compte) return null;
  const ok = jetonValide({ secret: process.env.AUTH_SECRET, espace, jeton, motDePasseHash: compte.motDePasseHash });
  return ok ? compte : null;
}

// Remplace le mot de passe du compte du lien. Renvoie le compte { id, email } ou
// null (lien invalide, expiré ou déjà utilisé). La condition « même hachage
// qu'au moment de la vérification » est dans la requête elle-même : deux envois
// simultanés du même lien ne peuvent pas réussir tous les deux.
export async function changerMotDePasse(espace, valeurJeton, nouveauMotDePasse) {
  const compte = await compteDuLien(espace, valeurJeton);
  if (!compte) return null;
  const motDePasseHash = await hashPassword(nouveauMotDePasse);
  const { count } = await table(espace).updateMany({
    where: { id: compte.id, motDePasseHash: compte.motDePasseHash },
    data: { motDePasseHash },
  });
  if (count !== 1) return null;
  console.log(`[${espace}] mot de passe changé par lien (${REF[espace]} n°${compte.id})`);
  return { id: compte.id, email: compte.email };
}
