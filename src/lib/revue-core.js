// Revue du dimanche (Club ouvert, lot 4) : logique PURE, sans base ni réseau,
// partagée par le robot (scripts/revue-dimanche.js) et la page admin
// (/test/revue). Testée par scripts/revue-core.test.js.
//
// Rappels :
//   - toutes les tables de la revue sont écrites par AJOUT seulement : le tri
//     le plus récent d'une annotation fait foi (dernierTri) ;
//   - seule la catégorie « argument_ou_source » déclenche une révision ;
//   - rien n'est publié sans qu'Arno tape « oui » (confirmationValide).

import { PREFIXE_FICHE, propositionDuSlug } from "./fiche-annotations-core.js";

export const CATEGORIES = {
  hors_sujet: "Hors sujet ou abusif",
  question: "Question",
  desaccord_sans_argument: "Désaccord sans argument ni source",
  argument_ou_source: "Argument ou source pouvant changer l'analyse",
};
export const CATEGORIE_REVISION = "argument_ou_source";
export const SOURCES_TRI = ["modele", "arno"];
export const REPONSE_MAX = 2000;
export const JUSTIFICATION_MAX = 400;

export function categorieValide(categorie) {
  return typeof categorie === "string" && Object.hasOwn(CATEGORIES, categorie);
}

// Tri qui fait foi : le plus récent (date, puis id en cas d'égalité).
export function dernierTri(tris) {
  if (!Array.isArray(tris) || tris.length === 0) return null;
  return tris.reduce((dernier, t) => {
    const a = new Date(dernier.createdAt).getTime();
    const b = new Date(t.createdAt).getTime();
    return b > a || (b === a && t.id > dernier.id) ? t : dernier;
  });
}

// --- Heure de Paris ------------------------------------------------------------

// { jour: 0 (dimanche) … 6, heure: 0…23 } à Paris, quel que soit le fuseau de la machine.
export function heureParis(date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris",
    weekday: "short",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const jours = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    jour: jours[parts.find((p) => p.type === "weekday").value],
    heure: Number(parts.find((p) => p.type === "hour").value),
  };
}

// Le workflow GitHub est programmé à 6 h et à 7 h UTC le dimanche (GitHub ne
// connaît que l'UTC) : seul le passage qui tombe à 8 h à Paris travaille,
// l'autre s'arrête aussitôt. Couvre l'heure d'été (6 h UTC) et d'hiver (7 h UTC).
export function estHeureRevue(date) {
  const { jour, heure } = heureParis(date);
  return jour === 0 && heure === 8;
}

// --- Sélection des annotations ------------------------------------------------

// Annotations de fiches publiées à trier : créées avant la clôture, jamais
// triées (aucun TriAnnotation), éventuellement limitées à une fiche (urgence).
// annotations : [{ id, ficheSlug, createdAt, tris: [...] }]
export function annotationsATrier(annotations, { cloture, propositionId = null }) {
  const limite = new Date(cloture).getTime();
  return annotations.filter((a) => {
    if (typeof a.ficheSlug !== "string" || !a.ficheSlug.startsWith(PREFIXE_FICHE)) return false;
    const fiche = propositionDuSlug(a.ficheSlug);
    if (!fiche || (propositionId != null && fiche !== propositionId)) return false;
    if (new Date(a.createdAt).getTime() >= limite) return false;
    return !Array.isArray(a.tris) || a.tris.length === 0;
  });
}

// Fiches à réviser : au moins une annotation dont le tri qui fait foi est
// « argument_ou_source ». Renvoie Map propositionId → [annotations retenues].
// annotations : [{ id, ficheSlug, tris: [...] }]
export function fichesAReviser(annotations) {
  const fiches = new Map();
  for (const a of annotations) {
    if (dernierTri(a.tris)?.categorie !== CATEGORIE_REVISION) continue;
    const id = propositionDuSlug(a.ficheSlug);
    if (!id) continue;
    if (!fiches.has(id)) fiches.set(id, []);
    fiches.get(id).push(a);
  }
  return fiches;
}

// --- Réponse du modèle au tri --------------------------------------------------

// Schéma de sortie structurée du tri (output_config.format).
export const SCHEMA_TRI = {
  type: "object",
  additionalProperties: false,
  required: ["categorie", "justification", "reponse"],
  properties: {
    categorie: { type: "string", enum: Object.keys(CATEGORIES) },
    justification: { type: "string" },
    reponse: { type: "string" },
  },
};

// Texte JSON renvoyé par le tri → { tri } ou { error }.
export function lireTri(texte) {
  let brut;
  try {
    brut = JSON.parse(texte);
  } catch {
    return { error: "réponse illisible (JSON invalide)" };
  }
  if (!categorieValide(brut?.categorie)) return { error: `catégorie inconnue : ${brut?.categorie}` };
  const justification = typeof brut.justification === "string" ? brut.justification.trim().slice(0, JUSTIFICATION_MAX) : "";
  const reponse = typeof brut.reponse === "string" ? brut.reponse.trim().slice(0, REPONSE_MAX) : "";
  return { tri: { categorie: brut.categorie, justification: justification || null, reponse: reponse || null } };
}

// --- Validation d'Arno ---------------------------------------------------------

// Rien n'est publié sans « oui » tapé à la main (espaces et casse tolérés).
export function confirmationValide(saisie) {
  return typeof saisie === "string" && saisie.trim().toLowerCase() === "oui";
}

// Décision qui fait foi pour une révision proposée (la plus récente), ou null.
export function derniereDecision(decisions) {
  return dernierTri(decisions);
}

// --- Nouvelle version publiée ---------------------------------------------------

// Même mise à plat que scripts/analyze.js (toText) pour les colonnes texte.
export function enTexte(valeur) {
  if (valeur && typeof valeur === "object" && !Array.isArray(valeur) && "texte" in valeur) return enTexte(valeur.texte);
  if (Array.isArray(valeur)) return valeur.map((item) => `• ${item}`).join("\n");
  return typeof valeur === "string" ? valeur : "";
}

// Données de la nouvelle Analyse créée à la publication d'une révision : les
// colonnes sont recalculées depuis le contenu proposé (dont le score a été
// calculé par le code), le reste est repris de la version source.
// Lève une erreur si le contenu n'a pas de score exploitable.
export function donneesNouvelleVersion(source, contenu, coutPipeline = null) {
  const n = contenu?.notation_detaillee;
  if (!n || !Number.isInteger(n.score_total)) throw new Error("Contenu proposé sans score_total.");
  const texteOu = (valeur, defaut) => {
    const t = enTexte(valeur);
    return t || defaut;
  };
  return {
    propositionId: source.propositionId,
    scoreFaisabilite: n.score_total,
    scoreSolidite: n.degre_preparation ?? source.scoreSolidite,
    scoreJuridique: n.operationnalite_juridique ?? source.scoreJuridique,
    scoreOperationnel: n.operationnalite_moyens_total ?? source.scoreOperationnel,
    scoreBudgetaire: n.operationnalite_budgetaire ?? source.scoreBudgetaire,
    scorePertinence: n.efficacite ?? source.scorePertinence,
    verdict: texteOu(contenu.verdict_final, source.verdict),
    resumeAccueil: typeof contenu.teaser_accueil === "string" && contenu.teaser_accueil.trim() ? contenu.teaser_accueil.trim() : source.resumeAccueil,
    teaser: source.teaser,
    cequiEstEtabli: texteOu(contenu.ce_qui_est_etabli, source.cequiEstEtabli),
    cequiEstProbable: texteOu(contenu.ce_qui_est_probable, source.cequiEstProbable),
    cequiEstDiscutable: texteOu(contenu.ce_qui_est_discutable, source.cequiEstDiscutable),
    cequiEstInconnu: texteOu(contenu.ce_qui_est_inconnu, source.cequiEstInconnu),
    sourcesUtilisees: texteOu(contenu.sources_utilisees, source.sourcesUtilisees),
    statut: "publie",
    versionMethodologie: source.versionMethodologie,
    promptFileModifiedAt: source.promptFileModifiedAt,
    contenuComplet: contenu,
    coutPipeline,
  };
}
