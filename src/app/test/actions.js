"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isEditor } from "@/lib/test-auth";
import {
  EDIT_COOKIE_NAME,
  EDIT_SESSION_MS,
  codeUtilisable,
  codesIdentiques,
  creerSession,
  secretUtilisable,
} from "@/lib/test-auth-core";
import { enregistrerTexteCore } from "@/lib/test-enregistrer";
import { corrigerCoquilleCore, dossiersDeLaFiche } from "@/lib/test-corriger";
import { getHorsSeries } from "@/lib/hors-series";
import { fusionnerRevisionCore, publierBrouillonCore } from "@/lib/test-publier";
import { mettreALaCorbeilleCore, restaurerDepuisCorbeilleCore } from "@/lib/test-corbeille";
import { fusionnerRevision, verifierRevisionFusionnable } from "@/lib/github";

// Actions serveur de /test. Rappel : un fichier "use server" n'exporte que des
// fonctions asynchrones, et chacune est appelable depuis n'importe quel client :
// c'est donc ELLES (pas les boutons) qui contrôlent l'accès.

// Les options du cookie doivent être identiques à la pose et à l'effacement.
function optionsCookie(maxAge) {
  return {
    httpOnly: true,
    sameSite: "strict",
    path: "/test",
    // En local (http), un cookie « secure » serait refusé par le navigateur.
    secure: process.env.NODE_ENV === "production",
    maxAge,
  };
}

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Saisie du code d'édition. En cas d'échec, on attend ~1 s avant de répondre
// pour freiner les essais en rafale.
export async function deverrouiller(prevState, formData) {
  const attendu = process.env.TEST_EDIT_CODE;
  const secret = process.env.AUTH_SECRET;
  const saisi = formData?.get("code");

  const configure = codeUtilisable(attendu) && secretUtilisable(secret);
  // Toujours comparer (même non configuré) pour garder le même temps de réponse.
  const bon = codesIdentiques(typeof saisi === "string" ? saisi : "", configure ? attendu : "");

  if (!configure || !bon) {
    await pause(1000);
    return { ok: false, message: "Code incorrect." };
  }

  const valeur = creerSession({ secret, code: attendu });
  (await cookies()).set(EDIT_COOKIE_NAME, valeur, optionsCookie(EDIT_SESSION_MS / 1000));
  return { ok: true, message: "" };
}

export async function verrouiller() {
  // Efface le cookie (même chemin que celui posé, sinon le navigateur l'ignore).
  (await cookies()).set(EDIT_COOKIE_NAME, "", optionsCookie(0));
  return { ok: true, message: "" };
}

// Accès à GitHub pour les fiches issues d'une révision : vérification puis
// fusion de la PR « Révision <slug> » (voir src/lib/github.js).
const github = { verifier: verifierRevisionFusionnable, fusionner: fusionnerRevision };

// Publie un brouillon (voir src/lib/test-publier.js pour les règles).
export async function publierBrouillon(analyseId) {
  const resultat = await publierBrouillonCore(analyseId, {
    isEditor,
    prisma,
    dryRun: process.env.TEST_DRY_RUN === "1",
    github,
  });

  if (!resultat.ok) {
    if (resultat.message === "Non autorisé.") {
      console.warn(`[test] publication refusée (non autorisé) : analyse ${analyseId}`);
    }
    return resultat;
  }
  if (resultat.simulation) return resultat;

  // Ligne d'audit pour les logs Vercel.
  console.log(
    `[test] analyse #${resultat.analyseId} publiée (mesure #${resultat.propositionId}, ${resultat.candidatNom}) le ${resultat.publieLe}` +
      (resultat.revision ? ` ; révision « ${resultat.revision.slug} » ${resultat.revision.fusionnee ? "fusionnée" : "NON fusionnée"}` : ""),
  );

  // Les pages publiques mises en cache (ISR, 5 min) doivent voir la nouvelle
  // analyse tout de suite, en tête des dernières publications : accueil, listes,
  // page de la fiche et page du candidat.
  for (const chemin of [
    "/",
    "/declarations",
    `/declarations/${resultat.propositionId}`,
    "/candidats",
    `/candidats/${resultat.candidatId}`,
    "/themes",
  ]) {
    revalidatePath(chemin);
  }

  // Page de partage des publications X de la fiche (message de succès et lien
  // vers la fiche publique, voir /test/reseaux/[id]).
  resultat.lienReseaux = `/test/reseaux/${resultat.propositionId}?publiee=1`;

  // Fiche publiée mais PR non fusionnée : on reste sur la page pour afficher
  // l'avertissement et le bouton « Réessayer la fusion ».
  if (resultat.avertissement) return resultat;

  // redirect lève une exception : il doit rester hors de tout try/catch.
  redirect(resultat.lienReseaux);
}

// « Réessayer la fusion » de la PR de révision d'une fiche déjà publiée.
export async function reessayerFusion(analyseId) {
  const resultat = await fusionnerRevisionCore(analyseId, {
    isEditor,
    prisma,
    dryRun: process.env.TEST_DRY_RUN === "1",
    github,
  });
  if (!resultat.ok || resultat.simulation) return resultat;

  console.log(`[test] révision « ${resultat.revision.slug} » fusionnée (analyse #${resultat.analyseId}) le ${new Date().toISOString()}`);
  redirect(`/declarations/${resultat.propositionId}`);
}

// Enregistre le nouveau texte d'un champ d'un brouillon (titre, résumé…). Les
// règles (accès, champ autorisé, brouillon le plus récent, concurrence, simulation,
// transaction) sont dans src/lib/test-enregistrer.js.
export async function enregistrerTexte(entree) {
  const resultat = await enregistrerTexteCore(entree, {
    isEditor,
    prisma,
    dryRun: process.env.TEST_DRY_RUN === "1",
  });

  if (!resultat.ok) {
    if (resultat.message === "Non autorisé.") {
      console.warn("[test] modification de texte refusée (non autorisé)");
    }
    return resultat;
  }
  if (resultat.simulation) return resultat;

  // Ligne d'audit JSON pour les logs Vercel : l'ancien texte y est conservé,
  // pour le retrouver si besoin.
  console.log(
    JSON.stringify({
      evenement: "test_modification_texte",
      date: new Date().toISOString(),
      analyseId: resultat.analyseId,
      champ: resultat.champ,
      avant: resultat.avant,
      apres: resultat.apres,
    }),
  );

  revalidatePath("/test");
  revalidatePath(`/test/${resultat.propositionId}`);

  return { ok: true, versionSuivante: resultat.versionSuivante };
}

// Corrige une coquille d'une fiche DÉJÀ PUBLIÉE, sur place, sans nouvelle version
// (/test/publiees/[id]). Les règles (accès, fiche publiée, champs exclus, garde-fou
// « coquille », annotations du Club, concurrence, trace) sont dans
// src/lib/test-corriger.js.
export async function corrigerCoquille(entree) {
  const resultat = await corrigerCoquilleCore(entree, {
    isEditor,
    prisma,
    dryRun: process.env.TEST_DRY_RUN === "1",
  });

  if (!resultat.ok) {
    if (resultat.message === "Non autorisé.") {
      console.warn("[test] correction de coquille refusée (non autorisé)");
    }
    return resultat;
  }
  if (resultat.simulation) return resultat;

  // Ligne d'audit JSON pour les logs Vercel (la trace est aussi dans
  // contenuComplet.corrections_coquilles).
  console.log(
    JSON.stringify({
      evenement: "test_correction_coquille",
      date: new Date().toISOString(),
      analyseId: resultat.analyseId,
      champ: resultat.champ,
      avant: resultat.avant,
      apres: resultat.apres,
      annotationsDecrochees: resultat.annotationsDecrochees,
    }),
  );

  // La correction est en ligne : les pages publiques en cache doivent la voir.
  const chemins = [
    `/declarations/${resultat.propositionId}`,
    "/",
    "/declarations",
    "/test/publiees",
    `/test/publiees/${resultat.propositionId}`,
  ];
  if (resultat.candidatId) chemins.push(`/candidats/${resultat.candidatId}`);
  for (const slug of dossiersDeLaFiche(getHorsSeries(), resultat.propositionId)) {
    chemins.push(`/dossiers/${slug}`);
  }
  for (const chemin of chemins) revalidatePath(chemin);

  return { ok: true, versionSuivante: resultat.versionSuivante };
}

// Met un brouillon à la corbeille (statut "corbeille", rien n'est supprimé). Les
// règles sont dans src/lib/test-corbeille.js.
export async function mettreALaCorbeille(analyseId) {
  const resultat = await mettreALaCorbeilleCore(analyseId, {
    isEditor,
    prisma,
    dryRun: process.env.TEST_DRY_RUN === "1",
  });

  if (!resultat.ok) {
    if (resultat.message === "Non autorisé.") {
      console.warn(`[test] mise à la corbeille refusée (non autorisé) : analyse ${analyseId}`);
    }
    return resultat;
  }
  if (resultat.simulation) return resultat;

  // Ligne d'audit pour les logs Vercel.
  console.log(
    `[test] analyse #${resultat.analyseId} mise à la corbeille (mesure #${resultat.propositionId}) le ${new Date().toISOString()}`,
  );

  revalidatePath("/test");
  revalidatePath(`/test/${resultat.propositionId}`);

  return { ok: true };
}

// Remet un brouillon de la corbeille dans la liste (voir src/lib/test-corbeille.js).
export async function restaurerDepuisCorbeille(analyseId) {
  const resultat = await restaurerDepuisCorbeilleCore(analyseId, {
    isEditor,
    prisma,
    dryRun: process.env.TEST_DRY_RUN === "1",
  });

  if (!resultat.ok) {
    if (resultat.message === "Non autorisé.") {
      console.warn(`[test] restauration refusée (non autorisé) : analyse ${analyseId}`);
    }
    return resultat;
  }
  if (resultat.simulation) return resultat;

  // Ligne d'audit pour les logs Vercel.
  console.log(
    `[test] analyse #${resultat.analyseId} restaurée depuis la corbeille (mesure #${resultat.propositionId}) le ${new Date().toISOString()}`,
  );

  revalidatePath("/test");
  revalidatePath(`/test/${resultat.propositionId}`);

  return { ok: true };
}
