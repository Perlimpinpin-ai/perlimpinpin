import { getScoreBadge, getScoreBands } from "./score.js";

// Jetons de la charte graphique réseaux sociaux (docs/charte-rs.pdf, v1,
// novembre 2026 ; règles en texte : docs/charte-rs.md). SOURCE UNIQUE des
// couleurs, polices, tailles, marges et pictos des carrousels (« une mesure »,
// « analyse de programme », « thématique ») et de la palette des Reels.
// Aucun code hexadécimal ailleurs dans les composants des carrousels
// (src/components/carrousels/) : scripts/charte-rs.test.js le vérifie.
// Fonctions PURES.

// --- Couleurs fixes de la marque (carrousels, page 5) ------------------------
export const MARQUE = {
  jaune: "#FFD23F", // surlignage : mots clés, boutons, liseré photo
  creme: "#F1ECE2", // papier crème : fond des slides de contenu
  carte: "#FBF8F2", // bulles granuleuses
  encre: "#141413", // texte principal
  texte: "#2A2926", // texte courant
  gris: "#6E6A62", // sources, étiquettes
  blanc: "#FFFFFF",
  encreFondClair: "#1E1915", // titres sur les fonds clairs du registre
};

// --- Reels (écran pixel mid-century, page 5) ----------------------------------
export const REELS = {
  charbon: "#17130F",
  creme: "#F2E8D5",
  moutarde: "#E3A72F",
  canard: "#2F8C8A",
  rouille: "#CF5435",
  oliveClair: "#8FA644",
  grisChaud: "#9C9384",
};

// --- Verdicts (page 5) ------------------------------------------------------------
// La charte compte 4 verdicts (70 / 50 / 35). Le verdict reste CALCULÉ PAR LE
// CODE (src/lib/score.js : 6 paliers, seuils 80 / 65 / 50 / 35 / 20) : on n'y
// touche pas. Chaque palier du code prend la couleur du verdict de la charte
// qui lui correspond (écart signalé dans docs/charte-rs.md).
export const VERDICTS = {
  solide: { nom: "Solide", couleur: "#4F7A3A", min: 70 },
  plausible: { nom: "Plausible sous condition", couleur: "#C08A1E", min: 50 },
  fragile: { nom: "Fragile", couleur: "#C9622B", min: 35 },
  peuRealiste: { nom: "Peu réaliste", couleur: "#B5432E", min: 0 },
};
export const SEUILS_CHARTE = [70, 50, 35];
const VERDICT_PAR_COULEUR_CODE = { "green-dark": "solide", green: "solide", amber: "plausible", orange: "fragile", red: "peuRealiste", "red-dark": "peuRealiste" };

// Seuils du code (bas de chaque palier sauf le dernier), pour comparer à la charte.
export function seuilsDuCode() {
  return getScoreBands().map((b) => b.min).filter((m) => m > 0);
}

export function seuilsConformes() {
  const code = seuilsDuCode();
  return code.length === SEUILS_CHARTE.length && code.every((s, i) => s === SEUILS_CHARTE[i]);
}

// Verdict d'une note : libellé du code, couleur de la charte.
export function verdictDe(score) {
  const badge = getScoreBadge(Number(score));
  const cle = VERDICT_PAR_COULEUR_CODE[badge.color] ?? "fragile";
  return { cle, libelle: badge.label, couleur: VERDICTS[cle].couleur };
}

// Légende des verdicts : les paliers du code avec leur couleur de charte.
export function legendeVerdicts() {
  return getScoreBands().map((b) => ({ libelle: b.label, min: b.min, max: b.max, couleur: VERDICTS[VERDICT_PAR_COULEUR_CODE[b.color] ?? "fragile"].couleur }));
}

// --- Registre des candidats (page 7) --------------------------------------------
// Clé : nom exact en base (Candidat.nom). fond : couverture et fin ; accent :
// bloc derrière le candidat ; clair : fond clair → titres en encre #1E1915.
export const REGISTRE_CANDIDATS = {
  "Bruno Retailleau": { nom: "Marine", fond: "#22355C", accent: "#B04E28", clair: false },
  "David Lisnard": { nom: "Bleu poudre", fond: "#A7B8BD", accent: "#22355C", clair: true },
  "Dominique de Villepin": { nom: "Sable", fond: "#D9CDB3", accent: "#24566E", clair: true },
  "Édouard Philippe": { nom: "Ardoise", fond: "#4C6178", accent: "#8A4B2A", clair: false },
  "Éric Zemmour": { nom: "Charbon", fond: "#2B2622", accent: "#B04E28", clair: false },
  "Fabien Roussel": { nom: "Brique", fond: "#B5432E", accent: "#22355C", clair: false },
  "Gabriel Attal": { nom: "Beurre", fond: "#EFD9A0", accent: "#2D5A8C", clair: true, surlignage: "#FFFFFF" },
  "Jean-Luc Mélenchon": { nom: "Violet prune", fond: "#674A86", accent: "#1F6A6A", clair: false },
  "Marine Le Pen": { nom: "Pêche", fond: "#EFCDB6", accent: "#22355C", clair: true },
  "Marine Tondelier": { nom: "Sapin", fond: "#2F6A4C", accent: "#B04E28", clair: false },
  "Raphaël Glucksmann": { nom: "Ocre", fond: "#9A632E", accent: "#24566E", clair: false },
  "Teddy Riner": { nom: "Bleu Eames", fond: "#2C6A9E", accent: "#E89A5B", clair: false },
};

// --- Nuancier mid-century (page 8) ----------------------------------------------
// Pour les nouveaux candidats et les thèmes. Chaudes : 01 à 08 et 16 à 20 ;
// froides : 09 à 15. 05 et 06 sont proches du jaune de surlignage.
export const NUANCIER = [
  { n: 1, nom: "Teck", fond: "#8A4B2A", accent: "#22355C" },
  { n: 2, nom: "Terracotta", fond: "#B04E28", accent: "#22355C" },
  { n: 3, nom: "Rouille", fond: "#A2401F", accent: "#24566E" },
  { n: 4, nom: "Orange brûlé", fond: "#B5551A", accent: "#22355C" },
  { n: 5, nom: "Moutarde", fond: "#8F6F10", accent: "#4E2E4F", procheJaune: true },
  { n: 6, nom: "Or récolte", fond: "#977000", accent: "#22355C", procheJaune: true },
  { n: 7, nom: "Olive", fond: "#666620", accent: "#7E2A35" },
  { n: 8, nom: "Avocat", fond: "#5A6B27", accent: "#4E2E4F" },
  { n: 9, nom: "Sauge", fond: "#4D6853", accent: "#A2401F" },
  { n: 10, nom: "Sapin", fond: "#2F5D46", accent: "#B04E28" },
  { n: 11, nom: "Canard", fond: "#1F6A6A", accent: "#A2401F" },
  { n: 12, nom: "Turquoise atomique", fond: "#1A7178", accent: "#5A3A2A" },
  { n: 13, nom: "Pétrole", fond: "#24566E", accent: "#B5551A" },
  { n: 14, nom: "Bleu Eames", fond: "#2D5A8C", accent: "#8A4B2A" },
  { n: 15, nom: "Marine", fond: "#22355C", accent: "#B04E28" },
  { n: 16, nom: "Prune", fond: "#6A3352", accent: "#22355C" },
  { n: 17, nom: "Bordeaux", fond: "#7E2A35", accent: "#24566E" },
  { n: 18, nom: "Rose fumé", fond: "#9A4A58", accent: "#22355C" },
  { n: 19, nom: "Aubergine", fond: "#4E2E4F", accent: "#977000" },
  { n: 20, nom: "Chocolat", fond: "#5A3A2A", accent: "#1A7178" },
].map((c) => ({ ...c, temperature: c.n >= 9 && c.n <= 15 ? "froide" : "chaude" }));

// --- Thèmes (carrousel thématique) ---------------------------------------------
// Couleur du nuancier (n°) et picto de chaque thème du site (src/lib/themes.js).
// Validées par Arno le 26/11/2026. Un thème sans couleur ici : pas de carrousel
// thématique ; sans picto : pas de picto. Agriculture partage « leaf » avec
// Climat (pas de meilleur picto dans la liste fermée).
export const COULEURS_THEMES = {
  logement: 1, // Teck
  economie: 20, // Chocolat
  "ia-numerique": 12, // Turquoise atomique
  education: 13, // Pétrole
  "securite-justice": 19, // Aubergine
  sante: 18, // Rose fumé
  retraites: 11, // Canard
  emploi: 4, // Orange brûlé
  "energie-climat": 8, // Avocat
  "alimentation-agriculture": 7, // Olive
  immigration: 16, // Prune
  "democratie-et-institutions": 17, // Bordeaux
};
// Nom court de chaque thème (titre du carrousel thématique, cartes du programme).
export const NOMS_COURTS_THEMES = {
  logement: "Logement",
  economie: "Économie",
  "ia-numerique": "Numérique",
  education: "École",
  "securite-justice": "Sécurité",
  sante: "Santé",
  retraites: "Retraites",
  emploi: "Emploi",
  "energie-climat": "Climat",
  "alimentation-agriculture": "Agriculture",
  immigration: "Immigration",
  "democratie-et-institutions": "Institutions",
};
export const PICTOS_THEMES = {
  logement: "house",
  economie: "wallet",
  "ia-numerique": "chart",
  education: "book",
  "securite-justice": "bank",
  sante: "heart",
  retraites: "coin",
  emploi: "factory",
  "energie-climat": "leaf",
  "alimentation-agriculture": "leaf",
  immigration: "globe",
  "democratie-et-institutions": "check",
};

// --- Polices (page 9), embarquées dans le dépôt --------------------------------
// Silkscreen : réservée aux Reels, interdite dans les carrousels.
export const POLICES = {
  couverture: { famille: "Inter Display", graisse: 900, fichier: "fonts/reel/InterDisplay-Black.otf" },
  titre: { famille: "Inter Display", graisse: 500, fichier: "fonts/reel/InterDisplay-Medium.otf" },
  gras: { famille: "Inter Display", graisse: 700, fichier: "fonts/reel/InterDisplay-Bold.otf" },
  serif: { famille: "DM Serif Display", graisse: 400, fichier: "fonts/carrousel/DMSerifDisplay-Regular.ttf" },
  mono: { famille: "JetBrains Mono", graisse: 500, fichier: "fonts/reel/JetBrainsMono-Medium.ttf" },
};
export const POLICES_INTERDITES_CARROUSEL = ["Silkscreen"];

// Tailles en px (page 9). Mono : la charte dit 22 à 32 et « jamais moins de
// 24 » : on prend 24 à 32.
export const TAILLES = {
  couverture: { min: 96, max: 112 },
  titre: { min: 64, max: 78 },
  serif: { min: 44, max: 46 },
  mono: { min: 24, max: 32 },
  courant: { min: 36, max: 42 },
  minimum: 24,
};
export const APPROCHE_COUVERTURE = -0.035; // −3,5 % de la taille

// --- Mise en page (pages 12 et 14) ---------------------------------------------
export const SLIDE = { largeur: 1080, hauteur: 1350 };
export const MARGE_RESERVEE = 40; // rien d'important à moins de 40 px des bords gauche et droit

// --- Pictos pixel art (page 12) : liste fermée -----------------------------------
export const PICTOS = ["coin", "ball", "heart", "house", "book", "leaf", "globe", "bubble", "hourglass", "calendar", "wallet", "factory", "bank", "check", "cross", "chart", "down"];

// --- Fonctions ---------------------------------------------------------------------

function cle(nom) {
  return String(nom ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function rvb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex ?? "").trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Couleur avec transparence : « rgba(r,g,b,a) ».
export function rgba(hex, alpha) {
  const [r, g, b] = rvb(hex) ?? [0, 0, 0];
  return `rgba(${r},${g},${b},${alpha})`;
}

// Mélange de deux couleurs (part de b : 0 à 1) → « #RRGGBB ».
export function melange(a, b, part) {
  const x = rvb(a);
  const y = rvb(b);
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * part).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

export function luminance(hex) {
  const c = rvb(hex);
  if (!c) return null;
  const [r, g, b] = c.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contraste(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  if (la === null || lb === null) return null;
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// Température d'une couleur (teinte HSL) : « chaude » (rouges, oranges,
// jaunes, violets rosés) ou « froide » (verts, bleus).
export function temperature(hex) {
  const n = NUANCIER.find((c) => c.fond === String(hex).toUpperCase());
  if (n) return n.temperature;
  const c = rvb(hex);
  if (!c) return null;
  const [r, g, b] = c.map((v) => v / 255);
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  if (mx - mn < 0.06) return "neutre";
  let h;
  if (mx === r) h = ((g - b) / (mx - mn) + 6) % 6;
  else if (mx === g) h = (b - r) / (mx - mn) + 2;
  else h = (r - g) / (mx - mn) + 4;
  h *= 60;
  return h < 75 || h >= 285 ? "chaude" : "froide";
}

// Couleurs d'un candidat pour les carrousels, ou null s'il n'est pas au registre :
//   fond, accent (bloc derrière le candidat), texte (titres sur le fond),
//   surlignage (jaune, blanc sur le beurre d'Attal), accentCreme (accent
//   lisible sur le papier crème : le fond s'il contraste assez, sinon l'accent).
export function couleursCandidat(candidatNom, registre = REGISTRE_CANDIDATS) {
  const entree = Object.entries(registre ?? {}).find(([nom]) => cle(nom) === cle(candidatNom))?.[1];
  if (!entree || !rvb(entree.fond) || !rvb(entree.accent)) return null;
  const texte = entree.clair ? MARQUE.encreFondClair : MARQUE.blanc;
  const accentCreme = contraste(entree.fond, MARQUE.creme) >= 3 ? entree.fond : entree.accent;
  return { nom: entree.nom, fond: entree.fond, accent: entree.accent, bloc: entree.accent, clair: Boolean(entree.clair), texte, surlignage: entree.surlignage ?? MARQUE.jaune, accentCreme };
}

// Couleurs d'un thème (carrousel thématique), ou null si non validée.
export function couleursTheme(theme, table = COULEURS_THEMES) {
  const n = table?.[theme];
  const c = NUANCIER.find((x) => x.n === n);
  if (!c) return null;
  return { nom: c.nom, fond: c.fond, accent: c.accent, clair: false, texte: MARQUE.blanc, surlignage: MARQUE.jaune, accentCreme: contraste(c.fond, MARQUE.creme) >= 3 ? c.fond : c.accent };
}

// Couleurs du nuancier proposées pour un nouveau candidat : contraste du
// texte ≥ 4,5:1, pas déjà prise dans le registre, les plus éloignées d'abord
// des couleurs existantes ; 05 et 06 signalées (proches du jaune). Le lien
// avec la couleur de son parti se vérifie à la main. Rien n'est écrit.
export function proposerCouleurs({ registre = REGISTRE_CANDIDATS, nombre = 3 } = {}) {
  const prises = Object.values(registre).map((c) => c.fond.toUpperCase());
  const ecart = (hex) => Math.min(...prises.map((p) => distance(hex, p)));
  return NUANCIER.filter((c) => !prises.includes(c.fond) && contraste(c.fond, MARQUE.blanc) >= 4.5)
    .map((c) => ({ ...c, contraste: Math.round(contraste(c.fond, MARQUE.blanc) * 10) / 10, ecart: Math.round(ecart(c.fond)), avertissement: c.procheJaune ? "proche du jaune de surlignage" : null }))
    .sort((a, b) => b.ecart - a.ecart)
    .slice(0, nombre);
}

// Distance perçue entre deux couleurs (« rouge moyen » pondéré).
export function distance(a, b) {
  const x = rvb(a);
  const y = rvb(b);
  if (!x || !y) return null;
  const rm = (x[0] + y[0]) / 2;
  const [dr, dg, db] = [x[0] - y[0], x[1] - y[1], x[2] - y[2]];
  return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db);
}
export const DISTANCE_MEME_COULEUR = 60;

// Avertissements du fil Instagram (`derniers` : couleurs des derniers posts,
// la plus récente d'abord) : même couleur qu'un des 2 derniers posts ; deux
// posts chauds (ou froids) de suite.
export function avertissementsFil(fond, derniers = []) {
  if (!rvb(fond)) return [];
  const valides = derniers.filter((d) => rvb(d));
  const avertissements = [];
  if (valides.slice(0, 2).some((d) => distance(fond, d) < DISTANCE_MEME_COULEUR)) avertissements.push({ cle: "meme", message: "Même couleur qu’un des 2 derniers posts : attendez avant de publier, ou publiez d’abord un autre candidat." });
  const t = temperature(fond);
  if (valides[0] && ["chaude", "froide"].includes(t) && temperature(valides[0]) === t) avertissements.push({ cle: "temperature", message: `Deux posts ${t === "chaude" ? "chauds" : "froids"} de suite : alternez chaud et froid sur le fil si possible.` });
  return avertissements;
}

// Candidat au registre ? Sinon, message de refus avec une proposition de couleur.
export function controleRegistre(candidatNom, registre = REGISTRE_CANDIDATS) {
  if (couleursCandidat(candidatNom, registre)) return null;
  const options = proposerCouleurs({ registre })
    .map((c) => `${String(c.n).padStart(2, "0")} ${c.nom} ${c.fond} (accent ${c.accent}, contraste ${String(c.contraste).replace(".", ",")}:1${c.avertissement ? `, ${c.avertissement}` : ""})`)
    .join(" ; ");
  return `${candidatNom} n’est pas dans le registre des couleurs (src/lib/charte-rs.js) : génération refusée. Couleurs du nuancier possibles : ${options}. À valider par Arno (jamais de lien avec la couleur de son parti) avant de l’ajouter.`;
}
