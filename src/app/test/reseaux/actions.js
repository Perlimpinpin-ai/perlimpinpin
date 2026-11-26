"use server";

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { prisma } from "@/lib/prisma";
import { isEditor } from "@/lib/test-auth";
import { cleanContenu } from "../../../../scripts/lib/clean-text.js";
import { appelerClaude, cleApiConfiguree, lirePromptRecit } from "@/lib/claude-reel";
import { jsonDepuisTexte } from "@/lib/reel-generation";
import { genererRecitCore, requeteRecit } from "@/lib/recit-generation";
import { changerPhotoCore, estimerRecitCore, genererRecitPourFicheCore, regenererAvecRemarquesCore, revenirAuPrecedentCore } from "@/lib/recit-action-core";
import { photosTirage } from "@/lib/photos-candidats-serveur";
import { historiqueImages } from "@/lib/banque-images";
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

// Images des carrousels détaillés déjà générés (src/lib/banque-images.js) :
// fichiers d'image de thème des carrousels du même thème et numéros de photo
// des carrousels du même candidat, le plus récent d'abord. Lecture seule, par
// Postgres, sans charger les fiches.
async function imagesRecentes({ theme, slug }) {
  const lignes = await prisma.$queryRaw`
    SELECT p.theme, c.nom AS "candidatNom", c."photoUrl",
      a."contenuComplet"->'reseaux_recit'->>'illustration' AS illustration,
      a."contenuComplet"->'reseaux_recit'->>'photo' AS photo,
      a."contenuComplet"->'reseaux_recit'->>'genereLe' AS "genereLe",
      a."updatedAt"
    FROM "Analyse" a JOIN "Proposition" p ON p.id = a."propositionId" JOIN "Candidat" c ON c.id = p."candidatId"
    WHERE jsonb_exists(a."contenuComplet", 'reseaux_recit')
    ORDER BY a."updatedAt" DESC
    LIMIT 200
  `;
  return historiqueImages(lignes.map((l) => ({ ...l, updatedAt: l.updatedAt?.toISOString?.() ?? l.updatedAt })), { theme, slug });
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
    return { id: 1, brouillon: true, prisma: prismaDemo(), dryRun: false, cleConfiguree: true, generer: genererDemo, sauvegarder: async () => null, imagesRecentes: null, photos: photosTirage("mesure") };
  }
  return {
    id: Number(propositionId),
    brouillon: Boolean(brouillon),
    prisma,
    dryRun: process.env.TEST_DRY_RUN === "1",
    cleConfiguree: cleApiConfiguree(),
    generer: genererReel,
    sauvegarder,
    imagesRecentes,
    // Tirage des photos : les dossiers préparés présents sur le disque, moins les écartées.
    photos: photosTirage("mesure"),
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

export async function changerPhotoAction(propositionId, brouillon = false) {
  const d = dependances(propositionId, brouillon);
  if (!d) return INTROUVABLE;
  return protege(() => changerPhotoCore(d.id, { ...d, isEditor }));
}

export async function revenirAuPrecedentAction(propositionId, brouillon = false) {
  const d = dependances(propositionId, brouillon);
  if (!d) return INTROUVABLE;
  return protege(() => revenirAuPrecedentCore(d.id, { ...d, isEditor }));
}
