// File d'attente des fiches d'étape 1 (table FicheEtape1, page /test/depot).
//
//   npm run file-attente                      traite toutes les fiches en attente
//   npm run file-attente -- --simulation      contrôles seulement, liste et coût estimé,
//                                             aucun appel payant, rien d'écrit
//   npm run file-attente -- --max 1           au plus 1 fiche
//   npm run file-attente -- --fiches a,b      seulement ces fiches
//   npm run file-attente -- --oui             sans question « oui » : UNIQUEMENT dans
//                                             GitHub Actions (workflow traiter-file-attente.yml,
//                                             lancé depuis /test/depot) ; refusé ailleurs
//   npm run file-attente:import -- <dossier>  met en file tous les .json du dossier
//                                             (après contrôle ; --simulation possible,
//                                             --par "Nom" pour « déposé par »)
//
// Traitement : voir scripts/lib/file-attente-traitement.js. Pour chaque fiche,
// scripts/analyze.js est lancé comme par le robot de révision (--auto
// --seuil-score 0 : création seule, en brouillon), mais SANS --commentaires et
// SANS --revision : ni commentaires du Club, ni PR revision/<slug>, ni archive
// /relectures. Le bloc `relecture` n'est pas envoyé aux modèles : il ne sert
// qu'à trouver le candidat, le thème et le texte de la mesure.
//
// Base : DATABASE_URL (le .env, ou la variable du terminal si elle est définie).
// Avant toute écriture, la base ciblée est affichée (PRODUCTION ou COPIE) et il
// faut taper « oui ».

import "dotenv/config";
import { appendFileSync, mkdirSync, readFileSync, readdirSync, existsSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { confirmerEcriture, hoteDe, avertissementBase } from "./lib/garde-fou-base.js";
import { coutMoyen, resumeTraitement, traiterFile } from "./lib/file-attente-traitement.js";
import { mettreEnFile, slugDuFichier } from "../src/lib/file-attente.js";
import { SITE_URL } from "./lib/revision-relecture.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DANS_GITHUB = process.env.GITHUB_ACTIONS === "true";

// Résumé du run GitHub (onglet Summary), en plus du journal.
function resumeGitHub(titre, texte) {
  if (!process.env.GITHUB_STEP_SUMMARY) return;
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## ${titre}\n\n\`\`\`text\n${String(texte).trim()}\n\`\`\`\n`);
}

async function connexion() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL absent (voir le .env).");
  const { PrismaClient } = await import("../src/generated/prisma/client.ts");
  const { PrismaNeon } = await import("@prisma/adapter-neon");
  const { neonConfig } = await import("@neondatabase/serverless");
  neonConfig.webSocketConstructor = (await import("ws")).default;
  return new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }) });
}

// analyze.js dans un processus séparé (comme scripts/reviser-relecture.js) : il
// garde ses propres garde-fous, son journal logs/insertions.jsonl et son coût.
function lancerAnalyze(fiche, params) {
  const dossier = path.join(ROOT, "tmp", `file-attente-${fiche.slug}`);
  mkdirSync(dossier, { recursive: true });
  const etape1 = path.join(dossier, "etape1.json");
  const resultat = path.join(dossier, "resultat.json");
  writeFileSync(etape1, `${JSON.stringify(params.analyse, null, 2)}\n`);
  if (existsSync(resultat)) writeFileSync(resultat, ""); // jamais le résultat d'un essai précédent
  const args = [
    "scripts/analyze.js", etape1,
    "--candidat", params.candidat, "--theme", params.theme, "--source", params.source,
    "--auto", "--seuil-score", "0",
    "--resultat", resultat,
  ];
  const r = spawnSync(process.execPath, args, { cwd: ROOT, stdio: "inherit" });
  if (r.status !== 0) throw new Error(`analyze.js a échoué (code ${r.status ?? r.error?.message}). Voir le journal ci-dessus.`);
  const texte = existsSync(resultat) ? readFileSync(resultat, "utf8") : "";
  if (!texte.trim()) throw new Error("analyze.js n'a pas produit de résultat.");
  return JSON.parse(texte);
}

async function coutEstime(db) {
  const analyses = await db.analyse.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { coutPipeline: true },
  });
  return coutMoyen(analyses.map((a) => a.coutPipeline?.coutEstimeTotal));
}

function afficherBase() {
  console.log("");
  for (const l of avertissementBase(hoteDe(process.env.DATABASE_URL))) console.log(l);
}

async function traiter(db, { simulation, fiches, max, oui = false }) {
  if (simulation) {
    afficherBase();
  } else {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY absent (voir le .env).");
    // Dans GitHub Actions, personne ne peut taper « oui » : le clic sur le bouton
    // de /test/depot (et le workflow) tient lieu de confirmation. La base reste affichée.
    const ok = oui ? (afficherBase(), true) : await confirmerEcriture({
      host: hoteDe(process.env.DATABASE_URL),
      question: "Lancer les étapes 2 et 3 (appels payants) et créer les brouillons sur cette base ?",
    });
    if (!ok) {
      console.log("Rien n'a été lancé.");
      return;
    }
  }
  const sortie = await traiterFile({ db, lancerPipeline: lancerAnalyze, simulation, fiches, max });
  const cout = simulation ? await coutEstime(db) : null;
  const resume = resumeTraitement(sortie, { simulation, coutEstime: cout, siteUrl: SITE_URL });
  console.log(resume);
  const erreurs = sortie.resultats.filter((r) => r.etat === "erreur").length;
  resumeGitHub(erreurs ? `✗ File d'attente : ${erreurs} fiche(s) en erreur` : "File d'attente", resume);
  // Run rouge sur GitHub si une fiche a échoué (le résumé dit laquelle).
  if (erreurs && DANS_GITHUB) process.exitCode = 1;
}

async function importer(db, dossier, { simulation, par }) {
  const chemin = path.resolve(dossier);
  if (!existsSync(chemin) || !statSync(chemin).isDirectory()) throw new Error(`Dossier introuvable : ${chemin}`);
  const fichiers = readdirSync(chemin).filter((f) => /\.json$/i.test(f)).sort();
  if (!fichiers.length) {
    console.log(`Aucun fichier .json dans ${chemin}.`);
    return;
  }
  if (simulation) {
    afficherBase();
  } else {
    const ok = await confirmerEcriture({
      host: hoteDe(process.env.DATABASE_URL),
      question: `Mettre en file d'attente les fiches conformes parmi ${fichiers.length} fichier(s) ?`,
    });
    if (!ok) {
      console.log("Rien n'a été importé.");
      return;
    }
  }
  console.log("");
  let n = 0;
  for (const f of fichiers) {
    const slug = slugDuFichier(f);
    let json;
    try {
      json = JSON.parse(readFileSync(path.join(chemin, f), "utf8"));
    } catch (e) {
      console.log(`✗ ${f} : JSON invalide (${e.message}).`);
      continue;
    }
    const r = await mettreEnFile({ json, slug, source: "import", deposePar: par ?? null }, { prisma: db, dryRun: simulation });
    if (r.ok) {
      n++;
      console.log(`✓ ${f} : ${simulation ? "conforme" : r.remplace ? `remise en attente (n° ${r.id})` : `en file (n° ${r.id})`}.`);
    } else {
      console.log(`✗ ${f} :`);
      for (const e of r.erreurs) console.log(`    - ${e}`);
    }
  }
  console.log("");
  console.log(`${n}/${fichiers.length} fiche(s) ${simulation ? "conforme(s) (simulation : rien d'écrit)" : "mise(s) en file"}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let options;
  try {
    options = parseArgs({
      options: {
        simulation: { type: "boolean", default: false },
        fiches: { type: "string" },
        max: { type: "string" },
        import: { type: "boolean", default: false },
        par: { type: "string" },
        oui: { type: "boolean", default: false },
      },
      allowPositionals: true,
    });
  } catch (e) {
    console.error(`✗ ${e.message}`);
    process.exit(1);
  }
  const { values, positionals } = options;
  const max = values.max === undefined ? null : Number(values.max);
  if (max !== null && (!Number.isInteger(max) || max < 1)) {
    console.error("✗ --max attend un nombre entier ≥ 1.");
    process.exit(1);
  }
  const fiches = values.fiches ? values.fiches.split(",").map((s) => s.trim()).filter(Boolean) : null;
  if (values.oui && (!DANS_GITHUB || values.import)) {
    console.error("✗ --oui n'est accepté que dans GitHub Actions, pour le traitement de la file (pas pour --import).");
    process.exit(1);
  }
  if (values.import && !positionals[0]) {
    console.error("✗ Usage : npm run file-attente:import -- <dossier> [--simulation] [--par \"Nom\"]");
    process.exit(1);
  }

  let db;
  try {
    db = await connexion();
    if (values.import) await importer(db, positionals[0], values);
    else await traiter(db, { simulation: values.simulation, fiches, max, oui: values.oui });
  } catch (e) {
    console.error(`✗ ${e?.message ?? e}`);
    resumeGitHub("✗ File d'attente arrêtée", e?.message ?? e);
    process.exitCode = 1;
  } finally {
    await db?.$disconnect();
  }
}
