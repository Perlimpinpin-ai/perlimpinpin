import { isEditor } from "@/lib/test-auth";
import { cacheControlCarte } from "@/lib/carte";
import { chargerFiche, etatStoryboard, versionStoryboard } from "@/lib/reel-storyboard-base";
import { imageStoryboard } from "./image";

// Images du storyboard d'un Reel (v4 et v5, format « une mesure ») :
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

  const fiche = await chargerFiche(propositionId, { brouillon, simulation });
  if (!fiche) return introuvable();
  if (!simulation && !brouillon && fiche.analyse.statut !== "publie") return introuvable();
  const etat = etatStoryboard({ ...fiche, simulation });
  if (!etat?.storyboard) return introuvable(etat?.erreur ?? "Pas de storyboard pour cette fiche.");

  const cacheControl =
    simulation || brouillon
      ? "private, no-store"
      : cacheControlCarte({ publie: true, versionDemandee: r.get("v"), versionCourante: versionStoryboard({ analyse: fiche.analyse }) });
  return imageStoryboard({ etat, image, cacheControl, introuvable });
}
