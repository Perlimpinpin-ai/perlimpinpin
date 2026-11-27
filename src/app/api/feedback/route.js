import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { cheminFiche } from "@/lib/slug";

const VALID_TYPES = new Set(["like", "dislike"]);

async function getCounts(analyseId) {
  const [likes, dislikes] = await Promise.all([
    prisma.feedback.count({ where: { analyseId, type: "like" } }),
    prisma.feedback.count({ where: { analyseId, type: "dislike" } }),
  ]);
  return { likes, dislikes };
}

export async function POST(request) {
  const body = await request.json().catch(() => null);

  const analyseId = Number(body?.analyseId);
  const type = body?.type;
  const raison = typeof body?.raison === "string" ? body.raison : null;
  const raisonAutre =
    typeof body?.raisonAutre === "string" ? body.raisonAutre : null;

  if (!Number.isInteger(analyseId) || !VALID_TYPES.has(type)) {
    return Response.json({ error: "Requête invalide." }, { status: 400 });
  }

  const analyse = await prisma.analyse.findUnique({
    where: { id: analyseId },
    select: { id: true, propositionId: true, proposition: { select: { slug: true } } },
  });

  if (!analyse) {
    return Response.json({ error: "Analyse introuvable." }, { status: 404 });
  }

  await prisma.feedback.create({
    data: {
      analyseId,
      type,
      raison: type === "dislike" ? raison : null,
      raisonAutre: type === "dislike" && raison === "autre" ? raisonAutre : null,
    },
  });

  const counts = await getCounts(analyseId);

  // Compteurs rendus côté serveur sur la fiche (en cache un jour) : recalculée
  // à sa prochaine visite.
  // Ancienne adresse (numéro) et adresse actuelle (slug) : les deux sont en cache.
  revalidatePath(`/declarations/${analyse.propositionId}`);
  if (analyse.proposition?.slug) revalidatePath(cheminFiche({ id: analyse.propositionId, slug: analyse.proposition.slug }));

  return Response.json(counts, { status: 201 });
}
