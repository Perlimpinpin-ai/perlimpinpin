"use server";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { isEditor } from "@/lib/test-auth";
import { ILLUSTRATIONS, SOURCES_AUTORISEES, sourceAutorisee, THEMES_ILLUSTRATIONS } from "@/lib/illustrations";
import { candidatesSimulees } from "../../../../scripts/lib/illustrations-pexels.js";

// Actions de /test/illustrations. Elles n'écrivent que des fichiers locaux
// (data/illustrations/, public/illustrations/, src/lib/illustrations.js),
// jamais en base. Sur un serveur sans disque inscriptible (Vercel), elles
// refusent : la page est faite pour le poste local (npm run dev).

const DOSSIER = join(process.cwd(), "data", "illustrations");
const MODE_EDITION = { ok: false, erreur: "Mode édition requis : déverrouillez /test." };
const LOCAL_SEULEMENT = { ok: false, erreur: "Ce bouton ne marche qu’en local (npm run dev) : sur Vercel, le disque n’est pas modifiable." };

function themeValide(theme) {
  return Object.hasOwn(THEMES_ILLUSTRATIONS, theme);
}

// Contrôles communs : mode édition, thème connu, poste local.
async function refus(theme) {
  if (!(await isEditor())) return MODE_EDITION;
  if (!themeValide(theme)) return { ok: false, erreur: "Thème inconnu." };
  if (process.env.VERCEL) return LOCAL_SEULEMENT;
  return null;
}

// Propositions cochées (avec leur mot-clé corrigé). `choix` : [{ id, motCle }].
async function lireSelection(theme, choix) {
  const { candidates = [] } = JSON.parse(await readFile(join(DOSSIER, "candidates", `${theme}.json`), "utf-8"));
  const parId = new Map(candidates.map((c) => [c.id, c]));
  return (Array.isArray(choix) ? choix : [])
    .filter((c) => parId.has(c?.id))
    .map((c) => ({ ...parId.get(c.id), motCle: String(c.motCle ?? "").trim() || parId.get(c.id).motCle }));
}

async function ecrireSelection(theme, retenues) {
  await mkdir(join(DOSSIER, "selection"), { recursive: true });
  await writeFile(join(DOSSIER, "selection", `${theme}.json`), `${JSON.stringify({ theme, enregistreLe: new Date().toISOString(), retenues }, null, 2)}\n`, "utf-8");
}

// Recherche simulée : propositions factices, aucun appel.
export async function rechercheSimuleeAction(theme) {
  const r = await refus(theme);
  if (r) return r;
  try {
    await mkdir(join(DOSSIER, "candidates"), { recursive: true });
    const contenu = { theme, simulation: true, chercheLe: new Date().toISOString(), candidates: candidatesSimulees(theme) };
    await writeFile(join(DOSSIER, "candidates", `${theme}.json`), `${JSON.stringify(contenu, null, 2)}\n`, "utf-8");
    return { ok: true };
  } catch (error) {
    return { ok: false, erreur: `Écriture impossible sur ce serveur : ${error.message}` };
  }
}

// Enregistre la sélection sans rien télécharger.
export async function enregistrerSelectionAction(theme, choix) {
  const r = await refus(theme);
  if (r) return r;
  try {
    const retenues = await lireSelection(theme, choix);
    await ecrireSelection(theme, retenues);
    return { ok: true, nombre: retenues.length, simulees: retenues.filter((c) => c.simulation).length };
  } catch (error) {
    return { ok: false, erreur: `Enregistrement impossible : ${error.message}` };
  }
}

// « Garder les images cochées » : enregistre la sélection, puis télécharge
// les images retenues dans public/illustrations/<thème>/ (JPEG qualité 82,
// moins de 400 Ko, version traitée pour la couverture) et les ajoute à
// src/lib/illustrations.js (comme scripts/chercher-illustrations.js
// <thème> --telecharger). Une image sans crédit complet est refusée.
// Charte RS (page 11) : la case « aucune personne identifiable » est
// obligatoire, et seules les sources autorisées entrent dans la bibliothèque.
export async function garderSelectionAction(theme, choix, sansPersonneIdentifiable = false) {
  const r = await refus(theme);
  if (r) return r;
  if (sansPersonneIdentifiable !== true) return { ok: false, erreur: "Cochez d’abord « Aucune personne identifiable sur les images cochées » (charte RS)." };
  try {
    const retenues = await lireSelection(theme, choix);
    if (retenues.length === 0) return { ok: false, erreur: "Cochez d’abord au moins une image." };
    const interdites = retenues.filter((c) => !sourceAutorisee(c.source));
    if (interdites.length) return { ok: false, erreur: `Source non autorisée (${[...new Set(interdites.map((c) => c.source || "inconnue"))].join(", ")}) : seulement ${SOURCES_AUTORISEES.join(", ")}.` };
    await ecrireSelection(theme, retenues);
    const { garderIllustrations } = await import("../../../../scripts/lib/banque-images-fichiers.js");
    const { faites, erreurs } = await garderIllustrations({ racine: process.cwd(), theme, retenues, existantes: ILLUSTRATIONS });
    return { ok: true, ajoutees: faites.length, erreurs };
  } catch (error) {
    return { ok: false, erreur: `Téléchargement impossible : ${error.message}` };
  }
}
