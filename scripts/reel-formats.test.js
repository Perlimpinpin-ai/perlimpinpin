// Tests des Reels v5 (charte graphique RS) : formats programme et
// thématique, couleurs hors palette, sous-titres de 8 mots par ligne, types
// consécutifs (exception des suites `mesure` et `candidat`), ordre
// alphabétique, écart de durée entre candidats.
//   node --test scripts/reel-formats.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  changementsDecrits,
  checkList,
  classement,
  controlerStoryboard,
  ecartDureesCandidats,
  imagesFigees,
  lignesSousTitres,
  lignesTropLongues,
  motsLigne,
  tempsStoryboard,
} from "../src/lib/reel-storyboard.js";
import { couleursHorsPalette, couleursImage, couleursStoryboard, dispositionImage, zonesStoryboard } from "../src/lib/reel-disposition.js";
import { choisirCandidatsThematique, choisirMesuresProgramme } from "../src/lib/reel-formats.js";
import { genererStoryboardCore } from "../src/lib/reel-storyboard-generation.js";

const lireJson = (chemin) => JSON.parse(readFileSync(new URL(`../data/reel-demo/${chemin}`, import.meta.url), "utf8"));
const copie = (o) => structuredClone(o);
const VARIANTES = { signature: 0, verdict: 0, fin: 0 };

const PROGRAMME = lireJson("programme-marine-tondelier/donnees.json");
const REPONSE_PROGRAMME = lireJson("programme-marine-tondelier/reponse-A.json");
const { mesures } = choisirMesuresProgramme(PROGRAMME.fiches);
const ctxProgramme = { format: "programme", mode: "A", variantes: VARIANTES, candidatNom: "Marine Tondelier", mesures };

const THEMATIQUE = lireJson("thematique-retraites/donnees.json");
const REPONSE_THEMATIQUE = lireJson("thematique-retraites/reponse-A.json");
const choixTheme = choisirCandidatsThematique(THEMATIQUE.fiches, "retraites", { avec: THEMATIQUE.avec, candidatsConnus: THEMATIQUE.candidatsConnus });
const ctxThematique = { format: "thematique", mode: "A", variantes: VARIANTES, candidats: choixTheme.candidats };
const ctxImagesThematique = { format: "thematique", theme: "retraites", themeLibelle: choixTheme.themeLibelle, themeCourt: choixTheme.themeCourt, candidats: choixTheme.candidats };

// --- Choix des fiches -------------------------------------------------------------------

test("programme : 6 thèmes différents, dans l'ordre de déclaration", () => {
  assert.deepEqual(
    mesures.map((m) => m.themeCourt),
    ["Logement", "Emploi", "Institutions", "Économie", "Sécurité", "Éducation"],
  );
  assert.deepEqual(mesures.map((m) => m.propositionId), [28, 29, 37, 64, 72, 95]);
  const riner = choisirMesuresProgramme(lireJson("programme-teddy-riner/donnees.json").fiches);
  assert.equal(riner.mesures.length, 1);
  assert.match(riner.erreur, /Riner n'a que 1 thème/);
  assert.match(choisirMesuresProgramme(PROGRAMME.fiches, { choix: [28, 28] }).erreur, /même thème/);
});

test("thématique : une fiche par candidat, ordre alphabétique du nom de famille, candidat sans fiche", () => {
  assert.deepEqual(
    choixTheme.candidats.map((c) => [c.nom, c.propositionId]),
    [
      ["Raphaël Glucksmann", 54],
      ["Marine Le Pen", 98],
      ["Jean-Luc Mélenchon", null],
      ["Teddy Riner", 93],
      ["Dominique de Villepin", 53],
    ],
  );
  assert.equal(choixTheme.erreur, null);
  assert.equal(choisirCandidatsThematique(THEMATIQUE.fiches, "retraites").candidats.length, 4);
  const trois = THEMATIQUE.fiches.filter((f) => f.candidat.nom !== "Teddy Riner");
  assert.match(choisirCandidatsThematique(trois, "retraites").erreur, /3 candidat\(s\) pour « Retraites » : 4 à 8 attendus/);
});

test("classement : par note, moyenne calculée par le code", () => {
  const c = classement(mesures.map((m) => ({ libelle: m.themeCourt, score: m.score })));
  assert.deepEqual(c.lignes.map((l) => l.score), [69, 65, 64, 62, 53, 33]);
  assert.equal(c.moyenne, 57.7);
  const t = classement(choixTheme.candidats.map((x) => ({ libelle: x.nom, score: x.score })));
  assert.equal(t.moyenne, 54.3);
  assert.deepEqual(t.sansNote.map((x) => x.libelle), ["Jean-Luc Mélenchon"]);
});

// --- Les simulations passent -----------------------------------------------------------

test("simulations programme et thématique : aucun refus, zones et couleurs propres", () => {
  const p = controlerStoryboard(REPONSE_PROGRAMME, ctxProgramme);
  assert.deepEqual(p.erreurs, []);
  assert.deepEqual(p.avertissements, []);
  const ctxImagesProgramme = { format: "programme", candidatNom: "Marine Tondelier", mesures };
  assert.deepEqual(zonesStoryboard(p.storyboard.scenes, null, ctxImagesProgramme), []);
  assert.deepEqual(couleursStoryboard(p.storyboard.scenes, null, ctxImagesProgramme).horsPalette, []);
  const t = controlerStoryboard(REPONSE_THEMATIQUE, ctxThematique);
  assert.deepEqual(t.erreurs, []);
  assert.deepEqual(t.avertissements, []);
  assert.deepEqual(zonesStoryboard(t.storyboard.scenes, null, ctxImagesThematique), []);
  assert.deepEqual(couleursStoryboard(t.storyboard.scenes, null, ctxImagesThematique).horsPalette, []);
});

// --- Couleurs hors palette -------------------------------------------------------------------

test("couleurs : hors palette Reels, registre et jaune → refus ; la couleur du candidat seulement sur son bandeau", () => {
  assert.deepEqual(couleursHorsPalette(["#17130F", "#FFD23F", "#2C6A9E", "#8C6BFF", "#ff5fd2"]), ["#8C6BFF", "#FF5FD2"]);
  const t = controlerStoryboard(REPONSE_THEMATIQUE, ctxThematique);
  const riner = t.storyboard.scenes.find((s) => s.type === "candidat" && s.numero === 4);
  const couleurs = couleursImage(dispositionImage(riner, 3, ctxImagesThematique));
  assert.ok(couleurs.includes("#2C6A9E"), "bandeau à la couleur de Riner");
  assert.ok(!couleurs.includes("#9A632E"), "pas la couleur d'un autre candidat");
  const accroche = dispositionImage(controlerStoryboard(REPONSE_PROGRAMME, ctxProgramme).storyboard.scenes[1], 3, { format: "programme", mesures });
  assert.ok(!couleursImage(accroche).some((c) => ["#2F6A4C"].includes(c)), "programme : pas de couleur de candidat");
});

// --- Sous-titres : 8 mots par ligne ---------------------------------------------------------------

test("sous-titres : 8 mots par ligne au plus, coupure sur la ponctuation ; ligne de 9 mots dans un SRT → détectée", () => {
  assert.deepEqual(lignesSousTitres("Le Chili, lui, l’a **payé cher**."), ["Le Chili, lui, l’a **payé cher**."]);
  assert.deepEqual(lignesSousTitres("Sa doctrine de désescalade est **sérieuse**, mais rien face aux groupes mobiles."), ["Sa doctrine de désescalade est **sérieuse**,", "mais rien face aux groupes mobiles."]);
  const longue = lignesSousTitres("un deux trois quatre cinq six sept huit neuf dix onze douze treize quatorze quinze seize dix-sept");
  assert.ok(longue.every((l) => motsLigne(l) <= 8));
  assert.deepEqual(lignesSousTitres("Teddy Riner veut placer une partie de **vos retraites** en Bourse."), ["Teddy Riner veut placer une partie de **vos**", "**retraites** en Bourse."]);
  const srt = "1\n00:00:00,000 --> 00:00:02,000\nun deux trois quatre cinq six sept huit neuf\n";
  assert.deepEqual(lignesTropLongues(srt).map((l) => l.mots), [9]);
  const r = controlerStoryboard(REPONSE_PROGRAMME, ctxProgramme);
  const liste = checkList({ format: "programme", mode: "A", storyboard: r.storyboard, temps: r.temps, srt, grain: true });
  assert.equal(liste.find((x) => /8 mots par ligne/.test(x.texte)).etat, "ko");
});

// --- Types consécutifs -----------------------------------------------------------------------------

test("types consécutifs : `mesure` et `candidat` se suivent, les autres jamais", () => {
  assert.ok(!controlerStoryboard(REPONSE_PROGRAMME, ctxProgramme).erreurs.some((e) => /de suite/.test(e)));
  assert.ok(!controlerStoryboard(REPONSE_THEMATIQUE, ctxThematique).erreurs.some((e) => /de suite/.test(e)));
  const r = copie(REPONSE_PROGRAMME);
  r.scenes.splice(7, 0, copie(r.scenes[7])); // deux `classement` d'affilée
  const c = controlerStoryboard(r, ctxProgramme);
  assert.ok(c.erreurs.some((e) => /deux `classement` de suite/.test(e)));
  assert.ok(c.erreurs.some((e) => /9 scènes attendues/.test(e)));
});

test("première scène selon le format ; type d'un autre format refusé", () => {
  const r = copie(REPONSE_PROGRAMME);
  r.scenes[0] = { ...copie(REPONSE_THEMATIQUE.scenes[0]) }; // medaillons dans un programme
  const c = controlerStoryboard(r, ctxProgramme);
  assert.ok(c.erreurs.some((e) => /première scène doit être `accroche-programme`/.test(e)));
  assert.ok(c.erreurs.some((e) => /`medaillons` n'existe pas au format « Programme »/.test(e)));
});

// --- Ordre alphabétique, notes, candidats sans fiche -------------------------------------------------

test("thématique : candidats hors de l'ordre alphabétique → refus", () => {
  const r = copie(REPONSE_THEMATIQUE);
  const [a, b] = [r.scenes[2], r.scenes[3]];
  r.scenes[2] = b;
  r.scenes[3] = a;
  const c = controlerStoryboard(r, ctxThematique);
  assert.ok(c.erreurs.some((e) => /l'ordre alphabétique demande 1, 2, 3, 4, 5 \(Glucksmann, Le Pen, Mélenchon, Riner, Villepin\)/.test(e)));
});

test("candidat sans fiche : pas de proposition prêtée ; note du code dite dans la voix", () => {
  const r = copie(REPONSE_THEMATIQUE);
  r.scenes[4].proposition = "Une proposition inventée.";
  r.scenes[2].voix[2] = "**60 sur 100**, plausible sous condition.";
  const c = controlerStoryboard(r, ctxThematique);
  assert.ok(c.erreurs.some((e) => /Mélenchon n'a pas de fiche sur ce thème/.test(e)));
  assert.ok(c.erreurs.some((e) => /la voix doit dire « 61 sur 100 »/.test(e)));
});

test("prénom à l'écran → avertissement (seulement le nom de famille)", () => {
  const r = copie(REPONSE_PROGRAMME);
  r.scenes[1].titre = "Marine veut encadrer les loyers.";
  assert.ok(controlerStoryboard(r, ctxProgramme).avertissements.some((a) => /prénom « Marine »/.test(a)));
});

// --- Durées ---------------------------------------------------------------------------------------

test("thématique : écart de durée de plus de 15 % entre deux scènes `candidat` → avertissement", () => {
  const scenes = [{ type: "candidat" }, { type: "candidat" }, { type: "fin" }];
  const temps = (d1, d2) => ({ scenes: [{ debut: 0, fin: d1 }, { debut: d1, fin: d1 + d2 }, { debut: d1 + d2, fin: d1 + d2 + 5 }] });
  assert.equal(ecartDureesCandidats(scenes, temps(7, 8)), null);
  assert.match(ecartDureesCandidats(scenes, temps(6, 8)), /scène 2 \(8,0 s\) et scène 1 \(6,0 s\), 33 % d'écart/);
  const r = copie(REPONSE_THEMATIQUE);
  r.scenes[3].voix[0] = "Le Pen veut partir **entre 60 et 62 ans**, avec une retraite selon le premier emploi stable, pour les carrières longues surtout.";
  assert.ok(controlerStoryboard(r, ctxThematique).avertissements.some((a) => /Même durée pour tous les candidats/.test(a)));
});

test("mouvement : image clé figée plus de 2 s d'après le minutage → avertissement", () => {
  assert.equal(changementsDecrits("La fenêtre s'ouvre en glitch, l'image se charge, puis le titre claque."), 3);
  const scene = { type: "proposition", voix: ["a b c d e f g h i", "j", "k"], mouvement: ["Une seule chose.", "x", "y"] };
  const minutage = { mots: "abcdefghijk".split("").map((m, i) => ({ mot: m, debut: i * 0.5, fin: i * 0.5 + 0.4 })) };
  const t = tempsStoryboard([scene], minutage);
  assert.equal(t.estime, false);
  assert.match(imagesFigees([scene], t)[0], /Scène 1 \(proposition\), image 1 : 4,5 s pour 1 changement décrit/);
});

// --- Génération (un seul appel, réponse simulée) ----------------------------------------------------

test("génération mode A d'un programme : un appel, consignes du format, rangé en v5", async () => {
  const messages = [];
  const res = await genererStoryboardCore({
    format: "programme",
    mode: "A",
    candidatNom: "Marine Tondelier",
    mesures,
    prompt: "PROMPT",
    appeler: async (m) => (messages.push(m), {}),
    analyser: () => REPONSE_PROGRAMME,
    alea: () => 0,
    journal: { error() {}, warn() {} },
  });
  assert.equal(messages.length, 1);
  assert.match(messages[0], /LES 6 MESURES/);
  assert.match(messages[0], /4\. Économie · « Surtaxer les très gros héritages » · 69 sur 100 · solide et chiffré/);
  assert.equal(res.reel.version, 5);
  assert.equal(res.reel.format, "programme");
  assert.equal(res.reel.couverture.titre, "On a noté **6 mesures** de Tondelier.");
});
