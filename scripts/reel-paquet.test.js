import { test } from "node:test";
import assert from "node:assert/strict";
import { SCENES_REEL, assemblerReel } from "../src/lib/reel.js";
import { CANDIDAT_EXEMPLE, COUVERTURE_EXEMPLE, SCORE_EXEMPLE, VARIABLES_EXEMPLE } from "../src/lib/reel-exemple.js";
import {
  donneesPartageReel,
  fichiersCalques,
  fichiersSons,
  fichiersTexteReel,
  infosReel,
  mediasReel,
  nomArchiveReel,
  nomImageScene,
  planDeMontage,
} from "../src/lib/reel-paquet.js";

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

test("plan de montage : couverture, calques, animations, transition et son", () => {
  const assemble = assemblerReel(VARIABLES_EXEMPLE, { candidatNom: CANDIDAT_EXEMPLE, score: SCORE_EXEMPLE, couverture: COUVERTURE_EXEMPLE });
  const plan = planDeMontage(assemble.scenes, assemble);
  assert.match(plan, /## Couverture\n\n- Image : 00-couverture\.png[^\n]*\n- Titre : « Le carburant bloqué à 1,70 € »\n- Question : « Qui paie \? »/);
  assert.match(plan, /## Scène 4 · Le hic[\s\S]*- Calques : calques\/04-le-hic\/ \(icône, texte, chiffre\)/);
  assert.match(plan, /- Animations : Le chiffre EXEMPLE arrive en zoom, puis l'icône glisse depuis la gauche/);
  assert.match(plan, /- Transition : Coupe glitch/);
  assert.match(plan, /- Son : glitch\.wav, quand le chiffre arrive, à mettre nettement sous la voix/);
  assert.match(plan, /## Scène 8 · Verdict[\s\S]*- Son : jingle-score\.wav, quand le score s'affiche/);
  assert.match(plan, /## Scène 9 · Appel final[\s\S]*- Transition : Extinction d'écran/);
});

test("calques : le fond une fois, puis un dossier par scène", () => {
  const { scenes } = assemblerReel(VARIABLES_EXEMPLE, { candidatNom: CANDIDAT_EXEMPLE, score: SCORE_EXEMPLE });
  const calques = fichiersCalques(scenes);
  assert.deepEqual(calques[0], { nom: "calques/fond.png", scene: null, calque: "fond" });
  assert.deepEqual(
    calques.filter((c) => c.scene === 1).map((c) => c.nom),
    ["calques/01-accroche/01-icone.png", "calques/01-accroche/01-texte.png", "calques/01-accroche/01-chiffre.png"],
  );
  // Sans portrait, la scène 2 n'a qu'un calque texte ; avec, aussi l'icône (le portrait).
  assert.deepEqual(calques.filter((c) => c.scene === 2).map((c) => c.calque), ["texte"]);
  assert.deepEqual(fichiersCalques(scenes, { portrait: true }).filter((c) => c.scene === 2).map((c) => c.calque), ["icone", "texte"]);
  assert.deepEqual(calques.filter((c) => c.scene === 8).map((c) => c.calque), ["texte", "chiffre"]);
});

test("zip : couverture, 9 images, calques et 6 sons, dans le bon ordre", () => {
  const { scenes } = assemblerReel(VARIABLES_EXEMPLE, { candidatNom: CANDIDAT_EXEMPLE, score: SCORE_EXEMPLE });
  const medias = mediasReel(scenes, { url: ({ scene, calque }) => `/img?scene=${scene}${calque ? `&calque=${calque}` : ""}` });
  assert.deepEqual(medias[0], { nom: "00-couverture.png", url: "/img?scene=couverture" });
  assert.equal(medias[9].nom, "09-appel-final.png");
  assert.deepEqual(medias[10], { nom: "calques/fond.png", url: "/img?scene=1&calque=fond" });
  assert.deepEqual(medias.slice(-6), fichiersSons());
  assert.deepEqual(
    fichiersSons().map((s) => s.nom),
    ["sons/blip.wav", "sons/whoosh.wav", "sons/impact.wav", "sons/piece.wav", "sons/glitch.wav", "sons/jingle-score.wav"],
  );
  assert.equal(new Set(medias.map((m) => m.nom)).size, medias.length, "noms uniques");
});

test("données de la page : couverture, montage et calques dans les deux thèmes", () => {
  const assemble = assemblerReel(VARIABLES_EXEMPLE, { candidatNom: CANDIDAT_EXEMPLE, score: SCORE_EXEMPLE, couverture: COUVERTURE_EXEMPLE });
  const d = donneesPartageReel({
    assemble,
    duree: "1 min",
    prefixeFichier: "reel-0",
    slug: "Candidat Exemple",
    propositionId: 0,
    url: ({ scene, theme, calque }) => `/${scene}/${theme}/${calque ?? ""}`,
    infos: { candidatNom: "X", titre: "Y", score: 38, palier: "Z", propositionId: 0 },
  });
  assert.equal(d.couverture.images.clair, "/couverture/clair/");
  assert.equal(d.couverture.question, "Qui paie ?");
  assert.match(d.scenes[0].montage, /^Le titre « Le carburant bloqué à la pompe » arrive en zoom/);
  assert.deepEqual(d.calques.sombre[3].map((c) => c.url), ["/4/sombre/icone", "/4/sombre/texte", "/4/sombre/chiffre"]);
  assert.equal(d.paquet.archive.clair, "reel-0-candidat-exemple-clair.zip");
  assert.equal(d.paquet.medias.sombre[0].url, "/couverture/sombre/");
  assert.equal(d.sons.length, 6);
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
