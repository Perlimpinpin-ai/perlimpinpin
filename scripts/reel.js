// Génère le script du Reel vidéo d'une fiche DÉJÀ PUBLIÉE (ou,
// avec --brouillon, de son dernier brouillon) et l'ajoute à son
// contenuComplet, sous la clé reel. Les 9 images sont ensuite dessinées à la
// demande par /test/reels/<id>/image (sans IA) et rassemblées sur /test/reels/<id>.
//
//   node scripts/reel.js <id> --simulation
//       → lit la fiche (lecture seule), affiche le coût estimé. AUCUN appel à
//         Claude, rien n'est écrit.
//   node scripts/reel.js <id>
//       → appelle Claude (mêmes contrôles que le bouton de /test/reels),
//         affiche le script, sauvegarde la ligne actuelle dans
//         logs/sauvegardes/, demande « oui », et écrit.
//   … --brouillon
//       → même chose sur le dernier brouillon de la fiche (pas encore publié).
//       Le Reel généré est aussi gardé dans logs/reels/ (ignoré par git).
//   … --depuis logs/reels/<fichier>.json
//       → écrit un Reel déjà généré et relu, sans nouvel appel : mêmes
//         contrôles sur la fiche actuelle, puis « oui » et écriture.
//
//   node scripts/reel.js --dernieres <n> [--simulation]
//       → lot : les n dernières fiches publiées qui n'ont pas encore de Reel.
//         D'abord, sans aucun appel à Claude : la liste (portraits manquants
//         signalés) et le coût estimé ; avec --simulation, on s'arrête là.
//         Sinon un seul « oui », puis fiche par fiche : génération,
//         sauvegarde, écriture. Une fiche en échec est sautée sans arrêter le
//         lot ; récapitulatif à la fin.
//
// <id> : le numéro de la fiche, celui de l'adresse /declarations/<id>.
// Écriture ciblée : seule la clé contenuComplet.reel est ajoutée (ou
// remplacée, en mode fiche seulement : le lot ne touche jamais une fiche qui
// en a déjà). Aucun score, aucun statut, aucune autre clé ne change. Refusée
// si la fiche a été modifiée entre la lecture et l'écriture.
// Le script utilise DATABASE_URL (.env, donc la production, sauf si
// DATABASE_URL est définie dans le terminal).
import "dotenv/config";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { avertissementBase, confirmerEcriture, hoteDe } from "./lib/garde-fou-base.js";
import { LOT_MAX } from "./lib/reseaux-lot.js";
import { choisirFichesReel, usageEstimeReel } from "./lib/reel-lot.js";
import { contenuAvecReel } from "../src/lib/reel-generation.js";
import { derniersReels } from "../src/lib/reel-action-core.js";
import { buildCoutPipeline, fichePourReel, genererReel, messageReel } from "./analyze.js";
import { controlerReel, formatDuree, reelPourStockage } from "../src/lib/reel.js";
import { slugCandidat } from "../src/lib/carte.js";

neonConfig.webSocketConstructor = ws;

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SAUVEGARDES_PATH = join(ROOT, "logs", "sauvegardes");
const INSERTIONS_LOG_PATH = join(ROOT, "logs", "insertions.jsonl");
const REELS_PATH = join(ROOT, "logs", "reels");
const USAGE =
  "Usage : node scripts/reel.js <id de la fiche (/declarations/<id>)> [--brouillon] [--simulation | --depuis <fichier>]\n" +
  "   ou : node scripts/reel.js --dernieres <n> [--simulation]";

function fail(message) {
  console.error(`Erreur : ${message}`);
  process.exit(1);
}

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    simulation: { type: "boolean", default: false },
    brouillon: { type: "boolean", default: false },
    dernieres: { type: "string" },
    depuis: { type: "string" },
  },
});
const simulation = values.simulation;
const enLot = values.dernieres !== undefined;
const taille = Number(values.dernieres);
if (enLot && (!Number.isInteger(taille) || taille < 1 || taille > LOT_MAX)) fail(`--dernieres attend un nombre entier de 1 à ${LOT_MAX}.\n${USAGE}`);
if (enLot && (positionals.length > 0 || values.brouillon)) fail(`--dernieres ne se combine ni avec un id ni avec --brouillon.\n${USAGE}`);
const propositionId = Number(positionals[0]);
if (!enLot && !Number.isInteger(propositionId)) fail(USAGE);
const STATUT = values.brouillon ? "brouillon" : "publie";
// La simulation ne fait aucun appel : la clé n'est exigée que pour générer.
if (enLot && values.depuis) fail(`--depuis ne se combine pas avec --dernieres.\n${USAGE}`);
if (!simulation && !values.depuis && !process.env.ANTHROPIC_API_KEY) fail("ANTHROPIC_API_KEY n'est pas défini (voir votre fichier .env).");

const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }) });

const coutDe = (usage) =>
  buildCoutPipeline({ usage2: null, usage3: {}, usage3bis: {}, usage3quater: usage }).coutEstimeParEtape.etape3quater;

// Coût estimé sans appel, à partir de la taille réelle du message.
function estimation(contenu, precedents = []) {
  const caracteres = messageReel(contenu, precedents).length;
  const { min, max } = usageEstimeReel(caracteres);
  return { caracteres, tokens: min.input_tokens, min: coutDe(min), max: coutDe(max) };
}

function portraitExiste(candidat) {
  return existsSync(join(ROOT, "public", "portraits-bleus", `${slugCandidat(candidat)}.png`));
}

function afficher(reel, avertissements) {
  console.log("\n=== Script pour ElevenLabs (un paragraphe par scène) ===\n");
  console.log(reel.texteVoix);
  console.log(`\n${reel.nbMots} mots, durée estimée ${formatDuree(reel.dureeEstimee)} (150 mots par minute).`);
  console.log("\n=== Texte à l'écran ===");
  for (const scene of reel.scenes) {
    const ecran = Object.entries(scene.ecran ?? {}).map(([cle, valeur]) => `${cle} « ${valeur} »`).join(", ");
    console.log(`  ${scene.id}${scene.icone ? ` [${scene.icone}]` : ""} : ${ecran || "(rien)"}`);
  }
  if (avertissements?.length) {
    console.log("\n--- À relire (avertissements, sans refus)");
    avertissements.forEach((a) => console.log(`  ⚠ ${a}`));
  }
}

function sauvegarder({ host, analyse, contenu }) {
  mkdirSync(SAUVEGARDES_PATH, { recursive: true });
  const horodatage = new Date().toISOString().replace(/[:.]/g, "-");
  const cible = join(SAUVEGARDES_PATH, `analyse-${analyse.id}-avant-reel-${horodatage}.json`);
  writeFileSync(
    cible,
    `${JSON.stringify({ base: host, analyseId: analyse.id, statut: analyse.statut, contenuComplet: contenu }, null, 2)}\n`,
    "utf-8",
  );
  return cible;
}

// Écrit la seule clé reel, si personne n'a modifié la fiche entre-temps
// (updatedAt inchangé), puis journalise. Lève une erreur sinon.
async function ecrireReel({ host, analyse, contenu, reel, propositionId: id, sauvegarde }) {
  const { count } = await prisma.analyse.updateMany({
    where: { id: analyse.id, updatedAt: analyse.updatedAt },
    data: { contenuComplet: contenuAvecReel(contenu, reel) },
  });
  if (count !== 1) throw new Error("la fiche a été modifiée pendant la génération, rien n'est écrit.");
  mkdirSync(dirname(INSERTIONS_LOG_PATH), { recursive: true });
  appendFileSync(
    INSERTIONS_LOG_PATH,
    `${JSON.stringify({ date: new Date().toISOString(), base: host, script: "reel", analyseId: analyse.id, propositionId: id, sauvegarde })}\n`,
  );
}

// Reel généré, gardé dans logs/reels/ (dossier ignoré par git). Renvoie le chemin.
function garderReel({ analyse, propositionId: id, reel }) {
  mkdirSync(REELS_PATH, { recursive: true });
  const horodatage = new Date().toISOString().replace(/[:.]/g, "-");
  const cible = join(REELS_PATH, `reel-${id}-analyse-${analyse.id}-${horodatage}.json`);
  writeFileSync(cible, `${JSON.stringify({ propositionId: id, analyseId: analyse.id, reel }, null, 2)}\n`, "utf-8");
  return cible;
}

// Relit un fichier de garderReel : même analyse, et mêmes contrôles qu'à la
// génération (controlerReel) sur la fiche actuelle. Recalcule le script avec
// le score actuel.
function relireFichier(chemin, { analyse, contenu, candidatNom }) {
  let donnees;
  try {
    donnees = JSON.parse(readFileSync(chemin, "utf-8"));
  } catch (error) {
    fail(`fichier illisible (${error.message}).`);
  }
  if (donnees.analyseId !== analyse.id) fail(`ce fichier concerne l'analyse #${donnees.analyseId}, pas l'analyse #${analyse.id}.`);
  // Couverture et variantes reprises telles quelles (déjà tirées à la génération).
  const controle = controlerReel(
    { scenes: donnees.reel?.scenes, couverture: donnees.reel?.couverture },
    { ficheFinale: fichePourReel(contenu), candidatNom, score: analyse.scoreFaisabilite, variantes: donnees.reel?.variantes ?? null },
  );
  if (!controle.valide) fail(`Reel refusé par le contrôle :\n  - ${controle.erreurs.join("\n  - ")}`);
  return {
    reel: { ...reelPourStockage(controle, { candidatNom, score: analyse.scoreFaisabilite }), genereLe: donnees.reel.genereLe },
    avertissements: controle.avertissements,
  };
}

// --- Une fiche --------------------------------------------------------------------

async function mainFiche(host) {
  const proposition = await prisma.proposition.findUnique({
    where: { id: propositionId },
    include: {
      candidat: true,
      analyses: { where: { statut: STATUT }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  const analyse = proposition?.analyses[0];
  if (!analyse) fail(`aucune analyse ${values.brouillon ? "en brouillon" : "publiée"} pour la fiche ${propositionId}.`);

  const contenu = analyse.contenuComplet ?? {};
  const { candidat } = proposition;
  console.log(`Fiche ${propositionId}, analyse #${analyse.id} (${analyse.statut}), ${candidat.nom}`);
  console.log(`  Titre : ${proposition.titre ?? contenu.titre_fiche}`);
  console.log(`  Score : ${analyse.scoreFaisabilite}/100`);
  console.log(`  Reel existant : ${contenu.reel ? `oui (généré le ${contenu.reel.genereLe ?? "?"}), il sera REMPLACÉ (l'ancien gardé sous reelPrecedent)` : "non"}`);
  if (!portraitExiste(candidat)) console.log(`  ⚠ Portrait bleu manquant (public/portraits-bleus/${slugCandidat(candidat)}.png) : scène 2 avec le nom seul.`);

  // Derniers Reels générés (lecture seule) : variantes, relances et question
  // de couverture à ne pas reprendre.
  const precedents = values.depuis ? [] : await derniersReels(prisma);
  if (!values.depuis) {
    const precedent = precedents[0];
    console.log(
      `  Derniers Reels générés : ${precedents.length}${precedent ? ` (le plus récent le ${precedent.genereLe ?? "?"}, question de couverture « ${precedent.couverture?.question ?? "aucune"} »)` : ""}`,
    );
  }

  if (!values.depuis) {
    const cout = estimation(contenu, precedents);
    console.log(
      `\nCoût estimé du Reel : ~$${cout.min} (premier essai accepté) à ~$${cout.max} (second essai)` +
        ` · environ ${cout.tokens} tokens en entrée (${cout.caracteres} caractères), ~1 500 en sortie.`,
    );
  }

  if (simulation) {
    console.log("\nSimulation (--simulation) : aucun appel à Claude, rien n'a été écrit.");
    return;
  }

  let reel;
  let avertissements;
  if (values.depuis) {
    // Reel déjà généré et relu (fichier de logs/reels/) : aucun appel, mêmes
    // contrôles qu'à la génération, sur la fiche actuelle.
    ({ reel, avertissements } = relireFichier(values.depuis, { analyse, contenu, candidatNom: candidat.nom }));
    console.log(`\nReel repris de ${values.depuis} (aucun appel à Claude).`);
  } else {
    console.log("\nScript du Reel (Claude)…");
    const resultat = await genererReel(contenu, { candidatNom: candidat.nom, score: analyse.scoreFaisabilite, precedents });
    const { usage, errors, derniere } = resultat;
    console.log(`Coût réel : ~$${coutDe(usage)} (${usage.input_tokens ?? 0} tokens en entrée, ${usage.output_tokens ?? 0} en sortie)`);
    if (!resultat.reel) {
      if (derniere) {
        console.log("\n=== Dernière tentative REFUSÉE (rien n'est enregistré) ===");
        afficher(derniere, []);
      }
      console.log("\nErreurs :");
      errors.forEach((erreur) => console.log(`  - ${erreur}`));
      fail("script du Reel refusé après deux tentatives, rien n'est modifié.");
    }
    ({ reel, avertissements } = resultat);
    // Gardé sur le disque : on peut le relire, puis l'écrire plus tard tel
    // quel (--depuis), sans nouvel appel ni texte différent.
    const fichier = garderReel({ analyse, propositionId, reel });
    console.log(`✓ Reel gardé dans ${fichier}`);
    console.log(`  Pour l'écrire plus tard sans nouvel appel : node scripts/reel.js ${propositionId}${values.brouillon ? " --brouillon" : ""} --depuis "${fichier}"`);
  }

  afficher(reel, avertissements);

  console.log(`\ncontenuComplet.reel : ${contenu.reel ? "REMPLACÉE (ancienne gardée sous reelPrecedent)" : "ajoutée"}`);
  const sauvegarde = sauvegarder({ host, analyse, contenu });
  console.log(`✓ Sauvegarde : ${sauvegarde}`);

  const ok = await confirmerEcriture({
    host,
    question: `Ajouter le Reel à l'analyse ${values.brouillon ? "en brouillon" : "publiée"} #${analyse.id} (fiche ${propositionId}) ?`,
  });
  if (!ok) {
    console.log("Annulé, rien n'a été modifié.");
    return;
  }

  try {
    await ecrireReel({ host, analyse, contenu, reel, propositionId, sauvegarde });
  } catch (error) {
    fail(`${error.message} Relancez le script.`);
  }
  console.log(`\n✓ Reel ajouté à l'analyse #${analyse.id}. Page du Reel : /test/reels/${propositionId}${values.brouillon ? "?brouillon=1" : ""}`);
}

// --- Lot : les n dernières fiches publiées sans Reel -----------------------------

async function analysesAvecReel() {
  const lignes = await prisma.$queryRaw`
    SELECT id FROM "Analyse"
    WHERE jsonb_exists("contenuComplet", 'reel')
  `;
  return new Set(lignes.map((ligne) => Number(ligne.id)));
}

async function mainLot(host) {
  for (const ligne of avertissementBase(host)) console.log(ligne);

  // 1. Sans aucun appel à Claude : la liste, ce qui manque, le coût estimé.
  const [publiees, avecReel] = await Promise.all([
    prisma.analyse.findMany({
      where: { statut: "publie" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        scoreFaisabilite: true,
        createdAt: true,
        proposition: { select: { id: true, titre: true, texteOriginal: true, candidat: { select: { nom: true, photoUrl: true } } } },
      },
    }),
    analysesAvecReel(),
  ]);
  const fiches = choisirFichesReel(publiees, avecReel, taille);
  if (fiches.length === 0) {
    console.log("\nAucune fiche publiée sans Reel : rien à faire.");
    return;
  }

  // Le gros JSON, seulement pour les fiches retenues (estimation du coût).
  const contenus = new Map(
    (
      await prisma.analyse.findMany({
        where: { id: { in: fiches.map((f) => f.id) } },
        select: { id: true, contenuComplet: true },
      })
    ).map((a) => [a.id, a.contenuComplet]),
  );
  let totalMin = 0;
  let totalMax = 0;
  console.log(`\n${fiches.length} fiche(s) publiée(s) sans Reel, de la plus récente à la plus ancienne${fiches.length < taille ? ` (${taille} demandées)` : ""} :`);
  for (const { id, scoreFaisabilite, createdAt, proposition } of fiches) {
    const titre = proposition.titre ?? proposition.texteOriginal.slice(0, 80);
    const cout = estimation(contenus.get(id) ?? {});
    totalMin += cout.min;
    totalMax += cout.max;
    console.log(`\n  Fiche ${proposition.id} (analyse #${id}) · ${proposition.candidat.nom} · ${scoreFaisabilite}/100 · ${createdAt.toISOString().slice(0, 10)}`);
    console.log(`    ${titre}`);
    console.log(`    ~$${cout.min} à ~$${cout.max}`);
    if (!portraitExiste(proposition.candidat)) console.log("    ⚠ portrait bleu manquant : scène 2 avec le nom seul");
  }
  console.log(`\nCoût estimé du Reel : entre ~$${totalMin.toFixed(2)} et ~$${totalMax.toFixed(2)}.`);

  if (simulation) {
    console.log("Simulation (--simulation) : aucun appel à Claude, rien n'a été écrit.");
    return;
  }

  const ok = await confirmerEcriture({ host, question: `Générer ET écrire le Reel de ces ${fiches.length} fiche(s) ?` });
  if (!ok) {
    console.log("Annulé : aucun appel à Claude, rien n'a été modifié.");
    return;
  }

  // 2. Fiche par fiche ; une fiche en échec est sautée sans arrêter le lot.
  const resultats = [];
  for (const [index, fiche] of fiches.entries()) {
    const id = fiche.proposition.id;
    const candidatNom = fiche.proposition.candidat.nom;
    console.log(`\n=== ${index + 1}/${fiches.length} · fiche ${id} · ${candidatNom} ===`);
    const resultat = { id, candidatNom, cout: 0 };
    try {
      const analyse = await prisma.analyse.findUnique({
        where: { id: fiche.id },
        select: { id: true, statut: true, updatedAt: true, scoreFaisabilite: true, contenuComplet: true },
      });
      if (!analyse || analyse.statut !== "publie") throw new Error("l'analyse n'est plus publiée, fiche non touchée.");
      const contenu = analyse.contenuComplet ?? {};
      if (contenu.reel) throw new Error("un Reel a été ajouté entre-temps, fiche non touchée.");

      // Relu à chaque fiche : le Reel de la fiche précédente du lot compte.
      const precedents = await derniersReels(prisma);
      const { reel, usage, errors, avertissements } = await genererReel(contenu, { candidatNom, score: analyse.scoreFaisabilite, precedents });
      resultat.cout = coutDe(usage);
      if (!reel) throw new Error(`refusé après deux tentatives : ${errors[0] ?? "raison inconnue"}${errors.length > 1 ? ` (+${errors.length - 1} autre(s))` : ""}`);
      afficher(reel, avertissements);
      resultat.avertissements = avertissements.length;

      const sauvegarde = sauvegarder({ host, analyse, contenu });
      await ecrireReel({ host, analyse, contenu, reel, propositionId: id, sauvegarde });
      resultat.statut = "ecrite";
      console.log(`\n  ✓ Écrite (sauvegarde : ${sauvegarde}). Page du Reel : /test/reels/${id}`);
    } catch (error) {
      resultat.statut = "echec";
      resultat.raison = error.message;
      console.error(`  ✗ Fiche ${id} sautée : ${error.message}`);
    }
    resultats.push(resultat);
  }

  // 3. Récapitulatif.
  const reussies = resultats.filter((r) => r.statut === "ecrite");
  const echecs = resultats.filter((r) => r.statut === "echec");
  console.log("\n=== Récapitulatif ===");
  console.log(`Fiches écrites : ${reussies.length}`);
  reussies.forEach((r) => console.log(`  ✓ fiche ${r.id} (${r.candidatNom}) : ${r.avertissements ?? 0} avertissement(s)`));
  console.log(`Fiches en échec : ${echecs.length}`);
  echecs.forEach((r) => console.log(`  ✗ fiche ${r.id} (${r.candidatNom}) : ${r.raison}`));
  console.log(`Coût réel total : ~$${resultats.reduce((s, r) => s + (r.cout ?? 0), 0).toFixed(4)}`);
}

async function main() {
  const host = hoteDe(process.env.DATABASE_URL);
  console.log(`Base ciblée : ${host}${simulation ? " (lecture seule)" : ""}\n`);
  if (enLot) await mainLot(host);
  else await mainFiche(host);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
