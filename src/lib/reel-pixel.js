import { ANCIENS_PICTOS, COULEURS_REELS, JAUNE_SURLIGNAGE, NOMS_PICTOS, PICTOS, TEINTES_PICTOS_REELS } from "./charte-rs.js";

// Pixel art des Reels : pictos de la liste fermée de la charte (src/lib/charte-rs.js,
// commune aux carrousels) et cartes de pays en pixels. Rendus en SVG (data
// URI), que next/og affiche net à toute taille. Fonctions PURES.

// Couleurs des Reels (écran pixel mid-century) : la palette de la charte et le
// jaune de surlignage, seul « flash » de couleur. Aucune autre.
export const COULEURS = { ...COULEURS_REELS, jaune: JAUNE_SURLIGNAGE };

export const PIXEL_ART = PICTOS;
export const NOMS_PIXEL = NOMS_PICTOS;

// Nom d'un picto, anciens noms v4 compris (« piece » → « coin ») ; null hors liste.
export function nomPicto(nom) {
  if (NOMS_PICTOS.includes(nom)) return nom;
  return ANCIENS_PICTOS[nom] ?? null;
}

// Taille en cases d'un picto : { colonnes, lignes }.
export function taillePixel(nom) {
  const g = PICTOS[nomPicto(nom)];
  return g ? { colonnes: g[0].length, lignes: g.length } : null;
}

// Couleurs réellement posées par un picto.
export function couleursPicto(nom) {
  const g = PICTOS[nomPicto(nom)];
  if (!g) return [];
  return [...new Set(g.join("").split("").map((c) => TEINTES_PICTOS_REELS[c]).filter(Boolean))];
}

function svgDataUri(svg) {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

// Picto en SVG (data URI), `taille` px par case, ou null si le nom est inconnu.
// Le contour charbon disparaîtrait sur le fond charbon : il passe en crème.
export function dataUriPixel(nom, taille = 10, { surFondSombre = true } = {}) {
  const g = PICTOS[nomPicto(nom)];
  if (!g) return null;
  const teintes = { ...TEINTES_PICTOS_REELS, ...(surFondSombre ? { k: COULEURS.creme } : {}) };
  let rects = "";
  g.forEach((ligne, y) =>
    [...ligne].forEach((c, x) => {
      if (teintes[c]) rects += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${teintes[c]}"/>`;
    }),
  );
  const w = g[0].length;
  const h = g.length;
  return {
    src: svgDataUri(`<svg xmlns="http://www.w3.org/2000/svg" width="${w * taille}" height="${h * taille}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">${rects}</svg>`),
    largeur: w * taille,
    hauteur: h * taille,
  };
}

// Carte d'un pays (grille de « # » et « . », public/reel/cartes/<cle>.json)
// en SVG (data URI) de la couleur donnée, `taille` px par case.
export function dataUriCarte(grille, couleur, taille = 12) {
  if (!Array.isArray(grille) || grille.length === 0) return null;
  let rects = "";
  grille.forEach((ligne, y) =>
    [...ligne].forEach((c, x) => {
      if (c === "#") rects += `<rect x="${x + 0.06}" y="${y + 0.06}" width="0.88" height="0.88" fill="${couleur}"/>`;
    }),
  );
  const w = grille[0].length;
  const h = grille.length;
  return {
    src: svgDataUri(`<svg xmlns="http://www.w3.org/2000/svg" width="${w * taille}" height="${h * taille}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">${rects}</svg>`),
    largeur: w * taille,
    hauteur: h * taille,
  };
}
