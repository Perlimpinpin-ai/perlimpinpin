import { empreinte } from "./carte.js";
import { choisirEnRotation } from "./rotation-images.js";

// Bibliothèque des photos des candidats (couverture du carrousel détaillé et
// fenêtre du candidat dans les Reels) : photos libres de Wikimedia Commons,
// validées à la main, détourées en noir et blanc en local.
//
//  1. node scripts/chercher-photos-candidats.js <slug>
//       → API Wikimedia Commons, catégorie du candidat (src/lib/candidats-commons.js),
//         15 à 20 propositions (licence libre, ≥ 800 px, auteur et licence
//         clairs) dans data/photos-candidats/candidates/<slug>.json ;
//  2. /test/photos-candidats : on coche celles qu'on garde (portrait de face
//     ou de trois quarts, expression neutre, pas de logo de parti visible)
//     → data/photos-candidats/selection/<slug>.json ;
//  3. node scripts/chercher-photos-candidats.js <slug> --telecharger
//       → télécharge les retenues dans data/photos-candidats/originaux/<slug>/<n>.jpg
//         et réécrit la liste ci-dessous (entre les repères) ;
//  4. python scripts/detourer-candidats.py --photos <slug>
//       → public/carrousel/candidats/<slug>/<n>.png (détouré, noir et blanc).
// Rien n'entre dans la bibliothèque sans cette validation. Fonctions PURES,
// testées par scripts/carrousel-detaille.test.js.

export const PHOTOS_MIN = 3;
// Sous ce nombre de photos gardées, avertissement sur /test/photos-candidats.
export const PHOTOS_CONSEILLEES = 4;
// Photo du dernier carrousel de chaque candidat, mémorisée dans le navigateur
// (clé + slug) au téléchargement de l'archive, pour ne pas la reprendre.
export const CLE_DERNIERE_PHOTO = "perlimpinpin.carrousel.dernierePhoto.";

// --- Liste de la bibliothèque --------------------------------------------------------
// Écrite par scripts/chercher-photos-candidats.js --telecharger : ne pas modifier à la
// main entre les deux repères (sauf pour retirer une photo).
// Chaque entrée : { id, slug, n, fichier (relatif à public/), source, titre, auteur,
//   licence, lienLicence, lien (page Commons), modification }.
// DEBUT LISTE PHOTOS
export const PHOTOS_COMMONS = [];
// FIN LISTE PHOTOS

// --- Photos déposées à la main ---------------------------------------------------------
// Originaux dans photos-sources/<slug>/ (hors de public/, jamais commités),
// préparés en local par scripts/preparer-photos-candidats.py : détourage,
// noir et blanc (sans retouche du visage), 5 fichiers par photo dans
// public/carrousel/candidats/<slug>/<n>/ (VARIANTES_PHOTO). La liste entre
// les repères est écrite par ce script ; /test/photos-candidats (onglet
// « Photos déposées ») y coche `garder` et y corrige `credit` ; `source` se
// corrige à la main. Seules les photos gardées entrent dans le tirage.
// Chaque entrée : { slug, n, origine (fichier d'origine), prepareLe, source, credit, garder }.
// DEBUT PHOTOS DEPOSEES
export const PHOTOS_DEPOSEES = [
  {
    "slug": "bruno-retailleau",
    "n": 717235,
    "origine": "Le-candidat-LR-a-la-presidentielle-Bruno-retailleau-sur-BFMTV-RMC-jeudi-1er-octobre-2026-2357404.webp",
    "prepareLe": "2026-11-26",
    "source": "à compléter",
    "credit": "à compléter",
    "garder": false
  },
  {
    "slug": "david-lisnard",
    "n": 158847,
    "origine": "6b06df9c406ea36f086e5041_6b06df8e325d649974ca709a_2026-11-24T153516Z_805478753_RC2DUOA6P35C_RTRMADP_3_FRANCE-POLITICS.jpg",
    "prepareLe": "2026-11-26",
    "source": "à compléter",
    "credit": "à compléter",
    "garder": false
  },
  {
    "slug": "david-lisnard",
    "n": 405721,
    "origine": "David_Lisnard_en_2026.jpg",
    "prepareLe": "2026-11-26",
    "source": "à compléter",
    "credit": "à compléter",
    "garder": false
  },
  {
    "slug": "david-lisnard",
    "n": 758483,
    "origine": "2048.webp",
    "prepareLe": "2026-11-26",
    "source": "à compléter",
    "credit": "à compléter",
    "garder": false
  },
  {
    "slug": "dominique-de-villepin",
    "n": 420517,
    "origine": "1869719-dominique-de-villepin-dans-le-grand-jury.jpg",
    "prepareLe": "2026-11-26",
    "source": "à compléter",
    "credit": "à compléter",
    "garder": false
  },
  {
    "slug": "dominique-de-villepin",
    "n": 512653,
    "origine": "2048.webp",
    "prepareLe": "2026-11-26",
    "source": "à compléter",
    "credit": "à compléter",
    "garder": false
  },
  {
    "slug": "dominique-de-villepin",
    "n": 514309,
    "origine": "Dominique_de_Villepin_20100330_Salon_du_livre_de_Paris_2_cropped.jpg",
    "prepareLe": "2026-11-26",
    "source": "à compléter",
    "credit": "à compléter",
    "garder": false
  },
  {
    "slug": "dominique-de-villepin",
    "n": 689535,
    "origine": "Dominique-de-Villepin.jpg",
    "prepareLe": "2026-11-26",
    "source": "à compléter",
    "credit": "à compléter",
    "garder": false
  },
  {
    "slug": "dominique-de-villepin",
    "n": 848498,
    "origine": "caee1e25de35e7123be562699a3afa19.jpg_up.webp",
    "prepareLe": "2026-11-26",
    "source": "à compléter",
    "credit": "à compléter",
    "garder": false
  },
  {
    "slug": "edouard-philippe",
    "n": 298062,
    "origine": "le-president-d-horizons-et-ancien-premier-ministre-edouard-philippe-demande-l-organisation-d-une-pre-1779957572_dfd150d6c4e8664e150d6c4e888e15v_.avif",
    "prepareLe": "2026-11-26",
    "source": "à compléter",
    "credit": "à compléter",
    "garder": false
  },
  {
    "slug": "edouard-philippe",
    "n": 629287,
    "origine": "edouard-philippe_57.webp",
    "prepareLe": "2026-11-26",
    "source": "à compléter",
    "credit": "à compléter",
    "garder": false
  },
  {
    "slug": "edouard-philippe",
    "n": 659019,
    "origine": "63b37b17b82e2c2d7e3a38b01a759141.webp",
    "prepareLe": "2026-11-26",
    "source": "à compléter",
    "credit": "à compléter",
    "garder": false
  },
  {
    "slug": "edouard-philippe",
    "n": 790954,
    "origine": "Edouard-Philippe-copie.jpg",
    "prepareLe": "2026-11-26",
    "source": "à compléter",
    "credit": "à compléter",
    "garder": false
  },
  {
    "slug": "eric-zemmour",
    "n": 454282,
    "origine": "presidentielle-2027-eric-zemmour-officialise-sa-candidature-au-20h-de-tf1-3d4e63-0@3x.jpg",
    "prepareLe": "2026-11-26",
    "source": "à compléter",
    "credit": "à compléter",
    "garder": false
  },
  {
    "slug": "eric-zemmour",
    "n": 743459,
    "origine": "Eric-Zemmour-au-Zenith-de-Toulon-ce-samedi-21-novembre-2026-2388266.webp",
    "prepareLe": "2026-11-26",
    "source": "à compléter",
    "credit": "à compléter",
    "garder": false
  },
  {
    "slug": "eric-zemmour",
    "n": 943134,
    "origine": "2048.webp",
    "prepareLe": "2026-11-26",
    "source": "à compléter",
    "credit": "à compléter",
    "garder": false
  },
  {
    "slug": "fabien-roussel",
    "n": 103747,
    "origine": "P8-FABIEN-ROUSSEL_MER.webp",
    "prepareLe": "2026-11-26",
    "source": "à compléter",
    "credit": "à compléter",
    "garder": false
  },
  {
    "slug": "fabien-roussel",
    "n": 140882,
    "origine": "roussel-pcf.avif",
    "prepareLe": "2026-11-26",
    "source": "à compléter",
    "credit": "à compléter",
    "garder": false
  },
  {
    "slug": "fabien-roussel",
    "n": 262152,
    "origine": "2048.webp",
    "prepareLe": "2026-11-26",
    "source": "à compléter",
    "credit": "à compléter",
    "garder": false
  },
  {
    "slug": "fabien-roussel",
    "n": 406037,
    "origine": "1828456-fabien-roussel-lors-d-un-discours-a-saint-amand-les-eaux-le-15-mars-2026.jpg",
    "prepareLe": "2026-11-26",
    "source": "à compléter",
    "credit": "à compléter",
    "garder": false
  },
  {
    "slug": "fabien-roussel",
    "n": 585266,
    "origine": "ROUSSEL.webp",
    "prepareLe": "2026-11-26",
    "source": "à compléter",
    "credit": "à compléter",
    "garder": false
  },
  {
    "slug": "fabien-roussel",
    "n": 668834,
    "origine": "fabien-roussel-devrait-etre-reelu-a-la-tete-du-pcf-1783193319_8efa99eb594a6720b99eb594a360b9v_.avif",
    "prepareLe": "2026-11-26",
    "source": "à compléter",
    "credit": "à compléter",
    "garder": false
  },
  {
    "slug": "gabriel-attal",
    "n": 105327,
    "origine": "28989801a6d60f8058bb43d296f1ec21.jpg_up.webp",
    "prepareLe": "2026-11-26",
    "source": "à compléter",
    "credit": "à compléter",
    "garder": false
  },
  {
    "slug": "gabriel-attal",
    "n": 540641,
    "origine": "2048.webp",
    "prepareLe": "2026-11-26",
    "source": "à compléter",
    "credit": "à compléter",
    "garder": false
  },
  {
    "slug": "gabriel-attal",
    "n": 619716,
    "origine": "2c1f17aa268c6b73d96931d7191e74eff408bdfb.jpg",
    "prepareLe": "2026-11-26",
    "source": "à compléter",
    "credit": "à compléter",
    "garder": false
  },
  {
    "slug": "gabriel-attal",
    "n": 877164,
    "origine": "gabriel-attal.jpg",
    "prepareLe": "2026-11-26",
    "source": "à compléter",
    "credit": "à compléter",
    "garder": false
  },
  {
    "slug": "jean-luc-melenchon",
    "n": 280539,
    "origine": "AFP__20260709__B9RR6XM__v1__HighRes__FrancePoliticsCulturePartiesDemo-1024x696.jpg",
    "prepareLe": "2026-11-26",
    "source": "à compléter",
    "credit": "à compléter",
    "garder": false
  },
  {
    "slug": "jean-luc-melenchon",
    "n": 293513,
    "origine": "melenchon-ennemi-politique-1.jpg",
    "prepareLe": "2026-11-26",
    "source": "à compléter",
    "credit": "à compléter",
    "garder": false
  },
  {
    "slug": "jean-luc-melenchon",
    "n": 718874,
    "origine": "1837551-jean-luc-melenchon-lors-d-un-meeting-a-marseille-le-7-mai-2026.jpg",
    "prepareLe": "2026-11-26",
    "source": "à compléter",
    "credit": "à compléter",
    "garder": false
  },
  {
    "slug": "jean-luc-melenchon",
    "n": 727910,
    "origine": "SIPA_01300176_000001-1.jpg",
    "prepareLe": "2026-11-26",
    "source": "à compléter",
    "credit": "à compléter",
    "garder": false
  },
  {
    "slug": "jean-luc-melenchon",
    "n": 732749,
    "origine": "melenchon-lvi-20261117.jpg",
    "prepareLe": "2026-11-26",
    "source": "à compléter",
    "credit": "à compléter",
    "garder": false
  },
  {
    "slug": "jean-luc-melenchon",
    "n": 892078,
    "origine": "jean-luc-melenchon.jpg",
    "prepareLe": "2026-11-26",
    "source": "à compléter",
    "credit": "à compléter",
    "garder": false
  },
  {
    "slug": "marine-le-pen",
    "n": 650395,
    "origine": "2048.webp",
    "prepareLe": "2026-11-26",
    "source": "à compléter",
    "credit": "à compléter",
    "garder": false
  },
  {
    "slug": "marine-le-pen",
    "n": 929239,
    "origine": "Marine_Le_Pen_2025_(cropped).jpg",
    "prepareLe": "2026-11-26",
    "source": "à compléter",
    "credit": "à compléter",
    "garder": false
  },
  {
    "slug": "marine-tondelier",
    "n": 124754,
    "origine": "Huma2023MarineTondelier_(cropped).jpg",
    "prepareLe": "2026-11-26",
    "source": "à compléter",
    "credit": "à compléter",
    "garder": false
  },
  {
    "slug": "marine-tondelier",
    "n": 656041,
    "origine": "Marine-Tondelier-des-bancs-de-Sciences-Po-Lille-a-la-politique.png",
    "prepareLe": "2026-11-26",
    "source": "à compléter",
    "credit": "à compléter",
    "garder": false
  },
  {
    "slug": "raphael-glucksmann",
    "n": 194544,
    "origine": "20261119163317-47716312.jpg",
    "prepareLe": "2026-11-26",
    "source": "à compléter",
    "credit": "à compléter",
    "garder": false
  },
  {
    "slug": "raphael-glucksmann",
    "n": 368390,
    "origine": "raphael-glucksmann.jpg",
    "prepareLe": "2026-11-26",
    "source": "à compléter",
    "credit": "à compléter",
    "garder": false
  },
  {
    "slug": "raphael-glucksmann",
    "n": 745589,
    "origine": "09d79b8_upload-1-nnuqzunnz2cn-mmagnin-meeting-raphael-glucksmann-82.avif",
    "prepareLe": "2026-11-26",
    "source": "à compléter",
    "credit": "à compléter",
    "garder": false
  },
  {
    "slug": "raphael-glucksmann",
    "n": 862286,
    "origine": "4c8e8445ab8f290d629155374ac05820.webp",
    "prepareLe": "2026-11-26",
    "source": "à compléter",
    "credit": "à compléter",
    "garder": false
  },
  {
    "slug": "raphael-glucksmann",
    "n": 935421,
    "origine": "SIPA_01316176_000058-scaled.jpg",
    "prepareLe": "2026-11-26",
    "source": "à compléter",
    "credit": "à compléter",
    "garder": false
  },
  {
    "slug": "teddy-riner",
    "n": 343338,
    "origine": "VU2XIIR52BHIZHXNLIRYBQJSFY.jpg",
    "prepareLe": "2026-11-26",
    "source": "à compléter",
    "credit": "à compléter",
    "garder": false
  },
  {
    "slug": "teddy-riner",
    "n": 601730,
    "origine": "36a5f7239bf9cf70a30d5d1b5118d0be.webp",
    "prepareLe": "2026-11-26",
    "source": "à compléter",
    "credit": "à compléter",
    "garder": false
  },
  {
    "slug": "teddy-riner",
    "n": 731757,
    "origine": "Teddy-Riner-dans-un-corridor-vitre-1-1024x1024.webp",
    "prepareLe": "2026-11-26",
    "source": "à compléter",
    "credit": "à compléter",
    "garder": false
  },
  {
    "slug": "teddy-riner",
    "n": 736991,
    "origine": "1536x864_cmsv2_d4fe8715-10b7-52fb-8fec-081f04ee999c-10008657.webp",
    "prepareLe": "2026-11-26",
    "source": "à compléter",
    "credit": "à compléter",
    "garder": false
  }
];
// FIN PHOTOS DEPOSEES

export const CREDIT_A_COMPLETER = "à compléter";
export const REPERE_DEPOSEES_DEBUT = "// DEBUT PHOTOS DEPOSEES";
export const REPERE_DEPOSEES_FIN = "// FIN PHOTOS DEPOSEES";

// Fichier de chaque usage (charte RS, pages 9 à 11) : « une mesure » (liseré
// blanc devant le bloc d'accent), « programme » (liseré jaune, au centre),
// « thématique » (médaillon rond), Reels (photo tramée en pixels).
export const VARIANTES_PHOTO = {
  detoure: "detoure.png",
  mesure: "detoure-liseré-blanc.png",
  programme: "detoure-liseré-jaune.png",
  thematique: "medaillon.png",
  reel: "reel-trame.png",
};

// Dossier (relatif à public/) des fichiers préparés d'une photo déposée.
export function dossierPhoto(photo) {
  return `carrousel/candidats/${photo.slug}/${photo.n}`;
}

// Fichier (relatif à public/) d'une photo pour un usage (VARIANTES_PHOTO) ;
// une photo Commons n'a qu'un fichier, le même partout.
export function fichierPhoto(photo, variante = "mesure") {
  if (!photo) return null;
  if (!photo.deposee) return photo.fichier ?? null;
  return `${dossierPhoto(photo)}/${VARIANTES_PHOTO[variante] ?? VARIANTES_PHOTO.mesure}`;
}

// Photos déposées cochées « Garder », prêtes pour le tirage.
export function photosGardees(liste = PHOTOS_DEPOSEES) {
  return liste.filter((p) => p.garder === true).map((p) => ({ ...p, id: `depot-${p.slug}-${p.n}`, deposee: true, fichier: fichierPhoto({ ...p, deposee: true }) }));
}

// Crédit encore à compléter (photo déposée) ?
export function creditACompleter(photo) {
  if (!photo?.deposee) return false;
  const credit = String(photo.credit ?? "").trim();
  return !credit || credit.toLowerCase() === CREDIT_A_COMPLETER;
}

// Choix de /test/photos-candidats (onglet « Photos déposées ») appliqués à la
// liste : `choix` = [{ n, garder, credit }] pour le candidat `slug`. Les
// autres candidats et les champs du script restent tels quels.
export function appliquerChoixDeposees(liste, slug, choix) {
  const parN = new Map((Array.isArray(choix) ? choix : []).map((c) => [String(c.n), c]));
  return liste.map((p) => {
    const c = p.slug === slug ? parN.get(String(p.n)) : null;
    if (!c) return p;
    const credit = String(c.credit ?? "").replace(/\s+/g, " ").trim().slice(0, 160);
    return { ...p, garder: c.garder === true, credit: credit || CREDIT_A_COMPLETER };
  });
}

// Source de src/lib/photos-candidats.js avec la liste des photos déposées réécrite.
export function reecrireListeDeposees(source, liste) {
  const debut = source.indexOf(REPERE_DEPOSEES_DEBUT);
  const fin = source.indexOf(REPERE_DEPOSEES_FIN);
  if (debut < 0 || fin < 0) throw new Error("Repères des photos déposées introuvables dans src/lib/photos-candidats.js.");
  return `${source.slice(0, debut)}${REPERE_DEPOSEES_DEBUT}
export const PHOTOS_DEPOSEES = ${JSON.stringify(liste, null, 2)};
${source.slice(fin)}`;
}

// Bibliothèque du tirage : photos Commons et photos déposées gardées.
export const PHOTOS_CANDIDATS = [...PHOTOS_COMMONS, ...photosGardees()];

export function photosDuCandidat(slug, liste = PHOTOS_CANDIDATS) {
  return liste.filter((p) => p.slug === slug).sort((a, b) => a.n - b.n);
}

// Photo de la couverture :
//  - celle demandée (numéro n, bouton « Changer de photo ») ;
//  - sinon celle retenue à la génération de cette version (numéro stocké
//    dans contenuComplet.reseaux_recit.photo) ;
//  - sinon un tirage stable pour cette version (graine), en écartant les
//    photos des 2 derniers carrousels du candidat (`recentes` : numéros, le
//    plus récent d'abord), ou la moins récemment utilisée
//    (src/lib/rotation-images.js).
// Renvoie la photo ou null (aucune photo : vignette actuelle).
export function choisirPhoto({ slug, demandee = null, retenue = null, recentes = [], graine = "", liste = PHOTOS_CANDIDATS }) {
  const photos = photosDuCandidat(slug, liste);
  if (photos.length === 0) return null;
  for (const n of [demandee, retenue]) {
    const voulue = n === null || n === undefined ? null : photos.find((p) => String(p.n) === String(n));
    if (voulue) return voulue;
  }
  const alea = parseInt(empreinte(String(graine)).slice(0, 8), 16) / 0x100000000;
  return choisirEnRotation(photos, { cle: (p) => p.n, recentes, alea });
}

// Photo suivante pour « Changer de photo », en évitant `eviter` (celle du
// carrousel précédent du candidat) quand c'est possible.
export function photoSuivante(numeros, actuelle, eviter = null) {
  const liste = [...numeros].sort((a, b) => a - b);
  if (liste.length <= 1) return liste[0] ?? null;
  const depart = Math.max(0, liste.indexOf(Number(actuelle)));
  for (let k = 1; k <= liste.length; k++) {
    const n = liste[(depart + k) % liste.length];
    if (n !== Number(eviter) || liste.length === 2) return n;
  }
  return liste[(depart + 1) % liste.length];
}

// Crédits d'une photo : une seule ligne sur la couverture (« Photo : auteur,
// licence, Wikimedia Commons ») et le crédit complet, avec la modification et
// le lien, dans credits.txt et à la fin de la légende. null si l'auteur ou la
// licence manque. Photo déposée : « Photo : <credit> » partout, même s'il
// vaut encore « à compléter » (avertissement, pas de blocage : creditACompleter).
export function creditsPhoto(photo) {
  if (photo?.deposee) {
    const ligne = `Photo : ${String(photo.credit ?? "").trim() || CREDIT_A_COMPLETER}`;
    return { court: ligne, complet: ligne };
  }
  if (!photo?.auteur || !photo?.licence) return null;
  return {
    court: `Photo : ${photo.auteur}, ${photo.licence}, Wikimedia Commons`,
    complet: `Photo : ${photo.auteur}, ${photo.licence}, Wikimedia Commons (${photo.modification ?? "photo modifiée : détourage, noir et blanc"}) ${photo.lien ?? ""}`.trim(),
  };
}
