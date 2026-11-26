import { createRequire } from "node:module";
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Compile les composants JSX des carrousels (src/components/carrousels/) en
// modules ESM jouables par Node, hors de Next, dans un dossier temporaire
// (imports « @/lib/… » réécrits vers src/lib). Sert aux tests de rendu réel
// (scripts/carrousel-rendu.test.js) et aux démonstrations
// (scripts/demo-charte-rs.js). Renvoie { composants, ImageResponse }, ou null
// si TypeScript (qui compile le JSX) est absent.

const RACINE = fileURLToPath(new URL("../..", import.meta.url));
const require = createRequire(import.meta.url);
const DOSSIER = join(RACINE, "src", "components", "carrousels");

let charge = null;

export function chargerComposants() {
  charge ??= (async () => {
    let ts;
    try {
      ts = require("typescript");
    } catch {
      return null;
    }
    const sortie = mkdtempSync(join(tmpdir(), "carrousels-"));
    const lib = (nom) => pathToFileURL(join(RACINE, "src", "lib", `${nom}.js`)).href;
    const jsx = pathToFileURL(require.resolve("react/jsx-runtime")).href;
    const fichiers = readdirSync(DOSSIER).filter((f) => f.endsWith(".js"));
    for (const fichier of fichiers) {
      const source = readFileSync(join(DOSSIER, fichier), "utf8")
        .replace(/from "@\/lib\/([^"]+)"/g, (_, nom) => `from "${lib(nom)}"`)
        .replace(/from "\.\/([^"]+)"/g, (_, nom) => `from "./${nom.replace(/\.js$/, "")}.mjs"`);
      const { outputText } = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
      writeFileSync(join(sortie, fichier.replace(/\.js$/, ".mjs")), outputText.replace(/from "react\/jsx-runtime"/g, `from "${jsx}"`));
    }
    const composants = {};
    for (const fichier of fichiers) Object.assign(composants, await import(pathToFileURL(join(sortie, fichier.replace(/\.js$/, ".mjs"))).href));
    const { ImageResponse } = await import(pathToFileURL(require.resolve("next/dist/compiled/@vercel/og/index.node.js")).href);
    return { composants, ImageResponse };
  })();
  return charge;
}

// Polices de la charte RS (mêmes fichiers que policesCharteRS de src/lib/og-ressources.js).
export async function policesCharte() {
  const { POLICES } = await import("../../src/lib/charte-rs.js");
  return Object.values(POLICES).map((p) => ({ name: p.famille, data: readFileSync(join(RACINE, "public", p.fichier)), weight: p.graisse, style: "normal" }));
}

// PNG d'un élément 1080 × 1350.
export async function rendrePng(element, { ImageResponse, polices }) {
  const reponse = new ImageResponse(element, { width: 1080, height: 1350, fonts: polices });
  return Buffer.from(await reponse.arrayBuffer());
}
