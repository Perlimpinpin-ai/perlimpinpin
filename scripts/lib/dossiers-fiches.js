// Lien automatique entre une fiche relue et les dossiers qui la citent.
//
// Un dossier à propositions (data/hors-series/<dossier>.json, ex. le dossier
// « Mouvement social ») déclare chaque proposition analysée avec le slug de
// sa fiche de relecture (`fiche`, ex. "zemmour-loi-anticasseurs-1970"). Quand
// le robot de révision crée la fiche finale en base, il connaît l'id de la
// proposition : il l'écrit dans `ficheId`, et la page du dossier affiche la
// note et le lien dès que l'analyse est publiée (Publier sur /test). Le JSON
// modifié part dans la même PR que la révision.
//
// Fonctions sans accès réseau ni base, testées dans
// scripts/dossiers-fiches.test.js.

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const DOSSIER_HORS_SERIES = "data/hors-series";

// Écrit `ficheId` dans les propositions d'un dossier dont `fiche` vaut `slug`.
// Renvoie le JSON mis à jour et le nombre de propositions modifiées (0 si
// rien ne change : proposition absente ou ficheId déjà correct).
export function relierDansDossier(dossier, slug, propositionId) {
  if (!Array.isArray(dossier?.propositions)) return { dossier, modifiees: 0 };
  let modifiees = 0;
  const propositions = dossier.propositions.map((p) => {
    if (p?.fiche !== slug || p.ficheId === propositionId) return p;
    modifiees += 1;
    return { ...p, ficheId: propositionId };
  });
  return { dossier: modifiees ? { ...dossier, propositions } : dossier, modifiees };
}

// Parcourt data/hors-series/*.json et relie la fiche `slug` à la proposition
// `propositionId` partout où elle est citée. Renvoie les chemins (relatifs à
// `root`) des fichiers réécrits, à ajouter à la PR. Les fichiers non concernés
// ne sont pas touchés (aucun reformatage).
export function relierFicheAuxDossiers({ root, slug, propositionId }) {
  if (!Number.isInteger(propositionId)) return [];
  const dossierAbs = path.join(root, DOSSIER_HORS_SERIES);
  if (!existsSync(dossierAbs)) return [];
  const modifies = [];
  for (const nom of readdirSync(dossierAbs).filter((n) => n.endsWith(".json")).sort()) {
    const chemin = path.join(dossierAbs, nom);
    let dossier;
    try {
      dossier = JSON.parse(readFileSync(chemin, "utf8"));
    } catch {
      continue;
    }
    const { dossier: misAJour, modifiees } = relierDansDossier(dossier, slug, propositionId);
    if (!modifiees) continue;
    writeFileSync(chemin, `${JSON.stringify(misAJour, null, 2)}\n`);
    modifies.push(`${DOSSIER_HORS_SERIES}/${nom}`);
  }
  return modifies;
}
