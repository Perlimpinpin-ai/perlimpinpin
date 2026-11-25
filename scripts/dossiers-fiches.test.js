// Tests de scripts/lib/dossiers-fiches.js (lien fiche relue ↔ dossiers).
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { relierDansDossier, relierFicheAuxDossiers } from "./lib/dossiers-fiches.js";

const DOSSIER = {
  slug: "mouvement-social",
  propositions: [
    { id: "zemmour-loi-1970", fiche: "zemmour-loi-anticasseurs-1970", intitule: "Loi de 1970" },
    { id: "attal-reseaux", fiche: "attal-blocage-reseaux-sociaux-emeutes", ficheId: 66 },
  ],
};

test("relierDansDossier : écrit ficheId sur la proposition dont `fiche` vaut le slug", () => {
  const { dossier, modifiees } = relierDansDossier(DOSSIER, "zemmour-loi-anticasseurs-1970", 69);
  assert.equal(modifiees, 1);
  assert.equal(dossier.propositions[0].ficheId, 69);
  assert.equal(dossier.propositions[1].ficheId, 66);
  assert.equal(DOSSIER.propositions[0].ficheId, undefined, "l'objet d'origine n'est pas modifié");
});

test("relierDansDossier : rien à faire si la fiche n'est pas citée, si ficheId est déjà bon ou sans propositions", () => {
  assert.equal(relierDansDossier(DOSSIER, "autre-fiche", 70).modifiees, 0);
  assert.equal(relierDansDossier(DOSSIER, "attal-blocage-reseaux-sociaux-emeutes", 66).modifiees, 0);
  assert.equal(relierDansDossier({ slug: "rn", fiches: [] }, "x", 1).modifiees, 0);
});

test("relierFicheAuxDossiers : réécrit seulement les dossiers concernés, au même format", () => {
  const root = mkdtempSync(path.join(tmpdir(), "dossiers-test-"));
  const dir = path.join(root, "data/hors-series");
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "mouvement-social.json"), `${JSON.stringify(DOSSIER, null, 2)}\n`);
  const autre = '{"slug":"rn","fiches":[]}';
  writeFileSync(path.join(dir, "rn-plan-budgetaire.json"), autre);
  writeFileSync(path.join(dir, "inventaire.json"), '{"mesures":[]}');

  const modifies = relierFicheAuxDossiers({ root, slug: "zemmour-loi-anticasseurs-1970", propositionId: 69 });
  assert.deepEqual(modifies, ["data/hors-series/mouvement-social.json"]);
  const ecrit = readFileSync(path.join(dir, "mouvement-social.json"), "utf8");
  assert.equal(JSON.parse(ecrit).propositions[0].ficheId, 69);
  assert.ok(ecrit.endsWith("}\n") && ecrit.includes('\n  "propositions": ['));
  assert.equal(readFileSync(path.join(dir, "rn-plan-budgetaire.json"), "utf8"), autre);

  assert.deepEqual(relierFicheAuxDossiers({ root, slug: "zemmour-loi-anticasseurs-1970", propositionId: 69 }), []);
  assert.deepEqual(relierFicheAuxDossiers({ root, slug: "x", propositionId: null }), []);
  rmSync(root, { recursive: true });
});

test("le dossier Mouvement social cite chaque fiche une seule fois, avec un onglet et un statut connus", () => {
  const d = JSON.parse(readFileSync(new URL("../data/hors-series/mouvement-social.json", import.meta.url), "utf8"));
  const onglets = new Set(d.onglets.map((o) => o.id));
  const statuts = new Set(d.statuts.items.map((s) => s.id));
  const fiches = d.propositions.map((p) => p.fiche).filter(Boolean);
  assert.equal(new Set(fiches).size, fiches.length, "une fiche citée deux fois");
  for (const p of d.propositions) {
    assert.ok(onglets.has(p.onglet), `onglet inconnu pour ${p.id}`);
    assert.ok(statuts.has(p.statut), `statut inconnu pour ${p.id}`);
    assert.ok(p.ficheId === undefined || Number.isInteger(p.ficheId), `ficheId non entier pour ${p.id}`);
  }
});
