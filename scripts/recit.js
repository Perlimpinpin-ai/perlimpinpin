// Génère le carrousel « récit » (10 slides) et le tweet long d'une fiche DÉJÀ
// PUBLIÉE (ou, avec --brouillon, de son dernier brouillon), en un seul appel
// à Claude (data/prompt-recit.md, mêmes modèle et réglages que l'étape 3 ter),
// et les ajoute à son contenuComplet, sous la clé reseaux_recit. Même logique
// que le bouton « Générer le récit » de /test/reseaux/<id>.
//
//   node scripts/recit.js <id> --simulation
//       → lit la fiche (lecture seule), affiche le coût estimé et garde le
//         message qui serait envoyé dans logs/recits/. AUCUN appel à Claude,
//         rien n'est écrit.
//   node scripts/recit.js <id>
//       → appelle Claude (contrôle controlerRecit), affiche le récit et le
//         tweet long, sauvegarde la ligne actuelle dans logs/sauvegardes/,
//         demande « oui », et écrit.
//   … --brouillon
//       → même chose sur le dernier brouillon de la fiche (pas encore publié).
//
//   node scripts/recit.js --dernieres <n> [--simulation]
//       → lot : les n dernières fiches publiées sans récit. D'abord, sans
//         aucun appel : la liste et le coût estimé ; avec --simulation, on
//         s'arrête là. Sinon un seul « oui », puis fiche par fiche :
//         génération, sauvegarde, écriture. Une fiche en échec est sautée
//         sans arrêter le lot ; récapitulatif à la fin.
//
//   node scripts/recit.js --simulation --fichier <fiche.json> [--candidat "Nom"]
//       → simulation sur une fiche locale (JSON de fiche finale), sans base :
//         message envoyé et coût estimé.
//
//   node scripts/recit.js --demo --fichier <fiche.json> --reponse <réponse.json> --candidat "Nom" [--id 47] [--titre "…"] [--theme economie]
//       → démonstration locale (/test/reseaux/demo) : la réponse simulée du
//         modèle passe le vrai contrôle, puis data/demo-carrousel/demo.json
//         est écrit. Aucun appel, aucune base.
//
// Écriture ciblée : seule la clé contenuComplet.reseaux_recit est ajoutée ou
// remplacée (l'ancien récit gardé dedans, sous `precedent` ; le lot ne touche
// jamais une fiche qui en a déjà un). Aucun score, aucun statut, aucune autre
// clé ne change. Refusée si la fiche a été modifiée entre la lecture et
// l'écriture. Le script utilise DATABASE_URL (.env, donc la production, sauf
// si DATABASE_URL est définie dans le terminal).
import "dotenv/config";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { avertissementBase, confirmerEcriture, hoteDe } from "./lib/garde-fou-base.js";
import { LOT_MAX, choisirFiches, recapitulatif } from "./lib/reseaux-lot.js";
import { cleanContenu } from "./lib/clean-text.js";
import { appelerClaude } from "../src/lib/claude-reel.js";
import { jsonDepuisTexte } from "../src/lib/reel-generation.js";
import { construireMessageRecit, estimationCoutRecit, fichePourRecit, genererRecitCore, MODELE_RECIT, requeteRecit } from "../src/lib/recit-generation.js";
import { contenuAvecRecit, controlerRecit, recitPourStockage } from "../src/lib/recit.js";
import { motsClesDisponibles } from "../src/lib/illustrations.js";
import { remplirTweet, valeursReseaux, longueurX } from "../src/lib/reseaux.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PROMPT_PATH = join(ROOT, "data", "prompt-recit.md");
const SAUVEGARDES_PATH = join(ROOT, "logs", "sauvegardes");
const RECITS_PATH = join(ROOT, "logs", "recits");
const INSERTIONS_LOG_PATH = join(ROOT, "logs", "insertions.jsonl");
const USAGE =
  "Usage : node scripts/recit.js <id de la fiche (/declarations/<id>)> [--brouillon] [--simulation]\n" +
  "   ou : node scripts/recit.js --dernieres <n> [--simulation]\n" +
  '   ou : node scripts/recit.js --simulation --fichier <fiche.json> [--candidat "Nom"]\n' +
  '   ou : node scripts/recit.js --demo --fichier <fiche.json> --reponse <réponse simulée.json> --candidat "Nom" [--id <n>] [--titre "…"] [--theme <thème>]';

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
    demo: { type: "boolean", default: false },
    reponse: { type: "string" },
    id: { type: "string" },
    titre: { type: "string" },
    theme: { type: "string" },
  },
});
const demo = values.demo;
const simulation = values.simulation || demo;
const enLot = values.dernieres !== undefined;
const taille = Number(values.dernieres);
const depuisFichier = values.fichier !== undefined;
if (demo && !depuisFichier) fail(`--demo s'utilise avec --fichier.\n${USAGE}`);
if (depuisFichier && (!simulation || enLot || positionals.length > 0)) fail(`--fichier ne s'utilise qu'avec --simulation ou --demo, sans id ni --dernieres.\n${USAGE}`);
if (enLot && (!Number.isInteger(taille) || taille < 1 || taille > LOT_MAX)) fail(`--dernieres attend un nombre entier de 1 à ${LOT_MAX}.\n${USAGE}`);
if (enLot && (positionals.length > 0 || values.brouillon)) fail(`--dernieres ne se combine ni avec un id ni avec --brouillon.\n${USAGE}`);
const propositionId = Number(positionals[0]);
if (!enLot && !depuisFichier && !Number.isInteger(propositionId)) fail(USAGE);
const STATUT = values.brouillon ? "brouillon" : "publie";
// La simulation ne fait aucun appel : la clé n'est exigée que pour générer.
if (!simulation && !process.env.ANTHROPIC_API_KEY) fail("ANTHROPIC_API_KEY n'est pas défini (voir votre fichier .env).");

const prompt = () => readFileSync(PROMPT_PATH, "utf-8");

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

function dollars(n) {
  return `~$${n.toFixed(3)}`;
}

// Coût estimé sans appel, et message gardé dans logs/recits/ pour relecture.
function simuler(contenu, nom) {
  const message = construireMessageRecit(prompt(), contenu);
  const { min, max, tokens } = estimationCoutRecit(message.length);
  mkdirSync(RECITS_PATH, { recursive: true });
  const cible = join(RECITS_PATH, `simulation-${nom}-${new Date().toISOString().replace(/[:.]/g, "-")}.txt`);
  writeFileSync(cible, message, "utf-8");
  console.log(`\nModèle : ${MODELE_RECIT} (sans recherche web, sans réflexion), ${requeteRecit("").max_tokens} tokens de sortie au plus.`);
  console.log(`Message envoyé : ${message.length.toLocaleString("fr-FR")} caractères (~${tokens.toLocaleString("fr-FR")} tokens), gardé dans ${cible}`);
  console.log(`Coût estimé : ${dollars(min)} (premier essai accepté) à ${dollars(max)} (second essai).`);
  const debut = message.indexOf("FICHE FINALE :");
  console.log("\n--- Début du message (prompt et consigne) ---\n");
  console.log(message.slice(0, debut + "FICHE FINALE :".length));
  console.log("(… fiche finale en JSON, voir le fichier ci-dessus)");
}

function afficher(recit, { candidatNom, score, propositionId: id }) {
  const nom = (t) => remplirTweet(t, { NOM: candidatNom, CANDIDAT: candidatNom });
  const cartes = (liste) => liste.map((c) => `\n       [${c.pastille}] ${nom(c.titre)} : ${nom(c.texte)}`).join("");
  console.log("\n=== Carrousel détaillé ===");
  console.log(`  1. Couverture : ${candidatNom} veut ${nom(recit.couverture.mesure)}. ${recit.couverture.question} [surligné : ${recit.couverture.mot_cle}]`);
  console.log(`     Mots-clés d'illustration : ${recit.illustration_mots_cles?.join(", ") || "(aucun)"}`);
  console.log(`  2. ${nom(recit.concretement.titre)} ${nom(recit.concretement.texte)}`);
  for (const [cle, { valeur, detail }] of Object.entries(recit.concretement.tuiles)) console.log(`       ${cle} : ${valeur} (${detail})`);
  console.log(`     Conclusion : ${nom(recit.concretement.conclusion ?? "")}`);
  console.log(`  3. La note : ${nom(recit.note.titre)} ${nom(recit.note.explication)}`);
  for (const [cle, ligne] of Object.entries(recit.note.criteres)) console.log(`       ${cle} : ${nom(ligne)}`);
  console.log(`  4. Court terme : ${nom(recit.court_terme.titre)}${cartes(recit.court_terme.cartes)}`);
  console.log(`  5. Long terme : ${nom(recit.long_terme.titre)}${cartes(recit.long_terme.cartes)}`);
  console.log(
    recit.ailleurs
      ? `  6. À l'étranger : ${nom(recit.ailleurs.titre)}${recit.ailleurs.precedents.map((p) => `\n       [${p.pastille}] ${p.pays} ${p.annee} : ${nom(p.fait)} ${nom(p.resultat)}`).join("")}`
      : "  6. À l'étranger : aucun précédent dans la fiche, slide sautée",
  );
  console.log(`  7. Tient : ${recit.tient.tient.map(nom).join(" / ")}\n     Coince : ${recit.tient.coince.map(nom).join(" / ")}`);
  console.log("  8. Fin : (code)");
  console.log(`\nAccroche de la légende : ${nom(recit.legende_accroche)}`);
  const tweet = remplirTweet(recit.tweet_assemble, valeursReseaux({ candidatNom, score, propositionId: id }));
  console.log(`\n=== Tweet long (${longueurX(tweet)} caractères) ===\n${tweet}`);
}

function sauvegarder({ host, analyse, contenu }) {
  mkdirSync(SAUVEGARDES_PATH, { recursive: true });
  const horodatage = new Date().toISOString().replace(/[:.]/g, "-");
  const cible = join(SAUVEGARDES_PATH, `analyse-${analyse.id}-avant-recit-${horodatage}.json`);
  writeFileSync(cible, `${JSON.stringify({ base: host, analyseId: analyse.id, statut: analyse.statut, contenuComplet: contenu }, null, 2)}\n`, "utf-8");
  return cible;
}

async function ecrire({ host, analyse, contenu, recit, propositionId: id, sauvegarde }) {
  const db = await base();
  const { count } = await db.analyse.updateMany({
    where: { id: analyse.id, updatedAt: analyse.updatedAt },
    data: { contenuComplet: contenuAvecRecit(contenu, recit) },
  });
  if (count !== 1) throw new Error("la fiche a été modifiée pendant la génération, rien n'est écrit.");
  mkdirSync(dirname(INSERTIONS_LOG_PATH), { recursive: true });
  appendFileSync(
    INSERTIONS_LOG_PATH,
    `${JSON.stringify({ date: new Date().toISOString(), base: host, script: "recit", analyseId: analyse.id, propositionId: id, sauvegarde })}\n`,
  );
}

async function generer(contenu, { candidatNom, score, propositionId: id, theme = null }) {
  return genererRecitCore({
    ficheFinale: contenu,
    candidatNom,
    score,
    propositionId: id,
    prompt: prompt(),
    motsClesIllustration: motsClesDisponibles(theme),
    appeler: (message) => appelerClaude(requeteRecit(message)),
    analyser: (reponse) => cleanContenu(jsonDepuisTexte(reponse.texte)),
  });
}

// --- Simulation sur une fiche locale ------------------------------------------------

function mainFichier() {
  let contenu;
  try {
    contenu = JSON.parse(readFileSync(values.fichier, "utf-8"));
  } catch (error) {
    fail(`fiche illisible (${error.message}).`);
  }
  // Fichier d'étape 3 ({ fiche_complete, … }) ou fiche finale directe.
  const { relecture: _relecture, ...fiche } = contenu.fiche_complete ?? contenu;
  console.log(`Fiche locale : ${values.fichier}${values.candidat ? ` (${values.candidat})` : ""}`);
  console.log(`  ce_qui_la_ferait_tenir : ${Array.isArray(fiche.ce_qui_la_ferait_tenir) ? "oui (condition la plus forte sur la slide 7)" : "non"}`);
  if (demo) return preparerDemo(fiche);
  simuler(fiche, "fichier");
  console.log("\nSimulation (--simulation) : aucun appel à Claude, rien n'a été lu ni écrit en base.");
}

// --demo : démonstration locale (/test/reseaux/demo) à partir d'une réponse
// simulée (--reponse <fichier.json> : { reponse, remarques }), passée par le
// vrai contrôle. Écrit data/demo-carrousel/demo.json. Aucun appel, aucune base.
function preparerDemo(fiche) {
  if (!values.reponse) fail("--demo attend --reponse <fichier.json> (réponse simulée du modèle).");
  const simulationModele = JSON.parse(readFileSync(values.reponse, "utf-8"));
  const candidatNom = values.candidat ?? "Candidat";
  const id = Number(values.id ?? 1);
  const score = fiche.notation_detaillee?.score_total ?? 0;
  const theme = values.theme ?? null;
  const motsClesIllustration = motsClesDisponibles(theme);
  const controle = controlerRecit(simulationModele.reponse, {
    ficheFinale: fichePourRecit(fiche),
    candidatNom,
    valeurs: valeursReseaux({ candidatNom, score, propositionId: id }),
    motsClesIllustration,
  });
  if (!controle.valide) {
    controle.erreurs.forEach((e) => console.error(`  ✗ ${e}`));
    fail("la réponse simulée est refusée par le contrôle (voir ci-dessus).");
  }
  afficher(controle.recit, { candidatNom, score, propositionId: id });
  controle.avertissements.forEach((a) => console.log(`  ⚠ ${a}`));
  const demoFiche = {
    source: values.fichier,
    proposition: { id, titre: values.titre ?? fiche.mesure_reformulee?.synthese ?? "Fiche locale", texteOriginal: fiche.mesure_reformulee?.synthese ?? "", theme, candidat: { nom: candidatNom, photoUrl: null } },
    analyse: {
      id: 0,
      statut: "brouillon",
      scoreFaisabilite: score,
      updatedAt: "demo-0",
      contenuComplet: { ...fiche, reseaux_recit: recitPourStockage(controle.recit, { modele: "simulation" }) },
    },
    simulation: simulationModele,
  };
  mkdirSync(join(ROOT, "data", "demo-carrousel"), { recursive: true });
  const cible = join(ROOT, "data", "demo-carrousel", "demo.json");
  writeFileSync(cible, `${JSON.stringify(demoFiche, null, 2)}\n`, "utf-8");
  console.log(`\nDémonstration écrite dans ${cible} : ouvrez /test/reseaux/demo (serveur local). Aucun appel à Claude, rien n'a été lu ni écrit en base.`);
}

// --- Une fiche --------------------------------------------------------------------

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
  console.log(`Fiche ${propositionId}, analyse #${analyse.id} (${analyse.statut}), ${candidatNom}`);
  console.log(`  Titre : ${proposition.titre ?? contenu.titre_fiche}`);
  console.log(`  Score : ${score}/100`);
  console.log(`  Récit existant : ${contenu.reseaux_recit ? `oui (généré le ${contenu.reseaux_recit.genereLe ?? "?"}), il sera REMPLACÉ (l'ancien gardé sous precedent)` : "non"}`);

  if (simulation) {
    simuler(contenu, String(propositionId));
    console.log("\nSimulation (--simulation) : aucun appel à Claude, rien n'a été écrit.");
    return;
  }

  console.log("\nRécit (Claude)…");
  const resultat = await generer(contenu, { candidatNom, score, propositionId, theme: proposition.theme });
  console.log(`Coût : ${dollars(resultat.cout)} (${resultat.usage.input_tokens ?? 0} tokens en entrée, ${resultat.usage.output_tokens ?? 0} en sortie)`);
  if (!resultat.recit) {
    if (resultat.derniere) console.log(`\nDernière réponse refusée :\n${JSON.stringify(resultat.derniere, null, 2)}`);
    fail("récit refusé après deux tentatives, rien n'est modifié.");
  }
  afficher(resultat.recit, { candidatNom, score, propositionId });
  if (resultat.avertissements.length) {
    console.log("\n--- À relire (avertissements, sans refus)");
    resultat.avertissements.forEach((a) => console.log(`  ⚠ ${a}`));
  }
  mkdirSync(RECITS_PATH, { recursive: true });
  const garde = join(RECITS_PATH, `recit-${propositionId}-analyse-${analyse.id}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(garde, `${JSON.stringify({ propositionId, analyseId: analyse.id, recit: resultat.recit }, null, 2)}\n`, "utf-8");
  console.log(`\nRécit gardé dans ${garde}`);

  const sauvegarde = sauvegarder({ host, analyse, contenu });
  console.log(`✓ Sauvegarde : ${sauvegarde}`);
  const ok = await confirmerEcriture({
    host,
    question: `Écrire le récit dans l'analyse ${values.brouillon ? "en brouillon" : "publiée"} #${analyse.id} (fiche ${propositionId}) ?`,
  });
  if (!ok) {
    console.log("Annulé, rien n'a été modifié.");
    return;
  }
  try {
    await ecrire({ host, analyse, contenu, recit: resultat.recit, propositionId, sauvegarde });
  } catch (error) {
    fail(`${error.message} Relancez le script.`);
  }
  console.log(`\n✓ Récit ajouté à l'analyse #${analyse.id}. Page de partage : /test/reseaux/${propositionId}${values.brouillon ? "?brouillon=1" : ""}`);
}

// --- Lot ----------------------------------------------------------------------------

async function mainLot(host) {
  const db = await base();
  for (const ligne of avertissementBase(host)) console.log(ligne);
  const [publiees, avecRecit] = await Promise.all([
    db.analyse.findMany({
      where: { statut: "publie" },
      orderBy: { createdAt: "desc" },
      select: { id: true, scoreFaisabilite: true, createdAt: true, proposition: { select: { id: true, titre: true, texteOriginal: true, theme: true, candidat: { select: { nom: true } } } } },
    }),
    db.$queryRaw`SELECT id FROM "Analyse" WHERE jsonb_exists("contenuComplet", 'reseaux_recit')`.then((lignes) => new Set(lignes.map((l) => Number(l.id)))),
  ]);
  const fiches = choisirFiches(publiees, avecRecit, taille);
  if (fiches.length === 0) {
    console.log("\nAucune fiche publiée sans récit : rien à faire.");
    return;
  }

  // Coût estimé à partir de la taille réelle de chaque message (lecture seule).
  let min = 0;
  let max = 0;
  console.log(`\n${fiches.length} fiche(s) publiée(s) sans récit, de la plus récente à la plus ancienne :`);
  for (const fiche of fiches) {
    const analyse = await db.analyse.findUnique({ where: { id: fiche.id }, select: { contenuComplet: true } });
    const estimation = estimationCoutRecit(construireMessageRecit(prompt(), analyse.contenuComplet ?? {}).length);
    min += estimation.min;
    max += estimation.max;
    const { proposition } = fiche;
    console.log(`  Fiche ${proposition.id} (analyse #${fiche.id}) · ${proposition.candidat.nom} · ${fiche.scoreFaisabilite}/100 · ${dollars(estimation.min)}`);
    console.log(`    ${proposition.titre ?? proposition.texteOriginal.slice(0, 80)}`);
  }
  console.log(`\nCoût estimé : ${dollars(min)} à ${dollars(max)}.`);
  if (simulation) {
    console.log("Simulation (--simulation) : aucun appel à Claude, rien n'a été écrit.");
    return;
  }

  const ok = await confirmerEcriture({ host, question: `Générer ET écrire le récit de ces ${fiches.length} fiche(s) ?` });
  if (!ok) {
    console.log("Annulé : aucun appel à Claude, rien n'a été modifié.");
    return;
  }

  const resultats = [];
  for (const [index, fiche] of fiches.entries()) {
    const id = fiche.proposition.id;
    const candidatNom = fiche.proposition.candidat.nom;
    console.log(`\n=== ${index + 1}/${fiches.length} · fiche ${id} · ${candidatNom} ===`);
    const resultat = { propositionId: id, candidat: candidatNom, cout: 0 };
    try {
      const analyse = await db.analyse.findUnique({
        where: { id: fiche.id },
        select: { id: true, statut: true, updatedAt: true, scoreFaisabilite: true, contenuComplet: true },
      });
      if (!analyse || analyse.statut !== "publie") throw new Error("l'analyse n'est plus publiée, fiche non touchée.");
      const contenu = analyse.contenuComplet ?? {};
      if (contenu.reseaux_recit) throw new Error("un récit a été ajouté entre-temps, fiche non touchée.");
      const genere = await generer(contenu, { candidatNom, score: analyse.scoreFaisabilite, propositionId: id, theme: fiche.proposition.theme });
      resultat.cout = genere.cout;
      if (!genere.recit) throw new Error(`refusé après deux tentatives : ${genere.errors[0] ?? "raison inconnue"}`);
      afficher(genere.recit, { candidatNom, score: analyse.scoreFaisabilite, propositionId: id });
      resultat.avertissements = genere.avertissements.length;
      const sauvegarde = sauvegarder({ host, analyse, contenu });
      await ecrire({ host, analyse, contenu, recit: genere.recit, propositionId: id, sauvegarde });
      resultat.statut = "ecrite";
      console.log(`\n  ✓ Écrite (sauvegarde : ${sauvegarde}). Page de partage : /test/reseaux/${id}`);
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
  if (depuisFichier) return mainFichier();
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
