import { CHAMPS_EDITABLES, appliquerModification, blocPresent, lireChamp, validerTexte } from "./test-edition.js";
import { slugFiche } from "./fiche-annotations-core.js";
import { dernierTraitement, passageExiste } from "./versions-core.js";

// Correction d'une coquille sur une fiche DÉJÀ PUBLIÉE, depuis /test/publiees/[id],
// SANS nouvelle version : le texte est corrigé sur place et la correction est
// visible tout de suite sur le site. Même modèle que enregistrerTexteCore
// (src/lib/test-enregistrer.js, qui reste réservé aux brouillons) : aucune
// dépendance à Next ni à la vraie base, contrôle d'accès, client Prisma et mode
// simulation passés en paramètre (tests : scripts/test-corriger.test.js). Le
// câblage réel est dans src/app/test/actions.js (corrigerCoquille).

const NON_AUTORISE = "Non autorisé.";
const CONFLIT =
  "Cette fiche a été modifiée entre-temps. Recharge la page pour voir la dernière version.";
export const MESSAGE_TROP_IMPORTANTE =
  "Modification trop importante pour une correction de coquille. Pour changer le fond, il faut une nouvelle version.";
export const MESSAGE_ANNOTATION =
  "Une annotation du Club cite ce passage : elle ne sera plus accrochée au texte. Confirmer ?";

// --- Champs corrigeables -----------------------------------------------------
// Les champs éditables d'un brouillon (CHAMPS_EDITABLES), SAUF :
//   - les colonnes de la proposition (Mesure initiale, Thématique), partagées
//     par toutes les versions de la mesure ;
//   - les listes déroulantes (catégorie de l'objectif) : un classement, pas un
//     texte, donc pas de coquille possible ;
//   - le niveau de confiance : son premier mot (« Faible. », « Moyen. »,
//     « Élevé. ») fixe la jauge de confiance, une qualification de la fiche.
// Aucune note, aucun score, aucune appréciation n'est dans CHAMPS_EDITABLES :
// la notation ne peut donc jamais changer par cette voie.
const EXCLUS_QUALIFICATION = new Set(["niveau_de_confiance"]);

export function champCorrigeable(champ) {
  if (typeof champ !== "string" || !Object.hasOwn(CHAMPS_EDITABLES, champ)) return false;
  const regles = CHAMPS_EDITABLES[champ];
  return !regles.colonneProposition && regles.type !== "choix" && !EXCLUS_QUALIFICATION.has(champ);
}

// Nom de champ qui évoque la notation (note, score, appréciation,
// qualification…) : message dédié, même si le champ n'est de toute façon pas
// dans la liste blanche.
const MOTIF_NOTATION = /notation|score|note|apprecia|qualification|confiance|categorie|plafond|bareme|verdict_score/i;

function messageChampRefuse(champ) {
  if (typeof champ === "string" && Object.hasOwn(CHAMPS_EDITABLES, champ)) {
    const regles = CHAMPS_EDITABLES[champ];
    if (regles.colonneProposition) {
      return `« ${regles.libelle} » est partagée par toutes les versions de la mesure : elle ne peut pas être corrigée ici.`;
    }
    return `« ${regles.libelle} » touche à la notation de la fiche : il ne peut pas être corrigé ici.`;
  }
  if (typeof champ === "string" && MOTIF_NOTATION.test(champ)) {
    return "Ce champ touche à la notation de la fiche : il ne peut jamais être modifié par une correction de coquille.";
  }
  return "Ce champ ne peut pas être corrigé ici.";
}

// --- Garde-fou « coquille » --------------------------------------------------

// Texte comparé : sans les ** du gras ; une liste est comparée ligne à ligne.
export function texteComparable(valeur) {
  const texte = Array.isArray(valeur) ? valeur.join("\n") : typeof valeur === "string" ? valeur : "";
  return texte.replace(/\*\*/g, "");
}

// Seuil : 20 caractères, ou 10 % du texte d'origine si c'est plus.
export function seuilCoquille(texteOrigine) {
  return Math.max(20, Math.floor(texteComparable(texteOrigine).length * 0.1));
}

// Distance d'édition (Levenshtein : insertions, suppressions, substitutions)
// entre a et b, BORNÉE : dès qu'elle dépasse `plafond`, renvoie plafond + 1
// sans finir le calcul. Le début et la fin communs sont retirés d'abord (une
// coquille est locale), puis seule une bande de largeur 2 × plafond + 1 autour
// de la diagonale est calculée : rapide même sur un texte de 12 000 caractères.
export function distanceEdition(a, b, plafond = Infinity) {
  let debut = 0;
  while (debut < a.length && debut < b.length && a[debut] === b[debut]) debut++;
  let finA = a.length;
  let finB = b.length;
  while (finA > debut && finB > debut && a[finA - 1] === b[finB - 1]) {
    finA--;
    finB--;
  }
  const x = a.slice(debut, finA);
  const y = b.slice(debut, finB);
  if (x.length === 0) return Math.min(y.length, plafond + 1);
  if (y.length === 0) return Math.min(x.length, plafond + 1);
  if (Math.abs(x.length - y.length) > plafond) return plafond + 1;

  const bande = Number.isFinite(plafond) ? plafond : Math.max(x.length, y.length);
  const HORS = plafond + 1;
  let precedente = new Array(y.length + 1);
  let courante = new Array(y.length + 1);
  for (let j = 0; j <= y.length; j++) precedente[j] = j <= bande ? j : HORS;
  for (let i = 1; i <= x.length; i++) {
    const jMin = Math.max(1, i - bande);
    const jMax = Math.min(y.length, i + bande);
    // Seules les cases de la bande sont calculées ; leurs deux voisines hors
    // bande valent HORS (lues par cette ligne et la suivante).
    courante[0] = i <= bande ? i : HORS;
    if (jMin > 1) courante[jMin - 1] = HORS;
    if (jMax < y.length) courante[jMax + 1] = HORS;
    let minLigne = courante[0];
    for (let j = jMin; j <= jMax; j++) {
      const cout = x[i - 1] === y[j - 1] ? 0 : 1;
      const valeur = Math.min(precedente[j] + 1, courante[j - 1] + 1, precedente[j - 1] + cout);
      courante[j] = Math.min(valeur, HORS);
      if (courante[j] < minLigne) minLigne = courante[j];
    }
    if (minLigne > plafond) return HORS;
    [precedente, courante] = [courante, precedente];
  }
  return Math.min(precedente[y.length], HORS);
}

// La modification est-elle une simple coquille ? { ok, distance, seuil }.
export function estUneCoquille(avant, apres) {
  const seuil = seuilCoquille(avant);
  const distance = distanceEdition(texteComparable(avant), texteComparable(apres), seuil);
  return { ok: distance <= seuil, distance, seuil };
}

// --- Annotations du Club -------------------------------------------------------

// Annotations encore accrochées à un passage de la fiche : ni closes (traitées),
// ni déjà réaccrochées au seul bloc (passage disparu lors d'une nouvelle version).
export function annotationsOuvertes(annotations) {
  return (annotations ?? []).filter((a) => {
    if (typeof a?.quotedText !== "string" || a.quotedText.length === 0) return false;
    const t = dernierTraitement(a.traitements);
    if (t?.etat === "traitee") return false;
    if (t?.etat === "reaccrochee" && t.rattachement === "section") return false;
    return true;
  });
}

// Annotations dont le passage cité existe aujourd'hui mais disparaîtrait avec
// la correction.
export function annotationsDecrochees(annotations, contenuAvant, contenuApres) {
  return annotationsOuvertes(annotations).filter(
    (a) => passageExiste(contenuAvant, a.sectionId, a.quotedText) && !passageExiste(contenuApres, a.sectionId, a.quotedText),
  );
}

// --- Dossiers qui citent la fiche ------------------------------------------------

// Slugs des dossiers (JSON de data/hors-series/) qui renvoient à la fiche
// `propositionId` : clé ficheId / propositionId, jeton {note:<id>} ou lien
// /declarations/<id> dans un texte.
export function dossiersDeLaFiche(dossiers, propositionId) {
  const jeton = new RegExp(`\\{note:${propositionId}\\}|/declarations/${propositionId}(?!\\d)`);
  const cite = (valeur) => {
    if (typeof valeur === "string") return jeton.test(valeur);
    if (Array.isArray(valeur)) return valeur.some(cite);
    if (valeur && typeof valeur === "object") {
      return Object.entries(valeur).some(
        ([cle, v]) => ((cle === "ficheId" || cle === "propositionId") && v === propositionId) || cite(v),
      );
    }
    return false;
  };
  return (dossiers ?? []).filter((d) => typeof d?.slug === "string" && cite(d)).map((d) => d.slug);
}

// --- Action ------------------------------------------------------------------------

// Erreur « attendue » lancée dans la transaction pour l'annuler proprement.
class ModificationRefusee extends Error {}

function refus(message) {
  return { ok: false, message };
}

// entree : { analyseId, champ, valeur, versionAttendue, confirmerAnnotations }
export async function corrigerCoquilleCore(entree, { isEditor, prisma, dryRun, maintenant = () => new Date() }) {
  // 1. Accès : avant tout, sans toucher à la base.
  if (!(await isEditor())) return refus(NON_AUTORISE);

  const { analyseId, champ, valeur, versionAttendue, confirmerAnnotations } = entree ?? {};
  if (typeof analyseId !== "number" || !Number.isInteger(analyseId) || analyseId <= 0) {
    return refus("Analyse introuvable.");
  }
  const dateAttendue = typeof versionAttendue === "string" ? new Date(versionAttendue) : null;
  if (!dateAttendue || Number.isNaN(dateAttendue.getTime())) {
    return refus("Version de la fiche invalide. Recharge la page.");
  }

  // 2. Champ corrigeable (ni notation, ni mesure initiale…), puis même
  // validation que pour un brouillon.
  if (!champCorrigeable(champ)) return refus(messageChampRefuse(champ));
  const controle = validerTexte(champ, valeur);
  if (!controle.ok) return refus(controle.message);

  // 3. L'analyse existe et elle est publiée (ni brouillon, ni corbeille, ni
  // version remplacée).
  const analyse = await prisma.analyse.findUnique({
    where: { id: analyseId },
    select: {
      id: true,
      statut: true,
      updatedAt: true,
      propositionId: true,
      contenuComplet: true,
      proposition: { select: { candidatId: true } },
    },
  });
  if (!analyse) return refus("Analyse introuvable.");
  if (analyse.statut !== "publie") {
    return refus("Cette analyse n'est pas une fiche publiée : elle ne peut pas être corrigée ici.");
  }

  const { blocAbsent, coherence } = CHAMPS_EDITABLES[champ];
  if (!blocPresent(analyse.contenuComplet, champ)) {
    return refus(blocAbsent ?? "Ce bloc n'existe pas sur cette fiche : il ne peut pas être corrigé.");
  }
  const incoherence = coherence ? coherence(analyse.contenuComplet, controle.valeur) : null;
  if (incoherence) return refus(incoherence);

  // 4. Garde-fou « coquille ».
  const avant = lireChamp(analyse.contenuComplet, champ);
  const coquille = estUneCoquille(avant, controle.valeur);
  if (!coquille.ok) return refus(MESSAGE_TROP_IMPORTANTE);

  // 5. Concurrence : la fiche a-t-elle changé depuis l'ouverture de la page ?
  if (analyse.updatedAt.toISOString() !== versionAttendue) return refus(CONFLIT);

  // 6. Nouveau contenu (le garde-fou de appliquerModification lève une erreur si
  // autre chose que le champ visé devait changer, notation_detaillee comprise).
  let modification;
  try {
    modification = appliquerModification(analyse.contenuComplet, champ, controle.valeur);
  } catch (error) {
    console.error("[test] correction refusée par le garde-fou :", error);
    return refus("Cette fiche ne peut pas être corrigée : son contenu n'a pas la forme attendue.");
  }
  const { derives } = modification;
  const apres = lireChamp(modification.contenu, champ);

  // 7. Annotations du Club dont le passage cité disparaîtrait : on ne bloque
  // pas, mais il faut une confirmation explicite.
  const annotations = await prisma.relectureComment.findMany({
    where: { ficheSlug: slugFiche(analyse.propositionId), quotedText: { not: null } },
    select: {
      id: true,
      sectionId: true,
      quotedText: true,
      traitements: { select: { id: true, etat: true, rattachement: true, createdAt: true } },
    },
  });
  const decrochees = annotationsDecrochees(annotations, analyse.contenuComplet, modification.contenu);
  if (decrochees.length > 0 && confirmerAnnotations !== true) {
    return { ok: false, confirmation: true, annotations: decrochees.length, message: MESSAGE_ANNOTATION };
  }

  // Trace de la correction, dans le contenu lui-même (pas de migration).
  const date = maintenant();
  const corrections = Array.isArray(analyse.contenuComplet.corrections_coquilles)
    ? analyse.contenuComplet.corrections_coquilles
    : [];
  const trace = { date: date.toISOString(), champ, avant: avant ?? null, apres };
  const contenu = { ...modification.contenu, corrections_coquilles: [...corrections, trace] };

  // Simulation : on valide tout, on n'écrit RIEN.
  if (dryRun) {
    return {
      ok: true,
      simulation: true,
      message: `[Simulation] La correction serait enregistrée (${coquille.distance} caractère${coquille.distance > 1 ? "s" : ""} modifié${coquille.distance > 1 ? "s" : ""}, ${coquille.seuil} au plus).`,
    };
  }

  // 8. Vraie modification, correction et trace dans la même transaction. La
  // nouvelle version est strictement postérieure à l'ancienne.
  const versionSuivante = new Date(Math.max(date.getTime(), analyse.updatedAt.getTime() + 1));

  try {
    await prisma.$transaction(async (tx) => {
      const { count } = await tx.analyse.updateMany({
        // Toujours publiée ET toujours dans l'état vu par l'éditeur.
        where: { id: analyse.id, statut: "publie", updatedAt: dateAttendue },
        // Jamais scoreFaisabilite ni aucune note : seulement le texte et ses
        // colonnes dérivées (teaser, verdict, phrase d'accueil).
        data: {
          contenuComplet: contenu,
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
    });
  } catch (error) {
    if (error instanceof ModificationRefusee) return refus(error.message);
    console.error("[test] échec de la correction de coquille :", error);
    return refus("L'enregistrement a échoué et rien n'a été modifié. Réessaie.");
  }

  return {
    ok: true,
    simulation: false,
    versionSuivante: versionSuivante.toISOString(),
    analyseId: analyse.id,
    propositionId: analyse.propositionId,
    candidatId: analyse.proposition?.candidatId ?? null,
    champ,
    avant,
    apres,
    annotationsDecrochees: decrochees.map((a) => a.id),
  };
}
