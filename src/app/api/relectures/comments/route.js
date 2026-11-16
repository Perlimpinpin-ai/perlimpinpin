import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { envoyerAlerteCommentaire } from "@/lib/alerte-commentaire";
import { propositionDuSlug } from "@/lib/fiche-annotations-core";
import { getAdherent } from "@/lib/relecture-auth";
import { SESSION_EXPIREE, posterCommentaire } from "@/lib/relecture-comments-core";
import { nomAffiche } from "@/lib/club-pseudo-core";
import { dernierTraitement } from "@/lib/versions-core";

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
    include: {
      adherent: { select: { nom: true, pseudo: true } },
      // Lot 5 : suite donnée (close avec la réponse de l'équipe, ou réaccrochée)
      traitements: { select: { id: true, etat: true, reponse: true, retenu: true, rattachement: true, analyseId: true, createdAt: true } },
    },
  });

  // Nom affiché : celui du compte AUJOURD'HUI (pseudo s'il existe, sinon nom
  // par défaut), pour que changer de pseudo s'applique aussi aux anciens
  // commentaires. Sans compte (commentaires anciens ou compte supprimé), on
  // garde la copie enregistrée avec le commentaire.
  return Response.json(
    // creditAccord : choix personnel de chaque auteur, jamais montré aux autres.
    comments.map(({ adherent, creditAccord: _creditAccord, traitements, ...comment }) => {
      const t = dernierTraitement(traitements);
      return {
        ...comment,
        authorName: nomAffiche(adherent) ?? comment.authorName,
        etat: t?.etat ?? null,
        reponseEquipe: t?.etat === "traitee" ? t.reponse ?? null : null,
        retenu: comment.retenu === true || (t?.etat === "traitee" && t.retenu === true),
        rattachement: t?.etat === "reaccrochee" ? t.rattachement : null,
      };
    }),
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
  // Alerte e-mail à l'équipe, seulement si le commentaire a bien été créé,
  // après l'envoi de la réponse (ne ralentit pas l'adhérent). Un échec du
  // mail ne touche jamais au commentaire enregistré.
  if (status === 201) {
    after(async () => {
      try {
        await envoyerAlerteCommentaire(await donneesAlerte(adherent, body));
      } catch (e) {
        console.error("[alerte-commentaire] échec :", e?.code ?? e?.message ?? "erreur");
      }
    });
  }
  return Response.json(body, { status });
}

// Titre et candidat de la fiche commentée : en base pour une fiche publiée
// (« fiche-<id> »), dans data/relectures/<slug>.json pour une relecture.
async function infosFiche(ficheSlug) {
  const propositionId = propositionDuSlug(ficheSlug);
  if (propositionId) {
    const p = await prisma.proposition.findUnique({
      where: { id: propositionId },
      select: { titre: true, candidat: { select: { nom: true } } },
    });
    return { titreFiche: p?.titre ?? null, candidat: p?.candidat?.nom ?? null };
  }
  if (!/^[a-z0-9][a-z0-9-]{0,120}$/.test(ficheSlug)) return {};
  try {
    const json = JSON.parse(await readFile(join(process.cwd(), "data", "relectures", `${ficheSlug}.json`), "utf8"));
    return { titreFiche: json?.relecture?.titre ?? null, candidat: json?.relecture?.candidat ?? null };
  } catch {
    return {};
  }
}

async function donneesAlerte(adherent, comment) {
  const { titreFiche, candidat } = await infosFiche(comment.ficheSlug);
  // Nom du compte Club (jamais l'adresse e-mail), avec le pseudo s'il diffère
  const auteur =
    adherent.pseudo && adherent.pseudo !== adherent.nom ? `${adherent.nom} (pseudo : ${adherent.pseudo})` : adherent.nom;
  return {
    commentaire: comment.body,
    ficheSlug: comment.ficheSlug,
    titreFiche,
    candidat,
    auteur,
    sectionLabel: comment.sectionLabel,
    passageCite: comment.quotedText ?? null,
    date: comment.createdAt,
  };
}
