import { MARQUE, PICTOS } from "./charte-rs.js";

// Pictos pixel art de la charte RS (page 12) : liste fermée (PICTOS de
// src/lib/charte-rs.js), en encre, blanc, jaune et couleur du candidat.
// Grilles reprises des kits (coin, down, hourglass, globe, bubble, wallet,
// factory, bank, check, cross, chart : kit Reel ; calendar : kit carrousel) ;
// ball, heart, house, book, leaf dessinés dans le même style.
// Lettres : k contour, w blanc, y jaune, a couleur du candidat ; « . » vide.
// Rendu en SVG (data URI) avec les petits carrés « étincelles » du kit.
// Fonctions PURES.

export const GRILLES = {
  coin: ["...kkkkkk...", "..kyyyyyyk..", ".kyykkkkyyk.", "kyykyyyyyyyk", "kykkkkkkyyyk", "kyykyyyyyyyk", "kykkkkkkyyyk", "kyykyyyyyyyk", ".kyykkkkyyk.", "..kyyyyyyk..", "...kkkkkk..."],
  ball: ["....kkkk....", "..kkwwwwkk..", ".kwwkkkkwwk.", ".kwkkkkkkwk.", "kwwwkkkkwwwk", "kwwwwkkwwwwk", "kkwwwwwwwwkk", "kkkwwkkwwkkk", ".kkwkkkkwkk.", ".kwwkkkkwwk.", "..kkwwwwkk..", "....kkkk...."],
  heart: [".kkk...kkk.", "kaaak.kaaak", "kawaakaaaak", "kawaaaaaaak", "kaaaaaaaaak", ".kaaaaaaak.", "..kaaaaak..", "...kaaak...", "....kak....", ".....k....."],
  house: [".....kk.....", "....kaak....", "...kaaaak.kk", "..kaaaaaakwk", ".kaaaaaaaakk", "kkkkkkkkkkkk", ".kwwwwwwwwk.", ".kwyykwkkwk.", ".kwyykwkkwk.", ".kwwwwwkkwk.", ".kkkkkkkkkk."],
  book: ["kkkkkk.kkkkkk", "kwwwwkkkwwwwk", "kwkkwkakwkkwk", "kwwwwkakwwwwk", "kwkkwkakwkkwk", "kwwwwkakwwwwk", "kwkkwkakwkkwk", "kwwwwkakwwwwk", "kkkkkkakkkkkk", "......k......"],
  leaf: [".......kkkk", ".....kkaaak", "...kkaaaaak", "..kaaaawaak", ".kaaaawaaak", ".kaaawaaak.", "kaaawaaak..", "kaawaakk...", "kawkkk.....", "kk........."],
  globe: [".....kkkkkk.....", "...kkwwkkwwkk...", "..kwwwkwwkwwwk..", ".kwwwwkwwkwwwwk.", ".kwwwkwwwwkwwwk.", "kkkkkkkkkkkkkkkk", "kyyykyyyyyykyyyk", "kyyykyyyyyykyyyk", "kkkkkkkkkkkkkkkk", "kwwwkwwwwwwkwwwk", ".kwwwkwwwwkwwwk.", ".kwwwwkwwkwwwwk.", "..kwwwkwwkwwwk..", "...kkwwkkwwkk...", ".....kkkkkk....."],
  bubble: [".kkkkkkkkkkkkkk.", "kwwwwwwwwwwwwwwk", "kwwwwwwwwwwwwwwk", "kwwyywwyywwyywwk", "kwwyywwyywwyywwk", "kwwwwwwwwwwwwwwk", ".kkkkkkkkkwwkkk.", "..........kwk...", "...........kk..."],
  hourglass: ["kkkkkkkkkkkk", ".kwwwwwwwwk.", ".kayyyyyyak.", "..kayyyyak..", "...kayyak...", "....kyyk....", ".....kk.....", "....kwwk....", "...kwwwwk...", "..kwwyywwk..", ".kwyyyyyywk.", ".kyyyyyyyyk.", "kkkkkkkkkkkk"],
  calendar: ["..k.......k..", "kkkkkkkkkkkkk", "kaaaaaaaaaaak", "kkkkkkkkkkkkk", "kwwkwwkwwkwwk", "kwwkwwkyykwwk", "kkkkkkkkkkkkk", "kwwkwwkwwkwwk", "kwwkwwkwwkwwk", "kkkkkkkkkkkkk"],
  wallet: [".kkkkkkkkkkk.", "kwwwwwwwwwwwk", "kwkkkkkkkkkwk", "kwk.......kwk", "kwk....kkkkwk", "kwk....kyykwk", "kwk....kkkkwk", "kwkkkkkkkkkwk", "kwwwwwwwwwwwk", ".kkkkkkkkkkk."],
  factory: ["..........kk", ".........kwk", "kk..kk..kwwk", "kwk.kwk.kwwk", "kwwkkwwkkwwk", "kwwwwwwwwwwk", "kwyywyywyywk", "kwyywyywyywk", "kwwwwwwwwwwk", "kkkkkkkkkkkk"],
  bank: [".....kk.....", "...kkwwkk...", ".kkwwwwwwkk.", "kkkkkkkkkkkk", ".kwk.kk.kwk.", ".kwk.kk.kwk.", ".kwk.kk.kwk.", ".kwk.kk.kwk.", "kkkkkkkkkkkk", "kwwwwwwwwwwk", "kkkkkkkkkkkk"],
  check: ["..........kk", ".........kak", "........kaak", "kk.....kaak.", "kak...kaak..", "kaak.kaak...", ".kaakaak....", "..kaaak.....", "...kak......", "....k......."],
  cross: ["kk......kk", "kak....kak", ".kak..kak.", "..kakkak..", "...kaak...", "...kaak...", "..kakkak..", ".kak..kak.", "kak....kak", "kk......kk"],
  chart: ["...........kk", "..........kyk", ".........kyk.", "..kk....kyk..", ".kyyk..kyk...", "kyk.kykyk....", "kk...kyk.....", "......k......"],
  down: ["....kkkk....", "....kaak....", "....kaak....", "....kaak....", "kkkkkaakkkkk", ".kaaaaaaaak.", "..kaaaaaak..", "...kaaaak...", "....kaak....", ".....kk....."],
};

// Couleurs d'un picto : contour (encre sur fond clair, blanc sur fond foncé),
// blanc, jaune, couleur du candidat.
export function couleursPicto({ fondSombre = false, couleur = MARQUE.encre } = {}) {
  return { k: fondSombre ? MARQUE.blanc : MARQUE.encre, w: fondSombre ? couleur : MARQUE.blanc, y: MARQUE.jaune, a: couleur };
}

// SVG d'un picto : `taille` = côté d'un pixel (px). Renvoie { svg, largeur, hauteur }.
export function svgPicto(nom, { taille = 8, fondSombre = false, couleur = MARQUE.encre, etincelles = true } = {}) {
  if (!PICTOS.includes(nom) || !GRILLES[nom]) throw new Error(`Picto hors de la liste de la charte : ${nom}`);
  const g = GRILLES[nom];
  const c = couleursPicto({ fondSombre, couleur });
  const w = Math.max(...g.map((l) => l.length));
  const h = g.length;
  let rects = "";
  g.forEach((ligne, y) =>
    [...ligne].forEach((ch, x) => {
      if (c[ch]) rects += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${c[ch]}"/>`;
    }),
  );
  const pad = etincelles ? 3 : 0;
  const et = etincelles
    ? [
        [-2, 1, "a"],
        [w + 1, 2, "y"],
        [w + 2, h - 3, "a"],
        [-3, h - 2, "y"],
      ]
        .map(([x, y, k]) => `<rect x="${x}" y="${y}" width="1" height="1" fill="${c[k]}"/>`)
        .join("")
    : "";
  const largeur = (w + 2 * pad) * taille;
  const hauteur = (h + 2 * pad) * taille;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${largeur}" height="${hauteur}" viewBox="${-pad} ${-pad} ${w + 2 * pad} ${h + 2 * pad}" shape-rendering="crispEdges">${rects}${et}</svg>`;
  return { svg, largeur, hauteur };
}

export function dataUriPicto(nom, options) {
  const { svg, largeur, hauteur } = svgPicto(nom, options);
  return { src: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`, largeur, hauteur };
}
