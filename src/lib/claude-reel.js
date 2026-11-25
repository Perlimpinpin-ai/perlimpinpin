import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { requeteReel } from "./reel-generation.js";

// Appel à Claude pour le bouton « Générer le Reel » (côté serveur seulement :
// lit ANTHROPIC_API_KEY et data/prompt-reel.md). Même requête que
// scripts/reel.js (requeteReel), en streaming : un flux actif n'est jamais
// coupé, un flux muet plus de 60 s l'est.
// data/prompt-reel.md est embarqué dans les fonctions des pages /test/reels
// (outputFileTracingIncludes, next.config.mjs).

const URL_API = "https://api.anthropic.com/v1/messages";
const INACTIVITE_MAX_MS = 60_000;

export function cleApiConfiguree() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function lirePromptReel() {
  return readFile(join(process.cwd(), "data", "prompt-reel.md"), "utf-8");
}

function lireAvecDelai(lecteur) {
  return new Promise((resolve, reject) => {
    const minuteur = setTimeout(() => {
      lecteur.cancel().catch(() => {});
      reject(new Error(`Claude ne répond plus depuis ${INACTIVITE_MAX_MS / 1000} s.`));
    }, INACTIVITE_MAX_MS);
    lecteur.read().then(
      (resultat) => {
        clearTimeout(minuteur);
        resolve(resultat);
      },
      (erreur) => {
        clearTimeout(minuteur);
        reject(erreur);
      },
    );
  });
}

// Lit le flux SSE de l'API et renvoie { texte, usage, stop_reason }.
export async function lireFluxClaude(corps) {
  const lecteur = corps.getReader();
  const decodeur = new TextDecoder();
  let tampon = "";
  let texte = "";
  let usage = {};
  let stopReason = null;

  const traiter = (ligne) => {
    if (!ligne.startsWith("data: ")) return;
    const charge = ligne.slice(6).trim();
    if (!charge) return;
    const evenement = JSON.parse(charge);
    if (evenement.type === "message_start") usage = { ...evenement.message?.usage };
    else if (evenement.type === "content_block_delta" && evenement.delta?.type === "text_delta") texte += evenement.delta.text;
    else if (evenement.type === "message_delta") {
      usage = { ...usage, ...evenement.usage };
      if (evenement.delta?.stop_reason) stopReason = evenement.delta.stop_reason;
    } else if (evenement.type === "error") throw new Error(`Erreur de l'API Anthropic : ${evenement.error?.message ?? "inconnue"}`);
  };

  while (true) {
    const { done, value } = await lireAvecDelai(lecteur);
    if (done) break;
    tampon += decodeur.decode(value, { stream: true });
    const lignes = tampon.split("\n");
    tampon = lignes.pop() ?? "";
    lignes.forEach((ligne) => traiter(ligne.trim()));
  }
  if (tampon.trim()) traiter(tampon.trim());
  return { texte, usage, stop_reason: stopReason };
}

// Un appel : message → { texte, usage }. Lève une erreur lisible sinon.
export async function appelerClaudeReel(message) {
  return appelerClaude(requeteReel(message));
}

// Prompt du récit (data/prompt-recit.md), embarqué dans la fonction de
// /test/reseaux/[id] (outputFileTracingIncludes, next.config.mjs).
export async function lirePromptRecit() {
  return readFile(join(process.cwd(), "data", "prompt-recit.md"), "utf-8");
}

// Un appel avec un corps de requête déjà construit (requeteReel, requeteRecit…)
// → { texte, usage, stop_reason }. Lève une erreur lisible sinon. Utilisable
// aussi depuis un script Node (scripts/recit.js).
export async function appelerClaude(corps) {
  const reponse = await fetch(URL_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(corps),
  });
  if (!reponse.ok) {
    const detail = (await reponse.text()).slice(0, 300);
    throw new Error(`Erreur de l'API Anthropic (${reponse.status}) : ${detail}`);
  }
  return lireFluxClaude(reponse.body);
}
