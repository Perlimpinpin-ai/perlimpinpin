import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { isEditor } from "@/lib/test-auth";
import { cacheControlCarte, slugCandidat } from "@/lib/carte";
import { dataUriIcone } from "@/lib/icones-pixel";
import { HAUTEUR_REEL, ICONES_APPEL, LARGEUR_REEL, SCENES_REEL, THEMES_REEL, assemblerDepuisReel, assemblerReel, versionReel } from "@/lib/reel";
import { elementsScene } from "@/lib/reel-montage";
import { CANDIDAT_EXEMPLE, COUVERTURE_EXEMPLE, SCORE_EXEMPLE, VARIABLES_EXEMPLE, VARIANTES_EXEMPLE } from "@/lib/reel-exemple";
import { elementCouverture, elementScene } from "./scenes";
import { photoReel } from "@/lib/photo-reel";
import { imagePrete } from "@/lib/images-carrousel";

// Images 1080 × 1920 d'un Reel :
//   ?scene=1..9&theme=sombre|clair      image complète d'une scène ;
//   ?scene=couverture&theme=…           couverture (photo du Reel) ;
//   ?scene=1..9&calque=icone|texte|chiffre&theme=…
//                                       un calque PNG transparent de la scène,
//                                       aligné sur l'image complète ;
//   ?calque=fond&theme=…                le fond (le même pour toute la vidéo).
// Aucune IA ici : les textes viennent de contenuComplet.reel (bouton de
// /test/reels ou scripts/reel.js), réassemblés avec le score et le nom
// actuels ; sans reel, 404.
// Fiche publiée : ouverte à tous, image mise en cache longtemps quand l'URL
// porte la version courante (?v=, voir versionReel). Brouillon
// (?brouillon=1) : réservé aux personnes déverrouillées sur /test, jamais en
// cache partagé. Même règle que /api/carte. La route reste sous /test (et
// non sous /api) : le cookie du mode édition n'est envoyé que sous /test.

const CALQUES = ["icone", "texte", "chiffre", "fond"];

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
function cheminFond(theme) {
  return join(process.cwd(), "public", "reel", `fond-${theme}.png`);
}
const fondsEnCache = {};
function fond(theme) {
  fondsEnCache[theme] ??= readFile(cheminFond(theme)).then((png) => `data:image/png;base64,${png.toString("base64")}`);
  return fondsEnCache[theme];
}

// Fenêtre du candidat : photo de la bibliothèque des carrousels
// (src/lib/photo-reel.js), détourée en noir et blanc ; sinon le portrait
// bleu détouré (public/portraits-bleus/<slug>.png). Aucun des deux : la
// scène 2 et la couverture affichent le nom en grand, sans portrait.
async function portrait(candidat, graine) {
  const photo = photoReel(candidat, graine);
  if (photo) {
    const image = await imagePrete(photo.fichier);
    if (image) return image;
  }
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
  const theme = recherche.get("theme") ?? "sombre";
  const calque = recherche.get("calque");
  if (!Number.isInteger(propositionId) || !THEMES_REEL.includes(theme)) return introuvable();
  if (calque !== null && !CALQUES.includes(calque)) return introuvable();

  // Le fond : le même fichier pour toutes les scènes et toutes les fiches.
  if (calque === "fond") {
    return new Response(await readFile(cheminFond(theme)), {
      headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" },
    });
  }

  const sceneParam = recherche.get("scene") ?? "1";
  const couverture = sceneParam === "couverture";
  const numero = Number(sceneParam);
  if (!couverture && !SCENES_REEL.some((s) => s.numero === numero)) return introuvable();
  if (couverture && calque) return introuvable();

  const brouillon = recherche.get("brouillon") === "1";
  const exemple = recherche.get("exemple") === "1";
  if ((brouillon || exemple) && !(await isEditor())) return introuvable();

  // Aperçu du style avec un Reel fictif (src/lib/reel-exemple.js), sans base.
  if (exemple) {
    const assemble = assemblerReel(VARIABLES_EXEMPLE, {
      candidatNom: CANDIDAT_EXEMPLE,
      score: SCORE_EXEMPLE,
      variantes: VARIANTES_EXEMPLE,
      couverture: COUVERTURE_EXEMPLE,
    });
    return image({ assemble, couverture, numero, calque, theme, portrait: null, cacheControl: "private, no-store" });
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
  const candidatNom = proposition?.candidat.nom;
  const score = analyse?.scoreFaisabilite;
  const assemble = reel ? assemblerDepuisReel(reel, { candidatNom, score }) : null;
  if (!assemble) return introuvable();

  const besoinPortrait = couverture || assemble.scenes[numero - 1].id === "presentation";
  return image({
    assemble,
    couverture,
    numero,
    calque,
    theme,
    portrait: besoinPortrait ? await portrait(proposition.candidat, `reel-${propositionId}-${reel.genereLe ?? ""}`) : null,
    cacheControl: cacheControlCarte({
      publie: analyse.statut === "publie",
      versionDemandee: recherche.get("v"),
      versionCourante: versionReel({ analyseId: analyse.id, candidatNom, score, reel }),
    }),
  });
}

async function image({ assemble, couverture, numero, calque, theme, portrait: photo, cacheControl }) {
  let element;
  if (couverture) {
    element = elementCouverture({ couverture: assemble.couverture, theme, fond: await fond(theme), portrait: photo });
  } else {
    const scene = assemble.scenes[numero - 1];
    // Calque absent de cette scène (pas de chiffre, pas de portrait…) : 404.
    if (calque && !elementsScene(scene, { portrait: Boolean(photo) }).includes(calque)) return introuvable();
    element = elementScene({
      scene,
      theme,
      fond: await fond(theme),
      icone: scene.icone ? dataUriIcone(scene.icone, { theme, taille: 256 }) : null,
      icones: ICONES_APPEL.map((nom) => dataUriIcone(nom, { theme, taille: 256 })),
      portrait: photo,
      palier: assemble.palier,
      calque,
    });
  }
  return new ImageResponse(element, {
    width: LARGEUR_REEL,
    height: HAUTEUR_REEL,
    fonts: await polices(),
    headers: { "Cache-Control": cacheControl },
  });
}
