import { getScoreBadge } from "./score.js";

// Cartes 1200×1200 des publications X (route src/app/api/carte/[id]/route.js).
// Fonctions PURES (ni Next, ni base, ni fichiers) pour pouvoir les tester avec
// `node --test` (scripts/carte.test.js).

export const FORMATS_CARTE = ["score", "chiffre", "tient"];

// Couleurs de l'encart du score et de sa pastille, selon l'appréciation :
// rouge (Irréaliste, Fragile), orange (Partiellement fondé), jaune (Plausible
// sous condition), vert (Solide et chiffré, Exemplaire). L'orange est celui de
// la carte d'origine (skill perlimpinpin-thread-x).
const TEINTES = {
  rouge: { score: "#d92d20", pastilleFond: "#fde4e1", pastilleTexte: "#c0251a" },
  orange: { score: "#f2552c", pastilleFond: "#fde6da", pastilleTexte: "#e5481f" },
  jaune: { score: "#d99a00", pastilleFond: "#fdf2cc", pastilleTexte: "#a26f00" },
  vert: { score: "#1f9d55", pastilleFond: "#dcf5e5", pastilleTexte: "#17804a" },
};

const TEINTE_PAR_COULEUR = {
  "red-dark": "rouge",
  red: "rouge",
  orange: "orange",
  amber: "jaune",
  green: "vert",
  "green-dark": "vert",
};

// Appréciation (libellé du barème, src/lib/score.js) et couleurs de la carte.
export function appreciationCarte(score) {
  const badge = getScoreBadge(score);
  return { label: badge.label, ...TEINTES[TEINTE_PAR_COULEUR[badge.color] ?? "orange"] };
}

// Titre de la carte : même règle que la fiche publique (displayTitle dans
// src/lib/queries.js). Partagé par la route et les pages qui construisent
// l'URL versionnée, pour que l'empreinte soit la même des deux côtés.
export function titreCarte(proposition) {
  if (proposition.titre) return proposition.titre;
  const texte = proposition.texteOriginal ?? "";
  return texte.length > 80 ? `${texte.slice(0, 79).trimEnd()}…` : texte;
}

// Mots de liaison après lesquels commence la partie grise du titre : le sujet
// (« Des robots ») reste en noir, la suite (« pour remplacer… ») passe en gris.
const MOTS_LIAISON = new Set([
  "pour", "de", "du", "des", "d", "à", "au", "aux", "contre", "sur", "dans", "en",
  "par", "avec", "sans", "sous", "entre", "qui", "que", "dès", "jusqu", "afin",
]);

function motNu(mot) {
  return mot.toLowerCase().replace(/[’'].*$/, "").replace(/[^\p{L}]/gu, "");
}

// Coupe le titre en { noir, gris }. Priorité à une ponctuation (« : », « , »)
// dans les 6 premiers mots, puis au premier mot de liaison (à partir du 2e
// mot), sinon la première moitié (3 mots au plus) en noir.
export function couperTitre(titre) {
  const mots = String(titre ?? "").trim().split(/\s+/).filter(Boolean);
  if (mots.length <= 1) return { noir: mots.join(" "), gris: "" };

  const decoupe = (n) => ({ noir: mots.slice(0, n).join(" "), gris: mots.slice(n).join(" ") });

  for (let i = 0; i < Math.min(6, mots.length - 1); i += 1) {
    if (/[:,;]$/.test(mots[i])) return decoupe(i + 1);
  }
  for (let i = 1; i < Math.min(5, mots.length); i += 1) {
    if (MOTS_LIAISON.has(motNu(mots[i]))) return decoupe(i);
  }
  return decoupe(Math.min(3, Math.ceil(mots.length / 2)));
}

// « La mesure de Marine Le Pen » / « La mesure d'Édouard Philippe ».
export function sousTitreCarte(nom) {
  const nomPropre = String(nom ?? "").trim();
  const initiale = nomPropre.normalize("NFD").charAt(0).toLowerCase();
  const de = /[aeiouyh]/.test(initiale) ? "d’" : "de ";
  return `La mesure ${de}${nomPropre} passée au crible.`;
}

// Nombre de lignes estimé pour un texte en Inter, sur une largeur donnée
// (largeur moyenne d'un caractère ≈ 0,45 × la taille, en gras 800 avec
// l'espacement serré du titre : mesuré sur les rendus).
export function lignesEstimees(texte, taille, largeur, ratio = 0.45) {
  const parLigne = Math.max(1, Math.floor(largeur / (taille * ratio)));
  let lignes = 1;
  let courante = 0;
  for (const mot of String(texte ?? "").split(/\s+/).filter(Boolean)) {
    const longueur = mot.length;
    if (courante === 0) courante = longueur;
    else if (courante + 1 + longueur <= parLigne) courante += 1 + longueur;
    else {
      lignes += 1;
      courante = longueur;
    }
  }
  return lignes;
}

// Taille du titre de la carte « score » : 88 px tant qu'il tient en 5 lignes
// (la place disponible au-dessus du trait), sinon plus petit.
export function tailleTitre(titre, largeur = 580) {
  for (const taille of [88, 76, 66, 58]) {
    if (lignesEstimees(titre, taille, largeur) * taille * 0.98 <= 470) return taille;
  }
  return 52;
}

// Taille du chiffre de la carte « chiffre » : sur une seule ligne, environ la
// moitié de l'image.
export function tailleChiffre(valeur) {
  const longueur = Math.max(1, Array.from(String(valeur ?? "")).length);
  return Math.min(320, Math.floor(1040 / (longueur * 0.6)));
}

// Fichier du portrait bleu : public/portraits-bleus/<slug>.png, le slug étant
// celui de la photo du candidat (/photos/marine-le-pen.jpg), sinon son nom.
export function slugCandidat({ nom, photoUrl } = {}) {
  const depuisPhoto = typeof photoUrl === "string" ? photoUrl.match(/^\/photos\/([^/]+)\.[a-z]+$/i) : null;
  if (depuisPhoto) return depuisPhoto[1];
  return String(nom ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// Empreinte courte (FNV-1a 32 bits, 8 caractères hexadécimaux) : pas de
// node:crypto, pour rester utilisable côté navigateur.
export function empreinte(texte) {
  let h = 0x811c9dc5;
  for (const caractere of texte) {
    h ^= caractere.codePointAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

// Version de la carte, dans l'URL : identifiant de l'analyse + empreinte de
// tout ce que la carte affiche (titre, candidat, score, appréciation, textes
// des cartes « chiffre » et « tient »). Le moindre changement donne une
// nouvelle URL, ce qui permet de mettre l'image en cache « pour toujours ».
export function versionCarte({ analyseId, titre, candidatNom, score, reseaux }) {
  const contenu = JSON.stringify([
    titre ?? "",
    candidatNom ?? "",
    score,
    appreciationCarte(score).label,
    reseaux?.chiffre ? [reseaux.chiffre.valeur, reseaux.chiffre.explication] : null,
    reseaux?.tient ? [reseaux.tient.titre, reseaux.tient.tient, reseaux.tient.tient_pas] : null,
  ]);
  return `${analyseId}-${empreinte(contenu)}`;
}

// `carte` : { analyseId, titre, candidatNom, score, reseaux } (voir versionCarte).
export function cheminCarte({ propositionId, format = "score", brouillon = false, ...carte }) {
  const params = new URLSearchParams({ format, v: versionCarte(carte) });
  if (brouillon) params.set("brouillon", "1");
  return `/api/carte/${propositionId}?${params}`;
}

// En-tête de cache : immuable pour une fiche publiée demandée avec sa version
// courante ; court pour une URL sans version (ou périmée) ; jamais en cache
// partagé pour un brouillon.
export function cacheControlCarte({ publie, versionDemandee, versionCourante }) {
  if (!publie) return "private, no-store";
  if (versionDemandee && versionDemandee === versionCourante) {
    return "public, max-age=31536000, s-maxage=31536000, immutable";
  }
  return "public, max-age=300, s-maxage=3600";
}
