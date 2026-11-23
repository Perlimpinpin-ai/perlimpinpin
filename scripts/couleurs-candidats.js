// Couleur du carrousel détaillé de chaque candidat, tirée de son illustration
// (public/photos/vignettes/<slug>.webp) : couleur dominante du fond (sans le
// visage, le blanc, le noir ni les gris), foncée jusqu'au contraste 4,5:1 avec
// le titre blanc, jamais proche du jaune des surlignages, et bloc derrière le
// candidat (même teinte, plus foncée). Calcul : src/lib/couleur-dominante.js.
//
//   node scripts/couleurs-candidats.js
//       → affiche le tableau (candidat, vignette, dominante, fond, bloc),
//         signale les couleurs presque identiques, et écrit un aperçu
//         tmp/couleurs-candidats.png. N'écrit RIEN dans le code : la table de
//         src/lib/couleurs-carrousel.js se met à jour après validation.
//   node scripts/couleurs-candidats.js --json
//       → la même table en JSON (pour la recopier dans couleurs-carrousel.js).
import { mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { couleurDominante, couleursCarrousel, couleursPresqueIdentiques } from "../src/lib/couleur-dominante.js";

const VIGNETTES = join("public", "photos", "vignettes");

const table = {};
for (const fichier of readdirSync(VIGNETTES).filter((f) => f.endsWith(".webp")).sort()) {
  const slug = fichier.replace(/\.webp$/, "");
  const { data, info } = await sharp(join(VIGNETTES, fichier)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const dominante = couleurDominante(data, info.width, info.height, info.channels);
  table[slug] = dominante ? { vignette: `${VIGNETTES}/${fichier}`.replace(/\\/g, "/"), dominante: dominante.couleur, part: Math.round(dominante.part * 100), ...couleursCarrousel(dominante.couleur) } : { vignette: fichier, dominante: null };
}

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(Object.fromEntries(Object.entries(table).map(([slug, c]) => [slug, { fond: c.fond, bloc: c.bloc }])), null, 2));
} else {
  console.log("| Candidat (slug) | Dominante du fond | Couleur (fond) | Bloc | Contraste blanc | Remarque |");
  console.log("|---|---|---|---|---|---|");
  for (const [slug, c] of Object.entries(table)) {
    if (!c.dominante) {
      console.log(`| ${slug} | aucune couleur nette | | | | à choisir à la main |`);
      continue;
    }
    const remarques = [c.foncee ? "foncée pour le contraste" : "", c.procheJaune ? "TROP PROCHE DU JAUNE" : "", c.part < 35 ? `teinte peu dominante (${c.part} %)` : ""].filter(Boolean).join(", ");
    console.log(`| ${slug} | ${c.dominante} (${c.part} %) | ${c.fond} | ${c.bloc} | ${c.contraste}:1 | ${remarques} |`);
  }
  const proches = couleursPresqueIdentiques(Object.fromEntries(Object.entries(table).filter(([, c]) => c.fond)));
  console.log(proches.length ? `\nCouleurs presque identiques :\n${proches.map(([a, b, d]) => `  - ${a} et ${b} (écart ${d})`).join("\n")}` : "\nAucune paire de couleurs presque identiques.");

  // Aperçu : vignette, dominante, fond, bloc.
  const lignes = Object.entries(table);
  const L = 128;
  const H = 160;
  const composants = [];
  for (const [i, [slug, c]] of lignes.entries()) {
    const y = i * H;
    composants.push({ input: await sharp(join(VIGNETTES, `${slug}.webp`)).resize(L, H).toBuffer(), left: 0, top: y });
    for (const [k, couleur] of [c.dominante, c.fond, c.bloc].entries()) {
      if (couleur) composants.push({ input: { create: { width: L, height: H, channels: 3, background: couleur } }, left: L * (k + 1), top: y });
    }
    const texte = `<svg width="${L * 2}" height="${H}"><text x="10" y="${H / 2}" font-family="Arial" font-size="22" font-weight="bold" fill="#ffffff">Titre blanc</text></svg>`;
    if (c.fond) composants.push({ input: Buffer.from(texte), left: L * 2, top: y });
  }
  mkdirSync("tmp", { recursive: true });
  await sharp({ create: { width: L * 4, height: H * lignes.length, channels: 3, background: "#ffffff" } }).composite(composants).png().toFile(join("tmp", "couleurs-candidats.png"));
  console.log("\nAperçu : tmp/couleurs-candidats.png (vignette, dominante, fond avec titre blanc, bloc). Rien n'est écrit dans le code.");
}
