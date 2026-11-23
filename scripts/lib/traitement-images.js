import sharp from "sharp";

// Traitements d'image du carrousel détaillé que le moteur de rendu (next/og,
// c'est-à-dire Satori puis resvg) ne sait pas faire : grain, noir et blanc,
// liseré blanc autour d'un détourage, bichromie jaune, trame de points sur une
// photo, papier déchiré. Faits UNE FOIS, en local, par
// scripts/preparer-images-carrousel.js (et, pour les photos Commons, par
// scripts/detourer-candidats.py qui applique le même traitement) ; le rendu
// ne fait plus qu'empiler des fichiers déjà prêts.

export const JAUNE_PAPIER = [242, 194, 48];
export const POINTS_PAPIER = "#B98A12";
export const LARGEUR_PAPIER = 560;
export const HAUTEUR_PAPIER = 400;
export const LARGEUR_ILLUSTRATION = 500;
export const HAUTEUR_ILLUSTRATION = 330;
export const LISERE = 12;

// Bruit RVBA : grains clairs et foncés, faible opacité, tirage déterministe.
export function bruit(largeur, hauteur, intensite, graine = 7) {
  const octets = Buffer.alloc(largeur * hauteur * 4);
  let x = graine >>> 0 || 1;
  for (let i = 0; i < largeur * hauteur; i++) {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    const r = (x >>> 0) / 0xffffffff;
    const fonce = r < 0.5;
    const force = fonce ? r * 2 : (r - 0.5) * 2;
    octets[i * 4] = octets[i * 4 + 1] = octets[i * 4 + 2] = fonce ? 20 : 255;
    octets[i * 4 + 3] = Math.round(force * force * intensite);
  }
  return octets;
}

// Grain posé sur les fonds (540 × 675, étiré au double au rendu).
export function grain() {
  return sharp(bruit(540, 675, 38, 3), { raw: { width: 540, height: 675, channels: 4 } }).png({ compressionLevel: 9 }).toBuffer();
}

// Bord supérieur déchiré du papier : dents irrégulières (coordonnées dans le
// papier, 600 × 420).
export const CRETES = [
  [0, 46], [22, 20], [40, 6], [62, 34], [84, 44], [104, 14], [122, 2], [146, 30], [170, 42], [190, 18],
  [208, 4], [232, 32], [256, 40], [276, 12], [296, 0], [320, 28], [344, 44], [364, 16], [384, 6], [408, 34],
  [432, 40], [452, 10], [474, 2], [498, 30], [522, 42], [542, 22], [560, 26],
];

function polygonePapier() {
  return [...CRETES, [LARGEUR_PAPIER, HAUTEUR_PAPIER], [0, HAUTEUR_PAPIER]].map(([x, y]) => `${x},${y}`).join(" ");
}

// Papier jaune tramé déchiré (PNG transparent hors du papier), le même pour tous.
export function papierDechire() {
  const [r, g, b] = JAUNE_PAPIER;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${LARGEUR_PAPIER}" height="${HAUTEUR_PAPIER}">
    <defs>
      <pattern id="t" width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="4.5" cy="4.5" r="2.2" fill="${POINTS_PAPIER}"/></pattern>
      <clipPath id="c"><polygon points="${polygonePapier()}"/></clipPath>
    </defs>
    <g clip-path="url(#c)">
      <rect width="100%" height="100%" fill="rgb(${r},${g},${b})"/>
      <rect width="100%" height="100%" fill="url(#t)" opacity="0.8"/>
    </g>
  </svg>`;
  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}

// Photo d'illustration en noir et blanc teintée de jaune, avec trame de points
// (similigravure) : ombres en ocre foncé, lumières dans le jaune du papier.
export async function illustrationJaune(octets, { largeur = LARGEUR_ILLUSTRATION, hauteur = HAUTEUR_ILLUSTRATION, pas = 7 } = {}) {
  const { data, info } = await sharp(octets).rotate().resize(largeur, hauteur, { fit: "cover", position: "attention" }).grayscale().normalise().raw().toBuffer({ resolveWithObject: true });
  const clair = JAUNE_PAPIER;
  const sombre = [96, 70, 8];
  const fond = Buffer.alloc(info.width * info.height * 3);
  for (let i = 0; i < info.width * info.height; i++) {
    const t = data[i * info.channels] / 255;
    for (let c = 0; c < 3; c++) fond[i * 3 + c] = Math.round(sombre[c] + (clair[c] - sombre[c]) * t);
  }
  const cercles = [];
  for (let y = 0; y < info.height; y += pas) {
    for (let x = (y / pas) % 2 ? pas / 2 : 0; x < info.width; x += pas) {
      const px = Math.min(info.width - 1, Math.round(x + pas / 2));
      const py = Math.min(info.height - 1, Math.round(y + pas / 2));
      const ombre = 1 - data[(py * info.width + px) * info.channels] / 255;
      const r = (pas / 2) * 0.95 * Math.sqrt(ombre);
      if (r > 0.5) cercles.push(`<circle cx="${(x + pas / 2).toFixed(1)}" cy="${(y + pas / 2).toFixed(1)}" r="${r.toFixed(2)}"/>`);
    }
  }
  const trame = `<svg xmlns="http://www.w3.org/2000/svg" width="${info.width}" height="${info.height}"><g fill="#3a2a05" opacity="0.55">${cercles.join("")}</g></svg>`;
  return sharp(fond, { raw: { width: info.width, height: info.height, channels: 3 } }).composite([{ input: Buffer.from(trame) }]).png({ compressionLevel: 9 }).toBuffer();
}

// Candidat détouré (PNG avec transparence) → noir et blanc contrasté, grain,
// liseré blanc qui suit la silhouette, recadré au plus près.
export async function finirCandidat(octets, { hauteur = 900 } = {}) {
  const recadre = await sharp(octets).rotate().ensureAlpha().trim({ threshold: 1 }).toBuffer();
  const { data, info } = await sharp(recadre)
    .resize({ height: hauteur, withoutEnlargement: false })
    .extend({ top: LISERE, bottom: 0, left: LISERE, right: LISERE, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: l, height: h } = info;
  const gris = Buffer.alloc(l * h * 4);
  const g = bruit(l, h, 120, 11);
  for (let i = 0; i < l * h; i++) {
    let y = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
    y = Math.max(0, Math.min(255, (y - 128) * 1.3 + 128));
    const k = g[i * 4 + 3] / 255;
    y = y * (1 - k) + g[i * 4] * k;
    gris[i * 4] = gris[i * 4 + 1] = gris[i * 4 + 2] = Math.round(y);
    gris[i * 4 + 3] = data[i * 4 + 3];
  }
  const alpha = Buffer.alloc(l * h);
  for (let i = 0; i < l * h; i++) alpha[i] = data[i * 4 + 3];
  const epais = await sharp(alpha, { raw: { width: l, height: h, channels: 1 } }).blur(LISERE / 2.2).threshold(6).extractChannel(0).raw().toBuffer();
  const blanc = Buffer.alloc(l * h * 4);
  for (let i = 0; i < l * h; i++) {
    blanc[i * 4] = blanc[i * 4 + 1] = blanc[i * 4 + 2] = 255;
    blanc[i * 4 + 3] = epais[i] ?? 0;
  }
  const portrait = await sharp(gris, { raw: { width: l, height: h, channels: 4 } }).png().toBuffer();
  return sharp(blanc, { raw: { width: l, height: h, channels: 4 } }).composite([{ input: portrait }]).png({ compressionLevel: 9 }).toBuffer();
}

// Sans photo détourée : la vignette actuelle en tirage noir et blanc, grain, bord blanc.
export async function tirageVignette(octets) {
  const l = 460;
  const h = 575;
  const { data } = await sharp(octets).rotate().resize(l, h, { fit: "cover", position: "attention" }).grayscale().normalise().raw().toBuffer({ resolveWithObject: true });
  const g = bruit(l, h, 80, 5);
  const rvba = Buffer.alloc(l * h * 4);
  for (let i = 0; i < l * h; i++) {
    const k = g[i * 4 + 3] / 255;
    const y = Math.round(data[i] * (1 - k) + g[i * 4] * k);
    rvba[i * 4] = rvba[i * 4 + 1] = rvba[i * 4 + 2] = y;
    rvba[i * 4 + 3] = 255;
  }
  return sharp(rvba, { raw: { width: l, height: h, channels: 4 } }).extend({ top: 16, bottom: 16, left: 16, right: 16, background: "#fbfaf6" }).jpeg({ quality: 86 }).toBuffer();
}
