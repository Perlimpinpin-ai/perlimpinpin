// Logique de « Publier un brouillon » depuis /test/[id], SANS dépendance à Next ni
// à la vraie base : tout ce qu'elle utilise (contrôle d'accès, client Prisma,
// mode simulation) est passé en paramètre. Ça permet de la tester avec une fausse
// base (scripts/test-publier.test.js). Le câblage réel est dans src/app/test/actions.js.
//
// Reproduit EXACTEMENT scripts/publish.js : statut "publie", puis recalcul de
// Candidat.scoreMoyen (moyenne des scoreFaisabilite des analyses "publie").
//
// Fiche issue d'une révision (contenuComplet.revision, écrit par le robot de
// révision) : la même action fusionne aussi la PR « Révision <slug> », qui
// publie l'archive et les réponses sur /relectures (puis apres-revision.yml
// attribue les PerlimpinPOINTS). Ordre : vérification que la PR est
// fusionnable AVANT toute écriture, publication en base, puis fusion. Si la
// fusion échoue, la fiche reste publiée et le résultat porte un avertissement.
// PR déjà fusionnée à la main sur GitHub (pr.dejaFusionnee) : la publication
// se fait normalement, sans tentative de fusion.
// Les appels à GitHub sont passés en paramètre (github.verifier,
// github.fusionner : voir src/lib/github.js).
//
// Date de publication (Analyse.publieLe) : le moment du clic, pris côté serveur
// (`maintenant`, injectable pour les tests), écrit dans la même transaction que
// le statut. Un second clic trouve une analyse qui n'est plus un brouillon et
// est refusé : la date n'est jamais réécrite. « Réessayer la fusion » ne touche
// pas à la date (la fiche est déjà publiée).

import { dateEtHeure } from "./date-publication.js";

const NON_AUTORISE = "Non autorisé.";

// Erreur « attendue » lancée à l'intérieur de la transaction pour l'annuler
// proprement, avec un message à montrer à l'utilisateur.
class PublicationRefusee extends Error {}

function refus(message, extra = {}) {
  return { ok: false, message, ...extra };
}

// Slug de la révision (contenuComplet.revision.slug), ou null.
function slugRevision(analyse) {
  const slug = analyse.contenuComplet?.revision?.slug;
  return typeof slug === "string" && slug ? slug : null;
}

// Vérifie (lecture seule) que la PR de révision est fusionnable.
async function verifierRevision(slug, github) {
  if (!github?.verifier) return { ok: false, raison: "accès à GitHub non configuré", lien: null };
  try {
    return await github.verifier(slug);
  } catch (error) {
    return { ok: false, raison: `GitHub injoignable (${error.message})`, lien: null };
  }
}

async function fusionner(slug, numero, github) {
  try {
    return await github.fusionner({ slug, numero });
  } catch (error) {
    return { ok: false, raison: `GitHub injoignable (${error.message})` };
  }
}

const AVERTISSEMENT_FUSION = "Fiche publiée, mais les réponses aux commentaires n'ont pas pu être publiées";

export async function publierBrouillonCore(analyseId, { isEditor, prisma, dryRun, github, maintenant = () => new Date() }) {
  // 1. Accès : avant tout, sans toucher à la base.
  if (!(await isEditor())) return refus(NON_AUTORISE);

  // L'argument vient du navigateur : on ne lui fait pas confiance.
  if (typeof analyseId !== "number" || !Number.isInteger(analyseId) || analyseId <= 0) {
    return refus("Analyse introuvable.");
  }

  // 2. L'analyse existe et c'est un brouillon.
  const analyse = await prisma.analyse.findUnique({
    where: { id: analyseId },
    select: {
      id: true,
      statut: true,
      scoreFaisabilite: true,
      propositionId: true,
      contenuComplet: true,
      proposition: {
        select: { candidatId: true, candidat: { select: { nom: true } } },
      },
    },
  });
  if (!analyse) return refus("Analyse introuvable.");
  if (analyse.statut !== "brouillon") {
    return refus("Cette analyse n'est pas un brouillon : elle ne peut pas être publiée.");
  }

  // 3. C'est bien la plus récente de sa mesure (celle que montre la fiche publique).
  // Les analyses à la corbeille ne comptent pas (comme sur /test/[id]).
  const plusRecente = await prisma.analyse.findFirst({
    where: { propositionId: analyse.propositionId, statut: { not: "corbeille" } },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (plusRecente?.id !== analyse.id) {
    return refus(
      "Ce brouillon n'est pas l'analyse la plus récente de cette mesure : il ne peut pas être publié.",
    );
  }

  // 4. Pas de doublon publié pour la même mesure (cas non géré volontairement).
  const dejaPubliee = await prisma.analyse.findFirst({
    where: {
      propositionId: analyse.propositionId,
      statut: "publie",
      id: { not: analyse.id },
    },
    select: { id: true },
  });
  if (dejaPubliee) {
    return refus(
      "Une version publiée existe déjà pour cette mesure : dépublie-la d'abord (scripts/unpublish.js).",
    );
  }

  const { candidatId, candidat } = analyse.proposition;

  // 5. Fiche issue d'une révision : la PR doit être fusionnable AVANT toute
  // écriture (aussi en simulation, cette vérification ne fait que lire).
  const slug = slugRevision(analyse);
  let pr = null;
  if (slug) {
    const verification = await verifierRevision(slug, github);
    if (!verification.ok) {
      return refus(`La révision n'est pas fusionnable : ${verification.raison}. Rien n'a été publié.`, {
        lienPR: verification.lien ?? null,
      });
    }
    pr = { ...verification.pr, dejaFusionnee: Boolean(verification.dejaFusionnee) };
  }

  // Moment du clic, côté serveur (jamais une date venue du navigateur).
  const publieLe = maintenant();

  // 6. Simulation : on calcule la future moyenne, on n'écrit RIEN.
  if (dryRun) {
    const publiees = await prisma.analyse.findMany({
      where: { statut: "publie", proposition: { candidatId } },
      select: { scoreFaisabilite: true },
    });
    const somme = publiees.reduce((total, a) => total + a.scoreFaisabilite, 0);
    const moyenne = (somme + analyse.scoreFaisabilite) / (publiees.length + 1);
    const fusion = !pr
      ? ""
      : pr.dejaFusionnee
        ? ` La pull request #${pr.numero} (révision « ${slug} ») est déjà fusionnée : rien d'autre à faire.`
        : ` Puis la pull request #${pr.numero} (révision « ${slug} ») serait fusionnée (squash) : réponses publiées sur /relectures.`;
    return {
      ok: true,
      simulation: true,
      message: `[Simulation] Cette analyse serait publiée le ${dateEtHeure(publieLe)} (heure de Paris) et la moyenne de ${candidat.nom} deviendrait ${Number(moyenne.toFixed(1))}/100.${fusion}`,
      publieLe: publieLe.toISOString(),
      ...(pr ? { lienPR: pr.lien } : {}),
    };
  }

  // 7. Vraie publication : les deux écritures dans une seule transaction, dans
  // le même ordre que scripts/publish.js. Si l'une échoue, aucune n'est gardée.
  try {
    const candidatMisAJour = await prisma.$transaction(async (tx) => {
      const { count } = await tx.analyse.updateMany({
        where: { id: analyse.id, statut: "brouillon" },
        data: { statut: "publie", publieLe },
      });
      // Quelqu'un l'a déjà publiée (ou modifiée) entre-temps : on annule.
      if (count !== 1) {
        throw new PublicationRefusee(
          "Ce brouillon vient d'être modifié par quelqu'un d'autre : rien n'a été publié. Recharge la page.",
        );
      }

      const { _avg } = await tx.analyse.aggregate({
        where: { statut: "publie", proposition: { candidatId } },
        _avg: { scoreFaisabilite: true },
      });

      return tx.candidat.update({
        where: { id: candidatId },
        data: { scoreMoyen: _avg.scoreFaisabilite ?? null },
      });
    });

    const publie = {
      ok: true,
      simulation: false,
      analyseId: analyse.id,
      propositionId: analyse.propositionId,
      candidatId,
      candidatNom: candidatMisAJour.nom,
      publieLe: publieLe.toISOString(),
    };
    if (!pr) return publie;
    if (pr.dejaFusionnee) return { ...publie, revision: { slug, fusionnee: true, dejaFusionnee: true, lienPR: pr.lien } };

    // 8. Fusion de la PR de révision, une fois la fiche publiée.
    const fusion = await fusionner(slug, pr.numero, github);
    if (fusion.ok) return { ...publie, revision: { slug, fusionnee: true, lienPR: pr.lien } };
    return {
      ...publie,
      revision: { slug, fusionnee: false, lienPR: pr.lien },
      avertissement: `${AVERTISSEMENT_FUSION} : ${fusion.raison}.`,
    };
  } catch (error) {
    if (error instanceof PublicationRefusee) return refus(error.message);
    console.error("[test] échec de la publication :", error);
    return refus(
      "La publication a échoué et rien n'a été enregistré. Réessaie, ou publie avec scripts/publish.js.",
    );
  }
}

// « Réessayer la fusion » : fiche déjà publiée dont la PR de révision n'a pas
// pu être fusionnée. Aucune écriture en base, seulement l'appel à GitHub.
export async function fusionnerRevisionCore(analyseId, { isEditor, prisma, dryRun, github }) {
  if (!(await isEditor())) return refus(NON_AUTORISE);
  if (typeof analyseId !== "number" || !Number.isInteger(analyseId) || analyseId <= 0) {
    return refus("Analyse introuvable.");
  }
  const analyse = await prisma.analyse.findUnique({
    where: { id: analyseId },
    select: { id: true, statut: true, propositionId: true, contenuComplet: true },
  });
  if (!analyse) return refus("Analyse introuvable.");
  const slug = slugRevision(analyse);
  if (!slug) return refus("Cette analyse ne vient pas d'une révision : rien à fusionner.");
  if (analyse.statut !== "publie") return refus("Publie d'abord la fiche : la fusion se fait avec la publication.");

  const verification = await verifierRevision(slug, github);
  if (!verification.ok) {
    return refus(`La révision n'est pas fusionnable : ${verification.raison}.`, { lienPR: verification.lien ?? null });
  }
  if (verification.dejaFusionnee) {
    return { ok: true, simulation: Boolean(dryRun), analyseId: analyse.id, propositionId: analyse.propositionId, revision: { slug, fusionnee: true, dejaFusionnee: true, lienPR: verification.pr.lien } };
  }
  if (dryRun) {
    return {
      ok: true,
      simulation: true,
      message: `[Simulation] La pull request #${verification.pr.numero} (révision « ${slug} ») serait fusionnée (squash).`,
      lienPR: verification.pr.lien,
    };
  }
  const fusion = await fusionner(slug, verification.pr.numero, github);
  if (!fusion.ok) {
    return refus(`${AVERTISSEMENT_FUSION} : ${fusion.raison}.`, { lienPR: verification.pr.lien, avertissement: true });
  }
  return { ok: true, simulation: false, analyseId: analyse.id, propositionId: analyse.propositionId, revision: { slug, fusionnee: true, lienPR: verification.pr.lien } };
}
