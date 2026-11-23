// Contrôle de la banque d'images des couvertures de carrousels.
//
//   npm run banque-images:verifier
//
// Affiche, en clair, pour chaque thème et chaque candidat : le nombre
// d'images (objectif : 3 ou 4 par thème, 3 par candidat), ce qui manque, les
// crédits incomplets ou non autorisés, les fichiers absents, et la taille des
// images de thème (1080 px de large au moins, moins de 400 Ko). Signale aussi
// les photos déposées à la main pas encore importées.
// Lecture seule : rien n'est modifié, aucune base, aucun appel réseau.
// Code de sortie 1 s'il reste un problème (crédit, fichier, taille) ; les
// images manquantes seules ne font pas échouer.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { bilanBanque, IMAGES_THEME_MAX, IMAGES_THEME_MIN, PHOTOS_CANDIDAT_MIN } from "../src/lib/banque-images.js";
import { ILLUSTRATIONS, THEMES_ILLUSTRATIONS } from "../src/lib/illustrations.js";
import { CATEGORIES_COMMONS } from "../src/lib/candidats-commons.js";
import { cheminIllustrationTraitee } from "../src/lib/images-carrousel.js";
import { POIDS_MAX } from "./lib/banque-images-fichiers.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LARGEUR_MIN_FICHIER = 1080;
const existe = (chemin) => existsSync(join(ROOT, "public", chemin));

const bilan = bilanBanque({
  themes: Object.keys(THEMES_ILLUSTRATIONS),
  slugs: Object.keys(CATEGORIES_COMMONS),
  existe,
  cheminTraitee: cheminIllustrationTraitee,
});

// Taille des images de thème présentes.
const problemesTaille = new Map();
for (const ill of ILLUSTRATIONS) {
  if (!existe(ill.fichier)) continue;
  const chemin = join(ROOT, "public", ill.fichier);
  const { width } = await sharp(chemin).metadata();
  const poids = statSync(chemin).size;
  const liste = [];
  if ((width ?? 0) < LARGEUR_MIN_FICHIER) liste.push(`${ill.fichier} : ${width} px de large (${LARGEUR_MIN_FICHIER} au moins)`);
  if (poids > POIDS_MAX) liste.push(`${ill.fichier} : ${Math.round(poids / 1024)} Ko (400 Ko au plus)`);
  if (liste.length) problemesTaille.set(ill.theme, [...(problemesTaille.get(ill.theme) ?? []), ...liste]);
}

// Photos déposées à la main, pas encore importées.
function depotsEnAttente(slug) {
  const dossier = join(ROOT, "data", "photos-candidats", "a-importer", slug);
  if (!existsSync(dossier)) return 0;
  return readdirSync(dossier).filter((f) => /\.(jpe?g|png)$/i.test(f)).length;
}

let problemes = 0;
function afficher(titre, lignes, min, extra = () => []) {
  console.log(`\n${titre}`);
  for (const l of lignes) {
    const tous = [...l.problemes, ...extra(l.slug)];
    problemes += tous.length;
    const etat = l.manque ? `manque ${l.manque}` : "complet";
    console.log(`  ${tous.length ? "✗" : l.manque ? "·" : "✓"} ${l.slug.padEnd(28)} ${String(l.n).padStart(2)}/${min}  ${etat}`);
    for (const p of tous) console.log(`      - ${p}`);
  }
}

afficher(`Images de thème (objectif : ${IMAGES_THEME_MIN} ou ${IMAGES_THEME_MAX} par thème ; « general » sert de secours)`, bilan.themes, IMAGES_THEME_MIN, (t) => problemesTaille.get(t) ?? []);
afficher(`Photos des candidats (objectif : ${PHOTOS_CANDIDAT_MIN} par candidat)`, bilan.candidats, PHOTOS_CANDIDAT_MIN, (s) => {
  const n = depotsEnAttente(s);
  return n ? [`${n} photo(s) déposée(s) dans data/photos-candidats/a-importer/${s}/ pas encore importée(s) : node scripts/chercher-photos-candidats.js ${s} --importer`] : [];
});

const manquantes = [...bilan.themes, ...bilan.candidats].reduce((t, l) => t + l.manque, 0);
console.log(`\n${problemes ? `✗ ${problemes} problème(s) à corriger` : "✓ Aucun problème de crédit, de fichier ni de taille"} · ${manquantes} image(s) manquante(s) pour atteindre les objectifs.`);
if (!readFileSync(join(ROOT, "src", "lib", "illustrations.js"), "utf-8").includes("DEBUT LISTE ILLUSTRATIONS")) console.log("Attention : repères de la liste absents de src/lib/illustrations.js.");
process.exitCode = problemes ? 1 : 0;
