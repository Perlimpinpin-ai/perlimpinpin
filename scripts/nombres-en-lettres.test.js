import { test } from "node:test";
import assert from "node:assert/strict";
import { nombreEnLettres, scoreEnLettres } from "../src/lib/nombres-en-lettres.js";

test("nombreEnLettres : unités et dizaines simples", () => {
  assert.equal(nombreEnLettres(0), "zéro");
  assert.equal(nombreEnLettres(1), "un");
  assert.equal(nombreEnLettres(10), "dix");
  assert.equal(nombreEnLettres(16), "seize");
  assert.equal(nombreEnLettres(17), "dix-sept");
  assert.equal(nombreEnLettres(19), "dix-neuf");
  assert.equal(nombreEnLettres(20), "vingt");
  assert.equal(nombreEnLettres(30), "trente");
  assert.equal(nombreEnLettres(60), "soixante");
});

test("nombreEnLettres : « et un » et traits d'union", () => {
  assert.equal(nombreEnLettres(21), "vingt et un");
  assert.equal(nombreEnLettres(22), "vingt-deux");
  assert.equal(nombreEnLettres(38), "trente-huit");
  assert.equal(nombreEnLettres(41), "quarante et un");
  assert.equal(nombreEnLettres(61), "soixante et un");
  assert.equal(nombreEnLettres(69), "soixante-neuf");
});

test("nombreEnLettres : soixante-dix, quatre-vingts, cent", () => {
  assert.equal(nombreEnLettres(70), "soixante-dix");
  assert.equal(nombreEnLettres(71), "soixante et onze");
  assert.equal(nombreEnLettres(72), "soixante-douze");
  assert.equal(nombreEnLettres(77), "soixante-dix-sept");
  assert.equal(nombreEnLettres(79), "soixante-dix-neuf");
  assert.equal(nombreEnLettres(80), "quatre-vingts");
  assert.equal(nombreEnLettres(81), "quatre-vingt-un");
  assert.equal(nombreEnLettres(90), "quatre-vingt-dix");
  assert.equal(nombreEnLettres(91), "quatre-vingt-onze");
  assert.equal(nombreEnLettres(99), "quatre-vingt-dix-neuf");
  assert.equal(nombreEnLettres(100), "cent");
});

test("nombreEnLettres : tous les entiers de 0 à 100 ont une forme", () => {
  for (let n = 0; n <= 100; n += 1) assert.match(nombreEnLettres(n), /^[a-zé -]+$/);
});

test("nombreEnLettres : refuse hors plage ou non entier", () => {
  assert.throws(() => nombreEnLettres(-1), RangeError);
  assert.throws(() => nombreEnLettres(101), RangeError);
  assert.throws(() => nombreEnLettres(3.5), RangeError);
});

test("scoreEnLettres : entier ou une décimale", () => {
  assert.equal(scoreEnLettres(38), "trente-huit");
  assert.equal(scoreEnLettres(38.5), "trente-huit virgule cinq");
  assert.equal(scoreEnLettres(22.04), "vingt-deux");
  assert.equal(scoreEnLettres(100), "cent");
});
