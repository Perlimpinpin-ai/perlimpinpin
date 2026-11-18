import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { slugCandidat } from "./carte.js";

// Ressources des images next/og (cartes X, carrousel Instagram) : polices du
// site et portrait bleu du candidat. Côté serveur seulement (lecture de
// fichiers dans public/).

let policesEnCache = null;

// Inter ExtraBold (800) et Medium (500), chargées une fois par instance.
export function polices() {
  policesEnCache ??= Promise.all(
    [
      ["Inter-ExtraBold.otf", 800],
      ["Inter-Medium.otf", 500],
    ].map(async ([fichier, weight]) => ({
      name: "Inter",
      data: await readFile(join(process.cwd(), "public", "fonts", fichier)),
      weight,
      style: "normal",
    })),
  );
  return policesEnCache;
}

// Portrait bleu détouré (public/portraits-bleus/<slug>.png), en data URI.
// Fichier absent : null (l'image s'affiche sans portrait).
export async function portraitBleu(candidat) {
  try {
    const png = await readFile(join(process.cwd(), "public", "portraits-bleus", `${slugCandidat(candidat)}.png`));
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    return null;
  }
}
