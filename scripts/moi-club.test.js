import test from "node:test";
import assert from "node:assert/strict";
import { libelleCompte } from "../src/lib/moi-club.js";

// Bouton du compte dans l'en-tête : pseudo, sinon premier mot du nom ; rien
// (bouton « CLUB ») sans session.

test("libellé du bouton de l'en-tête", () => {
  assert.equal(libelleCompte(null), null);
  assert.equal(libelleCompte({ pseudo: "Zébulon", nomParDefaut: "Test A." }), "Zébulon");
  assert.equal(libelleCompte({ pseudo: null, nomParDefaut: "Test A." }), "Test");
  assert.equal(libelleCompte({ pseudo: "  ", nomParDefaut: "Jean-Pierre M." }), "Jean-Pierre");
  assert.equal(libelleCompte({ nom: "Camille" }), "Camille");
  assert.equal(libelleCompte({}), null);
});
