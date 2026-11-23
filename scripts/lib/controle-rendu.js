import { createRequire } from "node:module";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import sharp from "sharp";
import { HAUTEUR, LARGEUR, ZONE_PIED, ZONES_COUVERTURE } from "../../src/lib/mise-en-page-carrousel.js";

// Contrôle du rendu réel des slides du carrousel détaillé : la slide est
// rendue en mode « contrôle » (src/app/api/carrousel/[id]/slides-detaille.js :
// textes et cartes sur fond uni, sans grain, pied de page, bande ni collage),
// puis on compte les pixels qui ne sont pas du fond dans les zones réservées
// (pied de page et bande des slides 2 à 8, collage de la couverture). Un
// pixel compté = un texte (ou une carte) qui entre dans la zone.
// Utilisé par scripts/carrousel-rendu.test.js et le banc d'essai local.

const RACINE = fileURLToPath(new URL("../..", import.meta.url));
const require = createRequire(import.meta.url);

// Zones réservées d'une slide.
export function zonesReservees(type) {
  return type === "couverture" ? ZONES_COUVERTURE : [ZONE_PIED];
}

// Compile le rendu JSX des slides (next/og) en module ESM jouable par Node,
// dans un dossier temporaire. Renvoie { elementSlideDetaille, ImageResponse },
// ou null si TypeScript (qui sert à compiler le JSX) est absent.
export async function chargerRendu() {
  let ts;
  try {
    ts = require("typescript");
  } catch {
    return null;
  }
  const lib = (nom) => pathToFileURL(join(RACINE, "src", "lib", `${nom}.js`)).href;
  const source = readFileSync(join(RACINE, "src", "app", "api", "carrousel", "[id]", "slides-detaille.js"), "utf8").replace(/from "@\/lib\/([^"]+)"/g, (_, nom) => `from "${lib(nom)}"`);
  const { outputText } = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
  const code = outputText.replace(/from "react\/jsx-runtime"/g, `from "${pathToFileURL(require.resolve("react/jsx-runtime")).href}"`);
  const fichier = join(mkdtempSync(join(tmpdir(), "rendu-carrousel-")), "slides-detaille.mjs");
  writeFileSync(fichier, code);
  const { elementSlideDetaille } = await import(pathToFileURL(fichier).href);
  const { ImageResponse } = await import(pathToFileURL(require.resolve("next/dist/compiled/@vercel/og/index.node.js")).href);
  return { elementSlideDetaille, ImageResponse };
}

function rgb(hex) {
  const n = parseInt(String(hex).replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Pixels « pas du fond » dans chaque zone : [{ zone, pixels, basMax }] ;
// basMax : la ligne la plus basse touchée (px). `fond` : couleur hex du fond
// uni ; tolérance : écart par canal au-delà duquel un pixel compte.
export function pixelsDansZones({ data, info }, zones, fond, tolerance = 48) {
  const [r0, g0, b0] = rgb(fond);
  return zones.map((zone) => {
    let pixels = 0;
    let basMax = null;
    const x1 = Math.max(0, Math.floor(zone.x));
    const x2 = Math.min(info.width, Math.ceil(zone.x + zone.largeur));
    const y1 = Math.max(0, Math.floor(zone.y));
    const y2 = Math.min(info.height, Math.ceil(zone.y + zone.hauteur));
    for (let y = y1; y < y2; y++) {
      for (let x = x1; x < x2; x++) {
        const i = (y * info.width + x) * info.channels;
        if (Math.abs(data[i] - r0) > tolerance || Math.abs(data[i + 1] - g0) > tolerance || Math.abs(data[i + 2] - b0) > tolerance) {
          pixels += 1;
          basMax = y;
        }
      }
    }
    return { zone: zone.nom, pixels, basMax };
  });
}

// Rend une slide en mode contrôle et renvoie les intrusions dans ses zones
// réservées (zones avec au moins un pixel), plus l'image PNG.
// `fond` : couleur du fond uni (crème des slides 2 à 7, couleur du candidat
// sur la couverture et la fin).
export async function controlerRendu(rendu, { slide, mise, couleur, polices, candidatNom = "", sujet = "", fond }) {
  const reponse = new rendu.ImageResponse(rendu.elementSlideDetaille({ slide, mise, couleur, candidatNom, sujet, controle: true }), { width: LARGEUR, height: HAUTEUR, fonts: polices });
  const png = Buffer.from(await reponse.arrayBuffer());
  const brut = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  const intrusions = pixelsDansZones(brut, zonesReservees(slide.type), fond).filter((z) => z.pixels > 0);
  return { intrusions, png };
}
