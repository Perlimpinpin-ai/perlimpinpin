import test from "node:test";
import assert from "node:assert/strict";
import {
  archiveDepuisFiche,
  composerMailProposition,
  mesCommentaires,
  propositionPourAdherent,
  statutCommentaire,
  validerProposition,
} from "../src/lib/espace-club-core.js";
import { dernierTraitement } from "../src/lib/versions-core.js";

// Espace adhérent du Club : « Mes commentaires » et « Proposer une mesure ».

test("statut d'un commentaire", () => {
  assert.equal(statutCommentaire({ reponse: "Merci", retenu: true }), "retenu");
  assert.equal(statutCommentaire({ reponse: "Merci", retenu: false }), "repondu");
  assert.equal(statutCommentaire({ reponse: null, retenu: false, etat: "reaccrochee" }), "reporte");
  assert.equal(statutCommentaire({ reponse: null, retenu: false, archiveSansReponse: true }), "clos");
  assert.equal(statutCommentaire({ reponse: null, retenu: false, etat: null }), "en_attente");
});

test("mes commentaires : fiche publiée, relecture archivée, tri du plus récent", () => {
  const archives = new Map([
    ["zemmour-retraites", archiveDepuisFiche({
      relecture: { titre: "Retraites à 64 ans", candidat: "Éric Zemmour", archive: { date: "2026-10-01", reponses: [{ commentaire_id: "c1", reponse: "Bien vu.", retenu: true }] } },
    })],
  ]);
  const fichesPubliees = new Map([[12, { titre: "Smic à 1 700 €", candidat: "Jean-Luc Mélenchon" }]]);
  const commentaires = [
    { id: "c1", ficheSlug: "zemmour-retraites", sectionLabel: "Verdict", quotedText: null, body: "Avis", createdAt: "2026-09-30T10:00:00Z", retenu: false, traitements: [] },
    { id: "c2", ficheSlug: "zemmour-retraites", sectionLabel: null, quotedText: null, body: "Autre", createdAt: "2026-09-30T11:00:00Z", retenu: false, traitements: [] },
    { id: "c3", ficheSlug: "fiche-12", sectionLabel: "Efficacité", quotedText: "un passage", body: "Note", createdAt: "2026-11-10T10:00:00Z", retenu: false,
      traitements: [
        { id: 1, etat: "reaccrochee", reponse: null, retenu: false, createdAt: "2026-11-08T10:00:00Z" },
        { id: 2, etat: "traitee", reponse: "Corrigé.", retenu: false, createdAt: "2026-11-09T10:00:00Z" },
      ] },
    { id: "c4", ficheSlug: "fiche-12", sectionLabel: null, quotedText: null, body: "Récent", createdAt: "2026-11-12T10:00:00Z", retenu: false, traitements: [] },
  ];
  const r = mesCommentaires({ commentaires, fichesPubliees, archives, dernierTraitement });
  assert.deepEqual(r.map((c) => c.id), ["c4", "c3", "c2", "c1"]);
  assert.equal(r[0].statut, "en_attente");
  assert.deepEqual(r[1].fiche, { type: "publiee", titre: "Smic à 1 700 €", candidat: "Jean-Luc Mélenchon", lien: "/declarations/12" });
  assert.equal(r[1].reponse, "Corrigé.");
  assert.equal(r[1].statut, "repondu");
  assert.equal(r[1].passage, "un passage");
  assert.equal(r[2].statut, "clos");
  assert.equal(r[3].statut, "retenu");
  assert.equal(r[3].fiche.lien, "#/zemmour-retraites");
  // Aucun champ personnel superflu (ni adherentId ni creditAccord)
  assert.deepEqual(Object.keys(r[0]).sort(), ["date", "fiche", "id", "passage", "reponse", "retenu", "section", "statut", "texte"]);
});

test("mes commentaires : fiche inconnue", () => {
  const r = mesCommentaires({
    commentaires: [{ id: "x", ficheSlug: "ancienne-fiche", body: "?", createdAt: "2026-01-01", traitements: [] }],
    fichesPubliees: new Map(),
    archives: new Map(),
    dernierTraitement,
  });
  assert.equal(r[0].fiche.titre, "ancienne-fiche");
  assert.equal(r[0].fiche.lien, null);
  assert.equal(r[0].statut, "en_attente");
});

test("validation d'une proposition", () => {
  assert.ok(validerProposition(null).error);
  assert.match(validerProposition({ mesure: "Une mesure assez longue" }).error, /candidat/);
  assert.match(validerProposition({ candidat: "X", mesure: "court" }).error, /15 caractères/);
  assert.match(validerProposition({ candidat: "X", mesure: "Une mesure assez longue", source: "pas un lien" }).error, /adresse web/);
  assert.match(validerProposition({ candidat: "X", mesure: "Une mesure assez longue", source: "javascript:alert(1)" }).error, /https/);
  assert.match(validerProposition({ candidat: "X", mesure: "m".repeat(2001) }).error, /2000/);
  assert.deepEqual(validerProposition({ candidat: " Marine Le Pen ", mesure: "  Baisser la TVA sur l'énergie à 5,5 %  ", source: "", pourquoi: 3 }), {
    valeurs: { candidat: "Marine Le Pen", mesure: "Baisser la TVA sur l'énergie à 5,5 %", source: null, pourquoi: null },
  });
});

test("proposition renvoyée à l'adhérent et mail au Club", () => {
  const ligne = { id: 4, adherentId: 9, candidat: "A", mesure: "M", source: null, pourquoi: null, statut: "analysee", reponse: "Publiée !", propositionId: 31, createdAt: "2026-11-13" };
  const p = propositionPourAdherent(ligne);
  assert.equal(p.statutLibelle, "Analysée");
  assert.equal(p.lien, "/declarations/31");
  assert.equal("adherentId" in p, false);
  const mail = composerMailProposition({ proposition: ligne, auteur: { id: 9, nom: "Camille" } });
  assert.match(mail.objet, /^\[Club\] Mesure proposée : A/);
  assert.match(mail.texte, /Adhérent : Camille \(n° 9\)/);
  assert.match(mail.texte, /Source : non indiquée/);
});
