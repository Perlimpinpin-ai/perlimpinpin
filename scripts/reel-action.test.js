import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { estimerReelCore, genererReelPourFicheCore } from "../src/lib/reel-action-core.js";

const MAJ = new Date("2026-11-17T10:00:00Z");

// Fausse base : une fiche avec une analyse publiée et un brouillon plus récent.
function fausseBase({ contenuPublie = { titre_fiche: "Publiée" }, contenuBrouillon = { titre_fiche: "Brouillon" }, compte = 1 } = {}) {
  const ecritures = [];
  const analyses = [
    { id: 11, statut: "brouillon", scoreFaisabilite: 40, updatedAt: MAJ, contenuComplet: contenuBrouillon },
    { id: 10, statut: "publie", scoreFaisabilite: 38, updatedAt: MAJ, contenuComplet: contenuPublie },
  ];
  return {
    ecritures,
    // Derniers Reels générés (lecture seule) : un seul, fictif.
    $queryRaw: async () => [{ reel: { texteVoix: "Sauf que voilà.", couverture: { question: "Qui paie ?" }, variantes: { signature: 1 } } }],
    proposition: {
      findUnique: async ({ where, select }) => {
        if (where.id !== 93) return null;
        const filtre = select.analyses.where?.statut;
        return { id: 93, candidat: { nom: "Teddy Riner" }, analyses: analyses.filter((a) => !filtre || a.statut === filtre) };
      },
    },
    analyse: {
      updateMany: async (args) => {
        ecritures.push(args);
        return { count: compte };
      },
    },
  };
}

const editeur = async () => true;
const visiteur = async () => false;
const REEL = { scenes: [], texteVoix: "…" };
const genererOk = async () => ({ reel: REEL, usage: { input_tokens: 10000, output_tokens: 1500 }, errors: [], avertissements: ["a"] });

test("refus hors mode édition : aucun appel, aucune écriture", async () => {
  const prisma = fausseBase();
  let appels = 0;
  const r = await genererReelPourFicheCore(93, {
    isEditor: visiteur,
    prisma,
    dryRun: false,
    cleConfiguree: true,
    generer: async () => {
      appels++;
      return genererOk();
    },
  });
  assert.equal(r.ok, false);
  assert.match(r.erreur, /Mode édition/);
  assert.equal(appels, 0);
  assert.equal(prisma.ecritures.length, 0);
  assert.equal((await estimerReelCore(93, { isEditor: visiteur, prisma, lirePrompt: async () => "P" })).ok, false);
});

test("TEST_DRY_RUN : aucun appel payant, rien n'est écrit", async () => {
  const prisma = fausseBase();
  let appels = 0;
  const r = await genererReelPourFicheCore(93, {
    isEditor: editeur,
    prisma,
    dryRun: true,
    cleConfiguree: true,
    generer: async () => {
      appels++;
      return genererOk();
    },
  });
  assert.equal(r.ok, true);
  assert.equal(r.simulation, true);
  assert.equal(appels, 0);
  assert.equal(prisma.ecritures.length, 0);
});

test("clé API absente : erreur claire, aucun appel", async () => {
  const prisma = fausseBase();
  const r = await genererReelPourFicheCore(93, { isEditor: editeur, prisma, dryRun: false, cleConfiguree: false, generer: genererOk });
  assert.equal(r.ok, false);
  assert.match(r.erreur, /ANTHROPIC_API_KEY/);
  assert.equal(prisma.ecritures.length, 0);
});

test("génération : vise la publiée (ou le brouillon), écrit seulement reel, avec le contrôle updatedAt", async () => {
  const prisma = fausseBase();
  const vus = [];
  const r = await genererReelPourFicheCore(93, {
    isEditor: editeur,
    prisma,
    dryRun: false,
    cleConfiguree: true,
    generer: async (contenu, ctx) => {
      vus.push({ contenu, ctx });
      return genererOk();
    },
  });
  assert.equal(r.ok, true);
  assert.equal(r.message, "Reel généré.");
  assert.equal(r.cout, 0.035);
  assert.deepEqual(vus[0].ctx.candidatNom, "Teddy Riner");
  assert.equal(vus[0].ctx.score, 38);
  assert.equal(vus[0].ctx.precedents[0].couverture.question, "Qui paie ?");
  assert.equal(vus[0].contenu.titre_fiche, "Publiée");
  assert.deepEqual(prisma.ecritures, [
    { where: { id: 10, updatedAt: MAJ }, data: { contenuComplet: { titre_fiche: "Publiée", reel: REEL } } },
  ]);

  const prismaBrouillon = fausseBase();
  await genererReelPourFicheCore(93, { brouillon: true, isEditor: editeur, prisma: prismaBrouillon, dryRun: false, cleConfiguree: true, generer: genererOk });
  assert.equal(prismaBrouillon.ecritures[0].where.id, 11);
});

test("régénérer : l'ancien Reel est gardé sous reelPrecedent", async () => {
  const ancien = { scenes: [], texteVoix: "ancien" };
  const prisma = fausseBase({ contenuPublie: { titre_fiche: "Publiée", reel: ancien } });
  const r = await genererReelPourFicheCore(93, { isEditor: editeur, prisma, dryRun: false, cleConfiguree: true, generer: genererOk });
  assert.match(r.message, /régénéré/);
  assert.deepEqual(prisma.ecritures[0].data.contenuComplet, { titre_fiche: "Publiée", reelPrecedent: ancien, reel: REEL });
});

test("fiche modifiée pendant la génération : rien n'est écrit, erreur claire", async () => {
  const prisma = fausseBase({ compte: 0 });
  const r = await genererReelPourFicheCore(93, { isEditor: editeur, prisma, dryRun: false, cleConfiguree: true, generer: genererOk });
  assert.equal(r.ok, false);
  assert.match(r.erreur, /modifiée pendant la génération/);
});

test("script refusé deux fois : erreur en clair avec le coût, rien n'est écrit", async () => {
  const prisma = fausseBase();
  const r = await genererReelPourFicheCore(93, {
    isEditor: editeur,
    prisma,
    dryRun: false,
    cleConfiguree: true,
    generer: async () => ({ reel: null, usage: { input_tokens: 20000 }, errors: ["Scène « hic » : deux-points dans la voix (interdit)."] }),
  });
  assert.equal(r.ok, false);
  assert.match(r.erreur, /deux-points/);
  assert.equal(r.cout, 0.04);
  assert.equal(prisma.ecritures.length, 0);
});

test("fiche inconnue ou id invalide", async () => {
  const prisma = fausseBase();
  for (const id of [94, Number.NaN, -1]) {
    const r = await genererReelPourFicheCore(id, { isEditor: editeur, prisma, dryRun: false, cleConfiguree: true, generer: genererOk });
    assert.equal(r.ok, false);
  }
});

test("estimation : coût et présence d'un Reel, sans appel", async () => {
  const prisma = fausseBase({ contenuPublie: { titre_fiche: "Publiée", reel: { scenes: [] } } });
  const r = await estimerReelCore(93, { isEditor: editeur, prisma, lirePrompt: async () => "P".repeat(25000) });
  assert.equal(r.ok, true);
  assert.equal(r.aDejaUnReel, true);
  assert.ok(r.min > 0 && r.max > r.min);
});

test("actions.js branche isEditor, TEST_DRY_RUN et la clé API sur la logique testée", () => {
  const source = readFileSync(new URL("../src/app/test/reels/actions.js", import.meta.url), "utf8");
  assert.match(source, /^"use server";/);
  assert.match(source, /genererReelPourFicheCore\([\s\S]*isEditor,[\s\S]*prisma,[\s\S]*dryRun: process\.env\.TEST_DRY_RUN === "1",[\s\S]*cleConfiguree: cleApiConfiguree\(\)/);
});

test("les pages du bouton ont une durée maximale de 300 s", () => {
  for (const page of ["../src/app/test/reels/page.js", "../src/app/test/reels/[id]/page.js"]) {
    const source = readFileSync(new URL(page, import.meta.url), "utf8");
    assert.match(source, /export const maxDuration = 300;/, page);
  }
});
