// Mode lot des appels Claude du pipeline (scripts/analyze.js) : chaque appel
// passe par l'API Message Batches d'Anthropic, facturée à 50 % du prix normal,
// en échange d'un délai (la plupart des lots finissent en moins d'une heure,
// 24 h au maximum). Un lot d'UNE seule requête par appel : la remise ne dépend
// pas de la taille du lot, donc la logique séquentielle du pipeline (pause_turn,
// nouveaux essais…) reste identique. Activé par CLAUDE_LOT=1 ; sans cette
// variable, rien ne passe par ce module (sauf sanitizeContentBlocks).
// Pas de streaming en lot : le message arrive complet.

export const MODE_LOT = process.env.CLAUDE_LOT === "1";

const ATTENTE_MAX_PAR_DEFAUT_MIN = 40;
const INTERVALLE_PAR_DEFAUT_MS = 20_000;
// Une ligne d'attente environ toutes les 2 minutes, pour savoir que le
// script n'est pas bloqué.
const AFFICHAGE_ATTENTE_MS = 120_000;
const CUSTOM_ID_MAX = 64;

// Un pause_turn (limite d'itérations du tool serveur atteinte) peut couper
// le flux en plein milieu d'un bloc, ex. un bloc "thinking" tout juste
// démarré, sans texte. Renvoyer un tel bloc incomplet dans le tour suivant
// fait échouer la validation de l'API ("each thinking block must contain
// thinking"). On retire les blocs visiblement incomplets avant de
// reconstruire l'historique de conversation.
export function sanitizeContentBlocks(blocks) {
  return blocks.filter((block) => {
    if (!block) return false;
    if (block.type === "thinking") {
      return typeof block.thinking === "string" && block.thinking.length > 0;
    }
    if (block.type === "text") {
      return typeof block.text === "string" && block.text.length > 0;
    }
    return true;
  });
}

// custom_id accepté par l'API : 64 caractères au plus, [a-zA-Z0-9_-] seulement.
export function customId(label, maintenant = Date.now()) {
  const suffixe = `-${maintenant}`;
  const slug = String(label ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, CUSTOM_ID_MAX - "ppp-".length - suffixe.length)
    .replace(/-+$/, "");
  return `ppp-${slug || "appel"}${suffixe}`;
}

function attenteMaxParDefaut() {
  const minutes = Number(process.env.CLAUDE_LOT_ATTENTE_MAX_MIN);
  return (Number.isFinite(minutes) && minutes > 0 ? minutes : ATTENTE_MAX_PAR_DEFAUT_MIN) * 60_000;
}

async function lireJson(response, quoi) {
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Erreur API Anthropic, ${quoi} (${response.status}) : ${errorBody}`);
  }
  return response.json();
}

// Mêmes lignes que readStreamedMessage (scripts/analyze.js), après coup.
function afficherRecherches(content) {
  let searchCount = 0;
  for (const block of content) {
    if (block.type === "server_tool_use" && block.name === "web_search") {
      searchCount++;
      console.log(`  🔎 Recherche web #${searchCount} : "${block.input?.query ?? "?"}"`);
    } else if (block.type === "web_search_tool_result") {
      const resultCount = Array.isArray(block.content) ? block.content.length : "?";
      console.log(`    ↳ ${resultCount} résultat(s) reçu(s)`);
    }
  }
}

const minutes = (ms) => Math.round(ms / 60_000);

// Renvoie le message (même forme que readStreamedMessage, usage.service_tier
// à "batch"), ou null si le lot a été annulé, a expiré ou a dépassé
// attenteMaxMs (annulé alors) : l'appelant se replie sur un appel direct.
// Lève une erreur si la requête est en erreur dans le lot.
export async function envoyerEnLot(
  body,
  { label, baseUrl, headers, attenteMaxMs = attenteMaxParDefaut(), intervalleMs = INTERVALLE_PAR_DEFAUT_MS, fetchImpl = fetch },
) {
  const { stream, ...params } = body;
  const custom_id = customId(label);

  let lot = await lireJson(
    await fetchImpl(`${baseUrl}/messages/batches`, {
      method: "POST",
      headers,
      body: JSON.stringify({ requests: [{ custom_id, params }] }),
    }),
    `envoi du lot (${label})`,
  );
  console.log(`  ⏳ Lot ${lot.id} envoyé (${label}), moitié prix, attente du résultat…`);

  const debut = Date.now();
  let dernierAffichage = debut;
  while (lot.processing_status !== "ended") {
    if (Date.now() - debut > attenteMaxMs) {
      await lireJson(
        await fetchImpl(`${baseUrl}/messages/batches/${lot.id}/cancel`, { method: "POST", headers }),
        `annulation du lot (${label})`,
      );
      console.log(`  ⚠️  Lot ${lot.id} (${label}) : pas de résultat après ${minutes(attenteMaxMs)} min, lot annulé.`);
      return null;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalleMs));
    lot = await lireJson(
      await fetchImpl(`${baseUrl}/messages/batches/${lot.id}`, { method: "GET", headers }),
      `suivi du lot (${label})`,
    );
    if (Date.now() - dernierAffichage >= AFFICHAGE_ATTENTE_MS) {
      dernierAffichage = Date.now();
      console.log(`  ⏳ ${label} : ${minutes(dernierAffichage - debut)} min…`);
    }
  }

  const reponse = await fetchImpl(lot.results_url, { method: "GET", headers });
  if (!reponse.ok) {
    const errorBody = await reponse.text();
    throw new Error(`Erreur API Anthropic, résultat du lot (${label}) (${reponse.status}) : ${errorBody}`);
  }
  const ligne = (await reponse.text()).split("\n").find((l) => l.trim());
  if (!ligne) throw new Error(`Lot ${lot.id} (${label}) : résultat vide.`);
  const { result } = JSON.parse(ligne);

  if (result?.type === "succeeded") {
    console.log(`  ✓ Lot ${lot.id} (${label}) terminé en ${minutes(Date.now() - debut)} min.`);
    const message = result.message;
    message.content = sanitizeContentBlocks(message.content ?? []);
    message.usage = { ...message.usage, service_tier: "batch" };
    afficherRecherches(message.content);
    return message;
  }
  if (result?.type === "errored") {
    throw new Error(`Lot ${lot.id} (${label}) en erreur : ${JSON.stringify(result.error)}`);
  }
  console.log(`  ⚠️  Lot ${lot.id} (${label}) : ${result?.type ?? "résultat inconnu"}.`);
  return null;
}
