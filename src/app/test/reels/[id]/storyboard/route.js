import { ImageResponse } from "next/og";
import { isEditor } from "@/lib/test-auth";
import { cacheControlCarte } from "@/lib/carte";
import { HAUTEUR, LARGEUR } from "@/lib/reel-disposition";
import { chargerFiche, etatStoryboard, policesStoryboard, ressourcesRendu, versionStoryboard } from "@/lib/reel-storyboard-base";
import { HAUTEUR_PLANCHE, LARGEUR_PLANCHE, elementCouverture, elementImageCle, elementPlanche } from "./rendu";

// Images du storyboard d'un Reel (v4) :
//   ?image=couverture           couverture 1080 × 1920 (pas de score) ;
//   ?image=scene-03-2           image clé 2 de la scène 3, 1080 × 1920 ;
//   ?image=planche-03           planche de la scène 3 (3 images clés, voix, mouvement) ;
//   ?image=calque-03-visuel     calque transparent de l'image clé 3 (photos,
//   ?image=calque-03-texte      pixel art, cartes… ou textes), aligné sur l'image ;
//   ?image=fond                 fond seul (le même pour toute la vidéo).
// &simulation=A|B : storyboard simulé (data/reel-demo/), mode édition, jamais en cache.
// &brouillon=1 : dernier brouillon, mode édition. Sinon la fiche publiée,
// ouverte à tous, en cache longtemps quand l'URL porte la version courante.
// Aucune IA ici : le storyboard vient de contenuComplet.reel (ou de la simulation).

function introuvable(message = "Image introuvable.") {
  return new Response(message, { status: 404, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request, { params }) {
  const { id } = await params;
  const propositionId = Number(id);
  const r = new URL(request.url).searchParams;
  const image = r.get("image") ?? "couverture";
  const simulation = ["A", "B"].includes(r.get("simulation")) ? r.get("simulation") : null;
  const brouillon = r.get("brouillon") === "1";
  if (!Number.isInteger(propositionId)) return introuvable();
  if ((simulation || brouillon) && !(await isEditor())) return introuvable();

  const fiche = await chargerFiche(propositionId, { brouillon });
  if (!fiche) return introuvable();
  if (!simulation && !brouillon && fiche.analyse.statut !== "publie") return introuvable();
  const etat = etatStoryboard({ ...fiche, simulation });
  if (!etat?.storyboard) return introuvable(etat?.erreur ?? "Pas de storyboard pour cette fiche.");

  const n = etat.storyboard.scenes.length;
  const ressources = await ressourcesRendu(etat, fiche.proposition);
  let element;
  let taille = { width: LARGEUR, height: HAUTEUR };
  let m;
  if (image === "couverture") element = elementCouverture({ etat, ressources });
  else if (image === "fond") element = elementImageCle({ etat, i: 0, k: 1, ressources, calque: "fond" });
  else if ((m = image.match(/^scene-(\d{2})-([123])$/))) {
    const i = Number(m[1]) - 1;
    if (i < 0 || i >= n) return introuvable();
    element = elementImageCle({ etat, i, k: Number(m[2]), ressources });
  } else if ((m = image.match(/^calque-(\d{2})-(visuel|texte)$/))) {
    const i = Number(m[1]) - 1;
    if (i < 0 || i >= n) return introuvable();
    element = elementImageCle({ etat, i, k: 3, ressources, calque: m[2] });
  } else if ((m = image.match(/^planche-(\d{2})$/))) {
    const i = Number(m[1]) - 1;
    if (i < 0 || i >= n) return introuvable();
    element = elementPlanche({ etat, i, ressources });
    taille = { width: LARGEUR_PLANCHE, height: HAUTEUR_PLANCHE };
  } else return introuvable();

  const cacheControl =
    simulation || brouillon
      ? "private, no-store"
      : cacheControlCarte({ publie: true, versionDemandee: r.get("v"), versionCourante: versionStoryboard({ analyse: fiche.analyse }) });
  return new ImageResponse(element, { ...taille, fonts: await policesStoryboard(), headers: { "Cache-Control": cacheControl } });
}
