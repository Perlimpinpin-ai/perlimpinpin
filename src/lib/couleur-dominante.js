import { contraste, distanceCouleurs } from "./couleurs-candidats.js";

// Couleur du carrousel détaillé tirée de l'illustration d'un candidat
// (public/photos/vignettes/<slug>.webp), par scripts/couleurs-candidats.js :
//  - couleur dominante du fond, en ignorant le visage (ovale central), le
//    blanc, le noir et les gris ;
//  - foncée jusqu'à ce que le titre blanc s'y lise (contraste ≥ 4,5:1) ;
//  - jamais trop proche du jaune des surlignages ;
//  - bloc derrière le candidat : même teinte, nettement plus foncée.
// Fonctions PURES (les pixels sont lus par le script), testées par
// scripts/carrousel-detaille.test.js.

export const JAUNE_SURLIGNAGE = "#FFD23F";
export const CONTRASTE_MIN = 4.5;
// En dessous, la couleur se confond avec le jaune (distance de src/lib/couleurs-candidats.js).
export const DISTANCE_JAUNE_MIN = 200;
// En dessous, deux candidats ont des couleurs presque identiques.
export const DISTANCE_PROCHES = 70;

export function hex([r, g, b]) {
  return `#${[r, g, b].map((c) => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

export function rvb(h) {
  const n = parseInt(String(h).replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function versTsl([r, g, b]) {
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const t = max === R ? (G - B) / d + (G < B ? 6 : 0) : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  return [t * 60, s, l];
}

export function depuisTsl([t, s, l]) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((t / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = t < 60 ? [c, x, 0] : t < 120 ? [x, c, 0] : t < 180 ? [0, c, x] : t < 240 ? [0, x, c] : t < 300 ? [x, 0, c] : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

// Pixel retenu : hors du visage (ovale central), assez coloré, ni trop clair
// ni trop sombre.
export function pixelDeFond(x, y, largeur, hauteur, [r, g, b]) {
  const dx = (x / largeur - 0.5) / 0.3;
  const dy = (y / hauteur - 0.48) / 0.42;
  if (dx * dx + dy * dy < 1) return false;
  const [, s, l] = versTsl([r, g, b]);
  return s >= 0.22 && l >= 0.12 && l <= 0.88;
}

// Couleur dominante d'une image : pixels RVB(A) bruts → { couleur, part }
// (part : proportion des pixels retenus dans la teinte dominante), ou null
// si le fond n'a pas de couleur nette.
export function couleurDominante(pixels, largeur, hauteur, canaux = 3) {
  const cases = Array.from({ length: 24 }, () => ({ n: 0, r: 0, g: 0, b: 0 }));
  let retenus = 0;
  for (let y = 0; y < hauteur; y++) {
    for (let x = 0; x < largeur; x++) {
      const i = (y * largeur + x) * canaux;
      const p = [pixels[i], pixels[i + 1], pixels[i + 2]];
      if (canaux === 4 && pixels[i + 3] < 128) continue;
      if (!pixelDeFond(x, y, largeur, hauteur, p)) continue;
      const [t, s] = versTsl(p);
      const c = cases[Math.floor(t / 15) % 24];
      // Les pixels très colorés pèsent plus que les teintes fades.
      const poids = s;
      c.n += poids;
      c.r += p[0] * poids;
      c.g += p[1] * poids;
      c.b += p[2] * poids;
      retenus += poids;
    }
  }
  if (retenus === 0) return null;
  // Teinte dominante : la case et ses deux voisines (une teinte peut chevaucher deux cases).
  let meilleure = 0;
  let total = -1;
  for (let k = 0; k < 24; k++) {
    const somme = cases[(k + 23) % 24].n + cases[k].n + cases[(k + 1) % 24].n;
    if (somme > total) [meilleure, total] = [k, somme];
  }
  const groupe = [cases[(meilleure + 23) % 24], cases[meilleure], cases[(meilleure + 1) % 24]];
  const n = groupe.reduce((t, c) => t + c.n, 0);
  const couleur = hex([groupe.reduce((t, c) => t + c.r, 0) / n, groupe.reduce((t, c) => t + c.g, 0) / n, groupe.reduce((t, c) => t + c.b, 0) / n]);
  return { couleur, part: total / retenus };
}

// Couleur du fond de la couverture : la dominante, foncée (luminosité
// baissée, teinte gardée) jusqu'au contraste 4,5:1 avec le blanc, puis encore
// si elle reste trop proche du jaune des surlignages.
// Renvoie { fond, bloc, contraste, foncee, procheJaune }.
export function couleursCarrousel(dominante) {
  let [t, s, l] = versTsl(rvb(dominante));
  let fond = dominante.toUpperCase();
  let foncee = false;
  while ((contraste(fond, "#ffffff") < CONTRASTE_MIN || distanceCouleurs(fond, JAUNE_SURLIGNAGE) < DISTANCE_JAUNE_MIN) && l > 0.08) {
    l -= 0.01;
    fond = hex(depuisTsl([t, s, l]));
    foncee = true;
  }
  const bloc = hex(depuisTsl([t, Math.min(1, s * 0.9), Math.max(0.06, l * 0.5)]));
  return { fond, bloc, contraste: Math.round(contraste(fond, "#ffffff") * 10) / 10, foncee, procheJaune: distanceCouleurs(fond, JAUNE_SURLIGNAGE) < DISTANCE_JAUNE_MIN };
}

// Paires de candidats aux couleurs presque identiques : [[a, b, distance]].
export function couleursPresqueIdentiques(table, seuil = DISTANCE_PROCHES) {
  const noms = Object.keys(table);
  const paires = [];
  for (let i = 0; i < noms.length; i++) {
    for (let j = i + 1; j < noms.length; j++) {
      const d = distanceCouleurs(table[noms[i]].fond, table[noms[j]].fond);
      if (d < seuil) paires.push([noms[i], noms[j], Math.round(d)]);
    }
  }
  return paires.sort((a, b) => a[2] - b[2]);
}
