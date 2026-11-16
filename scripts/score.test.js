import test from "node:test";
import assert from "node:assert/strict";
import { getScoreBadge } from "../src/lib/score.js";

// Barème d'appréciation du Score Perlimpinpin (borne basse incluse) :
// 0-19 Irréaliste, 20-34 Fragile, 35-49 Partiellement fondé,
// 50-64 Plausible sous condition, 65-79 Solide et chiffré, 80-100 Exemplaire.

test("getScoreBadge : Irréaliste de 0 à 19", () => {
  assert.equal(getScoreBadge(0).label, "Irréaliste");
  assert.equal(getScoreBadge(19).label, "Irréaliste");
});

test("getScoreBadge : Fragile de 20 à 34", () => {
  assert.equal(getScoreBadge(20).label, "Fragile");
  assert.equal(getScoreBadge(34).label, "Fragile");
});

test("getScoreBadge : Partiellement fondé de 35 à 49", () => {
  assert.equal(getScoreBadge(35).label, "Partiellement fondé");
  assert.equal(getScoreBadge(49).label, "Partiellement fondé");
});

test("getScoreBadge : Plausible sous condition de 50 à 64", () => {
  assert.equal(getScoreBadge(50).label, "Plausible sous condition");
  assert.equal(getScoreBadge(64).label, "Plausible sous condition");
});

test("getScoreBadge : Solide et chiffré de 65 à 79", () => {
  assert.equal(getScoreBadge(65).label, "Solide et chiffré");
  assert.equal(getScoreBadge(79).label, "Solide et chiffré");
});

test("getScoreBadge : Exemplaire de 80 à 100", () => {
  assert.equal(getScoreBadge(80).label, "Exemplaire");
  assert.equal(getScoreBadge(100).label, "Exemplaire");
});

test("getScoreBadge : un score décimal reste dans la tranche de sa borne basse", () => {
  // Les scores stockés peuvent être décimaux : 79.9 n'est pas encore Exemplaire.
  assert.equal(getScoreBadge(79.9).label, "Solide et chiffré");
  assert.equal(getScoreBadge(34.9).label, "Fragile");
  assert.equal(getScoreBadge(19.9).label, "Irréaliste");
});
