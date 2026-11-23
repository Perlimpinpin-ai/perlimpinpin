import { construireMessageReel, contenuAvecReel, coutClaude, estimationCoutReel, precedentsPourFiche } from "./reel-generation.js";

// Logique du bouton « Générer le Reel » / « Générer à nouveau » de /test/reels.
// Dépendances injectées (isEditor, prisma, generer, lirePrompt) pour pouvoir
// tester sans base ni appel payant (scripts/reel-action.test.js) ; branchées
// par src/app/test/reels/actions.js.

// Les n derniers Reels générés, toutes fiches confondues (le plus récent
// d'abord), pour varier les phrases d'un Reel à l'autre. Lecture seule ;
// Postgres ne renvoie que la clé reel.
export async function derniersReels(prisma, n = 3) {
  const lignes = await prisma.$queryRaw`
    SELECT "contenuComplet"->'reel' AS reel FROM "Analyse"
    WHERE jsonb_exists("contenuComplet", 'reel')
    ORDER BY "contenuComplet"->'reel'->>'genereLe' DESC NULLS LAST
    LIMIT ${n}
  `;
  return lignes.map((ligne) => ligne.reel).filter(Boolean);
}

// Analyse visée : avec brouillon, le dernier brouillon ; sinon la dernière
// publiée, à défaut le dernier brouillon. Même règle que /test/reels/<id>.
export async function analyseVisee(prisma, propositionId, { brouillon = false } = {}) {
  const proposition = await prisma.proposition.findUnique({
    where: { id: propositionId },
    select: {
      id: true,
      theme: true,
      candidat: { select: { nom: true } },
      analyses: {
        ...(brouillon ? { where: { statut: "brouillon" } } : {}),
        orderBy: { createdAt: "desc" },
        select: { id: true, statut: true, scoreFaisabilite: true, updatedAt: true, contenuComplet: true },
      },
    },
  });
  const analyses = proposition?.analyses ?? [];
  const analyse = analyses.find((a) => a.statut === "publie") ?? analyses.find((a) => a.statut === "brouillon");
  return analyse ? { proposition, analyse } : null;
}

function verifierId(propositionId) {
  return Number.isInteger(propositionId) && propositionId > 0;
}

// Coût estimé avant confirmation, sans appel payant.
// Renvoie { ok, min, max, aDejaUnReel } ou { ok: false, erreur }.
export async function estimerReelCore(propositionId, { brouillon, isEditor, prisma, lirePrompt, precedents = null }) {
  if (!(await isEditor())) return { ok: false, erreur: "Mode édition requis : déverrouillez /test." };
  if (!verifierId(propositionId)) return { ok: false, erreur: "Fiche introuvable." };
  const cible = await analyseVisee(prisma, propositionId, { brouillon });
  if (!cible) return { ok: false, erreur: "Aucune analyse pour cette fiche." };
  const contenu = cible.analyse.contenuComplet ?? {};
  const liste = precedents ?? precedentsPourFiche(contenu.reel, await derniersReels(prisma));
  const message = construireMessageReel(await lirePrompt(), contenu, liste);
  const { min, max } = estimationCoutReel(message.length);
  return { ok: true, min, max, aDejaUnReel: Boolean(cible.analyse.contenuComplet?.reel) };
}

// Génère et écrit le Reel d'une fiche.
//  - réservé au mode édition ;
//  - dryRun (TEST_DRY_RUN=1, Preview) : aucun appel, rien n'est écrit ;
//  - écriture ciblée : contenuComplet.reel (l'ancien gardé sous reelPrecedent),
//    refusée si la fiche a été modifiée pendant la génération (updatedAt).
// Renvoie { ok: true, simulation?, message, cout?, avertissements? } ou
// { ok: false, erreur, cout? }.
export async function genererReelPourFicheCore(propositionId, { brouillon, isEditor, prisma, dryRun, cleConfiguree, generer }) {
  if (!(await isEditor())) return { ok: false, erreur: "Mode édition requis : déverrouillez /test." };
  if (!verifierId(propositionId)) return { ok: false, erreur: "Fiche introuvable." };
  const cible = await analyseVisee(prisma, propositionId, { brouillon });
  if (!cible) return { ok: false, erreur: "Aucune analyse pour cette fiche." };
  const { proposition, analyse } = cible;

  if (dryRun) {
    return {
      ok: true,
      simulation: true,
      message: "Mode simulation (TEST_DRY_RUN=1) : aucun appel à Claude, rien n’est écrit.",
    };
  }
  if (!cleConfiguree) {
    return { ok: false, erreur: "ANTHROPIC_API_KEY n’est pas configurée sur ce serveur : génération impossible." };
  }

  const contenu = analyse.contenuComplet ?? {};
  // Générer à nouveau : l'ancien Reel de la fiche passe en premier (variantes,
  // question de couverture et variabilité mesurées face à lui).
  const precedents = precedentsPourFiche(contenu.reel, await derniersReels(prisma));
  const resultat = await generer(contenu, { candidatNom: proposition.candidat.nom, score: analyse.scoreFaisabilite, precedents });
  const cout = coutClaude(resultat.usage);
  if (!resultat.reel) {
    const raisons = resultat.errors?.length ? resultat.errors.join(" ; ") : "raison inconnue";
    return { ok: false, erreur: `Script refusé après deux essais, rien n’est écrit. ${raisons}`, cout };
  }

  const { count } = await prisma.analyse.updateMany({
    where: { id: analyse.id, updatedAt: analyse.updatedAt },
    data: { contenuComplet: contenuAvecReel(contenu, resultat.reel) },
  });
  if (count !== 1) {
    return { ok: false, erreur: "La fiche a été modifiée pendant la génération : rien n’est écrit. Recommencez.", cout };
  }
  return {
    ok: true,
    message: contenu.reel ? "Nouveau Reel généré (l’ancien est gardé sous reelPrecedent)." : "Reel généré.",
    cout,
    avertissements: resultat.avertissements ?? [],
  };
}

// --- Storyboard v4 (modes A et B) ------------------------------------------------
// Logique du bouton « Script Claude » (mode A) et du dépôt « Script et voix
// off de l'équipe » (mode B) de /test/reels/<id>. Mêmes garde-fous que la v3 :
// mode édition revérifié, TEST_DRY_RUN=1 sans appel ni écriture, écriture
// ciblée de contenuComplet.reel refusée si la fiche a bougé entre-temps.

export const SCRIPT_MAX = 20_000;

// Script et minutage déposés (mode B) → { script, minutage } ou { erreur }.
// `minutageBrut` : texte du fichier minutage.json (facultatif).
export function lireDepotEquipe({ script, minutageBrut }, lireMinutage) {
  const texte = String(script ?? "").replace(/\r\n/g, "\n").trim();
  if (!texte) return { erreur: "Script vide : collez le texte de la voix off ou déposez le fichier .txt." };
  if (texte.length > SCRIPT_MAX) return { erreur: `Script trop long (${texte.length} caractères, ${SCRIPT_MAX} au plus).` };
  if (!minutageBrut) return { script: texte, minutage: null };
  let json;
  try {
    json = JSON.parse(minutageBrut);
  } catch {
    return { erreur: "minutage.json illisible (JSON invalide)." };
  }
  const minutage = lireMinutage(json);
  if (minutage.erreur) return { erreur: minutage.erreur };
  return { script: texte, minutage: { ...json, mots: minutage.mots, ecarts: minutage.ecarts } };
}

export async function estimerStoryboardCore(propositionId, { mode, brouillon, isEditor, prisma, construireMessage, script = "" }) {
  if (!(await isEditor())) return { ok: false, erreur: "Mode édition requis : déverrouillez /test." };
  if (!verifierId(propositionId)) return { ok: false, erreur: "Fiche introuvable." };
  const cible = await analyseVisee(prisma, propositionId, { brouillon });
  if (!cible) return { ok: false, erreur: "Aucune analyse pour cette fiche." };
  const contenu = cible.analyse.contenuComplet ?? {};
  const message = await construireMessage({ mode, contenu, score: cible.analyse.scoreFaisabilite, script });
  const { min, max } = estimationCoutReel(message.length);
  return { ok: true, min, max, aDejaUnReel: Boolean(contenu.reel) };
}

// Génère et écrit le storyboard (mode A, ou mode B avec le dépôt de l'équipe).
//  - dryRun : aucun appel, rien n'est écrit. Mode B : le dépôt est quand même
//    contrôlé, contre la réponse simulée (`simuler`), pour montrer le contrôle
//    mot pour mot.
// Renvoie { ok, simulation?, message, lien?, cout?, erreurs?, avertissements? }.
export async function genererStoryboardPourFicheCore(
  propositionId,
  { mode, brouillon, isEditor, prisma, dryRun, cleConfiguree, generer, simuler, depot = null },
) {
  if (!(await isEditor())) return { ok: false, erreur: "Mode édition requis : déverrouillez /test." };
  if (!verifierId(propositionId)) return { ok: false, erreur: "Fiche introuvable." };
  if (!["A", "B"].includes(mode)) return { ok: false, erreur: "Mode inconnu." };
  if (mode === "B" && depot?.erreur) return { ok: false, erreur: depot.erreur };
  const cible = await analyseVisee(prisma, propositionId, { brouillon });
  if (!cible) return { ok: false, erreur: "Aucune analyse pour cette fiche." };
  const { proposition, analyse } = cible;
  const contenu = analyse.contenuComplet ?? {};

  if (dryRun) {
    const base = "Mode simulation (TEST_DRY_RUN=1) : aucun appel à Claude, rien n’est écrit.";
    if (mode === "A") return { ok: true, simulation: true, message: `${base} Storyboard simulé :`, lien: "?simulation=A" };
    const controle = simuler ? await simuler({ proposition, analyse, depot }) : null;
    if (!controle) return { ok: true, simulation: true, message: `${base} Pas de réponse simulée pour cette fiche.` };
    if (!controle.valide) return { ok: false, simulation: true, erreur: `Dépôt refusé (contrôle sur la réponse simulée) : ${controle.erreurs.join(" ; ")}` };
    return { ok: true, simulation: true, message: `${base} Dépôt accepté par le contrôle mot pour mot. Storyboard simulé :`, lien: "?simulation=B", avertissements: controle.avertissements };
  }
  if (!cleConfiguree) return { ok: false, erreur: "ANTHROPIC_API_KEY n’est pas configurée sur ce serveur : génération impossible." };

  const precedents = precedentsPourFiche(contenu.reel, await derniersReels(prisma));
  const resultat = await generer({ mode, contenu, candidatNom: proposition.candidat.nom, score: analyse.scoreFaisabilite, precedents, depot });
  const cout = coutClaude(resultat.usage);
  if (!resultat.reel) {
    return { ok: false, erreur: `Storyboard refusé après deux essais, rien n’est écrit. ${resultat.errors?.join(" ; ") || "raison inconnue"}`, cout };
  }
  const { count } = await prisma.analyse.updateMany({
    where: { id: analyse.id, updatedAt: analyse.updatedAt },
    data: { contenuComplet: contenuAvecReel(contenu, resultat.reel) },
  });
  if (count !== 1) return { ok: false, erreur: "La fiche a été modifiée pendant la génération : rien n’est écrit. Recommencez.", cout };
  return {
    ok: true,
    message: `Storyboard généré (mode ${mode})${contenu.reel ? ", l’ancien Reel est gardé sous reelPrecedent" : ""}.`,
    cout,
    avertissements: resultat.avertissements ?? [],
  };
}
