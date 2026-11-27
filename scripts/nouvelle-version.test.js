import test from "node:test";
import assert from "node:assert/strict";
import {
  construireChangementVersion,
  criteresModifies,
  lireChangementVersion,
  texteAvisVersion,
  titreEtMesureAffiches,
} from "../src/lib/nouvelle-version-core.js";
import { construireHistorique } from "../src/lib/versions-core.js";
import { publierBrouillonCore } from "../src/lib/test-publier.js";
import { enregistrerTexteCore } from "../src/lib/test-enregistrer.js";

// Nouvelle version d'une fiche publiée quand le candidat a modifié sa mesure
// (src/lib/nouvelle-version-core.js). Aucune base réelle : fausses bases seulement.

const NOTATION_AVANT = {
  operationnalite_juridique: 4,
  operationnalite_budgetaire: 2,
  operationnalite_moyens_humains: 4,
  operationnalite_moyens_total: 10,
  efficacite: 10,
  effets_rebonds_externalites: 8,
  degre_preparation: 5,
  alignement_logique: 12,
  score_total: 45,
};
const NOTATION_APRES = { ...NOTATION_AVANT, operationnalite_budgetaire: 3, degre_preparation: 7, score_total: 48 };

const ENTREE = {
  precedente: { id: 102, scoreFaisabilite: 45, contenuComplet: { notation_detaillee: NOTATION_AVANT } },
  proposition: { texteOriginal: "Ancienne mesure.", titre: "Ancien titre" },
  notation: NOTATION_APRES,
  mesureInitiale: "  Nouvelle mesure.  ",
  titre: "Nouveau titre",
  raison: "Mesure modifiée par le candidat.",
  motifPublic: "Le candidat a modifié sa mesure : cette analyse remplace la précédente (45/100).",
};

test("criteresModifies : seulement les notes de critères qui changent, calculées par le code", () => {
  assert.deepEqual(criteresModifies(NOTATION_AVANT, NOTATION_APRES), [
    { critere: "operationnalite_budgetaire", ancienneNote: 2, nouvelleNote: 3 },
    { critere: "degre_preparation", ancienneNote: 5, nouvelleNote: 7 },
  ]);
  assert.deepEqual(criteresModifies(NOTATION_AVANT, NOTATION_AVANT), []);
});

test("construireChangementVersion : garde l'ancienne mesure et l'ancien titre, scores avant/après", () => {
  const cv = construireChangementVersion(ENTREE);
  assert.equal(cv.analyse_precedente_id, 102);
  assert.equal(cv.score_avant, 45);
  assert.equal(cv.score_apres, 48);
  assert.equal(cv.mesure_initiale, "Nouvelle mesure.");
  assert.equal(cv.mesure_avant, "Ancienne mesure.");
  assert.equal(cv.titre, "Nouveau titre");
  assert.equal(cv.titre_avant, "Ancien titre");
  assert.equal(cv.criteres_modifies.length, 2);
  assert.deepEqual(lireChangementVersion({ changement_version: cv }), cv);
});

test("construireChangementVersion : refuse un champ manquant ou une notation sans score", () => {
  assert.throws(() => construireChangementVersion({ ...ENTREE, motifPublic: " " }), /motifPublic/);
  assert.throws(() => construireChangementVersion({ ...ENTREE, notation: { ...NOTATION_APRES, score_total: "48" } }), /score_total/);
  assert.throws(() => construireChangementVersion({ ...ENTREE, precedente: null }), /précédente/);
});

test("lireChangementVersion : un bloc incomplet ne compte pas", () => {
  const cv = construireChangementVersion(ENTREE);
  assert.equal(lireChangementVersion({}), null);
  assert.equal(lireChangementVersion(null), null);
  assert.equal(lireChangementVersion({ changement_version: { ...cv, analyse_precedente_id: "102" } }), null);
  assert.equal(lireChangementVersion({ changement_version: { ...cv, mesure_initiale: "" } }), null);
  assert.equal(lireChangementVersion({ changement_version: [cv] }), null);
});

test("texteAvisVersion : numéro, date, puis le motif", () => {
  assert.equal(
    texteAvisVersion({ numero: 3, dateLabel: "27/11/2026", motif: "Le candidat a modifié sa mesure." }),
    "Version 3 du 27/11/2026. Le candidat a modifié sa mesure.",
  );
  assert.equal(texteAvisVersion({ numero: 3, dateLabel: null, motif: "M." }), "Version 3. M.");
  assert.equal(texteAvisVersion({ numero: null, dateLabel: null, motif: "M." }), "M.");
  assert.equal(texteAvisVersion({ numero: 3, dateLabel: "x", motif: "" }), null);
});

test("titreEtMesureAffiches : ceux de la nouvelle version si elle en porte une, sinon ceux de la Proposition", () => {
  const proposition = { titre: "Ancien titre", texteOriginal: "Ancienne mesure." };
  assert.deepEqual(titreEtMesureAffiches(proposition, {}), { titre: null, texteOriginal: "Ancienne mesure." });
  const cv = construireChangementVersion(ENTREE);
  assert.deepEqual(titreEtMesureAffiches(proposition, { changement_version: cv }), {
    titre: "Nouveau titre",
    texteOriginal: "Nouvelle mesure.",
  });
});

test("historique : V3 porte la raison et les scores, V1 et V2 gardent l'ancienne mesure", () => {
  const cv = construireChangementVersion(ENTREE);
  const historique = construireHistorique({
    versions: [
      { id: 50, statut: "remplacee", createdAt: "2026-10-07T04:14:42Z" },
      { id: 102, statut: "remplacee", createdAt: "2026-11-18T14:02:28Z" },
      { id: 120, statut: "publie", createdAt: "2026-11-28T10:00:00Z", changementVersion: cv },
    ],
    decisions: [
      {
        id: 2,
        createdAt: "2026-11-18T14:02:28Z",
        analysePublieeId: 102,
        revision: { resume: { scoreAvant: 45, scoreApres: 45, raison: "Revue du dimanche.", criteresModifies: [] }, commentIds: [] },
      },
    ],
    annotations: [],
    libelles: { degre_preparation: "Degré de préparation" },
  });
  assert.deepEqual(
    historique.map((v) => [v.numero, v.analyseId, v.scoreAvant, v.scoreApres, v.raison, v.mesure]),
    [
      [1, 50, null, null, "Première publication.", "Ancienne mesure."],
      [2, 102, 45, 45, "Revue du dimanche.", "Ancienne mesure."],
      [3, 120, 45, 48, "Mesure modifiée par le candidat.", "Nouvelle mesure."],
    ],
  );
  assert.deepEqual(historique[2].criteresModifies, [
    { critere: "operationnalite_budgetaire", ancienneNote: 2, nouvelleNote: 3 },
    { critere: "Degré de préparation", ancienneNote: 5, nouvelleNote: 7 },
  ]);
});

test("historique sans nouvelle version : aucune mesure affichée (rien ne change)", () => {
  const historique = construireHistorique({
    versions: [{ id: 1, statut: "publie", createdAt: "2026-10-01T00:00:00Z" }],
    decisions: [],
    annotations: [],
  });
  assert.equal(historique[0].mesure, null);
});

// --- Publication ------------------------------------------------------------------

const CV = construireChangementVersion(ENTREE);
const BROUILLON = {
  id: 120,
  statut: "brouillon",
  scoreFaisabilite: 48,
  propositionId: 50,
  contenuComplet: { changement_version: CV },
  proposition: { candidatId: 16, candidat: { nom: "Dominique de Villepin" } },
};

function fausseBase({ enLigne = [{ id: 102 }], remplaceeCount = 1, ecrituresAutorisees = false } = {}) {
  const journal = [];
  const appels = [];
  const ecriture = (nom, valeur) => async (args) => {
    journal.push(nom);
    appels.push([nom, args]);
    if (!ecrituresAutorisees) throw new Error(`ÉCRITURE INTERDITE : ${nom}`);
    return typeof valeur === "function" ? valeur(args) : valeur;
  };
  const lecture = (nom, valeur) => async (args) => {
    journal.push(nom);
    appels.push([nom, args]);
    return typeof valeur === "function" ? valeur(args) : valeur;
  };
  const fiche = { id: 50, slug: "taxer-l-heritage-exonerer-les-dons", titre: "Ancien titre", candidat: { nom: "Dominique de Villepin" } };
  const tx = {
    analyse: {
      updateMany: ecriture("tx.analyse.updateMany", (args) => ({ count: args.data.statut === "remplacee" ? remplaceeCount : 1 })),
      aggregate: lecture("tx.analyse.aggregate", { _avg: { scoreFaisabilite: 59.3 } }),
    },
    candidat: { update: ecriture("tx.candidat.update", (args) => ({ nom: "Dominique de Villepin", scoreMoyen: args.data.scoreMoyen })) },
    proposition: {
      findUnique: lecture("tx.proposition.findUnique", fiche),
      findMany: lecture("tx.proposition.findMany", []),
      update: ecriture("tx.proposition.update", {}),
      updateMany: ecriture("tx.proposition.updateMany", { count: 1 }),
    },
  };
  const prisma = {
    analyse: {
      findUnique: lecture("analyse.findUnique", BROUILLON),
      findFirst: lecture("analyse.findFirst", { id: 120 }),
      findMany: lecture("analyse.findMany", (args) =>
        args.where.propositionId === 50 ? enLigne : [{ scoreFaisabilite: 60 }, { scoreFaisabilite: 70 }],
      ),
    },
    proposition: { findUnique: lecture("proposition.findUnique", fiche), findMany: lecture("proposition.findMany", []) },
    $transaction: async (fn) => {
      journal.push("$transaction");
      return fn(tx);
    },
  };
  return { prisma, journal, appels };
}

const editeur = async () => true;
const CLIC = new Date("2026-11-28T10:00:00.000Z");
const maintenant = () => CLIC;

test("publication d'une nouvelle version : simulation, rien n'est écrit, la version remplacée est annoncée", async () => {
  const { prisma, journal, appels } = fausseBase();
  const r = await publierBrouillonCore(120, { isEditor: editeur, prisma, dryRun: true, maintenant });
  assert.equal(r.ok, true);
  assert.equal(r.simulation, true);
  assert.match(r.message, /L'analyse #102 passerait en « remplacée »/);
  assert.match(r.message, /« Nouveau titre »/);
  assert.match(r.message, /inchangée\) : \/declarations\/taxer-l-heritage-exonerer-les-dons/);
  assert.ok(!journal.includes("$transaction"));
  // La moyenne ne compte plus la version remplacée.
  const moyenne = appels.find(([nom, args]) => nom === "analyse.findMany" && args.where.proposition);
  assert.deepEqual(moyenne[1].where.id, { not: 102 });
  assert.match(r.message, /deviendrait 59\.3\/100/);
});

test("publication d'une nouvelle version : une transaction, ancienne en « remplacee », mesure et titre mis à jour, slug intact", async () => {
  const { prisma, journal, appels } = fausseBase({ ecrituresAutorisees: true });
  const r = await publierBrouillonCore(120, { isEditor: editeur, prisma, dryRun: false, maintenant });
  assert.equal(r.ok, true);
  assert.equal(r.remplace, 102);
  assert.equal(r.slugAdresse, "taxer-l-heritage-exonerer-les-dons");
  assert.deepEqual(journal.filter((a) => /update|aggregate|\$transaction/.test(a)), [
    "$transaction",
    "tx.analyse.updateMany",
    "tx.analyse.updateMany",
    "tx.proposition.update",
    "tx.analyse.aggregate",
    "tx.candidat.update",
  ]);
  const ecritures = appels.filter(([nom]) => /update/.test(nom)).map(([, args]) => args);
  assert.deepEqual(ecritures[0], { where: { id: 120, statut: "brouillon" }, data: { statut: "publie", publieLe: CLIC } });
  assert.deepEqual(ecritures[1], { where: { id: 102, propositionId: 50, statut: "publie" }, data: { statut: "remplacee" } });
  assert.deepEqual(ecritures[2], { where: { id: 50 }, data: { texteOriginal: "Nouvelle mesure.", titre: "Nouveau titre" } });
  // Le slug existant n'est jamais réécrit.
  assert.ok(!journal.includes("tx.proposition.updateMany"));
});

test("publication d'une nouvelle version : refusée si la version en ligne n'est plus celle qu'elle remplace", async () => {
  for (const enLigne of [[], [{ id: 99 }], [{ id: 102 }, { id: 99 }]]) {
    for (const dryRun of [true, false]) {
      const { prisma, journal } = fausseBase({ enLigne, ecrituresAutorisees: true });
      const r = await publierBrouillonCore(120, { isEditor: editeur, prisma, dryRun, maintenant });
      assert.equal(r.ok, false);
      assert.match(r.message, /remplace l'analyse #102, qui n'est plus la version en ligne/);
      assert.ok(!journal.includes("$transaction"));
    }
  }
});

test("titre modifié sur /test d'une nouvelle version : la fiche en ligne garde son titre jusqu'à la publication", async () => {
  const misAJour = new Date("2026-11-28T09:00:00.000Z");
  const ecrits = [];
  const tx = {
    analyse: { updateMany: async (args) => (ecrits.push(["analyse", args]), { count: 1 }) },
    proposition: { update: async (args) => (ecrits.push(["proposition", args]), {}) },
  };
  const prisma = {
    analyse: {
      findUnique: async () => ({
        id: 120,
        statut: "brouillon",
        updatedAt: misAJour,
        propositionId: 50,
        contenuComplet: { titre_fiche: "Nouveau titre", changement_version: CV },
        proposition: { texteOriginal: "Ancienne mesure." },
      }),
      findFirst: async () => ({ id: 120 }),
    },
    $transaction: async (fn) => fn(tx),
  };
  const r = await enregistrerTexteCore(
    { analyseId: 120, champ: "titre_fiche", valeur: "Héritage exonéré jusqu'à 1 million", versionAttendue: misAJour.toISOString() },
    { isEditor: editeur, prisma, dryRun: false },
  );
  assert.equal(r.ok, true, r.message);
  assert.ok(!ecrits.some(([table]) => table === "proposition"), "Proposition.titre ne doit pas changer avant « Publier »");
  const contenu = ecrits.find(([table]) => table === "analyse")[1].data.contenuComplet;
  assert.equal(contenu.titre_fiche, "Héritage exonéré jusqu'à 1 million");
  assert.equal(contenu.changement_version.titre, "Héritage exonéré jusqu'à 1 million");
});

test("publication d'une nouvelle version : ancienne version changée pendant la transaction → tout est annulé", async () => {
  const { prisma } = fausseBase({ remplaceeCount: 0, ecrituresAutorisees: true });
  const r = await publierBrouillonCore(120, { isEditor: editeur, prisma, dryRun: false, maintenant });
  assert.equal(r.ok, false);
  assert.match(r.message, /La version en ligne a changé entre-temps/);
});
