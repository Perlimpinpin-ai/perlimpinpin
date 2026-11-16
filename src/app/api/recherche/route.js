import { getMoteurRechercheComplet } from "@/lib/queries";
import { LIMITE_SUGGESTIONS, motsCles } from "@/lib/recherche";

// GET /api/recherche?q=prison : suggestions de la barre de recherche de la
// page d'accueil cherchées aussi dans le TEXTE COMPLET des analyses publiées
// (l'index envoyé au navigateur ne contient que titres et résumés).
// Appelé par SearchBar seulement quand l'index du navigateur trouve moins de
// 4 propositions. Aucune IA. Réponse publique, mise en cache 5 minutes par
// le CDN (une même requête ne recalcule rien).

const ENTETES_CACHE = {
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
};

export async function GET(request) {
  const q = String(request.nextUrl.searchParams.get("q") ?? "").slice(0, 100);
  if (motsCles(q).length === 0) {
    return Response.json({ propositions: [] }, { headers: ENTETES_CACHE });
  }

  try {
    const moteur = await getMoteurRechercheComplet();
    const propositions = moteur.rechercher(q, LIMITE_SUGGESTIONS).map((doc) => ({
      id: doc.id,
      propositionId: doc.propositionId,
      titre: doc.titre,
      candidat: doc.candidat,
      theme: doc.theme,
    }));
    return Response.json({ propositions }, { headers: ENTETES_CACHE });
  } catch (erreur) {
    console.error("[api/recherche]", erreur);
    return Response.json({ propositions: [] }, { status: 500 });
  }
}
