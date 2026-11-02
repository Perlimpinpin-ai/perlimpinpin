import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { enregistrerTexteCore } from "../src/lib/test-enregistrer.js";
import { truncateTeaser } from "../src/lib/test-edition.js";

// Action « Enregistrer » d'un texte modifié, testée avec une FAUSSE base : aucune
// connexion réelle. Les méthodes d'écriture plantent si elles sont appelées alors
// qu'elles ne devraient pas l'être (simulation, refus).

const VERSION = "2026-09-21T10:00:00.000Z";
const CONTENU = {
  titre_fiche: "Titre d'origine de la fiche",
  resume_court: "Résumé d'origine, assez long pour être valide.",
  notation_detaillee: { solidite_faits_total: 21 },
  verdict_final: "Verdict.",
};
const ANALYSE = {
  id: 7,
  statut: "brouillon",
  updatedAt: new Date(VERSION),
  propositionId: 70,
  contenuComplet: CONTENU,
};
const RESUME_VALIDE = "Un nouveau résumé, assez long pour être valide.";

function fausseBase({
  analyse = ANALYSE,
  plusRecenteId = analyse?.id,
  publieeId = null,
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
    return typeof valeur === "function" ? valeur(args) : valeur;
  };
  const tx = {
    analyse: { updateMany: ecriture("tx.analyse.updateMany", { count }) },
    proposition: { update: ecriture("tx.proposition.update", {}) },
  };
  const prisma = {
    analyse: {
      findUnique: lecture("analyse.findUnique", analyse),
      // Recherche d'une version publiée de la mesure, ou de l'analyse la plus récente.
      findFirst: lecture("analyse.findFirst", (args) =>
        args?.where?.statut === "publie" ? (publieeId ? { id: publieeId } : null) : { id: plusRecenteId },
      ),
      update: ecriture("analyse.update", {}),
      updateMany: ecriture("analyse.updateMany", {}),
    },
    proposition: { update: ecriture("proposition.update", {}) },
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
const entree = (surcharge = {}) => ({
  analyseId: 7,
  champ: "resume_court",
  valeur: RESUME_VALIDE,
  versionAttendue: VERSION,
  ...surcharge,
});

test("sans cookie valide : « Non autorisé. » et la base n'est même pas consultée", async () => {
  for (const dryRun of [false, true]) {
    const { prisma, journal } = fausseBase({ ecrituresAutorisees: true });
    const resultat = await enregistrerTexteCore(entree(), { isEditor: pasEditeur, prisma, dryRun });
    assert.deepEqual(resultat, { ok: false, message: "Non autorisé." });
    assert.deepEqual(journal, []);
  }
  // Même avec une entrée absente ou incohérente : l'accès est contrôlé en premier.
  const { prisma, journal } = fausseBase({ ecrituresAutorisees: true });
  assert.equal((await enregistrerTexteCore(undefined, { isEditor: pasEditeur, prisma, dryRun: false })).message, "Non autorisé.");
  assert.deepEqual(journal, []);
});

test("entrée invalide venue du navigateur : refusée sans toucher la base", async () => {
  const cas = [
    [undefined, /introuvable/],
    [null, /introuvable/],
    [entree({ analyseId: "7" }), /introuvable/],
    [entree({ analyseId: 0 }), /introuvable/],
    [entree({ analyseId: 1.5 }), /introuvable/],
    [entree({ versionAttendue: undefined }), /Version du brouillon invalide/],
    [entree({ versionAttendue: "pas une date" }), /Version du brouillon invalide/],
    [entree({ versionAttendue: 123 }), /Version du brouillon invalide/],
    [entree({ champ: "notation_detaillee" }), /ne peut pas être modifié/],
    [entree({ champ: "scoreFaisabilite" }), /ne peut pas être modifié/],
    [entree({ valeur: "" }), /vide/],
    [entree({ valeur: 42 }), /invalide/],
    [entree({ valeur: "Un résumé avec **un gras jamais fermé, assez long." }), /\*\*/],
    [entree({ champ: "titre_fiche", valeur: "Deux\nlignes" }), /seule ligne/],
  ];
  for (const [saisie, attendu] of cas) {
    const { prisma, journal } = fausseBase({ ecrituresAutorisees: true });
    const resultat = await enregistrerTexteCore(saisie, { isEditor: editeur, prisma, dryRun: false });
    assert.equal(resultat.ok, false, JSON.stringify(saisie));
    assert.match(resultat.message, attendu, JSON.stringify(saisie));
    assert.deepEqual(journal, [], JSON.stringify(saisie));
  }
});

test("analyse inexistante, publiée, ou pas la plus récente : refus, aucune écriture", async () => {
  const cas = [
    [{ analyse: null }, /introuvable/i],
    [{ analyse: { ...ANALYSE, statut: "publie" } }, /pas un brouillon/],
    [{ plusRecenteId: 99 }, /pas l'analyse la plus récente/],
  ];
  for (const [options, attendu] of cas) {
    for (const dryRun of [false, true]) {
      const { prisma, journal } = fausseBase(options);
      const resultat = await enregistrerTexteCore(entree(), { isEditor: editeur, prisma, dryRun });
      assert.equal(resultat.ok, false);
      assert.match(resultat.message, attendu);
      assert.ok(!journal.includes("$transaction"));
    }
  }
});

test("conflit : la version attendue n'est plus celle de la base → message exact, aucune écriture", async () => {
  for (const dryRun of [false, true]) {
    const { prisma, journal } = fausseBase();
    const resultat = await enregistrerTexteCore(
      entree({ versionAttendue: "2026-09-21T09:59:59.999Z" }),
      { isEditor: editeur, prisma, dryRun },
    );
    assert.deepEqual(resultat, {
      ok: false,
      message: "Ce brouillon a été modifié entre-temps. Recharge la page pour voir la dernière version.",
    });
    assert.ok(!journal.includes("$transaction"));
  }
});

test("simulation : annonce le nombre de caractères et n'écrit RIEN", async () => {
  const { prisma, journal } = fausseBase({ ecrituresAutorisees: false });
  const resultat = await enregistrerTexteCore(entree({ valeur: `  ${RESUME_VALIDE}\r\n` }), {
    isEditor: editeur,
    prisma,
    dryRun: true,
  });
  assert.deepEqual(resultat, {
    ok: true,
    simulation: true,
    message: `[Simulation] Le texte serait enregistré (${RESUME_VALIDE.length} caractères).`,
  });
  assert.ok(!journal.includes("$transaction"));
  assert.ok(journal.every((appel) => !/update/i.test(appel)));
});

test("enregistrement du résumé : une transaction, analyse mise à jour (contenu + teaser), proposition intacte", async () => {
  const { prisma, journal, appels } = fausseBase({ ecrituresAutorisees: true });
  const long = `${"Une phrase de test un peu longue pour dépasser la limite. ".repeat(12)}Fin.`;
  const avant = Date.now();
  const resultat = await enregistrerTexteCore(entree({ valeur: long }), { isEditor: editeur, prisma, dryRun: false });

  assert.equal(resultat.ok, true);
  assert.equal(resultat.simulation, false);
  assert.equal(resultat.analyseId, 7);
  assert.equal(resultat.propositionId, 70);
  assert.equal(resultat.champ, "resume_court");
  assert.equal(resultat.avant, CONTENU.resume_court);
  assert.equal(resultat.apres, long);
  // Nouvelle version : strictement postérieure à l'ancienne, et c'est celle qu'on renvoie.
  assert.ok(new Date(resultat.versionSuivante).getTime() > new Date(VERSION).getTime());
  assert.ok(new Date(resultat.versionSuivante).getTime() >= avant);

  assert.deepEqual(journal.filter((a) => /update|\$transaction/.test(a)), ["$transaction", "tx.analyse.updateMany"]);

  const [nom, args] = appels[0];
  assert.equal(nom, "tx.analyse.updateMany");
  // Le where verrouille : brouillon ET version vue par l'éditeur.
  assert.deepEqual(args.where, { id: 7, statut: "brouillon", updatedAt: new Date(VERSION) });
  assert.equal(args.data.teaser, truncateTeaser(long));
  assert.equal(args.data.updatedAt.toISOString(), resultat.versionSuivante);
  // Le contenu écrit : seul resume_court a changé, notes intactes.
  assert.equal(args.data.contenuComplet.resume_court, long);
  assert.equal(args.data.contenuComplet.titre_fiche, CONTENU.titre_fiche);
  assert.deepEqual(args.data.contenuComplet.notation_detaillee, CONTENU.notation_detaillee);
  assert.deepEqual(Object.keys(args.data).sort(), ["contenuComplet", "teaser", "updatedAt"]);
  // L'objet lu en base n'a pas été modifié en place.
  assert.equal(CONTENU.resume_court, "Résumé d'origine, assez long pour être valide.");
});

test("enregistrement du titre : contenu + Proposition.titre (coupé à 80), pas de teaser", async () => {
  const { prisma, journal, appels } = fausseBase({ ecrituresAutorisees: true });
  const titre = "Une mesure très ambitieuse pour la fiscalité des grandes successions en France depuis toujours";
  const resultat = await enregistrerTexteCore(entree({ champ: "titre_fiche", valeur: titre }), {
    isEditor: editeur,
    prisma,
    dryRun: false,
  });

  assert.equal(resultat.ok, true);
  assert.equal(resultat.avant, CONTENU.titre_fiche);
  assert.deepEqual(journal.filter((a) => /update|\$transaction/.test(a)), [
    "$transaction",
    "tx.analyse.updateMany",
    "tx.proposition.update",
  ]);
  const [, argsAnalyse] = appels[0];
  assert.equal(argsAnalyse.data.contenuComplet.titre_fiche, titre); // texte complet dans le contenu
  assert.ok(!("teaser" in argsAnalyse.data));
  const [, argsProposition] = appels[1];
  assert.deepEqual(argsProposition, {
    where: { id: 70 },
    data: { titre: "Une mesure très ambitieuse pour la fiscalité des grandes successions en France…" },
  });
});

test("enregistrement : si quelqu'un est passé avant (count = 0), on annule avant de toucher à la proposition", async () => {
  const { prisma, journal } = fausseBase({ ecrituresAutorisees: true, count: 0 });
  const resultat = await enregistrerTexteCore(entree({ champ: "titre_fiche", valeur: "Un autre titre" }), {
    isEditor: editeur,
    prisma,
    dryRun: false,
  });
  assert.equal(resultat.ok, false);
  assert.match(resultat.message, /modifié entre-temps/);
  assert.ok(!journal.includes("tx.proposition.update"));
});

test("enregistrement : erreur imprévue de la base → message clair, rien n'est affirmé enregistré", async () => {
  const { prisma } = fausseBase({ ecrituresAutorisees: true, echecTransaction: new Error("connexion perdue") });
  const erreurs = [];
  const original = console.error;
  console.error = (...args) => erreurs.push(args);
  try {
    const resultat = await enregistrerTexteCore(entree(), { isEditor: editeur, prisma, dryRun: false });
    assert.equal(resultat.ok, false);
    assert.match(resultat.message, /a échoué et rien n'a été modifié/);
    assert.equal(erreurs.length, 1);
  } finally {
    console.error = original;
  }
});

test("contenu illisible en base (pas un objet) : refusé sans écriture", async () => {
  const erreurs = [];
  const original = console.error;
  console.error = (...args) => erreurs.push(args);
  try {
    const { prisma, journal } = fausseBase({ analyse: { ...ANALYSE, contenuComplet: null } });
    const resultat = await enregistrerTexteCore(entree(), { isEditor: editeur, prisma, dryRun: false });
    assert.equal(resultat.ok, false);
    assert.match(resultat.message, /forme attendue/);
    assert.ok(!journal.includes("$transaction"));
  } finally {
    console.error = original;
  }
});

// Garde-fous sur le câblage de l'action exportée.
test("enregistrerTexte (actions.js) branche isEditor et TEST_DRY_RUN, et journalise l'ancien texte", () => {
  const source = readFileSync(new URL("../src/app/test/actions.js", import.meta.url), "utf8");
  assert.match(source, /enregistrerTexteCore\(entree, \{[\s\S]*isEditor,[\s\S]*prisma,[\s\S]*dryRun: process\.env\.TEST_DRY_RUN === "1"/);
  assert.match(source, /evenement: "test_modification_texte"[\s\S]*avant: resultat\.avant[\s\S]*apres: resultat\.apres/);
  assert.match(source, /revalidatePath\("\/test"\)[\s\S]*revalidatePath\(`\/test\/\$\{resultat\.propositionId\}`\)/);
});

test("test-enregistrer.js n'écrit qu'avec updateMany (analyse) et update (proposition), jamais de create/delete/upsert", () => {
  const source = readFileSync(new URL("../src/lib/test-enregistrer.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /\.(create|createMany|delete|deleteMany|upsert)\(/);
  assert.doesNotMatch(source, /\$executeRaw|\$queryRaw/);
});

// --- Version basique ---------------------------------------------------------

const VERSION_BASIQUE = {
  resume: "Résumé simple d'origine, assez long.",
  contexte: "Contexte d'origine, assez long pour être valide.",
  analyse: "Analyse d'origine, assez longue pour être valide.",
  faisabilite: "Faisabilité d'origine, assez longue pour être valide.",
  points_forts: ["Premier point fort", "Second point fort"],
  points_faibles: ["Premier point faible", "Second point faible"],
  sources_principales: [0, 2],
};
const ANALYSE_BASIQUE = { ...ANALYSE, contenuComplet: { ...CONTENU, version_basique: VERSION_BASIQUE } };

test("version basique : modification d'un texte, seule la sous-clé change, aucune colonne dérivée", async () => {
  const { prisma, journal, appels } = fausseBase({ analyse: ANALYSE_BASIQUE, ecrituresAutorisees: true });
  const texte = "Un nouveau contexte, simple et clair.";
  const resultat = await enregistrerTexteCore(entree({ champ: "version_basique.contexte", valeur: `  ${texte}\r\n` }), {
    isEditor: editeur,
    prisma,
    dryRun: false,
  });

  assert.equal(resultat.ok, true);
  assert.equal(resultat.champ, "version_basique.contexte");
  assert.equal(resultat.avant, VERSION_BASIQUE.contexte);
  assert.equal(resultat.apres, texte);
  assert.deepEqual(journal.filter((a) => /update|\$transaction/.test(a)), ["$transaction", "tx.analyse.updateMany"]);

  const [, args] = appels[0];
  assert.deepEqual(Object.keys(args.data).sort(), ["contenuComplet", "updatedAt"]); // ni teaser, ni titre
  const ecrit = args.data.contenuComplet;
  assert.deepEqual(ecrit.version_basique, { ...VERSION_BASIQUE, contexte: texte });
  assert.deepEqual(ecrit.version_basique.sources_principales, [0, 2]);
  assert.deepEqual(ecrit.notation_detaillee, CONTENU.notation_detaillee);
  for (const cle of Object.keys(CONTENU)) assert.deepEqual(ecrit[cle], CONTENU[cle], cle);
  // L'objet lu en base n'a pas été modifié en place.
  assert.equal(ANALYSE_BASIQUE.contenuComplet.version_basique.contexte, VERSION_BASIQUE.contexte);
});

test("version basique : modification d'une liste, enregistrée en tableau de chaînes", async () => {
  const { prisma, appels } = fausseBase({ analyse: ANALYSE_BASIQUE, ecrituresAutorisees: true });
  const resultat = await enregistrerTexteCore(
    entree({ champ: "version_basique.points_forts", valeur: "Point A\n\n  Point B  \nPoint C\n" }),
    { isEditor: editeur, prisma, dryRun: false },
  );

  assert.equal(resultat.ok, true);
  assert.deepEqual(resultat.avant, VERSION_BASIQUE.points_forts);
  assert.deepEqual(resultat.apres, ["Point A", "Point B", "Point C"]);
  const ecrit = appels[0][1].data.contenuComplet;
  assert.deepEqual(ecrit.version_basique.points_forts, ["Point A", "Point B", "Point C"]);
  assert.deepEqual(ecrit.version_basique.points_faibles, VERSION_BASIQUE.points_faibles);
  assert.deepEqual(ecrit.version_basique.sources_principales, VERSION_BASIQUE.sources_principales);
  assert.deepEqual(ecrit.notation_detaillee, CONTENU.notation_detaillee);
});

test("version basique : simulation d'une liste → nombre de points, aucune écriture", async () => {
  const { prisma, journal } = fausseBase({ analyse: ANALYSE_BASIQUE, ecrituresAutorisees: false });
  const resultat = await enregistrerTexteCore(entree({ champ: "version_basique.points_faibles", valeur: "A\nB\nC" }), {
    isEditor: editeur,
    prisma,
    dryRun: true,
  });
  assert.deepEqual(resultat, {
    ok: true,
    simulation: true,
    message: "[Simulation] La liste serait enregistrée (3 points).",
  });
  assert.ok(!journal.includes("$transaction"));
  assert.ok(journal.every((appel) => !/update/i.test(appel)));
});

test("version basique : 1 point, 6 points ou ** refusés sans toucher la base", async () => {
  const cas = [
    [entree({ champ: "version_basique.points_forts", valeur: "Un seul point" }), /au moins 2 points/],
    [entree({ champ: "version_basique.points_faibles", valeur: "A\nB\nC\nD\nE\nF" }), /5 points au maximum/],
    [entree({ champ: "version_basique.points_forts", valeur: "Un\n**Deux**" }), /sans gras/],
    [entree({ champ: "version_basique.resume", valeur: "Un résumé avec un **mot** en gras." }), /sans gras/],
    [entree({ champ: "version_basique.sources_principales", valeur: "0\n1" }), /ne peut pas être modifié/],
  ];
  for (const [saisie, attendu] of cas) {
    const { prisma, journal } = fausseBase({ analyse: ANALYSE_BASIQUE, ecrituresAutorisees: true });
    const resultat = await enregistrerTexteCore(saisie, { isEditor: editeur, prisma, dryRun: false });
    assert.equal(resultat.ok, false, JSON.stringify(saisie));
    assert.match(resultat.message, attendu, JSON.stringify(saisie));
    assert.deepEqual(journal, [], JSON.stringify(saisie));
  }
});

test("version basique : fiche sans version_basique en base → refus clair, aucune écriture", async () => {
  for (const dryRun of [false, true]) {
    for (const contenuComplet of [CONTENU, { ...CONTENU, version_basique: null }]) {
      const { prisma, journal } = fausseBase({ analyse: { ...ANALYSE, contenuComplet }, ecrituresAutorisees: true });
      const resultat = await enregistrerTexteCore(
        entree({ champ: "version_basique.analyse", valeur: "Une analyse simple et assez longue." }),
        { isEditor: editeur, prisma, dryRun },
      );
      assert.deepEqual(resultat, {
        ok: false,
        message: "Cette fiche n'a pas de version basique : elle ne peut pas être modifiée.",
      });
      assert.ok(!journal.includes("$transaction"));
    }
  }
});

// --- Mesure initiale (colonne Proposition.texteOriginal) ----------------------

const MESURE_AVANT = "Mesure d'origine. citation : « … » (source)";
const MESURE_APRES = "Mesure corrigée. citation : « … » (Le Monde, 2026)";
const ANALYSE_MESURE = { ...ANALYSE, proposition: { texteOriginal: MESURE_AVANT } };

test("mesure initiale : Proposition.texteOriginal écrite, contenu de l'analyse intact, version avancée", async () => {
  const { prisma, journal, appels } = fausseBase({ analyse: ANALYSE_MESURE, ecrituresAutorisees: true });
  const resultat = await enregistrerTexteCore(entree({ champ: "proposition.texteOriginal", valeur: ` ${MESURE_APRES}\r\n` }), {
    isEditor: editeur,
    prisma,
    dryRun: false,
  });

  assert.equal(resultat.ok, true);
  assert.equal(resultat.champ, "proposition.texteOriginal");
  assert.equal(resultat.avant, MESURE_AVANT);
  assert.equal(resultat.apres, MESURE_APRES);
  assert.deepEqual(journal.filter((a) => /update|\$transaction/.test(a)), [
    "$transaction",
    "tx.analyse.updateMany",
    "tx.proposition.update",
  ]);
  const [, argsAnalyse] = appels[0];
  assert.deepEqual(argsAnalyse.where, { id: 7, statut: "brouillon", updatedAt: new Date(VERSION) });
  assert.deepEqual(Object.keys(argsAnalyse.data), ["updatedAt"]); // ni contenu, ni teaser
  assert.equal(argsAnalyse.data.updatedAt.toISOString(), resultat.versionSuivante);
  assert.deepEqual(appels[1][1], { where: { id: 70 }, data: { texteOriginal: MESURE_APRES } });
});

test("mesure initiale : une version publiée existe → refus, aucune écriture (même en simulation)", async () => {
  for (const dryRun of [false, true]) {
    const { prisma, journal } = fausseBase({ analyse: ANALYSE_MESURE, publieeId: 3, ecrituresAutorisees: true });
    const resultat = await enregistrerTexteCore(entree({ champ: "proposition.texteOriginal", valeur: MESURE_APRES }), {
      isEditor: editeur,
      prisma,
      dryRun,
    });
    assert.equal(resultat.ok, false);
    assert.match(resultat.message, /déjà une version publiée/);
    assert.ok(!journal.includes("$transaction"));
  }
});

test("mesure initiale : conflit (count = 0) → la proposition n'est pas touchée", async () => {
  const { prisma, journal } = fausseBase({ analyse: ANALYSE_MESURE, ecrituresAutorisees: true, count: 0 });
  const resultat = await enregistrerTexteCore(entree({ champ: "proposition.texteOriginal", valeur: MESURE_APRES }), {
    isEditor: editeur,
    prisma,
    dryRun: false,
  });
  assert.equal(resultat.ok, false);
  assert.match(resultat.message, /modifié entre-temps/);
  assert.ok(!journal.includes("tx.proposition.update"));
});

test("mesure initiale : simulation → nombre de caractères, aucune écriture", async () => {
  const { prisma, journal } = fausseBase({ analyse: ANALYSE_MESURE });
  const resultat = await enregistrerTexteCore(entree({ champ: "proposition.texteOriginal", valeur: MESURE_APRES }), {
    isEditor: editeur,
    prisma,
    dryRun: true,
  });
  assert.deepEqual(resultat, {
    ok: true,
    simulation: true,
    message: `[Simulation] Le texte serait enregistré (${MESURE_APRES.length} caractères).`,
  });
  assert.ok(journal.every((appel) => !/update|\$transaction/i.test(appel)));
});

// --- Reste de la fiche ----------------------------------------------------------

const CONTENU_FICHE = {
  ...CONTENU,
  analyse_par_criteres: [{ critere: "efficacite", titre: "Efficacité", note: 18, note_max: 30, texte: "Ancien texte." }],
  sources_utilisees: ["A", "B", "C"],
  version_basique: { ...VERSION_BASIQUE, sources_principales: [0, 2] },
};
const ANALYSE_FICHE = { ...ANALYSE, contenuComplet: CONTENU_FICHE, proposition: { texteOriginal: "x", theme: "Logement" } };

test("verdict final : contenu + colonne Analyse.verdict dans la même écriture", async () => {
  const { prisma, appels } = fausseBase({ analyse: ANALYSE_FICHE, ecrituresAutorisees: true });
  const verdict = "Ce qui tient, assez long.\n\nCe qui reste flou.";
  const resultat = await enregistrerTexteCore(entree({ champ: "verdict_final", valeur: verdict }), {
    isEditor: editeur,
    prisma,
    dryRun: false,
  });
  assert.equal(resultat.ok, true);
  assert.equal(resultat.avant, CONTENU.verdict_final);
  const [, args] = appels[0];
  assert.deepEqual(Object.keys(args.data).sort(), ["contenuComplet", "updatedAt", "verdict"]);
  assert.equal(args.data.verdict, verdict);
  assert.equal(args.data.contenuComplet.verdict_final, verdict);
});

test("critère : texte modifié, note intacte, aucune colonne dérivée", async () => {
  const { prisma, appels } = fausseBase({ analyse: ANALYSE_FICHE, ecrituresAutorisees: true });
  const resultat = await enregistrerTexteCore(
    entree({ champ: "analyse_par_criteres.efficacite", valeur: "Nouveau texte du critère efficacité." }),
    { isEditor: editeur, prisma, dryRun: false },
  );
  assert.equal(resultat.ok, true);
  assert.equal(resultat.avant, "Ancien texte.");
  assert.equal(resultat.apres, "Nouveau texte du critère efficacité.");
  const ecrit = appels[0][1].data.contenuComplet;
  assert.deepEqual(ecrit.analyse_par_criteres[0], { ...CONTENU_FICHE.analyse_par_criteres[0], texte: "Nouveau texte du critère efficacité." });
  assert.deepEqual(ecrit.notation_detaillee, CONTENU.notation_detaillee);
});

test("bloc absent de la fiche (critère, section) : refus clair, aucune écriture", async () => {
  for (const [champ, attendu] of [
    ["analyse_par_criteres.degre_preparation", /introuvable/],
    ["angles_morts.texte", /n'existe pas/],
    ["mesure_vers_objectif.objectif_court", /Mesure initiale/],
  ]) {
    const { prisma, journal } = fausseBase({ analyse: ANALYSE_FICHE, ecrituresAutorisees: true });
    const resultat = await enregistrerTexteCore(entree({ champ, valeur: "Un texte assez long pour être valide." }), {
      isEditor: editeur,
      prisma,
      dryRun: false,
    });
    assert.equal(resultat.ok, false, champ);
    assert.match(resultat.message, attendu, champ);
    assert.ok(!journal.includes("$transaction"), champ);
  }
});

test("sources : supprimer une source principale de la version basique est refusé", async () => {
  const { prisma, journal } = fausseBase({ analyse: ANALYSE_FICHE, ecrituresAutorisees: true });
  const resultat = await enregistrerTexteCore(entree({ champ: "sources_utilisees", valeur: "A\nB" }), {
    isEditor: editeur,
    prisma,
    dryRun: false,
  });
  assert.equal(resultat.ok, false);
  assert.match(resultat.message, /source n° 3/);
  assert.ok(!journal.includes("$transaction"));

  const ok = fausseBase({ analyse: ANALYSE_FICHE, ecrituresAutorisees: true });
  const ajout = await enregistrerTexteCore(entree({ champ: "sources_utilisees", valeur: "A\nB\nC\nD" }), {
    isEditor: editeur,
    prisma: ok.prisma,
    dryRun: false,
  });
  assert.equal(ajout.ok, true);
  assert.deepEqual(ok.appels[0][1].data.contenuComplet.sources_utilisees, ["A", "B", "C", "D"]);
});

test("thématique : Proposition.theme, refusée si la mesure a une version publiée", async () => {
  const { prisma, appels } = fausseBase({ analyse: ANALYSE_FICHE, ecrituresAutorisees: true });
  const resultat = await enregistrerTexteCore(entree({ champ: "proposition.theme", valeur: "Retraites" }), {
    isEditor: editeur,
    prisma,
    dryRun: false,
  });
  assert.equal(resultat.ok, true);
  assert.equal(resultat.avant, "Logement");
  assert.deepEqual(appels[1][1], { where: { id: 70 }, data: { theme: "Retraites" } });

  const publiee = fausseBase({ analyse: ANALYSE_FICHE, publieeId: 3, ecrituresAutorisees: true });
  const refus = await enregistrerTexteCore(entree({ champ: "proposition.theme", valeur: "Retraites" }), {
    isEditor: editeur,
    prisma: publiee.prisma,
    dryRun: false,
  });
  assert.equal(refus.ok, false);
  assert.match(refus.message, /« Thématique »/);
});

test("catégorie vidée : null enregistré ; simulation → « La valeur serait effacée. »", async () => {
  const contenuComplet = { ...CONTENU, mesure_vers_objectif: { objectif_court: "Objectif", categorie_objectif: "Logement" } };
  const { prisma, appels } = fausseBase({ analyse: { ...ANALYSE, contenuComplet }, ecrituresAutorisees: true });
  const resultat = await enregistrerTexteCore(entree({ champ: "mesure_vers_objectif.categorie_objectif", valeur: "" }), {
    isEditor: editeur,
    prisma,
    dryRun: false,
  });
  assert.equal(resultat.ok, true);
  assert.equal(resultat.avant, "Logement");
  assert.equal(resultat.apres, null);
  assert.deepEqual(appels[0][1].data.contenuComplet.mesure_vers_objectif, { objectif_court: "Objectif", categorie_objectif: null });

  const simulation = fausseBase({ analyse: { ...ANALYSE, contenuComplet } });
  assert.deepEqual(
    await enregistrerTexteCore(entree({ champ: "mesure_vers_objectif.categorie_objectif", valeur: "" }), {
      isEditor: editeur,
      prisma: simulation.prisma,
      dryRun: true,
    }),
    { ok: true, simulation: true, message: "[Simulation] La valeur serait effacée." },
  );
});

test("phrase d'accueil : contenu + colonne resumeAccueil (lue par le carrousel), proposition intacte", async () => {
  const { prisma, journal, appels } = fausseBase({ ecrituresAutorisees: true });
  const phrase = "6 milliards par an pour les enseignants, sans recette en face. Macron avait promis la même hausse en 2022.";
  const resultat = await enregistrerTexteCore(entree({ champ: "teaser_accueil", valeur: phrase }), {
    isEditor: editeur,
    prisma,
    dryRun: false,
  });

  assert.equal(resultat.ok, true);
  assert.equal(resultat.champ, "teaser_accueil");
  assert.equal(resultat.apres, phrase);
  assert.deepEqual(journal.filter((a) => /update|\$transaction/.test(a)), ["$transaction", "tx.analyse.updateMany"]);
  const [, args] = appels[0];
  assert.deepEqual(args.where, { id: 7, statut: "brouillon", updatedAt: new Date(VERSION) });
  assert.deepEqual(Object.keys(args.data).sort(), ["contenuComplet", "resumeAccueil", "updatedAt"]);
  assert.equal(args.data.resumeAccueil, phrase);
  assert.equal(args.data.contenuComplet.teaser_accueil, phrase);
  assert.deepEqual(args.data.contenuComplet.notation_detaillee, CONTENU.notation_detaillee);
});
