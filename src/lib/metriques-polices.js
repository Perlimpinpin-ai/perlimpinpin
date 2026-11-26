import { readFileSync } from "node:fs";
import { join } from "node:path";
import { POLICES } from "./charte-rs.js";

// Largeur réelle d'un texte dans les polices des carrousels, lue dans les
// fichiers de police eux-mêmes (tables cmap, hmtx, head, hhea des .ttf/.otf) :
// la mise en page du carrousel détaillé (src/lib/mise-en-page-carrousel.js)
// mesure ainsi chaque bloc avant le rendu, pour signaler un texte qui déborde
// (on ne réduit jamais la police). Le crénage est ignoré : une marge de 3 %
// le couvre. Côté serveur seulement (lecture de public/fonts).

// Polices de la charte RS (src/lib/charte-rs.js) : texte courant et titres
// en Inter Display Medium, gras en Inter Display Bold, couverture en Inter
// Display Black, sous-titres en DM Serif Display, étiquettes en JetBrains Mono.
const FICHIERS = {
  texte500: POLICES.titre.fichier,
  texte800: POLICES.gras.fichier,
  couverture: POLICES.couverture.fichier,
  mono: POLICES.mono.fichier,
  serif: POLICES.serif.fichier,
};
const MARGE_CRENAGE = 1.03;

// Lecture minimale d'une police OpenType : unités par em, avance de chaque
// glyphe et correspondance caractère → glyphe.
export function lirePolice(octets) {
  const d = new DataView(octets.buffer, octets.byteOffset, octets.byteLength);
  const nombreTables = d.getUint16(4);
  const tables = {};
  for (let i = 0; i < nombreTables; i++) {
    const p = 12 + 16 * i;
    const tag = String.fromCharCode(d.getUint8(p), d.getUint8(p + 1), d.getUint8(p + 2), d.getUint8(p + 3));
    tables[tag] = d.getUint32(p + 8);
  }
  const unitesParEm = d.getUint16(tables.head + 18);
  const nombreMetriques = d.getUint16(tables.hhea + 34);
  const avances = [];
  for (let i = 0; i < nombreMetriques; i++) avances.push(d.getUint16(tables.hmtx + 4 * i));

  // cmap : format 12 (plateforme 3, encodage 10) de préférence, sinon format 4.
  const cmap = tables.cmap;
  const sousTables = [];
  for (let i = 0; i < d.getUint16(cmap + 2); i++) {
    const p = cmap + 4 + 8 * i;
    sousTables.push({ plateforme: d.getUint16(p), encodage: d.getUint16(p + 2), debut: cmap + d.getUint32(p + 4) });
  }
  const glyphes = new Map();
  const format = (s) => d.getUint16(s.debut);
  const t12 = sousTables.find((s) => format(s) === 12);
  const t4 = sousTables.find((s) => format(s) === 4 && (s.plateforme === 3 || s.plateforme === 0));
  if (t12) {
    const groupes = d.getUint32(t12.debut + 12);
    for (let g = 0; g < groupes; g++) {
      const p = t12.debut + 16 + 12 * g;
      const debut = d.getUint32(p);
      const fin = Math.min(d.getUint32(p + 4), 0x2ffff);
      const glyphe = d.getUint32(p + 8);
      for (let c = debut; c <= fin; c++) glyphes.set(c, glyphe + (c - debut));
    }
  } else if (t4) {
    const s = t4.debut;
    const segments = d.getUint16(s + 6) / 2;
    const fins = s + 14;
    const debuts = fins + 2 * segments + 2;
    const deltas = debuts + 2 * segments;
    const decalages = deltas + 2 * segments;
    for (let i = 0; i < segments; i++) {
      const fin = d.getUint16(fins + 2 * i);
      const debut = d.getUint16(debuts + 2 * i);
      const delta = d.getInt16(deltas + 2 * i);
      const decalage = d.getUint16(decalages + 2 * i);
      for (let c = debut; c <= fin && c !== 0xffff; c++) {
        let glyphe;
        if (decalage === 0) glyphe = (c + delta) & 0xffff;
        else {
          const p = decalages + 2 * i + decalage + 2 * (c - debut);
          glyphe = d.getUint16(p);
          if (glyphe !== 0) glyphe = (glyphe + delta) & 0xffff;
        }
        glyphes.set(c, glyphe);
      }
    }
  }
  return { unitesParEm, avances, glyphes };
}

// Largeur d'un texte (px) dans une police lue par lirePolice.
export function largeurTexte(police, texte, taille, espacement = 0) {
  let unites = 0;
  let caracteres = 0;
  for (const caractere of String(texte ?? "")) {
    const glyphe = police.glyphes.get(caractere.codePointAt(0)) ?? 0;
    unites += police.avances[Math.min(glyphe, police.avances.length - 1)] ?? police.unitesParEm / 2;
    caracteres += 1;
  }
  return ((unites / police.unitesParEm) * taille + espacement * caracteres) * MARGE_CRENAGE;
}

let polices = null;

// Fonction de mesure des carrousels : mesurer(texte, taille, police =
// "texte500" | "texte800" | "couverture" | "mono" | "serif", espacement en px) → largeur en px.
export function mesureurCarrousel(racine = process.cwd()) {
  polices ??= Object.fromEntries(Object.entries(FICHIERS).map(([cle, fichier]) => [cle, lirePolice(readFileSync(join(racine, "public", fichier)))]));
  return (texte, taille, police = "texte500", espacement = 0) => largeurTexte(polices[police] ?? polices.texte500, texte, taille, espacement);
}
