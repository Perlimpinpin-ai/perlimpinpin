import test from "node:test";
import assert from "node:assert/strict";
import {
  annotationsATrier,
  confirmationValide,
  dernierTri,
  donneesNouvelleVersion,
  estHeureRevue,
  fichesAReviser,
  heureParis,
  lireTri,
} from "../src/lib/revue-core.js";
import { calculerScore, appliquerScoreCode, checkNotationCoherence } from "./lib/scoring.js";
import { comparerScores, rapportMarkdown } from "./lib/rapport-scores-core.js";

// Revue du dimanche : heure de Paris, sélection, tri, « oui », score par le code.

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

test("heure de Paris : 8 h le dimanche, été comme hiver", () => {
  // Été (UTC+2) : 6 h UTC = 8 h Paris ; hiver (UTC+1) : 7 h UTC = 8 h Paris.
  assert.equal(estHeureRevue(new Date("2026-07-05T06:00:00Z")), true);
  assert.equal(estHeureRevue(new Date("2026-07-05T07:00:00Z")), false);
  assert.equal(estHeureRevue(new Date("2026-11-08T07:00:00Z")), true);
  assert.equal(estHeureRevue(new Date("2026-11-08T06:00:00Z")), false);
  assert.equal(estHeureRevue(new Date("2026-11-09T07:00:00Z")), false); // lundi
  assert.deepEqual(heureParis(new Date("2026-11-08T07:30:00Z")), { jour: 0, heure: 8 });
});

test("sélection : fiches publiées, avant la clôture, jamais triées", () => {
  const cloture = "2026-11-08T07:00:00Z";
  const a = (id, slug, date, tris = []) => ({ id, ficheSlug: slug, createdAt: date, tris });
  const liste = [
    a("1", "fiche-12", "2026-11-07T10:00:00Z"),
    a("2", "fiche-12", "2026-11-08T07:00:01Z"), // après la clôture
    a("3", "zemmour-rsa", "2026-11-07T10:00:00Z"), // archive /relectures
    a("4", "fiche-13", "2026-11-07T10:00:00Z", [{ id: 1, categorie: "question", createdAt: "x" }]),
    a("5", "fiche-13", "2026-11-07T10:00:00Z"),
  ];
  assert.deepEqual(annotationsATrier(liste, { cloture }).map((x) => x.id), ["1", "5"]);
  assert.deepEqual(annotationsATrier(liste, { cloture, propositionId: 13 }).map((x) => x.id), ["5"]);
});

test("le tri le plus récent fait foi ; seule « argument_ou_source » déclenche une révision", () => {
  const tris = [
    { id: 1, categorie: "argument_ou_source", createdAt: "2026-11-08T07:10:00Z" },
    { id: 2, categorie: "question", createdAt: "2026-11-08T19:00:00Z" },
  ];
  assert.equal(dernierTri(tris).categorie, "question");
  assert.equal(dernierTri([]), null);
  const fiches = fichesAReviser([
    { id: "a", ficheSlug: "fiche-12", tris },
    { id: "b", ficheSlug: "fiche-12", tris: [{ id: 3, categorie: "argument_ou_source", createdAt: "2026-11-08T07:10:00Z" }] },
    { id: "c", ficheSlug: "fiche-14", tris: [{ id: 4, categorie: "desaccord_sans_argument", createdAt: "2026-11-08T07:10:00Z" }] },
  ]);
  assert.deepEqual([...fiches.keys()], [12]);
  assert.deepEqual(fiches.get(12).map((x) => x.id), ["b"]);
});

test("lecture du tri du modèle", () => {
  assert.deepEqual(lireTri('{"categorie":"question","justification":" Demande. ","reponse":"Bonjour"}'), {
    tri: { categorie: "question", justification: "Demande.", reponse: "Bonjour" },
  });
  assert.ok(lireTri('{"categorie":"autre"}').error);
  assert.ok(lireTri("pas du json").error);
  assert.equal(lireTri('{"categorie":"hors_sujet","justification":"","reponse":""}').tri.reponse, null);
});

test("rien n'est publié sans « oui »", () => {
  for (const ok of ["oui", " OUI ", "Oui"]) assert.equal(confirmationValide(ok), true);
  for (const ko of ["", "o", "yes", "oui !", null, undefined, "non"]) assert.equal(confirmationValide(ko), false);
});

test("score calculé par le code : mêmes règles que la vérification de cohérence", () => {
  assert.deepEqual(calculerScore(NOTATION), {
    operationnalite_moyens_total: 16,
    plafond_applique: false,
    plafond_declencheur: null,
    score_total: 45,
    appreciation: "partiellement fondé",
  });
  // Un volet FRAGILE (< 3) plafonne l'Opérationnalité & Moyens à 10.
  const plafonnee = appliquerScoreCode({ ...NOTATION, operationnalite_juridique: 2, operationnalite_budgetaire: 9, score_total: 99 });
  assert.equal(plafonnee.operationnalite_moyens_total, 10);
  assert.equal(plafonnee.plafond_declencheur, "juridique");
  assert.equal(plafonnee.score_total, 39);
  assert.deepEqual(checkNotationCoherence(plafonnee), []);
  // Le score du modèle est ignoré.
  assert.equal(appliquerScoreCode({ ...NOTATION, score_total: 80 }).score_total, 45);
  // Ancien barème : pas de calcul.
  assert.equal(calculerScore({ score_total: 50 }), null);
});

test("rapport de scores : écarts, identiques, ancien barème", () => {
  const lignes = comparerScores([
    { id: 1, propositionId: 10, scoreFaisabilite: 45, contenuComplet: { notation_detaillee: NOTATION } },
    { id: 2, propositionId: 11, scoreFaisabilite: 50, contenuComplet: { notation_detaillee: { ...NOTATION, score_total: 50 } } },
    { id: 3, propositionId: 12, scoreFaisabilite: 60, contenuComplet: { notation_detaillee: { score_total: 60 } } },
  ]);
  assert.deepEqual(lignes.map((l) => l.statut), ["identique", "ecart", "ancien_bareme"]);
  assert.equal(lignes[1].scoreCode, 45);
  const md = rapportMarkdown(lignes, new Date("2026-11-08T00:00:00Z"));
  assert.match(md, /Écart : 1/);
  assert.match(md, /\/declarations\/11/);
});

test("nouvelle version : colonnes recalculées depuis le contenu, statut publié", () => {
  const source = {
    propositionId: 12,
    scoreSolidite: 1,
    scoreJuridique: 1,
    scoreOperationnel: 1,
    scoreBudgetaire: 1,
    scorePertinence: 1,
    verdict: "ancien",
    resumeAccueil: "ancien résumé",
    teaser: "teaser",
    cequiEstEtabli: "a",
    cequiEstProbable: "b",
    cequiEstDiscutable: "c",
    cequiEstInconnu: "d",
    sourcesUtilisees: "e",
    versionMethodologie: "1.0",
    promptFileModifiedAt: null,
  };
  const contenu = { notation_detaillee: NOTATION, verdict_final: "nouveau", ce_qui_est_etabli: { synthese: "s", texte: "établi" }, sources_utilisees: ["x", "y"] };
  const d = donneesNouvelleVersion(source, contenu);
  assert.equal(d.statut, "publie");
  assert.equal(d.scoreFaisabilite, 45);
  assert.equal(d.scoreOperationnel, 16);
  assert.equal(d.verdict, "nouveau");
  assert.equal(d.cequiEstEtabli, "établi");
  assert.equal(d.cequiEstProbable, "b");
  assert.equal(d.sourcesUtilisees, "• x\n• y");
  assert.throws(() => donneesNouvelleVersion(source, { notation_detaillee: {} }));
});
