import test from "node:test";
import assert from "node:assert/strict";
import {
  attributsZone,
  propositionDuSlug,
  sectionIdValide,
  slugFiche,
  zonesPubliques,
} from "../src/lib/fiche-annotations-core.js";
import { posterCommentaire } from "../src/lib/relecture-comments-core.js";

// Annotations du Club sur les fiches publiées : clés, zones publiques (jamais
// de texte de note pour les non-adhérents), enregistrement toujours ouvert.

const ADHERENT = { id: 7, nom: "Camille D.", pseudo: null };
const FERMEE = { reviewDeadline: new Date("2020-01-01T00:00:00Z") };

test("slug de fiche publiée", () => {
  assert.equal(slugFiche(12), "fiche-12");
  assert.equal(propositionDuSlug("fiche-12"), 12);
  for (const s of ["fiche-0", "fiche-", "fiche-12x", "zemmour-rsa", "fiche-1.2", null]) {
    assert.equal(propositionDuSlug(s), null, String(s));
  }
});

test("clés de section", () => {
  for (const ok of ["resume_court", "contexte_national", "analyse_par_criteres.efficacite", "verdict_final"]) {
    assert.equal(sectionIdValide(ok), true, ok);
  }
  for (const ko of ["", "Resume", "a b", "x.y.z", "<script>", "analyse_par_criteres.", null]) {
    assert.equal(sectionIdValide(ko), false, String(ko));
  }
});

test("attributs d'un bloc annotable", () => {
  assert.deepEqual(attributsZone(false, "resume_court", "Résumé"), {});
  assert.deepEqual(attributsZone(true, "bad key", "x"), {});
  assert.deepEqual(attributsZone(true, "resume_court", "Résumé"), {
    "data-comment-target": "",
    "data-anno-cle": "resume_court",
    "data-anno-label": "Résumé",
  });
});

test("zones publiques : passages fusionnés, aucun texte de note ni auteur ni nombre", () => {
  const annotations = [
    { sectionId: "contexte_national", quotedText: "abcdef", startOffset: 10, endOffset: 16, body: "SECRET 1", authorName: "Camille" },
    { sectionId: "contexte_national", quotedText: "defgh", startOffset: 13, endOffset: 18, body: "SECRET 2", authorName: "Léa" },
    { sectionId: "contexte_national", quotedText: "abcdef", startOffset: 10, endOffset: 16, body: "SECRET 3" },
    { sectionId: "contexte_national", quotedText: "xy", startOffset: 40, endOffset: 42, body: "SECRET 4" },
    { sectionId: "verdict_final", quotedText: null, startOffset: null, endOffset: null, body: "SECRET 5" },
  ];
  const zones = zonesPubliques(annotations);
  assert.deepEqual(zones, [
    { sectionId: "contexte_national", quotedText: "abcdefgh", startOffset: 10, endOffset: 18 },
    { sectionId: "contexte_national", quotedText: "xy", startOffset: 40, endOffset: 42 },
    { sectionId: "verdict_final" },
  ]);
  const json = JSON.stringify(zones);
  assert.doesNotMatch(json, /SECRET|Camille|Léa|body|author|createdAt|count/);
});

test("zones publiques : passages incohérents ou clés invalides ignorés", () => {
  const zones = zonesPubliques([
    { sectionId: "x y", quotedText: "a", startOffset: 0, endOffset: 1 },
    { sectionId: "resume_court", quotedText: "abc", startOffset: 0, endOffset: 5 },
  ]);
  assert.deepEqual(zones, [{ sectionId: "resume_court" }]);
  assert.deepEqual(zonesPubliques(null), []);
});

function poster(data, { publiee = { analyseId: 55 }, fiche = FERMEE } = {}) {
  const crees = [];
  return posterCommentaire({
    adherent: ADHERENT,
    data,
    trouverFiche: async () => fiche,
    trouverFichePubliee: async (id) => (id === 12 ? publiee : null),
    creer: async (v) => {
      crees.push(v);
      return { id: "c1", ...v };
    },
  }).then((r) => ({ ...r, crees }));
}

const ANNOT = {
  ficheSlug: "fiche-12",
  sectionId: "contexte_national",
  sectionLabel: "Contexte national",
  body: "Source plus récente : Insee 2026.",
  quotedText: "1,83 million",
  startOffset: 100,
  endOffset: 112,
  analyseId: 55,
  creditAccord: true,
};

test("fiche publiée : annotation toujours ouverte (le chrono ne s'applique pas)", async () => {
  const { status, crees } = await poster(ANNOT);
  assert.equal(status, 201);
  assert.equal(crees.length, 1);
  assert.equal(crees[0].analyseId, 55);
  assert.equal(crees[0].creditAccord, true);
  assert.equal(crees[0].adherentId, 7);
});

test("fiche publiée : accord de crédit absent = refus", async () => {
  const { crees } = await poster({ ...ANNOT, creditAccord: undefined });
  assert.equal(crees[0].creditAccord, false);
  const r = await poster({ ...ANNOT, creditAccord: "oui" });
  assert.equal(r.status, 400);
});

test("fiche publiée : version périmée (409), fiche inconnue (404), clé invalide (400)", async () => {
  assert.equal((await poster({ ...ANNOT, analyseId: 54 })).status, 409);
  assert.equal((await poster({ ...ANNOT, analyseId: "55" })).status, 409);
  assert.equal((await poster({ ...ANNOT, ficheSlug: "fiche-13" })).status, 404);
  assert.equal((await poster(ANNOT, { publiee: null })).status, 404);
  assert.equal((await poster({ ...ANNOT, sectionId: "Contexte national" })).status, 400);
  assert.equal((await poster({ ...ANNOT, ficheSlug: "fiche-abc" })).status, 400);
});

test("archives /relectures : la fermeture par le chrono s'applique toujours", async () => {
  const { status, crees } = await poster({ ...ANNOT, ficheSlug: "zemmour-rsa-trois-ans", sectionId: "zemmour-rsa-trois-ans-score" });
  assert.equal(status, 403);
  assert.equal(crees.length, 0);
});
