import { test } from "node:test";
import assert from "node:assert/strict";
import { ICONES, NOMS_ICONES, TAILLE_GRILLE, dataUriIcone, svgIcone } from "../src/lib/icones-pixel.js";

const LISTE_DE_DEPART = [
  "pompe", "camion", "loupe", "document", "balance", "calendrier", "puce", "pieces", "baril",
  "courbe-baisse", "courbe-hausse", "jauge", "carte", "urne", "assemblee", "micro", "vrai", "faux",
  "question", "idee", "attention", "billet", "oeil", "viseur", "maison", "ecole", "hopital",
  "retraite", "emploi", "eclair", "feuille", "bouclier", "globe", "epi", "caddie", "commente", "partage",
];

test("liste fermée : les 37 icônes de départ, sans doublon", () => {
  assert.deepEqual([...NOMS_ICONES].sort(), [...LISTE_DE_DEPART].sort());
});

test("chaque icône est une grille 16 × 16 de caractères autorisés", () => {
  for (const [nom, grille] of Object.entries(ICONES)) {
    assert.equal(grille.length, TAILLE_GRILLE, `${nom} : nombre de lignes`);
    grille.forEach((ligne, i) => {
      assert.equal(ligne.length, TAILLE_GRILLE, `${nom}, ligne ${i}`);
      assert.match(ligne, /^[.WJV]+$/, `${nom}, ligne ${i}`);
    });
  }
});

test("chaque icône a un trait blanc et au plus une couleur d'accent", () => {
  for (const [nom, grille] of Object.entries(ICONES)) {
    const pixels = grille.join("");
    assert.ok(pixels.includes("W"), `${nom} : pas de trait`);
    assert.ok(!(pixels.includes("J") && pixels.includes("V")), `${nom} : deux accents`);
  }
});

test("svgIcone : un SVG 16 × 16 sans anticrénelage, couleurs du thème", () => {
  const sombre = svgIcone("pompe");
  assert.match(sombre, /^<svg [^>]*viewBox="0 0 16 16"[^>]*shape-rendering="crispEdges"/);
  assert.match(sombre, /fill="#ffffff"/);
  const clair = svgIcone("pompe", { theme: "clair" });
  assert.doesNotMatch(clair, /fill="#ffffff"/);
  assert.throws(() => svgIcone("inconnue"));
  assert.match(dataUriIcone("loupe"), /^data:image\/svg\+xml;base64,/);
});

test("svgIcone : les suites de pixels sont regroupées en un seul rectangle", () => {
  // Ligne 14 de « pompe » : 10 pixels blancs d'affilée.
  assert.match(svgIcone("pompe"), /<rect x="0" y="14" width="10" height="1"/);
});
