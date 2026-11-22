"use server";

import { prisma } from "@/lib/prisma";
import { isEditor } from "@/lib/test-auth";
import { cleanContenu } from "../../../../scripts/lib/clean-text.js";
import { appelerClaudeReel, cleApiConfiguree, lirePromptReel } from "@/lib/claude-reel";
import { fichePourReel, jsonDepuisTexte } from "@/lib/reel-generation";
import { estimerStoryboardCore, genererStoryboardPourFicheCore, lireDepotEquipe } from "@/lib/reel-action-core";
import { construireMessageStoryboard, genererStoryboardCore } from "@/lib/reel-storyboard-generation";
import { controlerStoryboard, lireMinutage } from "@/lib/reel-storyboard";
import { cartesDisponibles, lireSimulation } from "@/lib/reel-storyboard-serveur";

// Actions des Reels (storyboard v4) de /test/reels et /test/reels/<id> :
//   - mode A « Script Claude » : bouton « Générer le Reel » / « Générer à nouveau » ;
//   - mode B « Script et voix off de l'équipe » : dépôt du script et de minutage.json.
// Chaque action revérifie elle-même le mode édition (isEditor) : masquer un
// bouton ne protège rien. TEST_DRY_RUN=1 (Preview, démo locale) : aucun appel
// payant, rien n'est écrit. Durée maximale (300 s) réglée sur les pages.

const dryRun = () => process.env.TEST_DRY_RUN === "1";

async function construireMessage({ mode, contenu, score, script }) {
  return construireMessageStoryboard({ prompt: await lirePromptReel(), ficheFinale: contenu, mode, variantes: { signature: 0, verdict: 0, fin: 0 }, score, script });
}

async function generer({ mode, contenu, candidatNom, score, precedents, depot }) {
  return genererStoryboardCore({
    mode,
    ficheFinale: contenu,
    candidatNom,
    score,
    precedents,
    script: depot?.script ?? "",
    minutage: depot?.minutage ?? null,
    prompt: await lirePromptReel(),
    cartesDisponibles: cartesDisponibles(),
    appeler: appelerClaudeReel,
    analyser: (reponse) => cleanContenu(jsonDepuisTexte(reponse.texte)),
  });
}

// Simulation du mode B : le dépôt est contrôlé contre la réponse simulée
// (data/reel-demo/fiche-<id>/reponse-B.json).
function simuler({ proposition, analyse, depot }) {
  const sim = lireSimulation(proposition.id, "B");
  if (sim.erreur) return null;
  return controlerStoryboard(sim.reponse, {
    mode: "B",
    ficheFinale: fichePourReel(analyse.contenuComplet ?? {}),
    score: analyse.scoreFaisabilite,
    script: depot.script,
    minutage: depot.minutage,
    cartesDisponibles: cartesDisponibles(),
  });
}

export async function estimerReelAction(propositionId, brouillon = false) {
  return estimerStoryboardCore(Number(propositionId), { mode: "A", brouillon: Boolean(brouillon), isEditor, prisma, construireMessage });
}

export async function genererReelAction(propositionId, brouillon = false) {
  try {
    return await genererStoryboardPourFicheCore(Number(propositionId), {
      mode: "A",
      brouillon: Boolean(brouillon),
      isEditor,
      prisma,
      dryRun: dryRun(),
      cleConfiguree: cleApiConfiguree(),
      generer,
    });
  } catch (error) {
    return { ok: false, erreur: `Erreur inattendue : ${error.message}` };
  }
}

// Mode B. `fichiers` : { script, minutage } (textes lus dans le navigateur ;
// minutage : contenu de minutage.json, facultatif).
export async function estimerEquipeAction(propositionId, brouillon, fichiers) {
  const depot = lireDepotEquipe({ script: fichiers?.script, minutageBrut: fichiers?.minutage }, lireMinutage);
  if (depot.erreur) return { ok: false, erreur: depot.erreur };
  return estimerStoryboardCore(Number(propositionId), { mode: "B", brouillon: Boolean(brouillon), isEditor, prisma, construireMessage, script: depot.script });
}

export async function deposerEquipeAction(propositionId, brouillon, fichiers) {
  try {
    const depot = lireDepotEquipe({ script: fichiers?.script, minutageBrut: fichiers?.minutage }, lireMinutage);
    return await genererStoryboardPourFicheCore(Number(propositionId), {
      mode: "B",
      brouillon: Boolean(brouillon),
      isEditor,
      prisma,
      dryRun: dryRun(),
      cleConfiguree: cleApiConfiguree(),
      generer,
      simuler,
      depot,
    });
  } catch (error) {
    return { ok: false, erreur: `Erreur inattendue : ${error.message}` };
  }
}
