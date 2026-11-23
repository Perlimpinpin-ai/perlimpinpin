// Prépare, une fois et en local (jamais sur Vercel), les images du carrousel
// détaillé que le moteur de rendu (next/og : Satori puis resvg) ne sait pas
// produire lui-même. Le rendu ne fait ensuite qu'empiler ces fichiers.
//
//   node scripts/preparer-images-carrousel.js
//       → public/carrousel/papier-dechire.png (papier jaune tramé déchiré, le même pour tous)
//       → public/carrousel/grain.png (grain des fonds)
//       → public/illustrations/<thème>/traitees/<nom>.png pour chaque image de la
//         bibliothèque (src/lib/illustrations.js) : noir et blanc teinté de jaune, tramé
//       → public/carrousel/vignettes-nb/<slug>.jpg (repli sans photo détourée)
//   node scripts/preparer-images-carrousel.js --finir <détouré.png> <sortie.png>
//       → applique à un PNG déjà détouré le traitement du candidat (noir et blanc,
//         grain, liseré blanc) ; scripts/detourer-candidats.py fait le même
//         traitement pour les photos Commons.
// Fichiers déjà présents : refaits seulement avec --forcer.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { ILLUSTRATIONS } from "../src/lib/illustrations.js";
import { CHEMIN_GRAIN, CHEMIN_PAPIER, cheminIllustrationTraitee } from "../src/lib/images-carrousel.js";
import { finirCandidat, grain, illustrationJaune, papierDechire, tirageVignette } from "./lib/traitement-images.js";

const PUBLIC = "public";
const forcer = process.argv.includes("--forcer");

function ecrire(chemin, octets) {
  mkdirSync(dirname(chemin), { recursive: true });
  writeFileSync(chemin, octets);
  console.log(`✓ ${chemin.replace(/\\/g, "/")}`);
}

async function preparer(chemin, fabrique) {
  const cible = join(PUBLIC, chemin);
  if (existsSync(cible) && !forcer) return console.log(`· ${cible.replace(/\\/g, "/")} (déjà là)`);
  ecrire(cible, await fabrique());
}

const i = process.argv.indexOf("--finir");
if (i >= 0) {
  const [entree, sortie] = process.argv.slice(i + 1, i + 3);
  if (!entree || !sortie) throw new Error("Usage : --finir <détouré.png> <sortie.png>");
  ecrire(sortie, await finirCandidat(readFileSync(entree)));
} else {
  await preparer(CHEMIN_PAPIER, papierDechire);
  await preparer(CHEMIN_GRAIN, grain);
  for (const ill of ILLUSTRATIONS) {
    const source = join(PUBLIC, ill.fichier);
    if (!existsSync(source)) {
      console.log(`✗ ${ill.fichier} absente : image de la bibliothèque à télécharger d'abord.`);
      continue;
    }
    await preparer(cheminIllustrationTraitee(ill.fichier), () => illustrationJaune(readFileSync(source)));
  }
  if (ILLUSTRATIONS.length === 0) console.log("· Bibliothèque d'illustrations vide : rien à traiter (node scripts/chercher-illustrations.js <thème>).");
  for (const fichier of readdirSync(join(PUBLIC, "photos")).filter((f) => f.endsWith(".jpg"))) {
    const slug = fichier.replace(/\.jpg$/, "");
    await preparer(join("carrousel", "vignettes-nb", `${slug}.jpg`), () => tirageVignette(readFileSync(join(PUBLIC, "photos", fichier))));
  }
}
