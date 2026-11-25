import test from "node:test";
import assert from "node:assert/strict";
import { envoiMailAutorise } from "../src/lib/envoi-mail-autorise.js";

// Garde-fou des mails du Club : jamais depuis une preview Vercel (base partagée
// avec la production), jamais depuis `next dev`.

test("production Vercel : autorisé", () => {
  assert.equal(envoiMailAutorise({ VERCEL: "1", VERCEL_ENV: "production" }), true);
});

test("preview, development ou Vercel sans VERCEL_ENV : bloqué", () => {
  assert.equal(envoiMailAutorise({ VERCEL: "1", VERCEL_ENV: "preview" }), false);
  assert.equal(envoiMailAutorise({ VERCEL: "1", VERCEL_ENV: "development" }), false);
  assert.equal(envoiMailAutorise({ VERCEL_ENV: "preview" }), false);
  assert.equal(envoiMailAutorise({ VERCEL: "1" }), false);
  assert.equal(envoiMailAutorise({ VERCEL_ENV: "Production" }), false); // casse exacte exigée
});

test("next dev en local : bloqué ; script en ligne de commande : autorisé", () => {
  assert.equal(envoiMailAutorise({ NODE_ENV: "development" }), false);
  assert.equal(envoiMailAutorise({}), true);
});
