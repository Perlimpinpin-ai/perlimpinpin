// Contrôle de fidélité des chiffres, partagé par la version basique et les
// publications X (scripts/lib/scoring.js) et par le Reel (src/lib/reel.js) :
// tout nombre écrit doit figurer dans la fiche finale. Fonctions PURES.
//
// Les espaces (y compris insécables et fines) servant de séparateurs de
// milliers sont retirés des deux côtés avant comparaison ; la virgule décimale
// est conservée telle quelle. Ne contrôle pas les arrondis en toutes lettres
// (« plus d'un tiers »), laissés au prompt et à la relecture.
// Le même découpage est appliqué aux deux textes : « fin 2021 560 000 »
// donne bien « 2021 » et « 560000 », jamais « 2021560000 ». Comparer des
// nombres entiers (et non des sous-chaînes) évite aussi de trouver « 200 »
// dans « 2000 » ou « 1,8 » dans « 1,85 ».
const NOMBRE_REGEX = /\d{1,3}(?:[   ]\d{3})+(?:,\d+)?|\d+(?:,\d+)?/g;

export function extraireNombres(text) {
  return [...String(text ?? "").matchAll(NOMBRE_REGEX)].map((match) => match[0].replace(/[   ]/g, ""));
}

// Nombres des textes absents de la fiche finale.
export function nombresHorsFiche(textes, ficheFinale) {
  const nombres = new Set(textes.filter((texte) => typeof texte === "string").flatMap(extraireNombres));
  const reference = new Set(extraireNombres(JSON.stringify(ficheFinale)));
  return [...nombres].filter((nombre) => !reference.has(nombre));
}
