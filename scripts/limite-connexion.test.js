import test from "node:test";
import assert from "node:assert/strict";
import {
  FENETRE_MS,
  MAX_ECHECS_EMAIL,
  MAX_ECHECS_IP,
  empreinte,
  estBloque,
  ipDeLaRequete,
} from "../src/lib/limite-connexion-core.js";
import { connexionBloquee, noterEchec } from "../src/lib/limite-connexion.js";

// Limite des essais ratés de connexion au Club : 5 par quart d'heure et par
// adresse, 10 par IP ; repli en mémoire si la table n'existe pas encore.

test("règles : 5 échecs par adresse, 10 par IP, sur 15 minutes", () => {
  assert.equal(MAX_ECHECS_EMAIL, 5);
  assert.equal(MAX_ECHECS_IP, 10);
  assert.equal(FENETRE_MS, 15 * 60 * 1000);
  assert.equal(estBloque({ echecsEmail: 4, echecsIp: 9 }), false);
  assert.equal(estBloque({ echecsEmail: 5 }), true);
  assert.equal(estBloque({ echecsIp: 10 }), true);
});

test("empreintes : jamais l'adresse en clair, dépendent du secret", () => {
  const a = empreinte("email", "camille@exemple.fr", "s1");
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.doesNotMatch(a, /camille/);
  assert.notEqual(a, empreinte("email", "camille@exemple.fr", "s2"));
  assert.notEqual(a, empreinte("ip", "camille@exemple.fr", "s1"));
  assert.equal(empreinte("email", "", "s1"), null);
});

test("IP : première adresse de x-forwarded-for", () => {
  const h = (o) => ({ get: (k) => o[k] ?? null });
  assert.equal(ipDeLaRequete(h({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" })), "203.0.113.7");
  assert.equal(ipDeLaRequete(h({ "x-real-ip": "198.51.100.2" })), "198.51.100.2");
  assert.equal(ipDeLaRequete(h({})), null);
});

// Base simulée : table présente.
function baseAvecTable() {
  const lignes = [];
  return {
    lignes,
    tentativeConnexion: {
      create: async ({ data }) => lignes.push({ ...data, createdAt: new Date() }),
      count: async ({ where }) =>
        lignes.filter((l) => (where.cleEmail ? l.cleEmail === where.cleEmail : l.cleIp === where.cleIp) && l.createdAt >= where.createdAt.gte).length,
    },
  };
}

test("table présente : bloqué au 6e essai pour la même adresse, pas pour une autre", async () => {
  process.env.AUTH_SECRET ??= "secret-de-test";
  const prisma = baseAvecTable();
  const essai = { email: "camille@exemple.fr", ip: "203.0.113.7", prisma };
  for (let i = 0; i < 5; i++) {
    assert.equal(await connexionBloquee(essai), false, `essai ${i + 1}`);
    await noterEchec(essai);
  }
  assert.equal(await connexionBloquee(essai), true);
  assert.equal(await connexionBloquee({ email: "autre@exemple.fr", ip: "198.51.100.9", prisma }), false);
  assert.ok(prisma.lignes.every((l) => !String(l.cleEmail).includes("camille") && l.espace === "relectures"));
});

test("table absente : repli en mémoire, toujours limité, jamais d'erreur", async () => {
  const absente = () => Promise.reject(Object.assign(new Error("TableDoesNotExist"), { code: "P2021" }));
  const prisma = { tentativeConnexion: { create: absente, count: absente } };
  const t0 = 1_800_000_000_000;
  const essai = { email: "repli@exemple.fr", ip: "192.0.2.44", prisma };
  for (let i = 0; i < 5; i++) {
    assert.equal(await connexionBloquee({ ...essai, maintenant: t0 + i }), false);
    await noterEchec({ ...essai, maintenant: t0 + i });
  }
  assert.equal(await connexionBloquee({ ...essai, maintenant: t0 + 10 }), true);
  // Un quart d'heure plus tard, la limite est levée.
  assert.equal(await connexionBloquee({ ...essai, maintenant: t0 + FENETRE_MS + 10 }), false);
});
