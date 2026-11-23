import { empreinte } from "./carte.js";
import { resolveTheme } from "./themes.js";
import { CARROUSELS_EXCLUS, choisirEnRotation } from "./rotation-images.js";

// Bibliothèque des images de thème des carrousels Instagram (couverture).
//
// Principe : une bibliothèque validée une fois à la main, puis un choix
// automatique. Jamais d'image générée par IA, jamais de recherche d'image au
// moment de la génération d'un carrousel.
//
//  1. npm run banque-images:themes (ou node scripts/chercher-illustrations.js <thème>)
//       → interroge l'API Wikimedia Commons avec les REQUETES_COMMONS du
//         thème et garde 8 propositions sous licence libre, ≥ 1600 px, dans
//         data/illustrations/candidates/<thème>.json (--pexels : API Pexels ;
//         --simulation : propositions factices, sans appel) ;
//  2. /test/illustrations (serveur local) : on coche 3 ou 4 images, on corrige
//     leur mot-clé, puis « Garder » → public/illustrations/<thème>/<mot-clé>.jpg
//     (+ version traitée) et la liste ILLUSTRATIONS ci-dessous est réécrite
//     (entre les deux repères) ; même effet en ligne de commande :
//     node scripts/chercher-illustrations.js <thème> --telecharger.
// Rien n'entre dans la bibliothèque sans cette validation. Le dossier
// « general » sert de secours aux thèmes sans image. Choix sur la couverture :
// hors des images des 2 derniers carrousels du thème (src/lib/banque-images.js).
//
// Fonctions PURES (choix, crédit), testées par scripts/recit.test.js et
// scripts/banque-images.test.js.
// Le traitement graphique (bichromie et trame) est dans
// src/lib/traitement-illustration.js.

// Règles de sélection, rappelées sur /test/illustrations et dans le script.
export const REGLES_SELECTION = [
  "Pas de visage reconnaissable au premier plan : silhouettes, mains, personnes de dos, objets, lieux.",
  "Aucune personnalité politique.",
  "Aucun logo de marque ou de parti, aucun symbole partisan.",
  "Pas d'image choquante ni misérabiliste.",
  "Une photo qui pourrait passer pour celle d'un événement réel précis est écartée : on cherche des images génériques.",
];

// Thèmes de la bibliothèque : les 12 thèmes des fiches (src/lib/themes.js),
// plus « fiscalite », rangé à part pour des images d'impôts, mais puisé aussi
// pour les fiches du thème « economie » (le site range la fiscalité dans ce
// thème). Requêtes Pexels en anglais (meilleurs résultats), avec le mot-clé
// proposé pour les images trouvées par chaque requête.
export const THEMES_ILLUSTRATIONS = {
  logement: {
    libelle: "Logement",
    requetes: [
      ["apartment building facade", "immeuble"],
      ["house keys hand", "cles"],
      ["construction site crane", "chantier"],
      ["for rent sign window", "location"],
      ["roof renovation workers back", "renovation"],
    ],
  },
  economie: {
    libelle: "Économie et pouvoir d'achat",
    requetes: [
      ["supermarket checkout", "caisse"],
      ["euro banknotes", "billets"],
      ["shopping cart groceries", "courses"],
      ["euro coins wallet", "porte-monnaie"],
      ["receipt calculator", "ticket"],
    ],
  },
  fiscalite: {
    libelle: "Fiscalité",
    requetes: [
      ["tax form paperwork", "formulaire"],
      ["calculator documents desk", "calculatrice"],
      ["euro coins stack", "pieces"],
      ["inheritance documents signing hands", "succession"],
      ["piggy bank coins", "epargne"],
    ],
  },
  "ia-numerique": {
    libelle: "IA et numérique",
    requetes: [
      ["server room data center", "serveurs"],
      ["laptop code screen", "code"],
      ["circuit board macro", "circuit"],
      ["smartphone hands", "smartphone"],
      ["fiber optic cables", "fibre"],
    ],
  },
  education: {
    libelle: "Éducation",
    requetes: [
      ["empty classroom desks", "classe"],
      ["school notebooks pencils", "cahiers"],
      ["chalkboard", "tableau"],
      ["school backpack back", "cartable"],
      ["library books shelves", "bibliotheque"],
    ],
  },
  "securite-justice": {
    libelle: "Sécurité et justice",
    requetes: [
      ["courthouse columns", "tribunal"],
      ["gavel", "marteau"],
      ["police car lights night", "gyrophare"],
      ["prison corridor", "prison"],
      ["scales of justice statue", "balance"],
    ],
  },
  sante: {
    libelle: "Santé",
    requetes: [
      ["hospital corridor", "hopital"],
      ["stethoscope", "stethoscope"],
      ["pills medicine", "medicaments"],
      ["hospital bed empty", "lit"],
      ["doctor hands", "soignant"],
    ],
  },
  retraites: {
    libelle: "Retraites",
    requetes: [
      ["elderly couple walking back", "promenade"],
      ["pension coins", "pieces"],
      ["retirement savings jar", "epargne"],
      ["senior hands", "mains"],
      ["park bench autumn", "banc"],
    ],
  },
  emploi: {
    libelle: "Emploi",
    requetes: [
      ["office desks empty", "bureau"],
      ["factory workers back", "usine"],
      ["job interview hands", "entretien"],
      ["construction helmet", "casque"],
      ["resume paper", "cv"],
    ],
  },
  "energie-climat": {
    libelle: "Énergie et climat",
    requetes: [
      ["wind turbines", "eoliennes"],
      ["solar panels", "solaire"],
      ["nuclear power plant cooling tower", "nucleaire"],
      ["power lines pylon", "pylone"],
      ["electric meter", "compteur"],
    ],
  },
  "alimentation-agriculture": {
    libelle: "Agriculture",
    requetes: [
      ["wheat field", "ble"],
      ["tractor field", "tracteur"],
      ["cows pasture", "vaches"],
      ["market vegetables stall", "marche"],
      ["farmer hands soil", "terre"],
    ],
  },
  immigration: {
    libelle: "Immigration",
    requetes: [
      ["passport stamps", "passeport"],
      ["airport departures board", "aeroport"],
      ["border fence landscape", "frontiere"],
      ["suitcase travel", "valise"],
      ["administrative documents stamp", "tampon"],
    ],
  },
  general: {
    libelle: "Général (secours)",
    requetes: [
      ["magnifying glass documents", "loupe"],
      ["newspaper reading table", "journal"],
    ],
  },
  "democratie-et-institutions": {
    libelle: "Institutions",
    requetes: [
      ["ballot box", "urne"],
      ["parliament hemicycle empty", "hemicycle"],
      ["voting booth", "isoloir"],
      ["french flag building", "drapeau"],
      ["constitution book", "constitution"],
    ],
  },
};

// Thème de secours : ses images servent quand le thème de la fiche n'en a
// aucune (ou que la fiche n'a pas de thème reconnu).
export const THEME_SECOURS = "general";

// Requêtes Wikimedia Commons (source par défaut de
// scripts/chercher-illustrations.js) : 2 ou 3 par thème, en français et en
// anglais, avec le mot-clé proposé pour les images trouvées. Des lieux et des
// objets plutôt que des personnes.
export const REQUETES_COMMONS = {
  logement: [
    ["immeuble façade logements", "immeuble"],
    ["apartment building facade", "immeuble"],
    ["construction site crane housing", "chantier"],
  ],
  economie: [
    ["caisse supermarché", "caisse"],
    ["euro banknotes", "billets"],
    ["shopping cart supermarket", "courses"],
  ],
  fiscalite: [
    ["centre des finances publiques", "impots"],
    ["tax return form", "declaration"],
    ["calculator receipts", "calcul"],
  ],
  "ia-numerique": [
    ["salle serveurs informatique", "serveurs"],
    ["data center servers", "serveurs"],
    ["computer keyboard close-up", "clavier"],
  ],
  education: [
    ["salle de classe vide", "classe"],
    ["empty classroom desks", "classe"],
    ["school blackboard chalk", "tableau"],
  ],
  "securite-justice": [
    ["palais de justice France", "tribunal"],
    ["courtroom empty", "tribunal"],
    ["police car France", "police"],
  ],
  sante: [
    ["hôpital couloir", "hopital"],
    ["hospital corridor", "hopital"],
    ["stethoscope", "stethoscope"],
  ],
  retraites: [
    ["banc parc personnes âgées", "banc"],
    ["park bench autumn", "banc"],
    ["retirement elderly hands", "mains"],
  ],
  emploi: [
    ["agence France Travail", "agence"],
    ["factory workers assembly line", "usine"],
    ["office desks open space", "bureau"],
  ],
  "energie-climat": [
    ["éoliennes champ", "eoliennes"],
    ["wind turbines field", "eoliennes"],
    ["solar panels roof", "solaire"],
  ],
  "alimentation-agriculture": [
    ["tracteur champ blé", "champ"],
    ["wheat field harvest", "moisson"],
    ["vegetable market stall France", "marche"],
  ],
  immigration: [
    ["passeport tampon", "passeport"],
    ["airport departures board", "aeroport"],
    ["border crossing checkpoint", "frontiere"],
  ],
  "democratie-et-institutions": [
    ["urne électorale", "urne"],
    ["hémicycle Assemblée nationale", "hemicycle"],
    ["voting booth", "isoloir"],
  ],
  general: [
    ["journaux kiosque", "journal"],
    ["newspapers stack", "journal"],
    ["magnifying glass documents", "loupe"],
  ],
};

// Thèmes de la bibliothèque où puiser pour un thème de fiche (slug ou libellé).
export function themesBibliotheque(themeFiche) {
  const slug = resolveTheme(themeFiche) ?? (THEMES_ILLUSTRATIONS[themeFiche] ? themeFiche : null);
  if (!slug) return [];
  return slug === "economie" ? ["economie", "fiscalite"] : [slug];
}

// Mot-clé normalisé : minuscules, sans accents, tirets.
export function motCleNormalise(mot) {
  return String(mot ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Licences qui demandent un crédit visible (couverture et slide de fin) :
// CC BY et CC BY-SA, toutes versions. CC0, domaine public et licence Pexels
// n'en demandent pas (le crédit reste ici et dans la légende).
export function creditObligatoire(licence) {
  return /^CC BY(-SA)?\b/i.test(String(licence ?? "").trim());
}

// --- Liste de la bibliothèque --------------------------------------------------------
// Écrite par scripts/chercher-illustrations.js --telecharger : ne pas modifier à la
// main entre les deux repères (sauf pour retirer une image).
// Chaque entrée : { fichier (relatif à public/), theme, motsCles, source, auteur, licence, lien }.
// DEBUT LISTE ILLUSTRATIONS
export const ILLUSTRATIONS = [];
// FIN LISTE ILLUSTRATIONS

// Images disponibles pour un thème de fiche.
export function illustrationsDuTheme(themeFiche, liste = ILLUSTRATIONS) {
  const themes = themesBibliotheque(themeFiche);
  return liste.filter((ill) => themes.includes(ill.theme));
}

// Images où puiser pour une fiche : celles de son thème, sinon celles du
// thème de secours.
export function illustrationsPourFiche(themeFiche, liste = ILLUSTRATIONS) {
  const duTheme = illustrationsDuTheme(themeFiche, liste);
  return duTheme.length ? duTheme : liste.filter((ill) => ill.theme === THEME_SECOURS);
}

// Liste fermée des mots-clés disponibles pour un thème de fiche (envoyée au
// modèle du carrousel détaillé).
export function motsClesDisponibles(themeFiche, liste = ILLUSTRATIONS) {
  return [...new Set(illustrationsPourFiche(themeFiche, liste).flatMap((ill) => ill.motsCles ?? []))].sort();
}

// Contrôle des mots-clés choisis par le modèle : 0 à 2, dans la liste fermée.
// Renvoie { motsCles, avertissements } (un mot hors liste est écarté avec un
// avertissement : le choix retombe sur le tirage).
export function controlerMotsCles(proposes, disponibles) {
  const avertissements = [];
  const liste = (Array.isArray(proposes) ? proposes : []).map(motCleNormalise).filter(Boolean);
  if (liste.length > 2) avertissements.push(`illustration : ${liste.length} mots-clés proposés, seuls les 2 premiers sont gardés.`);
  const motsCles = [];
  for (const mot of liste.slice(0, 2)) {
    if (disponibles.includes(mot)) motsCles.push(mot);
    else avertissements.push(`illustration : mot-clé « ${mot} » hors de la liste du thème, écarté.`);
  }
  return { motsCles, avertissements };
}

// Choix de l'image de couverture :
//  - parmi les images du thème de la fiche, sinon (thème vide ou inconnu)
//    celles du thème de secours « general » ;
//  - `demandee` (fichier, bouton « Changer d'image ») : prise telle quelle si
//    elle est dans ces images ;
//  - si des mots-clés sont donnés (choisis par le modèle dans la liste
//    fermée), de préférence parmi celles qui en portent au moins un ;
//  - en écartant les images des 2 derniers carrousels (`recentes` : fichiers,
//    le plus récent d'abord ; `derniere` : ancien paramètre, une seule image),
//    sinon la moins récemment utilisée (src/lib/rotation-images.js) ;
//  - `alea` (0 ≤ x < 1), fourni par l'appelant (stable pour une version :
//    voir aleaFiche), départage les images libres.
// Renvoie { illustration, avertissement } ; illustration null si ni le thème
// ni le secours n'ont d'image (couverture sans illustration, et un avertissement).
export function choisirIllustration({ theme, motsCles = [], recentes = [], derniere = null, demandee = null, alea = 0, liste = ILLUSTRATIONS }) {
  const duTheme = illustrationsDuTheme(theme, liste);
  const pourFiche = illustrationsPourFiche(theme, liste);
  if (pourFiche.length === 0) {
    const nom = resolveTheme(theme) ?? theme ?? "(aucun)";
    return {
      illustration: null,
      avertissement: `Pas d'image de thème pour « ${nom} » ni dans le dossier de secours « ${THEME_SECOURS} » (couverture sans illustration). La remplir : npm run banque-images:themes, puis /test/illustrations.`,
    };
  }
  const avertissement = duTheme.length === 0 ? `Pas encore d'image pour le thème « ${resolveTheme(theme) ?? theme ?? "(aucun)"} » : image du dossier de secours « ${THEME_SECOURS} ».` : null;
  const voulue = demandee ? pourFiche.find((ill) => ill.fichier === demandee) : null;
  if (voulue) return { illustration: voulue, avertissement };
  const historique = recentes?.length ? recentes : derniere ? [derniere] : [];
  const voulus = motsCles.map(motCleNormalise);
  const parMot = voulus.length ? pourFiche.filter((ill) => (ill.motsCles ?? []).some((m) => voulus.includes(m))) : [];
  const bloquees = new Set(historique.slice(0, CARROUSELS_EXCLUS));
  // Les mots-clés orientent le choix tant qu'une de leurs images est libre.
  const pool = parMot.some((ill) => !bloquees.has(ill.fichier)) ? parMot : pourFiche;
  const illustration = choisirEnRotation(pool, { cle: (ill) => ill.fichier, recentes: historique, alea });
  return { illustration, avertissement };
}

// Tirage stable pour une fiche (même image à chaque affichage), de 0 à 1.
export function aleaFiche(graine) {
  return parseInt(empreinte(String(graine)).slice(0, 8), 16) / 0x100000000;
}

// Ligne « Photo : auteur, licence, source » d'une image de thème.
function lignePhoto(illustration) {
  return `Photo : ${illustration.auteur}, ${illustration.licence}, ${illustration.source}`;
}

// Ligne de crédit visible (couverture, en tout petit, et slide de fin), ou
// null si la licence ne la demande pas (CC0, domaine public, Pexels).
export function creditVisible(illustration) {
  if (!illustration || !creditObligatoire(illustration.licence)) return null;
  return lignePhoto(illustration);
}

// Ligne de crédit pour la légende (toujours, quand une image est utilisée).
export function creditLegende(illustration) {
  if (!illustration) return null;
  return `${lignePhoto(illustration)} ${illustration.lien ?? ""}`.trim();
}
