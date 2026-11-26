import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { prisma } from "./prisma.js";
import { empreinte, slugCandidat } from "./carte.js";
import { resolveTheme } from "./themes.js";
import { fichePourReel } from "./reel-generation.js";
import { donneesSimulationFormat, etatStoryboard, etatStoryboardFormat, ficheSimulation, ressourcesRendu } from "./reel-storyboard-serveur.js";

// Lecture du storyboard, pour les pages /test/reels/<id>,
// /test/reseaux/programme/<slug>, /test/reseaux/thematique/<thème> et les
// routes des images. Lecture seule. En simulation, rien n'est lu en base :
// les fiches viennent de data/reel-demo/.

// Analyse visée : avec brouillon, le dernier brouillon ; sinon la dernière
// publiée, à défaut le dernier brouillon (même règle que la page v3).
export async function chargerFiche(propositionId, { brouillon = false, simulation = null } = {}) {
  if (simulation) {
    const fiche = ficheSimulation(propositionId);
    if (fiche) return fiche;
  }
  const proposition = await prisma.proposition.findUnique({
    where: { id: propositionId },
    select: {
      id: true,
      titre: true,
      theme: true,
      candidat: { select: { nom: true, photoUrl: true } },
      analyses: {
        ...(brouillon ? { where: { statut: "brouillon" } } : {}),
        orderBy: { createdAt: "desc" },
        select: { id: true, statut: true, scoreFaisabilite: true, contenuComplet: true, updatedAt: true },
      },
    },
  });
  const analyses = proposition?.analyses ?? [];
  const analyse = analyses.find((a) => a.statut === "publie") ?? analyses.find((a) => a.statut === "brouillon");
  return analyse ? { proposition, analyse } : null;
}

// Fiches publiées au format de src/lib/reel-formats.js.
function versFiche(p) {
  const a = p.analyses[0];
  return {
    propositionId: p.id,
    titre: p.titre,
    theme: p.theme,
    dateDeclaration: p.dateDeclaration?.toISOString?.() ?? p.dateDeclaration,
    candidat: { nom: p.candidat.nom, photoUrl: p.candidat.photoUrl },
    score: a.scoreFaisabilite,
    fiche: fichePourReel(a.contenuComplet ?? {}),
  };
}

const SELECT_FICHE = {
  id: true,
  titre: true,
  theme: true,
  dateDeclaration: true,
  candidat: { select: { nom: true, photoUrl: true } },
  analyses: { where: { statut: "publie" }, orderBy: { createdAt: "desc" }, take: 1, select: { scoreFaisabilite: true, contenuComplet: true } },
};

// Données des formats programme et thématique : { fiches, candidatsConnus }.
// En simulation : data/reel-demo/<format>-<cible>/donnees.json.
export async function chargerDonneesFormat(format, cible, { simulation = null } = {}) {
  if (simulation) {
    const donnees = donneesSimulationFormat(format, cible);
    if (donnees) return donnees;
  }
  const candidatsConnus = await prisma.candidat.findMany({ select: { nom: true, photoUrl: true }, orderBy: { nom: "asc" } });
  if (format === "programme") {
    const candidat = candidatsConnus.find((c) => slugCandidat(c) === cible);
    if (!candidat) return null;
    const propositions = await prisma.proposition.findMany({ where: { candidat: { nom: candidat.nom }, analyses: { some: { statut: "publie" } } }, select: SELECT_FICHE });
    return { fiches: propositions.filter((p) => p.analyses.length).map(versFiche), candidatsConnus, candidat };
  }
  const propositions = await prisma.proposition.findMany({ where: { analyses: { some: { statut: "publie" } } }, select: SELECT_FICHE });
  const slug = resolveTheme(cible) ?? cible;
  return { fiches: propositions.filter((p) => p.analyses.length && (resolveTheme(p.theme) ?? p.theme) === slug).map(versFiche), candidatsConnus };
}

// Version des images dans l'URL : le moindre changement du Reel ou du score
// donne une nouvelle URL.
export function versionStoryboard({ analyse, simulation }) {
  if (simulation) return `sim-${simulation}`;
  return `${analyse.id}-${empreinte(JSON.stringify([analyse.scoreFaisabilite, analyse.contenuComplet?.reel ?? null]))}`;
}

let policesEnCache = null;
export function policesStoryboard() {
  policesEnCache ??= Promise.all(
    [
      ["InterDisplay-Medium.otf", "Inter Display", 500],
      ["InterDisplay-Bold.otf", "Inter Display", 700],
      ["InterDisplay-Black.otf", "Inter Display", 900],
      ["Silkscreen-Regular.ttf", "Silkscreen", 400],
      ["JetBrainsMono-Medium.ttf", "JetBrains Mono", 500],
    ].map(async ([fichier, name, weight]) => ({
      name,
      data: await readFile(join(process.cwd(), "public", "fonts", "reel", fichier)),
      weight,
      style: "normal",
    })),
  );
  return policesEnCache;
}

export { etatStoryboard, etatStoryboardFormat, ressourcesRendu };
