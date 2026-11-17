import { test } from "node:test";
import assert from "node:assert/strict";
import { CARACTERES_PAR_TOKEN, TOKENS_SORTIE, choisirFichesReel, usageEstimeReel } from "./lib/reel-lot.js";

test("usageEstimeReel : premier essai et pire cas (second essai)", () => {
  const { min, max } = usageEstimeReel(32_000);
  assert.equal(min.input_tokens, Math.ceil(32_000 / CARACTERES_PAR_TOKEN));
  assert.equal(min.output_tokens, TOKENS_SORTIE);
  assert.ok(max.input_tokens > 2 * min.input_tokens);
  assert.equal(max.output_tokens, 2 * TOKENS_SORTIE);
});

test("choisirFichesReel : dernière analyse de chaque fiche, sans Reel, n premières", () => {
  const analyses = [
    { id: 10, proposition: { id: 1 } },
    { id: 9, proposition: { id: 2 } },
    { id: 8, proposition: { id: 1 } },
    { id: 7, proposition: { id: 3 } },
    { id: 6, proposition: { id: 4 } },
  ];
  assert.deepEqual(choisirFichesReel(analyses, new Set([9]), 2).map((a) => a.id), [10, 7]);
  assert.deepEqual(choisirFichesReel(analyses, new Set(), 10).map((a) => a.id), [10, 9, 7, 6]);
});
