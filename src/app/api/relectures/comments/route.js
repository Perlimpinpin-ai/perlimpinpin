import { prisma } from "@/lib/prisma";
import { getAdherent } from "@/lib/relecture-auth";
import { SESSION_EXPIREE, posterCommentaire } from "@/lib/relecture-comments-core";
import { nomAffiche } from "@/lib/club-pseudo-core";

// Commentaires de relecture (Club Perlimpinpin) : lecture et écriture réservées
// aux adhérents connectés. La vérification est faite ici, pas seulement dans le
// proxy (qui ne couvre pas /api). Les scripts lisent la base directement
// (scripts/relecture-comments.js --json).

export async function GET(request) {
  if (!(await getAdherent())) return Response.json(SESSION_EXPIREE, { status: 401 });

  const ficheSlug = request.nextUrl.searchParams.get("fiche");
  if (!ficheSlug) {
    return Response.json({ error: "Paramètre 'fiche' manquant." }, { status: 400 });
  }

  const comments = await prisma.relectureComment.findMany({
    where: { ficheSlug },
    orderBy: { createdAt: "asc" },
    include: { adherent: { select: { nom: true, pseudo: true } } },
  });

  // Nom affiché : celui du compte AUJOURD'HUI (pseudo s'il existe, sinon nom
  // par défaut), pour que changer de pseudo s'applique aussi aux anciens
  // commentaires. Sans compte (commentaires anciens ou compte supprimé), on
  // garde la copie enregistrée avec le commentaire.
  return Response.json(
    // creditAccord : choix personnel de chaque auteur, jamais montré aux autres.
    comments.map(({ adherent, creditAccord: _creditAccord, ...comment }) => ({
      ...comment,
      authorName: nomAffiche(adherent) ?? comment.authorName,
    })),
    { headers: { "Cache-Control": "private, no-store" } }
  );
}

export async function POST(request) {
  const adherent = await getAdherent();
  const data = adherent ? await request.json().catch(() => null) : null;
  const { status, body } = await posterCommentaire({
    adherent,
    data,
    trouverFiche: (ficheSlug) => prisma.relectureFiche.findUnique({ where: { ficheSlug } }),
    // Fiche publiée : version affichée sur /declarations/<id> (même choix que
    // getDeclarationDetail : la plus récente analyse publiée).
    trouverFichePubliee: async (propositionId) => {
      const analyse = await prisma.analyse.findFirst({
        where: { propositionId, statut: "publie" },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      return analyse ? { analyseId: analyse.id } : null;
    },
    // Écriture : create uniquement (jamais d'upsert ni de mise à jour).
    creer: (values) => prisma.relectureComment.create({ data: values }),
  });
  return Response.json(body, { status });
}
