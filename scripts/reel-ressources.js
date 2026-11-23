// Prépare, une fois pour toutes, les images fixes des Reels (storyboard v4).
// next/og ne sait ni flouter, ni tramer, ni répéter un motif : tout est
// dessiné ici, avec sharp (déjà installé avec Next), puis lu tel quel.
//
//   node scripts/reel-ressources.js
//
// 1. public/reel/v4/fond.png    fond presque noir #0B0A10, grille de pixels,
//                               lueurs très légères (violet en haut, rose en bas) ;
//    public/reel/v4/voile.png   fines lignes de balayage et coins assombris
//                               (posé par-dessus l'image, transparent) ;
//    public/reel/v4/trame.png   panneau tramé jaune sur violet foncé (remplace
//                               une illustration manquante).
// 2. Photos des candidats, tramées en pixels, lavande sur violet foncé :
//    public/reel/photos/candidats/<slug>-pixel.png et <slug>-mosaique.png.
//    Source : portrait détouré (public/portraits-bleus/<slug>.png), sinon
//    l'illustration du site découpée selon data/detourages/<slug>.json (comme le
//    carrousel), sinon l'illustration entière (public/photos/<slug>.jpg).
// 3. Illustrations des thèmes, tramées jaune sur violet foncé :
//    public/illustrations/<slug du thème>.(jpg|png|webp)
//      → public/reel/photos/themes/<slug>-pixel.png et <slug>-mosaique.png.
//    Crédit à noter dans public/illustrations/credits.json ({ "<slug>": "Photo : … / Pexels" }).
// Les pixels sont agrandis sans lissage (plus proche voisin) : l'image reste
// nette à l'écran, sans compter sur `image-rendering`, que next/og ignore.
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { join, parse } from "node:path";
import sharp from "sharp";

const L = 1080;
const H = 1920;
const V4 = join("public", "reel", "v4");
const CANDIDATS = join("public", "reel", "photos", "candidats");
const THEMES = join("public", "reel", "photos", "themes");
const ENCRE = [27, 13, 64];
const LAVANDE = [236, 230, 255];
const JAUNE = [255, 210, 63];
const VIOLET_FONCE = [42, 17, 112];

// --- 1. Fond, voile, trame ---------------------------------------------------------

async function fonds() {
  mkdirSync(V4, { recursive: true });
  const fond = `<svg xmlns="http://www.w3.org/2000/svg" width="${L}" height="${H}">
    <defs>
      <radialGradient id="v" cx="18%" cy="12%" r="60%"><stop offset="0" stop-color="#8C6BFF" stop-opacity=".17"/><stop offset="1" stop-color="#8C6BFF" stop-opacity="0"/></radialGradient>
      <radialGradient id="r" cx="88%" cy="90%" r="55%"><stop offset="0" stop-color="#FF5FD2" stop-opacity=".11"/><stop offset="1" stop-color="#FF5FD2" stop-opacity="0"/></radialGradient>
      <pattern id="g" width="24" height="24" patternUnits="userSpaceOnUse"><rect width="24" height="3" fill="#fff" fill-opacity=".045"/><rect width="3" height="24" fill="#fff" fill-opacity=".045"/></pattern>
    </defs>
    <rect width="${L}" height="${H}" fill="#0B0A10"/><rect width="${L}" height="${H}" fill="url(#v)"/><rect width="${L}" height="${H}" fill="url(#r)"/><rect width="${L}" height="${H}" fill="url(#g)"/>
  </svg>`;
  await sharp(Buffer.from(fond)).png({ compressionLevel: 9 }).toFile(join(V4, "fond.png"));

  const voile = `<svg xmlns="http://www.w3.org/2000/svg" width="${L}" height="${H}">
    <defs>
      <pattern id="b" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="2" fill="#000" fill-opacity=".14"/></pattern>
      <radialGradient id="c" cx="50%" cy="45%" r="75%"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></radialGradient>
    </defs>
    <rect width="${L}" height="${H}" fill="url(#b)"/><rect width="${L}" height="${H}" fill="url(#c)"/>
  </svg>`;
  await sharp(Buffer.from(voile)).png({ compressionLevel: 9 }).toFile(join(V4, "voile.png"));

  // Trame : bruit ordonné jaune sur violet foncé, en cases de 8 px.
  const w = 120;
  const h = 90;
  const brut = Buffer.alloc(w * h * 3);
  let s = 7;
  for (let i = 0; i < w * h; i++) {
    s = (s * 16807) % 2147483647;
    const x = i % w;
    const y = Math.floor(i / w);
    const v = 0.5 + 0.35 * Math.sin(x / 9) * Math.cos(y / 7) + (s / 2147483647 - 0.5) * 0.5;
    const c = v > 0.62 ? JAUNE : VIOLET_FONCE;
    brut.set(c, i * 3);
  }
  await sharp(brut, { raw: { width: w, height: h, channels: 3 } }).resize(w * 8, h * 8, { kernel: "nearest" }).png({ compressionLevel: 9 }).toFile(join(V4, "trame.png"));
  console.log(`${V4}/fond.png, voile.png, trame.png`);
}

// --- 2 et 3. Photos tramées ----------------------------------------------------------

// Image (sharp) → pixels RGBA à la largeur donnée.
async function rgba(image, largeur) {
  const { data, info } = await image.ensureAlpha().resize({ width: largeur, kernel: "lanczos3" }).raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

// Tramage Floyd–Steinberg en deux tons (méthode du kit, preparer-photos.py) ;
// le transparent devient violet foncé.
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
  for (let i = 0; i < w * h; i++) gris[i] = Math.min(255, Math.max(0, ((((gris[i] - min) / etendue) * 255 * eclat - 128) * 1.25 + 128)));
  const sortie = Buffer.alloc(w * h * 3);
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
      const couleur = data[i * 4 + 3] <= 128 ? VIOLET_FONCE : nouveau ? clair : sombre;
      sortie.set(couleur, i * 3);
    }
  return sortie;
}

// Grosse mosaïque (image « qui se charge ») : dégradé encre → clair.
function mosaique({ data, w, h }, clair) {
  const sortie = Buffer.alloc(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    const v = (0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]) / 255;
    const couleur = data[i * 4 + 3] <= 128 ? VIOLET_FONCE : ENCRE.map((c, k) => Math.round(c + (clair[k] - c) * v));
    sortie.set(couleur, i * 3);
  }
  return sortie;
}

async function ecrirePixels(brut, w, h, facteur, cible) {
  await sharp(brut, { raw: { width: w, height: h, channels: 3 } }).resize(w * facteur, h * facteur, { kernel: "nearest" }).png({ compressionLevel: 9, palette: true }).toFile(cible);
}

async function photo(source, cibleBase, clair, options = {}) {
  const fin = await rgba(source.clone(), 200);
  await ecrirePixels(tramer(fin, ENCRE, clair, options), fin.w, fin.h, 4, `${cibleBase}-pixel.png`);
  const gros = await rgba(source.clone(), 20);
  await ecrirePixels(mosaique(gros, clair), gros.w, gros.h, 40, `${cibleBase}-mosaique.png`);
  console.log(`→ ${cibleBase}-pixel.png, ${cibleBase}-mosaique.png`);
}

async function sourceCandidat(slug) {
  const detoure = join("public", "portraits-bleus", `${slug}.png`);
  if (existsSync(detoure)) return { image: sharp(detoure).trim(), origine: detoure };
  const illustration = join("public", "photos", `${slug}.jpg`);
  const trace = join("data", "detourages", `${slug}.json`);
  if (existsSync(trace) && existsSync(illustration)) {
    const { contour, taille: [largeur, hauteur] } = JSON.parse(readFileSync(trace, "utf-8"));
    const forme = `<svg xmlns="http://www.w3.org/2000/svg" width="${largeur}" height="${hauteur}"><polygon points="${contour.map((p) => p.join(",")).join(" ")}" fill="#fff"/></svg>`;
    const alpha = await sharp(Buffer.from(forme)).extractChannel(0).toBuffer();
    const rvb = await sharp(illustration).resize(largeur, hauteur, { fit: "cover" }).removeAlpha().toBuffer();
    return { image: sharp(await sharp(rvb).joinChannel(alpha).png().toBuffer()), origine: `${illustration} + ${trace}` };
  }
  if (existsSync(illustration)) return { image: sharp(illustration), origine: illustration };
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
    await photo(source.image, join(CANDIDATS, slug), LAVANDE);
  }
}

async function illustrations() {
  const dossier = join("public", "illustrations");
  if (!existsSync(dossier)) {
    console.log(`Pas de dossier ${dossier} : les Reels affichent un panneau tramé à la place de l'illustration.`);
    return;
  }
  mkdirSync(THEMES, { recursive: true });
  for (const fichier of readdirSync(dossier).sort()) {
    const { name, ext } = parse(fichier);
    if (![".jpg", ".jpeg", ".png", ".webp"].includes(ext.toLowerCase())) continue;
    process.stdout.write(`${join(dossier, fichier)} `);
    await photo(sharp(join(dossier, fichier)).resize(1200, 900, { fit: "cover", position: "attention" }), join(THEMES, name), JAUNE, { eclat: 1.2 });
  }
}

await fonds();
await candidats();
await illustrations();
