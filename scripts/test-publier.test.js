import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fusionnerRevisionCore, publierBrouillonCore } from "../src/lib/test-publier.js";

// Logique de « Publier » de /test/[id], testée avec une FAUSSE base : aucune
// connexion réelle, aucune écriture possible. Les méthodes d'écriture de la fausse
// base lèvent une erreur si elles sont appelées alors qu'elles ne devraient pas l'être.

const BROUILLON = {
  id: 7,
  statut: "brouillon",
  scoreFaisabilite: 51,
  propositionId: 70,
  proposition: { candidatId: 3, candidat: { nom: "David Lisnard" } },
};

// Fausse base : `journal` liste, dans l'ordre, tous les appels reçus.
function fausseBase({
  analyse = BROUILLON,
  plusRecenteId = analyse?.id,
  autrePubliee = null,
  publiees = [{ scoreFaisabilite: 80 }, { scoreFaisabilite: 60 }],
  count = 1,
  moyenne = 63.5,
  ecrituresAutorisees = false,
  echecTransaction = null,
} = {}) {
  const journal = [];
  const ecriture = (nom, valeur) => async (args) => {
    journal.push(nom);
    if (!ecrituresAutorisees) throw new Error(`ÉCRITURE INTERDITE : ${nom}`);
    return typeof valeur === "function" ? valeur(args) : valeur;
  };
  const lecture = (nom, valeur) => async (args) => {
    journal.push(nom);
    return typeof valeur === "function" ? valeur(args) : valeur;
  };

  const tx = {
    analyse: {
      updateMany: ecriture("tx.analyse.updateMany", { count }),
      aggregate: lecture("tx.analyse.aggregate", { _avg: { scoreFaisabilite: moyenne } }),
    },
    candidat: {
      update: ecriture("tx.candidat.update", (args) => ({ nom: "David Lisnard", scoreMoyen: args.data.scoreMoyen })),
    },
  };

  const prisma = {
    analyse: {
      findUnique: lecture("analyse.findUnique", analyse),
      // Deux findFirst : la « plus récente » (sans statut) et un éventuel doublon publié.
      findFirst: lecture("analyse.findFirst", (args) =>
        args.where.statut === "publie" ? autrePubliee : { id: plusRecenteId },
      ),
      findMany: lecture("analyse.findMany", publiees),
      update: ecriture("analyse.update", {}),
      updateMany: ecriture("analyse.updateMany", {}),
    },
    candidat: { update: ecriture("candidat.update", {}) },
    $transaction: async (fn) => {
      journal.push("$transaction");
      if (echecTransaction) throw echecTransaction;
      return fn(tx);
    },
  };

  return { prisma, journal, tx };
}

const editeur = async () => true;
const pasEditeur = async () => false;

// Moment du clic « Publier » figé pour les tests : 19/11/2026 à 14:32, heure
// de Paris (13:32 UTC, heure d'hiver).
const CLIC = new Date("2026-11-19T13:32:00.000Z");
const maintenant = () => CLIC;

test("sans cookie valide : « Non autorisé. » et la base n'est même pas consultée", async () => {
  for (const dryRun of [false, true]) {
    const { prisma, journal } = fausseBase({ ecrituresAutorisees: true });
    const resultat = await publierBrouillonCore(7, { isEditor: pasEditeur, prisma, dryRun });
    assert.deepEqual(resultat, { ok: false, message: "Non autorisé." });
    assert.deepEqual(journal, []);
  }
});

test("argument invalide venu du navigateur : refusé sans toucher la base", async () => {
  for (const mauvais of ["7", 0, -1, 1.5, NaN, Infinity, null, undefined, {}, [7]]) {
    const { prisma, journal } = fausseBase({ ecrituresAutorisees: true });
    const resultat = await publierBrouillonCore(mauvais, { isEditor: editeur, prisma, dryRun: false });
    assert.equal(resultat.ok, false, String(mauvais));
    assert.equal(resultat.message, "Analyse introuvable.");
    assert.deepEqual(journal, [], String(mauvais));
  }
});

test("analyse inexistante, déjà publiée, pas la plus récente, doublon publié : refus clairs, aucune écriture", async () => {
  const cas = [
    [{ analyse: null }, /introuvable/i],
    [{ analyse: { ...BROUILLON, statut: "publie" } }, /pas un brouillon/i],
    [{ plusRecenteId: 99 }, /pas l'analyse la plus récente/i],
    [
      { autrePubliee: { id: 5 } },
      /Une version publiée existe déjà pour cette mesure : dépublie-la d'abord \(scripts\/unpublish\.js\)\./,
    ],
  ];
  for (const [options, attendu] of cas) {
    for (const dryRun of [false, true]) {
      const { prisma, journal } = fausseBase(options);
      const resultat = await publierBrouillonCore(7, { isEditor: editeur, prisma, dryRun });
      assert.equal(resultat.ok, false);
      assert.match(resultat.message, attendu);
      assert.ok(!journal.includes("$transaction"));
    }
  }
});

test("une analyse plus récente à la corbeille ne bloque pas la publication du brouillon précédent", async () => {
  // Analyses de la mesure, de la plus récente à la plus ancienne. Le faux findFirst
  // applique vraiment le filtre de statut reçu (égalité ou { not }).
  const lignes = [
    { id: 99, statut: "corbeille" },
    { id: 7, statut: "brouillon" },
  ];
  const correspond = (statut, filtre) =>
    filtre === undefined ? true : typeof filtre === "string" ? statut === filtre : statut !== filtre.not;
  const premiere = (where) =>
    lignes.find((ligne) => correspond(ligne.statut, where.statut) && (where.id?.not === undefined || ligne.id !== where.id.not)) ?? null;

  for (const [lignesTest, attendu] of [
    [lignes, true],
    // Contre-épreuve : un brouillon plus récent, lui, bloque toujours.
    [[{ id: 99, statut: "brouillon" }, { id: 7, statut: "brouillon" }], false],
  ]) {
    lignes.splice(0, lignes.length, ...lignesTest);
    const { prisma } = fausseBase();
    const filtres = [];
    prisma.analyse.findFirst = async (args) => (filtres.push(args.where), premiere(args.where));
    const resultat = await publierBrouillonCore(7, { isEditor: editeur, prisma, dryRun: true });
    assert.equal(resultat.ok, attendu, JSON.stringify(lignesTest));
    if (!attendu) assert.match(resultat.message, /pas l'analyse la plus récente/i);
    assert.deepEqual(filtres[0], { propositionId: 70, statut: { not: "corbeille" } });
  }
});

test("simulation : annonce la nouvelle moyenne et n'écrit RIEN", async () => {
  // (80 + 60 + 51) / 3 = 63,666… → 63,7
  const { prisma, journal } = fausseBase({ ecrituresAutorisees: false });
  const resultat = await publierBrouillonCore(7, { isEditor: editeur, prisma, dryRun: true, maintenant });
  assert.equal(resultat.ok, true);
  assert.equal(resultat.simulation, true);
  // La simulation annonce la date qui AURAIT été enregistrée (heure de Paris).
  assert.equal(
    resultat.message,
    "[Simulation] Cette analyse serait publiée le 19/11/2026 à 14:32 (heure de Paris) et la moyenne de David Lisnard deviendrait 63.7/100.",
  );
  assert.equal(resultat.publieLe, CLIC.toISOString());
  assert.ok(!journal.includes("$transaction"));
  assert.ok(journal.every((appel) => !/update|aggregate/.test(appel)));
});

test("simulation : premier brouillon publié du candidat → sa moyenne = son score", async () => {
  const { prisma } = fausseBase({ publiees: [] });
  const resultat = await publierBrouillonCore(7, { isEditor: editeur, prisma, dryRun: true });
  assert.match(resultat.message, /deviendrait 51\/100\./);
});

test("publication réelle : une transaction, mêmes étapes et même ordre que scripts/publish.js", async () => {
  const { prisma, journal, tx } = fausseBase({ ecrituresAutorisees: true, moyenne: 63.5 });
  const appels = [];
  const updateMany = tx.analyse.updateMany;
  tx.analyse.updateMany = async (args) => (appels.push(["updateMany", args]), updateMany(args));
  const update = tx.candidat.update;
  tx.candidat.update = async (args) => (appels.push(["candidat.update", args]), update(args));

  const resultat = await publierBrouillonCore(7, { isEditor: editeur, prisma, dryRun: false, maintenant });

  assert.deepEqual(resultat, {
    ok: true,
    simulation: false,
    analyseId: 7,
    propositionId: 70,
    candidatId: 3,
    candidatNom: "David Lisnard",
    publieLe: CLIC.toISOString(),
  });
  // Aucune écriture hors transaction.
  assert.deepEqual(journal.filter((a) => /update|aggregate|\$transaction/.test(a)), [
    "$transaction",
    "tx.analyse.updateMany",
    "tx.analyse.aggregate",
    "tx.candidat.update",
  ]);
  // On ne publie que si l'analyse est ENCORE un brouillon, avec la date du clic
  // (dans la même écriture que le statut), et on recalcule la moyenne.
  assert.deepEqual(appels[0], [
    "updateMany",
    { where: { id: 7, statut: "brouillon" }, data: { statut: "publie", publieLe: CLIC } },
  ]);
  assert.deepEqual(appels[1], ["candidat.update", { where: { id: 3 }, data: { scoreMoyen: 63.5 } }]);
});

test("publication réelle : si quelqu'un l'a déjà publiée (count ≠ 1), on annule avant de toucher au candidat", async () => {
  const { prisma, journal } = fausseBase({ ecrituresAutorisees: true, count: 0 });
  const resultat = await publierBrouillonCore(7, { isEditor: editeur, prisma, dryRun: false });
  assert.equal(resultat.ok, false);
  assert.match(resultat.message, /rien n'a été publié/);
  assert.ok(!journal.includes("tx.candidat.update"));
  assert.ok(!journal.includes("tx.analyse.aggregate"));
});

test("date de publication : seuls le statut et publieLe sont écrits sur l'analyse ; la déclaration n'est pas touchée", async () => {
  const { prisma, journal, tx } = fausseBase({ ecrituresAutorisees: true });
  let donnees = null;
  const updateMany = tx.analyse.updateMany;
  tx.analyse.updateMany = async (args) => ((donnees = args.data), updateMany(args));
  const resultat = await publierBrouillonCore(7, { isEditor: editeur, prisma, dryRun: false, maintenant });
  assert.equal(resultat.ok, true);
  // Exactement deux champs : ni le score, ni createdAt, ni aucune date de la déclaration.
  assert.deepEqual(Object.keys(donnees).sort(), ["publieLe", "statut"]);
  assert.equal(donnees.publieLe, CLIC);
  // Aucune écriture sur la Proposition (dateDeclaration) : seules les écritures
  // attendues apparaissent dans le journal.
  assert.ok(journal.every((appel) => !/proposition/i.test(appel)));
});

test("date de publication : prise au moment du clic, côté serveur, à chaque publication", async () => {
  const { prisma, tx } = fausseBase({ ecrituresAutorisees: true });
  let donnees = null;
  const updateMany = tx.analyse.updateMany;
  tx.analyse.updateMany = async (args) => ((donnees = args.data), updateMany(args));
  const avant = Date.now();
  // Sans horloge injectée : la vraie date du serveur.
  await publierBrouillonCore(7, { isEditor: editeur, prisma, dryRun: false });
  assert.ok(donnees.publieLe instanceof Date);
  assert.ok(donnees.publieLe.getTime() >= avant && donnees.publieLe.getTime() <= Date.now());
});

test("double clic : le second clic est refusé sans rien réécrire (la date du premier clic reste)", async () => {
  // Premier clic : publié.
  const premier = fausseBase({ ecrituresAutorisees: true });
  const r1 = await publierBrouillonCore(7, { isEditor: editeur, prisma: premier.prisma, dryRun: false, maintenant });
  assert.equal(r1.ok, true);
  // Second clic, la base voit déjà « publie » : refus avant toute écriture.
  const second = fausseBase({ analyse: { ...BROUILLON, statut: "publie" }, ecrituresAutorisees: false });
  const r2 = await publierBrouillonCore(7, {
    isEditor: editeur,
    prisma: second.prisma,
    dryRun: false,
    maintenant: () => new Date("2026-11-19T13:33:00.000Z"),
  });
  assert.equal(r2.ok, false);
  assert.match(r2.message, /pas un brouillon/);
  assert.ok(!second.journal.includes("$transaction"));
  // Deux clics simultanés (les deux lisent « brouillon ») : la condition
  // statut = brouillon de l'écriture n'en laisse passer qu'un (count = 0).
  const concurrent = fausseBase({ ecrituresAutorisees: true, count: 0 });
  const r3 = await publierBrouillonCore(7, { isEditor: editeur, prisma: concurrent.prisma, dryRun: false, maintenant });
  assert.equal(r3.ok, false);
});

test("simulation (TEST_DRY_RUN=1) : aucune écriture, mais la date qui aurait été enregistrée est renvoyée", async () => {
  const { prisma, journal } = fausseBase({ ecrituresAutorisees: false });
  const resultat = await publierBrouillonCore(7, { isEditor: editeur, prisma, dryRun: true, maintenant });
  assert.equal(resultat.publieLe, "2026-11-19T13:32:00.000Z");
  assert.match(resultat.message, /serait publiée le 19\/11\/2026 à 14:32 \(heure de Paris\)/);
  assert.ok(journal.every((appel) => !/update|\$transaction/.test(appel)));
});

test("réessayer la fusion : ne touche jamais à la date de publication (aucune écriture en base)", async () => {
  const analyse = { ...BROUILLON, statut: "publie", contenuComplet: { revision: { slug: "x" } } };
  const { prisma, journal } = fausseBase({ analyse, ecrituresAutorisees: false });
  const github = {
    verifier: async () => ({ ok: true, pr: { numero: 1, lien: "l" } }),
    fusionner: async () => ({ ok: true }),
  };
  const resultat = await fusionnerRevisionCore(7, { isEditor: editeur, prisma, dryRun: false, github });
  assert.equal(resultat.ok, true);
  assert.ok(journal.every((appel) => !/update|\$transaction/.test(appel)));
});

test("publication réelle : erreur imprévue de la base → message clair, rien n'est affirmé publié", async () => {
  const { prisma } = fausseBase({ ecrituresAutorisees: true, echecTransaction: new Error("connexion perdue") });
  const erreurs = [];
  const original = console.error;
  console.error = (...args) => erreurs.push(args);
  try {
    const resultat = await publierBrouillonCore(7, { isEditor: editeur, prisma, dryRun: false });
    assert.equal(resultat.ok, false);
    assert.match(resultat.message, /a échoué et rien n'a été enregistré/);
    assert.equal(erreurs.length, 1);
  } finally {
    console.error = original;
  }
});

// Garde-fou sur le câblage : l'action exportée passe bien par le contrôle d'accès
// (isEditor) et le mode simulation ne dépend que de TEST_DRY_RUN === "1".
test("publierBrouillon (actions.js) branche isEditor et TEST_DRY_RUN sur la logique testée", () => {
  const source = readFileSync(new URL("../src/app/test/actions.js", import.meta.url), "utf8");
  assert.match(source, /publierBrouillonCore\(analyseId, \{[\s\S]*isEditor,[\s\S]*prisma,[\s\S]*dryRun: process\.env\.TEST_DRY_RUN === "1"/);
  assert.match(source, /^"use server";/);
});

// ---------- Fiche issue d'une révision : fusion de la PR « Révision <slug> » ----------

const REVISION = { slug: "lepen-budget-immigration", reponses: [], synthese: "s" };
const AVEC_REVISION = { ...BROUILLON, contenuComplet: { titre_fiche: "x", revision: REVISION } };
const PR = { numero: 12, lien: "https://github.com/Perlimpinpin-ai/perlimpinpin/pull/12" };

// Faux GitHub : `appels` liste les appels ; fusionner lève une erreur si interdit.
function fauxGitHub({ verification = { ok: true, pr: PR }, fusion = { ok: true }, fusionAutorisee = true } = {}) {
  const appels = [];
  return {
    appels,
    github: {
      verifier: async (slug) => (appels.push(["verifier", slug]), verification),
      fusionner: async (pr) => {
        appels.push(["fusionner", pr]);
        if (!fusionAutorisee) throw new Error("FUSION INTERDITE");
        return fusion;
      },
    },
  };
}

test("révision : publication sans champ revision, GitHub n'est jamais appelé (comportement inchangé)", async () => {
  const { prisma } = fausseBase({ ecrituresAutorisees: true, analyse: { ...BROUILLON, contenuComplet: { titre_fiche: "x" } } });
  const interdit = { verifier: () => assert.fail("pas d'appel GitHub"), fusionner: () => assert.fail("pas d'appel GitHub") };
  const resultat = await publierBrouillonCore(7, { isEditor: editeur, prisma, dryRun: false, github: interdit, maintenant });
  assert.deepEqual(resultat, {
    ok: true,
    simulation: false,
    analyseId: 7,
    propositionId: 70,
    candidatId: 3,
    candidatNom: "David Lisnard",
    publieLe: CLIC.toISOString(),
  });
});

test("révision : PR non fusionnable → refus avec la raison et le lien, rien n'est écrit ni fusionné", async () => {
  for (const dryRun of [false, true]) {
    const { prisma, journal } = fausseBase({ analyse: AVEC_REVISION, ecrituresAutorisees: false });
    const { github, appels } = fauxGitHub({
      verification: { ok: false, raison: "la pull request #12 a des conflits avec main (dirty)", lien: PR.lien },
      fusionAutorisee: false,
    });
    const resultat = await publierBrouillonCore(7, { isEditor: editeur, prisma, dryRun, github });
    assert.equal(resultat.ok, false);
    assert.equal(
      resultat.message,
      "La révision n'est pas fusionnable : la pull request #12 a des conflits avec main (dirty). Rien n'a été publié.",
    );
    assert.equal(resultat.lienPR, PR.lien);
    assert.ok(!journal.includes("$transaction"));
    assert.deepEqual(appels, [["verifier", "lepen-budget-immigration"]]);
  }
});

test("révision : publication puis fusion squash de la PR", async () => {
  const { prisma, journal } = fausseBase({ analyse: AVEC_REVISION, ecrituresAutorisees: true });
  const { github, appels } = fauxGitHub();
  const resultat = await publierBrouillonCore(7, { isEditor: editeur, prisma, dryRun: false, github });
  assert.equal(resultat.ok, true);
  assert.deepEqual(resultat.revision, { slug: "lepen-budget-immigration", fusionnee: true, lienPR: PR.lien });
  assert.equal(resultat.avertissement, undefined);
  // Vérification avant la transaction, fusion après.
  assert.deepEqual(appels, [
    ["verifier", "lepen-budget-immigration"],
    ["fusionner", { slug: "lepen-budget-immigration", numero: 12 }],
  ]);
  assert.ok(journal.includes("tx.candidat.update"));
});

test("révision : la fusion échoue après publication → fiche publiée, avertissement", async () => {
  for (const github of [
    fauxGitHub({ fusion: { ok: false, raison: "GitHub refuse la fusion (405) : Base branch was modified" } }).github,
    fauxGitHub({ fusionAutorisee: false }).github, // GitHub injoignable
  ]) {
    const { prisma, journal } = fausseBase({ analyse: AVEC_REVISION, ecrituresAutorisees: true });
    const resultat = await publierBrouillonCore(7, { isEditor: editeur, prisma, dryRun: false, github });
    assert.equal(resultat.ok, true);
    assert.equal(resultat.simulation, false);
    assert.equal(resultat.propositionId, 70);
    assert.match(resultat.avertissement, /^Fiche publiée, mais les réponses aux commentaires n'ont pas pu être publiées : /);
    assert.deepEqual(resultat.revision, { slug: "lepen-budget-immigration", fusionnee: false, lienPR: PR.lien });
    assert.ok(journal.includes("tx.analyse.updateMany") && journal.includes("tx.candidat.update"));
  }
});

test("révision : simulation → vérification seulement, aucune écriture, aucune fusion", async () => {
  const { prisma, journal } = fausseBase({ analyse: AVEC_REVISION, ecrituresAutorisees: false });
  const { github, appels } = fauxGitHub({ fusionAutorisee: false });
  const resultat = await publierBrouillonCore(7, { isEditor: editeur, prisma, dryRun: true, github });
  assert.equal(resultat.ok, true);
  assert.equal(resultat.simulation, true);
  assert.match(resultat.message, /serait publiée .* Puis la pull request #12 \(révision « lepen-budget-immigration »\) serait fusionnée \(squash\)/);
  assert.deepEqual(appels, [["verifier", "lepen-budget-immigration"]]);
  assert.ok(!journal.includes("$transaction"));
});

test("révision : GitHub non configuré → refus avant toute écriture", async () => {
  const { prisma, journal } = fausseBase({ analyse: AVEC_REVISION });
  const resultat = await publierBrouillonCore(7, { isEditor: editeur, prisma, dryRun: false });
  assert.match(resultat.message, /n'est pas fusionnable : accès à GitHub non configuré\. Rien n'a été publié\./);
  assert.ok(!journal.includes("$transaction"));
});

test("Réessayer la fusion : fiche déjà publiée seulement, aucune écriture en base", async () => {
  const publiee = { ...AVEC_REVISION, statut: "publie" };

  const succes = fausseBase({ analyse: publiee });
  const gh = fauxGitHub();
  assert.deepEqual(await fusionnerRevisionCore(7, { isEditor: editeur, prisma: succes.prisma, dryRun: false, github: gh.github }), {
    ok: true,
    simulation: false,
    analyseId: 7,
    propositionId: 70,
    revision: { slug: "lepen-budget-immigration", fusionnee: true, lienPR: PR.lien },
  });
  assert.equal(gh.appels.length, 2);
  assert.ok(succes.journal.every((a) => !/update|\$transaction/.test(a)));

  const echec = await fusionnerRevisionCore(7, {
    isEditor: editeur,
    prisma: fausseBase({ analyse: publiee }).prisma,
    dryRun: false,
    github: fauxGitHub({ fusion: { ok: false, raison: "GitHub a répondu 500 (la fusion)." } }).github,
  });
  assert.equal(echec.ok, false);
  assert.equal(echec.avertissement, true);
  assert.equal(echec.lienPR, PR.lien);

  const options = (analyse, isEditor = editeur) => ({ isEditor, prisma: fausseBase({ analyse }).prisma, github: fauxGitHub().github });
  assert.deepEqual(await fusionnerRevisionCore(7, options(publiee, pasEditeur)), { ok: false, message: "Non autorisé." });
  assert.match((await fusionnerRevisionCore(7, options(AVEC_REVISION))).message, /Publie d'abord/);
  assert.match((await fusionnerRevisionCore(7, options({ ...BROUILLON, statut: "publie" }))).message, /ne vient pas d'une révision/);

  const sim = fauxGitHub({ fusionAutorisee: false });
  const resultatSim = await fusionnerRevisionCore(7, { isEditor: editeur, prisma: fausseBase({ analyse: publiee }).prisma, dryRun: true, github: sim.github });
  assert.equal(resultatSim.simulation, true);
  assert.deepEqual(sim.appels.map((a) => a[0]), ["verifier"]);
});

test("actions.js : GitHub branché (src/lib/github.js), avertissement affiché sans redirection", () => {
  const source = readFileSync(new URL("../src/app/test/actions.js", import.meta.url), "utf8");
  assert.match(source, /publierBrouillonCore\(analyseId, \{[\s\S]*?github,[\s\S]*?\}\)/);
  assert.match(source, /fusionnerRevisionCore\(analyseId, \{[\s\S]*?isEditor,[\s\S]*?dryRun: process\.env\.TEST_DRY_RUN === "1",[\s\S]*?github,/);
  assert.match(source, /from "@\/lib\/github"/);
  assert.match(source, /if \(resultat\.avertissement\) return resultat;/);
});

test("révision déjà fusionnée à la main : publication en base, aucune tentative de fusion", async () => {
  const { prisma, journal } = fausseBase({ analyse: AVEC_REVISION, ecrituresAutorisees: true });
  const { github, appels } = fauxGitHub({ verification: { ok: true, dejaFusionnee: true, pr: PR }, fusionAutorisee: false });
  const resultat = await publierBrouillonCore(7, { isEditor: editeur, prisma, dryRun: false, github });
  assert.equal(resultat.ok, true);
  assert.deepEqual(resultat.revision, { slug: "lepen-budget-immigration", fusionnee: true, dejaFusionnee: true, lienPR: PR.lien });
  assert.equal(resultat.avertissement, undefined);
  assert.deepEqual(appels, [["verifier", "lepen-budget-immigration"]]);
  assert.ok(journal.includes("tx.candidat.update"));

  const sim = fauxGitHub({ verification: { ok: true, dejaFusionnee: true, pr: PR }, fusionAutorisee: false });
  const simulation = await publierBrouillonCore(7, { isEditor: editeur, prisma: fausseBase({ analyse: AVEC_REVISION }).prisma, dryRun: true, github: sim.github });
  assert.match(simulation.message, /déjà fusionnée/);
});
