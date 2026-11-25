import test from "node:test";
import assert from "node:assert/strict";
import {
  commentairesPourPoints,
  construireHistorique,
  estTraitee,
  numeroVersion,
  passageExiste,
  planTraitements,
  prenomSeul,
} from "../src/lib/versions-core.js";
import { calculerPoints } from "../src/lib/club-points-core.js";

// Club ouvert, lot 5 : numéros de version, clôture et réaccrochage des
// annotations, points, historique (crédit par prénom avec accord seulement).

const d = (s) => new Date(s);

test("numéro de version : rang parmi les versions publiées ou remplacées", () => {
  const versions = [
    { id: 30, statut: "publie", createdAt: d("2026-11-08T19:00:00Z") },
    { id: 10, statut: "remplacee", createdAt: d("2026-10-01T10:00:00Z") },
    { id: 20, statut: "remplacee", createdAt: d("2026-10-20T10:00:00Z") },
    { id: 25, statut: "brouillon", createdAt: d("2026-10-25T10:00:00Z") },
    { id: 26, statut: "corbeille", createdAt: d("2026-10-26T10:00:00Z") },
  ];
  assert.equal(numeroVersion(versions, 10), 1);
  assert.equal(numeroVersion(versions, 20), 2);
  assert.equal(numeroVersion(versions, 30), 3);
  assert.equal(numeroVersion([], 99), 1);
});

test("le passage existe encore ? (gras Markdown et blancs ignorés)", () => {
  const contenu = {
    contexte_national: { synthese: "1,85 million de foyers.", texte: "Fin 2025, **1,85 million** de foyers   percevaient le RSA." },
    analyse_par_criteres: [{ critere: "efficacite", texte: "Le meilleur précédent n'explique que 7 %." }],
    verdict_final: "Fragile.",
    verdict_conclusion: "Mesure peu étayée.",
  };
  assert.equal(passageExiste(contenu, "contexte_national", "1,85 million de foyers percevaient"), true);
  assert.equal(passageExiste(contenu, "contexte_national", "1,83 million"), false);
  assert.equal(passageExiste(contenu, "analyse_par_criteres.efficacite", "n'explique que 7 %"), true);
  assert.equal(passageExiste(contenu, "analyse_par_criteres.alignement_logique", "7 %"), false);
  assert.equal(passageExiste(contenu, "verdict_final", "peu étayée"), true);
  assert.equal(passageExiste(contenu, "contexte_national", ""), false);
});

const tri = (categorie, reponse = `réponse ${categorie}`) => [{ id: 1, categorie, reponse, createdAt: "2026-11-08T07:10:00Z" }];
const ANNOTATIONS = [
  { id: "arg", sectionId: "contexte_national", quotedText: "1,83 million", tris: tri("argument_ou_source"), traitements: [] },
  { id: "q", sectionId: "verdict_final", quotedText: "Fragile.", tris: tri("question"), traitements: [] },
  { id: "arg-tard", sectionId: "contexte_national", quotedText: "percevaient le RSA", tris: tri("argument_ou_source"), traitements: [] },
  { id: "neuve-ok", sectionId: "contexte_national", quotedText: "percevaient le RSA", tris: [], traitements: [] },
  { id: "neuve-ko", sectionId: "contexte_national", quotedText: "texte supprimé", tris: [], traitements: [] },
  { id: "close", sectionId: "contexte_national", quotedText: "x", tris: tri("question"), traitements: [{ id: 9, etat: "traitee", createdAt: "2026-11-01T20:00:00Z" }] },
];
const REVISION = { commentIds: ["arg"], resume: { reponses: [{ commentaire_id: "arg", reponse: "Chiffre corrigé, merci.", retenu: true }] } };
const NOUVEAU = { id: 101, contenu: { contexte_national: { synthese: "s", texte: "1,85 million de foyers percevaient le RSA." } } };

test("publication : traitées closes avec l'ancienne version, autres réaccrochées sur la nouvelle", () => {
  const lignes = planTraitements({ annotations: ANNOTATIONS, decision: { id: 7, type: "publiee" }, revision: REVISION, versionArchive: 100, nouvelleVersion: NOUVEAU });
  const par = Object.fromEntries(lignes.map((l) => [l.commentId, l]));
  assert.deepEqual(par.arg, { commentId: "arg", etat: "traitee", analyseId: 100, decisionId: 7, categorie: "argument_ou_source", reponse: "Chiffre corrigé, merci.", retenu: true });
  assert.equal(par.q.etat, "traitee");
  assert.equal(par.q.reponse, "réponse question");
  assert.equal(par.q.retenu, false);
  // Argument hors révision et annotations pas encore triées : réaccrochées.
  assert.deepEqual(par["arg-tard"], { commentId: "arg-tard", etat: "reaccrochee", analyseId: 101, decisionId: 7, rattachement: "passage", retenu: false });
  assert.equal(par["neuve-ok"].rattachement, "passage");
  assert.equal(par["neuve-ko"].rattachement, "section");
  // Déjà close : rien.
  assert.equal(par.close, undefined);
});

test("rejet : rien de retenu, pas de réaccrochage", () => {
  const lignes = planTraitements({ annotations: ANNOTATIONS, decision: { id: 8, type: "rejetee" }, revision: REVISION, versionArchive: 100 });
  assert.deepEqual(lignes.map((l) => l.commentId).sort(), ["arg", "q"]);
  assert.ok(lignes.every((l) => l.etat === "traitee" && l.retenu === false && l.analyseId === 100));
});

test("validation des réponses sans révision : arguments laissés ouverts", () => {
  const lignes = planTraitements({ annotations: ANNOTATIONS, decision: { id: null, type: "reponses" }, versionArchive: 100 });
  assert.deepEqual(lignes.map((l) => l.commentId), ["q"]);
  assert.equal(lignes[0].decisionId, null);
});

test("points inchangés : 10 par annotation (5 par fiche), +20 si retenue — retenue lue dans la clôture", () => {
  const commentaires = [
    { ficheSlug: "fiche-12", retenu: false, traitements: [{ id: 1, etat: "traitee", retenu: true, createdAt: "x" }] },
    { ficheSlug: "fiche-12", retenu: false, traitements: [] },
    { ficheSlug: "melenchon-smic", retenu: true, traitements: [] },
  ];
  assert.equal(calculerPoints(commentairesPourPoints(commentaires)), 3 * 10 + 2 * 20);
  assert.equal(estTraitee(commentaires[0]), true);
});

test("historique : crédit par prénom seulement avec accord, annotations archivées par version", () => {
  const versions = [
    { id: 100, statut: "remplacee", createdAt: d("2026-10-01T10:00:00Z") },
    { id: 101, statut: "publie", createdAt: d("2026-11-08T19:05:00Z") },
  ];
  const decisions = [
    {
      id: 7,
      createdAt: d("2026-11-08T19:05:00Z"),
      analysePublieeId: 101,
      revision: {
        commentIds: ["a", "b", "c"],
        resume: {
          scoreAvant: 45,
          scoreApres: 51,
          raison: "Étude Dares 2026 prise en compte.",
          criteresModifies: [{ critere: "efficacite", ancienneNote: 9, nouvelleNote: 15 }],
          reponses: [
            { commentaire_id: "a", retenu: true },
            { commentaire_id: "b", retenu: true },
            { commentaire_id: "c", retenu: false },
          ],
        },
      },
    },
  ];
  const close = (retenu) => [{ id: 1, etat: "traitee", analyseId: 100, reponse: "Merci.", retenu, createdAt: "2026-11-08T19:05:00Z" }];
  const annotations = [
    { id: "a", creditAccord: true, adherent: { nom: "Camille D." }, body: "Source Dares", traitements: close(true) },
    { id: "b", creditAccord: false, adherent: { nom: "Léa M." }, body: "Autre", traitements: close(true) },
    { id: "c", creditAccord: true, adherent: { nom: "Hugo R." }, body: "Question", traitements: close(false) },
  ];
  const h = construireHistorique({ versions, decisions, annotations, libelles: { efficacite: "Efficacité" }, nomAffiche: (a) => a.adherent.nom });
  assert.equal(h.length, 2);
  assert.equal(h[0].numero, 1);
  assert.equal(h[0].raison, "Première publication.");
  assert.equal(h[0].annotations.length, 3); // archivées avec la V1
  assert.equal(h[1].numero, 2);
  assert.deepEqual(h[1].criteresModifies, [{ critere: "Efficacité", ancienneNote: 9, nouvelleNote: 15 }]);
  assert.deepEqual(h[1].credits, ["Camille"]); // Léa : pas d'accord ; Hugo : pas retenu
  assert.equal(h[1].scoreApres, 51);
});

test("prénom seul", () => {
  assert.equal(prenomSeul("Camille D."), "Camille");
  assert.equal(prenomSeul("Jean-Pierre"), "Jean-Pierre");
  assert.equal(prenomSeul(null), null);
});
