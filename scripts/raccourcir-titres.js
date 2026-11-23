// Raccourcit titre_fiche et teaser_accueil des fiches publiées selon les règles
// du 5 octobre 2026 (sections « ### Titre » et « ### Teaser accueil » de
// data/prompt-methodologie.md : titre ≤ 35 caractères, teaser = une phrase de
// teasing ≤ 60 caractères).
//
//   node scripts/raccourcir-titres.js [--ids 12,14]
//       → simulation (par défaut) : demande à Claude un nouveau titre et un
//         nouveau teaser pour chaque analyse publiée, affiche ancien → nouveau
//         et écrit les propositions dans logs/titres-proposes.json. N'écrit
//         RIEN en base.
//   node scripts/raccourcir-titres.js --appliquer
//       → relit logs/titres-proposes.json (aucun appel à Claude : on applique
//         exactement ce qui a été relu, éventuellement corrigé à la main dans
//         le fichier) et met à jour ces deux champs en base, après « oui ».
//
// Écriture ciblée, deux champs et leurs colonnes dérivées, comme à la
// génération (scripts/analyze.js, saveAnalysis) :
//   titre_fiche    → Analyse.contenuComplet.titre_fiche + Proposition.titre
//   teaser_accueil → Analyse.contenuComplet.teaser_accueil + Analyse.resumeAccueil
// Une fiche est ignorée si ses valeurs en base ont changé depuis la simulation,
// si elle n'est plus publiée, ou si une proposition dépasse les limites.
// Chaque fiche modifiée est journalisée (avec l'hôte Neon, champ « base ») dans
// logs/insertions.jsonl. Le script utilise DATABASE_URL (.env, donc la
// production, sauf si DATABASE_URL est définie dans le terminal).
import "dotenv/config";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { confirmerEcriture, hoteDe } from "./lib/garde-fou-base.js";
import { TEASER_ACCUEIL_MAX, TITRE_FICHE_MAX, checkLongueursAccueil } from "./lib/scoring.js";
import { rafraichirSite } from "./rafraichir-site.js";
import { rafraichirSite } from "./rafraichir-site.js";

neonConfig.webSocketConstructor = ws;

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const METHODOLOGIE_PATH = join(ROOT, "data", "prompt-methodologie.md");
const PROPOSITIONS_PATH = join(ROOT, "logs", "titres-proposes.json");
const INSERTIONS_LOG_PATH = join(ROOT, "logs", "insertions.jsonl");
const USAGE = "Usage : node scripts/raccourcir-titres.js [--ids 12,14] | --appliquer";
// Même modèle que l'étape 3 (scripts/analyze.js).
const MODELE = "claude-sonnet-5";
const TENTATIVES_MAX = 3;
// Mots interdits dans le teaser (« ### Teaser accueil » : ne jamais révéler
// l'appréciation). Contrôle d'affichage seulement.
const MOTS_VERDICT = /\b(irr[ée]aliste|r[ée]aliste|r[ée]alisme|fragile|solide)\b/i;

function fail(message) {
  console.error(`Erreur : ${message}`);
  process.exit(1);
}

function appendJsonLine(path, entry) {
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${JSON.stringify(entry)}\n`);
}

const { values } = parseArgs({
  options: {
    appliquer: { type: "boolean", default: false },
    ids: { type: "string" },
  },
  strict: true,
});
if (values.appliquer && values.ids) fail(`--ids ne sert qu'en simulation.\n${USAGE}`);
const idsFiltre = values.ids
  ? values.ids.split(",").map((id) => {
      const n = Number(id.trim());
      if (!Number.isInteger(n) || n <= 0) fail(`--ids : identifiant d'analyse invalide « ${id} ».\n${USAGE}`);
      return n;
    })
  : null;

if (!process.env.DATABASE_URL) fail("DATABASE_URL absente (fichier .env).");
const host = hoteDe(process.env.DATABASE_URL);
if (!host) fail("DATABASE_URL illisible.");

// Section « ### <titre> » de la méthodologie, jusqu'au prochain « ### ».
function extraireSection(texte, titre) {
  const lignes = texte.replace(/\r\n/g, "\n").split("\n");
  const debut = lignes.findIndex((ligne) => ligne.trim() === `### ${titre}`);
  if (debut < 0) fail(`section « ### ${titre} » introuvable dans data/prompt-methodologie.md.`);
  const fin = lignes.findIndex((ligne, i) => i > debut && ligne.startsWith("### "));
  return lignes.slice(debut, fin < 0 ? undefined : fin).join("\n").trim();
}

function texteDe(value) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") return [value.synthese, value.texte].filter(Boolean).join("\n");
  return "";
}

function avertissementsProposition(nouveau, ancienTitre) {
  const avertissements = checkLongueursAccueil(nouveau);
  if (MOTS_VERDICT.test(nouveau.teaser_accueil)) avertissements.push("teaser_accueil : contient un mot de verdict.");
  if (nouveau.titre_fiche.trim() === (ancienTitre ?? "").trim()) avertissements.push("titre_fiche inchangé.");
  return avertissements;
}

async function appelerClaude(system, messages) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    // thinking désactivé, comme à l'étape 3 : sinon la réflexion peut
    // consommer tout max_tokens et laisser une réponse texte vide.
    body: JSON.stringify({ model: MODELE, max_tokens: 1000, thinking: { type: "disabled" }, system, messages }),
  });
  if (!response.ok) throw new Error(`API Anthropic (${response.status}) : ${await response.text()}`);
  const data = await response.json();
  return data.content.filter((bloc) => bloc.type === "text").map((bloc) => bloc.text).join("");
}

// Premier objet JSON complet de la réponse (accolades équilibrées, hors
// chaînes) : le modèle ajoute parfois un commentaire ou un second objet après.
function premierObjetJson(texte) {
  const debut = texte.indexOf("{");
  if (debut < 0) throw new Error(`réponse sans JSON : ${texte.slice(0, 200)}`);
  let profondeur = 0;
  let dansChaine = false;
  for (let i = debut; i < texte.length; i += 1) {
    const c = texte[i];
    if (dansChaine) {
      if (c === "\\") i += 1;
      else if (c === '"') dansChaine = false;
    } else if (c === '"') dansChaine = true;
    else if (c === "{") profondeur += 1;
    else if (c === "}" && --profondeur === 0) return JSON.parse(texte.slice(debut, i + 1));
  }
  throw new Error(`JSON incomplet : ${texte.slice(0, 200)}`);
}

function lireOptions(texte) {
  const json = premierObjetJson(texte);
  const nettoyer = (liste) =>
    Array.isArray(liste) ? liste.filter((x) => typeof x === "string" && x.trim()).map((x) => x.trim()) : [];
  const titres = nettoyer(json.titres);
  const teasers = nettoyer(json.teasers);
  if (titres.length === 0 || teasers.length === 0) throw new Error("réponse sans titres ou teasers.");
  return { titres, teasers };
}

// Claude propose plusieurs formulations par champ (il compte mal les
// caractères) ; on garde, pour chaque champ, la première qui tient dans la
// limite. Relance (au plus TENTATIVES_MAX fois) seulement pour un champ dont
// aucune option ne tient. Les options écartées restent dans `alternatives`,
// pour une correction à la main dans logs/titres-proposes.json.
async function proposer(system, fiche) {
  const messages = [{ role: "user", content: JSON.stringify(fiche, null, 2) }];
  const vus = { titres: [], teasers: [] };
  let titre = null;
  let teaser = null;
  for (let tentative = 1; tentative <= TENTATIVES_MAX && !(titre && teaser); tentative += 1) {
    const reponse = await appelerClaude(system, messages);
    const options = lireOptions(reponse);
    vus.titres.push(...options.titres);
    vus.teasers.push(...options.teasers);
    titre ??= options.titres.find((x) => x.length <= TITRE_FICHE_MAX) ?? null;
    teaser ??= options.teasers.find((x) => x.length <= TEASER_ACCUEIL_MAX) ?? null;
    const relance = [
      !titre && `Aucun titre ne fait ${TITRE_FICHE_MAX} caractères ou moins (${options.titres.map((x) => `${x.length} car.`).join(", ")}).`,
      !teaser && `Aucun teaser ne fait ${TEASER_ACCUEIL_MAX} caractères ou moins (${options.teasers.map((x) => `${x.length} car.`).join(", ")}).`,
    ].filter(Boolean);
    messages.push(
      { role: "assistant", content: reponse },
      { role: "user", content: `${relance.join("\n")}\nPropose des formulations nettement plus courtes, même format JSON.` },
    );
  }
  // Repli : l'option la plus courte (signalée trop longue par l'avertissement).
  const plusCourte = (liste) => liste.reduce((a, b) => (b.length < a.length ? b : a));
  const nouveau = { titre_fiche: titre ?? plusCourte(vus.titres), teaser_accueil: teaser ?? plusCourte(vus.teasers) };
  return {
    nouveau,
    alternatives: {
      titres: [...new Set(vus.titres)].filter((x) => x !== nouveau.titre_fiche),
      teasers: [...new Set(vus.teasers)].filter((x) => x !== nouveau.teaser_accueil),
    },
  };
}

const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }) });

async function simuler() {
  if (!process.env.ANTHROPIC_API_KEY) fail("ANTHROPIC_API_KEY absente (fichier .env).");
  const methodologie = readFileSync(METHODOLOGIE_PATH, "utf8");
  const system = `Tu rédiges, pour le site Perlimpinpin, le titre et le teaser d'accueil d'une fiche d'analyse déjà publiée, en suivant STRICTEMENT les règles ci-dessous (extraites de la méthodologie).

${extraireSection(methodologie, "Titre")}

${extraireSection(methodologie, "Teaser accueil")}

Tu reçois la fiche en JSON (titre et teaser actuels, mesure, résumé, verdict). Ne t'appuie que sur ces informations. Compte précisément les caractères, espaces compris : titre_fiche ≤ ${TITRE_FICHE_MAX}, teaser_accueil ≤ ${TEASER_ACCUEIL_MAX}.
Propose 3 titres et 3 teasers, du meilleur au moins bon, tous conformes aux règles.
Réponds uniquement par un objet JSON, sans texte autour ni bloc de code : {"titres": ["...", "...", "..."], "teasers": ["...", "...", "..."]}`;

  const analyses = await prisma.analyse.findMany({
    where: { statut: "publie", ...(idsFiltre ? { id: { in: idsFiltre } } : {}) },
    orderBy: { id: "asc" },
    select: {
      id: true,
      resumeAccueil: true,
      contenuComplet: true,
      proposition: { select: { id: true, titre: true, texteOriginal: true, theme: true, candidat: { select: { nom: true } } } },
    },
  });
  if (idsFiltre) {
    const trouves = new Set(analyses.map((a) => a.id));
    for (const id of idsFiltre) if (!trouves.has(id)) console.log(`  ? analyse ${id} : introuvable ou non publiée, ignorée.`);
  }
  console.log(`Base : ${host} · analyses publiées à traiter : ${analyses.length}\n`);

  const fiches = [];
  for (const analyse of analyses) {
    const contenu = analyse.contenuComplet ?? {};
    const ancien = {
      titre_fiche: typeof contenu.titre_fiche === "string" ? contenu.titre_fiche : null,
      teaser_accueil: typeof contenu.teaser_accueil === "string" ? contenu.teaser_accueil : null,
      propositionTitre: analyse.proposition.titre,
      resumeAccueil: analyse.resumeAccueil,
    };
    const candidat = analyse.proposition.candidat.nom;
    process.stdout.write(`  #${analyse.id} ${candidat}… `);
    try {
      const { nouveau, alternatives } = await proposer(system, {
        candidat,
        theme: analyse.proposition.theme,
        declaration_originale: analyse.proposition.texteOriginal,
        titre_actuel: ancien.titre_fiche ?? ancien.propositionTitre,
        teaser_actuel: ancien.teaser_accueil ?? ancien.resumeAccueil,
        mesure_reformulee: texteDe(contenu.mesure_reformulee),
        resume_court: texteDe(contenu.resume_court),
        verdict_final: texteDe(contenu.verdict_final),
      });
      const avertissements = avertissementsProposition(nouveau, ancien.titre_fiche ?? ancien.propositionTitre);
      fiches.push({
        analyseId: analyse.id,
        propositionId: analyse.proposition.id,
        candidat,
        ancien,
        nouveau,
        avertissements,
        alternatives,
      });
      console.log(avertissements.length ? `⚠ ${avertissements.join(" ")}` : "ok");
    } catch (error) {
      console.log(`✗ ${error.message}`);
      fiches.push({ analyseId: analyse.id, propositionId: analyse.proposition.id, candidat, ancien, nouveau: null, erreur: error.message });
    }
  }

  const lignes = [];
  for (const fiche of fiches) {
    if (!fiche.nouveau) continue;
    lignes.push({
      id: fiche.analyseId,
      champ: "titre",
      ancien: fiche.ancien.titre_fiche ?? fiche.ancien.propositionTitre,
      nouveau: fiche.nouveau.titre_fiche,
      car: fiche.nouveau.titre_fiche.length,
    });
    lignes.push({
      id: fiche.analyseId,
      champ: "teaser",
      ancien: fiche.ancien.teaser_accueil ?? fiche.ancien.resumeAccueil,
      nouveau: fiche.nouveau.teaser_accueil,
      car: fiche.nouveau.teaser_accueil.length,
    });
  }
  console.log("");
  if (lignes.length) console.table(lignes);

  mkdirSync(dirname(PROPOSITIONS_PATH), { recursive: true });
  writeFileSync(
    PROPOSITIONS_PATH,
    `${JSON.stringify({ genereLe: new Date().toISOString(), base: host, modele: MODELE, fiches }, null, 2)}\n`,
  );
  const enErreur = fiches.filter((fiche) => !fiche.nouveau).length;
  console.log(`\nPropositions écrites dans ${PROPOSITIONS_PATH}${enErreur ? ` (${enErreur} fiche(s) en erreur)` : ""}.`);
  console.log("Simulation : rien n'a été écrit en base. Relisez (et corrigez au besoin) le fichier, puis relancez avec --appliquer.");
}

async function appliquer() {
  if (!existsSync(PROPOSITIONS_PATH)) fail(`${PROPOSITIONS_PATH} absent : lancez d'abord la simulation.`);
  const { fiches, base } = JSON.parse(readFileSync(PROPOSITIONS_PATH, "utf8"));
  if (!Array.isArray(fiches)) fail(`${PROPOSITIONS_PATH} : liste « fiches » absente.`);
  if (base !== host) console.log(`⚠ Propositions générées sur la base ${base}, écriture sur ${host}.`);

  const aAppliquer = [];
  for (const fiche of fiches) {
    const label = `#${fiche.analyseId} ${fiche.candidat}`;
    if (!fiche.nouveau) {
      console.log(`  ✗ ${label} : pas de proposition (erreur en simulation), ignorée.`);
      continue;
    }
    const nouveau = { titre_fiche: fiche.nouveau.titre_fiche?.trim(), teaser_accueil: fiche.nouveau.teaser_accueil?.trim() };
    if (!nouveau.titre_fiche || !nouveau.teaser_accueil || checkLongueursAccueil(nouveau).length > 0) {
      console.log(`  ✗ ${label} : proposition vide ou trop longue, ignorée.`);
      continue;
    }
    const analyse = await prisma.analyse.findUnique({
      where: { id: fiche.analyseId },
      select: { statut: true, resumeAccueil: true, contenuComplet: true, propositionId: true, proposition: { select: { titre: true } } },
    });
    const contenu = analyse?.contenuComplet ?? {};
    if (!analyse || analyse.statut !== "publie" || analyse.propositionId !== fiche.propositionId) {
      console.log(`  ✗ ${label} : introuvable ou non publiée, ignorée.`);
    } else if (
      (contenu.titre_fiche ?? null) !== fiche.ancien.titre_fiche ||
      (contenu.teaser_accueil ?? null) !== fiche.ancien.teaser_accueil ||
      analyse.proposition.titre !== fiche.ancien.propositionTitre ||
      analyse.resumeAccueil !== fiche.ancien.resumeAccueil
    ) {
      console.log(`  ✗ ${label} : modifiée en base depuis la simulation, ignorée (relancez la simulation).`);
    } else {
      console.log(`  + ${label} : « ${nouveau.titre_fiche} » / « ${nouveau.teaser_accueil} »`);
      aAppliquer.push({ fiche, nouveau, contenu });
    }
  }
  console.log(`À mettre à jour : ${aAppliquer.length} fiche(s).`);
  if (aAppliquer.length === 0) return;
  if (!(await confirmerEcriture({ host, question: `Mettre à jour le titre et le teaser de ${aAppliquer.length} fiche(s) ?` }))) {
    console.log("Annulé : rien n'a été écrit.");
    return;
  }

  for (const { fiche, nouveau, contenu } of aAppliquer) {
    await prisma.$transaction([
      prisma.analyse.update({
        where: { id: fiche.analyseId },
        data: {
          contenuComplet: { ...contenu, titre_fiche: nouveau.titre_fiche, teaser_accueil: nouveau.teaser_accueil },
          resumeAccueil: nouveau.teaser_accueil,
        },
      }),
      prisma.proposition.update({ where: { id: fiche.propositionId }, data: { titre: nouveau.titre_fiche } }),
    ]);
    appendJsonLine(INSERTIONS_LOG_PATH, {
      timestamp: new Date().toISOString(),
      type: "titres_raccourcis",
      analyseId: fiche.analyseId,
      propositionId: fiche.propositionId,
      avant: fiche.ancien,
      apres: nouveau,
      source: "logs/titres-proposes.json",
      base: host,
    });
  }
  console.log(`\n${aAppliquer.length} fiche(s) mise(s) à jour. Journal : ${INSERTIONS_LOG_PATH}`);
  // Fiches publiées modifiées : les pages publiques (en cache un jour) sont recalculées.
  await rafraichirSite();
}

try {
  if (values.appliquer) await appliquer();
  else await simuler();
} finally {
  await prisma.$disconnect();
}
