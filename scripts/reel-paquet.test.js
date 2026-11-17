import { test } from "node:test";
import assert from "node:assert/strict";
import { SCENES_REEL, assemblerReel } from "../src/lib/reel.js";
import { CANDIDAT_EXEMPLE, SCORE_EXEMPLE, VARIABLES_EXEMPLE } from "../src/lib/reel-exemple.js";
import { fichiersTexteReel, infosReel, nomArchiveReel, nomImageScene, planDeMontage } from "../src/lib/reel-paquet.js";

test("noms des 9 images, de 01-accroche à 09-appel-final", () => {
  assert.deepEqual(SCENES_REEL.map(nomImageScene), [
    "01-accroche.png",
    "02-presentation.png",
    "03-ce-qui-tient.png",
    "04-le-hic.png",
    "05-la-preuve.png",
    "06-la-facture.png",
    "07-la-nuance.png",
    "08-verdict.png",
    "09-appel-final.png",
  ]);
});

test("nom de l'archive", () => {
  assert.equal(nomArchiveReel({ propositionId: 93, slug: "Teddy Riner", theme: "sombre" }), "reel-93-teddy-riner-sombre.zip");
  assert.equal(nomArchiveReel({ propositionId: 7, slug: "Édouard Philippe", theme: "clair" }), "reel-7-edouard-philippe-clair.zip");
  assert.equal(nomArchiveReel({ propositionId: 7, slug: "", theme: "clair" }), "reel-7-fiche-clair.zip");
});

test("plan de montage : chaque scène avec image, voix, sous-titres, écran et icône", () => {
  const assemble = assemblerReel(VARIABLES_EXEMPLE, { candidatNom: CANDIDAT_EXEMPLE, score: SCORE_EXEMPLE });
  const plan = planDeMontage(assemble.scenes, assemble);
  assert.equal((plan.match(/^## Scène /gm) ?? []).length, 9);
  assert.match(plan, /## Scène 1 · Accroche\n\n- Image : 01-accroche\.png\n- Texte dit : Bloquer le prix/);
  assert.match(plan, /Question « Bonne idée… ou poudre de Perlimpinpin \? »/);
  assert.match(plan, /- Icône : pompe/);
  assert.match(plan, /## Scène 8 · Verdict[\s\S]*Score « 38 » · Palier « Partiellement fondé »/);
  assert.doesNotMatch(plan, /couleur/i);
  assert.match(plan, /## Scène 9 · Appel final[\s\S]*- Icône : commente, partage/);
});

test("infos.txt : lien public ou brouillon", () => {
  const commun = { candidatNom: "Teddy Riner", titre: "Retraites", score: 56, palier: "Plausible sous condition", propositionId: 93, genereLe: "2026-11-17T10:04:22.510Z" };
  const publie = infosReel({ ...commun, brouillon: false });
  assert.match(publie, /Lien : https:\/\/perlimpinpin\.ai\/declarations\/93\n/);
  assert.match(publie, /Score : 56\/100/);
  assert.match(publie, /Script généré le : 17 novembre 2026/);
  assert.match(infosReel({ ...commun, brouillon: true }), /\/test\/93 \(brouillon, non publié\)/);
});

test("fichiersTexteReel : les 4 fichiers texte attendus", () => {
  const assemble = assemblerReel(VARIABLES_EXEMPLE, { candidatNom: CANDIDAT_EXEMPLE, score: SCORE_EXEMPLE });
  const fichiers = fichiersTexteReel({ ...assemble, infos: { candidatNom: "X", titre: "Y", score: 38, palier: "Z", propositionId: 1 } });
  assert.deepEqual(fichiers.map((f) => f.nom), ["script-elevenlabs.txt", "sous-titres.txt", "plan-de-montage.md", "infos.txt"]);
  assert.equal(fichiers[0].donnees, `${assemble.texteVoix}\n`);
  assert.equal(fichiers[1].donnees, `${assemble.texteSousTitres}\n`);
});
