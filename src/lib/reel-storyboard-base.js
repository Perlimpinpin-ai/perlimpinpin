import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { prisma } from "./prisma.js";
import { empreinte } from "./carte.js";
import { etatStoryboard, grilleCarte, imagesPhotos } from "./reel-storyboard-serveur.js";

// Lecture en base du storyboard d'une fiche, pour la page /test/reels/<id> et
// la route des images. Lecture seule.

// Analyse visée : avec brouillon, le dernier brouillon ; sinon la dernière
// publiée, à défaut le dernier brouillon (même règle que la page v3).
export async function chargerFiche(propositionId, { brouillon = false } = {}) {
  const proposition = await prisma.proposition.findUnique({
    where: { id: propositionId },
    select: {
      id: true,
      titre: true,
      slug: true,
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

let fondsEnCache = null;
async function fonds() {
  fondsEnCache ??= Promise.all(
    ["fond", "voile"].map(async (nom) => `data:image/png;base64,${(await readFile(join(process.cwd(), "public", "reel", "v4", `${nom}.png`))).toString("base64")}`),
  ).then(([fond, voile]) => ({ fond, voile }));
  return fondsEnCache;
}

// Ressources du rendu : fonds, photos tramées, grilles des cartes utilisées.
export async function ressourcesRendu(etat, proposition) {
  const cles = new Set(etat.storyboard.scenes.filter((s) => s.type === "pays").flatMap((s) => s.groupes.flatMap((g) => g.pays)));
  return {
    fonds: await fonds(),
    photos: imagesPhotos(proposition.candidat, proposition.theme),
    cartes: Object.fromEntries([...cles].map((cle) => [cle, grilleCarte(cle)])),
  };
}

export { etatStoryboard };
