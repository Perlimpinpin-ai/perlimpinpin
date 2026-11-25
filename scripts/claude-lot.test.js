import { mock, test } from "node:test";
import assert from "node:assert/strict";
import { customId, envoyerEnLot } from "./lib/claude-lot.js";

// Les lignes « ⏳ Lot … » d’envoyerEnLot font échouer le lanceur de
// `npm test` (« Unable to deserialize cloned data ») : on les fait taire.
mock.method(console, "log", () => {});

const BASE = "https://api.test/v1";
const message = {
  id: "msg_1",
  type: "message",
  role: "assistant",
  content: [{ type: "thinking", thinking: "" }, { type: "text", text: "OK" }],
  stop_reason: "end_turn",
  usage: { input_tokens: 10, output_tokens: 2, service_tier: "standard" },
};

// Faux serveur : le lot reste « in_progress » pendant `toursEnCours` suivis,
// puis se termine avec `resultat` (ligne JSONL). Garde la trace des appels.
function fauxFetch({ resultat, toursEnCours = 1 }) {
  const appels = [];
  let suivis = 0;
  const json = (data) => ({ ok: true, status: 200, json: async () => data, text: async () => JSON.stringify(data) });
  const fetchImpl = async (url, options = {}) => {
    appels.push({ url, options });
    if (url === `${BASE}/messages/batches` && options.method === "POST") {
      return json({ id: "lot_1", processing_status: "in_progress" });
    }
    if (url === `${BASE}/messages/batches/lot_1/cancel`) return json({ id: "lot_1", processing_status: "canceling" });
    if (url === `${BASE}/messages/batches/lot_1`) {
      suivis++;
      const fini = toursEnCours !== Infinity && suivis > toursEnCours;
      return json({ id: "lot_1", processing_status: fini ? "ended" : "in_progress", results_url: `${BASE}/resultats/lot_1` });
    }
    if (url === `${BASE}/resultats/lot_1`) {
      const ligne = JSON.stringify({ custom_id: "x", result: resultat });
      return { ok: true, status: 200, text: async () => `\n${ligne}\n` };
    }
    throw new Error(`URL inattendue : ${url}`);
  };
  return { fetchImpl, appels };
}

const options = (fetchImpl, extra = {}) => ({
  label: "Étape 3 bis",
  baseUrl: BASE,
  headers: { "x-api-key": "test" },
  intervalleMs: 1,
  attenteMaxMs: 60_000,
  fetchImpl,
  ...extra,
});

test("lot : succès, sans stream dans les params, service_tier à batch", async () => {
  const { fetchImpl, appels } = fauxFetch({ resultat: { type: "succeeded", message: structuredClone(message) } });
  const body = { model: "claude-sonnet-5", max_tokens: 20, messages: [{ role: "user", content: "x" }], stream: true };
  const recu = await envoyerEnLot(body, options(fetchImpl));

  const envoi = JSON.parse(appels[0].options.body);
  assert.equal(envoi.requests.length, 1);
  assert.ok(!("stream" in envoi.requests[0].params));
  assert.equal(envoi.requests[0].params.max_tokens, 20);
  assert.equal(body.stream, true, "le body d'origine n'est pas modifié");
  assert.equal(recu.usage.service_tier, "batch");
  assert.equal(recu.usage.input_tokens, 10);
  // Même nettoyage que readStreamedMessage : le bloc thinking vide est retiré.
  assert.deepEqual(recu.content, [{ type: "text", text: "OK" }]);
  assert.ok(appels.every((a) => a.options.headers?.["x-api-key"] === "test"));
});

test("lot : errored lève une erreur avec le détail", async () => {
  const { fetchImpl } = fauxFetch({
    resultat: { type: "errored", error: { type: "error", error: { type: "invalid_request_error", message: "max_tokens trop grand" } } },
  });
  await assert.rejects(envoyerEnLot({ model: "m" }, options(fetchImpl)), /en erreur.*max_tokens trop grand/);
});

test("lot : expired renvoie null (repli)", async () => {
  const { fetchImpl } = fauxFetch({ resultat: { type: "expired" } });
  assert.equal(await envoyerEnLot({ model: "m" }, options(fetchImpl)), null);
});

test("lot : attente dépassée, lot annulé puis null", async () => {
  const { fetchImpl, appels } = fauxFetch({ resultat: null, toursEnCours: Infinity });
  assert.equal(await envoyerEnLot({ model: "m" }, options(fetchImpl, { attenteMaxMs: 5 })), null);
  const annulation = appels.find((a) => a.url.endsWith("/cancel"));
  assert.ok(annulation);
  assert.equal(annulation.options.method, "POST");
  assert.ok(!appels.some((a) => a.url.includes("/resultats/")));
});

test("lot : réponse HTTP non-OK, erreur avec statut et corps", async () => {
  const fetchImpl = async () => ({ ok: false, status: 429, text: async () => "rate_limit_error" });
  await assert.rejects(envoyerEnLot({ model: "m" }, options(fetchImpl)), /\(429\) : rate_limit_error/);
});

test("lot : custom_id valide même avec un label accentué", () => {
  const id = customId("Étape 3 bis", 1_790_000_000_000);
  assert.equal(id, "ppp-etape-3-bis-1790000000000");
  const long = customId("réparation JSON (fiche-complete-de-la-mesure-avec-un-slug-tres-tres-long)");
  assert.ok(long.length <= 64, long);
  for (const label of ["Étape 3 bis", "réparation JSON (étape 3)", "", "€€€"]) {
    assert.match(customId(label), /^[a-zA-Z0-9_-]{1,64}$/);
  }
});
