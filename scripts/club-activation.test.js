import test from "node:test";
import assert from "node:assert/strict";
import {
  DUREE_ACTIVATION_MS,
  creerJetonActivation,
  jetonActivationValide,
  lienActivation,
} from "../src/lib/club-activation-core.js";
import { creerJeton } from "../src/lib/mot-de-passe-oublie-core.js";
import { creerSession } from "../src/lib/relecture-auth-core.js";

// Lien « Choisir mon mot de passe » du mail de bienvenue : jeton signé, 7 jours,
// lié au compte (id + e-mail), jamais interchangeable avec un autre jeton.

const SECRET = "secret-de-test-assez-long-pour-hmac";
const T0 = 1_800_000_000_000;
const COMPTE = { adherentId: 42, email: "camille@exemple.fr" };

const valide = (valeur, extra = {}) =>
  jetonActivationValide({ secret: SECRET, valeur, ...COMPTE, maintenant: T0, ...extra });

test("un jeton fraîchement créé est valable pour son compte", () => {
  const jeton = creerJetonActivation({ secret: SECRET, ...COMPTE, maintenant: T0 });
  assert.match(jeton, /^42\.\d+\.[A-Za-z0-9_-]+$/);
  assert.equal(valide(jeton), true);
  assert.equal(valide(jeton, { maintenant: T0 + DUREE_ACTIVATION_MS - 1 }), true);
});

test("expiré au bout de 7 jours", () => {
  const jeton = creerJetonActivation({ secret: SECRET, ...COMPTE, maintenant: T0 });
  assert.equal(valide(jeton, { maintenant: T0 + DUREE_ACTIVATION_MS }), false);
});

test("refusé pour un autre compte, une autre adresse ou un autre secret", () => {
  const jeton = creerJetonActivation({ secret: SECRET, ...COMPTE, maintenant: T0 });
  assert.equal(valide(jeton, { adherentId: 43 }), false);
  assert.equal(valide(jeton, { email: "autre@exemple.fr" }), false);
  assert.equal(valide(jeton, { secret: "autre-secret" }), false);
  assert.equal(valide(jeton, { secret: "" }), false);
});

test("jeton falsifié, mal formé ou à expiration trop lointaine : refusé", () => {
  const jeton = creerJetonActivation({ secret: SECRET, ...COMPTE, maintenant: T0 });
  const [id, exp, sig] = jeton.split(".");
  assert.equal(valide(`${id}.${Number(exp) + 1}.${sig}`), false);
  assert.equal(valide(`${id}.${exp}.${sig.slice(0, -1)}${sig.endsWith("A") ? "B" : "A"}`), false);
  assert.equal(valide("pas un jeton"), false);
  assert.equal(valide(null), false);
  const lointain = creerJetonActivation({ secret: SECRET, ...COMPTE, maintenant: T0 + DUREE_ACTIVATION_MS });
  assert.equal(valide(lointain), false);
});

test("un jeton de réinitialisation ou une session ne vaut jamais activation", () => {
  const reinit = creerJeton({ secret: SECRET, espace: "relectures", id: 42, motDePasseHash: "x", maintenant: T0 });
  assert.equal(valide(reinit), false);
  const session = creerSession({ secret: SECRET, adherentId: 42, maintenant: T0 });
  assert.equal(valide(session), false);
});

test("création impossible sans secret, sans id ou sans adresse", () => {
  assert.throws(() => creerJetonActivation({ secret: "", ...COMPTE }));
  assert.throws(() => creerJetonActivation({ secret: SECRET, adherentId: 0, email: COMPTE.email }));
  assert.throws(() => creerJetonActivation({ secret: SECRET, adherentId: 42, email: "" }));
});

test("lien : domaine fixé par l'environnement, jamais par la requête", () => {
  assert.equal(
    lienActivation({ jeton: "42.1.abc", env: { VERCEL_ENV: "production" } }),
    "https://perlimpinpin.ai/relectures/activer?jeton=42.1.abc",
  );
  assert.equal(
    lienActivation({ jeton: "42.1.abc", env: { VERCEL_ENV: "preview", VERCEL_BRANCH_URL: "pp-git-club-ouvert.vercel.app" } }),
    "https://pp-git-club-ouvert.vercel.app/relectures/activer?jeton=42.1.abc",
  );
});
