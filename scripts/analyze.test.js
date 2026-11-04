import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { callMistralQualityControl, ficheCompleteAvecVerdictRacine, fusionnerReponseCorrigee, completerAvecFicheRelue } from "./analyze.js";
import { validateFicheCompleteStructure } from "./lib/scoring.js";

// Échec du robot de révision sur le-pen-contribution-ue-5-milliards (10 octobre
// 2026) : verdict_final seulement à la racine de la réponse d'étape 3, absent
// de fiche_complete → « Étape 3 : structure toujours invalide après tentative
// de réparation. verdict_final: Invalid input: expected string, received
// undefined ». Reproduit avec une vraie sortie d'étape 3, sans appel aux API.
describe("Étape 3 — verdict_final placé seulement à la racine", () => {
  const sortieReelle = () =>
    JSON.parse(readFileSync(new URL("../data/analyses finales/Zemmour/zemmour_rsa_trois_ans_etape3.json", import.meta.url), "utf8"));

  test("sans le correctif, fiche_complete seule est refusée ; avec, elle est valide et prend le verdict de la racine", () => {
    const arbitrage3 = sortieReelle();
    delete arbitrage3.fiche_complete.verdict_final;
    assert.ok(arbitrage3.verdict_final, "la sortie réelle a bien un verdict_final à la racine");

    const avant = validateFicheCompleteStructure(arbitrage3.fiche_complete);
    assert.equal(avant.valid, false);
    assert.match(avant.errors.join("\n"), /verdict_final: Invalid input: expected string, received undefined/);

    const fiche = ficheCompleteAvecVerdictRacine(arbitrage3);
    assert.equal(fiche.verdict_final, arbitrage3.verdict_final);
    assert.equal(validateFicheCompleteStructure(fiche).valid, true);
  });

  test("verdict_final déjà dans fiche_complete : rien ne change (même objet)", () => {
    const arbitrage3 = sortieReelle();
    arbitrage3.verdict_final = "Un autre verdict, à la racine.";
    assert.equal(ficheCompleteAvecVerdictRacine(arbitrage3), arbitrage3.fiche_complete);
  });

  test("verdict_final absent partout : rien n'est inventé, la validation échoue toujours", () => {
    const arbitrage3 = sortieReelle();
    delete arbitrage3.fiche_complete.verdict_final;
    delete arbitrage3.verdict_final;
    const fiche = ficheCompleteAvecVerdictRacine(arbitrage3);
    assert.ok(!("verdict_final" in fiche));
    assert.equal(validateFicheCompleteStructure(fiche).valid, false);
    assert.deepEqual(ficheCompleteAvecVerdictRacine({}), {});
  });
});

// CAS 10 de la spec ("Mistral indisponible -> le pipeline continue") :
// runPipeline() enveloppe cet appel dans un try/catch (voir analyze.js,
// runPipeline) et poursuit avec contreAvisMistral = null en cas d'échec —
// ce comportement de continuation n'est pas ré-exécuté ici (il dépend de
// l'orchestration complète, testée en pratique par le run réel du
// pipeline), mais on vérifie ici la précondition réelle et sans réseau :
// callMistralQualityControl échoue proprement (rejette une promesse avec un
// message clair) plutôt que de bloquer, ce qui est ce que le try/catch
// attend pour se déclencher.
describe("CAS 10 — résilience Mistral", () => {
  test("callMistralQualityControl rejette proprement si MISTRAL_API_KEY est absent (aucun appel réseau)", async () => {
    const original = process.env.MISTRAL_API_KEY;
    delete process.env.MISTRAL_API_KEY;
    try {
      await assert.rejects(
        () => callMistralQualityControl({ notation_detaillee: {} }),
        /MISTRAL_API_KEY n'est pas défini/,
      );
    } finally {
      if (original !== undefined) process.env.MISTRAL_API_KEY = original;
    }
  });
});

// Échec du robot de révision (4 novembre 2026, Mélenchon carburant) : après un
// refus de revision_relecture, la réponse corrigée avait perdu
// analyse_par_criteres → étape 3 bloquée. La correction ne visait que
// revision_relecture : la fiche_complete valide de la 1re réponse est gardée.
describe("Étape 3 — réponse corrigée qui perd analyse_par_criteres", () => {
  const sortieReelle = () =>
    JSON.parse(readFileSync(new URL("../data/analyses finales/Zemmour/zemmour_rsa_trois_ans_etape3.json", import.meta.url), "utf8"));

  test("garde la fiche_complete valide de la première réponse et la revision corrigée", () => {
    const premiere = { ...sortieReelle(), revision_relecture: { synthese: "x" } };
    const corrigee = structuredClone(sortieReelle());
    delete corrigee.fiche_complete.analyse_par_criteres;
    corrigee.revision_relecture = { synthese: "ok", reponses: [], notes_pour_arno: "" };
    const fusion = fusionnerReponseCorrigee(premiere, corrigee);
    assert.equal(fusion.revision_relecture, corrigee.revision_relecture);
    assert.ok(validateFicheCompleteStructure(ficheCompleteAvecVerdictRacine(fusion)).valid);
  });

  test("garde la nouvelle fiche_complete quand elle est valide", () => {
    const premiere = sortieReelle();
    const corrigee = sortieReelle();
    corrigee.fiche_complete.marqueur = 1;
    assert.equal(fusionnerReponseCorrigee(premiere, corrigee).fiche_complete, corrigee.fiche_complete);
  });
});

// Échec du robot de révision (4 novembre 2026, Mélenchon carburant, 2e essai) :
// fiche_complete sans mesure_vers_objectif. Le bloc est repris de la fiche relue.
describe("Étape 3 (révision) — bloc de texte omis par le modèle", () => {
  const sortieReelle = () =>
    JSON.parse(readFileSync(new URL("../data/analyses finales/Zemmour/zemmour_rsa_trois_ans_etape3.json", import.meta.url), "utf8"));

  test("mesure_vers_objectif absent : repris de la fiche relue, la fiche redevient valide", () => {
    const ficheRelue = sortieReelle().fiche_complete;
    const arbitrage3 = sortieReelle();
    delete arbitrage3.fiche_complete.mesure_vers_objectif;
    assert.equal(validateFicheCompleteStructure(arbitrage3.fiche_complete).valid, false);
    const fiche = completerAvecFicheRelue(arbitrage3.fiche_complete, arbitrage3, ficheRelue);
    assert.deepEqual(fiche.mesure_vers_objectif, ficheRelue.mesure_vers_objectif);
    assert.ok(validateFicheCompleteStructure(fiche).valid);
  });

  test("placé à la racine de la réponse : c'est celui-là qui est pris", () => {
    const arbitrage3 = sortieReelle();
    const nouveau = { ...arbitrage3.fiche_complete.mesure_vers_objectif, objectif_court: "Nouveau" };
    delete arbitrage3.fiche_complete.mesure_vers_objectif;
    arbitrage3.mesure_vers_objectif = nouveau;
    assert.equal(completerAvecFicheRelue(arbitrage3.fiche_complete, arbitrage3, sortieReelle().fiche_complete).mesure_vers_objectif, nouveau);
  });

  test("la notation n'est jamais reprise de la fiche relue", () => {
    const arbitrage3 = sortieReelle();
    delete arbitrage3.fiche_complete.analyse_par_criteres;
    delete arbitrage3.fiche_complete.notation_detaillee;
    const fiche = completerAvecFicheRelue(arbitrage3.fiche_complete, arbitrage3, sortieReelle().fiche_complete);
    assert.equal(fiche.analyse_par_criteres, undefined);
    assert.equal(fiche.notation_detaillee, undefined);
  });
});
