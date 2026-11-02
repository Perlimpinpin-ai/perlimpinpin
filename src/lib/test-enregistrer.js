import { CHAMPS_EDITABLES, appliquerModification, blocPresent, lireChamp, validerTexte } from "./test-edition.js";

// Logique de « Enregistrer » d'un texte modifié depuis /test/[id], SANS
// dépendance à Next ni à la vraie base : contrôle d'accès, client Prisma et mode
// simulation sont passés en paramètre, pour la tester avec une fausse base
// (scripts/test-enregistrer.test.js). Le câblage réel est dans src/app/test/actions.js.

const NON_AUTORISE = "Non autorisé.";
const CONFLIT =
  "Ce brouillon a été modifié entre-temps. Recharge la page pour voir la dernière version.";

// Erreur « attendue » lancée dans la transaction pour l'annuler proprement.
class ModificationRefusee extends Error {}

function refus(message) {
  return { ok: false, message };
}

export async function enregistrerTexteCore(entree, { isEditor, prisma, dryRun }) {
  // 1. Accès : avant tout, sans toucher à la base.
  if (!(await isEditor())) return refus(NON_AUTORISE);

  // Tout ce qui vient du navigateur est suspect.
  const { analyseId, champ, valeur, versionAttendue } = entree ?? {};
  if (typeof analyseId !== "number" || !Number.isInteger(analyseId) || analyseId <= 0) {
    return refus("Analyse introuvable.");
  }
  const dateAttendue = typeof versionAttendue === "string" ? new Date(versionAttendue) : null;
  if (!dateAttendue || Number.isNaN(dateAttendue.getTime())) {
    return refus("Version du brouillon invalide. Recharge la page.");
  }

  // 2. Le texte est valide (champ autorisé, longueur, une ligne, gras équilibré…).
  const controle = validerTexte(champ, valeur);
  if (!controle.ok) return refus(controle.message);

  // 3. L'analyse existe, c'est un brouillon, et la plus récente de sa mesure.
  const analyse = await prisma.analyse.findUnique({
    where: { id: analyseId },
    select: {
      id: true,
      statut: true,
      updatedAt: true,
      propositionId: true,
      contenuComplet: true,
      proposition: { select: { texteOriginal: true } },
    },
  });
  if (!analyse) return refus("Analyse introuvable.");
  if (analyse.statut !== "brouillon") {
    return refus("Cette analyse n'est pas un brouillon : elle ne peut pas être modifiée.");
  }

  // Les analyses à la corbeille ne comptent pas (comme sur /test/[id]).
  const plusRecente = await prisma.analyse.findFirst({
    where: { propositionId: analyse.propositionId, statut: { not: "corbeille" } },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (plusRecente?.id !== analyse.id) {
    return refus(
      "Ce brouillon n'est pas l'analyse la plus récente de cette mesure : il ne peut pas être modifié.",
    );
  }

  const { chemin, colonneProposition, blocAbsent, coherence } = CHAMPS_EDITABLES[champ];

  // Colonne de la proposition (mesure initiale, thématique) : partagée par toutes les
  // analyses de la mesure. Si l'une d'elles est publiée, la modifier changerait
  // tout de suite la fiche publique : refusé.
  if (colonneProposition) {
    const publiee = await prisma.analyse.findFirst({
      where: { propositionId: analyse.propositionId, statut: "publie" },
      select: { id: true },
    });
    if (publiee) {
      return refus(
        `Cette mesure a déjà une version publiée : modifier « ${CHAMPS_EDITABLES[champ].libelle} » changerait aussi la fiche publique. Modification refusée.`,
      );
    }
  }

  // Champ d'un bloc que cette fiche n'a pas (version basique, critère, section…).
  if (chemin && !blocPresent(analyse.contenuComplet, champ)) {
    return refus(blocAbsent ?? "Ce bloc n'existe pas sur cette fiche : il ne peut pas être modifié.");
  }

  // Cohérence avec le reste de la fiche (ex. sources principales de la version basique).
  const incoherence = coherence ? coherence(analyse.contenuComplet, controle.valeur) : null;
  if (incoherence) return refus(incoherence);

  // 4. Concurrence : quelqu'un a-t-il modifié le brouillon depuis l'ouverture de la page ?
  if (analyse.updatedAt.toISOString() !== versionAttendue) return refus(CONFLIT);

  // 5. Nouveau contenu (le garde-fou de appliquerModification lève une erreur si
  // autre chose que le champ visé devait changer). Une colonne de la proposition
  // laisse le contenu intact.
  let modification;
  try {
    modification = colonneProposition
      ? { contenu: null, derives: { [colonneProposition]: controle.valeur } }
      : appliquerModification(analyse.contenuComplet, champ, controle.valeur);
  } catch (error) {
    console.error("[test] modification refusée par le garde-fou :", error);
    return refus("Ce brouillon ne peut pas être modifié : son contenu n'a pas la forme attendue.");
  }
  const { contenu, derives } = modification;
  const avant = colonneProposition
    ? analyse.proposition?.[colonneProposition]
    : lireChamp(analyse.contenuComplet, champ);
  const apres = colonneProposition ? controle.valeur : lireChamp(contenu, champ);

  // Simulation : on valide tout, on n'écrit RIEN.
  if (dryRun) {
    return {
      ok: true,
      simulation: true,
      message: Array.isArray(controle.valeur)
        ? `[Simulation] La liste serait enregistrée (${controle.valeur.length} points).`
        : controle.valeur === null
          ? "[Simulation] La valeur serait effacée."
          : `[Simulation] Le texte serait enregistré (${controle.valeur.length} caractères).`,
    };
  }

  // 6. Vraie modification. La nouvelle version est fixée explicitement (et
  // strictement postérieure à l'ancienne) : la valeur renvoyée à la page est ainsi
  // exactement celle de la base, sans relecture.
  const versionSuivante = new Date(Math.max(Date.now(), analyse.updatedAt.getTime() + 1));

  try {
    await prisma.$transaction(async (tx) => {
      const { count } = await tx.analyse.updateMany({
        // Toujours un brouillon ET toujours dans l'état vu par l'éditeur : sinon
        // (count = 0) quelqu'un est passé avant, on annule tout.
        where: { id: analyse.id, statut: "brouillon", updatedAt: dateAttendue },
        // Colonne de la proposition : seule la version du brouillon avance
        // (elle sert de verrou contre les modifications simultanées).
        data: {
          ...(contenu ? { contenuComplet: contenu } : {}),
          updatedAt: versionSuivante,
          ...(derives.teaser !== undefined ? { teaser: derives.teaser } : {}),
          ...(derives.verdict !== undefined ? { verdict: derives.verdict } : {}),
          ...(derives.resumeAccueil !== undefined ? { resumeAccueil: derives.resumeAccueil } : {}),
        },
      });
      if (count !== 1) throw new ModificationRefusee(CONFLIT);

      if (derives.titreProposition !== undefined) {
        await tx.proposition.update({
          where: { id: analyse.propositionId },
          data: { titre: derives.titreProposition },
        });
      }
      if (colonneProposition) {
        await tx.proposition.update({
          where: { id: analyse.propositionId },
          data: { [colonneProposition]: derives[colonneProposition] },
        });
      }
    });
  } catch (error) {
    if (error instanceof ModificationRefusee) return refus(error.message);
    console.error("[test] échec de l'enregistrement du texte :", error);
    return refus("L'enregistrement a échoué et rien n'a été modifié. Réessaie.");
  }

  return {
    ok: true,
    simulation: false,
    versionSuivante: versionSuivante.toISOString(),
    analyseId: analyse.id,
    propositionId: analyse.propositionId,
    champ,
    avant,
    apres,
  };
}
