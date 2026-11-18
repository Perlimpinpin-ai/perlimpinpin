// Fabrique, une fois pour toutes, les 6 bruitages des Reels dans
// public/reel/sons/ (blip, whoosh, impact, piece, glitch, jingle-score) :
// style 8 bits, doux, crête à −12 dB, fondu en sortie, WAV 44,1 kHz.
// Aucune dépendance, aucun appel réseau. Même résultat à chaque lancement.
//
//   node scripts/generer-sons-reel.js
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { FREQUENCE, NOMS_SONS, synthetiser, wav } from "./lib/sons-8bits.js";

const DOSSIER = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "reel", "sons");
mkdirSync(DOSSIER, { recursive: true });

for (const nom of NOMS_SONS) {
  const echantillons = synthetiser(nom);
  const fichier = join(DOSSIER, `${nom}.wav`);
  const donnees = wav(echantillons);
  writeFileSync(fichier, donnees);
  const crete = echantillons.reduce((m, x) => Math.max(m, Math.abs(x)), 0);
  console.log(
    `${nom}.wav : ${(echantillons.length / FREQUENCE).toFixed(2)} s, crête ${(20 * Math.log10(crete)).toFixed(1)} dB, ${Math.round(donnees.length / 1024)} Ko`,
  );
}
