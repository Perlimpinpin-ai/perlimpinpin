// Pixel art des Reels (storyboard v4) : objets dessinés case par case, et
// cartes de pays en pixels. Grilles reprises du gabarit du kit Reel
// (docs/prompt-reel.md, section 3). Rendus en SVG (data URI), que next/og
// affiche net à toute taille. Fonctions PURES.
//
// Lettres des grilles : k encre, w lavande, y jaune, a violet, r rouge,
// g vert ; « . » vide.

export const COULEURS = {
  fond: "#0B0A10",
  encre: "#1B0D40",
  noirPixel: "#120632",
  lavande: "#ECE6FF",
  violetFonce: "#2A1170",
  violet: "#8C6BFF",
  rose: "#FF5FD2",
  jaune: "#FFD23F",
  rouge: "#FF5A4E",
  vert: "#3DDC84",
  blanc: "#FFFFFF",
};

const TEINTES = { k: COULEURS.noirPixel, w: COULEURS.lavande, y: COULEURS.jaune, a: COULEURS.violet, r: COULEURS.rouge, g: COULEURS.vert };

export const PIXEL_ART = {
  piece: ["...kkkkkk...", "..kyyyyyyk..", ".kyykkkkyyk.", "kyykyyyyyyyk", "kykkkkkkyyyk", "kyykyyyyyyyk", "kykkkkkkyyyk", "kyykyyyyyyyk", ".kyykkkkyyk.", "..kyyyyyyk..", "...kkkkkk..."],
  "fleche-bas": ["....kkkk....", "....krrk....", "....krrk....", "....krrk....", "kkkkkrrkkkkk", ".krrrrrrrrk.", "..krrrrrrk..", "...krrrrk...", "....krrk....", ".....kk....."],
  "fleche-haut": [".....kk.....", "....kggk....", "...kggggk...", "..kggggggk..", ".kggggggggk.", "kkkkkggkkkkk", "....kggk....", "....kggk....", "....kggk....", "....kkkk...."],
  sablier: ["kkkkkkkkkkkk", ".kwwwwwwwwk.", ".kayyyyyyak.", "..kayyyyak..", "...kayyak...", "....kyyk....", ".....kk.....", "....kwwk....", "...kwwwwk...", "..kwwyywwk..", ".kwyyyyyywk.", ".kyyyyyyyyk.", "kkkkkkkkkkkk"],
  globe: [".....kkkkkk.....", "...kkggkkwwkk...", "..kgggkwwkwwwk..", ".kggggkwwkwwwwk.", ".kgggkwwwwkwwwk.", "kkkkkkkkkkkkkkkk", "kyyykyyyyyykyyyk", "kyyykyyyyyykyyyk", "kkkkkkkkkkkkkkkk", "kwwwkwwwwwwkgggk", ".kwwwkwwwwkgggk.", ".kwwwwkwwkggggk.", "..kwwwkwwkgggk..", "...kkwwkkggkk...", ".....kkkkkk....."],
  bulle: [".kkkkkkkkkkkkkk.", "kwwwwwwwwwwwwwwk", "kwwwwwwwwwwwwwwk", "kwwyywwyywwyywwk", "kwwyywwyywwyywwk", "kwwwwwwwwwwwwwwk", ".kkkkkkkkkwwkkk.", "..........kwk...", "...........kk..."],
  portefeuille: [".kkkkkkkkkkk.", "kwwwwwwwwwwwk", "kwkkkkkkkkkwk", "kwk.......kwk", "kwk....kkkkwk", "kwk....kyykwk", "kwk....kkkkwk", "kwkkkkkkkkkwk", "kwwwwwwwwwwwk", ".kkkkkkkkkkk."],
  usine: ["..........kk", ".........kwk", "kk..kk..kwwk", "kwk.kwk.kwwk", "kwwkkwwkkwwk", "kwwwwwwwwwwk", "kwyywyywyywk", "kwyywyywyywk", "kwwwwwwwwwwk", "kkkkkkkkkkkk"],
  banque: [".....kk.....", "...kkwwkk...", ".kkwwwwwwkk.", "kkkkkkkkkkkk", ".kwk.kk.kwk.", ".kwk.kk.kwk.", ".kwk.kk.kwk.", ".kwk.kk.kwk.", "kkkkkkkkkkkk", "kwwwwwwwwwwk", "kkkkkkkkkkkk"],
  coche: ["..........kk", ".........kgk", "........kggk", "kk.....kggk.", "kgk...kggk..", "kggk.kggk...", ".kggkggk....", "..kgggk.....", "...kgk......", "....k......."],
  croix: ["kk......kk", "krk....krk", ".krk..krk.", "..krkkrk..", "...krrk...", "...krrk...", "..krkkrk..", ".krk..krk.", "krk....krk", "kk......kk"],
  courbe: ["...........kk", "..........kyk", ".........kyk.", "..kk....kyk..", ".kyyk..kyk...", "kyk.kykyk....", "kk...kyk.....", "......k......"],
  question: ["..kkkkk..", ".kyyyyyk.", "kyykkkyyk", "kkk..kyyk", "....kyyk.", "...kyyk..", "...kyk...", "...kkk...", "...kyk...", "...kkk..."],
};

export const NOMS_PIXEL = Object.keys(PIXEL_ART);

// Taille en cases d'un objet : { colonnes, lignes }.
export function taillePixel(nom) {
  const g = PIXEL_ART[nom];
  return g ? { colonnes: g[0].length, lignes: g.length } : null;
}

function svgDataUri(svg) {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

// Objet en SVG (data URI), `taille` px par case, ou null si le nom est inconnu.
export function dataUriPixel(nom, taille = 10) {
  const g = PIXEL_ART[nom];
  if (!g) return null;
  let rects = "";
  g.forEach((ligne, y) =>
    [...ligne].forEach((c, x) => {
      if (TEINTES[c]) rects += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${TEINTES[c]}"/>`;
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

// Petits pixels colorés qui clignotent sur les bords (positions stables pour
// une même graine) : [{ x, y, couleur, opacite }], jamais au centre.
export function etincelles(graine) {
  let s = (Math.abs(Math.floor(graine)) % 2147483646) + 1;
  const alea = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const couleurs = [COULEURS.jaune, COULEURS.violet, COULEURS.blanc, COULEURS.rose];
  const points = [];
  for (let k = 0; k < 26; k++) {
    const x = Math.floor(alea() * 44) * 24 + 4;
    const y = Math.floor(alea() * 72) * 24 + 250;
    const opacite = Number((0.4 + alea() * 0.6).toFixed(2));
    if (x > 130 && x < 930 && y < 1300) continue;
    if (y > 1290 && y < 1470) continue; // jamais sur les sous-titres
    if (y > 1900) continue;
    points.push({ x, y, couleur: couleurs[k % 4], opacite });
  }
  return points;
}
