import { resolveTheme } from "./themes.js";

// Comptes Instagram des candidats et hashtags de la légende du carrousel
// Instagram (src/lib/carrousel.js), sur le modèle de src/lib/handles-x.js.
// Clé : nom exact du candidat en base (Candidat.nom).
//
// Laissé VIDE volontairement : Arno le remplit lui-même. Chaque entrée :
//   "Fabien Roussel": { compte: "@compte_officiel", verifie: true }
// `verifie: true` seulement si le compte officiel porte le badge vérifié :
// le carrousel détaillé ne mentionne (@) que ces comptes-là. L'ancienne
// écriture ("Nom": "@compte") reste lue par le carrousel 6 slides. Tant qu'un
// candidat n'y figure pas (ou vaut null), la légende porte son nom, sans @
// (aucune notification), et la page de partage le signale.
export const HANDLES_INSTAGRAM = {};

// Comparaison sans accents ni majuscules : « Edouard Philippe » en base
// retrouve bien « Édouard Philippe » ici.
function cle(nom) {
  return String(nom ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// « @compte » si le compte est renseigné (avec ou sans @ dans la table), sinon
// null. Nom d'utilisateur Instagram : lettres, chiffres, points et tirets bas,
// 30 caractères au plus.
function entreeDe(nom, table) {
  const entree = Object.entries(table ?? {}).find(([candidat]) => cle(candidat) === cle(nom))?.[1];
  if (typeof entree === "string") return { compte: entree, verifie: false };
  if (entree && typeof entree === "object" && typeof entree.compte === "string") return { compte: entree.compte, verifie: entree.verifie === true };
  return null;
}

function compteValide(compte) {
  if (typeof compte !== "string" || !/^@?[\w.]{1,30}$/.test(compte.trim())) return null;
  return `@${compte.trim().replace(/^@/, "")}`;
}

export function handleInstagram(nom, table = HANDLES_INSTAGRAM) {
  return compteValide(entreeDe(nom, table)?.compte);
}

// « @compte » seulement si le compte est marqué `verifie: true`, sinon null
// (carrousel détaillé : la mention @ n'apparaît que pour un compte vérifié).
export function handleInstagramVerifie(nom, table = HANDLES_INSTAGRAM) {
  const entree = entreeDe(nom, table);
  return entree?.verifie ? compteValide(entree.compte) : null;
}

// Mot d'un hashtag : sans accents, chaque partie avec une majuscule initiale,
// sans espaces, tirets ni apostrophes. « Jean-Luc Mélenchon » → « JeanLucMelenchon ».
function enCamel(texte) {
  return String(texte ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((mot) => mot.charAt(0).toUpperCase() + mot.slice(1))
    .join("");
}

// « #FabienRoussel », ou null si le nom est vide.
export function hashtagCandidat(nom) {
  const mot = enCamel(nom);
  return mot ? `#${mot}` : null;
}

// Hashtag de chaque thème du site (slug de src/lib/themes.js).
export const HASHTAGS_THEMES = {
  logement: "#Logement",
  economie: "#PouvoirDAchat",
  "ia-numerique": "#Numerique",
  education: "#Education",
  "securite-justice": "#Securite",
  sante: "#Sante",
  retraites: "#Retraites",
  emploi: "#Emploi",
  "energie-climat": "#Climat",
  "alimentation-agriculture": "#Agriculture",
  immigration: "#Immigration",
  "democratie-et-institutions": "#Democratie",
};

// Hashtag du thème (Proposition.theme, slug ou ancienne écriture), ou null si
// le thème n'est pas reconnu.
export function hashtagTheme(theme) {
  return HASHTAGS_THEMES[resolveTheme(theme)] ?? null;
}
