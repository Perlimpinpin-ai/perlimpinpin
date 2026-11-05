import test from "node:test";
import assert from "node:assert/strict";
import {
  extraireJson,
  ficheRevisable,
  propositionSansEtapes,
  requeteRevision,
  requeteTri,
  resumeRevision,
  validerRevision,
} from "./lib/revue-revision.js";
import { attendreLot, lireResultats, soumettreLot, texteFinal } from "./lib/lot-multiple.js";

// Révision par la revue du dimanche : requêtes, validation, score par le code ;
// lots de plusieurs requêtes (API Message Batches, réseau simulé).

const NOTATION = {
  operationnalite_juridique: 5,
  qualification_juridique: "INCERTAIN",
  operationnalite_budgetaire: 6,
  qualification_budgetaire: "INCERTAIN",
  operationnalite_moyens_humains: 5,
  qualification_moyens_humains: "INCERTAIN",
  operationnalite_moyens_total: 16,
  plafond_applique: false,
  plafond_declencheur: null,
  efficacite: 9,
  qualification_efficacite: "FRAGILE",
  effets_rebonds_externalites: 8,
  qualification_effets_rebonds: "INCERTAIN",
  degre_preparation: 5,
  qualification_preparation: "INCERTAIN",
  alignement_logique: 7,
  qualification_alignement: "SOLIDE",
  score_total: 45,
  appreciation: "partiellement fondé",
};
const CONTENU = {
  titre_fiche: "RSA limité à 3 ans",
  resume_court: "Résumé.",
  contexte_national: { synthese: "1,83 million de foyers.", texte: "Fin 2024…" },
  sources_utilisees: ["CNAF 2024"],
  notation_detaillee: NOTATION,
  version_basique: { resume: "…" },
  reseaux: { x: [] },
};
const notes = (extra = {}) => {
  const n = { ...NOTATION, ...extra };
  for (const k of ["operationnalite_moyens_total", "plafond_applique", "plafond_declencheur", "score_total", "appreciation"]) delete n[k];
  return n;
};
const REPONSE = {
  notes: notes(),
  criteres_modifies: [],
  textes_modifies: { contexte_national: { synthese: "1,85 million de foyers.", texte: "Fin 2025…" } },
  raison: "Chiffre CNAF mis à jour.",
  reponses: [{ commentaire_id: "c1", reponse: "Merci, chiffre corrigé.", retenu: true }],
};

test("requêtes : 3 recherches web au plus, fiche sans version basique ni réseaux, aucun nom d'adhérent", () => {
  const annotation = { id: "c1", sectionId: "contexte_national", sectionLabel: "Contexte national", quotedText: "1,83 million", body: "Chiffre 2025 : 1,85 M.", authorName: "Camille D." };
  const rev = requeteRevision({ contenu: CONTENU, annotations: [annotation], consignes: "x" });
  assert.equal(rev.tools[0].type, "web_search_20260209");
  assert.equal(rev.tools[0].max_uses, 3);
  const texte = rev.messages[0].content;
  assert.doesNotMatch(texte, /version_basique|reseaux|Camille/);
  assert.match(texte, /1,85 M/);
  const tri = requeteTri({ annotation, contenu: CONTENU, consignes: "x" });
  assert.equal(tri.output_config.format.type, "json_schema");
  assert.doesNotMatch(tri.messages[0].content, /Camille/);
  assert.match(tri.messages[0].content, /contexte_national/);
});

test("JSON extrait même entouré de texte", () => {
  assert.deepEqual(extraireJson('Voici : {"a": {"b": "}"}} fin'), { a: { b: "}" } });
  assert.equal(extraireJson("rien"), null);
});

test("validation : réponse complète acceptée", () => {
  const v = validerRevision(REPONSE, { commentaireIds: ["c1"], contenuActuel: CONTENU });
  assert.equal(v.valid, true, v.errors.join("\n"));
});

test("validation : notes hors bornes, section inconnue, forme changée, réponse manquante", () => {
  const v = validerRevision(
    {
      ...REPONSE,
      notes: notes({ efficacite: 31, qualification_alignement: "TRES_BIEN" }),
      textes_modifies: { titre_fiche: "x", contexte_national: "texte simple au lieu d'un objet" },
      reponses: [],
    },
    { commentaireIds: ["c1"], contenuActuel: CONTENU },
  );
  assert.equal(v.valid, false);
  const tout = v.errors.join("\n");
  assert.match(tout, /notes\.efficacite/);
  assert.match(tout, /qualification_alignement/);
  assert.match(tout, /titre_fiche : section non modifiable/);
  assert.match(tout, /contexte_national : forme différente/);
  assert.match(tout, /aucune réponse pour c1/);
});

test("proposition sans étapes 2 et 3 : textes révisés, score recalculé par le code", () => {
  const { revision } = validerRevision(REPONSE, { commentaireIds: ["c1"], contenuActuel: CONTENU });
  const p = propositionSansEtapes(CONTENU, revision);
  assert.equal(p.criteresModifies.length, 0);
  assert.equal(p.etapes23, false);
  assert.equal(p.contenu.contexte_national.synthese, "1,85 million de foyers.");
  assert.equal(p.contenu.version_basique.resume, "…");
  assert.equal(p.scoreApres, 45);
});

test("une note qui change : critère listé, score recalculé (jamais celui du modèle)", () => {
  const brut = { ...REPONSE, notes: notes({ efficacite: 15 }), criteres_modifies: [{ critere: "efficacite", raison: "Étude Dares 2026." }] };
  const { revision } = validerRevision(brut, { commentaireIds: ["c1"], contenuActuel: CONTENU });
  const p = propositionSansEtapes(CONTENU, revision);
  assert.deepEqual(p.criteresModifies, [{ critere: "efficacite", ancienneNote: 9, nouvelleNote: 15 }]);
  assert.equal(p.scoreApres, 51);
  const resume = resumeRevision({ ...p, raison: revision.raison, raisonsModele: revision.criteresModifies });
  assert.equal(resume.criteresModifies[0].raison, "Étude Dares 2026.");
  assert.equal(resume.scoreAvant, 45);
});

test("seules les fiches du barème 2026 sont révisables automatiquement", () => {
  assert.equal(ficheRevisable(CONTENU), true);
  assert.equal(ficheRevisable({ notation_detaillee: { score_total: 50 } }), false);
});

// --- Lots de plusieurs requêtes --------------------------------------------------

function fauxApi() {
  const appels = [];
  let suivis = 0;
  const fetchImpl = async (url, opts = {}) => {
    appels.push({ url, methode: opts.method, corps: opts.body ? JSON.parse(opts.body) : null });
    const json = (o) => ({ ok: true, json: async () => o, text: async () => JSON.stringify(o) });
    if (url.endsWith("/messages/batches")) return json({ id: "lot_1", processing_status: "in_progress" });
    if (url.endsWith("/messages/batches/lot_1")) {
      suivis += 1;
      return json({ id: "lot_1", processing_status: suivis < 2 ? "in_progress" : "ended", results_url: "https://x/resultats" });
    }
    if (url === "https://x/resultats") {
      const lignes = [
        { custom_id: "rev-12", result: { type: "succeeded", message: { content: [{ type: "server_tool_use", name: "web_search" }, { type: "web_search_tool_result", content: [] }, { type: "text", text: '{"ok":1}' }] } } },
        { custom_id: "tri-a", result: { type: "errored", error: { type: "invalid_request" } } },
      ];
      return { ok: true, text: async () => lignes.map((l) => JSON.stringify(l)).join("\n") };
    }
    throw new Error(`URL inattendue ${url}`);
  };
  return { appels, fetchImpl };
}

test("lot : envoi, suivi, résultats rangés par custom_id", async () => {
  const { appels, fetchImpl } = fauxApi();
  const opts = { baseUrl: "https://api.anthropic.com/v1", headers: {}, fetchImpl };
  const id = await soumettreLot([{ custom_id: "tri-a", params: {} }, { custom_id: "rev-12", params: {} }], opts);
  assert.equal(id, "lot_1");
  assert.equal(appels[0].corps.requests.length, 2);
  const lot = await attendreLot(id, { ...opts, attendre: async () => {} });
  const res = await lireResultats(lot, opts);
  assert.equal(res.get("rev-12").ok, true);
  assert.equal(texteFinal(res.get("rev-12").message), '{"ok":1}');
  assert.equal(res.get("tri-a").ok, false);
});

test("lot : custom_id invalide ou en double refusé avant tout appel", async () => {
  const { appels, fetchImpl } = fauxApi();
  const opts = { baseUrl: "u", headers: {}, fetchImpl };
  await assert.rejects(soumettreLot([{ custom_id: "a b", params: {} }], opts));
  await assert.rejects(soumettreLot([{ custom_id: "a", params: {} }, { custom_id: "a", params: {} }], opts));
  await assert.rejects(soumettreLot([], opts));
  assert.equal(appels.length, 0);
});
