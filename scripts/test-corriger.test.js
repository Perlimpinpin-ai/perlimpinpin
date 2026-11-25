import test from "node:test";
import assert from "node:assert/strict";
import {
  MESSAGE_ANNOTATION,
  MESSAGE_TROP_IMPORTANTE,
  champCorrigeable,
  corrigerCoquilleCore,
  distanceEdition,
  dossiersDeLaFiche,
  estUneCoquille,
} from "../src/lib/test-corriger.js";
import { CHAMPS_EDITABLES } from "../src/lib/test-edition.js";

// Correction de coquille d'une fiche PUBLIÉE, testée avec une FAUSSE base : aucune
// connexion réelle. Les méthodes d'écriture plantent si elles sont appelées alors
// qu'elles ne devraient pas l'être (simulation, refus).

const VERSION = "2026-11-10T10:00:00.000Z";
const MAINTENANT = new Date("2026-11-16T12:00:00.000Z");
const RESUME =
  "Le candidat propose de baisser la TVA sur les produits de première nécessité. La mesure couterait environ 12 milliards d'euros par an.";
const RESUME_CORRIGE = RESUME.replace("couterait", "coûterait");
const CONTENU = {
  titre_fiche: "Baisse de la TVA sur les produits de premiere nécessité",
  resume_court: RESUME,
  notation_detaillee: { operationnalite_moyens_total: 18 },
  verdict_final: "Une mesure **coûteuse** et peu ciblée, dont le financement reste flou.",
  contexte_national: {
    synthese: "La TVA rapporte 200 milliards.",
    texte: "La TVA rapporte environ 200 milliards d'euros par an à l'État, soit la première recette fiscale.",
  },
};
const ANALYSE = {
  id: 7,
  statut: "publie",
  updatedAt: new Date(VERSION),
  propositionId: 70,
  contenuComplet: CONTENU,
  proposition: { candidatId: 3 },
};

function fausseBase({
  analyse = ANALYSE,
  annotations = [],
  count = 1,
  ecrituresAutorisees = false,
  echecTransaction = null,
} = {}) {
  const journal = [];
  const appels = [];
  const ecriture = (nom, valeur) => async (args) => {
    journal.push(nom);
    appels.push([nom, args]);
    if (!ecrituresAutorisees) throw new Error(`ÉCRITURE INTERDITE : ${nom}`);
    return typeof valeur === "function" ? valeur(args) : valeur;
  };
  const lecture = (nom, valeur) => async (args) => {
    journal.push(nom);
    appels.push([nom, args]);
    return typeof valeur === "function" ? valeur(args) : valeur;
  };
  const tx = {
    analyse: { updateMany: ecriture("tx.analyse.updateMany", { count }) },
    proposition: { update: ecriture("tx.proposition.update", {}) },
  };
  const prisma = {
    analyse: {
      findUnique: lecture("analyse.findUnique", analyse),
      update: ecriture("analyse.update", {}),
      updateMany: ecriture("analyse.updateMany", {}),
    },
    proposition: { update: ecriture("proposition.update", {}) },
    relectureComment: { findMany: lecture("relectureComment.findMany", annotations) },
    $transaction: async (fn) => {
      journal.push("$transaction");
      if (echecTransaction) throw echecTransaction;
      return fn(tx);
    },
  };
  return { prisma, journal, appels };
}

const editeur = async () => true;
const pasEditeur = async () => false;
const options = (prisma, dryRun = false) => ({ isEditor: editeur, prisma, dryRun, maintenant: () => MAINTENANT });
const entree = (surcharge = {}) => ({
  analyseId: 7,
  champ: "resume_court",
  valeur: RESUME_CORRIGE,
  versionAttendue: VERSION,
  ...surcharge,
});

test("accès refusé sans éditeur : « Non autorisé. » et la base n'est même pas consultée", async () => {
  for (const dryRun of [false, true]) {
    const { prisma, journal } = fausseBase({ ecrituresAutorisees: true });
    const resultat = await corrigerCoquilleCore(entree(), { isEditor: pasEditeur, prisma, dryRun });
    assert.deepEqual(resultat, { ok: false, message: "Non autorisé." });
    assert.deepEqual(journal, []);
  }
  const { prisma, journal } = fausseBase({ ecrituresAutorisees: true });
  assert.equal((await corrigerCoquilleCore(undefined, { isEditor: pasEditeur, prisma, dryRun: false })).message, "Non autorisé.");
  assert.deepEqual(journal, []);
});

test("refus sur un brouillon, une analyse à la corbeille ou une version remplacée", async () => {
  for (const statut of ["brouillon", "corbeille", "remplacee"]) {
    for (const dryRun of [false, true]) {
      const { prisma, journal } = fausseBase({ analyse: { ...ANALYSE, statut } });
      const resultat = await corrigerCoquilleCore(entree(), options(prisma, dryRun));
      assert.equal(resultat.ok, false, statut);
      assert.match(resultat.message, /pas une fiche publiée/, statut);
      assert.ok(!journal.includes("$transaction"), statut);
    }
  }
  const { prisma } = fausseBase({ analyse: null });
  assert.match((await corrigerCoquilleCore(entree(), options(prisma))).message, /introuvable/i);
});

test("refus d'un champ de notation : jamais par cette voie, sans toucher la base", async () => {
  for (const champ of ["notation_detaillee", "scoreFaisabilite", "score", "qualification_juridique", "appreciation", "niveau_de_confiance", "mesure_vers_objectif.categorie_objectif"]) {
    const { prisma, journal } = fausseBase({ ecrituresAutorisees: true });
    const resultat = await corrigerCoquilleCore(entree({ champ, valeur: "Élevé. Texte de remplacement." }), options(prisma));
    assert.equal(resultat.ok, false, champ);
    assert.match(resultat.message, /notation/, champ);
    assert.deepEqual(journal, [], champ);
  }
});

test("refus de « Mesure initiale » et de « Thématique » (colonnes partagées de la proposition)", async () => {
  for (const champ of ["proposition.texteOriginal", "proposition.theme"]) {
    const { prisma, journal } = fausseBase({ ecrituresAutorisees: true });
    const resultat = await corrigerCoquilleCore(entree({ champ, valeur: "Baisser la TVA sur les produits." }), options(prisma));
    assert.equal(resultat.ok, false, champ);
    assert.match(resultat.message, /partagée par toutes les versions/, champ);
    assert.deepEqual(journal, [], champ);
  }
  assert.equal(champCorrigeable("proposition.texteOriginal"), false);
});

test("les champs corrigeables sont les champs de texte des brouillons, sans colonne ni liste déroulante", () => {
  for (const [champ, regles] of Object.entries(CHAMPS_EDITABLES)) {
    const attendu = !regles.colonneProposition && regles.type !== "choix" && champ !== "niveau_de_confiance";
    assert.equal(champCorrigeable(champ), attendu, champ);
  }
  assert.equal(champCorrigeable("constructor"), false);
  assert.equal(champCorrigeable("__proto__"), false);
});

test("même validation que pour un brouillon (validerTexte)", async () => {
  const cas = [
    [entree({ valeur: "" }), /vide/],
    [entree({ valeur: 42 }), /invalide/],
    [entree({ valeur: `${RESUME_CORRIGE} **gras` }), /\*\*/],
    [entree({ champ: "titre_fiche", valeur: "Deux\nlignes" }), /seule ligne/],
  ];
  for (const [saisie, attendu] of cas) {
    const { prisma, journal } = fausseBase();
    const resultat = await corrigerCoquilleCore(saisie, options(prisma));
    assert.equal(resultat.ok, false);
    assert.match(resultat.message, attendu);
    assert.ok(!journal.includes("$transaction"));
  }
});

test("refus d'une modification trop importante, avec le message prévu", async () => {
  const nouveauFond =
    "Le candidat propose de supprimer la TVA sur l'alimentation. Le coût serait de 40 milliards d'euros par an, financé par la dette.";
  for (const dryRun of [false, true]) {
    const { prisma, journal } = fausseBase();
    const resultat = await corrigerCoquilleCore(entree({ valeur: nouveauFond }), options(prisma, dryRun));
    assert.deepEqual(resultat, { ok: false, message: MESSAGE_TROP_IMPORTANTE });
    assert.ok(!journal.includes("$transaction"));
  }
});

test("garde-fou coquille : 20 caractères ou 10 % du texte d'origine, sans compter le gras", () => {
  // Texte court : le seuil de 20 caractères s'applique.
  assert.equal(estUneCoquille("abc", "abc" + "x".repeat(20)).ok, true);
  assert.equal(estUneCoquille("abc", "abc" + "x".repeat(21)).ok, false);
  // Texte de 1 000 caractères : 10 %, soit 100.
  const long = "a".repeat(1000);
  assert.equal(estUneCoquille(long, long.slice(0, 900)).ok, true);
  assert.equal(estUneCoquille(long, long.slice(0, 899)).ok, false);
  // Ajouter ou retirer du gras ne compte pas.
  assert.deepEqual(estUneCoquille("un mot important", "un **mot** important").distance, 0);
  // Listes : comparées ligne à ligne.
  assert.equal(estUneCoquille(["Premier point", "Second point"], ["Premier point", "Second poin"]).distance, 1);
});

test("distanceEdition bornée : identique à Levenshtein classique sous le plafond", () => {
  const levenshtein = (a, b) => {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
    }
    return d[a.length][b.length];
  };
  let graine = 42;
  const hasard = () => ((graine = (graine * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  const mot = () => Array.from({ length: Math.floor(hasard() * 25) }, () => "abcé "[Math.floor(hasard() * 5)]).join("");
  for (let n = 0; n < 400; n++) {
    const a = mot();
    const b = mot();
    const exacte = levenshtein(a, b);
    assert.equal(distanceEdition(a, b), exacte, `${a} / ${b}`);
    for (const plafond of [0, 1, 3, 8]) {
      assert.equal(distanceEdition(a, b, plafond), Math.min(exacte, plafond + 1), `${a} / ${b} / ${plafond}`);
    }
  }
  // Deux coquilles aux deux bouts d'un très long texte : rapide et exact.
  const long = "x".repeat(12000);
  assert.equal(distanceEdition(`a${long}b`, `c${long}d`, 1200), 2);
});

test("acceptation d'une coquille : le texte corrigé est écrit, avec la version attendue comme verrou", async () => {
  const { prisma, appels } = fausseBase({ ecrituresAutorisees: true });
  const resultat = await corrigerCoquilleCore(entree(), options(prisma));
  assert.equal(resultat.ok, true);
  assert.equal(resultat.simulation, false);
  assert.equal(resultat.avant, RESUME);
  assert.equal(resultat.apres, RESUME_CORRIGE);
  assert.equal(resultat.propositionId, 70);
  assert.equal(resultat.candidatId, 3);
  assert.equal(resultat.versionSuivante, MAINTENANT.toISOString());

  const [, args] = appels.find(([nom]) => nom === "tx.analyse.updateMany");
  assert.deepEqual(args.where, { id: 7, statut: "publie", updatedAt: new Date(VERSION) });
  assert.equal(args.data.contenuComplet.resume_court, RESUME_CORRIGE);
  assert.equal(args.data.teaser, RESUME_CORRIGE);
  // Ni score ni notation : rien d'autre que le texte et ses colonnes dérivées.
  assert.deepEqual(Object.keys(args.data).sort(), ["contenuComplet", "teaser", "updatedAt"]);
  assert.deepEqual(args.data.contenuComplet.notation_detaillee, CONTENU.notation_detaillee);
  // L'objet lu en base n'est pas modifié.
  assert.equal(CONTENU.resume_court, RESUME);
  assert.equal(CONTENU.corrections_coquilles, undefined);
});

test("correction du titre : Proposition.titre suit, dans la même transaction", async () => {
  const { prisma, journal, appels } = fausseBase({ ecrituresAutorisees: true });
  const titre = "Baisse de la TVA sur les produits de première nécessité";
  const resultat = await corrigerCoquilleCore(entree({ champ: "titre_fiche", valeur: titre }), options(prisma));
  assert.equal(resultat.ok, true);
  assert.deepEqual(journal.slice(-3), ["$transaction", "tx.analyse.updateMany", "tx.proposition.update"]);
  const [, args] = appels.find(([nom]) => nom === "tx.proposition.update");
  assert.deepEqual(args, { where: { id: 70 }, data: { titre } });
});

test("trace ajoutée dans corrections_coquilles, à la suite des précédentes", async () => {
  const ancienne = { date: "2026-11-12T08:00:00.000Z", champ: "titre_fiche", avant: "a", apres: "b" };
  const analyse = { ...ANALYSE, contenuComplet: { ...CONTENU, corrections_coquilles: [ancienne] } };
  const { prisma, appels } = fausseBase({ analyse, ecrituresAutorisees: true });
  const resultat = await corrigerCoquilleCore(entree(), options(prisma));
  assert.equal(resultat.ok, true);
  const [, args] = appels.find(([nom]) => nom === "tx.analyse.updateMany");
  assert.deepEqual(args.data.contenuComplet.corrections_coquilles, [
    ancienne,
    { date: MAINTENANT.toISOString(), champ: "resume_court", avant: RESUME, apres: RESUME_CORRIGE },
  ]);

  // Première correction d'une fiche : le tableau est créé.
  const second = fausseBase({ ecrituresAutorisees: true });
  await corrigerCoquilleCore(entree(), options(second.prisma));
  const [, args2] = second.appels.find(([nom]) => nom === "tx.analyse.updateMany");
  assert.equal(args2.data.contenuComplet.corrections_coquilles.length, 1);
});

test("conflit de version : refus avant écriture, ou dans la transaction si quelqu'un passe entre-temps", async () => {
  for (const dryRun of [false, true]) {
    const { prisma, journal } = fausseBase();
    const resultat = await corrigerCoquilleCore(entree({ versionAttendue: "2026-11-09T10:00:00.000Z" }), options(prisma, dryRun));
    assert.equal(resultat.ok, false);
    assert.match(resultat.message, /modifiée entre-temps/);
    assert.ok(!journal.includes("$transaction"));
  }
  const { prisma } = fausseBase({ ecrituresAutorisees: true, count: 0 });
  const resultat = await corrigerCoquilleCore(entree(), options(prisma));
  assert.equal(resultat.ok, false);
  assert.match(resultat.message, /modifiée entre-temps/);

  const { prisma: p3 } = fausseBase({ ecrituresAutorisees: true, echecTransaction: new Error("réseau") });
  assert.match((await corrigerCoquilleCore(entree(), options(p3))).message, /rien n'a été modifié/);
});

test("simulation : tout est contrôlé, rien n'est écrit", async () => {
  const { prisma, journal } = fausseBase();
  const resultat = await corrigerCoquilleCore(entree(), options(prisma, true));
  assert.equal(resultat.ok, true);
  assert.equal(resultat.simulation, true);
  assert.match(resultat.message, /\[Simulation\]/);
  assert.ok(!journal.includes("$transaction"));
});

test("annotation du Club dont le passage disparaît : confirmation demandée, puis acceptée", async () => {
  const annotation = { id: "c1", sectionId: "resume_court", quotedText: "couterait environ 12 milliards", traitements: [] };
  const { prisma, journal } = fausseBase({ annotations: [annotation] });
  const resultat = await corrigerCoquilleCore(entree(), options(prisma));
  assert.deepEqual(resultat, { ok: false, confirmation: true, annotations: 1, message: MESSAGE_ANNOTATION });
  assert.ok(!journal.includes("$transaction"));

  const confirme = fausseBase({ annotations: [annotation], ecrituresAutorisees: true });
  const ok = await corrigerCoquilleCore(entree({ confirmerAnnotations: true }), options(confirme.prisma));
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.annotationsDecrochees, ["c1"]);
});

test("annotations sans effet : passage intact, autre bloc, close ou déjà décrochée → pas de confirmation", async () => {
  const annotations = [
    { id: "intact", sectionId: "resume_court", quotedText: "baisser la TVA", traitements: [] },
    { id: "autre", sectionId: "contexte_national", quotedText: "couterait", traitements: [] },
    { id: "close", sectionId: "resume_court", quotedText: "couterait", traitements: [{ id: 1, etat: "traitee", createdAt: "2026-11-01" }] },
    {
      id: "bloc",
      sectionId: "resume_court",
      quotedText: "couterait",
      traitements: [{ id: 2, etat: "reaccrochee", rattachement: "section", createdAt: "2026-11-01" }],
    },
  ];
  const { prisma } = fausseBase({ annotations, ecrituresAutorisees: true });
  const resultat = await corrigerCoquilleCore(entree(), options(prisma));
  assert.equal(resultat.ok, true);
  assert.deepEqual(resultat.annotationsDecrochees, []);
});

test("dossiersDeLaFiche : ficheId, propositionId, jeton {note:id} ou lien /declarations/id", () => {
  const dossiers = [
    { slug: "a", propositions: [{ ficheId: 70 }] },
    { slug: "b", fiches: [{ propositionId: 70 }] },
    { slug: "c", texte: ["Voir {note:70}."] },
    { slug: "d", lien: "/declarations/70" },
    { slug: "e", lien: "/declarations/701", fiches: [{ ficheId: 7 }] },
  ];
  assert.deepEqual(dossiersDeLaFiche(dossiers, 70), ["a", "b", "c", "d"]);
});
