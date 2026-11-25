// Photos des candidats sur Wikimedia Commons (API gratuite, sans clé), pour
// la couverture du carrousel détaillé et la fenêtre du candidat des Reels.
//
//   node scripts/chercher-photos-candidats.js <slug>
//       → cherche dans la catégorie Commons du candidat (src/lib/candidats-commons.js)
//         et ses sous-catégories (2 niveaux), garde les photos sous licence
//         libre (CC0, domaine public, CC BY, CC BY-SA), d'au moins 800 px de
//         large, avec un auteur et une licence clairs, et en propose 15 à 20
//         dans data/photos-candidats/candidates/<slug>.json. On les valide
//         ensuite sur /test/photos-candidats.
//   node scripts/chercher-photos-candidats.js <slug> --telecharger
//       → télécharge les photos cochées (data/photos-candidats/selection/<slug>.json)
//         dans data/photos-candidats/originaux/<slug>/<n>.jpg (1 600 px de large
//         au plus) et les ajoute à src/lib/photos-candidats.js. Puis :
//         python scripts/detourer-candidats.py --photos <slug>
//
// User-Agent : nom du projet et contact, comme Wikimedia le demande (le site
// par défaut ; WIKIMEDIA_CONTACT=<e-mail> pour donner une adresse).
// Aucune base, aucun appel payant.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CATEGORIES_COMMONS, nomDepuisSlug } from "../src/lib/candidats-commons.js";
import { PHOTOS_CANDIDATS } from "../src/lib/photos-candidats.js";
import { API_COMMONS, CANDIDATES_MIN, candidatesDepuisPages, entreesPhotos, meilleuresCandidates, reecrireListePhotos, userAgent } from "./lib/commons.js";

const DOSSIER = join("data", "photos-candidats");
const FICHIERS_MAX = 400;
const LARGEUR_TELECHARGEMENT = 1600;

const [slug] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const telecharger = process.argv.includes("--telecharger");
if (!slug || !CATEGORIES_COMMONS[slug]) {
  console.error(`Usage : node scripts/chercher-photos-candidats.js <slug> [--telecharger]\nSlugs : ${Object.keys(CATEGORIES_COMMONS).join(", ")}`);
  process.exit(1);
}

async function api(params) {
  const url = `${API_COMMONS}?${new URLSearchParams({ format: "json", formatversion: "2", maxlag: "5", ...params })}`;
  const reponse = await fetch(url, { headers: { "User-Agent": userAgent(), "Api-User-Agent": userAgent() } });
  if (!reponse.ok) throw new Error(`Commons a répondu ${reponse.status} pour ${params.action}`);
  return reponse.json();
}

// Fichiers de la catégorie et de ses sous-catégories (2 niveaux).
async function fichiersDeCategorie(categorie) {
  const fichiers = new Set();
  const vues = new Set([categorie]);
  let niveau = [categorie];
  for (let profondeur = 0; profondeur <= 2 && niveau.length && fichiers.size < FICHIERS_MAX; profondeur++) {
    const suivant = [];
    for (const cat of niveau) {
      let suite = {};
      do {
        const j = await api({ action: "query", list: "categorymembers", cmtitle: cat, cmtype: "file|subcat", cmlimit: "500", ...suite });
        for (const m of j.query?.categorymembers ?? []) {
          if (m.ns === 6) fichiers.add(m.title);
          else if (m.ns === 14 && !vues.has(m.title)) {
            vues.add(m.title);
            suivant.push(m.title);
          }
        }
        suite = j.continue ?? null;
      } while (suite && fichiers.size < FICHIERS_MAX);
    }
    niveau = suivant;
  }
  return [...fichiers].slice(0, FICHIERS_MAX);
}

// Métadonnées par lots de 50 titres.
async function pagesDe(titres) {
  const pages = [];
  for (let i = 0; i < titres.length; i += 50) {
    const j = await api({
      action: "query",
      titles: titres.slice(i, i + 50).join("|"),
      prop: "imageinfo",
      iiprop: "url|size|mime|extmetadata",
      iiurlwidth: String(LARGEUR_TELECHARGEMENT),
      iiextmetadatafilter: "LicenseShortName|Artist|Credit|LicenseUrl|DateTimeOriginal",
    });
    pages.push(...(j.query?.pages ?? []));
  }
  return pages;
}

async function chercher() {
  const nom = nomDepuisSlug(slug);
  console.log(`Recherche Commons : ${CATEGORIES_COMMONS[slug]}…`);
  const titres = await fichiersDeCategorie(CATEGORIES_COMMONS[slug]);
  const pages = await pagesDe(titres);
  const { candidates, ecartees } = candidatesDepuisPages(pages, { slug, nom });
  // Aperçu de la page de validation : la vignette 400 px de la même image.
  const retenues = meilleuresCandidates(candidates, undefined, 2, nom).map((c) => ({
    ...c,
    telechargement: c.apercu,
    apercu: c.apercu.replace(`/${LARGEUR_TELECHARGEMENT}px-`, "/400px-"),
  }));
  mkdirSync(join(DOSSIER, "candidates"), { recursive: true });
  const cible = join(DOSSIER, "candidates", `${slug}.json`);
  writeFileSync(cible, `${JSON.stringify({ slug, nom, categorie: CATEGORIES_COMMONS[slug], chercheLe: new Date().toISOString(), fichiersVus: titres.length, ecartees: ecartees.length, candidates: retenues }, null, 2)}\n`, "utf-8");
  console.log(`${titres.length} fichiers vus, ${candidates.length} passent les filtres, ${ecartees.length} écartés (licence, auteur, taille, format).`);
  console.log(`${retenues.length} photos proposées dans ${cible}${retenues.length < CANDIDATES_MIN ? ` (moins de ${CANDIDATES_MIN} : la catégorie est petite)` : ""}.`);
  console.log("À valider sur /test/photos-candidats (serveur local).");
}

async function telechargerSelection() {
  const fichier = join(DOSSIER, "selection", `${slug}.json`);
  if (!existsSync(fichier)) throw new Error(`Pas de sélection : cochez d'abord des photos sur /test/photos-candidats (${fichier}).`);
  const { retenues = [] } = JSON.parse(readFileSync(fichier, "utf-8"));
  const nouvelles = entreesPhotos(slug, retenues, PHOTOS_CANDIDATS);
  const parId = new Map(retenues.map((r) => [r.id, r]));
  mkdirSync(join(DOSSIER, "originaux", slug), { recursive: true });
  for (const photo of nouvelles) {
    const source = parId.get(photo.id);
    const reponse = await fetch(source.telechargement ?? source.original, { headers: { "User-Agent": userAgent() } });
    if (!reponse.ok) throw new Error(`Téléchargement impossible (${reponse.status}) : ${source.titre}`);
    writeFileSync(join(DOSSIER, "originaux", slug, `${photo.n}.jpg`), Buffer.from(await reponse.arrayBuffer()));
    console.log(`✓ ${slug}/${photo.n}.jpg ← ${source.titre} (${source.auteur}, ${source.licence})`);
  }
  const bibliotheque = join("src", "lib", "photos-candidats.js");
  writeFileSync(bibliotheque, reecrireListePhotos(readFileSync(bibliotheque, "utf-8"), [...PHOTOS_CANDIDATS, ...nouvelles]), "utf-8");
  console.log(`\n${nouvelles.length} photo(s) ajoutée(s) à ${bibliotheque}. Étape suivante : python scripts/detourer-candidats.py --photos ${slug}`);
}

(telecharger ? telechargerSelection() : chercher()).catch((erreur) => {
  console.error(`Erreur : ${erreur.message}`);
  process.exitCode = 1;
});
