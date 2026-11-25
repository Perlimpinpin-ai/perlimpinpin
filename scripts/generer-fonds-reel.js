// Génère, une fois pour toutes, les deux fonds 1080 × 1920 des images de Reel
// (route src/app/test/reels/[id]/image/route.js) :
//   public/reel/fond-sombre.png : « écran LCD irisé », bleu nuit, grandes
//     taches floues violet, bleu, cyan, rose et jaune, fine grille de pixels
//     d'écran, centre assombri pour la lisibilité ;
//   public/reel/fond-clair.png : dégradé lavande, rose très pâle, bleu doux,
//     même grille, plus discrète.
// Jamais de rouge ni de vert (réservés au score). next/og ne sait dessiner ni
// flou ni motif répété : le fond est donc une image, dessinée ici en SVG puis
// convertie en PNG par sharp (déjà installé avec Next).
//
//   node scripts/generer-fonds-reel.js
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SORTIE = join(__dirname, "..", "public", "reel");
const L = 1080;
const H = 1920;

// tache : { cx, cy, rx, ry, couleur, opacite }
function taches(liste) {
  const defs = liste
    .map(
      (t, i) => `<radialGradient id="t${i}" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="${t.couleur}" stop-opacity="${t.opacite}"/>
        <stop offset="45%" stop-color="${t.couleur}" stop-opacity="${t.opacite * 0.55}"/>
        <stop offset="100%" stop-color="${t.couleur}" stop-opacity="0"/>
      </radialGradient>`,
    )
    .join("");
  const formes = liste
    .map((t, i) => `<ellipse cx="${t.cx}" cy="${t.cy}" rx="${t.rx}" ry="${t.ry}" fill="url(#t${i})"/>`)
    .join("");
  return { defs, formes };
}

function svgFond({ base, liste, centre, grille }) {
  const { defs, formes } = taches(liste);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${L}" height="${H}" viewBox="0 0 ${L} ${H}">
  <defs>
    ${defs}
    <radialGradient id="centre" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${centre.couleur}" stop-opacity="${centre.opacite}"/>
      <stop offset="60%" stop-color="${centre.couleur}" stop-opacity="${centre.opacite * 0.6}"/>
      <stop offset="100%" stop-color="${centre.couleur}" stop-opacity="0"/>
    </radialGradient>
    <pattern id="pixels" width="6" height="6" patternUnits="userSpaceOnUse">
      <rect x="5" y="0" width="1" height="6" fill="${grille.couleur}" fill-opacity="${grille.opacite}"/>
      <rect x="0" y="5" width="5" height="1" fill="${grille.couleur}" fill-opacity="${grille.opacite}"/>
    </pattern>
  </defs>
  <rect width="${L}" height="${H}" fill="${base}"/>
  ${formes}
  <ellipse cx="${L / 2}" cy="${H / 2}" rx="620" ry="900" fill="url(#centre)"/>
  <rect width="${L}" height="${H}" fill="url(#pixels)"/>
</svg>`;
}

const FONDS = {
  sombre: {
    base: "#0a0f2e",
    liste: [
      { cx: 160, cy: 330, rx: 700, ry: 640, couleur: "#7c3aed", opacite: 0.85 },
      { cx: 980, cy: 760, rx: 720, ry: 760, couleur: "#2563eb", opacite: 0.8 },
      { cx: 120, cy: 1300, rx: 620, ry: 640, couleur: "#06b6d4", opacite: 0.6 },
      { cx: 980, cy: 1640, rx: 680, ry: 620, couleur: "#ec4899", opacite: 0.65 },
      { cx: 660, cy: 90, rx: 460, ry: 340, couleur: "#facc15", opacite: 0.45 },
      { cx: 420, cy: 1900, rx: 520, ry: 300, couleur: "#a855f7", opacite: 0.55 },
    ],
    centre: { couleur: "#060a22", opacite: 0.72 },
    grille: { couleur: "#000000", opacite: 0.32 },
  },
  clair: {
    base: "#efeaff",
    liste: [
      { cx: 160, cy: 330, rx: 700, ry: 640, couleur: "#c4b5fd", opacite: 0.75 },
      { cx: 980, cy: 760, rx: 720, ry: 760, couleur: "#bfdbfe", opacite: 0.85 },
      { cx: 120, cy: 1300, rx: 620, ry: 640, couleur: "#fbcfe8", opacite: 0.75 },
      { cx: 980, cy: 1640, rx: 680, ry: 620, couleur: "#fce7f3", opacite: 0.9 },
      { cx: 660, cy: 90, rx: 460, ry: 340, couleur: "#fef3c7", opacite: 0.7 },
      { cx: 420, cy: 1900, rx: 520, ry: 300, couleur: "#ddd6fe", opacite: 0.7 },
    ],
    centre: { couleur: "#ffffff", opacite: 0.55 },
    grille: { couleur: "#4c3d8f", opacite: 0.07 },
  },
};

mkdirSync(SORTIE, { recursive: true });
for (const [theme, fond] of Object.entries(FONDS)) {
  const cible = join(SORTIE, `fond-${theme}.png`);
  const info = await sharp(Buffer.from(svgFond(fond))).png({ compressionLevel: 9 }).toFile(cible);
  console.log(`✓ ${cible} (${info.width} × ${info.height}, ${Math.round(info.size / 1024)} Ko)`);
}
