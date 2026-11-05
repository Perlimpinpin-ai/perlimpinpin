// Actions de la page admin de la revue du dimanche (/test/revue), sans Next :
// la base est passée en paramètre (tests : scripts/revue-admin.test.js).
//
//   - reclasserCore : nouvelle ligne TriAnnotation (source « arno ») ;
//   - publierRevisionCore : publie une révision proposée, SEULEMENT si Arno a
//     tapé « oui » ;
//   - rejeterRevisionCore : décision « rejetee ».
//
// Écritures par ajout (create) ; UNE exception acceptée par Arno (novembre
// 2026), à la publication : l'ancienne version passe de « publie » à
// « remplacee ». Conditions :
//   1. seuls son statut et sa date de changement (updatedAt) sont modifiés :
//      ni son contenu, ni sa note ; rien n'est supprimé ;
//   2. création de la nouvelle version et passage de l'ancienne en
//      « remplacee » dans UNE seule transaction Prisma ;
//   3. changement enregistré dans logs/insertions.jsonl (journaliser).
// Sans cela, les listes du site (accueil, candidats, thèmes, moyennes)
// montreraient les deux versions.

import { REPONSE_MAX, categorieValide, confirmationValide, derniereDecision, donneesNouvelleVersion } from "./revue-core.js";
import { estSlugFiche } from "./fiche-annotations-core.js";
import { journaliser as journaliserParDefaut } from "./journal-insertions.js";

const refus = (message) => ({ ok: false, message });

export async function reclasserCore({ commentId, categorie, reponse, isEditor, prisma, journaliser = journaliserParDefaut }) {
  if (!isEditor) return refus("Accès réservé à l'équipe.");
  if (typeof commentId !== "string" || !commentId) return refus("Annotation inconnue.");
  if (!categorieValide(categorie)) return refus("Catégorie inconnue.");
  const comment = await prisma.relectureComment.findUnique({
    where: { id: commentId },
    select: { id: true, ficheSlug: true, tris: { select: { id: true, reponse: true, createdAt: true } } },
  });
  if (!comment || !estSlugFiche(comment.ficheSlug)) return refus("Annotation inconnue.");
  const texte = typeof reponse === "string" ? reponse.trim().slice(0, REPONSE_MAX) : "";
  const precedent = comment.tris.reduce((d, t) => (!d || new Date(t.createdAt) > new Date(d.createdAt) ? t : d), null);
  const tri = await prisma.triAnnotation.create({
    data: {
      commentId,
      categorie,
      justification: "Reclassée par l'équipe",
      reponse: texte || precedent?.reponse || null,
      source: "arno",
    },
  });
  journaliser({ type: "tri_annotation", source: "arno", triId: tri.id, commentId, categorie });
  return { ok: true, triId: tri.id };
}

export async function rejeterRevisionCore({ revisionId, isEditor, prisma, journaliser = journaliserParDefaut }) {
  if (!isEditor) return refus("Accès réservé à l'équipe.");
  const revision = await prisma.revisionProposee.findUnique({
    where: { id: revisionId },
    select: { id: true, propositionId: true, decisions: { select: { id: true, decision: true, createdAt: true } } },
  });
  if (!revision) return refus("Révision introuvable.");
  if (derniereDecision(revision.decisions)) return refus("Cette révision a déjà été traitée.");
  const decision = await prisma.decisionRevision.create({ data: { revisionId, decision: "rejetee" } });
  journaliser({ type: "decision_revision", decision: "rejetee", decisionId: decision.id, revisionId, propositionId: revision.propositionId });
  return { ok: true, propositionId: revision.propositionId };
}

export async function publierRevisionCore({
  revisionId,
  confirmation,
  isEditor,
  prisma,
  journaliser = journaliserParDefaut,
  maintenant = new Date(),
}) {
  if (!isEditor) return refus("Accès réservé à l'équipe.");
  if (!confirmationValide(confirmation)) return refus("Rien n'a été publié : tapez « oui » pour confirmer.");
  const revision = await prisma.revisionProposee.findUnique({
    where: { id: revisionId },
    include: {
      decisions: { select: { id: true, decision: true, createdAt: true } },
      analyseSource: { include: { proposition: { select: { candidatId: true } } } },
    },
  });
  if (!revision) return refus("Révision introuvable.");
  if (derniereDecision(revision.decisions)) return refus("Cette révision a déjà été traitée.");

  const source = revision.analyseSource;
  let donnees;
  try {
    donnees = donneesNouvelleVersion(source, revision.contenuPropose, revision.coutPipeline ?? null);
  } catch (error) {
    return refus(`Révision inutilisable : ${error.message}`);
  }

  try {
    const resultat = await prisma.$transaction(async (tx) => {
      const actuelle = await tx.analyse.findFirst({
        where: { propositionId: revision.propositionId, statut: "publie" },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      if (actuelle?.id !== source.id) {
        throw new Error("Une autre version de cette fiche a été publiée depuis : relancez la revue de la fiche (« Traiter maintenant »).");
      }
      const nouvelle = await tx.analyse.create({ data: donnees, select: { id: true } });
      // Seule mise à jour (voir l'en-tête) : statut et date de changement, rien d'autre.
      const { count } = await tx.analyse.updateMany({
        where: { id: source.id, statut: "publie" },
        data: { statut: "remplacee", updatedAt: maintenant },
      });
      if (count !== 1) throw new Error("L'ancienne version a changé entre-temps : rien n'a été publié.");
      const decision = await tx.decisionRevision.create({
        data: { revisionId, decision: "publiee", analysePublieeId: nouvelle.id },
        select: { id: true },
      });
      const candidatId = source.proposition.candidatId;
      const { _avg } = await tx.analyse.aggregate({
        where: { statut: "publie", proposition: { candidatId } },
        _avg: { scoreFaisabilite: true },
      });
      await tx.candidat.update({ where: { id: candidatId }, data: { scoreMoyen: _avg.scoreFaisabilite ?? null } });
      return { analyseId: nouvelle.id, decisionId: decision.id };
    });
    // Après la transaction (rien n'est journalisé si elle a été annulée).
    const commun = { revisionId, propositionId: revision.propositionId };
    journaliser({ type: "analyse_creee", ...commun, analyseId: resultat.analyseId, statut: "publie", score: donnees.scoreFaisabilite }, { maintenant });
    journaliser({ type: "analyse_remplacee", ...commun, analyseId: source.id, ancienStatut: "publie", nouveauStatut: "remplacee", remplaceePar: resultat.analyseId }, { maintenant });
    journaliser({ type: "decision_revision", decision: "publiee", ...commun, decisionId: resultat.decisionId, analysePublieeId: resultat.analyseId }, { maintenant });
    return { ok: true, propositionId: revision.propositionId, analyseId: resultat.analyseId };
  } catch (error) {
    return refus(error?.message ?? "Publication impossible.");
  }
}
