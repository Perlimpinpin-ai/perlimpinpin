"use server";

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { prisma } from "@/lib/prisma";
import { isEditor } from "@/lib/test-auth";
import { cleanContenu } from "../../../../scripts/lib/clean-text.js";
import { appelerClaude, cleApiConfiguree, lirePromptRecit } from "@/lib/claude-reel";
import { jsonDepuisTexte } from "@/lib/reel-generation";
import { genererRecitCore, requeteRecit } from "@/lib/recit-generation";
import { estimerRecitCore, genererRecitPourFicheCore, regenererAvecRemarquesCore, revenirAuPrecedentCore } from "@/lib/recit-action-core";
import { resolveTheme } from "@/lib/themes";
import { DEMO_ACTIVE, genererDemo, ID_DEMO, prismaDemo } from "@/lib/carrousel-demo";
import { debordementsDuRecit } from "@/lib/carrousel-serveur";

// Actions du carrousel détaillé de /test/reseaux/[id] : « Générer le
// carrousel détaillé » / « Générer à nouveau », « Régénérer avec ces
// remarques », « Revenir à la version précédente » (un seul appel à Claude
// par génération). Chaque action revérifie elle-même le mode édition
// (isEditor) : masquer un bouton ne protège rien. TEST_DRY_RUN=1 (Preview) :
// aucun appel payant. Durée maximale (300 s) réglée sur la page (maxDuration).
// Identifiant « demo » (hors production) : démonstration locale sur un
// fichier, modèle simulé, jamais la base (src/lib/carrousel-demo.js).

// Sauvegarde de la ligne actuelle dans logs/sauvegardes/, comme
// scripts/reseaux.js. Sur un serveur sans disque inscriptible (Vercel), elle
// échoue : l'action le signale et l'ancienne version reste gardée sous `precedent`.
async function sauvegarder({ analyse, contenu }) {
  const dossier = join(process.cwd(), "logs", "sauvegardes");
  await mkdir(dossier, { recursive: true });
  const horodatage = new Date().toISOString().replace(/[:.]/g, "-");
  const cible = join(dossier, `analyse-${analyse.id}-avant-carrousel-detaille-${horodatage}.json`);
  await writeFile(cible, `${JSON.stringify({ analyseId: analyse.id, statut: analyse.statut, contenuComplet: contenu }, null, 2)}\n`, "utf-8");
  return cible;
}

// Image de thème du dernier carrousel détaillé du même thème (pour ne pas
// reprendre la même), lue par Postgres sans charger les fiches.
async function derniereIllustration({ theme, propositionId }) {
  const lignes = await prisma.$queryRaw`
    SELECT p.theme, a."contenuComplet"->'reseaux_recit'->>'illustration' AS fichier
    FROM "Analyse" a JOIN "Proposition" p ON p.id = a."propositionId"
    WHERE jsonb_exists(a."contenuComplet"->'reseaux_recit', 'illustration') AND p.id <> ${propositionId}
    ORDER BY a."updatedAt" DESC
    LIMIT 50
  `;
  const slug = resolveTheme(theme);
  return lignes.find((ligne) => resolveTheme(ligne.theme) === slug)?.fichier ?? null;
}

function genererReel(contenu, { candidatNom, score, propositionId, motsClesIllustration, remarques, proposition }) {
  return lirePromptRecit().then((prompt) =>
    genererRecitCore({
      ficheFinale: contenu,
      candidatNom,
      score,
      propositionId,
      prompt,
      motsClesIllustration,
      remarques,
      debordements: proposition ? (recit) => debordementsDuRecit(recit, { proposition, contenu, score }) : null,
      appeler: (message) => appelerClaude(requeteRecit(message)),
      analyser: (reponse) => cleanContenu(jsonDepuisTexte(reponse.texte)),
    }),
  );
}

// Dépendances de la vraie fiche, ou de la démonstration locale.
function dependances(propositionId, brouillon) {
  if (propositionId === ID_DEMO) {
    if (!DEMO_ACTIVE) return null;
    return { id: 1, brouillon: true, prisma: prismaDemo(), dryRun: false, cleConfiguree: true, generer: genererDemo, sauvegarder: async () => null, derniereIllustration: null };
  }
  return {
    id: Number(propositionId),
    brouillon: Boolean(brouillon),
    prisma,
    dryRun: process.env.TEST_DRY_RUN === "1",
    cleConfiguree: cleApiConfiguree(),
    generer: genererReel,
    sauvegarder,
    derniereIllustration,
  };
}

const INTROUVABLE = { ok: false, erreur: "Fiche introuvable." };

async function protege(fn) {
  try {
    return await fn();
  } catch (error) {
    return { ok: false, erreur: `Erreur inattendue : ${error.message}` };
  }
}

export async function estimerRecitAction(propositionId, brouillon = false, remarque = null, cible = null) {
  const d = dependances(propositionId, brouillon);
  if (!d) return INTROUVABLE;
  return protege(() => estimerRecitCore(d.id, { brouillon: d.brouillon, isEditor, prisma: d.prisma, lirePrompt: lirePromptRecit, remarque, cible }));
}

export async function genererRecitAction(propositionId, brouillon = false) {
  const d = dependances(propositionId, brouillon);
  if (!d) return INTROUVABLE;
  return protege(() => genererRecitPourFicheCore(d.id, { ...d, isEditor }));
}

export async function regenererAvecRemarquesAction(propositionId, brouillon = false, remarque = "", cible = "toutes") {
  const d = dependances(propositionId, brouillon);
  if (!d) return INTROUVABLE;
  return protege(() => regenererAvecRemarquesCore(d.id, { ...d, isEditor, remarque, cible }));
}

export async function revenirAuPrecedentAction(propositionId, brouillon = false) {
  const d = dependances(propositionId, brouillon);
  if (!d) return INTROUVABLE;
  return protege(() => revenirAuPrecedentCore(d.id, { ...d, isEditor }));
}
