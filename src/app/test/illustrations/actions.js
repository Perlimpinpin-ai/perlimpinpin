"use server";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { isEditor } from "@/lib/test-auth";
import { THEMES_ILLUSTRATIONS } from "@/lib/illustrations";
import { candidatesSimulees } from "../../../../scripts/lib/illustrations-pexels.js";

// Actions de /test/illustrations. Elles n'écrivent que des fichiers de travail
// locaux (data/illustrations/), jamais en base, et ne téléchargent rien : le
// téléchargement des images retenues est fait par
// scripts/chercher-illustrations.js <thème> --telecharger.
// Sur un serveur sans disque inscriptible (Vercel), elles échouent : la page
// est faite pour le poste local.

const DOSSIER = join(process.cwd(), "data", "illustrations");

function themeValide(theme) {
  return Object.hasOwn(THEMES_ILLUSTRATIONS, theme);
}

// Recherche simulée : 20 candidates factices, aucun appel à Pexels.
export async function rechercheSimuleeAction(theme) {
  if (!(await isEditor())) return { ok: false, erreur: "Mode édition requis : déverrouillez /test." };
  if (!themeValide(theme)) return { ok: false, erreur: "Thème inconnu." };
  try {
    await mkdir(join(DOSSIER, "candidates"), { recursive: true });
    const contenu = { theme, simulation: true, chercheLe: new Date().toISOString(), candidates: candidatesSimulees(theme) };
    await writeFile(join(DOSSIER, "candidates", `${theme}.json`), `${JSON.stringify(contenu, null, 2)}\n`, "utf-8");
    return { ok: true };
  } catch (error) {
    return { ok: false, erreur: `Écriture impossible sur ce serveur : ${error.message}` };
  }
}

// Enregistre les candidates cochées (avec leur mot-clé corrigé).
// `choix` : [{ id, motCle }].
export async function enregistrerSelectionAction(theme, choix) {
  if (!(await isEditor())) return { ok: false, erreur: "Mode édition requis : déverrouillez /test." };
  if (!themeValide(theme)) return { ok: false, erreur: "Thème inconnu." };
  try {
    const { candidates = [] } = JSON.parse(await readFile(join(DOSSIER, "candidates", `${theme}.json`), "utf-8"));
    const parId = new Map(candidates.map((c) => [c.id, c]));
    const retenues = (Array.isArray(choix) ? choix : [])
      .filter((c) => parId.has(c?.id))
      .map((c) => ({ ...parId.get(c.id), motCle: String(c.motCle ?? "").trim() || parId.get(c.id).motCle }));
    await mkdir(join(DOSSIER, "selection"), { recursive: true });
    await writeFile(join(DOSSIER, "selection", `${theme}.json`), `${JSON.stringify({ theme, enregistreLe: new Date().toISOString(), retenues }, null, 2)}\n`, "utf-8");
    return { ok: true, nombre: retenues.length, simulees: retenues.filter((c) => c.simulation).length };
  } catch (error) {
    return { ok: false, erreur: `Enregistrement impossible : ${error.message}` };
  }
}
