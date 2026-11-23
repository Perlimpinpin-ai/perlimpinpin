import { slugCandidat } from "./carte.js";
import { resolveTheme } from "./themes.js";
import { choisirIllustration, ILLUSTRATIONS, THEMES_ILLUSTRATIONS } from "./illustrations.js";
import { choisirPhoto, PHOTOS_CANDIDATS } from "./photos-candidats.js";

// Banque d'images des couvertures de carrousels : point d'entrée commun aux
// deux bibliothèques existantes.
//  - images de thème : src/lib/illustrations.js (public/illustrations/<thème>/,
//    dossier de secours « general ») ;
//  - photos des candidats : src/lib/photos-candidats.js
//    (public/carrousel/candidats/<slug>/<n>.png, détourées).
// À chaque génération d'un carrousel détaillé, la couverture prend une image
// qui n'a pas servi dans les 2 derniers carrousels (du même thème pour
// l'image de thème, du même candidat pour la photo), sinon la moins
// récemment utilisée (src/lib/rotation-images.js). La trace des carrousels
// est celle qui existe déjà : contenuComplet.reseaux_recit (champs
// `illustration` et `photo`, date `genereLe`) de chaque analyse. Aucune
// table ni colonne de plus.
// Fonctions PURES, testées par scripts/banque-images.test.js.

// Image de thème pour une fiche du thème `theme`, hors des images
// `dejaUtilisees` (fichiers, le plus récent d'abord). Renvoie l'entrée de la
// bibliothèque ou null.
export function choisirImageTheme(theme, dejaUtilisees = [], { motsCles = [], alea = 0, liste = ILLUSTRATIONS } = {}) {
  return choisirIllustration({ theme, motsCles, recentes: dejaUtilisees, alea, liste }).illustration;
}

// Photo du candidat `slug`, hors des photos `dejaUtilisees` (numéros, la plus
// récente d'abord). Renvoie l'entrée de la bibliothèque ou null.
export function choisirPhotoCandidat(slug, dejaUtilisees = [], { graine = "", liste = PHOTOS_CANDIDATS } = {}) {
  return choisirPhoto({ slug, recentes: dejaUtilisees, graine, liste });
}

// Historique des images des carrousels déjà générés, le plus récent d'abord.
// `lignes` : [{ theme, candidatNom, photoUrl, illustration, photo, genereLe,
// updatedAt }] (une par analyse ayant un carrousel détaillé, lue par
// src/app/test/reseaux/actions.js). Renvoie { illustrations, photos } :
// fichiers des carrousels du même thème que `theme`, numéros des photos des
// carrousels du candidat `slug`.
export function historiqueImages(lignes, { theme, slug }) {
  const date = (l) => {
    const t = Date.parse(l.genereLe ?? l.updatedAt ?? "");
    return Number.isNaN(t) ? 0 : t;
  };
  const triees = [...(lignes ?? [])].sort((a, b) => date(b) - date(a));
  const themeVise = resolveTheme(theme) ?? theme ?? null;
  const illustrations = triees
    .filter((l) => l.illustration && themeVise && (resolveTheme(l.theme) ?? l.theme) === themeVise)
    .map((l) => String(l.illustration));
  const photos = triees
    .filter((l) => l.photo !== null && l.photo !== undefined && slug && slugCandidat({ nom: l.candidatNom, photoUrl: l.photoUrl }) === slug)
    .map((l) => Number(l.photo));
  return { illustrations, photos };
}

// --- Contrôle de la banque (npm run banque-images:verifier, /test/illustrations) ---

// Objectifs : 3 ou 4 images par thème, 3 photos par candidat.
export const IMAGES_THEME_MIN = 3;
export const IMAGES_THEME_MAX = 4;
export const PHOTOS_CANDIDAT_MIN = 3;

// Licences autorisées : CC0, domaine public, CC BY, CC BY-SA (toutes
// versions) et, pour les images de thème déjà venues de Pexels, la licence
// Pexels.
export function licenceAutorisee(licence) {
  return /^(CC0|Domaine public|CC BY(-SA)? \d(\.\d)?|Licence Pexels)$/.test(String(licence ?? "").trim());
}

// Problèmes de crédit d'une entrée de la bibliothèque (liste vide si tout va bien).
export function problemesCredit(entree) {
  const problemes = [];
  if (!String(entree?.auteur ?? "").trim()) problemes.push("auteur manquant");
  if (!String(entree?.licence ?? "").trim()) problemes.push("licence manquante");
  else if (!licenceAutorisee(entree.licence)) problemes.push(`licence « ${entree.licence} » non autorisée`);
  if (!/^https?:\/\//.test(String(entree?.lien ?? ""))) problemes.push("page source (lien) manquante");
  return problemes;
}

// Bilan de la banque : par thème et par candidat, le nombre d'images, ce qui
// manque et les problèmes (crédits, fichiers absents).
//  - `themes` : slugs des thèmes de la bibliothèque ; `slugs` : candidats ;
//  - `existe(chemin)` : vrai si public/<chemin> existe ;
//  - `cheminTraitee(fichier)` : version traitée d'une image de thème.
// Renvoie { themes: [{ slug, n, manque, problemes }], candidats: [...], ok }.
export function bilanBanque({ illustrations = ILLUSTRATIONS, photos = PHOTOS_CANDIDATS, themes, slugs, existe = () => true, cheminTraitee = null }) {
  const ligne = (slug, entrees, min, controleFichiers) => {
    const problemes = [];
    for (const e of entrees) {
      const nom = e.fichier ?? `${slug} n° ${e.n}`;
      for (const p of problemesCredit(e)) problemes.push(`${nom} : ${p}`);
      for (const p of controleFichiers(e)) problemes.push(`${nom} : ${p}`);
    }
    return { slug, n: entrees.length, manque: Math.max(0, min - entrees.length), problemes };
  };
  const fichiersTheme = (e) => [
    ...(existe(e.fichier) ? [] : [`fichier absent (public/${e.fichier})`]),
    ...(cheminTraitee && !existe(cheminTraitee(e.fichier)) ? ["version traitée absente (node scripts/preparer-images-carrousel.js)"] : []),
  ];
  const fichiersPhoto = (e) => (existe(e.fichier) ? [] : [`photo détourée absente (public/${e.fichier}) : python scripts/detourer-candidats.py --photos ${e.slug}`]);
  // Les dossiers de sujet (tabac…) n'ont pas d'objectif minimal : ils servent
  // aux mesures qui en parlent.
  const lignesThemes = themes.map((t) =>
    ligne(
      t,
      illustrations.filter((i) => i.theme === t),
      THEMES_ILLUSTRATIONS[t]?.sujet ? 0 : IMAGES_THEME_MIN,
      fichiersTheme,
    ),
  );
  const lignesCandidats = slugs.map((s) =>
    ligne(
      s,
      photos.filter((p) => p.slug === s),
      PHOTOS_CANDIDAT_MIN,
      fichiersPhoto,
    ),
  );
  const ok = [...lignesThemes, ...lignesCandidats].every((l) => l.manque === 0 && l.problemes.length === 0);
  return { themes: lignesThemes, candidats: lignesCandidats, ok };
}
