import { z } from "zod";
import {
  LONGUEUR_X_MAX,
  MARQUEURS_PAR_TWEET,
  PARTIES_PAR_TWEET,
  appliquerTitreFiche,
  assemblerReseaux,
  budgetsParties,
  longueurX,
  normaliserParties,
  remplirTweet,
  retirerUnPointDuTweet,
  valeursReseaux,
} from "../../src/lib/reseaux.js";

// Barème 2026 du pipeline à 3 étapes (voir data/prompt-methodologie.md) : 5
// critères SANS malus — Opérationnalité & Moyens (30, décomposée en 3
// sous-composantes juridique/budgétaire/moyens humains notées /10 chacune),
// Efficacité (30), Effets rebonds & Externalités (20), Degré de préparation
// (10), Alignement & Logique globale (10). Le système de malus juridique
// bonus-malus (-30..+5, "ajustement_juridique") est entièrement supprimé :
// la dimension juridique est désormais une sous-composante additive de
// l'Opérationnalité & Moyens, avec une RÈGLE DE PLAFOND dédiée (voir
// checkNotationCoherence) plutôt qu'un ajustement séparé du score total.
//
// "L'analyse, les notes, la qualification juridique, l'arbitrage et le
// calcul final restent effectués par les IA. Le code orchestre les appels,
// valide le JSON, gère la résilience et stocke les résultats" (voir en-tête
// de data/prompt-methodologie.md). Ce module ne recalcule donc JAMAIS
// score_total à la place du modèle — il valide uniquement la STRUCTURE
// (types, bornes, énumérations) pour déclencher une réparation ciblée en cas
// de JSON malformé, et expose une vérification de cohérence arithmétique à
// part (checkNotationCoherence) destinée à un simple avertissement en log,
// jamais à une correction silencieuse.

// --- Paliers d'appréciation --------------------------------------------------
// Doit rester synchronisé avec SCORE_BANDS dans src/lib/score.js (même
// barème, deux consommateurs différents : ce fichier valide côté pipeline
// d'analyse, score.js affiche côté site).
export const APPRECIATION_BANDS = [
  { min: 85, max: 100, label: "exemplaire" },
  { min: 70, max: 84, label: "solide et chiffré" },
  { min: 55, max: 69, label: "plausible sous condition" },
  { min: 35, max: 54, label: "partiellement fondé" },
  { min: 20, max: 34, label: "fragile" },
  { min: 0, max: 19, label: "irréaliste" },
];

export function computeAppreciation(scoreTotal) {
  const band =
    APPRECIATION_BANDS.find((entry) => scoreTotal >= entry.min) ??
    APPRECIATION_BANDS[APPRECIATION_BANDS.length - 1];
  return band.label;
}

// --- Qualifications ------------------------------------------------------------
// Chaque critère et sous-critère porte une qualification choisie AVANT la
// note numérique (voir data/prompt-methodologie.md, "BARÈME PRINCIPAL").
const QUALIFICATION = ["SOLIDE", "INCERTAIN", "FRAGILE"];

// --- mesure_vers_objectif (nouveau bloc obligatoire, étape 1 point 1bis) ----
// Liste fermée des 12 domaines couverts par data/objectifs-de-reference.md —
// doit rester synchronisée avec ce document et avec la liste de
// data/prompt-methodologie.md (point 1bis).
export const CATEGORIES_OBJECTIF = [
  "Retraites",
  "Santé",
  "Emploi et chômage",
  "Éducation",
  "Énergie et climat",
  "Logement",
  "Alimentation et agriculture",
  "Fiscalité et pouvoir d'achat",
  "Dette et finances publiques",
  "Immigration",
  "Sécurité et justice",
  "Numérique et intelligence artificielle",
  "Démocratie et institutions",
];

const MesureVersObjectifSchema = z.object({
  objectif_court: z.string().min(1),
  categorie_objectif: z.enum(CATEGORIES_OBJECTIF).nullable(),
  objectif_vise: z.string().min(1),
  mecanisme_propose: z.string().min(1),
  lien_causal: z.enum(["direct", "indirect", "faible_ou_absent"]),
});

// --- notation_detaillee ---------------------------------------------------------
// Sous-composantes de l'Opérationnalité & Moyens (1a/1b/1c), chacune 0-10.
const PLAFOND_DECLENCHEURS = ["juridique", "budgetaire", "moyens_humains"];

export const NotationDetailleeSchema = z.object({
  operationnalite_juridique: z.number().int().min(0).max(10),
  qualification_juridique: z.enum(QUALIFICATION),
  operationnalite_budgetaire: z.number().int().min(0).max(10),
  qualification_budgetaire: z.enum(QUALIFICATION),
  operationnalite_moyens_humains: z.number().int().min(0).max(10),
  qualification_moyens_humains: z.enum(QUALIFICATION),
  operationnalite_moyens_total: z.number().int().min(0).max(30),
  plafond_applique: z.boolean(),
  plafond_declencheur: z.enum(PLAFOND_DECLENCHEURS).nullable(),
  efficacite: z.number().int().min(0).max(30),
  qualification_efficacite: z.enum(QUALIFICATION),
  effets_rebonds_externalites: z.number().int().min(0).max(20),
  qualification_effets_rebonds: z.enum(QUALIFICATION),
  degre_preparation: z.number().int().min(0).max(10),
  qualification_preparation: z.enum(QUALIFICATION),
  alignement_logique: z.number().int().min(0).max(10),
  qualification_alignement: z.enum(QUALIFICATION),
  score_total: z.number().int().min(0).max(100),
  appreciation: z.string().min(1),
});

// Sous-composante la plus basse parmi celles qualifiées FRAGILE (< 3/10) —
// c'est celle-là que plafond_declencheur doit identifier en cas d'égalité
// ou de FRAGILE multiples (voir CALCUL, étape 2, dans
// data/prompt-methodologie.md : "si plusieurs sous-composantes sont
// FRAGILE, indiquer celle dont le score est le plus bas").
function computePlafondDeclencheurAttendu({
  operationnalite_juridique,
  operationnalite_budgetaire,
  operationnalite_moyens_humains,
}) {
  const sousComposantes = [
    { nom: "juridique", note: operationnalite_juridique },
    { nom: "budgetaire", note: operationnalite_budgetaire },
    { nom: "moyens_humains", note: operationnalite_moyens_humains },
  ];
  const fragiles = sousComposantes.filter((item) => item.note < 3);
  if (fragiles.length === 0) return null;
  return fragiles.reduce((lowest, item) => (item.note < lowest.note ? item : lowest)).nom;
}

// Revérifie la cohérence arithmétique de notation_detaillee (CALCUL, voir
// data/prompt-methodologie.md) sans jamais écraser les valeurs produites
// par le modèle — voir l'en-tête de ce fichier. Retourne une liste d'écarts
// destinée uniquement à un log d'avertissement côté appelant (le message
// "INCOHÉRENCE DE CALCUL DÉTECTÉE" est affiché par l'appelant, voir
// scripts/analyze.js, warnNotationCoherence).
export function checkNotationCoherence(notation) {
  const errors = [];
  const {
    operationnalite_juridique,
    operationnalite_budgetaire,
    operationnalite_moyens_humains,
    operationnalite_moyens_total,
    plafond_applique,
    plafond_declencheur,
    efficacite,
    effets_rebonds_externalites,
    degre_preparation,
    alignement_logique,
    score_total,
  } = notation;

  // 1. operationnalite_moyens_total = somme des 3 sous-composantes
  const sousTotal = operationnalite_juridique + operationnalite_budgetaire + operationnalite_moyens_humains;

  // 2. RÈGLE DE PLAFOND
  const declencheurAttendu = computePlafondDeclencheurAttendu(notation);
  const plafondAppliqueAttendu = declencheurAttendu !== null;
  const totalOperationnaliteAttendu = plafondAppliqueAttendu ? Math.min(sousTotal, 10) : sousTotal;

  if (totalOperationnaliteAttendu !== operationnalite_moyens_total) {
    errors.push(
      `operationnalite_moyens_total incohérent : attendu ${totalOperationnaliteAttendu} (somme ${sousTotal}${plafondAppliqueAttendu ? ", plafonnée à 10 (règle de plafond)" : ""}), trouvé ${operationnalite_moyens_total}.`,
    );
  }
  if (plafondAppliqueAttendu !== plafond_applique) {
    errors.push(
      `plafond_applique incohérent : attendu ${plafondAppliqueAttendu} (sous-composante(s) FRAGILE : juridique=${operationnalite_juridique}, budgetaire=${operationnalite_budgetaire}, moyens_humains=${operationnalite_moyens_humains}), trouvé ${plafond_applique}.`,
    );
  }
  if (declencheurAttendu !== plafond_declencheur) {
    errors.push(
      `plafond_declencheur incohérent : attendu ${JSON.stringify(declencheurAttendu)}, trouvé ${JSON.stringify(plafond_declencheur)}.`,
    );
  }

  // 3. score_total = clamp(somme des 5 critères, 0, 100)
  const scoreAttendu = Math.max(
    0,
    Math.min(
      100,
      operationnalite_moyens_total + efficacite + effets_rebonds_externalites + degre_preparation + alignement_logique,
    ),
  );
  if (scoreAttendu !== score_total) {
    errors.push(
      `score_total incohérent : attendu ${scoreAttendu} (clamp(operationnalite_moyens_total + efficacite + effets_rebonds_externalites + degre_preparation + alignement_logique, 0, 100)), trouvé ${score_total}.`,
    );
  }

  const appreciationAttendue = computeAppreciation(score_total);
  if (notation.appreciation && notation.appreciation.toLowerCase() !== appreciationAttendue) {
    errors.push(
      `appreciation incohérente : score_total=${score_total} implique "${appreciationAttendue}", trouvé "${notation.appreciation}".`,
    );
  }

  return errors;
}

// --- Schémas étape 1 / fiche_complete (étape 3) -------------------------------
// Champs texte libre : parfois renvoyés en tableau de points par le modèle
// malgré la consigne — cf. toText() dans analyze.js, permissif ici aussi.
const TextOrArray = z.union([z.string(), z.array(z.string())]);

// Sections en accordéon (voir data/prompt-methodologie.md, "SECTIONS EN
// ACCORDÉON") : synthese = une phrase (≤20 mots visés côté prompt, 220
// caractères en garde-fou structurel ici — le prompt gère la longueur en
// mots, ce schéma ne fait que borner un excès manifeste), texte = contenu
// complet inchangé (toujours permissif chaîne/tableau, cf. TextOrArray).
const AccordionSectionSchema = z.object({
  synthese: z.string().min(1).max(220),
  texte: TextOrArray,
});

// Champs communs à l'étape 1 et à fiche_complete (étape 3, après arbitrage)
// — voir "FORMAT ÉTAPE 1 — JSON STRICT" dans data/prompt-methodologie.md.
// N'inclut PAS analyse_par_criteres (forme différente selon l'étape, voir
// plus bas) ni resume_court/phrase_teasing (absents de fiche_complete).
//
// impact_environnement et impact_temporel_et_sectoriel restent les deux
// seuls champs nullable de ce groupe (objet entier `null` si non
// applicable) — tous les autres, y compris contexte_programme/national/
// international qui l'étaient dans l'ancien format texte libre, sont
// désormais requis sous forme d'objet {synthese, texte} (voir la demande
// d'origine : seuls impact_environnement et impact_temporel_et_sectoriel
// sont annotés "si non null").
const champsCommunsEtape1 = {
  mesure_reformulee: AccordionSectionSchema,
  mesure_vers_objectif: MesureVersObjectifSchema,
  nature_et_existant: z.string().min(1),
  contexte_programme: AccordionSectionSchema,
  contexte_national: AccordionSectionSchema,
  contexte_international: AccordionSectionSchema,
  impact_environnement: AccordionSectionSchema.nullable(),
  analyse_longevites: AccordionSectionSchema,
  impact_temporel_et_sectoriel: AccordionSectionSchema.nullable(),
  ce_qui_est_etabli: AccordionSectionSchema,
  ce_qui_est_probable: AccordionSectionSchema,
  ce_qui_est_discutable: AccordionSectionSchema,
  ce_qui_est_inconnu: AccordionSectionSchema,
  angles_morts: AccordionSectionSchema,
  notation_detaillee: NotationDetailleeSchema,
  verdict_final: z.string().min(1),
  sources_utilisees: z.array(z.any()),
  niveau_de_confiance: z.string().min(1),
  limites: AccordionSectionSchema,
};

// Étape 1 : analyse_par_criteres est un texte libre unique (voir FORMAT
// ÉTAPE 1 — JSON STRICT : "analyse_par_criteres": "..."). Restructuré en
// tableau de 5 objets seulement après arbitrage, à l'étape 3.
export const AnalyseEtape1Schema = z
  .object({
    ...champsCommunsEtape1,
    analyse_par_criteres: z.string().min(1),
    resume_court: z.string().min(1),
    phrase_teasing: z.string().min(1),
  })
  .passthrough();

export function validateEtape1Structure(raw) {
  const zodResult = AnalyseEtape1Schema.safeParse(raw);
  if (!zodResult.success) {
    return {
      valid: false,
      errors: zodResult.error.issues.map((issue) => `${issue.path.join(".") || "(racine)"}: ${issue.message}`),
      analyse: null,
    };
  }
  return { valid: true, errors: [], analyse: zodResult.data };
}

// Étape 3 (arbitrage + rédaction) : analyse_par_criteres devient un tableau
// de 5 objets, un par critère du barème (voir "FORMAT ÉTAPE 3 — JSON
// STRICT"), avec un note_max PROPRE à chaque critère (30/30/20/10/10) —
// plus un barème uniforme /25 comme dans l'ancien schéma. Seul l'objet
// "operationnalite_moyens" porte plafond_applique/plafond_declencheur (les
// 4 autres ne les incluent pas, voir le gabarit).
export const CRITERE_ETAPE3_KEYS = [
  "operationnalite_moyens",
  "efficacite",
  "effets_rebonds_externalites",
  "degre_preparation",
  "alignement_logique",
];

export const CRITERE_NOTE_MAX = {
  operationnalite_moyens: 30,
  efficacite: 30,
  effets_rebonds_externalites: 20,
  degre_preparation: 10,
  alignement_logique: 10,
};

const CritereEtape3Schema = z
  .object({
    critere: z.enum(CRITERE_ETAPE3_KEYS),
    titre: z.string().min(1),
    note: z.number().int().min(0).max(30).nullable(),
    note_max: z.number().int(),
    plafond_applique: z.boolean().optional(),
    plafond_declencheur: z.enum(PLAFOND_DECLENCHEURS).nullable().optional(),
    texte: z.string().min(1),
  })
  .refine((item) => item.note_max === CRITERE_NOTE_MAX[item.critere], (item) => ({
    message: `note_max (${item.note_max}) ne correspond pas au barème attendu pour "${item.critere}" (${CRITERE_NOTE_MAX[item.critere]}).`,
  }))
  .refine((item) => item.note === null || item.note <= item.note_max, (item) => ({
    message: `note (${item.note}) dépasse note_max (${item.note_max}) pour "${item.critere}".`,
  }));

const AnalyseParCriteresEtape3Schema = z
  .array(CritereEtape3Schema)
  .length(5, "analyse_par_criteres (étape 3) doit contenir exactement 5 objets, un par critère du barème.")
  .refine(
    (items) => {
      const seen = new Set(items.map((item) => item.critere));
      return seen.size === 5 && CRITERE_ETAPE3_KEYS.every((key) => seen.has(key));
    },
    {
      message: "analyse_par_criteres (étape 3) doit contenir exactement les 5 critères du barème, sans doublon.",
    },
  );

export const FicheCompleteSchema = z
  .object({
    ...champsCommunsEtape1,
    analyse_par_criteres: AnalyseParCriteresEtape3Schema,
    // Phrase de synthèse courte du verdict (MISE EN TEXTE FINALE, voir
    // data/prompt-methodologie.md) — optionnel : absente des fiches produites
    // avant son introduction, jamais rendue obligatoire ici pour ne pas
    // bloquer l'écriture automatique tant que le prompt ne la fournit pas.
    verdict_conclusion: z.string().min(1).optional(),
  })
  .passthrough();

export function validateFicheCompleteStructure(raw) {
  const zodResult = FicheCompleteSchema.safeParse(raw);
  if (!zodResult.success) {
    return {
      valid: false,
      errors: zodResult.error.issues.map((issue) => `${issue.path.join(".") || "(racine)"}: ${issue.message}`),
      fiche: null,
    };
  }
  return { valid: true, errors: [], fiche: zodResult.data };
}

// --- Commentaires du Club (relecture) -------------------------------------------
// Seulement quand analyze.js reçoit --commentaires (voir les points 6 de
// l'ÉTAPE 2 et 9 de l'ÉTAPE 3 dans data/prompt-methodologie.md).

const zodErreurs = (error) => error.issues.map((issue) => `${issue.path.join(".") || "(racine)"}: ${issue.message}`);

// Étape 2 (Mistral) : avis sur chaque commentaire. Facultatif : un avis
// invalide est écarté (étape 3 menée comme sans avis Mistral sur les
// commentaires), jamais bloquant.
export const AvisCommentairesEtape2Schema = z.array(
  z
    .object({
      commentaire_id: z.string().min(1),
      type: z.enum(["coherence", "forme", "fait_a_verifier"]),
      fonde: z.enum(["oui", "non", "partiel", "a_verifier"]),
      correction_proposee: z.string().nullable(),
      projet_reponse: z.string().nullable(),
      a_verifier: z.string().nullable(),
    })
    .passthrough(),
);

export function validateAvisCommentairesEtape2(raw) {
  const result = AvisCommentairesEtape2Schema.safeParse(raw);
  return result.success ? { valid: true, errors: [], avis: result.data } : { valid: false, errors: zodErreurs(result.error), avis: null };
}

// Étape 3 (Claude) : revision_relecture, obligatoire si des commentaires ont
// été fournis. Exactement une réponse par commentaire (mêmes commentaire_id).
export const RevisionRelectureSchema = z.object({
  synthese: z.string().trim().min(1),
  reponses: z.array(
    z.object({
      commentaire_id: z.string().min(1),
      reponse: z.string().trim().min(1),
      retenu: z.boolean(),
    }),
  ),
  notes_pour_arno: z.string(),
});

export function validateRevisionRelecture(raw, commentaireIds) {
  const result = RevisionRelectureSchema.safeParse(raw);
  if (!result.success) return { valid: false, errors: zodErreurs(result.error), revision: null };
  const errors = [];
  const vus = result.data.reponses.map((r) => r.commentaire_id);
  const attendus = new Set(commentaireIds);
  const manquants = commentaireIds.filter((id) => !vus.includes(id));
  const inconnus = vus.filter((id) => !attendus.has(id));
  const doublons = vus.filter((id, i) => vus.indexOf(id) !== i);
  if (manquants.length) errors.push(`reponses : aucune réponse pour ${manquants.join(", ")}.`);
  if (inconnus.length) errors.push(`reponses : commentaire_id inconnu(s) ${[...new Set(inconnus)].join(", ")}.`);
  if (doublons.length) errors.push(`reponses : plusieurs réponses pour ${[...new Set(doublons)].join(", ")}.`);
  return errors.length ? { valid: false, errors, revision: null } : { valid: true, errors: [], revision: result.data };
}

// Longueurs maximales de titre_fiche et teaser_accueil (étape 3, sections
// « ### Titre » et « ### Teaser accueil » de data/prompt-methodologie.md) :
// au-delà, la carte « à la une » de l'accueil les coupe. Contrôle NON
// bloquant : renvoie des messages d'avertissement, jamais un refus du JSON.
export const TITRE_FICHE_MAX = 35;
export const TEASER_ACCUEIL_MAX = 200;

export function checkLongueursAccueil({ titre_fiche: titre, teaser_accueil: teaser } = {}) {
  const avertissements = [];
  if (typeof titre === "string" && titre.trim().length > TITRE_FICHE_MAX) {
    avertissements.push(
      `titre_fiche trop long : ${titre.trim().length} caractères (maximum ${TITRE_FICHE_MAX}) — « ${titre.trim()} »`,
    );
  }
  if (typeof teaser === "string" && teaser.trim().length > TEASER_ACCUEIL_MAX) {
    avertissements.push(
      `teaser_accueil trop long : ${teaser.trim().length} caractères (maximum ${TEASER_ACCUEIL_MAX}) — « ${teaser.trim()} »`,
    );
  }
  return avertissements;
}

// --- Version basique (étape 3 bis) -----------------------------------------
// Texte simplifié pour le grand public, produit à partir de la fiche finale
// (voir data/prompt-version-basique.md). sources_principales désigne 3
// entrées de sources_utilisees par leur index, jamais par leur texte.
const PointsSchema = z.array(z.string().min(1)).min(2).max(5);

export const VersionBasiqueSchema = z.object({
  resume: z.string().min(1),
  contexte: z.string().min(1),
  analyse: z.string().min(1),
  points_forts: PointsSchema,
  points_faibles: PointsSchema,
  faisabilite: z.string().min(1),
  sources_principales: z.array(z.number().int()).length(3),
});

export function validateVersionBasique(raw, sourcesUtilisees) {
  const zodResult = VersionBasiqueSchema.safeParse(raw);
  if (!zodResult.success) {
    return {
      valid: false,
      errors: zodResult.error.issues.map((issue) => `${issue.path.join(".") || "(racine)"}: ${issue.message}`),
      versionBasique: null,
    };
  }

  const nbSources = Array.isArray(sourcesUtilisees) ? sourcesUtilisees.length : 0;
  const indexes = zodResult.data.sources_principales;
  const errors = [];
  if (new Set(indexes).size !== indexes.length) {
    errors.push(`sources_principales: les 3 index doivent être distincts (reçu ${JSON.stringify(indexes)}).`);
  }
  for (const index of indexes) {
    if (index < 0 || index >= nbSources) {
      errors.push(`sources_principales: index ${index} hors limites (sources_utilisees contient ${nbSources} entrée(s), index 0 à ${nbSources - 1}).`);
    }
  }
  if (errors.length > 0) return { valid: false, errors, versionBasique: null };

  return { valid: true, errors: [], versionBasique: zodResult.data };
}

// Contrôle de fidélité : tout nombre écrit dans la version basique doit
// figurer dans la fiche finale. Les espaces (y compris insécables et fines)
// servant de séparateurs de milliers sont retirés des deux côtés avant
// comparaison ; la virgule décimale est conservée telle quelle. Ne contrôle
// pas les arrondis en toutes lettres (« plus d'un tiers »), laissés au prompt
// et à la relecture.
// Le même découpage est appliqué aux deux textes : « fin 2021 560 000 »
// donne bien « 2021 » et « 560000 », jamais « 2021560000 ». Comparer des
// nombres entiers (et non des sous-chaînes) évite aussi de trouver « 200 »
// dans « 2000 » ou « 1,8 » dans « 1,85 ».
const NOMBRE_REGEX = /\d{1,3}(?:[   ]\d{3})+(?:,\d+)?|\d+(?:,\d+)?/g;

function extraireNombres(text) {
  return [...text.matchAll(NOMBRE_REGEX)].map((match) => match[0].replace(/[   ]/g, ""));
}

// Nombres des textes absents de la fiche finale (même règle pour la version
// basique et les publications X).
function nombresHorsFiche(textes, ficheFinale) {
  const nombres = new Set(textes.filter((texte) => typeof texte === "string").flatMap(extraireNombres));
  const reference = new Set(extraireNombres(JSON.stringify(ficheFinale)));
  return [...nombres].filter((nombre) => !reference.has(nombre));
}

export function checkChiffresVersionBasique(versionBasique, ficheFinale) {
  return nombresHorsFiche(
    [
      versionBasique.resume,
      versionBasique.contexte,
      versionBasique.analyse,
      versionBasique.faisabilite,
      ...(versionBasique.points_forts ?? []),
      ...(versionBasique.points_faibles ?? []),
    ],
    ficheFinale,
  );
}

// Contrôle des ancrages : chaque phrase de la version basique est justifiée
// par un extrait copié mot pour mot de la fiche (voir « ancrages » dans
// data/prompt-version-basique.md). Les ancrages restent un contrôle interne,
// jamais publiés dans contenuComplet.
function normaliserPassage(text) {
  return text
    .replace(/\*\*/g, "")
    .replace(/’/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// Toutes les chaînes de la fiche, séparées par un caractère qui ne peut pas
// figurer dans un extrait : un extrait ne peut donc pas chevaucher deux champs.
function collecterChaines(value, acc = []) {
  if (typeof value === "string") acc.push(value);
  else if (Array.isArray(value)) value.forEach((item) => collecterChaines(item, acc));
  else if (value && typeof value === "object") Object.values(value).forEach((item) => collecterChaines(item, acc));
  return acc;
}

export function checkAncragesVersionBasique(ancrages, versionBasique, ficheFinale) {
  if (!Array.isArray(ancrages) || ancrages.length === 0) {
    return ["ancrages: doit être un tableau non vide d'objets { texte, extrait }."];
  }

  const errors = [];
  const valides = [];
  ancrages.forEach((ancrage, index) => {
    if (
      !ancrage ||
      typeof ancrage.texte !== "string" ||
      typeof ancrage.extrait !== "string" ||
      !ancrage.texte.trim() ||
      !ancrage.extrait.trim()
    ) {
      errors.push(`ancrages.${index}: doit être un objet { texte, extrait } avec deux chaînes non vides.`);
    } else {
      valides.push(ancrage);
    }
  });

  const fiche = collecterChaines(ficheFinale).map(normaliserPassage).join("\u0000");
  for (const ancrage of valides) {
    if (!fiche.includes(normaliserPassage(ancrage.extrait))) {
      errors.push(`L'extrait « ${ancrage.extrait} » (pour « ${ancrage.texte} ») ne figure pas mot pour mot dans la fiche.`);
    }
  }

  const textesAncres = new Set(valides.map((ancrage) => normaliserPassage(ancrage.texte)));
  for (const [champ, points] of [
    ["points_forts", versionBasique.points_forts ?? []],
    ["points_faibles", versionBasique.points_faibles ?? []],
  ]) {
    for (const point of points) {
      if (!textesAncres.has(normaliserPassage(point))) {
        errors.push(`${champ} : le point « ${point} » n'a aucun ancrage dont le texte lui est égal.`);
      }
    }
  }

  return errors;
}

// Souplesse des ancrages (24/10/2026, demande d'Arno après la fiche Le Pen
// « agences et intercos », publiée sans version basique parce que l'extrait
// cité était reformulé trois fois de suite) : une reformulation n'est pas
// grave pour la version basique. Seuls les problèmes de STRUCTURE des ancrages
// (tableau absent ou vide, objet { texte, extrait } mal formé) restent
// bloquants ; un extrait qui ne figure pas mot pour mot dans la fiche, ou un
// point sans ancrage au texte identique, devient un simple avertissement,
// gardé dans l'audit interne. Les chiffres absents de la fiche restent
// bloquants (checkChiffresVersionBasique) : un nombre inventé n'est pas une
// reformulation.
export function separerProblemesAncrages(problemes) {
  const bloquants = [];
  const avertissements = [];
  for (const probleme of problemes ?? []) {
    if (/^ancrages(\.\d+)?:/.test(probleme)) bloquants.push(probleme);
    else avertissements.push(probleme);
  }
  return { bloquants, avertissements };
}

// Réparation des extraits presque exacts (19/10/2026, fiche Attal « Constitution
// du travail » : un seul mot ajouté, « déjà », avait fait rejeter toute la
// version basique). Un extrait qui ne figure pas mot pour mot dans la fiche est
// remplacé par le passage de la fiche le plus proche, à condition que l'écart
// soit minime : au plus 2 mots, ou 15 % des mots de l'extrait s'il est long
// (mots ajoutés, retirés ou changés), et un extrait d'au moins 6 mots. Le
// passage retenu est copié de la fiche (forme normalisée, celle que compare
// checkAncragesVersionBasique) : le contrôle mot pour mot reste donc la règle,
// seule la citation est corrigée, jamais la phrase de la version basique.
// Retourne { ancrages, reparations } ; ancrages est une copie.
const REPARATION_MOTS_MIN = 6;

function ecartMots(a, b, max) {
  // Distance d'édition au niveau des mots, arrêtée dès qu'elle dépasse max.
  let precedente = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const courante = [i];
    let minLigne = i;
    for (let j = 1; j <= b.length; j++) {
      const cout = a[i - 1] === b[j - 1] ? 0 : 1;
      courante[j] = Math.min(precedente[j] + 1, courante[j - 1] + 1, precedente[j - 1] + cout);
      if (courante[j] < minLigne) minLigne = courante[j];
    }
    if (minLigne > max) return max + 1;
    precedente = courante;
  }
  return precedente[b.length];
}

// Mot sans la ponctuation qui lui est collée, pour la comparaison seulement :
// le passage retenu garde la ponctuation de la fiche.
const cleMot = (mot) => mot.replace(/^[«»"'(\[]+|[«»"')\].,;:!?]+$/g, "");

function passageLePlusProche(extrait, champs) {
  const mots = extrait.split(" ").map(cleMot);
  const n = mots.length;
  if (n < REPARATION_MOTS_MIN) return null;
  const tolerance = Math.max(2, Math.floor(n * 0.15));
  const debut = new Set(mots.slice(0, tolerance + 1));
  let meilleur = null;
  for (const champ of champs) {
    const motsChamp = champ.split(" ");
    const cles = motsChamp.map(cleMot);
    for (let i = 0; i < motsChamp.length; i++) {
      // Un passage proche commence forcément par l'un des premiers mots de l'extrait.
      if (!debut.has(cles[i])) continue;
      for (let taille = Math.max(1, n - tolerance); taille <= n + tolerance; taille++) {
        if (i + taille > motsChamp.length) break;
        const ecart = ecartMots(mots, cles.slice(i, i + taille), meilleur ? meilleur.ecart - 1 : tolerance);
        if (ecart <= tolerance && (!meilleur || ecart < meilleur.ecart)) {
          meilleur = { passage: motsChamp.slice(i, i + taille).join(" "), ecart };
          if (ecart === 1) return meilleur;
        }
      }
    }
  }
  return meilleur;
}

export function reparerAncrages(ancrages, ficheFinale) {
  if (!Array.isArray(ancrages)) return { ancrages, reparations: [] };
  const champs = collecterChaines(ficheFinale).map(normaliserPassage);
  const fiche = champs.join("\u0000");
  const reparations = [];
  const repares = ancrages.map((ancrage) => {
    if (!ancrage || typeof ancrage.extrait !== "string" || !ancrage.extrait.trim()) return ancrage;
    const extrait = normaliserPassage(ancrage.extrait);
    if (fiche.includes(extrait)) return ancrage;
    const proche = passageLePlusProche(extrait, champs);
    if (!proche) return ancrage;
    reparations.push({ texte: ancrage.texte, avant: ancrage.extrait, apres: proche.passage, ecart: proche.ecart });
    return { ...ancrage, extrait: proche.passage };
  });
  return { ancrages: repares, reparations };
}

// --- Publications X (étape 3 ter) ------------------------------------------
// Trois formats rédigés à partir de la fiche finale (voir
// data/prompt-reseaux.md), enregistrés dans contenuComplet.reseaux AVEC leurs
// marqueurs : le score, l'appréciation, le compte X du candidat et le lien
// sont insérés par le code à l'affichage (src/lib/reseaux.js).
const TexteReseaux = z.string().trim().min(1);

export const ReseauxSchema = z.object({
  fil: z.array(TexteReseaux).length(4),
  chiffre: z.object({
    valeur: TexteReseaux.max(12),
    explication: TexteReseaux,
    tweet: TexteReseaux,
  }),
  tient: z.object({
    titre: TexteReseaux,
    // « S'il n'y a qu'un seul point solide, n'en invente pas un second. »
    tient: z.array(TexteReseaux).min(1).max(3),
    tient_pas: z.array(TexteReseaux).min(2).max(3),
    // Versions courtes de chaque point (tweet), dans le même ordre ; absentes
    // des sorties antérieures à leur introduction.
    tient_court: z.array(TexteReseaux).optional(),
    tient_pas_court: z.array(TexteReseaux).optional(),
    // Titre de la fiche (« fiche ») ou du modèle (« modele ») ; points retirés
    // du tweet par le repli (voir retirerUnPointDuTweet, src/lib/reseaux.js).
    titre_source: z.enum(["fiche", "modele"]).optional(),
    points_retires: z.number().int().positive().optional(),
    entete_court: z.boolean().optional(),
    tweet: TexteReseaux,
  }),
});

// Les 6 tweets et leurs marqueurs obligatoires (MARQUEURS_PAR_TWEET, src/lib/reseaux.js).
const LECTURE_TWEETS = {
  "fil.0": (r) => r.fil[0],
  "fil.1": (r) => r.fil[1],
  "fil.2": (r) => r.fil[2],
  "fil.3": (r) => r.fil[3],
  "chiffre.tweet": (r) => r.chiffre.tweet,
  "tient.tweet": (r) => r.tient.tweet,
};
const MARQUEURS_TWEETS = Object.entries(MARQUEURS_PAR_TWEET).map(([cle, obligatoires]) => [cle, LECTURE_TWEETS[cle], obligatoires]);

// Consigne ajoutée au prompt par le code : le budget de chaque partie
// variable, calculé pour cette fiche (parties fixes remplies avec le nom ou le
// compte X, l'appréciation et le score réels).
export function consigneBudgets({ candidatNom, score, handles }) {
  const valeurs = valeursReseaux({ candidatNom, score, handles });
  const { "tient.court": courts, ...budgets } = budgetsParties(valeurs);
  return [
    "BUDGETS (calculés par le code pour cette fiche) : nombre maximal de caractères de chaque partie que tu écris, comptés comme le fait X : un emoji, « € », « … » ou « ↓ » comptent 2. Les parties fixes (formules, compte X, note, lien) sont déjà décomptées.",
    `Chaque {NOM} que tu écris compte pour ${longueurX(valeurs.NOM)} caractères (le nom inséré à sa place).`,
    ...Object.entries(budgets).map(([cle, budget]) => `- ${cle} : ${budget} caractères`),
    `- tient : ${courts} caractères au total pour les \`court\` des 2 premiers points de chaque côté (repris dans le tweet)`,
  ].join("\n");
}

// --- Sortie du modèle : parties variables seulement ---------------------------
const PartieTexte = z.string().trim().min(1);

export const PartiesReseauxSchema = z.object({
  fil: z.object({
    accroche: PartieTexte,
    suspense: PartieTexte,
    tweet2: PartieTexte,
    tweet3: PartieTexte,
    angle_mort: PartieTexte,
    point_solide: z.string().trim().nullable().optional(),
  }),
  chiffre: z.object({
    valeur: PartieTexte.max(12),
    explication: PartieTexte,
    mesure_courte: PartieTexte,
  }),
  // Chaque point : `texte` pour l'image (15 mots au plus), `court` pour le
  // tweet (10 mots au plus) ; le tweet reprend les 2 premiers de chaque côté.
  tient: z.object({
    titre: PartieTexte,
    tient: z.array(z.object({ texte: PartieTexte, court: PartieTexte })).min(1).max(3),
    tient_pas: z.array(z.object({ texte: PartieTexte, court: PartieTexte })).min(2).max(3),
    // Posés par le code, jamais par le modèle (conservés entre deux passes).
    titre_source: z.enum(["fiche", "modele"]).optional(),
    dans_le_tweet: z.object({ tient: z.number().int().min(1), tient_pas: z.number().int().min(1) }).optional(),
    entete_court: z.boolean().optional(),
  }),
});

// Valide les parties écrites par le modèle : schéma, puis assemblage par le
// code, repli du tweet « tient » s'il dépasse 280 caractères (quelles que
// soient les autres erreurs), et contrôles bloquants de validateReseaux.
// Renvoie aussi `parties` (normalisées) et `assemble`, même en cas de refus
// (pour le nouvel essai, le raccourcissement et l'affichage) ; chaque tweet
// trop long porte la liste des parties à raccourcir.
export function validatePartiesReseaux(raw, contexte = {}) {
  const zodResult = PartiesReseauxSchema.safeParse(raw);
  if (!zodResult.success) {
    return { valid: false, errors: zodErreurs(zodResult.error), reseaux: null, parties: null, assemble: null, tropLongs: [] };
  }
  // Titre « tient » : celui de la fiche quand il convient (contexte.titreFiche).
  const normalisees = normaliserParties(zodResult.data);
  const avecTitre = "titreFiche" in contexte ? appliquerTitreFiche(normalisees, contexte.titreFiche) : normalisees;
  const parties = replierTweetTient(avecTitre, contexte);
  const assemble = assemblerReseaux(parties);
  const validation = validateReseaux(assemble, contexte);
  return {
    ...validation,
    parties,
    assemble,
    // Valeur du chiffre et titre : aussi sur les images, jamais raccourcis ici.
    tropLongs: validation.tropLongs.map((t) => ({
      ...t,
      parties: PARTIES_PAR_TWEET[t.cle].filter((cle) => !["chiffre.valeur", "tient.titre"].includes(cle)),
    })),
  };
}

// Repli du tweet « tient » tant qu'il dépasse 280 caractères : retirer un point
// du tweet (au moins 1 de chaque côté, l'image les garde), puis, si cela ne
// suffit pas, l'en-tête court (sans « la proposition de »). Sans nom de
// candidat ni score, la longueur ne peut pas être mesurée : rien n'est fait.
function replierTweetTient(parties, { candidatNom, score, handles } = {}) {
  if (!candidatNom || score === undefined) return parties;
  const valeurs = valeursReseaux({ candidatNom, score, handles });
  const longueur = (p) => longueurX(remplirTweet(assemblerReseaux(p).tient.tweet, valeurs));
  let courantes = parties;
  while (longueur(courantes) > LONGUEUR_X_MAX) {
    const replie = retirerUnPointDuTweet(courantes);
    if (!replie) break;
    courantes = replie;
  }
  if (longueur(courantes) > LONGUEUR_X_MAX) courantes = { ...courantes, tient: { ...courantes.tient, entete_court: true } };
  return courantes;
}

// Contrôles BLOQUANTS sur la sortie assemblée de l'étape 3 ter : nombre absent
// de la fiche, tiret cadratin (le JSON invalide est refusé avant, par le
// schéma). Tout le reste n'est qu'un avertissement de relecture
// (avertissementsReseaux, src/lib/reseaux.js), sans refus : tweet de plus de
// 280 caractères (« à raccourcir avant de poster »), candidat non mentionné,
// limites de mots, compte X ou note écrits à la main…
// `candidatNom` et `score` servent à mesurer les tweets une fois les marqueurs
// remplis : les tweets trop longs (tropLongs) déclenchent les passes de
// raccourcissement du pipeline, sans jamais faire refuser la sortie.
export function validateReseaux(raw, { ficheFinale, candidatNom, score, handles } = {}) {
  const zodResult = ReseauxSchema.safeParse(raw);
  if (!zodResult.success) return { valid: false, errors: zodErreurs(zodResult.error), reseaux: null, tropLongs: [] };
  const r = zodResult.data;
  const errors = [];

  const tweets = MARQUEURS_TWEETS.map(([cle, lire]) => [cle, lire(r)]);
  const cartes = textesCartes(r);

  // Tiret cadratin.
  for (const [cle, texte] of [...tweets, ...cartes]) {
    if (texte.includes("—")) errors.push(`${cle} : tiret cadratin interdit.`);
  }

  // Chaque nombre d'un tweet ou d'une image doit figurer dans la fiche finale
  // (marqueurs, « {SCORE}/100 » et numérotation « 2/ » du fil mis à part).
  if (ficheFinale) {
    const textes = [...tweets, ...cartes].map(([, texte]) =>
      texte.replace(/\{SCORE\}\s*\/\s*100/g, " ").replace(/\{[A-Z]+\}/g, " ").replace(/^\s*\d\/\s/, ""),
    );
    for (const nombre of nombresHorsFiche(textes, ficheFinale)) {
      errors.push(`Le nombre « ${nombre} » n'apparaît pas dans la fiche finale : retire-le ou remplace-le par un chiffre de la fiche.`);
    }
  }

  // Longueur X, marqueurs remplis (score, compte X ou nom, lien).
  // tropLongs : { cle, texte, excedent } de chaque tweet trop long, pour le
  // raccourcissement ciblé (raccourcirParties dans scripts/analyze.js).
  const tropLongs = [];
  if (candidatNom && score !== undefined) {
    const valeurs = valeursReseaux({ candidatNom, score, handles });
    for (const [cle, texte] of tweets) {
      const longueur = longueurX(remplirTweet(texte, valeurs));
      if (longueur > LONGUEUR_X_MAX) {
        tropLongs.push({ cle, texte, excedent: longueur - LONGUEUR_X_MAX });
      }
    }
  }

  if (errors.length > 0) return { valid: false, errors, reseaux: null, tropLongs };
  return { valid: true, errors: [], reseaux: r, tropLongs };
}

// Textes des images et versions courtes des points.
function textesCartes(r) {
  return [
    ["chiffre.valeur", r.chiffre.valeur],
    ["chiffre.explication", r.chiffre.explication],
    ["tient.titre", r.tient.titre],
    ...r.tient.tient.map((point, i) => [`tient.tient.${i}`, point]),
    ...r.tient.tient_pas.map((point, i) => [`tient.tient_pas.${i}`, point]),
    ...(r.tient.tient_court ?? []).map((point, i) => [`tient.tient.${i}.court`, point]),
    ...(r.tient.tient_pas_court ?? []).map((point, i) => [`tient.tient_pas.${i}.court`, point]),
  ];
}
