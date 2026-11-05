// Actions de la page admin de la revue du dimanche (/test/revue), sans Next :
// la base est passée en paramètre (tests : scripts/revue-admin.test.js).
//
//   - reclasserCore : nouvelle ligne TriAnnotation (source « arno ») ;
//   - publierRevisionCore : publie une révision proposée, SEULEMENT si Arno a
//     tapé « oui » ;
//   - rejeterRevisionCore : décision « rejetee » ;
//   - validerReponsesCore : fiche sans révision, réponses validées (« oui »).
// Lot 5 : chaque décision clôt les annotations traitées (archivées avec la
// version en ligne) et, à la publication, réaccroche les autres sur la
// nouvelle version (TraitementAnnotation, voir versions-core.js).
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
import { estSlugFiche, slugFiche } from "./fiche-annotations-core.js";
import { planTraitements } from "./versions-core.js";
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

// Annotations d'une fiche, avec leurs tris et traitements (lot 5).
function annotationsDeLaFiche(tx, propositionId) {
  return tx.relectureComment.findMany({
    where: { ficheSlug: slugFiche(propositionId) },
    select: {
      id: true,
      sectionId: true,
      quotedText: true,
      tris: { select: { id: true, categorie: true, reponse: true, createdAt: true } },
      traitements: { select: { id: true, etat: true, createdAt: true } },
    },
  });
}

// Crée les lignes TraitementAnnotation (ajout seulement) ; renvoie le bilan.
async function creerTraitements(tx, lignes) {
  if (lignes.length > 0) await tx.traitementAnnotation.createMany({ data: lignes });
  return {
    closes: lignes.filter((l) => l.etat === "traitee").length,
    reaccrochees: lignes.filter((l) => l.etat === "reaccrochee").length,
    retenues: lignes.filter((l) => l.retenu).length,
    commentIds: lignes.map((l) => l.commentId),
  };
}

function versionEnLigne(tx, propositionId) {
  return tx.analyse.findFirst({ where: { propositionId, statut: "publie" }, orderBy: { createdAt: "desc" }, select: { id: true } });
}

export async function rejeterRevisionCore({ revisionId, isEditor, prisma, journaliser = journaliserParDefaut }) {
  if (!isEditor) return refus("Accès réservé à l'équipe.");
  const revision = await prisma.revisionProposee.findUnique({
    where: { id: revisionId },
    select: {
      id: true,
      propositionId: true,
      commentIds: true,
      resume: true,
      decisions: { select: { id: true, decision: true, createdAt: true } },
    },
  });
  if (!revision) return refus("Révision introuvable.");
  if (derniereDecision(revision.decisions)) return refus("Cette révision a déjà été traitée.");
  try {
    const resultat = await prisma.$transaction(async (tx) => {
      const decision = await tx.decisionRevision.create({ data: { revisionId, decision: "rejetee" }, select: { id: true } });
      // Annotations closes avec la version en ligne (aucune n'est retenue).
      const enLigne = await versionEnLigne(tx, revision.propositionId);
      const lignes = planTraitements({
        annotations: await annotationsDeLaFiche(tx, revision.propositionId),
        decision: { id: decision.id, type: "rejetee" },
        revision,
        versionArchive: enLigne?.id ?? null,
      });
      return { decisionId: decision.id, bilan: await creerTraitements(tx, lignes) };
    });
    journaliser({ type: "decision_revision", decision: "rejetee", decisionId: resultat.decisionId, revisionId, propositionId: revision.propositionId });
    journaliser({ type: "traitements_annotations", propositionId: revision.propositionId, decisionId: resultat.decisionId, ...resultat.bilan });
    return { ok: true, propositionId: revision.propositionId };
  } catch (error) {
    return refus(error?.message ?? "Rejet impossible.");
  }
}

// Fiche sans révision (questions, désaccords, hors sujet) : valide les
// réponses proposées et clôt ces annotations avec la version en ligne. Les
// « argument_ou_source » restent ouvertes (elles attendent une révision).
export async function validerReponsesCore({ propositionId, confirmation, isEditor, prisma, journaliser = journaliserParDefaut }) {
  if (!isEditor) return refus("Accès réservé à l'équipe.");
  if (!confirmationValide(confirmation)) return refus("Rien n'a été validé : tapez « oui » pour confirmer.");
  if (!Number.isSafeInteger(propositionId) || propositionId <= 0) return refus("Fiche invalide.");
  try {
    const bilan = await prisma.$transaction(async (tx) => {
      const enLigne = await versionEnLigne(tx, propositionId);
      if (!enLigne) throw new Error("Aucune version publiée pour cette fiche.");
      const lignes = planTraitements({
        annotations: await annotationsDeLaFiche(tx, propositionId),
        decision: { id: null, type: "reponses" },
        versionArchive: enLigne.id,
      });
      if (lignes.length === 0) throw new Error("Aucune réponse à valider pour cette fiche.");
      return creerTraitements(tx, lignes);
    });
    journaliser({ type: "traitements_annotations", propositionId, decisionId: null, ...bilan });
    return { ok: true, propositionId, closes: bilan.closes };
  } catch (error) {
    return refus(error?.message ?? "Validation impossible.");
  }
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
      const actuelle = await versionEnLigne(tx, revision.propositionId);
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
      // Lot 5 : annotations traitées closes avec l'ancienne version, les autres
      // réaccrochées sur la nouvelle (au passage s'il existe encore, sinon au bloc).
      const lignes = planTraitements({
        annotations: await annotationsDeLaFiche(tx, revision.propositionId),
        decision: { id: decision.id, type: "publiee" },
        revision,
        versionArchive: source.id,
        nouvelleVersion: { id: nouvelle.id, contenu: revision.contenuPropose },
      });
      const bilan = await creerTraitements(tx, lignes);
      const candidatId = source.proposition.candidatId;
      const { _avg } = await tx.analyse.aggregate({
        where: { statut: "publie", proposition: { candidatId } },
        _avg: { scoreFaisabilite: true },
      });
      await tx.candidat.update({ where: { id: candidatId }, data: { scoreMoyen: _avg.scoreFaisabilite ?? null } });
      return { analyseId: nouvelle.id, decisionId: decision.id, bilan };
    });
    // Après la transaction (rien n'est journalisé si elle a été annulée).
    const commun = { revisionId, propositionId: revision.propositionId };
    journaliser({ type: "analyse_creee", ...commun, analyseId: resultat.analyseId, statut: "publie", score: donnees.scoreFaisabilite }, { maintenant });
    journaliser({ type: "analyse_remplacee", ...commun, analyseId: source.id, ancienStatut: "publie", nouveauStatut: "remplacee", remplaceePar: resultat.analyseId }, { maintenant });
    journaliser({ type: "decision_revision", decision: "publiee", ...commun, decisionId: resultat.decisionId, analysePublieeId: resultat.analyseId }, { maintenant });
    journaliser({ type: "traitements_annotations", ...commun, decisionId: resultat.decisionId, ...resultat.bilan }, { maintenant });
    return { ok: true, propositionId: revision.propositionId, analyseId: resultat.analyseId };
  } catch (error) {
    return refus(error?.message ?? "Publication impossible.");
  }
}
