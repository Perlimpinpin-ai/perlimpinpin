// Tests des jetons de la charte graphique RS (src/lib/charte-rs.js) et de la
// règle « aucun code hexadécimal dans les composants de scène ».
//   node --test scripts/charte-rs.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  BLANC,
  COULEURS_INTERDITES,
  COULEURS_REELS,
  JAUNE_SURLIGNAGE,
  NOMS_PICTOS,
  NUANCIER,
  PICTOS,
  REGISTRE_CANDIDATS,
  cleAlphabetique,
  contraste,
  couleurCandidat,
  couleursPermisesReels,
  nomDeFamille,
  prenom,
} from "../src/lib/charte-rs.js";

const lire = (chemin) => readFileSync(new URL(`../${chemin}`, import.meta.url), "utf8");

test("aucun code hexadécimal dans les composants de scène des Reels", () => {
  for (const fichier of ["src/app/test/reels/[id]/storyboard/rendu.js", "src/app/test/reels/[id]/storyboard/image.js", "src/lib/reel-disposition.js", "src/lib/reel-pixel.js"]) {
    const trouves = lire(fichier).match(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/gi) ?? [];
    assert.deepEqual(trouves, [], `${fichier} contient ${trouves.join(", ")} : prendre la couleur dans src/lib/charte-rs.js`);
  }
});

test("palette des Reels : celle de la charte (p. 5), sans les interdits", () => {
  assert.deepEqual(COULEURS_REELS, {
    charbon: "#17130F",
    creme: "#F2E8D5",
    moutarde: "#E3A72F",
    canard: "#2F8C8A",
    rouille: "#CF5435",
    olive: "#8FA644",
    grisChaud: "#9C9384",
  });
  const permises = couleursPermisesReels();
  assert.ok(permises.has(JAUNE_SURLIGNAGE));
  assert.ok(permises.has("#2C6A9E"), "fond de Riner (registre)");
  for (const c of COULEURS_INTERDITES) assert.ok(!permises.has(c), `${c} est interdit`);
});

test("registre et nuancier : contrastes recalculés égaux à ceux de la charte (± 0,15)", () => {
  assert.equal(Object.keys(REGISTRE_CANDIDATS).length, 12);
  for (const [nom, v] of Object.entries(REGISTRE_CANDIDATS)) {
    assert.ok(Math.abs(contraste(v.fond, v.texte) - v.contraste) <= 0.15, `${nom} : ${contraste(v.fond, v.texte).toFixed(2)} au lieu de ${v.contraste}`);
    assert.ok(contraste(v.fond, v.texte) >= 4.5, `${nom} : contraste sous 4,5:1`);
  }
  assert.equal(NUANCIER.length, 20);
  for (const v of NUANCIER) assert.ok(Math.abs(contraste(v.fond, BLANC) - v.contraste) <= 0.15, `${v.nom}`);
  assert.equal(couleurCandidat("teddy riner").fond, "#2C6A9E");
  assert.equal(couleurCandidat("Gabriel Attal").surlignage, BLANC, "sur le beurre d'Attal, le surlignage passe en blanc");
  assert.equal(couleurCandidat("Inconnu"), null);
});

test("pictos : la liste fermée de la charte (p. 12), grilles rectangulaires en lettres permises", () => {
  assert.deepEqual(NOMS_PICTOS, ["coin", "ball", "heart", "house", "book", "leaf", "globe", "bubble", "hourglass", "calendar", "wallet", "factory", "bank", "check", "cross", "chart", "down"]);
  for (const [nom, g] of Object.entries(PICTOS)) {
    assert.ok(g.every((l) => l.length === g[0].length), `${nom} : lignes de longueurs différentes`);
    assert.ok(/^[kwycro.]+$/.test(g.join("")), `${nom} : lettre hors palette`);
  }
});

test("noms : nom de famille, prénom, tri alphabétique", () => {
  assert.equal(nomDeFamille("Teddy Riner"), "Riner");
  assert.equal(nomDeFamille("Dominique de Villepin"), "Villepin");
  assert.equal(nomDeFamille("Marine Le Pen"), "Le Pen");
  assert.equal(prenom("Jean-Luc Mélenchon"), "Jean-Luc");
  const tries = ["Dominique de Villepin", "Raphaël Glucksmann", "Teddy Riner", "Marine Le Pen", "Jean-Luc Mélenchon"].sort((a, b) => cleAlphabetique(a).localeCompare(cleAlphabetique(b), "fr"));
  assert.deepEqual(tries.map(nomDeFamille), ["Glucksmann", "Le Pen", "Mélenchon", "Riner", "Villepin"]);
});
