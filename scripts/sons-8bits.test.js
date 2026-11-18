import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { FREQUENCE, NOMS_SONS, lireWav, synthetiser, wav } from "./lib/sons-8bits.js";
import { SONS } from "../src/lib/reel-montage.js";

test("les 6 sons de la liste fermée sont tous synthétisés", () => {
  assert.deepEqual([...NOMS_SONS].sort(), [...SONS].sort());
});

for (const nom of NOMS_SONS) {
  test(`${nom} : court, crête à −12 dB, fondu jusqu'au silence`, () => {
    const e = synthetiser(nom);
    const duree = e.length / FREQUENCE;
    assert.ok(duree < (nom === "jingle-score" ? 2 : 1), `${duree} s`);
    const crete = e.reduce((m, x) => Math.max(m, Math.abs(x)), 0);
    assert.ok(Math.abs(20 * Math.log10(crete) + 12) < 0.1, `crête ${20 * Math.log10(crete)} dB`);
    assert.ok(Math.abs(e[0]) < 0.01, "attaque sans clic");
    assert.ok(Math.abs(e.at(-1)) < 0.001, "fin au silence");
    // Le fondu : le dernier dixième est nettement plus calme que la crête.
    const fin = e.slice(Math.floor(e.length * 0.95));
    assert.ok(fin.every((x) => Math.abs(x) < crete * 0.2));
  });
}

test("même son à chaque génération (fichiers stables dans git)", () => {
  assert.deepEqual(wav(synthetiser("glitch")), wav(synthetiser("glitch")));
});

test("WAV : en-tête PCM 16 bits mono 44,1 kHz, relu à l'identique", () => {
  const e = synthetiser("blip");
  const fichier = wav(e);
  assert.equal(fichier.length, 44 + e.length * 2);
  const lu = lireWav(fichier);
  assert.equal(lu.frequence, 44100);
  assert.equal(lu.canaux, 1);
  assert.equal(lu.bits, 16);
  assert.equal(lu.echantillons.length, e.length);
  assert.ok(Math.abs(lu.echantillons[100] - e[100]) < 1 / 16000);
});

test("public/reel/sons : les 6 fichiers générés sont à jour", () => {
  for (const nom of NOMS_SONS) {
    const chemin = new URL(`../public/reel/sons/${nom}.wav`, import.meta.url);
    assert.ok(existsSync(chemin), `${nom}.wav manque : node scripts/generer-sons-reel.js`);
    assert.deepEqual(readFileSync(chemin), wav(synthetiser(nom)), `${nom}.wav périmé : node scripts/generer-sons-reel.js`);
  }
});
