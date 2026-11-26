// Jetons de la charte graphique des réseaux sociaux (docs/charte-rs.pdf,
// version 1, novembre 2026), partagés par les carrousels et les Reels : une
// seule source pour les couleurs, le registre des candidats, le nuancier,
// les polices et les pictos. Aucun composant de rendu n'écrit de code
// hexadécimal : il prend ses couleurs ici (contrôlé par
// scripts/charte-rs.test.js). Fonctions PURES.
//
// Ce fichier doit rester identique sur les branches carrousel et Reels
// (même contenu, mêmes noms) pour que leur fusion se fasse sans conflit.

// --- Couleurs fixes (charte p. 5) -----------------------------------------------

// Le seul « flash » de couleur, commun aux deux formats.
export const JAUNE_SURLIGNAGE = "#FFD23F";

// Carrousels : papier crème et encre.
export const COULEURS_CARROUSEL = {
  jaune: JAUNE_SURLIGNAGE, // mots clés, boutons, liseré photo
  carte: "#FBF8F2", // bulles granuleuses
  texteCourant: "#2A2926",
  papier: "#F1ECE2", // fond des slides de contenu
  encre: "#141413", // texte principal
  gris: "#6E6A62", // sources, étiquettes
};

// Verdicts des notes /100 (carrousels).
export const COULEURS_VERDICTS = {
  solide: "#4F7A3A", // 70 et plus
  plausible: "#C08A1E", // 50 à 69
  fragile: "#C9622B", // 35 à 49
  peuRealiste: "#B5432E", // moins de 35
};

// Reels : écran pixel mid-century sur fond charbon.
export const COULEURS_REELS = {
  charbon: "#17130F", // fond
  creme: "#F2E8D5", // textes, cartes
  moutarde: "#E3A72F", // accent, mots clés, score
  canard: "#2F8C8A", // barres de fenêtre
  rouille: "#CF5435", // ce qui va mal
  olive: "#8FA644", // ce qui marche
  grisChaud: "#9C9384", // libellés secondaires
};

// Textes sur la couleur d'un candidat (registre, colonne « texte »).
export const BLANC = "#FFFFFF";
export const ENCRE_TITRE = "#1E1915";

// Interdits : violet néon, rose fluo (et l'ancienne palette néon des Reels v4).
export const COULEURS_INTERDITES = ["#8C6BFF", "#FF5FD2", "#0B0A10", "#FF5A4E", "#3DDC84", "#2A1170", "#1B0D40", "#ECE6FF", "#120632"];

// --- Registre des couleurs candidats (charte p. 7) --------------------------------
// Clé : nom exact en base (Candidat.nom). fond : couleur du candidat ;
// accent : bloc d'accent ; texte : couleur des titres posés sur le fond ;
// contraste : celui annoncé par la charte (recalculé par les tests).
// Fonds clairs (Lisnard, Villepin, Attal, Le Pen) : titres en encre ; sur le
// beurre d'Attal, le surlignage passe en blanc.
export const REGISTRE_CANDIDATS = {
  "Bruno Retailleau": { couleur: "Marine", fond: "#22355C", accent: "#B04E28", texte: BLANC, contraste: 12.1 },
  "David Lisnard": { couleur: "Bleu poudre", fond: "#A7B8BD", accent: "#22355C", texte: ENCRE_TITRE, contraste: 8.5 },
  "Dominique de Villepin": { couleur: "Sable", fond: "#D9CDB3", accent: "#24566E", texte: ENCRE_TITRE, contraste: 11.1 },
  "Édouard Philippe": { couleur: "Ardoise", fond: "#4C6178", accent: "#8A4B2A", texte: BLANC, contraste: 6.4 },
  "Éric Zemmour": { couleur: "Charbon", fond: "#2B2622", accent: "#B04E28", texte: BLANC, contraste: 15.0 },
  "Fabien Roussel": { couleur: "Brique", fond: "#B5432E", accent: "#22355C", texte: BLANC, contraste: 5.5 },
  "Gabriel Attal": { couleur: "Beurre", fond: "#EFD9A0", accent: "#2D5A8C", texte: ENCRE_TITRE, contraste: 12.5, surlignage: BLANC },
  "Jean-Luc Mélenchon": { couleur: "Violet prune", fond: "#674A86", accent: "#1F6A6A", texte: BLANC, contraste: 7.2 },
  "Marine Le Pen": { couleur: "Pêche", fond: "#EFCDB6", accent: "#22355C", texte: ENCRE_TITRE, contraste: 11.7 },
  "Marine Tondelier": { couleur: "Sapin", fond: "#2F6A4C", accent: "#B04E28", texte: BLANC, contraste: 6.4 },
  "Raphaël Glucksmann": { couleur: "Ocre", fond: "#9A632E", accent: "#24566E", texte: BLANC, contraste: 5.0 },
  "Teddy Riner": { couleur: "Bleu Eames", fond: "#2C6A9E", accent: "#E89A5B", texte: BLANC, contraste: 5.7 },
};

// --- Nuancier mid-century (charte p. 8) --------------------------------------------
// 20 fonds pour les nouveaux candidats et les thèmes, texte blanc lisible
// (contraste ≥ 4,5:1). Alterner chaud (1-8, 16-20) et froid (9-15) sur le fil ;
// 05 et 06 sont proches du jaune de surlignage.
export const NUANCIER = [
  { numero: 1, nom: "Teck", fond: "#8A4B2A", accent: "#22355C", contraste: 6.7, famille: "chaud" },
  { numero: 2, nom: "Terracotta", fond: "#B04E28", accent: "#22355C", contraste: 5.3, famille: "chaud" },
  { numero: 3, nom: "Rouille", fond: "#A2401F", accent: "#24566E", contraste: 6.4, famille: "chaud" },
  { numero: 4, nom: "Orange brûlé", fond: "#B5551A", accent: "#22355C", contraste: 4.9, famille: "chaud" },
  { numero: 5, nom: "Moutarde", fond: "#8F6F10", accent: "#4E2E4F", contraste: 4.7, famille: "chaud" },
  { numero: 6, nom: "Or récolte", fond: "#977000", accent: "#22355C", contraste: 4.5, famille: "chaud" },
  { numero: 7, nom: "Olive", fond: "#666620", accent: "#7E2A35", contraste: 6.0, famille: "chaud" },
  { numero: 8, nom: "Avocat", fond: "#5A6B27", accent: "#4E2E4F", contraste: 5.9, famille: "chaud" },
  { numero: 9, nom: "Sauge", fond: "#4D6853", accent: "#A2401F", contraste: 6.1, famille: "froid" },
  { numero: 10, nom: "Sapin", fond: "#2F5D46", accent: "#B04E28", contraste: 7.6, famille: "froid" },
  { numero: 11, nom: "Canard", fond: "#1F6A6A", accent: "#A2401F", contraste: 6.3, famille: "froid" },
  { numero: 12, nom: "Turquoise atomique", fond: "#1A7178", accent: "#5A3A2A", contraste: 5.7, famille: "froid" },
  { numero: 13, nom: "Pétrole", fond: "#24566E", accent: "#B5551A", contraste: 8.0, famille: "froid" },
  { numero: 14, nom: "Bleu Eames", fond: "#2D5A8C", accent: "#8A4B2A", contraste: 7.1, famille: "froid" },
  { numero: 15, nom: "Marine", fond: "#22355C", accent: "#B04E28", contraste: 12.1, famille: "froid" },
  { numero: 16, nom: "Prune", fond: "#6A3352", accent: "#22355C", contraste: 9.5, famille: "chaud" },
  { numero: 17, nom: "Bordeaux", fond: "#7E2A35", accent: "#24566E", contraste: 9.3, famille: "chaud" },
  { numero: 18, nom: "Rose fumé", fond: "#9A4A58", accent: "#22355C", contraste: 6.0, famille: "chaud" },
  { numero: 19, nom: "Aubergine", fond: "#4E2E4F", accent: "#977000", contraste: 11.5, famille: "chaud" },
  { numero: 20, nom: "Chocolat", fond: "#5A3A2A", accent: "#1A7178", contraste: 10.1, famille: "chaud" },
];

// --- Polices (charte p. 9) ---------------------------------------------------------
export const POLICES = {
  titre: "Inter Display", // Black : titres de couverture ; Medium : titres des slides
  editorial: "DM Serif Display", // carrousels seulement (jamais dans les Reels)
  mono: "JetBrains Mono", // étiquettes, boutons, sources, pied de page, détails
  pixel: "Silkscreen", // Reels seulement : libellés et tampons
};

// --- Pictos pixel art (charte p. 12) -------------------------------------------------
// Liste fermée, commune aux carrousels et aux Reels. Grilles en lettres :
// k charbon, w crème, y moutarde, c canard, r rouille, o olive ; « . » vide.
export const PICTOS = {
  coin: ["...kkkkkk...", "..kyyyyyyk..", ".kyykkkkyyk.", "kyykyyyyyyyk", "kykkkkkkyyyk", "kyykyyyyyyyk", "kykkkkkkyyyk", "kyykyyyyyyyk", ".kyykkkkyyk.", "..kyyyyyyk..", "...kkkkkk..."],
  ball: ["...kkkkkk...", "..kwwwwwwk..", ".kwwwkkwwwk.", "kwwwkkkkwwwk", "kwkwwkkwwkwk", "kkkwwwwwwkkk", "kkwwwwwwwwkk", "kwwkwwwwkwwk", "kwkkkwwkkkwk", ".kwkkwwkkwk.", "..kwwwwwwk..", "...kkkkkk..."],
  heart: [".kkkk..kkkk.", "krrrrkkrrrrk", "krwrrrrrrrrk", "krrrrrrrrrrk", "krrrrrrrrrrk", ".krrrrrrrrk.", "..krrrrrrk..", "...krrrrk...", "....krrk....", ".....kk....."],
  house: [".....kk.....", "....krrk....", "...krrrrk...", "..krrrrrrk..", ".krrrrrrrrk.", "kkkkkkkkkkkk", ".kwwwwwwwwk.", ".kwyywkkkwk.", ".kwyywkckwk.", ".kwwwwkckwk.", ".kkkkkkkkkk."],
  book: ["kkkkk..kkkkk", "kwwwwkkwwwwk", "kwkkwkkwkkwk", "kwwwwkkwwwwk", "kwkkwkkwkkwk", "kwwwwkkwwwwk", "kwkkwkkwkkwk", "kwwwwkkwwwwk", "kcccckkcccck", ".kkkkkkkkkk."],
  leaf: ["........kkkk", "......kkoook", "....kkoooook", "...koooookok", "..koooookook", "..kooookoook", ".kooookooook", ".koookooook.", ".kokooooook.", "kkkkkkkkkk..", "k..........."],
  globe: [".....kkkkkk.....", "...kkookkwwkk...", "..koookwwkwwwk..", ".koooookwwkwwwk.", ".kooookwwwwkwwwk", "kkkkkkkkkkkkkkkk", "kyyykyyyyyykyyyk", "kyyykyyyyyykyyyk", "kkkkkkkkkkkkkkkk", "kwwwkwwwwwwkoook", ".kwwwkwwwwkoook.", ".kwwwwkwwkooook.", "..kwwwkwwkoook..", "...kkwwkkookk...", ".....kkkkkk....."],
  bubble: [".kkkkkkkkkkkkkk.", "kwwwwwwwwwwwwwwk", "kwwwwwwwwwwwwwwk", "kwwyywwyywwyywwk", "kwwyywwyywwyywwk", "kwwwwwwwwwwwwwwk", ".kkkkkkkkkwwkkk.", "..........kwk...", "...........kk..."],
  hourglass: ["kkkkkkkkkkkk", ".kwwwwwwwwk.", ".kcyyyyyyck.", "..kcyyyyck..", "...kcyyck...", "....kyyk....", ".....kk.....", "....kwwk....", "...kwwwwk...", "..kwwyywwk..", ".kwyyyyyywk.", ".kyyyyyyyyk.", "kkkkkkkkkkkk"],
  calendar: [".k..k..k..k.", "kkkkkkkkkkkk", "krrrrrrrrrrk", "kkkkkkkkkkkk", "kwwwwwwwwwwk", "kwkwkwkwkwwk", "kwwwwwwwwwwk", "kwkwkwkykywk", "kwwwwwwwwwwk", "kwkwkwkwkwwk", "kwwwwwwwwwwk", "kkkkkkkkkkkk"],
  wallet: [".kkkkkkkkkkk.", "kwwwwwwwwwwwk", "kwkkkkkkkkkwk", "kwk.......kwk", "kwk....kkkkwk", "kwk....kyykwk", "kwk....kkkkwk", "kwkkkkkkkkkwk", "kwwwwwwwwwwwk", ".kkkkkkkkkkk."],
  factory: ["..........kk", ".........kwk", "kk..kk..kwwk", "kwk.kwk.kwwk", "kwwkkwwkkwwk", "kwwwwwwwwwwk", "kwyywyywyywk", "kwyywyywyywk", "kwwwwwwwwwwk", "kkkkkkkkkkkk"],
  bank: [".....kk.....", "...kkwwkk...", ".kkwwwwwwkk.", "kkkkkkkkkkkk", ".kwk.kk.kwk.", ".kwk.kk.kwk.", ".kwk.kk.kwk.", ".kwk.kk.kwk.", "kkkkkkkkkkkk", "kwwwwwwwwwwk", "kkkkkkkkkkkk"],
  check: ["..........kk", ".........kok", "........kook", "kk.....kook.", "kok...kook..", "kook.kook...", ".kookook....", "..koook.....", "...kok......", "....k......."],
  cross: ["kk......kk", "krk....krk", ".krk..krk.", "..krkkrk..", "...krrk...", "...krrk...", "..krkkrk..", ".krk..krk.", "krk....krk", "kk......kk"],
  chart: ["...........kk", "..........kyk", ".........kyk.", "..kk....kyk..", ".kyyk..kyk...", "kyk.kykyk....", "kk...kyk.....", "......k......"],
  down: ["....kkkk....", "....krrk....", "....krrk....", "....krrk....", "kkkkkrrkkkkk", ".krrrrrrrrk.", "..krrrrrrk..", "...krrrrk...", "....krrk....", ".....kk....."],
};

export const NOMS_PICTOS = Object.keys(PICTOS);

// Teinte des lettres des grilles dans les Reels.
export const TEINTES_PICTOS_REELS = {
  k: COULEURS_REELS.charbon,
  w: COULEURS_REELS.creme,
  y: COULEURS_REELS.moutarde,
  c: COULEURS_REELS.canard,
  r: COULEURS_REELS.rouille,
  o: COULEURS_REELS.olive,
};

// Anciens noms des objets pixel des Reels v4, pour relire les storyboards
// déjà rangés en base (« fleche-haut » et « question » n'ont pas d'équivalent).
export const ANCIENS_PICTOS = {
  piece: "coin",
  "fleche-bas": "down",
  sablier: "hourglass",
  globe: "globe",
  bulle: "bubble",
  portefeuille: "wallet",
  usine: "factory",
  banque: "bank",
  coche: "check",
  croix: "cross",
  courbe: "chart",
};

// --- Outils ----------------------------------------------------------------------------

export function hexValide(hex) {
  return /^#[0-9a-f]{6}$/i.test(String(hex ?? ""));
}

function rvb(hex) {
  const n = parseInt(String(hex).slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Luminance relative (WCAG 2.1).
export function luminance(hex) {
  const [r, g, b] = rvb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Contraste entre deux couleurs (1 à 21).
export function contraste(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

// Couleur avec transparence (« rgba(…) »), à partir d'une couleur de la charte.
export function transparence(hex, alpha) {
  const [r, g, b] = rvb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

function cle(nom) {
  return String(nom ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// Couleur d'un candidat dans le registre : { nom, couleur, fond, accent,
// texte, surlignage, contraste } ou null s'il n'y figure pas.
export function couleurCandidat(nom, registre = REGISTRE_CANDIDATS) {
  const trouve = Object.entries(registre ?? {}).find(([n]) => cle(n) === cle(nom));
  if (!trouve) return null;
  const [n, v] = trouve;
  return { nom: n, couleur: v.couleur, fond: v.fond, accent: v.accent, texte: v.texte, surlignage: v.surlignage ?? JAUNE_SURLIGNAGE, contraste: v.contraste };
}

// Toutes les couleurs du registre (fonds, accents, textes).
export function couleursRegistre(registre = REGISTRE_CANDIDATS) {
  return [...new Set(Object.values(registre).flatMap((v) => [v.fond, v.accent, v.texte, v.surlignage].filter(Boolean)).map((c) => c.toUpperCase()))];
}

// Couleurs permises dans un Reel : palette Reels, registre, jaune de surlignage.
export function couleursPermisesReels(registre = REGISTRE_CANDIDATS) {
  return new Set([...Object.values(COULEURS_REELS), ...couleursRegistre(registre), JAUNE_SURLIGNAGE].map((c) => c.toUpperCase()));
}

// Nom de famille affiché (« Teddy Riner » → « Riner », « Dominique de
// Villepin » → « Villepin », « Marine Le Pen » → « Le Pen ») et prénom.
export function nomDeFamille(nomComplet) {
  const mots = String(nomComplet ?? "").trim().split(/\s+/);
  const reste = mots.slice(1);
  while (reste.length > 1 && /^(de|d’|d'|du)$/i.test(reste[0])) reste.shift();
  return reste.join(" ") || mots[0] || "";
}

export function prenom(nomComplet) {
  return String(nomComplet ?? "").trim().split(/\s+/)[0] ?? "";
}

// Clé de tri alphabétique sur le nom de famille, sans accents ni particule.
export function cleAlphabetique(nomComplet) {
  return cle(nomDeFamille(nomComplet));
}
