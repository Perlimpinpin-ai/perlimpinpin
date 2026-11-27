// Nouvelle version d'une fiche DÉJÀ PUBLIÉE quand le candidat a modifié sa
// mesure (voir src/lib/nouvelle-version-core.js). Même adresse, ancienne
// version gardée dans l'historique, mention publique en haut de la fiche.
//
// Trois temps, chacun lancé à la main :
//
//   1. Simulation (par défaut) : aucune écriture, aucun appel payant.
//      node scripts/nouvelle-version-fiche.js --fiche 50 --etape1 <fichier.json> \
//        --motif-public "…" --raison "…"
//      Lit la fiche en base, valide le fichier d'étape 1 (validateEtape1Structure),
//      calcule le score par le code et affiche ce qui serait produit et écrit.
//
//   2. --lancer : sauvegarde de la fiche dans logs/sauvegardes/, puis étapes 2,
//      3, 3 bis et 3 ter (scripts/analyze.js, runPipeline, SANS commentaires du
//      Club : les blocs « commentaires » sont retirés des prompts), score
//      recalculé par le code. Résultat écrit dans logs/nouvelles-versions/ :
//      AUCUNE écriture en base. Appels payants : il faut taper « oui » (ou --oui).
//
//   3. --ecrire <résultat.json> : nouvelle sauvegarde, puis création de la
//      nouvelle Analyse en BROUILLON sur la même Proposition (une seule écriture,
//      create). La version en ligne ne bouge pas : la publication se fait sur
//      /test/<id> (bouton « Publier », src/lib/test-publier.js). Il faut taper
//      « oui » (ou --oui).
//
// Le fichier d'étape 1 n'est jamais modifié. Son bloc « relecture » donne la
// mesure initiale (relecture.mesure_initiale) et le titre (relecture.titre, à
// défaut le titre_fiche de l'étape 3) ; il n'est pas envoyé aux modèles.
import "dotenv/config";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { confirmerEcriture, estProduction, hoteDe } from "./lib/garde-fou-base.js";
import { appliquerScoreCode, calculerScore, validateEtape1Structure } from "./lib/scoring.js";
import { CLE_CHANGEMENT, construireChangementVersion, lireChangementVersion } from "../src/lib/nouvelle-version-core.js";
import { donneesNouvelleVersion } from "../src/lib/revue-core.js";
import { slugFiche } from "../src/lib/fiche-annotations-core.js";

neonConfig.webSocketConstructor = ws;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DOSSIER_SAUVEGARDES = join(ROOT, "logs", "sauvegardes");
const DOSSIER_RESULTATS = join(ROOT, "logs", "nouvelles-versions");
const INSERTIONS_LOG_PATH = join(ROOT, "logs", "insertions.jsonl");

const { values } = parseArgs({
  options: {
    fiche: { type: "string" },
    etape1: { type: "string" },
    "motif-public": { type: "string" },
    raison: { type: "string" },
    lancer: { type: "boolean", default: false },
    ecrire: { type: "string" },
    oui: { type: "boolean", default: false },
  },
});

const horodatage = () => new Date().toISOString().replace(/[:.]/g, "-");
const arreter = (message) => {
  console.error(`\n✗ ${message}`);
  process.exit(1);
};

const propositionId = Number(values.fiche);
if (!Number.isInteger(propositionId) || propositionId <= 0) arreter("--fiche <id de la Proposition> obligatoire.");

const url = process.env.DATABASE_URL;
const host = hoteDe(url);
if (!host) arreter("DATABASE_URL absente ou illisible.");
const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: url }) });

// --- Lectures --------------------------------------------------------------------

async function lireFiche() {
  const proposition = await prisma.proposition.findUnique({
    where: { id: propositionId },
    select: { id: true, titre: true, slug: true, texteOriginal: true, candidat: { select: { id: true, nom: true } } },
  });
  if (!proposition) arreter(`Proposition ${propositionId} introuvable.`);
  const publiees = await prisma.analyse.findMany({ where: { propositionId, statut: "publie" } });
  if (publiees.length !== 1) arreter(`La fiche ${propositionId} doit avoir exactement une version publiée (trouvé : ${publiees.length}).`);
  const brouillons = await prisma.analyse.count({ where: { propositionId, statut: "brouillon" } });
  if (brouillons > 0) arreter(`La fiche ${propositionId} a déjà ${brouillons} brouillon(s) : à régler sur /test avant d'en créer un autre.`);
  return { proposition, source: publiees[0] };
}

// Sauvegarde complète de la fiche (lecture seule) avant tout appel payant ou écriture.
async function sauvegarder(moment) {
  const [proposition, analyses, revisions, annotations, candidat] = await Promise.all([
    prisma.proposition.findUnique({ where: { id: propositionId } }),
    prisma.analyse.findMany({ where: { propositionId }, orderBy: { id: "asc" } }),
    prisma.revisionProposee.findMany({ where: { propositionId }, include: { decisions: true } }),
    prisma.relectureComment.findMany({ where: { ficheSlug: slugFiche(propositionId) }, include: { traitements: true } }),
    prisma.proposition.findUnique({ where: { id: propositionId }, select: { candidat: true } }),
  ]);
  mkdirSync(DOSSIER_SAUVEGARDES, { recursive: true });
  const chemin = join(DOSSIER_SAUVEGARDES, `fiche-${propositionId}-avant-${moment}-${horodatage()}.json`);
  writeFileSync(
    chemin,
    JSON.stringify({ sauvegardeLe: new Date().toISOString(), base: host, proposition, analyses, revisions, annotations, candidat: candidat?.candidat }, null, 2),
  );
  console.log(`✓ Sauvegarde : ${chemin} (${analyses.length} analyse(s), ${revisions.length} révision(s), ${annotations.length} annotation(s))`);
  return chemin;
}

function lireEtape1(chemin) {
  if (!chemin) arreter("--etape1 <fichier.json> obligatoire.");
  const absolu = resolve(chemin);
  if (!existsSync(absolu)) arreter(`Fichier introuvable : ${absolu}`);
  let json;
  try {
    json = JSON.parse(readFileSync(absolu, "utf8"));
  } catch (error) {
    arreter(`JSON illisible : ${error.message}`);
  }
  const { relecture, ...analyse } = json;
  const verdict = validateEtape1Structure(analyse);
  if (!verdict.valid) {
    arreter(`Le fichier ne passe pas validateEtape1Structure :\n  - ${verdict.errors.join("\n  - ")}`);
  }
  if (typeof relecture?.mesure_initiale !== "string" || !relecture.mesure_initiale.trim()) {
    arreter("Bloc relecture.mesure_initiale manquant : la mesure initiale de la nouvelle version est obligatoire.");
  }
  return { absolu, analyse, relecture };
}

function textesObligatoires() {
  const motif = values["motif-public"]?.trim();
  const raison = values.raison?.trim();
  if (!motif) arreter('--motif-public "…" obligatoire (phrase affichée à tous en haut de la fiche).');
  if (!raison) arreter('--raison "…" obligatoire (phrase de l\'historique des versions).');
  return { motif, raison };
}

async function confirmer(question) {
  if (values.oui) {
    console.log(`\n${estProduction(host) ? "⚠  PRODUCTION" : "COPIE / TEST"} : ${host} (confirmé par --oui)`);
    return true;
  }
  return confirmerEcriture({ host, question });
}

function afficherChangement(cv) {
  console.log(`  Remplacera l'analyse n° ${cv.analyse_precedente_id} (${cv.score_avant}/100) → ${cv.score_apres}/100`);
  console.log(`  Titre : « ${cv.titre_avant} » → « ${cv.titre} »`);
  console.log(`  Mesure initiale (nouvelle) : ${cv.mesure_initiale}`);
  console.log(`  Mention publique : ${cv.motif_public}`);
  console.log(`  Raison (historique) : ${cv.raison}`);
  console.log(
    `  Critères modifiés : ${cv.criteres_modifies.length === 0 ? "aucun" : cv.criteres_modifies.map((c) => `${c.critere} ${c.ancienneNote} → ${c.nouvelleNote}`).join(", ")}`,
  );
}

// --- 3. Écriture du brouillon ----------------------------------------------------

async function ecrire() {
  const chemin = resolve(values.ecrire);
  if (!existsSync(chemin)) arreter(`Résultat introuvable : ${chemin}`);
  const resultat = JSON.parse(readFileSync(chemin, "utf8"));
  if (resultat.propositionId !== propositionId) arreter(`Ce résultat concerne la fiche ${resultat.propositionId}, pas ${propositionId}.`);
  const { proposition, source } = await lireFiche();
  const cv = lireChangementVersion(resultat.donnees?.contenuComplet);
  if (!cv) arreter("Résultat sans bloc changement_version valide.");
  if (cv.analyse_precedente_id !== source.id) {
    arreter(`La version en ligne est maintenant l'analyse n° ${source.id}, pas la n° ${cv.analyse_precedente_id} : relance --lancer.`);
  }
  const donnees = { ...resultat.donnees, promptFileModifiedAt: resultat.donnees.promptFileModifiedAt ? new Date(resultat.donnees.promptFileModifiedAt) : null };
  console.log(`\nÉcriture prévue : UNE nouvelle Analyse en brouillon sur la fiche ${propositionId} (${proposition.candidat.nom}), score ${donnees.scoreFaisabilite}/100.`);
  afficherChangement(cv);
  console.log("  Rien d'autre n'est écrit : la version en ligne, la Proposition et la moyenne du candidat ne changent qu'au clic « Publier » sur /test.");
  await sauvegarder("brouillon");
  if (!(await confirmer("Créer ce brouillon ?"))) {
    console.log("Annulé : rien n'a été écrit.");
    return;
  }
  const cree = await prisma.analyse.create({ data: donnees, select: { id: true, statut: true } });
  mkdirSync(dirname(INSERTIONS_LOG_PATH), { recursive: true });
  appendFileSync(
    INSERTIONS_LOG_PATH,
    `${JSON.stringify({ type: "nouvelle_version_brouillon", date: new Date().toISOString(), propositionId, analyseId: cree.id, remplacera: cv.analyse_precedente_id, scoreAvant: cv.score_avant, scoreApres: cv.score_apres })}\n`,
  );
  console.log(`\n✓ Brouillon créé : analyse n° ${cree.id} (statut ${cree.statut}).`);
  console.log(`  Aperçu : /test/${propositionId} — la version n° ${source.id} reste en ligne jusqu'au clic « Publier ».`);
}

// --- 1 et 2. Simulation puis lancement -------------------------------------------

async function preparer() {
  const { motif, raison } = textesObligatoires();
  const { absolu, analyse, relecture } = lireEtape1(values.etape1);
  const { proposition, source } = await lireFiche();
  if (relecture.candidat && relecture.candidat !== proposition.candidat.nom) {
    arreter(`relecture.candidat = « ${relecture.candidat} », mais la fiche ${propositionId} est celle de ${proposition.candidat.nom}.`);
  }
  const scoreEtape1 = calculerScore(analyse.notation_detaillee);
  if (!scoreEtape1) arreter("Notation de l'étape 1 illisible pour le calcul du score (ancien barème ?).");

  console.log(`Fiche ${propositionId} : « ${proposition.titre} » (${proposition.candidat.nom}), adresse /declarations/${proposition.slug ?? propositionId}`);
  console.log(`Version en ligne : analyse n° ${source.id}, ${source.scoreFaisabilite}/100`);
  console.log(`Fichier d'étape 1 : ${absolu} — structure valide`);
  console.log(`Score de l'étape 1 calculé par le code : ${scoreEtape1.score_total}/100 (score écrit dans le fichier : ${analyse.notation_detaillee.score_total}/100)`);
  console.log(`Titre : ${typeof relecture.titre === "string" && relecture.titre.trim() ? `« ${relecture.titre.trim()} » (relecture.titre)` : "titre_fiche de l'étape 3"}`);
  console.log(`Mesure initiale : ${relecture.mesure_initiale.trim()}`);
  console.log(`Mention publique : ${motif}`);
  console.log(`Raison (historique) : ${raison}`);

  if (!values.lancer) {
    const couts = await prisma.analyse.findMany({ orderBy: { id: "desc" }, take: 40, select: { coutPipeline: true } });
    const totaux = couts
      .map((c) => c.coutPipeline?.coutEstimeTotal)
      .filter((v) => typeof v === "number")
      .slice(0, 20);
    const moyenne = totaux.length ? totaux.reduce((a, b) => a + b, 0) / totaux.length : null;
    console.log(`\n[Simulation] Rien n'a été appelé ni écrit.`);
    console.log(`  --lancer : sauvegarde, puis étapes 2 (Mistral), 3, 3 bis et 3 ter (Claude), sans commentaires du Club.`);
    console.log(`  Coût estimé : ~${moyenne != null ? moyenne.toFixed(2) : "?"} $ (moyenne des ${totaux.length} dernières fiches).`);
    console.log(`  Le résultat sera écrit dans logs/nouvelles-versions/, sans aucune écriture en base.`);
    return;
  }

  await sauvegarder("pipeline");
  if (!(await confirmer("Lancer les étapes 2 à 3 ter (appels payants, aucune écriture en base) ?"))) {
    console.log("Annulé : rien n'a été appelé.");
    return;
  }

  const { runPipeline, getPromptFileModifiedAt, buildTeaser, buildResumeAccueil, truncateTitre } = await import("./analyze.js");
  // Le bloc relecture n'est pas envoyé aux modèles (comme la file d'attente).
  const resultat = await runPipeline(JSON.stringify(analyse), { commentaires: null, candidatNom: proposition.candidat.nom });

  // Score recalculé par le code, jamais celui du modèle.
  const notation = appliquerScoreCode(resultat.parsed.notation_detaillee);
  if (!notation) arreter("Notation illisible après l'étape 3.");
  if (notation.score_total !== resultat.parsed.notation_detaillee.score_total) {
    console.log(`  ⚠ Score du modèle ${resultat.parsed.notation_detaillee.score_total}/100 remplacé par le score du code ${notation.score_total}/100.`);
  }
  const titreRelecture = typeof relecture.titre === "string" && relecture.titre.trim() ? relecture.titre.trim() : null;
  const titre = truncateTitre(titreRelecture ?? resultat.parsed.titre_fiche ?? proposition.titre);
  if (titreRelecture && resultat.parsed.titre_fiche !== titreRelecture) {
    console.log(`  Titre de l'étape 3 « ${resultat.parsed.titre_fiche} » remplacé par celui de la fiche : « ${titreRelecture} ».`);
  }
  const changement = construireChangementVersion({
    precedente: source,
    proposition,
    notation,
    mesureInitiale: relecture.mesure_initiale,
    titre,
    raison,
    motifPublic: motif,
  });
  const contenu = {
    ...resultat.parsed,
    notation_detaillee: notation,
    ...(titreRelecture ? { titre_fiche: titreRelecture } : {}),
    [CLE_CHANGEMENT]: changement,
  };
  const donnees = {
    ...donneesNouvelleVersion(source, contenu, resultat.coutPipeline),
    statut: "brouillon",
    teaser: buildTeaser(contenu),
    resumeAccueil: buildResumeAccueil(contenu) ?? source.resumeAccueil,
    versionMethodologie: "1.0",
    promptFileModifiedAt: getPromptFileModifiedAt(),
    contreAvisMistral: resultat.contreAvisMistral,
    auditArbitrage: resultat.auditArbitrage,
  };

  mkdirSync(DOSSIER_RESULTATS, { recursive: true });
  const sortie = join(DOSSIER_RESULTATS, `fiche-${propositionId}-${horodatage()}.json`);
  writeFileSync(sortie, JSON.stringify({ propositionId, creeLe: new Date().toISOString(), etape1: absolu, donnees }, null, 2));
  console.log(`\n✓ Étapes 2 à 3 ter terminées. Coût estimé : ${resultat.coutPipeline?.coutEstimeTotal ?? "?"} $`);
  if (resultat.erreursVersionBasique?.length) console.log(`  ⚠ Version basique absente : ${resultat.erreursVersionBasique.join(" ; ")}`);
  if (resultat.erreursReseaux?.length) console.log(`  ⚠ Publications X absentes : ${resultat.erreursReseaux.join(" ; ")}`);
  afficherChangement(changement);
  console.log(`\nRésultat (aucune écriture en base) : ${sortie}`);
  console.log(`Étape suivante, après relecture : node scripts/nouvelle-version-fiche.js --fiche ${propositionId} --ecrire "${sortie}"`);
}

try {
  if (values.ecrire) await ecrire();
  else await preparer();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
