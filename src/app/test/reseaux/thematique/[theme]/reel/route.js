import { isEditor } from "@/lib/test-auth";
import { chargerDonneesFormat, etatStoryboardFormat } from "@/lib/reel-storyboard-base";
import { imageStoryboard } from "@/app/test/reels/[id]/storyboard/image";

// Images du Reel « thématique » d'un thème (mêmes paramètres `image` que
// /test/reels/<id>/storyboard ; &avec=Nom,Nom : candidats sans fiche à
// montrer). Mode édition seulement. Pour l'instant seulement en simulation
// (&simulation=A|B, data/reel-demo/thematique-<thème>/) : aucun appel, rien
// n'est lu ni écrit en base.

function introuvable(message = "Image introuvable.") {
  return new Response(message, { status: 404, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request, { params }) {
  const { theme } = await params;
  const r = new URL(request.url).searchParams;
  const simulation = ["A", "B"].includes(r.get("simulation")) ? r.get("simulation") : null;
  if (!(await isEditor())) return introuvable();
  const donnees = await chargerDonneesFormat("thematique", theme, { simulation });
  if (!donnees) return introuvable();
  const avec = r.get("avec") ? r.get("avec").split(",").map((n) => n.trim()).filter(Boolean) : donnees.avec ?? [];
  const { etat } = etatStoryboardFormat({ format: "thematique", cible: theme, donnees, simulation, avec });
  if (!etat?.storyboard) return introuvable(etat?.erreur ?? "Pas de storyboard pour ce thème.");
  return imageStoryboard({ etat, image: r.get("image") ?? "couverture", cacheControl: "private, no-store", introuvable });
}
