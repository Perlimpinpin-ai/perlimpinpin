// Remplit la bibliothèque d'images de thème des carrousels Instagram
// (src/lib/illustrations.js, public/illustrations/). Aucune image n'est
// ajoutée sans validation sur /test/illustrations.
//
//   node scripts/chercher-illustrations.js <thème>
//       → interroge l'API Pexels (gratuite ; clé PEXELS_API_KEY dans .env,
//         jamais dans le code) avec les requêtes du thème, garde 20
//         candidates dans data/illustrations/candidates/<thème>.json.
//         Rien n'est téléchargé.
//   node scripts/chercher-illustrations.js <thème> --simulation
//       → même chose avec des candidates factices, sans aucun appel (aussi
//         utilisé automatiquement si la clé manque).
//   node scripts/chercher-illustrations.js <thème> --telecharger
//       → lit les candidates cochées sur /test/illustrations
//         (data/illustrations/selection/<thème>.json), les télécharge dans
//         public/illustrations/<thème>/<mot-clé>.jpg (1600 px de large au
//         plus) et ajoute leurs entrées à src/lib/illustrations.js.
//   node scripts/chercher-illustrations.js --liste
//       → les thèmes, leurs requêtes et le nombre d'images déjà retenues.
//
// Licence Pexels : usage libre, sans attribution obligatoire. Le crédit est
// quand même gardé dans src/lib/illustrations.js et dans legende.txt.
import "dotenv/config";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import sharp from "sharp";
import { ILLUSTRATIONS, REGLES_SELECTION, THEMES_ILLUSTRATIONS } from "../src/lib/illustrations.js";
import { candidatesDepuisPexels, candidatesSimulees, entreesBibliotheque, parRequete, reecrireListe } from "./lib/illustrations-pexels.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CANDIDATES = join(ROOT, "data", "illustrations", "candidates");
const SELECTION = join(ROOT, "data", "illustrations", "selection");
const LISTE = join(ROOT, "src", "lib", "illustrations.js");
const USAGE = "Usage : node scripts/chercher-illustrations.js <thème> [--simulation | --telecharger]\n   ou : node scripts/chercher-illustrations.js --liste";

function fail(message) {
  console.error(`Erreur : ${message}`);
  process.exit(1);
}

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { simulation: { type: "boolean", default: false }, telecharger: { type: "boolean", default: false }, liste: { type: "boolean", default: false } },
});

if (values.liste) {
  for (const [theme, { libelle, requetes }] of Object.entries(THEMES_ILLUSTRATIONS)) {
    const n = ILLUSTRATIONS.filter((i) => i.theme === theme).length;
    console.log(`${theme.padEnd(28)} ${String(n).padStart(2)} image(s)  ${libelle} : ${requetes.map(([r]) => `« ${r} »`).join(", ")}`);
  }
  process.exit(0);
}

const theme = positionals[0];
if (!theme) fail(USAGE);
if (!THEMES_ILLUSTRATIONS[theme]) fail(`thème inconnu « ${theme} ». Thèmes : ${Object.keys(THEMES_ILLUSTRATIONS).join(", ")}.`);

console.log("Règles de sélection :");
for (const regle of REGLES_SELECTION) console.log(`  - ${regle}`);
console.log("");

if (values.telecharger) {
  const fichierSelection = join(SELECTION, `${theme}.json`);
  if (!existsSync(fichierSelection)) fail(`aucune sélection pour « ${theme} » (${fichierSelection}). Cochez les images sur /test/illustrations.`);
  const { retenues = [] } = JSON.parse(readFileSync(fichierSelection, "utf-8"));
  const entrees = entreesBibliotheque(theme, retenues, ILLUSTRATIONS);
  if (entrees.length === 0) {
    console.log("Rien à télécharger (sélection vide, candidates simulées ou images déjà présentes).");
    process.exit(0);
  }
  mkdirSync(join(ROOT, "public", "illustrations", theme), { recursive: true });
  const faites = [];
  for (const entree of entrees) {
    try {
      const reponse = await fetch(entree.telechargement);
      if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
      const octets = Buffer.from(await reponse.arrayBuffer());
      await sharp(octets).rotate().resize({ width: 1600, withoutEnlargement: true }).jpeg({ quality: 84 }).toFile(join(ROOT, "public", entree.fichier));
      faites.push(entree);
      console.log(`✓ ${entree.fichier}  (${entree.auteur}, ${entree.lien})`);
    } catch (error) {
      console.error(`✗ ${entree.telechargement} : ${error.message}`);
    }
  }
  writeFileSync(LISTE, reecrireListe(readFileSync(LISTE, "utf-8"), [...ILLUSTRATIONS, ...faites]), "utf-8");
  console.log(`\n${faites.length} image(s) ajoutée(s) à src/lib/illustrations.js (thème « ${theme} »).`);
  process.exit(0);
}

// Recherche des candidates.
const cle = process.env.PEXELS_API_KEY;
const simulation = values.simulation || !cle;
if (!values.simulation && !cle) console.log("PEXELS_API_KEY absente du .env : recherche simulée (candidates factices, aucun appel).\n");

let candidates;
if (simulation) {
  candidates = candidatesSimulees(theme);
} else {
  const reponses = [];
  for (const [requete] of THEMES_ILLUSTRATIONS[theme].requetes) {
    const url = `https://api.pexels.com/v1/search?${new URLSearchParams({ query: requete, per_page: String(parRequete(theme)), orientation: "landscape" })}`;
    const reponse = await fetch(url, { headers: { Authorization: cle } });
    if (!reponse.ok) fail(`Pexels a répondu ${reponse.status} pour « ${requete} ».`);
    reponses.push(await reponse.json());
    console.log(`« ${requete} » : ${reponses.at(-1).photos?.length ?? 0} résultat(s)`);
  }
  candidates = candidatesDepuisPexels(theme, reponses);
}

mkdirSync(CANDIDATES, { recursive: true });
const cible = join(CANDIDATES, `${theme}.json`);
writeFileSync(cible, `${JSON.stringify({ theme, simulation, chercheLe: new Date().toISOString(), candidates }, null, 2)}\n`, "utf-8");
console.log(`\n${candidates.length} candidate(s)${simulation ? " simulées" : ""} dans ${cible}.`);
console.log(`Ouvrez /test/illustrations?theme=${theme} pour cocher celles à garder, puis :\n  node scripts/chercher-illustrations.js ${theme} --telecharger`);
