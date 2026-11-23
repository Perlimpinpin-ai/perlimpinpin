import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { DbNull } from "../src/lib/file-attente.js";
import { MAX_PAR_LANCEMENT, coutEstimeParFiche, lancerFileAttenteCore } from "../src/lib/file-attente-lancer.js";
import { declencherFileAttente, traitementFileEnCours } from "../src/lib/github.js";

// Boutons « Lancer les étapes 2 et 3 » / « Traiter toute la file » de
// /test/depot : contrôles avant le déclenchement du workflow GitHub, avec une
// FAUSSE base et un faux GitHub. Aucune connexion, aucun appel payant.

const ROOT = path.resolve(import.meta.dirname, "..");
const oui = async () => true;
const non = async () => false;

function base(lignes = []) {
  const file = lignes.map((l, i) => ({ id: i + 1, statut: "en_attente", createdAt: new Date(2026, 10, i + 1), ...l }));
  const journal = [];
  const correspond = (l, where = {}) =>
    Object.entries(where).every(([k, v]) => (v && typeof v === "object" && "in" in v ? v.in.includes(l[k]) : l[k] === v));
  return {
    file,
    journal,
    analyse: { findMany: async () => [{ coutPipeline: { coutEstimeTotal: 1 } }, { coutPipeline: { coutEstimeTotal: 2 } }, { coutPipeline: null }] },
    ficheEtape1: {
      findFirst: async ({ where }) => file.find((l) => correspond(l, where)) ?? null,
      findMany: async ({ where = {} } = {}) => file.filter((l) => correspond(l, where)),
      updateMany: async ({ where, data }) => {
        const r = file.filter((l) => correspond(l, where));
        for (const l of r) Object.assign(l, data);
        journal.push(["updateMany", where.id, data.statut]);
        return { count: r.length };
      },
    },
  };
}

// Faux GitHub : run déjà en cours ou non ; chaque déclenchement est noté.
function github({ run = null, echec = null } = {}) {
  const appels = [];
  return {
    appels,
    enCoursGitHub: async () => {
      appels.push(["enCours"]);
      return run;
    },
    declencher: async (params) => {
      appels.push(["declencher", params]);
      if (echec) throw new Error(echec);
      return { lien: "https://github.com/run/7" };
    },
  };
}

const lancer = (entree, db, gh, options = {}) =>
  lancerFileAttenteCore(entree, { isEditor: oui, prisma: db, enCoursGitHub: gh.enCoursGitHub, declencher: gh.declencher, ...options });

const declenche = (gh) => gh.appels.some(([a]) => a === "declencher");

test("refusé sans mode édition : ni base ni GitHub", async () => {
  const db = base([{ slug: "a" }]);
  db.ficheEtape1.findFirst = () => assert.fail("base lue sans accès");
  const gh = github();
  const r = await lancer({ slug: "a" }, db, gh, { isEditor: non });
  assert.equal(r.ok, false);
  assert.match(r.message, /réservé/);
  assert.deepEqual(gh.appels, []);
});

test("une fiche : refusée si absente, traitée, retirée ou nom invalide ; rien n'est lancé", async () => {
  const db = base([{ slug: "traitee", statut: "traitee" }, { slug: "retiree", statut: "ignoree" }]);
  const gh = github();
  assert.match((await lancer({ slug: "absente" }, db, gh)).message, /introuvable/);
  assert.match((await lancer({ slug: "traitee" }, db, gh)).message, /n'est pas en attente \(elle est traitée\)/);
  assert.match((await lancer({ slug: "retiree" }, db, gh)).message, /n'est pas en attente \(elle est retirée\)/);
  assert.match((await lancer({ slug: "../x" }, db, gh)).message, /introuvable/);
  assert.match((await lancer({}, db, gh)).message, /introuvable/);
  assert.equal(declenche(gh), false);
  assert.deepEqual(db.journal, []);
});

test("traitement déjà en cours (fiche en_cours en base) : refusé, GitHub non appelé", async () => {
  const db = base([{ slug: "a" }, { slug: "b", statut: "en_cours" }]);
  const gh = github();
  for (const entree of [{ slug: "a" }, { toute: true }]) {
    const r = await lancer(entree, db, gh);
    assert.equal(r.ok, false);
    assert.equal(r.message, "Un traitement est déjà en cours (fiche « b »).");
  }
  assert.deepEqual(gh.appels, []);
});

test("traitement déjà en cours (run GitHub en attente, aucune fiche encore en_cours) : refusé, lien du run", async () => {
  const db = base([{ slug: "a" }]);
  const gh = github({ run: { lien: "https://github.com/run/6" } });
  const r = await lancer({ slug: "a" }, db, gh);
  assert.deepEqual(r, { ok: false, message: "Un traitement est déjà en cours.", lien: "https://github.com/run/6" });
  assert.equal(declenche(gh), false);
});

test("une fiche en attente : workflow lancé pour elle seule (max 1), rien d'écrit en base", async () => {
  const db = base([{ slug: "tondelier-isf-climatique" }]);
  const gh = github();
  const r = await lancer({ slug: "tondelier-isf-climatique" }, db, gh);
  assert.deepEqual(r, { ok: true, nombre: 1, lien: "https://github.com/run/7" });
  assert.deepEqual(gh.appels.at(-1), ["declencher", { fiches: ["tondelier-isf-climatique"], max: 1 }]);
  assert.deepEqual(db.journal, []);
});

test("relance d'une fiche en erreur : repasse en attente PUIS déclenchement", async () => {
  const db = base([{ slug: "a", statut: "erreur", erreurs: ["Pipeline : boum"] }]);
  const gh = github();
  gh.declencher = async (params) => {
    assert.equal(db.file[0].statut, "en_attente");
    gh.appels.push(["declencher", params]);
    return { lien: "l" };
  };
  const r = await lancer({ slug: "a" }, db, gh);
  assert.equal(r.ok, true);
  assert.deepEqual(db.journal, [["updateMany", 1, "en_attente"]]);
  assert.equal(db.file[0].erreurs, DbNull);
});

test("échec de GitHub : message clair, la fiche relancée reste en attente", async () => {
  const db = base([{ slug: "a", statut: "erreur" }]);
  const r = await lancer({ slug: "a" }, db, github({ echec: "GitHub a répondu 500." }));
  assert.equal(r.ok, false);
  assert.match(r.message, /GitHub a répondu 500\. La fiche est repassée en attente/);
  assert.equal(db.file[0].statut, "en_attente");
});

test("toute la file : refusée si vide ; sinon au plus 5 fiches (max), sans liste de slugs", async () => {
  const gh = github();
  assert.match((await lancer({ toute: true }, base([{ slug: "a", statut: "traitee" }]), gh)).message, /Aucune fiche en attente/);
  assert.equal(declenche(gh), false);

  const db = base(Array.from({ length: 7 }, (_, i) => ({ slug: `f${i}` })));
  const r = await lancer({ toute: true }, db, gh);
  assert.deepEqual(r, { ok: true, nombre: MAX_PAR_LANCEMENT, lien: "https://github.com/run/7" });
  assert.deepEqual(gh.appels.at(-1), ["declencher", { fiches: [], max: 5 }]);
});

test("mode simulation (TEST_DRY_RUN) : contrôles faits, ni écriture ni déclenchement", async () => {
  const db = base([{ slug: "a", statut: "erreur" }]);
  const gh = github();
  const r = await lancer({ slug: "a" }, db, gh, { dryRun: true });
  assert.equal(r.simulation, true);
  assert.equal(declenche(gh), false);
  assert.deepEqual(db.journal, []);
});

test("coût estimé par fiche : moyenne des analyses qui ont un coût", async () => {
  assert.equal(await coutEstimeParFiche(base()), 1.5);
});

// ---------- appels à l'API GitHub (fetch simulé) ----------

function fauxFetch({ runs = {}, dispatch = { status: 200, body: { html_url: "https://github.com/run/42" } } } = {}) {
  const appels = [];
  const fetchImpl = async (url, options = {}) => {
    appels.push({ url, options });
    if (url.includes("/runs?")) {
      const status = new URL(url).searchParams.get("status");
      return { ok: true, status: 200, json: async () => ({ workflow_runs: runs[status] || [] }) };
    }
    return { ok: dispatch.status < 300, status: dispatch.status, json: async () => dispatch.body };
  };
  return { appels, fetchImpl };
}

test("GitHub : workflow_dispatch de traiter-file-attente.yml sur main, entrées fiches et max", async () => {
  const gh = fauxFetch();
  assert.deepEqual(await declencherFileAttente({ fiches: ["a", "b"], max: 2, token: "t", fetchImpl: gh.fetchImpl }), { lien: "https://github.com/run/42" });
  const envoi = gh.appels.at(-1);
  assert.match(envoi.url, /actions\/workflows\/traiter-file-attente\.yml\/dispatches$/);
  assert.equal(envoi.options.method, "POST");
  assert.equal(envoi.options.headers.Authorization, "Bearer t");
  assert.deepEqual(JSON.parse(envoi.options.body), { ref: "main", inputs: { fiches: "a,b", max: "2" }, return_run_details: true });
});

test("GitHub : refus sans jeton, avec un slug invalide ou un max hors bornes ; erreur 403 expliquée", async () => {
  const gh = fauxFetch();
  await assert.rejects(declencherFileAttente({ fiches: [], max: 5, token: "", fetchImpl: gh.fetchImpl }), /GITHUB_DISPATCH_TOKEN absent/);
  await assert.rejects(declencherFileAttente({ fiches: ["A;rm"], max: 1, token: "t", fetchImpl: gh.fetchImpl }), /invalide/);
  await assert.rejects(declencherFileAttente({ fiches: [], max: 0, token: "t", fetchImpl: gh.fetchImpl }), /invalide/);
  assert.equal(gh.appels.length, 0);
  const refus = fauxFetch({ dispatch: { status: 403, body: {} } });
  await assert.rejects(declencherFileAttente({ fiches: [], max: 5, token: "t", fetchImpl: refus.fetchImpl }), /Read and write/);
});

test("GitHub : traitement en cours repéré parmi les runs en attente ou en cours", async () => {
  assert.equal(await traitementFileEnCours({ token: "t", fetchImpl: fauxFetch().fetchImpl }), null);
  const gh = fauxFetch({ runs: { in_progress: [{ html_url: "https://github.com/run/9" }] } });
  assert.deepEqual(await traitementFileEnCours({ token: "t", fetchImpl: gh.fetchImpl }), { lien: "https://github.com/run/9" });
  assert.match(gh.appels[0].url, /traiter-file-attente\.yml\/runs\?status=queued/);
});

// ---------- option --oui du script ----------

test("--oui refusé hors de GitHub Actions, avant toute connexion à la base", () => {
  const env = { ...process.env, DATABASE_URL: "", GITHUB_ACTIONS: "" };
  const r = spawnSync(process.execPath, ["scripts/traiter-file-attente.js", "--oui"], { cwd: ROOT, env, encoding: "utf8" });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /--oui n'est accepté que dans GitHub Actions/);
});
