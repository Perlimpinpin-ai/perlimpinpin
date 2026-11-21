import { analyseVisee } from "./reel-action-core.js";
import { construireMessageRecit, estimationCoutRecit } from "./recit-generation.js";
import { contenuAvecRecit } from "./recit.js";

// Logique du bouton « Générer le récit » / « Générer à nouveau » de
// /test/reseaux/<id>. Dépendances injectées (isEditor, prisma, generer,
// lirePrompt, sauvegarder) pour tester sans base ni appel payant
// (scripts/recit.test.js) ; branchées par src/app/test/reseaux/actions.js.

function verifierId(propositionId) {
  return Number.isInteger(propositionId) && propositionId > 0;
}

// Coût estimé avant confirmation, sans appel payant.
// Renvoie { ok, min, max, aDejaUnRecit } ou { ok: false, erreur }.
export async function estimerRecitCore(propositionId, { brouillon, isEditor, prisma, lirePrompt }) {
  if (!(await isEditor())) return { ok: false, erreur: "Mode édition requis : déverrouillez /test." };
  if (!verifierId(propositionId)) return { ok: false, erreur: "Fiche introuvable." };
  const cible = await analyseVisee(prisma, propositionId, { brouillon });
  if (!cible) return { ok: false, erreur: "Aucune analyse pour cette fiche." };
  const contenu = cible.analyse.contenuComplet ?? {};
  const { min, max } = estimationCoutRecit(construireMessageRecit(await lirePrompt(), contenu).length);
  return { ok: true, min, max, aDejaUnRecit: Boolean(contenu.reseaux_recit) };
}

// Génère et écrit le récit d'une fiche.
//  - réservé au mode édition ;
//  - dryRun (TEST_DRY_RUN=1, Preview) : aucun appel, rien n'est écrit ;
//  - sauvegarde de la ligne actuelle (sauvegarder → chemin, ou null si le
//    serveur n'a pas de disque inscriptible) avant l'écriture ;
//  - écriture ciblée : contenuComplet.reseaux_recit seulement (l'ancien récit
//    gardé dedans, sous `precedent`), refusée si la fiche a été modifiée
//    pendant la génération (updatedAt).
// Renvoie { ok: true, simulation?, message, cout?, avertissements?, sauvegarde? }
// ou { ok: false, erreur, cout? }.
export async function genererRecitPourFicheCore(propositionId, { brouillon, isEditor, prisma, dryRun, cleConfiguree, generer, sauvegarder }) {
  if (!(await isEditor())) return { ok: false, erreur: "Mode édition requis : déverrouillez /test." };
  if (!verifierId(propositionId)) return { ok: false, erreur: "Fiche introuvable." };
  const cible = await analyseVisee(prisma, propositionId, { brouillon });
  if (!cible) return { ok: false, erreur: "Aucune analyse pour cette fiche." };
  const { proposition, analyse } = cible;

  if (dryRun) {
    return { ok: true, simulation: true, message: "Mode simulation (TEST_DRY_RUN=1) : aucun appel à Claude, rien n’est écrit." };
  }
  if (!cleConfiguree) {
    return { ok: false, erreur: "ANTHROPIC_API_KEY n’est pas configurée sur ce serveur : génération impossible." };
  }

  const contenu = analyse.contenuComplet ?? {};
  const resultat = await generer(contenu, { candidatNom: proposition.candidat.nom, score: analyse.scoreFaisabilite, propositionId });
  const cout = resultat.cout;
  if (!resultat.recit) {
    const raisons = resultat.errors?.length ? resultat.errors.join(" ; ") : "raison inconnue";
    return { ok: false, erreur: `Récit refusé après deux essais, rien n’est écrit. ${raisons}`, cout };
  }

  let sauvegarde = null;
  try {
    sauvegarde = await sauvegarder({ analyse, contenu });
  } catch {
    sauvegarde = null;
  }

  const { count } = await prisma.analyse.updateMany({
    where: { id: analyse.id, updatedAt: analyse.updatedAt },
    data: { contenuComplet: contenuAvecRecit(contenu, resultat.recit) },
  });
  if (count !== 1) {
    return { ok: false, erreur: "La fiche a été modifiée pendant la génération : rien n’est écrit. Recommencez.", cout };
  }
  return {
    ok: true,
    message: contenu.reseaux_recit ? "Nouveau récit généré (l’ancien est gardé sous precedent)." : "Récit généré.",
    cout,
    avertissements: resultat.avertissements ?? [],
    sauvegarde,
  };
}
