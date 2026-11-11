import test from "node:test";
import assert from "node:assert/strict";
import {
  DUREE_BROUILLON_MS,
  cleBrouillon,
  garderBrouillon,
  liensAdhesion,
  lireBrouillon,
  oublierBrouillon,
} from "../src/lib/brouillon-club.js";
import { retourValide } from "../src/lib/club-retour-core.js";

// Note d'un visiteur gardée dans son navigateur jusqu'à l'adhésion ou la
// connexion : stockage simulé, rien n'est envoyé.

function stockage() {
  const m = new Map();
  return {
    m,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

test("garder puis relire une note, par fiche et par type", () => {
  const s = stockage();
  const t0 = 1_800_000_000_000;
  assert.equal(
    garderBrouillon(12, "annotation", { body: "Source Insee 2026", creditAccord: true, sectionId: "contexte_national", quotedText: "1,83 million", startOffset: 40 }, { stockage: s, maintenant: t0 }),
    true,
  );
  assert.deepEqual(lireBrouillon(12, "annotation", { stockage: s, maintenant: t0 + 1000 }), {
    body: "Source Insee 2026",
    creditAccord: true,
    sectionId: "contexte_national",
    quotedText: "1,83 million",
    startOffset: 40,
    gardeLe: t0,
  });
  assert.equal(lireBrouillon(13, "annotation", { stockage: s, maintenant: t0 }), null);
  assert.equal(lireBrouillon(12, "remarque", { stockage: s, maintenant: t0 }), null);
});

test("note vide refusée, note trop ancienne effacée, oubli", () => {
  const s = stockage();
  assert.equal(garderBrouillon(12, "remarque", { body: "   " }, { stockage: s }), false);
  assert.equal(garderBrouillon(12, "autre", { body: "x" }, { stockage: s }), false);
  garderBrouillon(12, "remarque", { body: "Question" }, { stockage: s, maintenant: 0 });
  assert.equal(lireBrouillon(12, "remarque", { stockage: s, maintenant: DUREE_BROUILLON_MS + 1 }), null);
  assert.equal(s.m.has(cleBrouillon(12, "remarque")), false);
  garderBrouillon(12, "remarque", { body: "Question" }, { stockage: s });
  oublierBrouillon(12, "remarque", { stockage: s });
  assert.equal(lireBrouillon(12, "remarque", { stockage: s }), null);
});

test("stockage indisponible ou cassé : aucune erreur", () => {
  const casse = { getItem: () => { throw new Error("bloqué"); }, setItem: () => { throw new Error("plein"); }, removeItem: () => { throw new Error("x"); } };
  assert.equal(garderBrouillon(12, "annotation", { body: "x" }, { stockage: casse }), false);
  assert.equal(lireBrouillon(12, "annotation", { stockage: casse }), null);
  assert.doesNotThrow(() => oublierBrouillon(12, "annotation", { stockage: casse }));
  assert.equal(garderBrouillon(12, "annotation", { body: "x" }, { stockage: null }), false);
  const illisible = stockage();
  illisible.setItem(cleBrouillon(12, "annotation"), "{pas du json");
  assert.equal(lireBrouillon(12, "annotation", { stockage: illisible }), null);
});

test("liens de l'encart : retour sur la fiche, accepté par le serveur", () => {
  const { adherer, connexion } = liensAdhesion("/declarations/12?vue=expert");
  assert.equal(adherer, "/relectures/adherer?retour=%2Fdeclarations%2F12%3Fvue%3Dexpert");
  assert.equal(connexion, "/relectures/connexion?retour=%2Fdeclarations%2F12%3Fvue%3Dexpert");
  const retour = decodeURIComponent(adherer.split("retour=")[1]);
  assert.equal(retourValide(retour), "/declarations/12?vue=expert");
});

test("retour après connexion : la fiche affichée, dans la vue affichée", async () => {
  const { retourCourant } = await import("../src/lib/brouillon-club.js");
  const lieu = (pathname, search = "") => ({ pathname, search });
  assert.equal(retourCourant(null, lieu("/declarations/79", "?vue=expert")), "/declarations/79?vue=expert");
  assert.equal(retourCourant(null, lieu("/declarations/79")), "/declarations/79");
  assert.equal(retourCourant(null, lieu("/declarations/79", "?vue=basique&x=1")), "/declarations/79");
  assert.equal(retourCourant("/declarations/5", lieu("/candidats")), "/declarations/5");
  assert.equal(retourCourant(null, lieu("/")), null);
  assert.equal(retourValide(retourCourant(null, lieu("/declarations/79", "?vue=expert"))), "/declarations/79?vue=expert");
});
