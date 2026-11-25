import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { DbNull, deposerFicheCore, lireFile, retirerFicheCore, slugDuFichier } from "../src/lib/file-attente.js";
import { classerEnCours, coutMoyen, resumeTraitement, traiterFile } from "./lib/file-attente-traitement.js";

// File d'attente des fiches d'étape 1 : dépôt, retrait et traitement, avec une
// FAUSSE base en mémoire et un faux pipeline. Aucune connexion, aucun appel payant.

const ROOT = path.resolve(import.meta.dirname, "..");
const FICHE = JSON.parse(readFileSync(path.join(ROOT, "data/relectures/attal-constitution-du-travail.json"), "utf8"));
const TEXTE = JSON.stringify(FICHE);
const oui = async () => true;
const non = async () => false;

// Fausse base : table FicheEtape1 en mémoire, candidats, aucune analyse ni proposition.
function base(lignes = []) {
  const file = lignes.map((l, i) => ({ id: i + 1, statut: "en_attente", createdAt: new Date(2026, 10, i + 1), coutPipeline: null, ...l }));
  const journal = [];
  const correspond = (l, where = {}) =>
    Object.entries(where).every(([k, v]) => {
      if (k === "NOT") return !correspond(l, v);
      if (v && typeof v === "object" && "in" in v) return v.in.includes(l[k]);
      return l[k] === v;
    });
  return {
    file,
    journal,
    candidat: { findMany: async () => [{ nom: "Gabriel Attal" }] },
    analyse: { findFirst: async () => null },
    proposition: { findMany: async () => [] },
    ficheEtape1: {
      findFirst: async ({ where }) => file.find((l) => correspond(l, where)) ?? null,
      findMany: async ({ where = {}, take } = {}) => {
        const r = file.filter((l) => correspond(l, where)).sort((a, b) => a.createdAt - b.createdAt || a.id - b.id);
        return take ? r.slice(0, take) : r;
      },
      create: async ({ data }) => {
        if (file.some((l) => l.slug === data.slug)) throw Object.assign(new Error("unique"), { code: "P2002" });
        const l = { id: file.length + 1, createdAt: new Date(), ...data };
        file.push(l);
        journal.push(["create", l.id]);
        return { id: l.id };
      },
      updateMany: async ({ where, data }) => {
        const r = file.filter((l) => correspond(l, where));
        for (const l of r) Object.assign(l, data);
        journal.push(["updateMany", where.id, data.statut]);
        return { count: r.length };
      },
      update: async ({ where, data }) => {
        const l = file.find((x) => x.id === where.id);
        Object.assign(l, data);
        journal.push(["update", where.id, data.statut]);
        return l;
      },
    },
  };
}

// ---------- dépôt (page /test/depot) ----------

test("slugDuFichier : nom du fichier sans .json ni dossier", () => {
  assert.equal(slugDuFichier("attal-travail.json"), "attal-travail");
  assert.equal(slugDuFichier("C:\\x\\y\\Attal.JSON"), "Attal");
});

test("dépôt : refusé sans mode édition, sans nom, si JSON invalide ; rien n'est écrit", async () => {
  const db = base();
  assert.deepEqual((await deposerFicheCore({ nom: "a.json", texte: TEXTE, deposePar: "Léa" }, { isEditor: non, prisma: db })).erreurs, ["Non autorisé."]);
  assert.match((await deposerFicheCore({ nom: "a.json", texte: TEXTE, deposePar: " " }, { isEditor: oui, prisma: db })).erreurs[0], /Déposé par/);
  assert.match((await deposerFicheCore({ nom: "a.json", texte: "{oups", deposePar: "Léa" }, { isEditor: oui, prisma: db })).erreurs[0], /pas un JSON valide/);
  assert.deepEqual(db.journal, []);
});

test("dépôt : fiche non conforme refusée avec ses erreurs, rien n'est écrit", async () => {
  const db = base();
  const f = structuredClone(FICHE);
  f.relecture.candidat = "Inconnu";
  const r = await deposerFicheCore({ nom: "Mauvais Nom.json", texte: JSON.stringify(f), deposePar: "Léa" }, { isEditor: oui, prisma: db });
  assert.equal(r.ok, false);
  assert.ok(r.erreurs.some((e) => /Nom de fiche invalide/.test(e)));
  assert.ok(r.erreurs.some((e) => /« Inconnu » n'est pas un candidat/.test(e)));
  assert.deepEqual(db.journal, []);
});

test("dépôt : fiche conforme mise en file (source depot, déposée par), doublon refusé ensuite", async () => {
  const db = base();
  const r = await deposerFicheCore({ nom: "attal-travail.json", texte: TEXTE, deposePar: " Léa " }, { isEditor: oui, prisma: db });
  assert.equal(r.ok, true);
  assert.equal(db.file[0].slug, "attal-travail");
  assert.equal(db.file[0].source, "depot");
  assert.equal(db.file[0].deposePar, "Léa");
  assert.equal(db.file[0].statut, "en_attente");
  assert.deepEqual(db.file[0].contenu, FICHE);
  const r2 = await deposerFicheCore({ nom: "attal-travail.json", texte: TEXTE, deposePar: "Léa" }, { isEditor: oui, prisma: db });
  assert.equal(r2.ok, false);
  assert.match(r2.erreurs.join(), /déjà dans la file/);
});

test("dépôt : une fiche en erreur ou retirée est remise en attente avec le nouveau contenu", async () => {
  const db = base([{ slug: "attal-travail", statut: "erreur", contenu: {}, erreurs: ["x"], source: "claude" }]);
  const r = await deposerFicheCore({ nom: "attal-travail.json", texte: TEXTE, deposePar: "Léa" }, { isEditor: oui, prisma: db });
  assert.deepEqual([r.ok, r.id, r.remplace], [true, 1, true]);
  assert.equal(db.file.length, 1);
  assert.equal(db.file[0].statut, "en_attente");
  assert.equal(db.file[0].erreurs, DbNull);
  assert.equal(db.file[0].source, "depot");
});

test("dépôt : mode simulation, rien n'est écrit", async () => {
  const db = base();
  const r = await deposerFicheCore({ nom: "attal-travail.json", texte: TEXTE, deposePar: "Léa" }, { isEditor: oui, prisma: db, dryRun: true });
  assert.deepEqual([r.ok, r.simulation], [true, true]);
  assert.deepEqual(db.journal, []);
});

test("retrait : seulement en attente ou en erreur, passe en « ignoree » (rien n'est supprimé)", async () => {
  const db = base([{ slug: "a", statut: "en_attente" }, { slug: "b", statut: "traitee" }, { slug: "c", statut: "erreur" }]);
  assert.deepEqual(await retirerFicheCore(1, { isEditor: non, prisma: db }), { ok: false, message: "Non autorisé." });
  assert.equal((await retirerFicheCore(1, { isEditor: oui, prisma: db })).ok, true);
  assert.equal((await retirerFicheCore(2, { isEditor: oui, prisma: db })).ok, false);
  assert.equal((await retirerFicheCore(3, { isEditor: oui, prisma: db })).ok, true);
  assert.deepEqual(db.file.map((l) => l.statut), ["ignoree", "traitee", "ignoree"]);
  assert.equal(db.file.length, 3);
});

test("lireFile : candidat et titre lus dans le bloc relecture, erreurs en liste", async () => {
  const db = base([{ slug: "a", contenu: FICHE, erreurs: ["e1"] }, { slug: "b", contenu: { x: 1 }, erreurs: null }]);
  const l = await lireFile(db);
  assert.equal(l[0].candidat, "Gabriel Attal");
  assert.equal(l[0].titre, FICHE.relecture.titre);
  assert.deepEqual(l[0].erreurs, ["e1"]);
  assert.deepEqual([l[1].candidat, l[1].erreurs], [null, []]);
  assert.equal("contenu" in l[0], false);
});

// ---------- traitement (npm run file-attente) ----------

const RESULTAT = { ecrit: true, analyseId: 321, score: 41, coutPipeline: { coutEstimeTotal: 0.62 }, versionBasique: { erreurs: [] }, reseaux: { erreurs: [] } };

test("traitement : plus anciennes d'abord, contrôle refait, en_cours puis traitee avec analyseId, coût et date", async () => {
  const f2 = structuredClone(FICHE);
  f2.relecture.mesure_initiale = "Autre mesure";
  const db = base([
    { slug: "recente", contenu: f2, createdAt: new Date(2026, 10, 10) },
    { slug: "ancienne", contenu: FICHE, createdAt: new Date(2026, 10, 2) },
  ]);
  const vus = [];
  const lancerPipeline = async (fiche, params) => {
    vus.push(fiche.slug);
    assert.equal(db.file.find((l) => l.id === fiche.id).statut, "en_cours");
    assert.equal("relecture" in params.analyse, false);
    assert.equal(params.candidat, "Gabriel Attal");
    return { ...RESULTAT, analyseId: 300 + fiche.id };
  };
  const quand = new Date("2026-11-16T10:00:00Z");
  const { resultats } = await traiterFile({ db, lancerPipeline, maintenant: () => quand, log: () => {} });
  assert.deepEqual(vus, ["ancienne", "recente"]);
  const ancienne = db.file.find((l) => l.slug === "ancienne");
  assert.equal(ancienne.statut, "traitee");
  assert.equal(ancienne.analyseId, 302);
  assert.deepEqual(ancienne.coutPipeline, { coutEstimeTotal: 0.62 });
  assert.equal(ancienne.traiteeAt, quand);
  assert.deepEqual(resultats.map((r) => r.etat), ["ok", "ok"]);
});

test("traitement : contrôle refusé → erreur enregistrée, aucun pipeline, fiche suivante traitée", async () => {
  const mauvaise = structuredClone(FICHE);
  mauvaise.limites = "texte — simple";
  const f2 = structuredClone(FICHE);
  f2.relecture.mesure_initiale = "Autre mesure";
  const db = base([{ slug: "mauvaise", contenu: mauvaise }, { slug: "bonne", contenu: f2 }]);
  const vus = [];
  await traiterFile({ db, lancerPipeline: async (f) => (vus.push(f.slug), RESULTAT), log: () => {} });
  assert.deepEqual(vus, ["bonne"]);
  const m = db.file[0];
  assert.equal(m.statut, "erreur");
  assert.ok(m.erreurs.some((e) => /Tiret cadratin/.test(e)));
  assert.ok(m.erreurs.some((e) => /Structure d'étape 1 : limites/.test(e)));
});

test("traitement : échec du pipeline → erreur avec le message, et on continue", async () => {
  const f2 = structuredClone(FICHE);
  f2.relecture.mesure_initiale = "Autre mesure";
  const db = base([{ slug: "a", contenu: FICHE }, { slug: "b", contenu: f2 }]);
  let n = 0;
  const { resultats } = await traiterFile({
    db,
    lancerPipeline: async () => {
      if (n++ === 0) throw new Error("Étape 3 : JSON illisible");
      return RESULTAT;
    },
    log: () => {},
  });
  assert.equal(db.file[0].statut, "erreur");
  assert.deepEqual(db.file[0].erreurs, ["Pipeline : Étape 3 : JSON illisible"]);
  assert.equal(db.file[0].coutPipeline, DbNull);
  assert.equal(db.file[1].statut, "traitee");
  assert.deepEqual(resultats.map((r) => r.etat), ["erreur", "ok"]);
});

test("traitement : résultat sans écriture en base → erreur", async () => {
  const db = base([{ slug: "a", contenu: FICHE }]);
  await traiterFile({ db, lancerPipeline: async () => ({ ecrit: false, raison: "seuil_score" }), log: () => {} });
  assert.equal(db.file[0].statut, "erreur");
  assert.match(db.file[0].erreurs[0], /rien écrit en base \(seuil_score\)/);
});

test("simulation : contrôles seulement, aucun pipeline, aucune écriture", async () => {
  const mauvaise = structuredClone(FICHE);
  mauvaise.relecture.theme = "Inconnu";
  const db = base([{ slug: "a", contenu: FICHE }, { slug: "b", contenu: mauvaise }]);
  const { resultats } = await traiterFile({
    db,
    simulation: true,
    lancerPipeline: async () => assert.fail("pipeline lancé en simulation"),
    log: () => {},
  });
  assert.deepEqual(resultats.map((r) => r.etat), ["a_lancer", "erreur"]);
  assert.deepEqual(db.journal, []);
  assert.deepEqual(db.file.map((l) => l.statut), ["en_attente", "en_attente"]);
  const texte = resumeTraitement({ resultats, signalements: [] }, { simulation: true, coutEstime: 0.5 });
  assert.match(texte, /1 fiche\(s\) × ~0\.50 \$ = ~0\.50 \$/);
});

test("--max et --fiches : nombre limité, seulement les fiches demandées, les autres signalées", async () => {
  const f2 = structuredClone(FICHE);
  f2.relecture.mesure_initiale = "Autre mesure";
  const db = base([
    { slug: "a", contenu: FICHE },
    { slug: "b", contenu: f2 },
    { slug: "c", contenu: FICHE, statut: "traitee" },
  ]);
  const vus = [];
  const lancer = async (f) => (vus.push(f.slug), RESULTAT);
  await traiterFile({ db, lancerPipeline: lancer, max: 1, log: () => {} });
  assert.deepEqual(vus, ["a"]);
  const { resultats } = await traiterFile({ db, lancerPipeline: lancer, fiches: ["b", "c", "zz"], log: () => {} });
  assert.deepEqual(vus, ["a", "b"]);
  assert.deepEqual(
    resultats.map((r) => [r.slug, r.etat]),
    [["c", "ignoree"], ["zz", "ignoree"], ["b", "ok"]],
  );
});

test("fiche en cours depuis plus d'une heure : signalée, jamais relancée", async () => {
  const maintenant = new Date("2026-11-16T12:00:00Z");
  const db = base([
    { slug: "bloquee", contenu: FICHE, statut: "en_cours", coutPipeline: { enCoursDepuis: "2026-11-16T10:30:00Z" } },
    { slug: "recente", contenu: FICHE, statut: "en_cours", coutPipeline: { enCoursDepuis: "2026-11-16T11:50:00Z" } },
  ]);
  const { resultats, signalements } = await traiterFile({
    db,
    maintenant: () => maintenant,
    lancerPipeline: async () => assert.fail("relancée"),
    log: () => {},
  });
  assert.deepEqual(resultats, []);
  assert.match(signalements[0], /« bloquee » \(n° 1\) bloquée en cours depuis 90 min : non relancée/);
  assert.match(signalements[1], /« recente » \(n° 2\) en cours depuis 10 min/);
  assert.deepEqual(db.file.map((l) => l.statut), ["en_cours", "en_cours"]);
  // Début inconnu (insérée en_cours à la main) : considérée comme bloquée.
  assert.equal(classerEnCours([{ id: 3, slug: "x", coutPipeline: null }], maintenant)[0].bloquee, true);
});

test("coutMoyen : moyenne des 20 premiers coûts valides", () => {
  assert.equal(coutMoyen([]), null);
  assert.equal(coutMoyen([undefined, null, 1, 3, "2", 0]), 2);
  assert.equal(coutMoyen([...Array(20).fill(1), 100]), 1);
});

test("résumé : OK / erreur / ignorée, score, lien /test/<id>, coût total", () => {
  const texte = resumeTraitement({
    resultats: [
      { slug: "a", etat: "ok", analyseId: 321, score: 41, cout: 0.6, avertissements: [] },
      { slug: "b", etat: "erreur", erreurs: ["Pipeline : x"] },
      { slug: "c", etat: "ignoree", detail: "statut traitee, pas en attente" },
    ],
    signalements: [],
  });
  assert.match(texte, /OK {6}a : score 41\/100, https:\/\/perlimpinpin\.ai\/test\/321, coût ~0\.60 \$/);
  assert.match(texte, /ERREUR {2}b :\n {10}- Pipeline : x/);
  assert.match(texte, /IGNORÉE c : statut traitee/);
  assert.match(texte, /Coût total : ~0\.60 \$/);
});
