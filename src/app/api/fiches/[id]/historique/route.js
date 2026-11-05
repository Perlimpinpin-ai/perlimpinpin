import { prisma } from "@/lib/prisma";
import { getAdherent } from "@/lib/relecture-auth";
import { SESSION_EXPIREE } from "@/lib/relecture-comments-core";
import { nomAffiche } from "@/lib/club-pseudo-core";
import { slugFiche } from "@/lib/fiche-annotations-core";
import { CRITERES_ANALYSE } from "@/lib/test-edition";
import { STATUTS_VERSION, construireHistorique } from "@/lib/versions-core";

// Historique détaillé des versions d'une fiche (Club ouvert, lot 5) :
// /api/fiches/<id de la Proposition>/historique. RÉSERVÉ AUX ADHÉRENTS
// connectés (401 sinon) : date, critères modifiés (ancienne et nouvelle
// note), raison en une phrase, crédits par prénom seulement avec l'accord de
// l'auteur, annotations archivées avec chaque version et réponse de l'équipe.
// Le numéro de version (V1, V2…) est, lui, affiché à tous sur la fiche.
// Lecture seule.

// Libellés des notes de critères (clés de notation_detaillee).
const LIBELLES = {
  operationnalite_juridique: "Opérationnalité : juridique",
  operationnalite_budgetaire: "Opérationnalité : budgétaire",
  operationnalite_moyens_humains: "Opérationnalité : moyens humains",
  efficacite: CRITERES_ANALYSE.efficacite,
  effets_rebonds_externalites: CRITERES_ANALYSE.effets_rebonds_externalites,
  degre_preparation: CRITERES_ANALYSE.degre_preparation,
  alignement_logique: CRITERES_ANALYSE.alignement_logique,
};

export async function GET(_request, { params }) {
  if (!(await getAdherent())) return Response.json(SESSION_EXPIREE, { status: 401 });
  const { id } = await params;
  if (!/^[1-9]\d{0,9}$/.test(id)) return Response.json({ error: "Fiche invalide." }, { status: 400 });
  const propositionId = Number(id);

  const [versions, decisions, annotations] = await Promise.all([
    prisma.analyse.findMany({
      where: { propositionId, statut: { in: STATUTS_VERSION } },
      select: { id: true, statut: true, createdAt: true },
    }),
    prisma.decisionRevision.findMany({
      where: { decision: "publiee", revision: { propositionId } },
      select: { id: true, createdAt: true, analysePublieeId: true, revision: { select: { resume: true, commentIds: true } } },
    }),
    prisma.relectureComment.findMany({
      where: { ficheSlug: slugFiche(propositionId) },
      select: {
        id: true,
        creditAccord: true,
        authorName: true,
        sectionLabel: true,
        quotedText: true,
        body: true,
        adherent: { select: { nom: true, pseudo: true } },
        traitements: { select: { id: true, etat: true, reponse: true, retenu: true, analyseId: true, createdAt: true } },
      },
    }),
  ]);
  if (versions.length === 0) return Response.json({ error: "Fiche introuvable." }, { status: 404 });

  const historique = construireHistorique({
    versions,
    decisions,
    annotations,
    libelles: LIBELLES,
    nomAffiche: (a) => nomAffiche(a.adherent) ?? a.authorName,
  });
  return Response.json({ versions: historique }, { headers: { "Cache-Control": "private, no-store" } });
}
