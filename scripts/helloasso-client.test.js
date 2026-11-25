import test from "node:test";
import assert from "node:assert/strict";
import { HelloassoError, getOrder, listMembershipOrders } from "../src/lib/helloasso.js";

// Client HTTP HelloAsso avec un faux fetch : jeton mis en cache, pagination,
// erreurs passagères ou définitives. Aucun appel réseau.

const CONFIG = {
  clientId: "id",
  clientSecret: "secret",
  organisation: "perlimpinpin",
  formulaires: ["adhesion-club"],
  apiBase: "https://api.helloasso-sandbox.com",
  sandbox: true,
};

function fauxFetch(repondre) {
  const appels = [];
  globalThis.fetch = async (url, options = {}) => {
    const u = new URL(url);
    appels.push({ chemin: u.pathname, params: u.searchParams, options });
    const [status, corps] = repondre(u, options, appels.length);
    return new Response(JSON.stringify(corps), { status, headers: { "Content-Type": "application/json" } });
  };
  return appels;
}

const jetonOk = (n = 1) => [200, { access_token: `jeton-${n}`, refresh_token: `refresh-${n}`, expires_in: 1799 }];

test("getOrder : un seul jeton pour plusieurs appels, envoyé en Bearer", async () => {
  // compte distinct pour ne pas hériter du cache d'un autre test
  const config = { ...CONFIG, clientId: "cache" };
  const appels = fauxFetch((u) => (u.pathname === "/oauth2/token" ? jetonOk() : [200, { id: Number(u.pathname.split("/").pop()) }]));
  assert.deepEqual(await getOrder(config, 12), { id: 12 });
  assert.deepEqual(await getOrder(config, 13), { id: 13 });
  const jetons = appels.filter((a) => a.chemin === "/oauth2/token");
  assert.equal(jetons.length, 1);
  assert.equal(new URLSearchParams(jetons[0].options.body).get("grant_type"), "client_credentials");
  assert.equal(appels[1].chemin, "/v5/orders/12");
  assert.equal(appels[1].options.headers.Authorization, "Bearer jeton-1");
});

test("getOrder : 404 définitif, 500 passager, 401 → nouveau jeton puis nouvel essai", async () => {
  fauxFetch((u) => (u.pathname === "/oauth2/token" ? jetonOk() : [404, {}]));
  await assert.rejects(getOrder({ ...CONFIG, clientId: "a" }, 1), (e) => e instanceof HelloassoError && e.passagere === false);

  fauxFetch((u) => (u.pathname === "/oauth2/token" ? jetonOk() : [503, {}]));
  await assert.rejects(getOrder({ ...CONFIG, clientId: "b" }, 1), (e) => e.passagere === true && e.status === 503);

  let premier = true;
  const appels = fauxFetch((u) => {
    if (u.pathname === "/oauth2/token") return jetonOk();
    if (premier) {
      premier = false;
      return [401, {}];
    }
    return [200, { id: 1 }];
  });
  assert.deepEqual(await getOrder({ ...CONFIG, clientId: "c" }, 1), { id: 1 });
  assert.equal(appels.filter((a) => a.chemin === "/oauth2/token").length, 2);

  fauxFetch(() => [401, {}]);
  await assert.rejects(getOrder({ ...CONFIG, clientId: "d" }, 1), (e) => e.passagere === true);
  await assert.rejects(getOrder(CONFIG, "12"), (e) => e.passagere === false);
});

test("listMembershipOrders : suit le continuationToken jusqu'à la dernière page", async () => {
  const page = (n, debut) => Array.from({ length: n }, (_, i) => ({ id: debut + i }));
  const appels = fauxFetch((u) => {
    if (u.pathname === "/oauth2/token") return jetonOk();
    const token = u.searchParams.get("continuationToken");
    if (!token) return [200, { data: page(100, 1), pagination: { continuationToken: "p2" } }];
    return [200, { data: page(3, 101), pagination: { continuationToken: "p3" } }];
  });
  const from = new Date("2026-01-01T00:00:00Z");
  const commandes = await listMembershipOrders({ ...CONFIG, clientId: "liste" }, { from });
  assert.equal(commandes.length, 103);
  const lectures = appels.filter((a) => a.chemin !== "/oauth2/token");
  assert.equal(lectures.length, 2);
  assert.equal(lectures[0].chemin, "/v5/organizations/perlimpinpin/forms/Membership/adhesion-club/orders");
  assert.equal(lectures[0].params.get("from"), "2026-01-01T00:00:00.000Z");
  assert.equal(lectures[1].params.get("continuationToken"), "p2");
});

test("jeton refusé : erreur claire, sans le corps de la réponse", async () => {
  fauxFetch(() => [400, { error: "invalid_client", secret: "ne-doit-pas-apparaitre" }]);
  await assert.rejects(getOrder({ ...CONFIG, clientId: "refus" }, 1), (e) => {
    assert.match(e.message, /jeton HelloAsso refusé \(HTTP 400\)/);
    assert.doesNotMatch(e.message, /ne-doit-pas-apparaitre/);
    return true;
  });
});
