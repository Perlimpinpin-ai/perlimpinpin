import { prisma } from "@/lib/prisma";
import { slugFiche, zonesPubliques } from "@/lib/fiche-annotations-core";

// Passages annotés d'une fiche publiée, pour TOUT visiteur (adhérent ou non) :
// /api/fiches/<id de la Proposition>/zones
//
// Ne renvoie JAMAIS le texte d'une annotation, ni son auteur, ni sa date, ni
// leur nombre : seulement les passages de la fiche à surligner (fusionnés par
// section, voir zonesPubliques). Les adhérents lisent les notes complètes via
// /api/relectures/comments (session exigée). Lecture seule, aucune écriture.

export async function GET(_request, { params }) {
  const { id } = await params;
  const propositionId = /^[1-9]\d{0,9}$/.test(id) ? Number(id) : null;
  if (!propositionId) return Response.json({ error: "Fiche invalide." }, { status: 400 });

  const publiee = await prisma.analyse.findFirst({
    where: { propositionId, statut: "publie" },
    select: { id: true },
  });
  if (!publiee) return Response.json({ error: "Fiche introuvable." }, { status: 404 });

  const annotations = await prisma.relectureComment.findMany({
    where: { ficheSlug: slugFiche(propositionId) },
    select: { sectionId: true, quotedText: true, startOffset: true, endOffset: true },
  });

  return Response.json(
    { zones: zonesPubliques(annotations) },
    // Données publiques (texte de la fiche) : courte mise en cache CDN.
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
  );
}
