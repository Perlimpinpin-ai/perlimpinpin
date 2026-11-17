"use server";

import { prisma } from "@/lib/prisma";
import { isEditor } from "@/lib/test-auth";
import { cleanContenu } from "../../../../scripts/lib/clean-text.js";
import { appelerClaudeReel, cleApiConfiguree, lirePromptReel } from "@/lib/claude-reel";
import { genererReelCore, jsonDepuisTexte } from "@/lib/reel-generation";
import { estimerReelCore, genererReelPourFicheCore } from "@/lib/reel-action-core";

// Actions du bouton « Générer le Reel » / « Régénérer » de /test/reels.
// Chaque action revérifie elle-même le mode édition (isEditor) : masquer un
// bouton ne protège rien. TEST_DRY_RUN=1 (Preview) : aucun appel payant.
// La durée maximale (300 s) est réglée sur les pages qui appellent ces
// actions (maxDuration de /test/reels et /test/reels/[id]).

export async function estimerReelAction(propositionId, brouillon = false) {
  return estimerReelCore(Number(propositionId), {
    brouillon: Boolean(brouillon),
    isEditor,
    prisma,
    lirePrompt: lirePromptReel,
  });
}

export async function genererReelAction(propositionId, brouillon = false) {
  try {
    return await genererReelPourFicheCore(Number(propositionId), {
      brouillon: Boolean(brouillon),
      isEditor,
      prisma,
      dryRun: process.env.TEST_DRY_RUN === "1",
      cleConfiguree: cleApiConfiguree(),
      generer: async (contenu, { candidatNom, score }) =>
        genererReelCore({
          ficheFinale: contenu,
          candidatNom,
          score,
          prompt: await lirePromptReel(),
          appeler: appelerClaudeReel,
          analyser: (reponse) => cleanContenu(jsonDepuisTexte(reponse.texte)),
        }),
    });
  } catch (error) {
    return { ok: false, erreur: `Erreur inattendue : ${error.message}` };
  }
}
