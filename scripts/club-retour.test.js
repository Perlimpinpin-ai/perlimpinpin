import test from "node:test";
import assert from "node:assert/strict";
import { ADHESION_URL_DEFAUT, retourValide, urlAdhesion } from "../src/lib/club-retour-core.js";
import { cheminRelectureProtege } from "../src/lib/relecture-auth-core.js";

// Retour vers la fiche d'origine après adhésion : seuls les chemins de fiche
// du site sont mémorisés, jamais une adresse externe.

test("chemins de fiche acceptés", () => {
  assert.equal(retourValide("/declarations/12"), "/declarations/12");
  assert.equal(retourValide("/declarations/12?vue=expert"), "/declarations/12?vue=expert");
  assert.equal(retourValide("/declarations/12#commenter"), "/declarations/12#commenter");
  assert.equal(retourValide("/declarations/12?vue=expert#commenter"), "/declarations/12?vue=expert#commenter");
  assert.equal(retourValide("/declarations/12#commenter?vue=expert"), null);
});

test("tout le reste est refusé", () => {
  for (const c of [
    null,
    "",
    "https://evil.example/declarations/12",
    "//evil.example/declarations/12",
    "/declarations/0",
    "/declarations/12/../../admin",
    "/declarations/12?vue=expert&x=1",
    "/declarations/abc",
    "/test/12",
    "/declarations/12#x",
    "/declarations/12\n",
  ]) {
    assert.equal(retourValide(c), null, String(c));
  }
});

test("page d'adhésion : HelloAsso uniquement", () => {
  assert.equal(urlAdhesion({}), ADHESION_URL_DEFAUT);
  const formulaire = "https://www.helloasso.com/associations/perlimpinpin-ai/adhesions/club";
  assert.equal(urlAdhesion({ CLUB_ADHESION_URL: formulaire }), formulaire);
  assert.equal(urlAdhesion({ CLUB_ADHESION_URL: "https://evil.example/" }), ADHESION_URL_DEFAUT);
  assert.equal(urlAdhesion({ CLUB_ADHESION_URL: "http://www.helloasso.com/x" }), ADHESION_URL_DEFAUT);
});

test("les pages d'adhésion sont publiques, le reste du Club reste protégé", () => {
  assert.equal(cheminRelectureProtege("/relectures/adherer"), false);
  assert.equal(cheminRelectureProtege("/relectures/merci"), false);
  assert.equal(cheminRelectureProtege("/Relectures/Activer/"), false);
  assert.equal(cheminRelectureProtege("/relectures"), true);
  assert.equal(cheminRelectureProtege("/relectures/index.html"), true);
});
