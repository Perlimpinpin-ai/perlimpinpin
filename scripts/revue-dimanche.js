// Revue du dimanche du Club Perlimpinpin (Club ouvert, lot 4).
//
//   node scripts/revue-dimanche.js --hebdo [--simulation] [--forcer] [--oui]
//   node scripts/revue-dimanche.js --fiche <id de la Proposition> [--simulation] [--oui]
//
// --hebdo : revue de la semaine. Lancé par le workflow GitHub
//   « Revue du dimanche » à 6 h ET 7 h UTC le dimanche : ne travaille que s'il
//   est 8 h à Paris (l'autre passage s'arrête aussitôt), sauf --forcer.
// --fiche : « Traiter maintenant » (page admin /test/revue) sur une seule fiche.
// --simulation : compte ce qui serait fait, sans aucun appel payant ni écriture.
// --oui : confirmation d'écriture en CI seulement (CI=true) ; sur l'ordinateur,
//   la base ciblée est affichée et il faut taper « oui ».
//
// Étapes :
//   1. Clôture : annotations des fiches publiées créées avant maintenant.
//   2. Tri (un lot de l'API Message Batches) : 4 catégories, raison, réponse
//      proposée → TriAnnotation (source « modele »).
//   3. Révision (un second lot) des fiches qui ont au moins une annotation
//      « argument_ou_source » en attente : 3 recherches web au plus.
//   4. Si une note change : Étapes 2 et 3 relancées (pipeline existant,
//      scripts/analyze.js, en mode lot si CLAUDE_LOT=1).
//   5. Score recalculé par le code (scripts/lib/scoring.js, calculerScore).
//   6. RevisionProposee : rien n'est publié. Arno valide sur /test/revue en
//      tapant « oui ».
//
// Écritures : create uniquement (RevueLot, RevueEtape, TriAnnotation,
// RevisionProposee), jamais de mise à jour ni d'upsert ; chaque création est
// journalisée dans logs/insertions.jsonl. Ni nom ni e-mail d'adhérent dans
// les journaux (le journal du workflow est public).
import "dotenv/config";
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { confirmerEcriture, estProduction, hoteDe } from "./lib/garde-fou-base.js";
import { attendreLot, lireResultats, soumettreLot, texteFinal } from "./lib/lot-multiple.js";
import {
  extraireJson,
  ficheRevisable,
  notesChangees,
  propositionSansEtapes,
  requeteRevision,
  requeteTri,
  resumeRevision,
  validerRevision,
} from "./lib/revue-revision.js";
import { appliquerScoreCode } from "./lib/scoring.js";
import { annotationsATrier, dernierTri, estHeureRevue, fichesAReviser, lireTri } from "../src/lib/revue-core.js";
import { PREFIXE_FICHE, slugFiche } from "../src/lib/fiche-annotations-core.js";

neonConfig.webSocketConstructor = ws;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const INSERTIONS_LOG_PATH = join(ROOT, "logs", "insertions.jsonl");
const CI = process.env.CI === "true";
const API = {
  baseUrl: "https://api.anthropic.com/v1",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": process.env.ANTHROPIC_API_KEY,
    "anthropic-version": "2023-06-01",
  },
};
const USAGE = "Usage : node scripts/revue-dimanche.js (--hebdo [--forcer] | --fiche <id>) [--simulation] [--oui]";

function fail(message) {
  console.error(`Erreur : ${message}\n${USAGE}`);
  process.exit(1);
}

function journal(entree) {
  mkdirSync(dirname(INSERTIONS_LOG_PATH), { recursive: true });
  appendFileSync(INSERTIONS_LOG_PATH, `${JSON.stringify({ timestamp: new Date().toISOString(), source: "revue-dimanche", ...entree })}\n`);
}

const { values } = parseArgs({
  options: {
    hebdo: { type: "boolean", default: false },
    fiche: { type: "string" },
    simulation: { type: "boolean", default: false },
    forcer: { type: "boolean", default: false },
    oui: { type: "boolean", default: false },
  },
  strict: true,
});

if (values.hebdo === Boolean(values.fiche)) fail("choisissez --hebdo OU --fiche <id>.");
if (values.oui && !CI) fail("--oui n'est accepté qu'en intégration continue (CI=true). Sur l'ordinateur, tapez « oui » à la question.");
const propositionId = values.fiche ? Number(values.fiche) : null;
if (values.fiche && !/^[1-9]\d{0,9}$/.test(values.fiche)) fail("--fiche : identifiant de fiche invalide.");

const maintenant = new Date();
if (values.hebdo && !values.forcer && !estHeureRevue(maintenant)) {
  console.log("Il n'est pas 8 h à Paris ce dimanche : ce passage du workflow ne fait rien (l'autre s'en charge).");
  process.exit(0);
}

const host = hoteDe(process.env.DATABASE_URL);
if (!host) fail("DATABASE_URL illisible.");
if (!values.simulation && !process.env.ANTHROPIC_API_KEY) fail("ANTHROPIC_API_KEY absente.");
console.log(`Base : ${CI ? (estProduction(host) ? "production" : "copie / test") : host}`);
console.log(`Revue ${values.hebdo ? "hebdomadaire" : `de la fiche ${propositionId} (traiter maintenant)`}, clôture ${maintenant.toISOString()}`);

const consignesTri = readFileSync(join(ROOT, "data", "prompt-tri-annotations.md"), "utf8");
const consignesRevision = readFileSync(join(ROOT, "data", "prompt-revision-club.md"), "utf8");
const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }) });

// Dernière version publiée de chaque fiche demandée : Map propositionId → analyse.
async function versionsPubliees(ids) {
  const analyses = await prisma.analyse.findMany({
    where: { propositionId: { in: [...ids] }, statut: "publie" },
    orderBy: { createdAt: "desc" },
    select: { id: true, propositionId: true, contenuComplet: true, proposition: { select: { candidat: { select: { nom: true } } } } },
  });
  const parFiche = new Map();
  for (const a of analyses) if (!parFiche.has(a.propositionId)) parFiche.set(a.propositionId, a);
  return parFiche;
}

async function chargerAnnotations() {
  return prisma.relectureComment.findMany({
    where: {
      ficheSlug: propositionId ? slugFiche(propositionId) : { startsWith: PREFIXE_FICHE },
      createdAt: { lt: maintenant },
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      ficheSlug: true,
      sectionId: true,
      sectionLabel: true,
      quotedText: true,
      body: true,
      createdAt: true,
      tris: { select: { id: true, categorie: true, createdAt: true } },
    },
  });
}

// Annotations déjà réglées : prises en compte par une révision qu'Arno a
// publiée ou rejetée (lot 5 : archivage détaillé par version).
async function annotationsReglees(ids) {
  const revisions = await prisma.revisionProposee.findMany({
    where: { propositionId: { in: [...ids] }, decisions: { some: {} } },
    select: { commentIds: true },
  });
  return new Set(revisions.flatMap((r) => (Array.isArray(r.commentIds) ? r.commentIds : [])));
}

async function etape(revueLotId, nom, detail = null, batchId = null) {
  const cree = await prisma.revueEtape.create({ data: { revueLotId, etape: nom, detail, batchId } });
  journal({ type: "revue_etape", revueLotId, etapeId: cree.id, etape: nom });
  console.log(`· ${nom}${detail ? ` ${JSON.stringify(detail)}` : ""}`);
}

try {
  // --- 1. Clôture et sélection -------------------------------------------------
  let annotations = await chargerAnnotations();
  const aTrier = annotationsATrier(annotations, { cloture: maintenant, propositionId });
  const fichesConcernees = new Set(annotations.map((a) => Number(a.ficheSlug.slice(PREFIXE_FICHE.length))));
  const publiees = await versionsPubliees(fichesConcernees);
  console.log(`Annotations : ${annotations.length} sur ${fichesConcernees.size} fiche(s), dont ${aTrier.length} à trier.`);

  if (values.simulation) {
    const reglees = await annotationsReglees(fichesConcernees);
    const enAttente = fichesAReviser(annotations.filter((a) => !reglees.has(a.id)));
    console.log(`Simulation : ${aTrier.length} tri(s) et au moins ${enAttente.size} révision(s) déjà prévisibles. Rien n'a été envoyé ni écrit.`);
    process.exit(0);
  }
  if (aTrier.length === 0 && propositionId == null && annotations.every((a) => a.tris.length > 0)) {
    // Rien de nouveau : on vérifie quand même s'il reste des arguments en attente (reclassés par Arno).
    console.log("Aucune nouvelle annotation à trier.");
  }

  if (!values.oui && !(await confirmerEcriture({ host, question: "Lancer la revue (appels payants, écritures en base) ?" }))) {
    console.log("Annulé : rien n'a été envoyé ni écrit.");
    process.exit(0);
  }

  const lot = await prisma.revueLot.create({
    data: { type: propositionId ? "urgence" : "hebdo", propositionId, clotureAt: maintenant },
  });
  journal({ type: "revue_lot", revueLotId: lot.id, revue: lot.type, propositionId });
  console.log(`Passage de revue n° ${lot.id}`);

  // --- 2. Tri ---------------------------------------------------------------------
  if (aTrier.length > 0) {
    const requetes = aTrier.map((a) => ({
      custom_id: `tri-${a.id}`,
      params: requeteTri({
        annotation: a,
        contenu: publiees.get(Number(a.ficheSlug.slice(PREFIXE_FICHE.length)))?.contenuComplet ?? {},
        consignes: consignesTri,
      }),
    }));
    const batchId = await soumettreLot(requetes, API);
    await etape(lot.id, "tri_soumis", { annotations: requetes.length }, batchId);
    const resultats = await lireResultats(await attendreLot(batchId, API), API);
    let ok = 0;
    const echecs = [];
    for (const a of aTrier) {
      const r = resultats.get(`tri-${a.id}`);
      const lu = r?.ok ? lireTri(texteFinal(r.message)) : { error: r?.erreur ?? "absent du lot" };
      if (lu.error) {
        echecs.push({ commentId: a.id, erreur: lu.error });
        continue;
      }
      const tri = await prisma.triAnnotation.create({
        data: { commentId: a.id, ...lu.tri, source: "modele", revueLotId: lot.id },
      });
      journal({ type: "tri_annotation", triId: tri.id, commentId: a.id, categorie: tri.categorie, revueLotId: lot.id });
      ok += 1;
    }
    await etape(lot.id, "tri_recu", { tries: ok, echecs }, batchId);
  }

  // --- 3. Révision des fiches avec des arguments en attente --------------------
  annotations = await chargerAnnotations();
  const reglees = await annotationsReglees(fichesConcernees);
  const aReviser = fichesAReviser(annotations.filter((a) => !reglees.has(a.id)));
  const requetes = [];
  const contexte = new Map();
  for (const [fiche, args] of aReviser) {
    const source = publiees.get(fiche) ?? (await versionsPubliees([fiche])).get(fiche);
    if (!source) {
      await etape(lot.id, "fiche_non_publiee", { propositionId: fiche });
      continue;
    }
    if (!ficheRevisable(source.contenuComplet)) {
      await etape(lot.id, "revision_manuelle", { propositionId: fiche, raison: "fiche antérieure au barème 2026" });
      continue;
    }
    requetes.push({
      custom_id: `rev-${fiche}`,
      params: requeteRevision({ contenu: source.contenuComplet, annotations: args, consignes: consignesRevision }),
    });
    contexte.set(`rev-${fiche}`, { fiche, source, args });
  }

  if (requetes.length > 0) {
    const batchId = await soumettreLot(requetes, API);
    await etape(lot.id, "revision_soumise", { fiches: requetes.length }, batchId);
    const resultats = await lireResultats(await attendreLot(batchId, API), API);
    await etape(lot.id, "revision_recue", { fiches: resultats.size }, batchId);

    // Le pipeline existant n'est chargé que s'il sert (étapes 2 et 3).
    let runPipeline = null;
    for (const [customId, { fiche, source, args }] of contexte) {
      try {
        const r = resultats.get(customId);
        if (!r?.ok) throw new Error(r?.erreur ?? "absent du lot");
        if (r.message.stop_reason === "pause_turn") throw new Error("recherche interrompue (pause_turn)");
        const ids = args.map((a) => a.id);
        const verdict = validerRevision(extraireJson(texteFinal(r.message)), { commentaireIds: ids, contenuActuel: source.contenuComplet });
        if (!verdict.valid) throw new Error(`réponse invalide : ${verdict.errors.slice(0, 5).join(" ; ")}`);
        const revision = verdict.revision;
        let proposition = propositionSansEtapes(source.contenuComplet, revision);
        let reponses = revision.reponses;
        let coutPipeline = { revision: r.message.usage ?? null };

        // --- 4. Étapes 2 et 3 seulement si une note change -------------------
        if (proposition.criteresModifies.length > 0) {
          runPipeline ??= (await import("./analyze.js")).runPipeline;
          const commentaires = args.map((a) => ({ id: a.id, sectionLabel: a.sectionLabel ?? a.sectionId, body: a.body, quotedText: a.quotedText ?? null }));
          await etape(lot.id, "etapes_2_3", { propositionId: fiche });
          const resultat = await runPipeline(JSON.stringify(proposition.contenu), {
            commentaires,
            candidatNom: source.proposition?.candidat?.nom ?? null,
          });
          // --- 5. Score recalculé par le code ----------------------------------
          const notation = appliquerScoreCode(resultat.parsed.notation_detaillee);
          if (!notation) throw new Error("notation illisible après les étapes 2 et 3");
          const avant = source.contenuComplet.notation_detaillee;
          proposition = {
            contenu: { ...resultat.parsed, notation_detaillee: notation },
            criteresModifies: notesChangees(avant, notation),
            scoreAvant: avant.score_total,
            scoreApres: notation.score_total,
            etapes23: true,
          };
          if (resultat.revisionRelecture?.reponses?.length) reponses = resultat.revisionRelecture.reponses;
          coutPipeline = { ...coutPipeline, etapes23: resultat.coutPipeline };
        }

        // --- 6. Révision proposée (rien n'est publié) --------------------------
        const resume = {
          ...resumeRevision({ ...proposition, raison: revision.raison, raisonsModele: revision.criteresModifies }),
          reponses,
        };
        const cree = await prisma.revisionProposee.create({
          data: {
            revueLotId: lot.id,
            propositionId: fiche,
            analyseSourceId: source.id,
            contenuPropose: proposition.contenu,
            resume,
            commentIds: args.map((a) => a.id),
            etapes23: proposition.etapes23,
            coutPipeline,
          },
        });
        journal({ type: "revision_proposee", revisionId: cree.id, propositionId: fiche, analyseSourceId: source.id, revueLotId: lot.id });
        console.log(`  ✓ fiche ${fiche} : ${resume.scoreAvant} → ${resume.scoreApres}${proposition.etapes23 ? " (étapes 2 et 3 relancées)" : ""}`);
      } catch (error) {
        await etape(lot.id, "echec", { propositionId: fiche, erreur: String(error?.message ?? error).slice(0, 500) });
      }
    }
  }

  // Annotations dont le tri qui fait foi n'a encore aucune catégorie (échec de tri)
  const sansTri = annotations.filter((a) => !dernierTri(a.tris)).length;
  await etape(lot.id, "termine", { revisions: requetes.length, annotationsSansTri: sansTri });
  console.log("\nRevue terminée. Validation sur /test/revue (rien n'est publié sans « oui »).");
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
