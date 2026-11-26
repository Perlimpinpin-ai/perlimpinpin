// Prépare, une fois pour toutes, les images fixes des Reels (v5, charte
// graphique RS : écran pixel mid-century sur fond charbon). next/og ne sait
// ni flouter, ni tramer, ni répéter un motif : tout est dessiné ici, avec
// sharp (déjà installé avec Next), puis lu tel quel. Tient lieu du
// preparer-photos.py du kit Reel (même méthode : tramage Floyd–Steinberg en
// deux tons).
//
//   node scripts/reel-ressources.js
//
// 1. public/reel/v5/fond.png    fond charbon #17130F, grain obligatoire (en
//                               petits carrés), grille de pixels discrète ;
//    public/reel/v5/voile.png   lignes de balayage discrètes et coins
//                               assombris (posé par-dessus, transparent) ;
//    public/reel/v5/trame.png   panneau tramé charbon / moutarde (remplace
//                               une illustration manquante).
// 2. Candidats, tramés charbon / crème, fond transparent gardé (fenêtres sur
//    charbon, médaillons sur la couleur du candidat) :
//    public/reel/photos/candidats/<slug>-pixel.png et <slug>-mosaique.png.
//    Source, dans l'ordre : la bibliothèque validée du carrousel
//    (src/lib/photos-candidats.js, public/carrousel/candidats/<slug>/<n>.png,
//    photos Commons détourées) ; à défaut, comme le carrousel, la vignette
//    actuelle du site (portrait détouré public/portraits-bleus/<slug>.png,
//    sinon public/photos/<slug>.jpg découpée selon data/detourages/<slug>.json).
//    On ne retouche jamais le visage : tramage seul.
// 3. Images de thème de la banque du carrousel (src/lib/illustrations.js,
//    Wikimedia Commons, validées à la main), tramées charbon / moutarde :
//    public/illustrations/<thème>/<nom>.jpg
//      → public/reel/photos/themes/<thème>/<nom>-pixel.png et -mosaique.png.
// Les pixels sont agrandis sans lissage (plus proche voisin) : l'image reste
// nette à l'écran, sans compter sur `image-rendering`, que next/og ignore.
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { join, parse } from "node:path";
import sharp from "sharp";
import { COULEURS_REELS } from "../src/lib/charte-rs.js";
import { ILLUSTRATIONS } from "../src/lib/illustrations.js";
import { PHOTOS_CANDIDATS, photosDuCandidat } from "../src/lib/photos-candidats.js";

const L = 1080;
const H = 1920;
const V5 = join("public", "reel", "v5");
const CANDIDATS = join("public", "reel", "photos", "candidats");
const THEMES = join("public", "reel", "photos", "themes");

const rvb = (hex) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
const CHARBON = rvb(COULEURS_REELS.charbon);
const CREME = rvb(COULEURS_REELS.creme);
const MOUTARDE = rvb(COULEURS_REELS.moutarde);

function graine(s) {
  let x = s;
  return () => (x = (x * 16807) % 2147483647) / 2147483647;
}

// --- 1. Fond, voile, trame ---------------------------------------------------------

async function fonds() {
  mkdirSync(V5, { recursive: true });
  // Fond : charbon, grain en carrés de 3 px (plus clair ou plus sombre), grille
  // de 24 px très discrète. Niveaux fixes : PNG en palette, léger.
  const alea = graine(11);
  const cote = 3;
  const gw = Math.ceil(L / cote);
  const gh = Math.ceil(H / cote);
  const grain = new Int8Array(gw * gh);
  for (let i = 0; i < grain.length; i++) {
    const v = alea();
    grain[i] = v < 0.16 ? 1 : v > 0.88 ? -1 : 0;
  }
  const brut = Buffer.alloc(L * H * 3);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < L; x++) {
      const g = grain[Math.floor(y / cote) * gw + Math.floor(x / cote)];
      const grille = x % 24 < 2 || y % 24 < 2 ? 1 : 0;
      const k = 0.045 * g + 0.028 * grille; // vers le crème (positif) ou le noir (négatif)
      const c = CHARBON.map((v, j) => Math.round(k >= 0 ? v + (CREME[j] - v) * k : v * (1 + k)));
      brut.set(c, (y * L + x) * 3);
    }
  await sharp(brut, { raw: { width: L, height: H, channels: 3 } }).png({ compressionLevel: 9, palette: true, colors: 16 }).toFile(join(V5, "fond.png"));

  const voile = `<svg xmlns="http://www.w3.org/2000/svg" width="${L}" height="${H}">
    <defs>
      <pattern id="b" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="2" fill="#000" fill-opacity=".08"/></pattern>
      <radialGradient id="c" cx="50%" cy="45%" r="75%"><stop offset=".62" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></radialGradient>
    </defs>
    <rect width="${L}" height="${H}" fill="url(#b)"/><rect width="${L}" height="${H}" fill="url(#c)"/>
  </svg>`;
  await sharp(Buffer.from(voile)).png({ compressionLevel: 9 }).toFile(join(V5, "voile.png"));

  // Trame : bruit ordonné moutarde sur charbon, en cases de 8 px.
  const w = 120;
  const h = 90;
  const panneau = Buffer.alloc(w * h * 3);
  const a2 = graine(7);
  for (let i = 0; i < w * h; i++) {
    const x = i % w;
    const y = Math.floor(i / w);
    const v = 0.5 + 0.35 * Math.sin(x / 9) * Math.cos(y / 7) + (a2() - 0.5) * 0.5;
    panneau.set(v > 0.62 ? MOUTARDE : CHARBON, i * 3);
  }
  await sharp(panneau, { raw: { width: w, height: h, channels: 3 } }).resize(w * 8, h * 8, { kernel: "nearest" }).png({ compressionLevel: 9 }).toFile(join(V5, "trame.png"));
  console.log(`${V5}/fond.png, voile.png, trame.png`);
}

// --- 2 et 3. Photos tramées ----------------------------------------------------------

// Image (sharp) → pixels RGBA à la largeur donnée.
async function rgba(image, largeur) {
  const { data, info } = await image.ensureAlpha().resize({ width: largeur, kernel: "lanczos3" }).raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

// Tramage Floyd–Steinberg en deux tons ; le transparent reste transparent.
function tramer({ data, w, h }, sombre, clair, { eclat = 1 } = {}) {
  const gris = new Float32Array(w * h);
  let min = 255;
  let max = 0;
  for (let i = 0; i < w * h; i++) {
    const g = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
    gris[i] = g;
    if (data[i * 4 + 3] > 128) {
      min = Math.min(min, g);
      max = Math.max(max, g);
    }
  }
  const etendue = Math.max(1, max - min);
  for (let i = 0; i < w * h; i++) gris[i] = Math.min(255, Math.max(0, (((gris[i] - min) / etendue) * 255 * eclat - 128) * 1.25 + 128));
  const sortie = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const ancien = gris[i];
      const nouveau = ancien > 127 ? 255 : 0;
      const erreur = ancien - nouveau;
      if (x + 1 < w) gris[i + 1] += (erreur * 7) / 16;
      if (y + 1 < h) {
        if (x > 0) gris[i + w - 1] += (erreur * 3) / 16;
        gris[i + w] += (erreur * 5) / 16;
        if (x + 1 < w) gris[i + w + 1] += erreur / 16;
      }
      const opaque = data[i * 4 + 3] > 128;
      sortie.set([...(nouveau ? clair : sombre), opaque ? 255 : 0], i * 4);
    }
  return sortie;
}

// Grosse mosaïque (image « qui se charge ») : dégradé charbon → clair.
function mosaique({ data, w, h }, clair) {
  const sortie = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const v = (0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]) / 255;
    const c = CHARBON.map((s, k) => Math.round(s + (clair[k] - s) * v));
    sortie.set([...c, data[i * 4 + 3] > 128 ? 255 : 0], i * 4);
  }
  return sortie;
}

async function ecrirePixels(brut, w, h, facteur, cible) {
  await sharp(brut, { raw: { width: w, height: h, channels: 4 } }).resize(w * facteur, h * facteur, { kernel: "nearest" }).png({ compressionLevel: 9, palette: true }).toFile(cible);
}

async function photo(source, cibleBase, clair, options = {}) {
  const fin = await rgba(source.clone(), 200);
  await ecrirePixels(tramer(fin, CHARBON, clair, options), fin.w, fin.h, 4, `${cibleBase}-pixel.png`);
  const gros = await rgba(source.clone(), 20);
  await ecrirePixels(mosaique(gros, clair), gros.w, gros.h, 40, `${cibleBase}-mosaique.png`);
  console.log(`→ ${cibleBase}-pixel.png, ${cibleBase}-mosaique.png`);
}

async function sourceCandidat(slug) {
  const validee = photosDuCandidat(slug, PHOTOS_CANDIDATS)[0];
  if (validee && existsSync(join("public", validee.fichier))) return { image: sharp(join("public", validee.fichier)).trim(), origine: `bibliothèque ${validee.fichier}` };
  const detoure = join("public", "portraits-bleus", `${slug}.png`);
  if (existsSync(detoure)) return { image: sharp(detoure).trim(), origine: `vignette du site ${detoure}` };
  const illustration = join("public", "photos", `${slug}.jpg`);
  const trace = join("data", "detourages", `${slug}.json`);
  if (existsSync(trace) && existsSync(illustration)) {
    const { contour, taille: [largeur, hauteur] } = JSON.parse(readFileSync(trace, "utf-8"));
    const forme = `<svg xmlns="http://www.w3.org/2000/svg" width="${largeur}" height="${hauteur}"><polygon points="${contour.map((p) => p.join(",")).join(" ")}" fill="#fff"/></svg>`;
    const alpha = await sharp(Buffer.from(forme)).extractChannel(0).toBuffer();
    const rvbImage = await sharp(illustration).resize(largeur, hauteur, { fit: "cover" }).removeAlpha().toBuffer();
    return { image: sharp(await sharp(rvbImage).joinChannel(alpha).png().toBuffer()), origine: `vignette du site ${illustration} + ${trace}` };
  }
  if (existsSync(illustration)) return { image: sharp(illustration), origine: `vignette du site ${illustration}` };
  return null;
}

async function candidats() {
  mkdirSync(CANDIDATS, { recursive: true });
  const slugs = new Set([
    ...readdirSync(join("public", "photos")).filter((f) => f.endsWith(".jpg")).map((f) => parse(f).name),
    ...readdirSync(join("public", "portraits-bleus")).filter((f) => f.endsWith(".png")).map((f) => parse(f).name),
  ]);
  for (const slug of [...slugs].sort()) {
    const source = await sourceCandidat(slug);
    if (!source) continue;
    process.stdout.write(`${source.origine} `);
    await photo(source.image, join(CANDIDATS, slug), CREME);
  }
}

async function illustrations() {
  for (const ill of ILLUSTRATIONS) {
    const source = join("public", ill.fichier);
    if (!existsSync(source)) {
      console.log(`Absente : ${source}`);
      continue;
    }
    const { dir, name } = parse(ill.fichier);
    const dossier = join(THEMES, parse(dir).name);
    mkdirSync(dossier, { recursive: true });
    process.stdout.write(`${source} `);
    await photo(sharp(source).resize(1200, 900, { fit: "cover", position: "attention" }), join(dossier, name), MOUTARDE, { eclat: 1.2 });
  }
}

await fonds();
await candidats();
await illustrations();
