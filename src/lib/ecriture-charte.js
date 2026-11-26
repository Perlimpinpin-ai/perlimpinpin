// Règles d'écriture de la charte RS (docs/charte-rs.md, page 4), communes aux
// trois formats de carrousel : nombres insécables, nom de famille seul en
// couverture, pas d'intertitre de rubrique, titres informatifs, aucun reste
// de maquette, équité entre candidats, ordre alphabétique, moyenne.
// Fonctions PURES, testées par scripts/charte-rs.test.js.

const INSECABLE = " ";
const FINE = " ";

function sansAccents(t) {
  return String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// Unités qui ne se séparent jamais de leur nombre.
const UNITES = [
  "%", "€", "\\$", "Md€", "M€", "k€", "Md", "M", "k",
  "milliards?", "millions?", "milliers?", "mille",
  "euros?", "dollars?", "points?", "ans?", "mois", "semaines?", "jours?", "heures?", "minutes?",
  "fois", "km", "kg", "tonnes?", "°C", "places?", "lits?", "postes?", "emplois?", "élèves?", "personnes?", "habitants?",
];
const RE_UNITE = new RegExp(`(\\d) (?=(?:${UNITES.join("|")})(?![\\p{L}\\d]))`, "gu");

// Espaces insécables dans et autour des nombres, avant le rendu :
//  « 50 000 » (groupes de chiffres), « 20 % », « 6,8 milliards »,
//  « 30 à 40 ans », « 1er janvier 2027 » reste tel quel sauf le jour et le mois.
export function insecables(texte) {
  return String(texte ?? "")
    .replace(/(\d)[  ](?=\d{3}(?!\d))/g, `$1${INSECABLE}`)
    .replace(/(\d)[  ](?=\d{3}(?!\d))/g, `$1${INSECABLE}`)
    .replace(RE_UNITE, `$1${INSECABLE}`)
    .replace(/(\d) (à|et|ou) (?=\d)/g, `$1${INSECABLE}$2${INSECABLE}`)
    .replace(/(^|[\s(])([+−-]|~|près de|environ) (?=\d)/g, (_, a, b) => `${a}${b}${INSECABLE}`)
    .replace(/\b(n°|N°|p\.) (?=\d)/g, `$1${INSECABLE}`)
    .replace(new RegExp(FINE, "g"), INSECABLE);
}

// Prénom et nom de famille d'un nom complet : « Dominique de Villepin » →
// { prenom: "Dominique", famille: "Villepin" } (la particule « de » tombe,
// « Le » reste : « Le Pen »).
export function decouperNom(candidatNom) {
  const [prenom = "", ...reste] = String(candidatNom ?? "").trim().split(/\s+/);
  const famille = reste.join(" ").replace(/^(de|d['’])\s*/i, "");
  return { prenom, famille: famille || prenom };
}

export function nomDeFamille(candidatNom) {
  return decouperNom(candidatNom).famille;
}

// Le texte contient-il le prénom du candidat (mot entier) ?
export function contientPrenom(texte, candidatNom) {
  const { prenom, famille } = decouperNom(candidatNom);
  if (!prenom || prenom === famille) return false;
  const motif = sansAccents(prenom).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}-])${motif}($|[^\\p{L}-])`, "u").test(sansAccents(texte));
}

// Intertitres de rubrique interdits comme titre (page 4) : le titre entier
// n'est que la rubrique. Les petites étiquettes en chasse fixe restent permises.
export const RUBRIQUES_INTERDITES = [
  "la mesure", "la proposition", "sa proposition", "impact", "impacts", "l'impact", "le constat", "constat", "conclusion", "en conclusion",
  "notre avis", "la note", "le contexte", "contexte", "le bilan", "bilan", "en resume", "resume", "court terme", "long terme", "a court terme", "a long terme",
  "ailleurs", "ailleurs ou avant", "les chiffres", "chiffres cles", "les chiffres cles", "introduction", "synthese", "analyse", "l'analyse", "vue d'ensemble", "le comparatif", "comparatif",
];

export function estRubrique(titre) {
  const t = sansAccents(titre).replace(/[’]/g, "'").replace(/[.!?:…\s]+$/u, "").replace(/^[\s«"]+|[\s»"]+$/gu, "").trim();
  return RUBRIQUES_INTERDITES.includes(t);
}

// Un titre « apporte un fait, un chiffre ou une conséquence » : contrôle
// simple, il contient un nombre (avertissement seulement s'il n'en a pas).
export function contientChiffre(texte) {
  return /\d/.test(String(texte ?? ""));
}

// Restes de maquette interdits à l'export (badges « exemple », candidat fictif,
// crédits à compléter, « ?/100 » hors couverture programme, marqueurs non remplis).
export function restesDeMaquette(texte, { couverturePrograme = false } = {}) {
  const t = String(texte ?? "");
  const restes = [];
  // Le badge seul, en capitales ou entre crochets / parenthèses / guillemets ;
  // « par exemple » dans une phrase reste permis.
  if (/^\s*exemple\s*$/i.test(t) || /\bEXEMPLE\b/.test(t) || /[[(«"]\s*exemple\s*[\])»"]/i.test(t)) restes.push("badge « exemple »");
  if (/\bCandidat\s+[A-Z]\b/.test(t)) restes.push("« Candidat A »");
  if (/\[?\s*crédits? à compléter\s*\]?/i.test(t)) restes.push("« [crédits à compléter] »");
  if (!couverturePrograme && /\?\s*\/\s*100/.test(t)) restes.push("« ?/100 »");
  if (/\{[A-Z_]+\}/.test(t)) restes.push("marqueur non rempli");
  if (/lorem ipsum|\bTODO\b|\bXXX?\b/i.test(t)) restes.push("texte de remplissage");
  return [...new Set(restes)];
}

// Formules fixes (page 4), écrites par le code.
export const FORMULES = {
  sousTitreCouverture: "Sa proposition : bonne idée… ou poudre de perlimpinpin ?",
  bilan: "Ce qui tient… et ce qui coince.",
  fin: "Une analyse réalisée par l’IA Perlimpinpin.",
};

// Exemples « à éviter / à préférer » de la page 4, repris dans les prompts.
export const EXEMPLES_TITRES = [
  ["Nos retraites sont dans le rouge.", "Retraites : un trou de 6,8 milliards en 2030."],
  ["À long terme, ça peut payer.", "Son pari peut payer… mais dans 30 à 40 ans."],
  ["Riner a le bon cap, mais pas le mode d’emploi.", "Bonne idée, mais rien n’est chiffré."],
  ["Teddy Riner veut revoir les retraites.", "Riner veut-il placer vos retraites en Bourse ?"],
  ["La capitalisation ne résout pas le déficit.", "D’ici 2 ans, le trou de 6,8 milliards reste entier."],
];

export function exemplesPourPrompt() {
  return EXEMPLES_TITRES.map(([eviter, preferer]) => `  - à éviter : « ${eviter} » → à préférer : « ${preferer} »`).join("\n");
}

// Ordre alphabétique des candidats (nom de famille, à la française).
export function ordreAlphabetique(candidats, nomDe = (c) => c.nom ?? c) {
  return [...candidats].sort((a, b) => nomDeFamille(nomDe(a)).localeCompare(nomDeFamille(nomDe(b)), "fr", { sensitivity: "base" }) || String(nomDe(a)).localeCompare(String(nomDe(b)), "fr"));
}

// Moyenne des notes (arrondie à l'entier, comme les notes affichées).
export function moyenneNotes(notes) {
  const valides = notes.map(Number).filter(Number.isFinite);
  if (!valides.length) return null;
  return Math.round(valides.reduce((t, n) => t + n, 0) / valides.length);
}

export function nombreMots(texte) {
  return String(texte ?? "").replace(/\*\*/g, "").split(/\s+/).filter((m) => /[\p{L}\d]/u.test(m)).length;
}

// Équité (page 3) : longueur comparable pour chaque candidat ; écart de plus
// de 20 % sur le nombre de mots → avertissement. `textes` : { nom: texte }.
export const ECART_EQUITE = 0.2;
export function ecartsEquite(textes) {
  const mots = Object.entries(textes).map(([nom, t]) => ({ nom, mots: nombreMots(t) }));
  if (mots.length < 2) return [];
  const moyenne = mots.reduce((t, m) => t + m.mots, 0) / mots.length;
  return mots.filter((m) => moyenne > 0 && Math.abs(m.mots - moyenne) / moyenne > ECART_EQUITE).map((m) => ({ ...m, moyenne: Math.round(moyenne) }));
}
