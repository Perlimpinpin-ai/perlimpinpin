import { test } from "node:test";
import assert from "node:assert/strict";
import {
  QUESTIONS_COUVERTURE,
  SONS_MAX,
  VARIANTES,
  animationsReel,
  avertissementVariabilite,
  choisirVariantes,
  consignesAntiRepetition,
  elementsScene,
  erreursMontage,
  montageScene,
  partPhrasesIdentiques,
  questionCouverture,
  questionCouvertureParDefaut,
  relancesUtilisees,
  sonsReel,
  textesVariantes,
} from "../src/lib/reel-montage.js";
import { assemblerDepuisReel, assemblerReel, controlerReel, derniereQuestion, reelPourStockage } from "../src/lib/reel.js";
import { genererReelCore } from "../src/lib/reel-generation.js";
import { CANDIDAT_EXEMPLE, COUVERTURE_EXEMPLE, SCORE_EXEMPLE, VARIABLES_EXEMPLE, VARIANTES_EXEMPLE } from "../src/lib/reel-exemple.js";

// Tirage « au hasard » reproductible : toujours la même valeur.
const alea = (valeur) => () => valeur;

// --- Variabilité ----------------------------------------------------------------

test("variabilité : part de phrases identiques au dernier Reel", () => {
  const a = "Sauf que voilà. Le prix grimpe. Vous voyez le problème ?";
  assert.equal(partPhrasesIdentiques(a, a), 1);
  assert.equal(partPhrasesIdentiques(a, "Rien à voir. Vraiment rien."), 0);
  // Ponctuation, accents et apostrophes ne comptent pas.
  assert.equal(partPhrasesIdentiques("Sauf que voilà !", "sauf que voila."), 1);
  // 2 phrases sur 4 reprises : 50 %.
  assert.equal(partPhrasesIdentiques("Un. Deux. Trois. Quatre.", "Un. Deux. Cinq."), 0.5);
  assert.equal(partPhrasesIdentiques("", "Un."), 0);
});

test("variabilité : avertissement si moins de 20 % du texte a changé", () => {
  const ancien = "Un. Deux. Trois. Quatre. Cinq.";
  assert.match(avertissementVariabilite(ancien, ancien), /100 % de phrases identiques/);
  // 4 phrases sur 5 identiques : 20 % de changement, pas d'avertissement.
  assert.equal(avertissementVariabilite("Un. Deux. Trois. Quatre. Six.", ancien), null);
  // 9 sur 10 identiques : avertissement.
  const dix = "Un. Deux. Trois. Quatre. Cinq. Six. Sept. Huit. Neuf. Dix.";
  assert.match(avertissementVariabilite(dix.replace("Dix.", "Onze."), dix), /90 %/);
  // Pas de Reel précédent : rien à comparer.
  assert.equal(avertissementVariabilite(ancien, null), null);
});

// --- Variantes des phrases fixes ----------------------------------------------------

test("variantes : 4 à 5 par phrase fixe, les invariants ne bougent jamais", () => {
  for (const [cle, liste] of Object.entries(VARIANTES)) assert.ok(liste.length >= 4 && liste.length <= 5, cle);
  for (const signature of VARIANTES.signature) assert.match(signature, /… ou poudre de Perlimpinpin \?$/);
  for (const { voix } of VARIANTES.appel) {
    assert.match(voix, /commentaire/);
    assert.match(voix, /[Pp]artagez/);
    assert.match(voix, /Perlimpinpin !$/);
    assert.doesNotMatch(voix, /[:—]/);
  }
  for (const p of VARIANTES.presentation) assert.doesNotMatch(p, /[:—]/);
});

test("variantes : tirées au hasard, jamais celles du dernier Reel", () => {
  const precedentes = { signature: 0, presentation: 0, verdict: 0, appel: 0 };
  for (const valeur of [0, 0.3, 0.6, 0.99]) {
    const v = choisirVariantes(precedentes, alea(valeur));
    for (const cle of Object.keys(precedentes)) {
      assert.notEqual(v[cle], 0, `${cle} avec ${valeur}`);
      assert.ok(v[cle] < VARIANTES[cle].length);
    }
  }
  // Sans Reel précédent : toutes les variantes sont possibles.
  assert.equal(choisirVariantes(null, alea(0)).signature, 0);
});

test("assemblage : les variantes changent les phrases fixes, pas le score ni l'appel à commenter", () => {
  const avec = assemblerReel(VARIABLES_EXEMPLE, { candidatNom: CANDIDAT_EXEMPLE, score: 38, variantes: { signature: 2, presentation: 1, verdict: 1, appel: 3 } });
  assert.ok(avec.scenes[0].voix.endsWith("Promesse solide… ou poudre de Perlimpinpin ?"));
  assert.match(avec.scenes[1].voix, /On a fouillé\. Verdict dans une minute\./);
  assert.match(avec.scenes[7].voix, /^Le moment de vérité\. Chez Perlimpinpin, chaque promesse est notée sur cent\. Ici, trente-huit sur cent\./);
  assert.match(avec.scenes[7].sousTitres, /notée sur 100\. Ici, 38 sur 100\./);
  assert.equal(avec.scenes[8].voix, VARIANTES.appel[3].voix);
  assert.equal(avec.scenes[8].ecran.titre, "D’accord avec cette note ?");
  // Reel plus ancien, sans variantes : la variante 0 (texte d'origine).
  const sans = assemblerReel(VARIABLES_EXEMPLE, { candidatNom: CANDIDAT_EXEMPLE, score: 38 });
  assert.ok(sans.scenes[0].voix.endsWith(textesVariantes().signature));
});

// --- Relances et couverture --------------------------------------------------------

test("relances des 3 derniers Reels et consignes envoyées au modèle", () => {
  const reels = [{ texteVoix: "Sauf que voilà. Le prix grimpe." }, { texteVoix: "Et là, ça coince ! Vous voyez le problème ?" }, null];
  assert.deepEqual(relancesUtilisees(reels), ["Sauf que voilà", "Et là, ça coince", "Vous voyez le problème ?"]);
  // « Le hic » au milieu d'un mot ne compte pas.
  assert.deepEqual(relancesUtilisees([{ texteVoix: "Le hicotin." }]), []);
  const consignes = consignesAntiRepetition({ relances: ["Sauf que voilà"], questionCouverture: "Qui paie ?" });
  assert.match(consignes, /^À NE PAS REPRENDRE/);
  assert.match(consignes, /« Sauf que voilà »/);
  assert.match(consignes, /« Qui paie \? »/);
  assert.equal(consignesAntiRepetition({}), "");
});

test("question de couverture : liste fermée, différente du Reel précédent", () => {
  assert.equal(QUESTIONS_COUVERTURE.length, 6);
  for (const q of QUESTIONS_COUVERTURE) assert.ok(q.split(" ").length <= 4, q);
  assert.deepEqual(questionCouverture("Ça tient ?", { precedente: "Qui paie ?" }), { question: "Ça tient ?", remplacee: false });
  const remplacee = questionCouverture("Qui paie ?", { precedente: "Qui paie ?", alea: alea(0.99) });
  assert.notEqual(remplacee.question, "Qui paie ?");
  assert.ok(QUESTIONS_COUVERTURE.includes(remplacee.question));
  // Pas de question du modèle : tirée par le code.
  assert.ok(QUESTIONS_COUVERTURE.includes(questionCouverture("", { alea: alea(0.5) }).question));
  // Reel plus ancien : toujours la même pour un même titre.
  assert.equal(questionCouvertureParDefaut("Retraites"), questionCouvertureParDefaut("Retraites"));
});

// --- Animations ------------------------------------------------------------------------

function scenesExemple(variables = VARIABLES_EXEMPLE) {
  return assemblerReel(variables, { candidatNom: CANDIDAT_EXEMPLE, score: SCORE_EXEMPLE }).scenes;
}

test("éléments (calques) de chaque scène", () => {
  const scenes = scenesExemple();
  assert.deepEqual(elementsScene(scenes[0]), ["icone", "texte", "chiffre"]);
  assert.deepEqual(elementsScene(scenes[1]), ["texte"]);
  assert.deepEqual(elementsScene(scenes[1], { portrait: true }), ["icone", "texte"]);
  assert.deepEqual(elementsScene(scenes[2]), ["icone", "texte"]);
  assert.deepEqual(elementsScene(scenes[3]), ["icone", "texte", "chiffre"]);
  assert.deepEqual(elementsScene(scenes[7]), ["texte", "chiffre"]);
  assert.deepEqual(elementsScene(scenes[8]), ["icone", "texte"]);
});

test("animations : règles imposées par le code", () => {
  const scenes = scenesExemple();
  // Scène 1 : le titre d'abord, en zoom-impact (même si le modèle a dit autre chose).
  assert.deepEqual(scenes[0].animation.entrees[0], { element: "texte", effet: "zoom-impact" });
  // Verdict : le score en compteur, puis la grille.
  assert.deepEqual(scenes[7].animation.entrees[0], { element: "chiffre", effet: "compteur" });
  assert.equal(scenes[7].animation.grille, true);
  // Dernière scène : extinction d'écran, et seulement elle.
  assert.equal(scenes[8].animation.transition, "extinction-ecran");
  assert.ok(scenes.slice(0, 8).every((s) => s.animation.transition !== "extinction-ecran"));
  // Jamais deux fois la même transition à la suite.
  for (let i = 1; i < scenes.length; i++) assert.notEqual(scenes[i].animation.transition, scenes[i - 1].animation.transition);
  // Chaque élément présent a une entrée.
  for (const s of scenes) assert.deepEqual(s.animation.entrees.map((e) => e.element).sort(), elementsScene(s).sort());
});

test("animations : corrections (doublon, compteur hors chiffre, extinction trop tôt, rien de choisi)", () => {
  const brut = (id, numero, animationModele, ecran = {}) => ({ id, numero, ecran, icone: "pompe", animationModele });
  const { animations, corrections } = animationsReel([
    brut("tient", 3, { entrees: [{ element: "icone", effet: "compteur" }], transition: "coupe-glitch" }),
    brut("hic", 4, { entrees: [], transition: "coupe-glitch" }, { chiffre: "12 Md€" }),
    brut("preuve", 5, { transition: "extinction-ecran" }),
    brut("nuance", 6, null),
    brut("appel", 9, { transition: "coupe-seche" }),
  ]);
  assert.deepEqual(animations[0].entrees[0], { element: "icone", effet: "pop-rebond" });
  assert.notEqual(animations[1].transition, "coupe-glitch");
  assert.notEqual(animations[2].transition, "extinction-ecran");
  assert.ok(animations[3].transition);
  assert.equal(animations[4].transition, "extinction-ecran");
  assert.equal(corrections.length, 3);
});

test("refus : entrée, transition, élément ou son hors des listes fermées", () => {
  const erreurs = erreursMontage("hic", {
    animation: { entrees: [{ element: "fond", effet: "fondu" }], transition: "fondu-enchaine" },
    son: { nom: "trompette", moment: "fin" },
  });
  assert.equal(erreurs.length, 5);
  assert.deepEqual(erreursMontage("hic", { animation: { entrees: [{ element: "chiffre", effet: "compteur" }], transition: "coupe-seche" }, son: { nom: "impact", moment: "chiffre" } }), []);
});

// --- Sons ---------------------------------------------------------------------------------

test("sons : jingle-score imposé au verdict, 6 au plus, un par scène", () => {
  const scenes = scenesExemple();
  assert.deepEqual(scenes[7].son, { nom: "jingle-score", moment: "score" });
  assert.ok(scenes.filter((s) => s.son).length <= SONS_MAX);

  const brut = (id, numero, sonModele, ecran = {}) => ({ id, numero, ecran, sonModele });
  const { sons, corrections } = sonsReel([
    brut("accroche", 1, { nom: "jingle-score", moment: "entree" }),
    brut("presentation", 2, { nom: "blip", moment: "chiffre" }),
    ...[3, 4, 5, 6, 7].map((n) => brut("hic", n, { nom: "impact", moment: "chiffre" }, { chiffre: "1" })),
    brut("verdict", 8, null),
    brut("appel", 9, { nom: "whoosh", moment: "transition" }),
  ]);
  assert.equal(sons[0], null); // jingle hors verdict
  assert.deepEqual(sons[1], { nom: "blip", moment: "entree" }); // pas de chiffre dans la scène
  assert.equal(sons.filter(Boolean).length, SONS_MAX);
  assert.deepEqual(sons[7], { nom: "jingle-score", moment: "score" });
  assert.equal(sons[8], null);
  assert.equal(corrections.length, 3); // jingle hors verdict, 6e impact, whoosh de trop
});

// --- Plan de montage -----------------------------------------------------------------

test("montage en phrases simples pour Matis", () => {
  const scenes = assemblerReel(VARIABLES_EXEMPLE, { candidatNom: CANDIDAT_EXEMPLE, score: SCORE_EXEMPLE }).scenes;
  assert.equal(
    montageScene(scenes[5]).resume,
    "Le chiffre 12 Md€ défile comme un compteur, puis l'icône apparaît avec un petit rebond, puis la légende s'écrit lettre par lettre. Transition : coupe sèche. Son : piece (quand le chiffre arrive).",
  );
  assert.equal(montageScene(scenes[5]).son, "piece.wav, quand le chiffre arrive, à mettre nettement sous la voix");
  assert.match(montageScene(scenes[7]).resume, /^Le score défile comme un compteur jusqu'à 38, et la grille s'allume case par case, puis le palier/);
  assert.match(montageScene(scenes[8]).resume, /^Les icônes apparaissent avec un petit rebond/);
  assert.match(montageScene(scenes[8]).resume, /Transition : extinction d'écran \(fin de la vidéo\)\. Son : aucun\.$/);
});

// --- Contrôle et stockage --------------------------------------------------------------

const FICHE = { titre_fiche: "Carburant à 1,70 €", verdict_final: "Coût de 12 milliards par an." };

function reponse() {
  // Copie profonde : les tests modifient la réponse, jamais l'exemple partagé.
  const scenes = structuredClone(Object.entries(VARIABLES_EXEMPLE).map(([id, v]) => ({ id, ...v })));
  // Pas de nombre absent de la fiche dans l'exemple.
  scenes.find((s) => s.id === "facture").ecran = { chiffre: "12 Md€", legende: "par an" };
  return { scenes, couverture: { titre: "Le carburant à 1,70 €", question: "Ça tient ?" } };
}
const CONTEXTE = { ficheFinale: FICHE, candidatNom: "Candidat", score: 38 };

test("contrôle : question au spectateur de la scène 1 (avertissements)", () => {
  assert.equal(derniereQuestion("Bloquer le prix. Vous feriez le plein plus souvent ?"), "Vous feriez le plein plus souvent ?");
  assert.equal(derniereQuestion("Pas de question."), "");

  const ok = controlerReel(reponse(), CONTEXTE);
  assert.equal(ok.valide, true, ok.erreurs.join(" | "));
  assert.ok(!ok.avertissements.some((a) => /accroche/.test(a)), ok.avertissements.join(" | "));

  const sansVous = reponse();
  sansVous.scenes[0].sousTitres = "Bloquer le prix à 1,70 €. Les gens feraient le plein plus souvent ?";
  assert.ok(controlerReel(sansVous, CONTEXTE).avertissements.some((a) => /pas de « vous »/.test(a)));

  const longue = reponse();
  longue.scenes[0].sousTitres = "Bloquer le prix à 1,70 €. Vous feriez le plein beaucoup plus souvent si le prix restait bloqué toute l'année ?";
  assert.ok(controlerReel(longue, CONTEXTE).avertissements.some((a) => /question trop longue \(14 mots/.test(a)));

  const sansQuestion = reponse();
  sansQuestion.scenes[0].sousTitres = "Bloquer le prix à 1,70 €.";
  assert.ok(controlerReel(sansQuestion, CONTEXTE).avertissements.some((a) => /pas de question au spectateur/.test(a)));
});

test("contrôle : couverture (question hors liste refusée, titre long averti, même question remplacée)", () => {
  const horsListe = reponse();
  horsListe.couverture.question = "C'est du flan ?";
  const refus = controlerReel(horsListe, CONTEXTE);
  assert.equal(refus.valide, false);
  assert.match(refus.erreurs.join(" "), /question « C'est du flan \? » hors de la liste fermée/);

  const long = reponse();
  long.couverture.titre = "Bloquer le prix du carburant à la pompe pour tout le monde";
  assert.ok(controlerReel(long, CONTEXTE).avertissements.some((a) => /Couverture : titre trop long \(12 mots/.test(a)));

  const meme = controlerReel(reponse(), { ...CONTEXTE, precedent: { couverture: { question: "Ça tient ?" } }, alea: alea(0) });
  assert.notEqual(meme.couverture.question, "Ça tient ?");
  assert.ok(meme.avertissements.some((a) => /déjà prise par un Reel précédent/.test(a)));

  const transitionInconnue = reponse();
  transitionInconnue.scenes[2].animation.transition = "fondu";
  assert.equal(controlerReel(transitionInconnue, CONTEXTE).valide, false);
});

test("contrôle : avertissement de variabilité face au dernier Reel", () => {
  const premier = controlerReel(reponse(), { ...CONTEXTE, variantes: { signature: 0, presentation: 0, verdict: 0, appel: 0 } });
  const second = controlerReel(reponse(), {
    ...CONTEXTE,
    variantes: { signature: 0, presentation: 0, verdict: 0, appel: 0 },
    precedent: { texteVoix: premier.assemble.texteVoix },
  });
  assert.ok(second.avertissements.some((a) => /trop proche du dernier Reel/.test(a)));
});

test("stockage : couverture et variantes gardées, réassemblage identique", () => {
  const controle = controlerReel(reponse(), { ...CONTEXTE, variantes: VARIANTES_EXEMPLE });
  const reel = JSON.parse(JSON.stringify(reelPourStockage(controle, { candidatNom: "Candidat", score: 38 })));
  assert.deepEqual(reel.couverture, { titre: "Le carburant à 1,70 €", question: "Ça tient ?" });
  assert.deepEqual(reel.variantes, VARIANTES_EXEMPLE);
  assert.ok(reel.scenes[0].animation && reel.scenes[0].son);
  const rejoue = assemblerDepuisReel(reel, { candidatNom: "Candidat", score: 38 });
  assert.equal(rejoue.texteVoix, controle.assemble.texteVoix);
  assert.deepEqual(rejoue.couverture, controle.assemble.couverture);
  assert.deepEqual(
    rejoue.scenes.map((s) => s.animation),
    controle.assemble.scenes.map((s) => s.animation),
  );
});

test("Reel généré avant ces règles : animations, sons et couverture par défaut", () => {
  const ancien = {
    scenes: Object.entries(VARIABLES_EXEMPLE).map(([id, { animation: _a, son: _s, ...v }]) => ({ id, ...v })),
  };
  const a = assemblerDepuisReel(ancien, { candidatNom: "Candidat", score: 38 });
  assert.equal(a.scenes[8].animation.transition, "extinction-ecran");
  assert.deepEqual(a.scenes[7].son, { nom: "jingle-score", moment: "score" });
  assert.equal(a.couverture.titre, COUVERTURE_EXEMPLE.titre.replace("à 1,70 €", "à la pompe"));
  assert.ok(QUESTIONS_COUVERTURE.includes(a.couverture.question));
});

test("génération : consignes « à ne pas reprendre » et variantes différentes du dernier Reel", async () => {
  const messages = [];
  const precedent = { texteVoix: "Sauf que voilà.", couverture: { question: "Ça tient ?" }, variantes: { signature: 0, presentation: 0, verdict: 0, appel: 0 } };
  const r = await genererReelCore({
    ficheFinale: FICHE,
    candidatNom: "Candidat",
    score: 38,
    prompt: "PROMPT",
    precedents: [precedent],
    alea: alea(0),
    appeler: async (message) => {
      messages.push(message);
      return { texte: JSON.stringify(reponse()), usage: {} };
    },
    analyser: (rep) => JSON.parse(rep.texte),
    journal: { warn() {}, error() {} },
  });
  assert.match(messages[0], /À NE PAS REPRENDRE[\s\S]*« Sauf que voilà »[\s\S]*« Ça tient \? »[\s\S]*FICHE FINALE/);
  assert.ok(r.reel);
  for (const cle of ["signature", "presentation", "verdict", "appel"]) assert.notEqual(r.reel.variantes[cle], 0);
  assert.notEqual(r.reel.couverture.question, "Ça tient ?");
});

// --- Générer à nouveau ------------------------------------------------------------

test("générer à nouveau : variantes et question différentes de l'ancien Reel de la fiche ET du dernier Reel", async () => {
  // Ancien Reel de la fiche, généré avant les variantes et la couverture :
  // variante 0 partout, question par défaut tirée de son titre.
  const ancienDeLaFiche = {
    genereLe: "2026-11-17T10:00:00Z",
    texteVoix: "Ancien texte.",
    scenes: [{ id: "accroche", ecran: { titre: "Le carburant bloqué à la pompe" } }],
  };
  const questionAncienne = questionCouvertureParDefaut("Le carburant bloqué à la pompe");
  const dernierDuSite = {
    genereLe: "2026-11-17T14:00:00Z",
    texteVoix: "Autre fiche.",
    couverture: { question: QUESTIONS_COUVERTURE.find((q) => q !== questionAncienne) },
    variantes: { signature: 1, presentation: 1, verdict: 1, appel: 1 },
  };
  for (const valeur of [0, 0.5, 0.99]) {
    const r = await genererReelCore({
      ficheFinale: FICHE,
      candidatNom: "Candidat",
      score: 38,
      prompt: "PROMPT",
      precedents: [ancienDeLaFiche, dernierDuSite],
      alea: alea(valeur),
      appeler: async () => ({ texte: JSON.stringify({ ...reponse(), couverture: { titre: "Le carburant à 1,70 €" } }), usage: {} }),
      analyser: (rep) => JSON.parse(rep.texte),
      journal: { warn() {}, error() {} },
    });
    assert.ok(r.reel, `alea ${valeur}`);
    for (const cle of ["signature", "presentation", "verdict", "appel"]) {
      assert.ok(![0, 1].includes(r.reel.variantes[cle]), `${cle} = ${r.reel.variantes[cle]} (alea ${valeur})`);
    }
    assert.notEqual(r.reel.couverture.question, questionAncienne);
    assert.notEqual(r.reel.couverture.question, dernierDuSite.couverture.question);
  }
});

test("Reels à ne pas imiter : l'ancien de la fiche d'abord, sans doublon", async () => {
  const { precedentsPourFiche } = await import("../src/lib/reel-generation.js");
  const a = { genereLe: "1" };
  const b = { genereLe: "2" };
  assert.deepEqual(precedentsPourFiche(a, [a, b]), [a, b]);
  assert.deepEqual(precedentsPourFiche(null, [b]), [b]);
  assert.deepEqual(precedentsPourFiche(undefined, undefined), []);
});
