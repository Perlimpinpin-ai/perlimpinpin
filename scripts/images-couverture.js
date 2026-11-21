// Prépare les images de la couverture des carrousels Instagram (collage :
// portrait détouré en noir et blanc, panneau photo du thème en duotone jaune,
// « sticker » incliné en haut à droite). Satori (next/og) ne sait appliquer
// aucun filtre : les traitements sont faits ici, une fois, avec sharp.
//
//   node scripts/images-couverture.js
//
// 1. public/portraits-bleus/<slug>.png (détourés, fond transparent)
//      → public/portraits-nb/<slug>.png ; sans détourage, public/photos/<slug>.jpg
//      → public/portraits-nb/<slug>-cadre.jpg (illustration entière, en tirage).
//      → public/portraits-nb/<slug>.png : noir et blanc contrasté, détourage gardé.
// 2. data/carrousel-themes/<slug du thème>.(jpg|png|webp), s'il existe (photo
//    libre de droits choisie à la main, crédit à noter dans
//    data/carrousel-themes/CREDITS.md)
//      → public/carrousel/themes/<slug>.jpg : duotone jaune et ocre, 1080 px.
// 3. data/carrousel-themes/<slug du thème>-sticker.png, s'il existe (objet
//    détouré : billets, document…)
//      → public/carrousel/themes/<slug>-sticker.png : 420 px, tel quel.
// Rien n'est téléchargé ; un thème sans photo garde le panneau tramé dessiné
// par le code.
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join, parse } from "node:path";
import sharp from "sharp";

const PORTRAITS = "public/portraits-bleus";
const PORTRAITS_NB = "public/portraits-nb";
const SOURCES_THEMES = "data/carrousel-themes";
const THEMES = "public/carrousel/themes";

mkdirSync(PORTRAITS_NB, { recursive: true });
for (const fichier of readdirSync(PORTRAITS).filter((f) => f.endsWith(".png")).sort()) {
  const cible = join(PORTRAITS_NB, fichier);
  const source = sharp(join(PORTRAITS, fichier));
  const alpha = await source.clone().extractChannel("alpha").toBuffer();
  const gris = await source
    .clone()
    .removeAlpha()
    .grayscale()
    .normalise()
    .linear(1.18, -14)
    .toColourspace("b-w")
    .toBuffer();
  await sharp(gris).joinChannel(alpha).png({ compressionLevel: 9 }).toFile(cible);
  console.log(`${join(PORTRAITS, fichier)} → ${cible}`);
}

// Personne sans portrait détouré (ex. Teddy Riner) :
//  - si data/detourages/<slug>.json donne un contour tracé à la main (points
//    sur l'illustration en 800 × 1000), l'illustration du site
//    (public/photos/<slug>.jpg) est découpée selon ce contour, puis traitée
//    comme les autres → public/portraits-nb/<slug>.png ;
//  - sinon, repli : l'illustration entière en noir et blanc, en tirage
//    → public/portraits-nb/<slug>-cadre.jpg.
const DETOURAGES = "data/detourages";
const detoures = new Set(readdirSync(PORTRAITS).map((f) => parse(f).name));
for (const fichier of readdirSync("public/photos").filter((f) => f.endsWith(".jpg")).sort()) {
  const { name } = parse(fichier);
  if (detoures.has(name)) continue;
  const trace = join(DETOURAGES, `${name}.json`);
  if (existsSync(trace)) {
    const { contour, taille: [largeur, hauteur] } = JSON.parse(readFileSync(trace, "utf-8"));
    const forme = `<svg xmlns="http://www.w3.org/2000/svg" width="${largeur}" height="${hauteur}"><polygon points="${contour.map((p) => p.join(",")).join(" ")}" fill="#fff"/></svg>`;
    const alpha = await sharp(Buffer.from(forme)).blur(1.2).extractChannel(0).toBuffer();
    const gris = await sharp(join("public/photos", fichier))
      .resize(largeur, hauteur, { fit: "cover" })
      .grayscale()
      .normalise()
      .linear(1.18, -14)
      .toColourspace("b-w")
      .toBuffer();
    const cible = join(PORTRAITS_NB, `${name}.png`);
    await sharp(gris).joinChannel(alpha).png({ compressionLevel: 9 }).toFile(cible);
    console.log(`public/photos/${fichier} + ${trace} (contour tracé) → ${cible}`);
    continue;
  }
  const cible = join(PORTRAITS_NB, `${name}-cadre.jpg`);
  await sharp(join("public/photos", fichier)).resize(640, 800, { fit: "cover" }).grayscale().normalise().linear(1.12, -10).jpeg({ quality: 86 }).toFile(cible);
  console.log(`public/photos/${fichier} (pas de détourage) → ${cible}`);
}

if (existsSync(SOURCES_THEMES)) {
  mkdirSync(THEMES, { recursive: true });
  for (const fichier of readdirSync(SOURCES_THEMES).sort()) {
    const { name, ext } = parse(fichier);
    if (![".jpg", ".jpeg", ".png", ".webp"].includes(ext.toLowerCase())) continue;
    if (name.endsWith("-sticker")) {
      const cible = join(THEMES, `${name}.png`);
      await sharp(join(SOURCES_THEMES, fichier)).resize({ width: 420 }).png().toFile(cible);
      console.log(`${fichier} → ${cible}`);
      continue;
    }
    // Duotone : les ombres en ocre foncé, les lumières en jaune clair.
    const cible = join(THEMES, `${name}.jpg`);
    const { data, info } = await sharp(join(SOURCES_THEMES, fichier))
      .resize({ width: 1080, height: 720, fit: "cover" })
      .grayscale()
      .normalise()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const sombre = [92, 62, 8];
    const clair = [255, 214, 74];
    const rvb = Buffer.alloc(info.width * info.height * 3);
    for (let i = 0; i < info.width * info.height; i++) {
      const t = data[i * info.channels] / 255;
      for (let c = 0; c < 3; c++) rvb[i * 3 + c] = Math.round(sombre[c] + (clair[c] - sombre[c]) * t);
    }
    await sharp(rvb, { raw: { width: info.width, height: info.height, channels: 3 } }).jpeg({ quality: 82 }).toFile(cible);
    console.log(`${fichier} → ${cible}`);
  }
} else {
  console.log(`Pas de dossier ${SOURCES_THEMES} : aucune photo de thème, panneau tramé par défaut.`);
}
