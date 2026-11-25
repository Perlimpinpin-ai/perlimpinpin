// Écrivain de fichiers .zip minimal, SANS compression (méthode « stored ») :
// les PNG sont déjà compressés, et les quelques textes sont petits. Aucune
// dépendance, fonctionne dans le navigateur comme dans Node (Uint8Array,
// TextEncoder). Noms de fichiers en UTF-8 (drapeau 11 du format zip).
// Limites : moins de 65 535 fichiers et moins de 4 Go au total (pas de Zip64).
// Testé par scripts/zip-simple.test.js.

const TABLE_CRC = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(octets) {
  let crc = 0xffffffff;
  for (let i = 0; i < octets.length; i++) crc = TABLE_CRC[(crc ^ octets[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

// Date et heure au format MS-DOS (heure locale, précision de 2 secondes).
function dateDos(date) {
  const annee = Math.max(1980, date.getFullYear());
  return {
    heure: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    jour: ((annee - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

function enOctets(donnees) {
  if (donnees instanceof Uint8Array) return donnees;
  if (donnees instanceof ArrayBuffer) return new Uint8Array(donnees);
  if (typeof donnees === "string") return new TextEncoder().encode(donnees);
  throw new TypeError("Contenu de fichier attendu : Uint8Array, ArrayBuffer ou texte.");
}

// fichiers : [{ nom, donnees }] (donnees : Uint8Array, ArrayBuffer ou texte).
// Renvoie l'archive complète (Uint8Array).
export function creerZip(fichiers, { date = new Date() } = {}) {
  if (fichiers.length > 0xfffe) throw new RangeError("Trop de fichiers pour un zip simple.");
  const { heure, jour } = dateDos(date);
  const encodeur = new TextEncoder();
  const morceaux = [];
  const central = [];
  let position = 0;

  for (const { nom, donnees } of fichiers) {
    const nomOctets = encodeur.encode(nom);
    const contenu = enOctets(donnees);
    const crc = crc32(contenu);
    const taille = contenu.length;

    const entete = new Uint8Array(30 + nomOctets.length);
    const v = new DataView(entete.buffer);
    v.setUint32(0, 0x04034b50, true); // signature d'en-tête local
    v.setUint16(4, 20, true); // version nécessaire (2.0)
    v.setUint16(6, 0x0800, true); // drapeau : noms en UTF-8
    v.setUint16(8, 0, true); // méthode : stored (sans compression)
    v.setUint16(10, heure, true);
    v.setUint16(12, jour, true);
    v.setUint32(14, crc, true);
    v.setUint32(18, taille, true); // taille compressée
    v.setUint32(22, taille, true); // taille d'origine
    v.setUint16(26, nomOctets.length, true);
    v.setUint16(28, 0, true); // champ extra
    entete.set(nomOctets, 30);
    morceaux.push(entete, contenu);

    const fiche = new Uint8Array(46 + nomOctets.length);
    const c = new DataView(fiche.buffer);
    c.setUint32(0, 0x02014b50, true); // signature du répertoire central
    c.setUint16(4, 20, true); // version qui a créé
    c.setUint16(6, 20, true); // version nécessaire
    c.setUint16(8, 0x0800, true);
    c.setUint16(10, 0, true);
    c.setUint16(12, heure, true);
    c.setUint16(14, jour, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, taille, true);
    c.setUint32(24, taille, true);
    c.setUint16(28, nomOctets.length, true);
    c.setUint16(30, 0, true); // extra
    c.setUint16(32, 0, true); // commentaire
    c.setUint16(34, 0, true); // disque
    c.setUint16(36, 0, true); // attributs internes
    c.setUint32(38, 0, true); // attributs externes
    c.setUint32(42, position, true); // position de l'en-tête local
    fiche.set(nomOctets, 46);
    central.push(fiche);

    position += entete.length + taille;
  }

  const tailleCentral = central.reduce((somme, f) => somme + f.length, 0);
  const fin = new Uint8Array(22);
  const e = new DataView(fin.buffer);
  e.setUint32(0, 0x06054b50, true); // fin du répertoire central
  e.setUint16(4, 0, true);
  e.setUint16(6, 0, true);
  e.setUint16(8, fichiers.length, true);
  e.setUint16(10, fichiers.length, true);
  e.setUint32(12, tailleCentral, true);
  e.setUint32(16, position, true);
  e.setUint16(20, 0, true);

  const total = position + tailleCentral + fin.length;
  if (total > 0xffffffff) throw new RangeError("Archive trop grande pour un zip simple (4 Go).");
  const archive = new Uint8Array(total);
  let curseur = 0;
  for (const morceau of [...morceaux, ...central, fin]) {
    archive.set(morceau, curseur);
    curseur += morceau.length;
  }
  return archive;
}
