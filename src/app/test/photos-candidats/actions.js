"use server";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { isEditor } from "@/lib/test-auth";
import { CATEGORIES_COMMONS } from "@/lib/candidats-commons";

// Action de /test/photos-candidats : enregistre les photos cochées dans un
// fichier de travail local (data/photos-candidats/selection/<slug>.json),
// jamais en base. Le téléchargement et le détourage se font en ligne de
// commande (scripts/chercher-photos-candidats.js --telecharger, puis
// scripts/detourer-candidats.py --photos). Sur un serveur sans disque
// inscriptible (Vercel), elle échoue : la page est faite pour le poste local.

const DOSSIER = join(process.cwd(), "data", "photos-candidats");

// `ids` : identifiants des candidates cochées.
export async function enregistrerSelectionPhotosAction(slug, ids) {
  if (!(await isEditor())) return { ok: false, erreur: "Mode édition requis : déverrouillez /test." };
  if (!Object.hasOwn(CATEGORIES_COMMONS, slug)) return { ok: false, erreur: "Candidat inconnu." };
  try {
    const { candidates = [] } = JSON.parse(await readFile(join(DOSSIER, "candidates", `${slug}.json`), "utf-8"));
    const voulus = new Set(Array.isArray(ids) ? ids : []);
    const retenues = candidates.filter((c) => voulus.has(c.id));
    await mkdir(join(DOSSIER, "selection"), { recursive: true });
    await writeFile(join(DOSSIER, "selection", `${slug}.json`), `${JSON.stringify({ slug, enregistreLe: new Date().toISOString(), retenues }, null, 2)}\n`, "utf-8");
    return { ok: true, nombre: retenues.length };
  } catch (error) {
    return { ok: false, erreur: `Enregistrement impossible : ${error.message}` };
  }
}
