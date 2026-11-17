import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { isEditor } from "@/lib/test-auth";
import { cacheControlCarte, slugCandidat } from "@/lib/carte";
import { dataUriIcone } from "@/lib/icones-pixel";
import {
  HAUTEUR_REEL,
  ICONES_APPEL,
  LARGEUR_REEL,
  SCENES_REEL,
  THEMES_REEL,
  assemblerReel,
  variablesDuReel,
  versionReel,
} from "@/lib/reel";
import { CANDIDAT_EXEMPLE, SCORE_EXEMPLE, VARIABLES_EXEMPLE } from "@/lib/reel-exemple";
import { elementScene } from "./scenes";

// Images 1080 × 1920 d'un Reel : ?scene=1..9&theme=sombre|clair (sombre par
// défaut). Aucune IA ici : les textes viennent de contenuComplet.reel (étape
// 3 quater, ou scripts/reel.js), réassemblés avec le score et le nom actuels ;
// sans reel, 404.
// Fiche publiée : ouverte à tous, image mise en cache longtemps quand l'URL
// porte la version courante (?v=, voir versionReel). Brouillon
// (?brouillon=1) : réservé aux personnes déverrouillées sur /test, jamais en
// cache partagé. Même règle que /api/carte.

let policesEnCache = null;
function polices() {
  policesEnCache ??= Promise.all(
    [
      ["Geist-Bold.ttf", "Geist", 700],
      ["Geist-Medium.ttf", "Geist", 500],
      ["GeistMono-Medium.ttf", "Geist Mono", 500],
    ].map(async ([fichier, name, weight]) => ({
      name,
      data: await readFile(join(process.cwd(), "public", "fonts", fichier)),
      weight,
      style: "normal",
    })),
  );
  return policesEnCache;
}

// Fonds générés une fois pour toutes (scripts/generer-fonds-reel.js).
const fondsEnCache = {};
function fond(theme) {
  fondsEnCache[theme] ??= readFile(join(process.cwd(), "public", "reel", `fond-${theme}.png`)).then(
    (png) => `data:image/png;base64,${png.toString("base64")}`,
  );
  return fondsEnCache[theme];
}

// Portrait bleu détouré (public/portraits-bleus/<slug>.png). Absent : la
// scène 2 affiche le nom en grand, sans portrait.
async function portrait(candidat) {
  try {
    const png = await readFile(join(process.cwd(), "public", "portraits-bleus", `${slugCandidat(candidat)}.png`));
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    return null;
  }
}

function introuvable() {
  return new Response("Image introuvable.", { status: 404, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request, { params }) {
  const { id } = await params;
  const propositionId = Number(id);
  const recherche = new URL(request.url).searchParams;
  const numero = Number(recherche.get("scene") ?? "1");
  const theme = recherche.get("theme") ?? "sombre";
  const sceneDemandee = SCENES_REEL.find((s) => s.numero === numero);
  if (!Number.isInteger(propositionId) || !sceneDemandee || !THEMES_REEL.includes(theme)) return introuvable();

  const brouillon = recherche.get("brouillon") === "1";
  const exemple = recherche.get("exemple") === "1";
  if ((brouillon || exemple) && !(await isEditor())) return introuvable();

  // Aperçu du style avec un Reel fictif (src/lib/reel-exemple.js), sans base.
  if (exemple) {
    const { scenes, palier } = assemblerReel(VARIABLES_EXEMPLE, { candidatNom: CANDIDAT_EXEMPLE, score: SCORE_EXEMPLE });
    return image(scenes[numero - 1], { theme, palier, portrait: null, cacheControl: "private, no-store" });
  }

  const proposition = await prisma.proposition.findUnique({
    where: { id: propositionId },
    select: {
      candidat: { select: { nom: true, photoUrl: true } },
      analyses: {
        ...(brouillon ? {} : { where: { statut: "publie" } }),
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, statut: true, scoreFaisabilite: true, contenuComplet: true },
      },
    },
  });
  const analyse = proposition?.analyses[0];
  const reel = analyse?.contenuComplet?.reel;
  const variables = variablesDuReel(reel);
  if (!variables) return introuvable();

  const candidatNom = proposition.candidat.nom;
  const score = analyse.scoreFaisabilite;
  const { scenes, palier } = assemblerReel(variables, { candidatNom, score });
  const scene = scenes[numero - 1];

  return image(scene, {
    theme,
    palier,
    portrait: scene.id === "presentation" ? await portrait(proposition.candidat) : null,
    cacheControl: cacheControlCarte({
      publie: analyse.statut === "publie",
      versionDemandee: recherche.get("v"),
      versionCourante: versionReel({ analyseId: analyse.id, candidatNom, score, reel }),
    }),
  });
}

async function image(scene, { theme, palier, portrait: photo, cacheControl }) {
  const element = elementScene({
    scene,
    theme,
    fond: await fond(theme),
    icone: scene.icone ? dataUriIcone(scene.icone, { theme, taille: 256 }) : null,
    icones: ICONES_APPEL.map((nom) => dataUriIcone(nom, { theme, taille: 256 })),
    portrait: photo,
    palier,
  });
  return new ImageResponse(element, {
    width: LARGEUR_REEL,
    height: HAUTEUR_REEL,
    fonts: await polices(),
    headers: { "Cache-Control": cacheControl },
  });
}
