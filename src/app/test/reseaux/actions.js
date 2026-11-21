"use server";

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { prisma } from "@/lib/prisma";
import { isEditor } from "@/lib/test-auth";
import { cleanContenu } from "../../../../scripts/lib/clean-text.js";
import { appelerClaude, cleApiConfiguree, lirePromptRecit } from "@/lib/claude-reel";
import { jsonDepuisTexte } from "@/lib/reel-generation";
import { genererRecitCore, requeteRecit } from "@/lib/recit-generation";
import { estimerRecitCore, genererRecitPourFicheCore } from "@/lib/recit-action-core";

// Actions du bouton « Générer le récit » / « Générer à nouveau » de
// /test/reseaux/[id] (carrousel récit et tweet long, un seul appel à Claude).
// Chaque action revérifie elle-même le mode édition (isEditor) : masquer un
// bouton ne protège rien. TEST_DRY_RUN=1 (Preview) : aucun appel payant.
// Durée maximale (300 s) réglée sur la page (maxDuration).

// Sauvegarde de la ligne actuelle dans logs/sauvegardes/, comme
// scripts/reseaux.js. Sur un serveur sans disque inscriptible (Vercel), elle
// échoue : l'action le signale et l'ancien récit reste gardé sous `precedent`.
async function sauvegarder({ analyse, contenu }) {
  const dossier = join(process.cwd(), "logs", "sauvegardes");
  await mkdir(dossier, { recursive: true });
  const horodatage = new Date().toISOString().replace(/[:.]/g, "-");
  const cible = join(dossier, `analyse-${analyse.id}-avant-recit-${horodatage}.json`);
  await writeFile(cible, `${JSON.stringify({ analyseId: analyse.id, statut: analyse.statut, contenuComplet: contenu }, null, 2)}\n`, "utf-8");
  return cible;
}

export async function estimerRecitAction(propositionId, brouillon = false) {
  return estimerRecitCore(Number(propositionId), { brouillon: Boolean(brouillon), isEditor, prisma, lirePrompt: lirePromptRecit });
}

export async function genererRecitAction(propositionId, brouillon = false) {
  try {
    return await genererRecitPourFicheCore(Number(propositionId), {
      brouillon: Boolean(brouillon),
      isEditor,
      prisma,
      dryRun: process.env.TEST_DRY_RUN === "1",
      cleConfiguree: cleApiConfiguree(),
      sauvegarder,
      generer: async (contenu, { candidatNom, score, propositionId: id }) =>
        genererRecitCore({
          ficheFinale: contenu,
          candidatNom,
          score,
          propositionId: id,
          prompt: await lirePromptRecit(),
          appeler: (message) => appelerClaude(requeteRecit(message)),
          analyser: (reponse) => cleanContenu(jsonDepuisTexte(reponse.texte)),
        }),
    });
  } catch (error) {
    return { ok: false, erreur: `Erreur inattendue : ${error.message}` };
  }
}
