// Génère le tweet long X d'une fiche DÉJÀ PUBLIÉE (ou, avec --brouillon, de
// son dernier brouillon), avec son propre prompt (data/prompt-tweet-long.md,
// mêmes modèle et réglages que le carrousel détaillé), et l'ajoute à son
// contenuComplet sous la clé reseaux_tweet_long. Même logique que le bouton
// « Générer le tweet long » de /test/reseaux/<id> (src/lib/tweet-long.js).
//
//   node scripts/tweet-long.js <id> --simulation
//       → lit la fiche (lecture seule), garde le message qui serait envoyé
//         dans logs/tweets-longs/, affiche le coût estimé, la ligne de score
//         et la signature écrites par le code. AUCUN appel, rien n'est écrit.
//   node scripts/tweet-long.js <id>
//       → appelle Claude (contrôle controlerTweetLong, deux essais au plus),
//         affiche le texte final et les avertissements, sauvegarde la ligne
//         actuelle dans logs/sauvegardes/, demande « oui », et écrit.
//   … --brouillon
//       → même chose sur le dernier brouillon (lien vers l'accueil du site).
//
//   node scripts/tweet-long.js --dernieres <n> [--simulation]
//       → lot : les n dernières fiches publiées sans tweet long. D'abord,
//         sans aucun appel : la liste et le coût estimé ; avec --simulation,
//         on s'arrête là. Sinon un seul « oui », puis fiche par fiche :
//         génération, sauvegarde, écriture. Une fiche en échec est sautée
//         sans arrêter le lot ; récapitulatif à la fin.
//
//   node scripts/tweet-long.js --simulation --fichier <fiche.json> --candidat "Nom" --score <n> [--id <n>] [--non-publiee]
//       → simulation sur une fiche locale (JSON du contenuComplet), sans base.
//
// Écriture ciblée : seule la clé contenuComplet.reseaux_tweet_long est
// ajoutée ou remplacée (le lot ne touche jamais une fiche qui en a déjà une).
// Aucun score, aucun statut, aucune autre clé ne change. Refusée si la fiche
// a été modifiée entre la lecture et l'écriture. Le script utilise
// DATABASE_URL (.env, donc la production, sauf si DATABASE_URL est définie
// dans le terminal).
import "dotenv/config";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { avertissementBase, confirmerEcriture, hoteDe } from "./lib/garde-fou-base.js";
import { LOT_MAX, choisirFiches, recapitulatif } from "./lib/reseaux-lot.js";
import { appelerClaude } from "../src/lib/claude-reel.js";
import {
  construireMessageTweetLong,
  contenuAvecTweetLong,
  estimationCoutTweetLong,
  genererTweetLongCore,
  introDe,
  ligneScore,
  MODELE_TWEET_LONG,
  requeteTweetLong,
  signature,
  urlTweetLong,
} from "../src/lib/tweet-long.js";
import { longueurX } from "../src/lib/reseaux.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PROMPT_PATH = join(ROOT, "data", "prompt-tweet-long.md");
const SAUVEGARDES_PATH = join(ROOT, "logs", "sauvegardes");
const MESSAGES_PATH = join(ROOT, "logs", "tweets-longs");
const INSERTIONS_LOG_PATH = join(ROOT, "logs", "insertions.jsonl");
const USAGE =
  "Usage : node scripts/tweet-long.js <id de la fiche (/declarations/<id>)> [--simulation] [--brouillon]\n" +
  "   ou : node scripts/tweet-long.js --dernieres <n> [--simulation]\n" +
  '   ou : node scripts/tweet-long.js --simulation --fichier <fiche.json> --candidat "Nom" --score <n> [--id <n>] [--non-publiee]';

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
    fichier: { type: "string" },
    candidat: { type: "string" },
    score: { type: "string" },
    id: { type: "string" },
    "non-publiee": { type: "boolean", default: false },
  },
});
const simulation = values.simulation;
const enLot = values.dernieres !== undefined;
const taille = Number(values.dernieres);
if (values.fichier) {
  if (!simulation) fail(`--fichier ne s'utilise qu'avec --simulation (aucune écriture possible sans base).\n${USAGE}`);
  if (!values.candidat || !Number.isFinite(Number(values.score))) fail(`--fichier demande --candidat et --score.\n${USAGE}`);
} else {
  if (enLot && (!Number.isInteger(taille) || taille < 1 || taille > LOT_MAX)) fail(`--dernieres attend un nombre entier de 1 à ${LOT_MAX}.\n${USAGE}`);
  if (enLot && (positionals.length > 0 || values.brouillon)) fail(`--dernieres ne se combine ni avec un id ni avec --brouillon.\n${USAGE}`);
  if (!enLot && !Number.isInteger(Number(positionals[0]))) fail(USAGE);
}
const propositionId = Number(positionals[0]);
const STATUT = values.brouillon ? "brouillon" : "publie";
// La simulation ne fait aucun appel : la clé n'est exigée que pour générer.
if (!simulation && !process.env.ANTHROPIC_API_KEY) fail("ANTHROPIC_API_KEY n'est pas défini (voir votre fichier .env).");

const prompt = () => readFileSync(PROMPT_PATH, "utf-8");
const dollars = (n) => `~$${n.toFixed(4)}`;

// Base ouverte seulement si besoin (pas avec --fichier).
let prisma = null;
async function base() {
  if (prisma) return prisma;
  const [{ PrismaClient }, { PrismaNeon }, { neonConfig }, { default: ws }] = await Promise.all([
    import("../src/generated/prisma/client.ts"),
    import("@prisma/adapter-neon"),
    import("@neondatabase/serverless"),
    import("ws"),
  ]);
  neonConfig.webSocketConstructor = ws;
  prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }) });
  return prisma;
}

// Message envoyé gardé dans logs/tweets-longs/, coût estimé, et ce que le code ajoute.
function simuler(contenu, { nom, score, id, publie }) {
  const url = urlTweetLong({ propositionId: id, publie });
  const message = construireMessageTweetLong(prompt(), contenu, url);
  const { min, max, tokens } = estimationCoutTweetLong(message.length);
  mkdirSync(MESSAGES_PATH, { recursive: true });
  const horodatage = new Date().toISOString().replace(/[:.]/g, "-");
  const cible = join(MESSAGES_PATH, `simulation-${nom}-${horodatage}.txt`);
  writeFileSync(cible, message, "utf-8");
  console.log(`Prompt envoyé (${message.length.toLocaleString("fr-FR")} caractères, ~${tokens.toLocaleString("fr-FR")} tokens) : ${cible}`);
  console.log(`Modèle : ${MODELE_TWEET_LONG}, sans recherche web.`);
  console.log(`Coût estimé : entre ${dollars(min)} (premier essai accepté) et ${dollars(max)} (second essai).`);
  console.log(`Lien de la signature : ${url}${publie ? "" : "  ⚠ fiche pas encore publiée : accueil du site"}`);
  console.log("\n=== Ajouté par le code après le corps du modèle (ligne vide, score, ligne vide, signature) ===");
  console.log(`\n${ligneScore(score)}\n\n${signature(url)}`);
  console.log("\nSimulation : aucun appel à Claude, rien n'a été écrit.");
  return { min, max };
}

async function introPrecedente(db) {
  const lignes = await db.$queryRaw`
    SELECT a."contenuComplet"->'reseaux_tweet_long'->>'corps_modele' AS corps
    FROM "Analyse" a
    WHERE jsonb_exists(a."contenuComplet", 'reseaux_tweet_long')
    ORDER BY a."contenuComplet"->'reseaux_tweet_long'->>'date' DESC NULLS LAST
    LIMIT 1
  `;
  return introDe(lignes[0]?.corps ?? "");
}

function generer(contenu, { candidatNom, score, id, publie, intro }) {
  return genererTweetLongCore({
    contenu,
    candidatNom,
    score,
    propositionId: id,
    publie,
    prompt: prompt(),
    introPrecedente: intro,
    appeler: (message) => appelerClaude(requeteTweetLong(message)),
  });
}

function afficher(tweetLong) {
  console.log(`\n=== Tweet long (${longueurX(tweetLong.texte)} caractères, cible 1 200 à 2 000) ===\n${tweetLong.texte}`);
  if (tweetLong.avertissements.length) {
    console.log("\n--- À relire avant de publier");
    tweetLong.avertissements.forEach((a) => console.log(`  ⚠ ${a}`));
  }
}

function sauvegarder({ host, analyse, contenu }) {
  mkdirSync(SAUVEGARDES_PATH, { recursive: true });
  const horodatage = new Date().toISOString().replace(/[:.]/g, "-");
  const cible = join(SAUVEGARDES_PATH, `analyse-${analyse.id}-avant-tweet-long-${horodatage}.json`);
  writeFileSync(cible, `${JSON.stringify({ base: host, analyseId: analyse.id, statut: analyse.statut, contenuComplet: contenu }, null, 2)}\n`, "utf-8");
  return cible;
}

async function ecrire({ host, analyse, contenu, tweetLong, id, sauvegarde }) {
  const db = await base();
  const { count } = await db.analyse.updateMany({
    where: { id: analyse.id, updatedAt: analyse.updatedAt },
    data: { contenuComplet: contenuAvecTweetLong(contenu, tweetLong) },
  });
  if (count !== 1) throw new Error("la fiche a été modifiée pendant la génération, rien n'est écrit.");
  mkdirSync(dirname(INSERTIONS_LOG_PATH), { recursive: true });
  appendFileSync(INSERTIONS_LOG_PATH, `${JSON.stringify({ date: new Date().toISOString(), base: host, script: "tweet-long", analyseId: analyse.id, propositionId: id, sauvegarde })}\n`);
}

// --- Fiche locale (simulation seulement) ---------------------------------------------

function mainFichier() {
  const brut = JSON.parse(readFileSync(values.fichier, "utf-8"));
  const contenu = brut.contenuComplet ?? brut.contenu ?? brut;
  const nom = values.candidat.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-");
  console.log(`Fiche locale ${values.fichier} · ${values.candidat} · ${values.score}/100\n`);
  simuler(contenu, { nom, score: Number(values.score), id: Number(values.id ?? 0), publie: !values["non-publiee"] });
}

// --- Une fiche ------------------------------------------------------------------------

async function mainFiche(host) {
  const db = await base();
  const proposition = await db.proposition.findUnique({
    where: { id: propositionId },
    include: { candidat: true, analyses: { where: { statut: STATUT }, orderBy: { createdAt: "desc" }, take: 1 } },
  });
  const analyse = proposition?.analyses[0];
  if (!analyse) fail(`aucune analyse ${values.brouillon ? "en brouillon" : "publiée"} pour la fiche ${propositionId}.`);
  const contenu = analyse.contenuComplet ?? {};
  const candidatNom = proposition.candidat.nom;
  const score = analyse.scoreFaisabilite;
  const publie = analyse.statut === "publie";
  console.log(`Fiche ${propositionId}, analyse #${analyse.id} (${analyse.statut}), ${candidatNom}, ${score}/100`);
  console.log(`  Titre : ${proposition.titre ?? contenu.titre_fiche}\n`);

  if (simulation) {
    simuler(contenu, { nom: String(propositionId), score, id: propositionId, publie });
    return;
  }

  console.log("Tweet long (Claude)…");
  const resultat = await generer(contenu, { candidatNom, score, id: propositionId, publie, intro: await introPrecedente(db) });
  console.log(`Coût : ${dollars(resultat.cout)} (${resultat.usage.input_tokens ?? 0} tokens en entrée, ${resultat.usage.output_tokens ?? 0} en sortie)`);
  if (!resultat.tweetLong) {
    if (resultat.derniere) console.log(`\n=== Dernier texte REFUSÉ (rien n'est enregistré) ===\n${resultat.derniere}`);
    resultat.errors.forEach((e) => console.log(`  - ${e}`));
    fail("tweet long refusé après deux tentatives, rien n'est modifié.");
  }
  afficher(resultat.tweetLong);

  console.log(`\ncontenuComplet.reseaux_tweet_long : ${contenu.reseaux_tweet_long ? "REMPLACÉE" : "ajoutée"}`);
  const sauvegarde = sauvegarder({ host, analyse, contenu });
  console.log(`✓ Sauvegarde : ${sauvegarde}`);
  const ok = await confirmerEcriture({ host, question: `Enregistrer ce tweet long dans l'analyse ${publie ? "publiée" : "en brouillon"} #${analyse.id} (fiche ${propositionId}) ?` });
  if (!ok) {
    console.log("Annulé, rien n'a été modifié.");
    return;
  }
  try {
    await ecrire({ host, analyse, contenu, tweetLong: resultat.tweetLong, id: propositionId, sauvegarde });
  } catch (error) {
    fail(`${error.message} Relancez le script.`);
  }
  console.log(`\n✓ Tweet long enregistré. Page de partage : /test/reseaux/${propositionId}${values.brouillon ? "?brouillon=1" : ""}`);
}

// --- Lot ------------------------------------------------------------------------------

async function mainLot(host) {
  const db = await base();
  for (const ligne of avertissementBase(host)) console.log(ligne);
  const [publiees, avec] = await Promise.all([
    db.analyse.findMany({
      where: { statut: "publie" },
      orderBy: { createdAt: "desc" },
      select: { id: true, scoreFaisabilite: true, createdAt: true, contenuComplet: true, proposition: { select: { id: true, titre: true, texteOriginal: true, candidat: { select: { nom: true } } } } },
    }),
    db.$queryRaw`SELECT id FROM "Analyse" WHERE jsonb_exists("contenuComplet", 'reseaux_tweet_long')`,
  ]);
  const fiches = choisirFiches(publiees, new Set(avec.map((l) => Number(l.id))), taille);
  if (fiches.length === 0) {
    console.log("\nAucune fiche publiée sans tweet long : rien à faire.");
    return;
  }
  let min = 0;
  let max = 0;
  console.log(`\n${fiches.length} fiche(s) publiée(s) sans tweet long, de la plus récente à la plus ancienne${fiches.length < taille ? ` (${taille} demandées)` : ""} :`);
  for (const { id, scoreFaisabilite, createdAt, contenuComplet, proposition } of fiches) {
    const estimation = estimationCoutTweetLong(construireMessageTweetLong(prompt(), contenuComplet, urlTweetLong({ propositionId: proposition.id, publie: true })).length);
    min += estimation.min;
    max += estimation.max;
    console.log(`  Fiche ${proposition.id} (analyse #${id}) · ${proposition.candidat.nom} · ${scoreFaisabilite}/100 · ${createdAt.toISOString().slice(0, 10)} · ${proposition.titre ?? proposition.texteOriginal.slice(0, 70)}`);
  }
  console.log(`\nCoût estimé : entre ${dollars(min)} et ${dollars(max)}.`);
  if (simulation) {
    console.log("Simulation : aucun appel à Claude, rien n'a été écrit.");
    return;
  }
  const ok = await confirmerEcriture({ host, question: `Générer ET écrire le tweet long de ces ${fiches.length} fiche(s) ?` });
  if (!ok) {
    console.log("Annulé : aucun appel à Claude, rien n'a été modifié.");
    return;
  }

  const resultats = [];
  let intro = await introPrecedente(db);
  for (const [index, fiche] of fiches.entries()) {
    const id = fiche.proposition.id;
    const candidatNom = fiche.proposition.candidat.nom;
    console.log(`\n=== ${index + 1}/${fiches.length} · fiche ${id} · ${candidatNom} ===`);
    const resultat = { propositionId: id, candidat: candidatNom, cout: 0 };
    try {
      const analyse = await db.analyse.findUnique({ where: { id: fiche.id }, select: { id: true, statut: true, updatedAt: true, scoreFaisabilite: true, contenuComplet: true } });
      if (!analyse || analyse.statut !== "publie") throw new Error("l'analyse n'est plus publiée, fiche non touchée.");
      const contenu = analyse.contenuComplet ?? {};
      if (contenu.reseaux_tweet_long) throw new Error("un tweet long a été ajouté entre-temps, fiche non touchée.");
      const genere = await generer(contenu, { candidatNom, score: analyse.scoreFaisabilite, id, publie: true, intro });
      resultat.cout = genere.cout;
      if (!genere.tweetLong) throw new Error(`refusé après deux tentatives : ${genere.errors[0] ?? "raison inconnue"}`);
      afficher(genere.tweetLong);
      resultat.avertissements = genere.tweetLong.avertissements.length;
      const sauvegarde = sauvegarder({ host, analyse, contenu });
      await ecrire({ host, analyse, contenu, tweetLong: genere.tweetLong, id, sauvegarde });
      intro = introDe(genere.tweetLong.corps_modele);
      resultat.statut = "ecrite";
      console.log(`\n  ✓ Écrit (sauvegarde : ${sauvegarde}). Page de partage : /test/reseaux/${id}`);
    } catch (error) {
      resultat.statut = "echec";
      resultat.raison = error.message;
      console.error(`  ✗ Fiche ${id} sautée : ${error.message}`);
    }
    resultats.push(resultat);
  }
  console.log("");
  for (const ligne of recapitulatif(resultats)) console.log(ligne);
}

async function main() {
  if (values.fichier) return mainFichier();
  const host = hoteDe(process.env.DATABASE_URL);
  console.log(`Base ciblée : ${host}\n`);
  if (enLot) await mainLot(host);
  else await mainFiche(host);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (prisma) await prisma.$disconnect();
  });
