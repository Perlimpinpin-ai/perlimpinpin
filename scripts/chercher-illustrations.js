// Remplit la bibliothèque d'images de thème des carrousels Instagram
// (src/lib/illustrations.js, public/illustrations/). Aucune image n'est
// ajoutée sans validation sur /test/illustrations.
//
//   npm run banque-images:themes
//   node scripts/chercher-illustrations.js --tous
//       → propositions pour tous les thèmes (dont le dossier de secours « general »).
//   node scripts/chercher-illustrations.js <thème>
//       → interroge l'API Wikimedia Commons (gratuite, sans clé ; User-Agent
//         Perlimpinpin) avec 2 ou 3 requêtes du thème, en français et en
//         anglais (REQUETES_COMMONS de src/lib/illustrations.js), et garde
//         8 propositions : photos JPEG, licence CC0, domaine public, CC BY ou
//         CC BY-SA, ≥ 1600 px de large, auteur clair, sans logo, carte,
//         schéma ni personnalité politique dans le titre. Elles sont écrites
//         dans data/illustrations/candidates/<thème>.json (hors de public/,
//         rien n'est mis en ligne) avec leurs crédits. Rien n'est téléchargé.
//   node scripts/chercher-illustrations.js <thème> --pexels
//       → même chose avec l'API Pexels (clé PEXELS_API_KEY dans .env).
//   node scripts/chercher-illustrations.js <thème> --simulation
//       → propositions factices, sans aucun appel.
//   node scripts/chercher-illustrations.js <thème> --telecharger
//       → même effet que le bouton « Garder » de /test/illustrations : lit
//         les propositions cochées (data/illustrations/selection/<thème>.json),
//         les écrit dans public/illustrations/<thème>/<mot-clé>.jpg (JPEG
//         qualité 82, moins de 400 Ko) avec leur version traitée pour la
//         couverture, et les ajoute à src/lib/illustrations.js.
//   node scripts/chercher-illustrations.js --liste
//       → les thèmes, leurs requêtes et le nombre d'images déjà retenues.
import "dotenv/config";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { ILLUSTRATIONS, REGLES_SELECTION, REQUETES_COMMONS, THEMES_ILLUSTRATIONS } from "../src/lib/illustrations.js";
import { nomDepuisSlug, CATEGORIES_COMMONS } from "../src/lib/candidats-commons.js";
import { candidatesDepuisPexels, candidatesSimulees, parRequete } from "./lib/illustrations-pexels.js";
import { API_COMMONS, meilleuresPropositions, PROPOSITIONS_PAR_THEME, propositionsThemeDepuisPages, userAgent } from "./lib/commons.js";
import { garderIllustrations } from "./lib/banque-images-fichiers.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CANDIDATES = join(ROOT, "data", "illustrations", "candidates");
const SELECTION = join(ROOT, "data", "illustrations", "selection");
const USAGE = "Usage : node scripts/chercher-illustrations.js <thème> [--pexels | --simulation | --telecharger]\n   ou : node scripts/chercher-illustrations.js --tous | --liste";

function fail(message) {
  console.error(`Erreur : ${message}`);
  process.exit(1);
}

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    simulation: { type: "boolean", default: false },
    pexels: { type: "boolean", default: false },
    telecharger: { type: "boolean", default: false },
    liste: { type: "boolean", default: false },
    tous: { type: "boolean", default: false },
  },
});

if (values.liste) {
  for (const [theme, { libelle }] of Object.entries(THEMES_ILLUSTRATIONS)) {
    const n = ILLUSTRATIONS.filter((i) => i.theme === theme).length;
    console.log(`${theme.padEnd(28)} ${String(n).padStart(2)} image(s)  ${libelle} : ${(REQUETES_COMMONS[theme] ?? []).map(([r]) => `« ${r} »`).join(", ")}`);
  }
  process.exit(0);
}

const themes = values.tous ? Object.keys(THEMES_ILLUSTRATIONS) : [positionals[0]];
if (!themes[0]) fail(USAGE);
for (const theme of themes) {
  if (!THEMES_ILLUSTRATIONS[theme]) fail(`thème inconnu « ${theme} ». Thèmes : ${Object.keys(THEMES_ILLUSTRATIONS).join(", ")}.`);
}

console.log("Règles de sélection :");
for (const regle of REGLES_SELECTION) console.log(`  - ${regle}`);
console.log("");

if (values.telecharger) {
  if (values.tous) fail("--telecharger se lance thème par thème.");
  const theme = themes[0];
  const fichierSelection = join(SELECTION, `${theme}.json`);
  if (!existsSync(fichierSelection)) fail(`aucune sélection pour « ${theme} » (${fichierSelection}). Cochez les images sur /test/illustrations.`);
  const { retenues = [] } = JSON.parse(readFileSync(fichierSelection, "utf-8"));
  const { faites, erreurs } = await garderIllustrations({ racine: ROOT, theme, retenues, existantes: ILLUSTRATIONS, journal: console.log });
  console.log(`\n${faites.length} image(s) ajoutée(s) à src/lib/illustrations.js (thème « ${theme} »)${erreurs.length ? `, ${erreurs.length} en échec` : ""}.`);
  process.exit(erreurs.length && !faites.length ? 1 : 0);
}

// --- Recherche des propositions ---------------------------------------------------

async function apiCommons(params) {
  const url = `${API_COMMONS}?${new URLSearchParams({ format: "json", formatversion: "2", maxlag: "5", ...params })}`;
  const reponse = await fetch(url, { headers: { "User-Agent": userAgent(), "Api-User-Agent": userAgent() } });
  if (!reponse.ok) throw new Error(`Commons a répondu ${reponse.status}`);
  return reponse.json();
}

// Fichiers de Commons pour une requête : photos (filetype:bitmap), avec leur
// licence, leur auteur et une vignette de 640 px pour la page de validation.
async function pagesCommons(requete) {
  const j = await apiCommons({
    action: "query",
    generator: "search",
    gsrsearch: `${requete} filetype:bitmap`,
    gsrnamespace: "6",
    gsrlimit: "40",
    prop: "imageinfo",
    iiprop: "url|size|mime|extmetadata",
    iiurlwidth: "640",
    iiextmetadatafilter: "LicenseShortName|Artist|LicenseUrl|ImageDescription",
  });
  return j.query?.pages ?? [];
}

const nomsCandidats = Object.keys(CATEGORIES_COMMONS).map(nomDepuisSlug);

async function propositionsCommons(theme) {
  const listes = [];
  for (const [requete, motCle] of REQUETES_COMMONS[theme] ?? []) {
    const { propositions, ecartees } = propositionsThemeDepuisPages(await pagesCommons(requete), { theme, requete, motCle, nomsCandidats });
    console.log(`  « ${requete} » : ${propositions.length} retenue(s), ${ecartees.length} écartée(s)`);
    listes.push(propositions);
  }
  return meilleuresPropositions(listes, PROPOSITIONS_PAR_THEME);
}

async function propositionsPexels(theme, cle) {
  const reponses = [];
  for (const [requete] of THEMES_ILLUSTRATIONS[theme].requetes) {
    const url = `https://api.pexels.com/v1/search?${new URLSearchParams({ query: requete, per_page: String(parRequete(theme)), orientation: "landscape" })}`;
    const reponse = await fetch(url, { headers: { Authorization: cle } });
    if (!reponse.ok) throw new Error(`Pexels a répondu ${reponse.status} pour « ${requete} ».`);
    reponses.push(await reponse.json());
  }
  return candidatesDepuisPexels(theme, reponses);
}

mkdirSync(CANDIDATES, { recursive: true });
for (const theme of themes) {
  console.log(`Thème « ${theme} » (${THEMES_ILLUSTRATIONS[theme].libelle})`);
  let candidates;
  let simulation = values.simulation;
  let source = "Wikimedia Commons";
  try {
    if (simulation) candidates = candidatesSimulees(theme);
    else if (values.pexels) {
      const cle = process.env.PEXELS_API_KEY;
      if (!cle) fail("PEXELS_API_KEY absente du .env (ou lancez sans --pexels pour Wikimedia Commons).");
      source = "Pexels";
      candidates = await propositionsPexels(theme, cle);
    } else candidates = await propositionsCommons(theme);
  } catch (error) {
    console.error(`  ✗ ${error.message}`);
    continue;
  }
  const cible = join(CANDIDATES, `${theme}.json`);
  writeFileSync(cible, `${JSON.stringify({ theme, simulation, source, chercheLe: new Date().toISOString(), candidates }, null, 2)}\n`, "utf-8");
  console.log(`  → ${candidates.length} proposition(s)${simulation ? " simulées" : ""} dans ${cible.replace(ROOT, ".")}\n`);
  if (values.tous) await new Promise((r) => setTimeout(r, 500));
}
console.log("Ouvrez /test/illustrations (serveur local : npm run dev) pour cocher et garder 3 ou 4 images par thème.");
