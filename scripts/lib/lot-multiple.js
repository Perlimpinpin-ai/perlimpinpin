// Lot de PLUSIEURS requêtes pour l'API Message Batches d'Anthropic (moitié
// prix), utilisé par la revue du dimanche (scripts/revue-dimanche.js) : tri de
// toutes les annotations de la semaine en un lot, puis révision de toutes les
// fiches concernées en un second lot. Même style d'appel HTTP que
// scripts/lib/claude-lot.js (lot d'une seule requête, pour analyze.js).
// fetch est injectable : testé par scripts/lot-multiple.test.js.
//
// Les résultats arrivent dans n'importe quel ordre : ils sont rangés par
// custom_id, jamais par position.

import { sanitizeContentBlocks } from "./claude-lot.js";

const CUSTOM_ID = /^[a-zA-Z0-9_-]{1,64}$/;

async function lireJson(response, quoi) {
  if (!response.ok) {
    const corps = await response.text();
    throw new Error(`Erreur API Anthropic, ${quoi} (${response.status}) : ${corps.slice(0, 500)}`);
  }
  return response.json();
}

// requetes : [{ custom_id, params }]. Renvoie l'identifiant du lot.
export async function soumettreLot(requetes, { baseUrl, headers, fetchImpl = fetch }) {
  if (!Array.isArray(requetes) || requetes.length === 0) throw new Error("Lot vide.");
  const ids = new Set();
  for (const r of requetes) {
    if (!CUSTOM_ID.test(r.custom_id ?? "")) throw new Error(`custom_id invalide : ${r.custom_id}`);
    if (ids.has(r.custom_id)) throw new Error(`custom_id en double : ${r.custom_id}`);
    ids.add(r.custom_id);
  }
  const lot = await lireJson(
    await fetchImpl(`${baseUrl}/messages/batches`, { method: "POST", headers, body: JSON.stringify({ requests: requetes }) }),
    "envoi du lot",
  );
  return lot.id;
}

// Attend la fin du lot ; renvoie l'objet lot terminé, ou lève une erreur
// après attenteMaxMs (le lot est alors annulé).
export async function attendreLot(id, { baseUrl, headers, fetchImpl = fetch, attenteMaxMs = 6 * 60 * 60_000, intervalleMs = 30_000, attendre }) {
  const pause = attendre ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const debut = Date.now();
  for (;;) {
    const lot = await lireJson(await fetchImpl(`${baseUrl}/messages/batches/${id}`, { method: "GET", headers }), "suivi du lot");
    if (lot.processing_status === "ended") return lot;
    if (Date.now() - debut > attenteMaxMs) {
      await fetchImpl(`${baseUrl}/messages/batches/${id}/cancel`, { method: "POST", headers }).catch(() => {});
      throw new Error(`Lot ${id} : pas terminé après ${Math.round(attenteMaxMs / 60_000)} min, annulé.`);
    }
    await pause(intervalleMs);
  }
}

// Résultats d'un lot terminé : Map custom_id → { ok: true, message } ou { ok: false, erreur }.
export async function lireResultats(lot, { headers, fetchImpl = fetch }) {
  const reponse = await fetchImpl(lot.results_url, { method: "GET", headers });
  if (!reponse.ok) throw new Error(`Erreur API Anthropic, résultats du lot ${lot.id} (${reponse.status})`);
  const resultats = new Map();
  for (const ligne of (await reponse.text()).split("\n")) {
    if (!ligne.trim()) continue;
    const { custom_id, result } = JSON.parse(ligne);
    if (result?.type === "succeeded") {
      const message = result.message;
      message.content = sanitizeContentBlocks(message.content ?? []);
      resultats.set(custom_id, { ok: true, message });
    } else {
      const detail = result?.type === "errored" ? JSON.stringify(result.error).slice(0, 300) : result?.type ?? "inconnu";
      resultats.set(custom_id, { ok: false, erreur: detail });
    }
  }
  return resultats;
}

// Texte final d'un message (blocs texte après le dernier outil).
export function texteFinal(message) {
  const blocs = message?.content ?? [];
  let dernierOutil = -1;
  blocs.forEach((b, i) => {
    if (b.type === "server_tool_use" || b.type === "web_search_tool_result") dernierOutil = i;
  });
  return blocs
    .slice(dernierOutil + 1)
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
}
