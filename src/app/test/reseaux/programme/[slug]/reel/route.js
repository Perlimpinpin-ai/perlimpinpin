import { isEditor } from "@/lib/test-auth";
import { chargerDonneesFormat, etatStoryboardFormat } from "@/lib/reel-storyboard-base";
import { imageStoryboard } from "@/app/test/reels/[id]/storyboard/image";

// Images du Reel « programme » d'un candidat (mêmes paramètres `image` que
// /test/reels/<id>/storyboard). Mode édition seulement. Pour l'instant
// seulement en simulation (&simulation=A|B, data/reel-demo/programme-<slug>/) :
// aucun appel, rien n'est lu ni écrit en base.

function introuvable(message = "Image introuvable.") {
  return new Response(message, { status: 404, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request, { params }) {
  const { slug } = await params;
  const r = new URL(request.url).searchParams;
  const simulation = ["A", "B"].includes(r.get("simulation")) ? r.get("simulation") : null;
  if (!(await isEditor())) return introuvable();
  const donnees = await chargerDonneesFormat("programme", slug, { simulation });
  if (!donnees) return introuvable();
  const choix = r.get("fiches") ? r.get("fiches").split(",").map(Number).filter(Number.isInteger) : null;
  const { etat } = etatStoryboardFormat({ format: "programme", cible: slug, donnees, simulation, choix });
  if (!etat?.storyboard) return introuvable(etat?.erreur ?? "Pas de storyboard pour ce programme.");
  return imageStoryboard({ etat, image: r.get("image") ?? "couverture", cacheControl: "private, no-store", introuvable });
}
