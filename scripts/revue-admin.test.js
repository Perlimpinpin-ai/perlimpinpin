import test from "node:test";
import assert from "node:assert/strict";
import { publierRevisionCore, reclasserCore, rejeterRevisionCore } from "../src/lib/revue-admin-core.js";
import { declencherRevue } from "../src/lib/github.js";

// Page admin de la revue : publication seulement avec « oui », décision
// unique, reclassement par ajout, « Traiter maintenant ». Base simulée.

const NOTATION = { score_total: 51, degre_preparation: 5, operationnalite_juridique: 5, operationnalite_moyens_total: 16, operationnalite_budgetaire: 6, efficacite: 15 };

function fausseBase({ decisions = [], actuelleId = 100 } = {}) {
  const ecritures = [];
  const source = {
    id: 100,
    propositionId: 12,
    statut: "publie",
    scoreSolidite: 1,
    scoreJuridique: 1,
    scoreOperationnel: 1,
    scoreBudgetaire: 1,
    scorePertinence: 1,
    verdict: "v",
    resumeAccueil: null,
    teaser: null,
    cequiEstEtabli: "",
    cequiEstProbable: "",
    cequiEstDiscutable: "",
    cequiEstInconnu: "",
    sourcesUtilisees: "",
    versionMethodologie: "1.0",
    promptFileModifiedAt: null,
    proposition: { candidatId: 3 },
  };
  const tx = {
    analyse: {
      findFirst: async () => ({ id: actuelleId }),
      create: async ({ data }) => (ecritures.push(["analyse.create", data]), { id: 101 }),
      updateMany: async (q) => (ecritures.push(["analyse.updateMany", q]), { count: 1 }),
      aggregate: async () => ({ _avg: { scoreFaisabilite: 48 } }),
    },
    decisionRevision: { create: async ({ data }) => (ecritures.push(["decision.create", data]), { id: 7 }) },
    candidat: { update: async (q) => (ecritures.push(["candidat.update", q]), {}) },
  };
  return {
    ecritures,
    prisma: {
      ...tx,
      $transaction: async (fn) => fn(tx),
      revisionProposee: {
        findUnique: async ({ where }) =>
          where.id === 5
            ? { id: 5, propositionId: 12, decisions, contenuPropose: { notation_detaillee: NOTATION }, coutPipeline: null, analyseSource: source }
            : null,
      },
      relectureComment: {
        findUnique: async ({ where }) =>
          where.id === "c1" ? { id: "c1", ficheSlug: "fiche-12", tris: [{ id: 1, reponse: "Réponse proposée", createdAt: "2026-11-08T07:10:00Z" }] } : null,
      },
      triAnnotation: { create: async ({ data }) => (ecritures.push(["tri.create", data]), { id: 9, ...data }) },
    },
  };
}

test("publication refusée sans « oui » ou sans accès : rien n'est écrit", async () => {
  for (const [confirmation, isEditor] of [["", true], ["non", true], ["oui", false]]) {
    const { prisma, ecritures } = fausseBase();
    const r = await publierRevisionCore({ revisionId: 5, confirmation, isEditor, prisma });
    assert.equal(r.ok, false);
    assert.equal(ecritures.length, 0);
  }
});

test("publication avec « oui » : nouvelle version créée, ancienne remplacée (statut et date seulement), décision, moyenne, journal", async () => {
  const { prisma, ecritures } = fausseBase();
  const journal = [];
  const maintenant = new Date("2026-11-08T19:05:00Z");
  const r = await publierRevisionCore({ revisionId: 5, confirmation: "oui", isEditor: true, prisma, maintenant, journaliser: (e) => journal.push(e) });
  assert.equal(r.ok, true, r.message);
  assert.deepEqual(ecritures.map(([quoi]) => quoi), ["analyse.create", "analyse.updateMany", "decision.create", "candidat.update"]);
  assert.equal(ecritures[0][1].statut, "publie");
  assert.equal(ecritures[0][1].scoreFaisabilite, 51);
  // Condition 1 : seuls le statut et la date de changement de l'ancienne version.
  assert.deepEqual(ecritures[1][1], { where: { id: 100, statut: "publie" }, data: { statut: "remplacee", updatedAt: maintenant } });
  // Condition 3 : création, remplacement et décision journalisés.
  assert.deepEqual(journal.map((e) => e.type), ["analyse_creee", "analyse_remplacee", "decision_revision"]);
  assert.equal(journal[1].analyseId, 100);
  assert.equal(journal[1].remplaceePar, 101);
  assert.deepEqual(ecritures[2][1], { revisionId: 5, decision: "publiee", analysePublieeId: 101 });
});

test("transaction annulée : rien n'est journalisé", async () => {
  const { prisma } = fausseBase();
  prisma.$transaction = async () => {
    throw new Error("panne");
  };
  const journal = [];
  const r = await publierRevisionCore({ revisionId: 5, confirmation: "oui", isEditor: true, prisma, journaliser: (e) => journal.push(e) });
  assert.equal(r.ok, false);
  assert.equal(journal.length, 0);
});

test("publication refusée si déjà décidée ou si une autre version a été publiée depuis", async () => {
  const deja = fausseBase({ decisions: [{ id: 1, decision: "rejetee", createdAt: "2026-11-08T20:00:00Z" }] });
  assert.equal((await publierRevisionCore({ revisionId: 5, confirmation: "oui", isEditor: true, prisma: deja.prisma })).ok, false);
  const depassee = fausseBase({ actuelleId: 150 });
  const r = await publierRevisionCore({ revisionId: 5, confirmation: "oui", isEditor: true, prisma: depassee.prisma });
  assert.equal(r.ok, false);
  assert.match(r.message, /autre version/);
});

test("rejet : une décision créée, une seule fois", async () => {
  const { prisma, ecritures } = fausseBase();
  assert.equal((await rejeterRevisionCore({ revisionId: 5, isEditor: true, prisma, journaliser: () => {} })).ok, true);
  assert.deepEqual(ecritures, [["decision.create", { revisionId: 5, decision: "rejetee" }]]);
  const deja = fausseBase({ decisions: [{ id: 1, decision: "publiee", createdAt: "x" }] });
  assert.equal((await rejeterRevisionCore({ revisionId: 5, isEditor: true, prisma: deja.prisma })).ok, false);
});

test("reclassement : nouvelle ligne « arno », réponse proposée gardée si vide", async () => {
  const { prisma, ecritures } = fausseBase();
  const r = await reclasserCore({ commentId: "c1", categorie: "argument_ou_source", reponse: "", isEditor: true, prisma, journaliser: () => {} });
  assert.equal(r.ok, true);
  assert.equal(ecritures[0][1].source, "arno");
  assert.equal(ecritures[0][1].reponse, "Réponse proposée");
  assert.equal((await reclasserCore({ commentId: "c1", categorie: "inconnue", isEditor: true, prisma })).ok, false);
  assert.equal((await reclasserCore({ commentId: "zz", categorie: "question", isEditor: true, prisma })).ok, false);
  assert.equal((await reclasserCore({ commentId: "c1", categorie: "question", isEditor: false, prisma })).ok, false);
});

test("« Traiter maintenant » : un seul run par fiche, entrée « fiche »", async () => {
  const appels = [];
  const fetchImpl = async (url, opts = {}) => {
    appels.push({ url, corps: opts.body ? JSON.parse(opts.body) : null });
    if (url.includes("/runs?")) return { ok: true, json: async () => ({ workflow_runs: [] }) };
    return { ok: true, status: 204, json: async () => ({}) };
  };
  const r = await declencherRevue({ propositionId: 12, token: "t", fetchImpl, ref: "main" });
  assert.equal(r.dejaLance, false);
  const envoi = appels.find((a) => a.url.endsWith("/dispatches"));
  assert.match(envoi.url, /revue-dimanche\.yml/);
  assert.deepEqual(envoi.corps.inputs, { fiche: "12" });

  const enCours = async (url) =>
    url.includes("status=queued")
      ? { ok: true, json: async () => ({ workflow_runs: [{ display_title: "Revue fiche 12", html_url: "https://gh/run" }] }) }
      : { ok: true, json: async () => ({ workflow_runs: [] }) };
  assert.deepEqual(await declencherRevue({ propositionId: 12, token: "t", fetchImpl: enCours }), { lien: "https://gh/run", dejaLance: true });
  await assert.rejects(declencherRevue({ propositionId: 0, token: "t", fetchImpl }));
  await assert.rejects(declencherRevue({ propositionId: 12, token: "", fetchImpl }));
});

test("journal : ligne JSON horodatée, écrite aussi dans les journaux du serveur, même si le fichier est impossible", async () => {
  const { journaliser } = await import("../src/lib/journal-insertions.js");
  const lignes = [];
  const sortie = [];
  const ok = journaliser({ type: "analyse_remplacee", analyseId: 100 }, {
    ecrire: (l) => lignes.push(l),
    log: { log: (m) => sortie.push(m) },
    maintenant: new Date("2026-11-08T19:05:00Z"),
  });
  assert.equal(ok, true);
  assert.deepEqual(JSON.parse(lignes[0]), { timestamp: "2026-11-08T19:05:00.000Z", type: "analyse_remplacee", analyseId: 100 });
  assert.match(sortie[0], /^\[insertions\] /);
  const lectureSeule = journaliser({ type: "x" }, { ecrire: () => { throw new Error("EROFS"); }, log: { log: (m) => sortie.push(m) } });
  assert.equal(lectureSeule, false);
  assert.equal(sortie.length, 2);
});
