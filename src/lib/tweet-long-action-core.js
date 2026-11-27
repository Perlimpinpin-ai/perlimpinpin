import { analyseVisee } from "./reel-action-core.js";
import { construireMessageTweetLong, contenuAvecTweetLong, estimationCoutTweetLong, urlTweetLong } from "./tweet-long.js";

// Logique du bouton « Générer le tweet long » / « Régénérer » de la section 5
// de /test/reseaux/<id>. Dépendances injectées (isEditor, prisma, generer,
// lirePrompt, sauvegarder, introPrecedente) pour tester sans base ni appel
// payant (scripts/tweet-long.test.js) ; branchées par
// src/app/test/reseaux/actions.js.
//
// Écriture ciblée : contenuComplet.reseaux_tweet_long seulement, après une
// sauvegarde de la ligne, refusée si la fiche a été modifiée entre la
// lecture et l'écriture (updatedAt).

const MODE_EDITION = { ok: false, erreur: "Mode édition requis : déverrouillez /test." };

async function cibleFiche(propositionId, { brouillon, isEditor, prisma }) {
  if (!(await isEditor())) return { erreur: MODE_EDITION };
  if (!Number.isInteger(propositionId) || propositionId <= 0) return { erreur: { ok: false, erreur: "Fiche introuvable." } };
  const cible = await analyseVisee(prisma, propositionId, { brouillon });
  if (!cible) return { erreur: { ok: false, erreur: "Aucune analyse pour cette fiche." } };
  return cible;
}

// Coût estimé avant confirmation, sans appel payant.
export async function estimerTweetLongCore(propositionId, { brouillon, isEditor, prisma, lirePrompt }) {
  const fiche = await cibleFiche(propositionId, { brouillon, isEditor, prisma });
  if (fiche.erreur) return fiche.erreur;
  const contenu = fiche.analyse.contenuComplet ?? {};
  const publie = fiche.analyse.statut === "publie";
  const url = urlTweetLong({ propositionId, publie });
  const { min, max } = estimationCoutTweetLong(construireMessageTweetLong(await lirePrompt(), contenu, url).length);
  return { ok: true, min, max, publie, aDejaUnTweetLong: Boolean(contenu.reseaux_tweet_long) };
}

// Génère et écrit le tweet long d'une fiche.
//  - réservé au mode édition ; dryRun (TEST_DRY_RUN=1) : aucun appel, rien n'est écrit ;
//  - refusé après deux essais : rien n'est écrit, le message dit pourquoi ;
//  - sauvegarde de la ligne actuelle avant l'écriture.
// Renvoie { ok: true, simulation?, message, cout?, avertissements?, sauvegarde? }
// ou { ok: false, erreur, cout? }.
export async function genererTweetLongPourFicheCore(propositionId, { brouillon, isEditor, prisma, dryRun, cleConfiguree, generer, sauvegarder, introPrecedente = async () => "" }) {
  const fiche = await cibleFiche(propositionId, { brouillon, isEditor, prisma });
  if (fiche.erreur) return fiche.erreur;
  const { proposition, analyse } = fiche;
  if (dryRun) return { ok: true, simulation: true, message: "Mode simulation (TEST_DRY_RUN=1) : aucun appel à Claude, rien n’est écrit." };
  if (!cleConfiguree) return { ok: false, erreur: "ANTHROPIC_API_KEY n’est pas configurée sur ce serveur : génération impossible." };

  const contenu = analyse.contenuComplet ?? {};
  const resultat = await generer(contenu, {
    candidatNom: proposition.candidat.nom,
    score: analyse.scoreFaisabilite,
    propositionId,
    publie: analyse.statut === "publie",
    introPrecedente: (await introPrecedente()) ?? "",
  });
  const cout = resultat.cout;
  if (!resultat.tweetLong) {
    const raisons = resultat.errors?.length ? resultat.errors.join(" ; ") : "raison inconnue";
    return { ok: false, erreur: `Tweet long refusé après deux essais, rien n’est enregistré. ${raisons}`, cout };
  }

  let sauvegarde = null;
  try {
    sauvegarde = await sauvegarder({ analyse, contenu });
  } catch {
    sauvegarde = null;
  }
  const { count } = await prisma.analyse.updateMany({
    where: { id: analyse.id, updatedAt: analyse.updatedAt },
    data: { contenuComplet: contenuAvecTweetLong(contenu, resultat.tweetLong) },
  });
  if (count !== 1) return { ok: false, erreur: "La fiche a été modifiée pendant la génération : rien n’est écrit. Recommencez.", cout };
  return {
    ok: true,
    message: contenu.reseaux_tweet_long ? "Nouveau tweet long généré (il remplace le précédent)." : "Tweet long généré.",
    cout,
    avertissements: resultat.avertissements ?? [],
    sauvegarde,
  };
}
