import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  coutClaude,
  construireMessageReel,
  contenuAvecReel,
  estimationCoutReel,
  fichePourReel,
  genererReelCore,
  jsonDepuisTexte,
  requeteReel,
} from "../src/lib/reel-generation.js";
import { lireFluxClaude } from "../src/lib/claude-reel.js";

const FICHE = {
  titre_fiche: "Carburant à 1,70 €",
  verdict_final: "Le blocage coûte 12 milliards d'euros par an. Le Portugal a essayé en 2022.",
};

function reponseValide() {
  const s = (id, voix, ecran, icone) => ({ id, voix, sousTitres: voix, ecran, icone });
  return {
    scenes: [
      { id: "accroche", voix: "Bloquer le carburant à un euro soixante-dix.", sousTitres: "Bloquer le carburant à 1,70 €.", ecran: { titre: "Le carburant bloqué" }, icone: "pompe" },
      { id: "presentation", voix: "", sousTitres: "", ecran: {} },
      s("tient", "La loi le permet. Ça s'est déjà fait.", { tampon: "C'EST LÉGAL" }, "balance"),
      s("hic", "Sauf que voilà. Quelqu'un doit payer. Vous voyez le problème ?", { chiffre: "Qui paie", legende: "la différence" }, "attention"),
      s("preuve", "Un pays voisin a essayé. Les stations ont manqué de carburant.", { titre: "Un voisin a essayé" }, "globe"),
      s("facture", "La facture se compte en milliards. Elle grimpe avec le baril.", { chiffre: "Des milliards", legende: "par an" }, "billet"),
      s("nuance", "Si le pétrole baisse, la facture fond.", { titre: "Tout dépend du baril" }, "baril"),
      { id: "verdict", voix: "Gare à la panne sèche !", sousTitres: "Gare à la panne sèche !", ecran: {} },
    ],
  };
}

const SILENCE = { warn() {}, error() {} };

test("requête : même modèle et mêmes réglages que la 3 ter, sans outil", () => {
  const corps = requeteReel("bonjour");
  assert.equal(corps.model, "claude-sonnet-5");
  assert.equal(corps.max_tokens, 4000);
  assert.deepEqual(corps.thinking, { type: "disabled" });
  assert.equal(corps.stream, true);
  assert.equal(corps.tools, undefined);
  assert.equal(corps.tool_choice, undefined);
  assert.deepEqual(corps.messages, [{ role: "user", content: "bonjour" }]);
});

test("coût : tarif de claude-sonnet-5 (2 $ / 10 $ par million)", () => {
  assert.equal(coutClaude({ input_tokens: 11409, output_tokens: 1346 }), 0.0363);
  assert.equal(coutClaude({ input_tokens: 1_000_000, service_tier: "batch" }), 1);
  const { min, max } = estimationCoutReel(26970);
  assert.ok(min > 0.03 && min < 0.04, `min ${min}`);
  assert.ok(max > min);
});

test("fiche envoyée au modèle : sans version basique, réseaux, Reel, ancien Reel ni révision", () => {
  const fiche = fichePourReel({ ...FICHE, version_basique: {}, reseaux: {}, reel: {}, reelPrecedent: {}, revision: {} });
  assert.deepEqual(Object.keys(fiche), ["titre_fiche", "verdict_final"]);
  const message = construireMessageReel("PROMPT\r\nligne 2\n", { ...FICHE, reel: { x: 1 } });
  assert.ok(message.startsWith("PROMPT\nligne 2\n\nFICHE FINALE :\n{"));
  assert.ok(!message.includes('"reel"'));
});

test("jsonDepuisTexte : JSON nu, bloc de code, texte autour, refus lisible", () => {
  assert.deepEqual(jsonDepuisTexte('{"a":1}'), { a: 1 });
  assert.deepEqual(jsonDepuisTexte('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(jsonDepuisTexte('Voici : {"a":{"b":2}} fin'), { a: { b: 2 } });
  assert.throws(() => jsonDepuisTexte("pas de json"), /illisible/);
});

test("genererReelCore : premier essai accepté, un seul appel", async () => {
  const messages = [];
  const resultat = await genererReelCore({
    ficheFinale: FICHE,
    candidatNom: "Candidat",
    score: 38,
    prompt: "PROMPT",
    appeler: async (message) => {
      messages.push(message);
      return { texte: JSON.stringify(reponseValide()), usage: { input_tokens: 100, output_tokens: 50 } };
    },
    analyser: (r) => jsonDepuisTexte(r.texte),
    journal: SILENCE,
  });
  assert.equal(messages.length, 1);
  assert.ok(resultat.reel);
  assert.equal(resultat.reel.scenes.length, 8);
  assert.deepEqual(resultat.usage, { input_tokens: 100, output_tokens: 50 });
});

test("genererReelCore : réponse refusée, second essai avec les erreurs, puis accepté", async () => {
  const messages = [];
  const mauvaise = reponseValide();
  mauvaise.scenes[0].icone = "fusee";
  const reponses = [mauvaise, reponseValide()];
  const resultat = await genererReelCore({
    ficheFinale: FICHE,
    candidatNom: "Candidat",
    score: 38,
    prompt: "PROMPT",
    appeler: async (message) => {
      messages.push(message);
      return { texte: JSON.stringify(reponses.shift()), usage: { input_tokens: 10, output_tokens: 5 } };
    },
    analyser: (r) => jsonDepuisTexte(r.texte),
    journal: SILENCE,
  });
  assert.equal(messages.length, 2);
  assert.match(messages[1], /ta réponse précédente a été refusée/);
  assert.match(messages[1], /« fusee » hors de la liste/);
  assert.ok(resultat.reel);
  assert.deepEqual(resultat.usage, { input_tokens: 20, output_tokens: 10 });
});

test("genererReelCore : deux échecs, aucun Reel, erreurs rendues", async () => {
  const resultat = await genererReelCore({
    ficheFinale: FICHE,
    candidatNom: "Candidat",
    score: 38,
    prompt: "PROMPT",
    appeler: async () => ({ texte: "pas de JSON", usage: { input_tokens: 10 } }),
    analyser: (r) => jsonDepuisTexte(r.texte),
    journal: SILENCE,
  });
  assert.equal(resultat.reel, null);
  assert.match(resultat.errors[0], /illisible/);
  assert.equal(resultat.usage.input_tokens, 20);
});

test("contenuAvecReel : ajoute reel, garde l'ancien sous reelPrecedent, rien d'autre", () => {
  const sans = contenuAvecReel({ titre_fiche: "T" }, { n: 1 });
  assert.deepEqual(sans, { titre_fiche: "T", reel: { n: 1 } });
  const avec = contenuAvecReel({ titre_fiche: "T", reel: { n: 1 } }, { n: 2 });
  assert.deepEqual(avec, { titre_fiche: "T", reelPrecedent: { n: 1 }, reel: { n: 2 } });
});

test("lireFluxClaude : texte et usage reconstitués depuis le flux SSE", async () => {
  const evenements = [
    { type: "message_start", message: { usage: { input_tokens: 12, output_tokens: 1 } } },
    { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
    { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: '{"a":' } },
    { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "1}" } },
    { type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 7 } },
    { type: "message_stop" },
  ];
  const sse = evenements.map((e) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join("");
  const octets = new TextEncoder().encode(sse);
  // Découpé en morceaux de 7 octets, pour vérifier le recollage des lignes.
  const corps = new ReadableStream({
    start(controleur) {
      for (let i = 0; i < octets.length; i += 7) controleur.enqueue(octets.slice(i, i + 7));
      controleur.close();
    },
  });
  const { texte, usage, stop_reason } = await lireFluxClaude(corps);
  assert.equal(texte, '{"a":1}');
  assert.deepEqual(usage, { input_tokens: 12, output_tokens: 7 });
  assert.equal(stop_reason, "end_turn");
});

test("pipeline : le Reel n'est plus généré automatiquement (étape 3 quater retirée)", () => {
  const source = readFileSync(new URL("./analyze.js", import.meta.url), "utf8");
  const debut = source.indexOf("export async function runPipeline");
  const fin = source.indexOf("\nexport ", debut + 10);
  const pipeline = source.slice(debut, fin);
  assert.ok(debut > 0);
  assert.doesNotMatch(pipeline, /genererReel/);
  assert.match(source, /export async function genererReel\(/);
});
