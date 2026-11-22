// Cartes pixel des pays pour les Reels (scène `pays`), pré-générées une fois
// pour toutes : rien n'est calculé sur Vercel.
//
//   node scripts/carte-pays.js                    toutes les cartes de src/lib/reel-pays.js
//   node scripts/carte-pays.js nl                 un pays de la liste
//   node scripts/carte-pays.js nl 26 3.2,7.3,50.7,53.6   largeur en cases, cadrage
//
// Produit, pour chaque pays :
//   public/reel/cartes/<cle>.json   la grille (« # » plein, « . » vide), lue
//                                   par le rendu, qui la colore en vert ou en rouge ;
//   public/reel/cartes/<cle>.png    aperçu en vert (pour vérifier d'un coup d'œil).
// Méthode du kit Reel (carte-pays.js) : contour du pays (world-atlas, 1:50 m),
// projection équirectangulaire corrigée de la latitude, case pleine si au moins
// 3 de ses 9 points d'échantillonnage sont dans le pays.
// Dépendances (développement seulement) : world-atlas, topojson-client.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { feature } from "topojson-client";
import sharp from "sharp";
import { PAYS_REEL, paysParCle } from "../src/lib/reel-pays.js";
import { COULEURS, dataUriCarte } from "../src/lib/reel-pixel.js";

const require = createRequire(import.meta.url);
const topo = JSON.parse(readFileSync(require.resolve("world-atlas/countries-50m.json"), "utf8"));
const pays = feature(topo, topo.objects.countries).features;
const DOSSIER = join("public", "reel", "cartes");
const LARGEUR_PAR_DEFAUT = 26;

export function grillePays(iso, largeur = LARGEUR_PAR_DEFAUT, cadrage = null) {
  const f = pays.find((x) => Number(x.id) === Number(iso));
  if (!f) throw new Error(`Pays introuvable pour le code ISO ${iso}.`);
  const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  let [lon0, lon1, lat0, lat1] = [180, -180, 90, -90];
  for (const p of polys)
    for (const [x, y] of p[0]) {
      lon0 = Math.min(lon0, x);
      lon1 = Math.max(lon1, x);
      lat0 = Math.min(lat0, y);
      lat1 = Math.max(lat1, y);
    }
  if (cadrage) [lon0, lon1, lat0, lat1] = cadrage.split(",").map(Number);
  const k = Math.cos((((lat0 + lat1) / 2) * Math.PI) / 180);
  const W = largeur;
  const H = Math.max(1, Math.round(((lat1 - lat0) / ((lon1 - lon0) * k)) * W));
  const dedans = (x, y) => {
    let c = false;
    for (const p of polys)
      for (const anneau of p)
        for (let i = 0, j = anneau.length - 1; i < anneau.length; j = i++) {
          const [xi, yi] = anneau[i];
          const [xj, yj] = anneau[j];
          if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
        }
    return c;
  };
  const lignes = [];
  for (let r = 0; r < H; r++) {
    let s = "";
    for (let q = 0; q < W; q++) {
      let n = 0;
      for (let a = 0; a < 3; a++)
        for (let b = 0; b < 3; b++) {
          const x = lon0 + ((q + (b + 0.5) / 3) / W) * (lon1 - lon0);
          const y = lat1 - ((r + (a + 0.5) / 3) / H) * (lat1 - lat0);
          if (dedans(x, y)) n++;
        }
      s += n >= 3 ? "#" : ".";
    }
    lignes.push(s);
  }
  // Retire les lignes et colonnes vides du bord.
  while (lignes.length && !lignes[0].includes("#")) lignes.shift();
  while (lignes.length && !lignes.at(-1).includes("#")) lignes.pop();
  const colonnes = lignes[0]?.length ?? 0;
  let gauche = 0;
  let droite = colonnes - 1;
  while (gauche < droite && lignes.every((l) => l[gauche] === ".")) gauche++;
  while (droite > gauche && lignes.every((l) => l[droite] === ".")) droite--;
  return lignes.map((l) => l.slice(gauche, droite + 1));
}

async function ecrire(cle, grille) {
  mkdirSync(DOSSIER, { recursive: true });
  writeFileSync(join(DOSSIER, `${cle}.json`), `${JSON.stringify(grille)}\n`);
  const svg = dataUriCarte(grille, COULEURS.vert, 12);
  const octets = Buffer.from(svg.src.split(",")[1], "base64");
  await sharp(octets).png({ compressionLevel: 9 }).toFile(join(DOSSIER, `${cle}.png`));
  console.log(`${cle} : ${grille[0].length} × ${grille.length} cases → ${join(DOSSIER, `${cle}.json`)} (+ .png)`);
}

const [cle, largeurArg, cadrageArg] = process.argv.slice(2);
const liste = cle ? [paysParCle(cle)] : PAYS_REEL;
if (cle && !liste[0]) {
  console.error(`Clé « ${cle} » absente de src/lib/reel-pays.js (ajoutez-y le pays, son code ISO et ses noms).`);
  process.exit(1);
}
for (const p of liste) {
  await ecrire(p.cle, grillePays(p.iso, Number(largeurArg) || LARGEUR_PAR_DEFAUT, cadrageArg ?? p.cadrage ?? null));
}
