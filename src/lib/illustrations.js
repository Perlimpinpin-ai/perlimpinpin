import { empreinte } from "./carte.js";
import { resolveTheme } from "./themes.js";

// Bibliothèque des images de thème des carrousels Instagram (couverture).
//
// Principe : une bibliothèque validée une fois à la main, puis un choix
// automatique. Jamais d'image générée par IA, jamais de recherche d'image au
// moment de la génération d'un carrousel.
//
//  1. node scripts/chercher-illustrations.js <thème>
//       → interroge l'API Pexels (clé PEXELS_API_KEY dans .env) avec les
//         requêtes du thème ci-dessous et garde 20 candidates dans
//         data/illustrations/candidates/<thème>.json (--simulation : candidates
//         factices, sans appel) ;
//  2. /test/illustrations : on coche les candidates retenues (et on corrige
//     leur mot-clé) → data/illustrations/selection/<thème>.json ;
//  3. node scripts/chercher-illustrations.js <thème> --telecharger
//       → télécharge les retenues dans public/illustrations/<thème>/<mot-clé>.jpg
//         et réécrit la liste ILLUSTRATIONS ci-dessous (entre les deux repères).
// Rien n'entre dans la bibliothèque sans cette validation.
//
// Fonctions PURES (choix, crédit), testées par scripts/illustrations.test.js.
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

// Licences qui demandent un crédit visible sur la slide de fin. La licence
// Pexels n'en demande pas (le crédit reste ici et dans legende.txt).
const LICENCES_CREDIT_OBLIGATOIRE = new Set(["CC BY 4.0", "CC BY-SA 4.0", "CC BY 2.0", "CC BY-SA 3.0"]);

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

// Liste fermée des mots-clés disponibles pour un thème de fiche (envoyée au
// modèle du carrousel détaillé).
export function motsClesDisponibles(themeFiche, liste = ILLUSTRATIONS) {
  return [...new Set(illustrationsDuTheme(themeFiche, liste).flatMap((ill) => ill.motsCles ?? []))].sort();
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
//  - parmi les images du thème de la fiche ;
//  - si des mots-clés sont donnés (choisis par le modèle dans la liste
//    fermée), parmi celles qui en portent au moins un ;
//  - sinon tirage au hasard dans le thème ; `alea` (0 ≤ x < 1) est fourni par
//    l'appelant (stable pour une fiche : voir aleaFiche) ;
//  - en évitant `derniere` (fichier de l'image du dernier carrousel du même
//    thème) quand il reste une autre image.
// Renvoie { illustration, avertissement } ; illustration null si le thème n'a
// aucune image (couverture sans illustration, et un avertissement).
export function choisirIllustration({ theme, motsCles = [], derniere = null, alea = 0, liste = ILLUSTRATIONS }) {
  const duTheme = illustrationsDuTheme(theme, liste);
  if (duTheme.length === 0) {
    const nom = resolveTheme(theme) ?? theme ?? "(aucun)";
    return {
      illustration: null,
      avertissement: `Pas d'image de thème pour « ${nom} » : la bibliothèque est vide pour ce thème (couverture sans illustration). La remplir : node scripts/chercher-illustrations.js ${themesBibliotheque(theme)[0] ?? "<thème>"}, puis /test/illustrations.`,
    };
  }
  const voulus = motsCles.map(motCleNormalise);
  const parMot = voulus.length ? duTheme.filter((ill) => (ill.motsCles ?? []).some((m) => voulus.includes(m))) : [];
  let pool = parMot.length ? parMot : duTheme;
  if (derniere && pool.length > 1) pool = pool.filter((ill) => ill.fichier !== derniere);
  const index = Math.min(pool.length - 1, Math.floor(Math.max(0, Math.min(alea, 0.999999)) * pool.length));
  return { illustration: pool[index], avertissement: null };
}

// Tirage stable pour une fiche (même image à chaque affichage), de 0 à 1.
export function aleaFiche(graine) {
  return parseInt(empreinte(String(graine)).slice(0, 8), 16) / 0x100000000;
}

// Ligne de crédit visible sur la slide de fin, ou null si la licence ne la
// demande pas.
export function creditVisible(illustration) {
  if (!illustration || !LICENCES_CREDIT_OBLIGATOIRE.has(illustration.licence)) return null;
  return `Photo : ${illustration.auteur} / ${illustration.source}`;
}

// Ligne de crédit pour legende.txt (toujours, quand une image est utilisée).
export function creditLegende(illustration) {
  if (!illustration) return null;
  return `Photo de couverture : ${illustration.auteur} / ${illustration.source} (${illustration.licence}) ${illustration.lien}`.trim();
}
