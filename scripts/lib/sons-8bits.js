// Synthèse des 6 bruitages des Reels, style 8 bits rétro, doux et légers.
// Aucune dépendance : oscillateurs simples, bruit pseudo-aléatoire à graine
// fixe (même fichier à chaque génération), filtre passe-bas d'un pôle pour
// adoucir, fondu en sortie, crête ramenée à −12 dB. Sortie WAV PCM 16 bits
// mono, 44,1 kHz. Utilisé par scripts/generer-sons-reel.js, testé par
// scripts/sons-8bits.test.js.

export const FREQUENCE = 44100;
export const CRETE_DB = -12;

// Bruit pseudo-aléatoire reproductible (mulberry32).
function hasard(graine) {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const carre = (phase) => (phase % 1 < 0.5 ? 1 : -1);
const triangle = (phase) => 1 - 4 * Math.abs((phase % 1) - 0.5);

// Échantillons de `duree` secondes ; `f(t, i)` donne la valeur à l'instant t.
function generer(duree, f) {
  const n = Math.round(duree * FREQUENCE);
  const sortie = new Float64Array(n);
  for (let i = 0; i < n; i++) sortie[i] = f(i / FREQUENCE, i);
  return sortie;
}

// Oscillateur à fréquence variable (accumulateur de phase).
function oscillateur(forme) {
  let phase = 0;
  return (frequence) => {
    phase += frequence / FREQUENCE;
    return forme(phase);
  };
}

// Passe-bas d'un pôle : adoucit les arêtes des signaux carrés.
function passeBas(echantillons, coupure) {
  const alpha = 1 - Math.exp((-2 * Math.PI * coupure) / FREQUENCE);
  let y = 0;
  return echantillons.map((x) => (y += alpha * (x - y)));
}

// Attaque courte (sans clic) et fondu en sortie jusqu'au silence.
function enveloppe(echantillons, { attaque = 0.004, fondu = 0.3 } = {}) {
  const n = echantillons.length;
  const nAttaque = Math.max(1, Math.round(attaque * FREQUENCE));
  const nFondu = Math.max(1, Math.round(fondu * n));
  return echantillons.map((x, i) => {
    let g = 1;
    if (i < nAttaque) g *= i / nAttaque;
    const avantFin = n - 1 - i;
    if (avantFin < nFondu) g *= 0.5 - 0.5 * Math.cos((Math.PI * avantFin) / nFondu);
    return x * g;
  });
}

// Crête ramenée à `db` dBFS.
function normaliser(echantillons, db = CRETE_DB) {
  const crete = echantillons.reduce((m, x) => Math.max(m, Math.abs(x)), 0) || 1;
  const cible = 10 ** (db / 20);
  return echantillons.map((x) => (x / crete) * cible);
}

// --- Les 6 sons ---------------------------------------------------------------------

function blip() {
  const osc = oscillateur(carre);
  const brut = generer(0.14, (t) => osc(t < 0.05 ? 1046.5 : 1568) * Math.exp(-t * 14));
  return passeBas(brut, 3500);
}

function whoosh() {
  const alea = hasard(7);
  let y = 0;
  const duree = 0.55;
  return generer(duree, (t) => {
    const x = alea() * 2 - 1;
    // Coupure qui monte puis redescend : le souffle passe.
    const coupure = 300 + 2600 * Math.sin((Math.PI * t) / duree);
    const alpha = 1 - Math.exp((-2 * Math.PI * coupure) / FREQUENCE);
    y += alpha * (x - y);
    return y * Math.sin((Math.PI * t) / duree) ** 2;
  });
}

function impact() {
  const osc = oscillateur(triangle);
  const alea = hasard(11);
  let bruit = 0;
  return generer(0.5, (t) => {
    const ton = osc(45 + 115 * Math.exp(-t * 18)) * Math.exp(-t * 7);
    bruit += 0.08 * (alea() * 2 - 1 - bruit);
    return ton + (t < 0.05 ? bruit * 1.6 * (1 - t / 0.05) : 0);
  });
}

function piece() {
  const osc = oscillateur((p) => 0.6 * carre(p) + 0.4 * triangle(p));
  const brut = generer(0.5, (t) => (t < 0.075 ? osc(987.8) : osc(1318.5) * Math.exp(-(t - 0.075) * 6)));
  return passeBas(brut, 4000);
}

function glitch() {
  const alea = hasard(23);
  const tranche = Math.round(0.03 * FREQUENCE);
  let mode = 0;
  let frequence = 400;
  let tenu = 0;
  const osc = oscillateur(carre);
  const brut = generer(0.32, (t, i) => {
    if (i % tranche === 0) {
      mode = Math.floor(alea() * 3);
      frequence = 180 + alea() * 900;
    }
    if (mode === 0) return osc(frequence) * 0.8;
    if (mode === 1) {
      // Bruit « écrasé » (tenu sur 12 échantillons).
      if (i % 12 === 0) tenu = alea() * 2 - 1;
      return tenu * 0.7;
    }
    return osc(frequence * 2) * 0.25;
  });
  return passeBas(brut, 3000);
}

function jingleScore() {
  const osc = oscillateur((p) => 0.7 * triangle(p) + 0.3 * carre(p));
  const notes = [523.25, 659.25, 783.99];
  const pas = 0.12;
  const brut = generer(1.5, (t) => {
    const k = Math.floor(t / pas);
    if (k < notes.length) return osc(notes[k]) * (1 - 0.3 * ((t % pas) / pas));
    const tenue = t - notes.length * pas;
    // Do aigu tenu, léger vibrato, qui s'éteint doucement.
    return osc(1046.5 * (1 + 0.006 * Math.sin(2 * Math.PI * 6 * tenue))) * Math.exp(-tenue * 2.2);
  });
  return passeBas(brut, 3800);
}

// Nom → { echantillons (Float64Array, de −1 à 1), duree max }.
const FABRIQUES = { blip, whoosh, impact, piece, glitch, "jingle-score": jingleScore };

export const NOMS_SONS = Object.keys(FABRIQUES);

export function synthetiser(nom) {
  const fabrique = FABRIQUES[nom];
  if (!fabrique) throw new Error(`son inconnu : ${nom}`);
  return normaliser(enveloppe(Float64Array.from(fabrique())));
}

// Échantillons (de −1 à 1) → fichier WAV PCM 16 bits mono.
export function wav(echantillons, frequence = FREQUENCE) {
  const n = echantillons.length;
  const tampon = Buffer.alloc(44 + n * 2);
  tampon.write("RIFF", 0, "ascii");
  tampon.writeUInt32LE(36 + n * 2, 4);
  tampon.write("WAVE", 8, "ascii");
  tampon.write("fmt ", 12, "ascii");
  tampon.writeUInt32LE(16, 16); // taille du bloc fmt
  tampon.writeUInt16LE(1, 20); // PCM
  tampon.writeUInt16LE(1, 22); // mono
  tampon.writeUInt32LE(frequence, 24);
  tampon.writeUInt32LE(frequence * 2, 28); // octets par seconde
  tampon.writeUInt16LE(2, 32); // octets par échantillon
  tampon.writeUInt16LE(16, 34); // bits
  tampon.write("data", 36, "ascii");
  tampon.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const x = Math.max(-1, Math.min(1, echantillons[i]));
    tampon.writeInt16LE(Math.round(x * 32767), 44 + i * 2);
  }
  return tampon;
}

// Fichier WAV → { frequence, canaux, bits, echantillons (de −1 à 1) }.
export function lireWav(tampon) {
  if (tampon.toString("ascii", 0, 4) !== "RIFF" || tampon.toString("ascii", 8, 12) !== "WAVE") throw new Error("pas un fichier WAV");
  const taille = tampon.readUInt32LE(40);
  const echantillons = new Float64Array(taille / 2);
  for (let i = 0; i < echantillons.length; i++) echantillons[i] = tampon.readInt16LE(44 + i * 2) / 32767;
  return { frequence: tampon.readUInt32LE(24), canaux: tampon.readUInt16LE(22), bits: tampon.readUInt16LE(34), echantillons };
}
