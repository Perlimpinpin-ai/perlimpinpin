// Tests du storyboard des Reels (v4) : contrôle mot pour mot (mode B), types
// de scènes consécutifs, zones sûres, et le reste des contrôles.
//   node --test scripts/reel-storyboard.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  checkList,
  controlerStoryboard,
  ecartMotPourMot,
  jetons,
  lireMinutage,
  lireStoryboard,
  messageFinal,
  minutageEstime,
  sousTitresSrt,
  tempsStoryboard,
  textesEcran,
} from "../src/lib/reel-storyboard.js";
import { ZONES, boiteTournee, dispositionImage, sousTitre, zonesImage, zonesStoryboard } from "../src/lib/reel-disposition.js";
import { mediasStoryboard, nomArchiveStoryboard, objetR } from "../src/lib/reel-storyboard-paquet.js";
import { lireDepotEquipe } from "../src/lib/reel-action-core.js";
import { consignesMode, genererStoryboardCore } from "../src/lib/reel-storyboard-generation.js";
import { tournuresIA } from "../src/lib/tournures-ia.js";
import { paysCites } from "../src/lib/reel-pays.js";

const lire = (nom) => readFileSync(new URL(`../data/reel-demo/fiche-93/${nom}`, import.meta.url), "utf8");
const REPONSE_A = JSON.parse(lire("reponse-A.json"));
const REPONSE_B = JSON.parse(lire("reponse-B.json"));
const SCRIPT_B = lire("script-B.txt");
const MINUTAGE_B = JSON.parse(lire("minutage-B.json"));
// Les nombres de la fiche 93 utilisés par les réponses simulées.
const FICHE = { texte: "5,1 milliards en 2025, 6,8 en 2030, 2,4 points en 2070 ; Chili 1981, 3,25 % ; 0 à 2 ans ; 30 à 40 ans." };
const VARIANTES = { signature: 0, verdict: 0, fin: 0 };
const ctxA = { mode: "A", ficheFinale: FICHE, score: 56, variantes: VARIANTES };
const ctxB = { mode: "B", ficheFinale: FICHE, score: 56, script: SCRIPT_B, minutage: lireMinutage(MINUTAGE_B) };
const copie = (o) => structuredClone(o);

// --- Contrôle mot pour mot ---------------------------------------------------------

test("mot pour mot : la réponse simulée B redonne le script de l'équipe", () => {
  assert.equal(ecartMotPourMot(REPONSE_B.scenes, SCRIPT_B), null);
  const c = controlerStoryboard(REPONSE_B, ctxB);
  assert.deepEqual(c.erreurs, []);
  assert.equal(c.valide, true);
});

test("mot pour mot : ponctuation, casse, apostrophes et « ** » ignorés", () => {
  const scenes = [{ voix: ["**Bonjour**, à TOUS", "l’IA", "dit : « oui » !"] }];
  assert.equal(ecartMotPourMot(scenes, "bonjour à tous l'IA dit oui"), null);
  assert.deepEqual(jetons("D’abord, **6,8 milliards**…"), ["d", "abord", "6", "8", "milliards"]);
});

test("mot pour mot : un mot remplacé donne l'endroit exact", () => {
  const r = copie(REPONSE_B);
  r.scenes[2].voix[1] = r.scenes[2].voix[1].replace("épargne", "économie");
  const ecart = ecartMotPourMot(r.scenes, SCRIPT_B);
  assert.equal(ecart.scene, 3);
  assert.equal(ecart.morceau, 2);
  assert.equal(ecart.attendu, "épargne");
  assert.equal(ecart.trouve, "économie");
  assert.match(ecart.message, /scène 3, morceau 2/);
  assert.match(ecart.message, /après « …/);
  const c = controlerStoryboard(r, ctxB);
  assert.equal(c.valide, false);
  assert.ok(c.erreurs.some((e) => e.includes("« épargne »")));
});

test("mot pour mot : mot ajouté, mot manquant, fin de texte", () => {
  const scenes = [{ voix: ["un deux", "trois", "quatre"] }];
  assert.match(ecartMotPourMot(scenes, "un deux trois").message, /« \(fin du script\) »/);
  assert.match(ecartMotPourMot(scenes, "un deux trois quatre cinq").message, /« \(fin du storyboard\) »/);
  assert.equal(ecartMotPourMot(scenes, "un trois quatre").position, 2);
});

test("mot pour mot : un morceau répété à l'identique n'est dit qu'une fois", () => {
  const scenes = [{ voix: ["Notre note : **56 sur 100**.", "Notre note : **56 sur 100**.", "Bon cap."] }];
  assert.equal(ecartMotPourMot(scenes, "Notre note : 56 sur 100. Bon cap."), null);
});

// --- Types consécutifs, première et dernière scène ------------------------------------

test("types : deux scènes de suite du même type sont refusées", () => {
  const r = copie(REPONSE_A);
  r.scenes[2] = { ...copie(r.scenes[1]) }; // deux « chiffres » d'affilée
  const c = controlerStoryboard(r, ctxA);
  assert.equal(c.valide, false);
  assert.ok(c.erreurs.some((e) => /Scènes 2 et 3 : deux `chiffres` de suite/.test(e)));
});

test("types : première scène accroche, dernière fin", () => {
  const r = copie(REPONSE_A);
  r.scenes.reverse();
  const c = controlerStoryboard(r, ctxA);
  assert.ok(c.erreurs.some((e) => e.includes("première scène doit être une `accroche`")));
  assert.ok(c.erreurs.some((e) => e.includes("dernière scène doit être une `fin`")));
});

test("types : type ou champ inconnu, champ manquant → JSON invalide", () => {
  const r = copie(REPONSE_A);
  r.scenes[1].type = "graphique";
  r.scenes[2].couleur = "rouge";
  delete r.scenes[3].verdict;
  const { storyboard, erreurs } = lireStoryboard(r);
  assert.equal(storyboard, null);
  assert.ok(erreurs.some((e) => e.includes("type « graphique » inconnu")));
  assert.ok(erreurs.some((e) => e.includes("champ « couleur » inconnu")));
  assert.ok(erreurs.some((e) => e.includes("verdict : champ manquant")));
});

test("structure : 3 morceaux de voix et 3 mouvements, 7 à 10 scènes", () => {
  const r = copie(REPONSE_A);
  r.scenes[0].voix.pop();
  assert.ok(lireStoryboard(r).erreurs.some((e) => e.includes("voix : 3 morceaux attendus")));
  const court = copie(REPONSE_A);
  court.scenes = [court.scenes[0], court.scenes[3], court.scenes.at(-1)];
  assert.ok(controlerStoryboard(court, ctxA).erreurs.some((e) => e.includes("3 scènes : 7 à 10 attendues")));
});

// --- Autres contrôles -------------------------------------------------------------

test("la réponse simulée A passe tous les contrôles", () => {
  const c = controlerStoryboard(REPONSE_A, ctxA);
  assert.deepEqual(c.erreurs, []);
  assert.deepEqual(c.avertissements, []);
});

test("note : score ou verdict différents de ceux du code → refus", () => {
  const r = copie(REPONSE_A);
  const note = r.scenes.find((s) => s.type === "note");
  note.score = 60;
  note.verdict = "solide";
  const c = controlerStoryboard(r, ctxA);
  assert.ok(c.erreurs.some((e) => e.includes("score 60, le code calcule 56")));
  assert.ok(c.erreurs.some((e) => e.includes("verdict « solide »")));
});

test("écran : chiffre absent du script et de la fiche → refus ; plus de 7 mots → avertissement", () => {
  const r = copie(REPONSE_A);
  r.scenes[4].etiquette = "court terme · 0 à 3 ans";
  r.scenes[4].titre = "Son plan ne bouche pas du tout le trou du déficit.";
  const c = controlerStoryboard(r, ctxA);
  assert.ok(c.erreurs.some((e) => e.includes("affiche « 3 », absent du script et de la fiche")));
  assert.ok(c.avertissements.some((e) => e.includes("« titre » fait 11 mots")));
});

test("écran : un chiffre dit dans le script est permis", () => {
  const r = copie(REPONSE_A);
  r.scenes[5].etapes = ["0", "12", "30-40"];
  r.scenes[5].voix[1] = "Mais votre pension suivrait **la Bourse** pendant 12 ans.";
  assert.ok(!controlerStoryboard(r, ctxA).erreurs.some((e) => e.includes("« 12 »")));
});

test("tournures « IA » : avertissement", () => {
  assert.deepEqual(tournuresIA("En somme, un enjeu crucial."), ["en somme", "crucial"]);
  assert.deepEqual(tournuresIA("Ça marche — ou pas — vraiment."), ["tirets en cascade"]);
  const r = copie(REPONSE_A);
  r.scenes[4].titre = "En somme, le trou reste.";
  assert.ok(controlerStoryboard(r, ctxA).avertissements.some((e) => e.includes("« en somme »")));
});

test("pays : cité sans carte → refus ; carte absente du disque → refus", () => {
  assert.deepEqual(paysCites("Aux Pays-Bas, pas en Nouvelle-Zélande, ni en France."), ["fr", "nl", "nz"]);
  assert.deepEqual(paysCites("Dans plusieurs pays d'Europe."), []);
  const r = copie(REPONSE_A);
  r.scenes[1].voix[1] = "Comme en **Suède**, de moins en moins d’actifs.";
  assert.ok(controlerStoryboard(r, ctxA).erreurs.some((e) => e.includes("Suède est cité sans carte")));
  const sansCarte = controlerStoryboard(REPONSE_A, { ...ctxA, cartesDisponibles: ["nl", "dk"] });
  assert.ok(sansCarte.erreurs.some((e) => e.includes("Carte « cl »")));
});

test("mode A : phrases fixes (signature, verdict, appel final)", () => {
  const r = copie(REPONSE_A);
  r.scenes[0].voix[2] = "Alors, on regarde ?";
  r.scenes.at(-1).voix[2] = "À bientôt.";
  const c = controlerStoryboard(r, ctxA);
  assert.ok(c.erreurs.some((e) => e.includes("doit finir par « Bonne idée… ou poudre de Perlimpinpin ? »")));
  assert.ok(c.erreurs.some((e) => e.includes("reprendre l’appel fixe")));
});

test("textes à l'écran : hors voix, mouvement, score et url", () => {
  const fin = REPONSE_A.scenes.at(-1);
  assert.deepEqual(textesEcran(fin).map((t) => t.champ), ["question", "mention"]);
});

// --- Minutage, sous-titres, message ------------------------------------------------

test("minutage : lecture, temps calés sur les mots, sans trou entre scènes", () => {
  assert.match(lireMinutage({}).erreur, /mots/);
  const t = tempsStoryboard(REPONSE_B.scenes, lireMinutage(MINUTAGE_B));
  assert.equal(t.estime, false);
  assert.equal(t.scenes.length, 9);
  for (let i = 1; i < t.scenes.length; i++) assert.equal(t.scenes[i - 1].fin, t.scenes[i].debut);
  assert.ok(t.duree > 60 && t.duree < 80);
});

test("minutage : absent ou discordant → 3 mots par seconde", () => {
  const t = tempsStoryboard([{ voix: ["un deux trois", "quatre cinq six", "sept huit neuf"] }]);
  assert.equal(t.estime, true);
  assert.equal(t.duree, 3);
  assert.equal(minutageEstime([{ voix: ["un deux trois", "a", "b"] }]).mots.length, 5);
  const faux = tempsStoryboard(REPONSE_A.scenes, lireMinutage(MINUTAGE_B));
  assert.equal(faux.estime, true);
});

test("sous-titres SRT : texte exact, sans « ** », lignes de 8 mots au plus", () => {
  const t = tempsStoryboard(REPONSE_B.scenes, lireMinutage(MINUTAGE_B));
  const srt = sousTitresSrt(REPONSE_B.scenes, t);
  assert.ok(!srt.includes("**"));
  assert.match(srt, /^1\n00:00:00,\d{3} --> 00:00:\d\d,\d{3}\nTeddy Riner veut mettre vos retraites en Bourse\.\n/);
  const lignes = srt.split("\n\n").map((b) => b.split("\n")[2]);
  assert.ok(lignes.every((l) => l.split(" ").length <= 8));
  assert.equal(jetons(lignes.join(" ")).join(" "), jetons(SCRIPT_B).join(" "));
});

test("message final et check-list", () => {
  const c = controlerStoryboard(REPONSE_B, ctxB);
  const msg = messageFinal({ scenes: c.storyboard.scenes, temps: c.temps, ecarts: MINUTAGE_B.ecarts, pointsAValider: ["a", "b"], mode: "B" });
  assert.match(msg, /^9 scènes, 1 min \d\d s, 2 écarts entre script et voix off, 2 points à valider\.$/);
  const liste = checkList({ mode: "B", storyboard: c.storyboard, temps: c.temps, photos: { candidat: true }, minutage: lireMinutage(MINUTAGE_B) });
  assert.equal(liste.length, 8);
  assert.equal(liste.at(-1).etat, "ok");
});

// --- Zones sûres --------------------------------------------------------------------

test("zones sûres : les deux simulations ne débordent nulle part", () => {
  const ctx = { candidatNom: "Teddy Riner", theme: "Retraites" };
  assert.deepEqual(zonesStoryboard(lireStoryboard(REPONSE_A).storyboard.scenes, REPONSE_A.couverture, ctx), []);
  assert.deepEqual(zonesStoryboard(lireStoryboard(REPONSE_B).storyboard.scenes, REPONSE_B.couverture, ctx), []);
});

test("zones sûres : un avertissement par chevauchement, avec la scène et l'élément", () => {
  const els = [
    { id: "titre", genre: "texte", x: 72, y: 200, w: 500, h: 100, important: true },
    { id: "candidat", genre: "fenetre", x: 600, y: 900, w: 400, h: 500, important: true },
    { id: "objet-1", genre: "pixel", x: 100, y: 1340, w: 50, h: 50, important: false },
    { id: "objet-2", genre: "pixel", x: 1000, y: 100, w: 60, h: 60, important: false },
  ];
  const a = zonesImage(els, "Scène 2 (chiffres), image 3");
  assert.ok(a.some((x) => x.startsWith("Scène 2 (chiffres), image 3 : le titre monte au-dessus de 250 px")));
  assert.ok(a.some((x) => x.includes("la fenêtre du candidat empiète sur la zone des sous-titres")));
  assert.ok(a.some((x) => x.includes("« objet-1 » empiète sur la zone des sous-titres")));
  assert.ok(!a.some((x) => x.includes("objet-2")), "un objet décoratif peut aller dans les marges");
  const droite = zonesImage([{ id: "titre", genre: "texte", x: 72, y: 400, w: 900, h: 100, important: true }], "Scène 1 (accroche), image 1");
  assert.deepEqual(droite, ["Scène 1 (accroche), image 1 : le titre entre dans les 150 px de droite (bord à 972 px)."]);
  const bas = zonesImage([{ id: "verdict", genre: "tampon", x: 72, y: 1200, w: 300, h: 120, important: true }], "Scène 4 (note), image 3");
  assert.equal(bas.length, 1);
  assert.match(bas[0], /^Scène 4 \(note\), image 3 : le tampon du verdict descend sous 1 300 px \(bas à 1\s320 px\)\.$/u);
});

test("zones sûres : la rotation agrandit la boîte ; sous-titre dans sa bande", () => {
  const b = boiteTournee({ x: 0, y: 0, w: 100, h: 100, rotation: 45 });
  assert.ok(b.x1 - b.x0 > 140);
  const st = sousTitre("Un sous-titre de longueur normale pour une image clé.");
  assert.equal(st.y, ZONES.sousTitresHaut);
  assert.ok(st.y + st.h <= ZONES.sousTitresBas);
  const long = sousTitre("mot ".repeat(80));
  assert.ok(zonesImage([long], "Scène 1 (accroche), image 1")[0].includes("sous-titre trop long"));
});

test("disposition : le sous-titre de chaque image est son morceau de voix", () => {
  const s = lireStoryboard(REPONSE_A).storyboard.scenes[0];
  [1, 2, 3].forEach((k) => assert.equal(dispositionImage(s, k, {}).at(-1).texte, s.voix[k - 1]));
});

// --- Zip, dépôt, génération -----------------------------------------------------------

test("zip : nom, fichiers et objet R", () => {
  assert.equal(nomArchiveStoryboard({ candidatNom: "Teddy Riner", theme: "Retraites" }), "reel-teddy-riner-retraites.zip");
  const scenes = lireStoryboard(REPONSE_A).storyboard.scenes;
  const noms = mediasStoryboard(scenes, (image) => `/x?image=${image}`).map((m) => m.nom);
  assert.ok(noms.includes("00-couverture.png"));
  assert.ok(noms.includes("planches/planche-09.png"));
  assert.ok(noms.includes("images/scene-01-1.png") && noms.includes("images/scene-09-3.png"));
  assert.ok(noms.includes("calques/fond.png") && noms.includes("calques/07-pays/07-visuel.png"));
  assert.ok(noms.some((n) => n.startsWith("sons/")));
  const c = controlerStoryboard(REPONSE_A, ctxA);
  const R = objetR({ candidatNom: "Teddy Riner", theme: "Retraites", mode: "A", couverture: REPONSE_A.couverture, temps: c.temps, storyboard: c.storyboard });
  assert.equal(R.photos.nomCandidat, "teddy_riner.png");
  assert.equal(typeof R.scenes[0].debut, "number");
});

test("dépôt de l'équipe : script vide, minutage illisible", () => {
  assert.match(lireDepotEquipe({ script: "  " }, lireMinutage).erreur, /Script vide/);
  assert.match(lireDepotEquipe({ script: "Bonjour", minutageBrut: "{" }, lireMinutage).erreur, /illisible/);
  const ok = lireDepotEquipe({ script: SCRIPT_B, minutageBrut: JSON.stringify(MINUTAGE_B) }, lireMinutage);
  assert.equal(ok.minutage.mots.length, MINUTAGE_B.mots.length);
});

test("génération : mode B, consignes sans réécriture, second essai après refus", async () => {
  assert.match(consignesMode("B", { score: 56, script: "Bonjour." }), /Tu ne le réécris JAMAIS/);
  const r = copie(REPONSE_B);
  r.scenes[0].voix[0] = "Teddy Riner veut mettre **nos retraites** en Bourse.";
  const messages = [];
  const reponses = [r, REPONSE_B];
  const res = await genererStoryboardCore({
    mode: "B",
    ficheFinale: FICHE,
    candidatNom: "Teddy Riner",
    score: 56,
    prompt: "PROMPT",
    script: SCRIPT_B,
    minutage: lireMinutage(MINUTAGE_B),
    appeler: async (message) => (messages.push(message), { usage: { input_tokens: 10, output_tokens: 5 } }),
    analyser: () => reponses.shift(),
    journal: { error() {}, warn() {} },
  });
  assert.equal(messages.length, 2);
  assert.match(messages[1], /le script dit « vos », le storyboard « nos »/);
  assert.equal(res.reel.version, 4);
  assert.equal(res.reel.mode, "B");
  assert.equal(res.reel.script.trim(), SCRIPT_B.trim());
  assert.equal(res.usage.input_tokens, 20);
});

test("génération : deux refus → rien n'est rangé", async () => {
  const r = copie(REPONSE_A);
  r.scenes[1].type = "inconnu";
  const res = await genererStoryboardCore({
    mode: "A",
    ficheFinale: FICHE,
    candidatNom: "Teddy Riner",
    score: 56,
    prompt: "PROMPT",
    appeler: async () => ({}),
    analyser: () => r,
    alea: () => 0,
    journal: { error() {}, warn() {} },
  });
  assert.equal(res.reel, null);
  assert.ok(res.errors.some((e) => e.includes("inconnu")));
});
