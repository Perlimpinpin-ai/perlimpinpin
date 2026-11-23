import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

const VALID_TYPES = new Set(["accord", "desaccord"]);

async function getCounts(propositionId) {
  const [accord, desaccord] = await Promise.all([
    prisma.voteMesure.count({ where: { propositionId, type: "accord" } }),
    prisma.voteMesure.count({ where: { propositionId, type: "desaccord" } }),
  ]);
  return { accord, desaccord };
}

export async function POST(request) {
  const body = await request.json().catch(() => null);

  const propositionId = Number(body?.propositionId);
  const type = body?.type;

  if (!Number.isInteger(propositionId) || !VALID_TYPES.has(type)) {
    return Response.json({ error: "Requête invalide." }, { status: 400 });
  }

  const proposition = await prisma.proposition.findUnique({
    where: { id: propositionId },
    select: { id: true },
  });

  if (!proposition) {
    return Response.json({ error: "Proposition introuvable." }, { status: 404 });
  }

  await prisma.voteMesure.create({
    data: { propositionId, type },
  });

  const counts = await getCounts(propositionId);

  // Compteurs rendus côté serveur (fiche) et classement « Le choix des
  // visiteurs » : pages en cache un jour, recalculées à leur prochaine visite.
  revalidatePath(`/declarations/${propositionId}`);
  revalidatePath("/prix-perlimpinpin");

  return Response.json(counts, { status: 201 });
}
