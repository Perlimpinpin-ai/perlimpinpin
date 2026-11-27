import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { genererRecitCore } from "./recit-generation.js";
import { genererTweetLongCore } from "./tweet-long.js";
import { PARTIES_PAR_CIBLE, reponseDepuisRecit } from "./recit.js";

// Démonstration locale du carrousel détaillé sur une fiche locale, sans base
// et sans appel payant : /test/reseaux/demo et /api/carrousel/demo lisent
// data/demo-carrousel/demo.json ({ proposition, analyse, simulation },
// préparé par `node scripts/recit.js --demo --fichier <fiche.json>`).
// Les boutons de la démonstration passent par la même logique que la vraie
// page (src/lib/recit-action-core.js), avec :
//  - un faux `prisma` qui lit et écrit ce fichier (jamais la base) ;
//  - un modèle simulé : il renvoie la réponse préparée dans `simulation`
//    (et, pour une remarque, la partie prévue pour la slide visée).
// Désactivée en production.

export const DEMO_ACTIVE = process.env.NODE_ENV !== "production";
export const ID_DEMO = "demo";
const FICHIER = join(process.cwd(), "data", "demo-carrousel", "demo.json");

export async function lireDemo() {
  if (!DEMO_ACTIVE) return null;
  try {
    return JSON.parse(await readFile(FICHIER, "utf-8"));
  } catch {
    return null;
  }
}

async function ecrireDemo(demo) {
  if (!DEMO_ACTIVE) throw new Error("Démonstration désactivée en production.");
  await writeFile(FICHIER, `${JSON.stringify(demo, null, 2)}\n`, "utf-8");
}

// Faux client Prisma limité à ce qu'utilisent analyseVisee et l'écriture
// ciblée de src/lib/recit-action-core.js.
export function prismaDemo() {
  return {
    proposition: {
      async findUnique() {
        const demo = await lireDemo();
        if (!demo) return null;
        return { ...demo.proposition, analyses: [{ ...demo.analyse, updatedAt: demo.analyse.updatedAt ?? "demo-0" }] };
      },
    },
    analyse: {
      async updateMany({ where, data }) {
        const demo = await lireDemo();
        if (!demo || (demo.analyse.updatedAt ?? "demo-0") !== where.updatedAt) return { count: 0 };
        demo.analyse = { ...demo.analyse, contenuComplet: data.contenuComplet, updatedAt: `demo-${Date.now()}` };
        await ecrireDemo(demo);
        return { count: 1 };
      },
    },
  };
}

// Génération simulée : même contrôle et même fusion que la vraie génération,
// réponse lue dans demo.simulation, usage estimé d'après la longueur du message.
export async function genererDemo(contenu, { candidatNom, score, propositionId, motsClesIllustration, remarques = null, proposition = null }) {
  const demo = await lireDemo();
  const simulation = demo?.simulation ?? {};
  // Import dynamique : carrousel-serveur lit les polices et le disque (serveur seulement).
  const { debordementsDuRecit } = await import("./carrousel-serveur.js");
  return genererRecitCore({
    ficheFinale: contenu,
    candidatNom,
    score,
    propositionId,
    prompt: await readFile(join(process.cwd(), "data", "prompt-recit.md"), "utf-8"),
    motsClesIllustration,
    remarques,
    debordements: proposition ? (recit) => debordementsDuRecit(recit, { proposition, contenu, score }) : null,
    appeler: async (message) => {
      let reponse = simulation.reponse ?? {};
      if (remarques) {
        reponse = reponseDepuisRecit(remarques.precedent);
        const prevue = simulation.remarques?.[remarques.cible];
        if (prevue) for (const partie of PARTIES_PAR_CIBLE[remarques.cible] ?? Object.keys(prevue)) if (prevue[partie] !== undefined) reponse[partie] = prevue[partie];
      }
      return { texte: JSON.stringify(reponse), usage: { input_tokens: Math.ceil(message.length / 3.5), output_tokens: 1800 } };
    },
    analyser: (reponse) => JSON.parse(reponse.texte),
    journal: { error: () => {} },
  });
}

// Tweet long simulé (section 5) : même contrôle que la vraie génération,
// texte lu dans demo.simulation.tweet_long, usage estimé d'après la longueur
// du message. Sans texte préparé, la génération échoue avec un message clair.
export async function genererTweetLongDemo(contenu, { candidatNom, score, propositionId, publie, introPrecedente = "" }) {
  const demo = await lireDemo();
  const texte = demo?.simulation?.tweet_long;
  return genererTweetLongCore({
    contenu,
    candidatNom,
    score,
    propositionId,
    publie,
    introPrecedente,
    prompt: await readFile(join(process.cwd(), "data", "prompt-tweet-long.md"), "utf-8"),
    appeler: async (message) => {
      if (typeof texte !== "string") throw new Error("Pas de tweet long simulé dans data/demo-carrousel/demo.json (simulation.tweet_long).");
      return { texte, usage: { input_tokens: Math.ceil(message.length / 3.5), output_tokens: 600 } };
    },
    journal: { error: () => {} },
  });
}
