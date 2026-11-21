import { analyseVisee } from "./reel-action-core.js";
import { construireMessageRecit, estimationCoutRecit } from "./recit-generation.js";
import { cibleValide, contenuAvecRecit, contenuAvecRetour, contenuRevenuAuPrecedent, entreeRetour, remarqueNettoyee } from "./recit.js";
import { slideDeCible } from "./carrousel-recit.js";
import { aleaFiche, choisirIllustration, motsClesDisponibles } from "./illustrations.js";

// Logique des boutons du carrousel détaillé de /test/reseaux/<id> :
// « Générer le carrousel détaillé » / « Générer à nouveau », « Régénérer avec
// ces remarques » et « Revenir à la version précédente ». Dépendances
// injectées (isEditor, prisma, generer, lirePrompt, sauvegarder,
// derniereIllustration) pour tester sans base ni appel payant
// (scripts/recit.test.js) ; branchées par src/app/test/reseaux/actions.js
// (et, pour la démonstration locale, par un faux `prisma` sur un fichier).
//
// Écriture toujours ciblée : contenuComplet.reseaux_recit seulement (version
// actuelle, version précédente sous `precedent`, journal des remarques sous
// `retours`), après une sauvegarde de la ligne, et refusée si la fiche a été
// modifiée entre la lecture et l'écriture (updatedAt).

function verifierId(propositionId) {
  return Number.isInteger(propositionId) && propositionId > 0;
}

const MODE_EDITION = { ok: false, erreur: "Mode édition requis : déverrouillez /test." };

async function cibleFiche(propositionId, { brouillon, isEditor, prisma }) {
  if (!(await isEditor())) return { erreur: MODE_EDITION };
  if (!verifierId(propositionId)) return { erreur: { ok: false, erreur: "Fiche introuvable." } };
  const cible = await analyseVisee(prisma, propositionId, { brouillon });
  if (!cible) return { erreur: { ok: false, erreur: "Aucune analyse pour cette fiche." } };
  return cible;
}

async function ecrire({ prisma, analyse, contenu, contenuNouveau, sauvegarder }) {
  let sauvegarde = null;
  try {
    sauvegarde = await sauvegarder({ analyse, contenu });
  } catch {
    sauvegarde = null;
  }
  const { count } = await prisma.analyse.updateMany({
    where: { id: analyse.id, updatedAt: analyse.updatedAt },
    data: { contenuComplet: contenuNouveau },
  });
  return { ecrit: count === 1, sauvegarde };
}

// Image de thème retenue pour une nouvelle version : tirage dans le thème,
// orienté par les mots-clés du modèle, en évitant l'image du dernier
// carrousel du même thème.
async function illustrationRetenue({ proposition, recit, derniereIllustration }) {
  const derniere = derniereIllustration ? await derniereIllustration({ theme: proposition.theme, propositionId: proposition.id }) : null;
  const { illustration } = choisirIllustration({
    theme: proposition.theme,
    motsCles: recit.illustration_mots_cles ?? [],
    derniere,
    alea: aleaFiche(`${proposition.id}-${recit.genereLe ?? ""}`),
  });
  return illustration?.fichier ?? null;
}

// Coût estimé avant confirmation, sans appel payant. Avec `remarque` et
// `cible`, celui d'une régénération avec remarques (message plus long : il
// porte la version précédente).
// Renvoie { ok, min, max, aDejaUnRecit } ou { ok: false, erreur }.
export async function estimerRecitCore(propositionId, { brouillon, isEditor, prisma, lirePrompt, remarque = null, cible = null }) {
  const fiche = await cibleFiche(propositionId, { brouillon, isEditor, prisma });
  if (fiche.erreur) return fiche.erreur;
  const contenu = fiche.analyse.contenuComplet ?? {};
  const motsClesIllustration = motsClesDisponibles(fiche.proposition.theme);
  const remarques =
    remarque !== null && contenu.reseaux_recit
      ? { precedent: contenu.reseaux_recit, remarque: remarqueNettoyee(remarque) || "…", cible: cibleValide(cible) ? cible : "toutes", libelleCible: "" }
      : null;
  const { min, max } = estimationCoutRecit(construireMessageRecit(await lirePrompt(), contenu, { motsClesIllustration, remarques }).length);
  return { ok: true, min, max, aDejaUnRecit: Boolean(contenu.reseaux_recit) };
}

// Génère et écrit le carrousel détaillé d'une fiche.
//  - réservé au mode édition ;
//  - dryRun (TEST_DRY_RUN=1, Preview) : aucun appel, rien n'est écrit ;
//  - sauvegarde de la ligne actuelle avant l'écriture ;
//  - l'ancien carrousel gardé sous `precedent`, le journal `retours` conservé.
// Renvoie { ok: true, simulation?, message, cout?, avertissements?, sauvegarde? }
// ou { ok: false, erreur, cout? }.
export async function genererRecitPourFicheCore(propositionId, { brouillon, isEditor, prisma, dryRun, cleConfiguree, generer, sauvegarder, derniereIllustration = null }) {
  const fiche = await cibleFiche(propositionId, { brouillon, isEditor, prisma });
  if (fiche.erreur) return fiche.erreur;
  const { proposition, analyse } = fiche;

  if (dryRun) {
    return { ok: true, simulation: true, message: "Mode simulation (TEST_DRY_RUN=1) : aucun appel à Claude, rien n’est écrit." };
  }
  if (!cleConfiguree) {
    return { ok: false, erreur: "ANTHROPIC_API_KEY n’est pas configurée sur ce serveur : génération impossible." };
  }

  const contenu = analyse.contenuComplet ?? {};
  const resultat = await generer(contenu, {
    candidatNom: proposition.candidat.nom,
    score: analyse.scoreFaisabilite,
    propositionId,
    motsClesIllustration: motsClesDisponibles(proposition.theme),
  });
  const cout = resultat.cout;
  if (!resultat.recit) {
    const raisons = resultat.errors?.length ? resultat.errors.join(" ; ") : "raison inconnue";
    return { ok: false, erreur: `Carrousel détaillé refusé après deux essais, rien n’est écrit. ${raisons}`, cout };
  }

  const illustration = await illustrationRetenue({ proposition, recit: resultat.recit, derniereIllustration });
  const recit = { ...resultat.recit, ...(illustration ? { illustration } : {}) };
  const { ecrit, sauvegarde } = await ecrire({ prisma, analyse, contenu, contenuNouveau: contenuAvecRecit(contenu, recit), sauvegarder });
  if (!ecrit) {
    return { ok: false, erreur: "La fiche a été modifiée pendant la génération : rien n’est écrit. Recommencez.", cout };
  }
  return {
    ok: true,
    message: contenu.reseaux_recit ? "Nouveau carrousel détaillé généré (l’ancien est gardé comme version précédente)." : "Carrousel détaillé généré.",
    cout,
    avertissements: resultat.avertissements ?? [],
    sauvegarde,
  };
}

// Régénère le carrousel détaillé avec des remarques.
//  - `cible` : "toutes", un type de slide (src/lib/carrousel-recit.js) ou
//    "tweet" ; une slide visée est la seule réécrite, le reste est repris tel
//    quel de la version actuelle ;
//  - mêmes contrôles et mêmes refus que la génération ;
//  - acceptée : la version actuelle passe sous `precedent` ; refusée : rien
//    ne change dans le carrousel. Dans les deux cas, la remarque est ajoutée
//    au journal `retours` (date, slide visée, résultat).
export async function regenererAvecRemarquesCore(propositionId, { remarque, cible, brouillon, isEditor, prisma, dryRun, cleConfiguree, generer, sauvegarder, derniereIllustration = null }) {
  const fiche = await cibleFiche(propositionId, { brouillon, isEditor, prisma });
  if (fiche.erreur) return fiche.erreur;
  const { proposition, analyse } = fiche;
  const texteRemarque = remarqueNettoyee(remarque);
  if (!texteRemarque) return { ok: false, erreur: "Écrivez d’abord ce qui ne va pas." };
  if (!cibleValide(cible)) return { ok: false, erreur: "Slide visée inconnue." };
  const contenu = analyse.contenuComplet ?? {};
  const precedent = contenu.reseaux_recit;
  if (!precedent) return { ok: false, erreur: "Pas encore de carrousel détaillé à régénérer." };
  const slide = slideDeCible(precedent, cible);
  if (cible !== "toutes" && cible !== "tweet" && !slide) return { ok: false, erreur: "Cette slide n’existe pas dans la version actuelle." };

  if (dryRun) {
    return { ok: true, simulation: true, message: "Mode simulation (TEST_DRY_RUN=1) : aucun appel à Claude, rien n’est écrit." };
  }
  if (!cleConfiguree) {
    return { ok: false, erreur: "ANTHROPIC_API_KEY n’est pas configurée sur ce serveur : génération impossible." };
  }

  const libelleCible = cible === "toutes" ? "l’ensemble" : cible === "tweet" ? "le tweet long" : `la slide ${slide.numero} (« ${slide.libelle} »)`;
  const resultat = await generer(contenu, {
    candidatNom: proposition.candidat.nom,
    score: analyse.scoreFaisabilite,
    propositionId,
    motsClesIllustration: motsClesDisponibles(proposition.theme),
    remarques: { precedent, remarque: texteRemarque, cible, libelleCible },
  });
  const cout = resultat.cout;
  const base = { remarque: texteRemarque, cible, slide, cout };

  if (!resultat.recit) {
    const retour = entreeRetour({ ...base, resultat: "refusée", details: resultat.errors ?? [] });
    const { ecrit } = await ecrire({ prisma, analyse, contenu, contenuNouveau: contenuAvecRetour(contenu, retour), sauvegarder });
    const raisons = resultat.errors?.length ? resultat.errors.join(" ; ") : "raison inconnue";
    return {
      ok: false,
      erreur: `Régénération refusée après deux essais : le carrousel ne change pas. ${raisons}${ecrit ? " (Remarque gardée au journal.)" : ""}`,
      cout,
    };
  }

  // Image de thème : gardée, sauf si la couverture (ou tout) est réécrite.
  const changeImage = cible === "toutes" || cible === "couverture";
  const illustration = changeImage ? await illustrationRetenue({ proposition, recit: resultat.recit, derniereIllustration }) : precedent.illustration;
  const recit = { ...resultat.recit, ...(illustration ? { illustration } : {}) };
  const retour = entreeRetour({ ...base, resultat: "acceptée", details: resultat.avertissements ?? [] });
  const { ecrit, sauvegarde } = await ecrire({ prisma, analyse, contenu, contenuNouveau: contenuAvecRecit(contenu, recit, retour), sauvegarder });
  if (!ecrit) return { ok: false, erreur: "La fiche a été modifiée pendant la génération : rien n’est écrit. Recommencez.", cout };
  return {
    ok: true,
    message: `Carrousel régénéré pour ${libelleCible} ; la version d’avant est gardée comme version précédente.`,
    cout,
    avertissements: resultat.avertissements ?? [],
    sauvegarde,
  };
}

// « Revenir à la version précédente » : échange la version actuelle et la
// précédente (sans appel, sans coût), noté au journal.
export async function revenirAuPrecedentCore(propositionId, { brouillon, isEditor, prisma, sauvegarder }) {
  const fiche = await cibleFiche(propositionId, { brouillon, isEditor, prisma });
  if (fiche.erreur) return fiche.erreur;
  const { analyse } = fiche;
  const contenu = analyse.contenuComplet ?? {};
  const retour = entreeRetour({ remarque: "", cible: "toutes", resultat: "retour à la version précédente" });
  const contenuNouveau = contenuRevenuAuPrecedent(contenu, retour);
  if (!contenuNouveau) return { ok: false, erreur: "Pas de version précédente." };
  const { ecrit, sauvegarde } = await ecrire({ prisma, analyse, contenu, contenuNouveau, sauvegarder });
  if (!ecrit) return { ok: false, erreur: "La fiche a été modifiée entre-temps : rien n’est écrit. Rechargez la page." };
  return { ok: true, message: "Version précédente rétablie (l’autre devient la version précédente).", sauvegarde };
}
