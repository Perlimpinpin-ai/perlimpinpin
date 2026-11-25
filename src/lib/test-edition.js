// Modification de texte d'un brouillon depuis /test/[id] : logique PURE (ni Next,
// ni base de données, aucun import) pour pouvoir la tester avec `node --test`
// (scripts/test-edition.test.js). Utilisable côté serveur ET côté client (le
// formulaire s'en sert pour les limites et le contrôle avant envoi).
// L'action qui écrit vraiment en base est dans src/app/test/actions.js.

// --- Miroir de scripts/analyze.js : à garder identique --------------------
// (scripts/analyze.js est un script CLI : on ne l'importe pas, on en copie
// les deux fonctions de troncature pour dériver Proposition.titre et
// Analyse.teaser EXACTEMENT comme à la génération de l'analyse.)

const TITRE_MAX_LENGTH = 80;

// Coupe au dernier espace avant la limite pour éviter de tronquer en plein
// milieu d'un mot.
export function truncateTitre(text) {
  if (text.length <= TITRE_MAX_LENGTH) return text;
  const truncated = text.slice(0, TITRE_MAX_LENGTH);
  const lastSpace = truncated.lastIndexOf(" ");
  const cut = lastSpace > 40 ? truncated.slice(0, lastSpace) : truncated;
  return `${cut.trimEnd()}…`;
}

const TEASER_MAX_LENGTH = 500;

// Coupe à la dernière phrase complète avant la limite plutôt qu'en plein
// milieu d'un mot.
export function truncateTeaser(text) {
  if (text.length <= TEASER_MAX_LENGTH) return text;
  const truncated = text.slice(0, TEASER_MAX_LENGTH);
  const lastSentenceEnd = Math.max(
    truncated.lastIndexOf(". "),
    truncated.lastIndexOf("? "),
    truncated.lastIndexOf("! "),
  );
  if (lastSentenceEnd > 200) return truncated.slice(0, lastSentenceEnd + 1);
  const lastSpace = truncated.lastIndexOf(" ");
  const cut = lastSpace > 200 ? truncated.slice(0, lastSpace) : truncated;
  return `${cut.trimEnd()}…`;
}

// --- Liste blanche des champs modifiables ----------------------------------
// Seuls ces champs de `contenuComplet` (et deux colonnes de la proposition, en
// fin de liste) peuvent être modifiés. Aucun score ni aucune note n'y figure,
// jamais.
//   min/max        : longueur du texte une fois normalisé
//   multiligne     : false = une seule ligne (titre) ; true = zone de texte
//                    qui grandit avec son contenu
//   unParagraphe   : zone de texte, mais sans retour à la ligne (la fiche
//                    l'affiche en un seul paragraphe)
//   sansGras       : ** refusé (messageSansGras : message propre au champ)
//   aide           : phrase d'aide affichée sous le champ de saisie
//   derives(valeur): colonnes de la base à tenir à jour en même temps, comme le
//                    fait scripts/analyze.js à la génération (titreProposition
//                    -> Proposition.titre, teaser -> Analyse.teaser, verdict ->
//                    Analyse.verdict)
//   chemin         : emplacement dans contenuComplet quand le champ n'est pas à
//                    la racine : tableau de clés, ou fonction (contenu) -> tableau
//                    (ou null si le bloc n'existe pas sur cette fiche)
//   blocAbsent     : message quand le bloc parent n'existe pas sur la fiche
//   type "liste"   : un point par ligne, enregistré en tableau de chaînes
//                    (minPoints à maxPoints points de maxParPoint caractères au plus)
//   type "choix"   : liste déroulante (valeurs de `choix`, ou aucune si `nullable`)
//   coherence(contenu, valeur) : contrôle supplémentaire avec le reste de la
//                    fiche, renvoie un message d'erreur ou null

const sansDerive = () => ({});

// Champs de la version basique (contenuComplet.version_basique, voir
// src/components/VueBasique.js).
function champVersionBasique(sousCle, libelle, type) {
  const limites =
    type === "liste" ? { minPoints: 2, maxPoints: 5, maxParPoint: 160 } : { min: 20, max: 1500 };
  return {
    libelle,
    chemin: ["version_basique", sousCle],
    blocAbsent: "Cette fiche n'a pas de version basique : elle ne peut pas être modifiée.",
    type,
    multiligne: true,
    sansGras: true,
    ...limites,
    derives: sansDerive,
  };
}

// --- Miroir de scripts/lib/scoring.js (CATEGORIES_OBJECTIF) : à garder identique.
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

const AIDE_PARAGRAPHE_GRAS =
  "Un seul paragraphe (pas de retour à la ligne). Entourez un mot de deux étoiles pour le mettre en gras : **mot**";

// Analyse par critères (tableau contenuComplet.analyse_par_criteres) : seul le
// TEXTE d'un critère est modifiable, jamais sa note. Le critère est retrouvé par
// sa clé `critere` (barème 2026 et schémas antérieurs).
export const CRITERES_ANALYSE = {
  operationnalite_moyens: "Opérationnalité & Moyens",
  efficacite: "Efficacité",
  effets_rebonds_externalites: "Effets rebonds & Externalités",
  degre_preparation: "Degré de préparation",
  alignement_logique: "Alignement & Logique globale",
  solidite_factuelle: "Solidité factuelle",
  operationnel: "Faisabilité opérationnelle",
  cout: "Coût et soutenabilité budgétaire",
  juridique_garde_fou: "Faisabilité juridique (garde-fou)",
};

function champCritere(critere, libelle) {
  return {
    libelle: `Analyse — ${libelle}`,
    chemin: (contenu) => {
      const criteres = contenu?.analyse_par_criteres;
      if (!Array.isArray(criteres)) return null;
      const index = criteres.findIndex((item) => estObjet(item) && item.critere === critere);
      return index === -1 ? null : ["analyse_par_criteres", index, "texte"];
    },
    blocAbsent: "Ce critère est introuvable dans l'analyse par critères : il ne peut pas être modifié.",
    multiligne: true,
    unParagraphe: true,
    aide: AIDE_PARAGRAPHE_GRAS,
    min: 20,
    max: 6000,
    derives: sansDerive,
  };
}

// Sections « synthèse + texte » du raisonnement complet et de la fiabilité
// (voir AccordionSection) : la synthèse et le texte se modifient séparément.
export const SECTIONS_ACCORDEON = {
  mesure_reformulee: "Mesure reformulée",
  contexte_programme: "Mise en contexte dans le programme",
  contexte_national: "Contexte national",
  contexte_international: "Contexte international",
  impact_environnement: "Impact environnemental",
  analyse_longevites: "Longévité des effets",
  impact_temporel_et_sectoriel: "Impact temporel et sectoriel",
  ce_qui_est_etabli: "Ce qui est établi",
  ce_qui_est_probable: "Ce qui est probable",
  ce_qui_est_discutable: "Ce qui est discutable",
  ce_qui_est_inconnu: "Ce qui est inconnu",
  angles_morts: "Angles morts et effets de bord",
  limites: "Limites identifiées",
};

function champsSection(section, libelle) {
  const commun = {
    blocAbsent: "Cette section n'existe pas sur cette fiche : elle ne peut pas être modifiée.",
    multiligne: true,
    unParagraphe: true,
    aide: AIDE_PARAGRAPHE_GRAS,
    derives: sansDerive,
  };
  return {
    [`${section}.synthese`]: {
      ...commun,
      libelle: `${libelle} — synthèse`,
      chemin: [section, "synthese"],
      min: 10,
      max: 400,
    },
    [`${section}.texte`]: { ...commun, libelle, chemin: [section, "texte"], min: 20, max: 12000 },
  };
}

// Sources utilisées : la version basique désigne ses sources principales par
// leur position dans cette liste (version_basique.sources_principales).
function coherenceSources(contenu, sources) {
  const principales = contenu?.version_basique?.sources_principales;
  if (!Array.isArray(principales)) return null;
  const plusGrand = Math.max(-1, ...principales.filter(Number.isInteger));
  if (plusGrand >= sources.length) {
    return `La version basique utilise la source n° ${plusGrand + 1} comme source principale : gardez au moins ${plusGrand + 1} sources, dans le même ordre.`;
  }
  return null;
}

export const CHAMPS_EDITABLES = {
  titre_fiche: {
    libelle: "Titre",
    multiligne: false,
    min: 3,
    max: 300,
    derives: (valeur) => ({ titreProposition: truncateTitre(valeur) }),
  },
  resume_court: {
    libelle: "Résumé IA",
    multiligne: true,
    min: 20,
    max: 6000,
    derives: (valeur) => ({ teaser: truncateTeaser(valeur) }),
  },
  "version_basique.resume": champVersionBasique("resume", "Résumé (version basique)", "texte"),
  "version_basique.contexte": champVersionBasique("contexte", "Contexte", "texte"),
  "version_basique.analyse": champVersionBasique("analyse", "Analyse de la proposition", "texte"),
  "version_basique.faisabilite": champVersionBasique("faisabilite", "Faisabilité et mise en œuvre", "texte"),
  "version_basique.points_forts": champVersionBasique("points_forts", "Points forts", "liste"),
  "version_basique.points_faibles": champVersionBasique("points_faibles", "Points faibles", "liste"),
  "mesure_vers_objectif.objectif_court": {
    libelle: "Objectif visé",
    chemin: ["mesure_vers_objectif", "objectif_court"],
    blocAbsent: "Cette fiche n'a pas de bloc « Mesure initiale → Objectif visé ».",
    multiligne: true,
    unParagraphe: true,
    sansGras: true,
    messageSansGras: "L'objectif visé s'affiche sans gras : retirez les **.",
    aide: "Un seul paragraphe, sans gras.",
    min: 3,
    max: 500,
    derives: sansDerive,
  },
  "mesure_vers_objectif.categorie_objectif": {
    libelle: "Catégorie de l'objectif",
    chemin: ["mesure_vers_objectif", "categorie_objectif"],
    blocAbsent: "Cette fiche n'a pas de bloc « Mesure initiale → Objectif visé ».",
    type: "choix",
    choix: CATEGORIES_OBJECTIF,
    nullable: true,
    derives: sansDerive,
  },
  ...Object.fromEntries(
    Object.entries(CRITERES_ANALYSE).map(([critere, libelle]) => [
      `analyse_par_criteres.${critere}`,
      champCritere(critere, libelle),
    ]),
  ),
  // Phrase de la carte « à la une » du carrousel d'accueil. Recopiée dans la
  // colonne Analyse.resumeAccueil, que lit la page d'accueil (comme
  // buildResumeAccueil dans scripts/analyze.js à la génération).
  teaser_accueil: {
    libelle: "Phrase d'accueil (carrousel)",
    multiligne: true,
    unParagraphe: true,
    sansGras: true,
    messageSansGras: "La phrase d'accueil s'affiche sans gras : retirez les **.",
    aide:
      "Affichée sous le titre dans le carrousel de la page d'accueil. 200 caractères au plus, sans gras. Elle doit se comprendre seule : nommez qui et quand (« Macron en 2022 »), jamais « la même promesse ».",
    min: 20,
    max: 200,
    derives: (valeur) => ({ resumeAccueil: valeur }),
  },
  verdict_final: {
    libelle: "Verdict final",
    multiligne: true,
    aide:
      "Une ligne vide sépare deux paragraphes (avec exactement 2 paragraphes, la fiche affiche « Ce qui tient » / « Ce qui reste flou »). Gras : **mot**",
    min: 20,
    max: 8000,
    derives: (valeur) => ({ verdict: valeur }),
  },
  verdict_conclusion: {
    libelle: "Conclusion du verdict",
    multiligne: true,
    unParagraphe: true,
    aide: AIDE_PARAGRAPHE_GRAS,
    min: 10,
    max: 1500,
    derives: sansDerive,
  },
  sources_utilisees: {
    libelle: "Sources utilisées",
    type: "liste",
    multiligne: true,
    minPoints: 1,
    maxPoints: 80,
    maxParPoint: 1000,
    messageSansGras: "Les sources s'affichent sans gras : retirez les **.",
    aide:
      "Une source par ligne, au format « Organisme, titre (date), https://… ». Ajoutez les nouvelles sources à la fin : la version basique renvoie à certaines sources par leur numéro.",
    coherence: coherenceSources,
    derives: sansDerive,
  },
  niveau_de_confiance: {
    libelle: "Niveau de confiance",
    multiligne: true,
    unParagraphe: true,
    aide: "Commencez par « Faible. », « Moyen. » ou « Élevé. » : la jauge en est déduite. Un seul paragraphe, gras : **mot**",
    min: 5,
    max: 3000,
    derives: sansDerive,
  },
  ...Object.assign(
    {},
    ...Object.entries(SECTIONS_ACCORDEON).map(([section, libelle]) => champsSection(section, libelle)),
  ),
  // Colonnes de la proposition : PAS dans contenuComplet. Partagées par toutes
  // les analyses de la mesure (voir test-enregistrer.js).
  //   colonneProposition : colonne de Proposition écrite à la place du contenu
  "proposition.texteOriginal": {
    libelle: "Mesure initiale",
    colonneProposition: "texteOriginal",
    multiligne: true,
    unParagraphe: true,
    sansGras: true,
    messageSansGras: "La mesure initiale s'affiche sans gras : retirez les **.",
    aide: "La mesure seule, en un seul paragraphe : ni citation ni source (elles restent sur /relectures). Pas de gras.",
    min: 10,
    max: 3000,
    derives: sansDerive,
  },
  "proposition.theme": {
    libelle: "Thématique",
    colonneProposition: "theme",
    multiligne: false,
    sansGras: true,
    messageSansGras: "La thématique s'affiche sans gras : retirez les **.",
    aide: "Sert aussi aux filtres par thème du site (ex. « Logement », « Retraites »).",
    min: 2,
    max: 120,
    derives: sansDerive,
  },
};

function champConnu(champ) {
  // Object.hasOwn : « constructor », « __proto__ »… ne passent pas pour des champs.
  return typeof champ === "string" && Object.hasOwn(CHAMPS_EDITABLES, champ);
}

function estObjet(valeur) {
  return valeur !== null && typeof valeur === "object" && !Array.isArray(valeur);
}

// Conteneur JSON dans lequel on peut descendre : objet simple ou tableau.
function estConteneur(valeur) {
  return valeur !== null && typeof valeur === "object";
}

// Chemin du champ dans `contenu` (tableau de clés), ou null si son bloc parent
// n'existe pas sur cette fiche (ou si c'est une colonne de la proposition). La
// dernière clé peut manquer (elle sera ajoutée), pas les niveaux au-dessus.
export function cheminChamp(contenu, champ) {
  if (!champConnu(champ) || !estObjet(contenu)) return null;
  const regles = CHAMPS_EDITABLES[champ];
  if (regles.colonneProposition) return null;
  const chemin = typeof regles.chemin === "function" ? regles.chemin(contenu) : (regles.chemin ?? [champ]);
  if (!chemin) return null;
  let parent = contenu;
  for (const cle of chemin.slice(0, -1)) {
    parent = estConteneur(parent) && Object.hasOwn(parent, cle) ? parent[cle] : undefined;
  }
  return estObjet(parent) ? chemin : null;
}

// Le bloc parent du champ existe-t-il sur cette fiche ?
export function blocPresent(contenu, champ) {
  return cheminChamp(contenu, champ) !== null;
}

// Valeur actuelle d'un champ dans `contenu` (en suivant son chemin s'il en a un).
export function lireChamp(contenu, champ) {
  const chemin = cheminChamp(contenu, champ);
  if (!chemin) return undefined;
  return chemin.reduce(
    (objet, cle) => (estConteneur(objet) && Object.hasOwn(objet, cle) ? objet[cle] : undefined),
    contenu,
  );
}

// Texte saisi -> points d'une liste : un point par ligne, lignes vides ignorées.
export function lirePoints(texte) {
  return normaliserTexte(texte)
    .split("\n")
    .map((ligne) => ligne.trim())
    .filter((ligne) => ligne.length > 0);
}

// Valeur enregistrée -> texte brut affiché dans le champ de saisie.
export function valeurEnTexte(champ, valeur) {
  if (champConnu(champ) && CHAMPS_EDITABLES[champ].type === "liste") {
    return Array.isArray(valeur) ? valeur.join("\n") : "";
  }
  return typeof valeur === "string" ? valeur : "";
}

const MESSAGE_SANS_GRAS = "La version basique s'affiche sans gras : retirez les **.";

function validerListe(regles, texte) {
  const points = lirePoints(texte);
  if (points.length < regles.minPoints) {
    return {
      ok: false,
      message: `Il faut au moins ${regles.minPoints} point${regles.minPoints > 1 ? "s" : ""} (un par ligne) : ${points.length} saisi${points.length > 1 ? "s" : ""}.`,
    };
  }
  if (points.length > regles.maxPoints) {
    return {
      ok: false,
      message: `${regles.maxPoints} points au maximum (un par ligne) : ${points.length} saisis.`,
    };
  }
  const tropLong = points.findIndex((point) => point.length > regles.maxParPoint);
  if (tropLong !== -1) {
    return {
      ok: false,
      message: `Le point ${tropLong + 1} est trop long : ${points[tropLong].length} caractères, maximum ${regles.maxParPoint}.`,
    };
  }
  if (points.some((point) => point.includes("**"))) {
    return { ok: false, message: regles.messageSansGras ?? MESSAGE_SANS_GRAS };
  }
  return { ok: true, valeur: points };
}

// Texte saisi -> texte à enregistrer : retours à la ligne Windows/Mac ramenés à
// « \n », espaces de début et de fin retirés. Les lignes vides multiples au
// milieu restent telles quelles (elles séparent les paragraphes du résumé).
export function normaliserTexte(valeur) {
  if (typeof valeur !== "string") {
    throw new TypeError("Le texte doit être une chaîne de caractères.");
  }
  return valeur.replace(/\r\n?/g, "\n").trim();
}

// Même motif que renderRichText (src/app/declarations/[id]/page.js) : un mot en
// gras s'écrit **mot**, sans étoile à l'intérieur.
const GRAS = /\*\*[^*]+\*\*/g;

// Le résumé est découpé en paragraphes sur les lignes vides AVANT le rendu du
// gras : chaque paragraphe doit donc être équilibré à lui seul. Un ** qui reste
// une fois les mots en gras valides retirés (ex. nombre impair de **, ****
// vide, gras à cheval sur deux paragraphes) s'afficherait tel quel sur la fiche.
function aGrasMalAppaire(texte) {
  return texte.split(/\n{2,}/).some((paragraphe) => paragraphe.replace(GRAS, "").includes("**"));
}

// Caractères de contrôle (sauf saut de ligne et tabulation) : le caractère nul
// fait échouer l'enregistrement dans PostgreSQL, les autres n'ont rien à faire
// dans un texte éditorial.
function aCaractereDeControle(texte) {
  for (let position = 0; position < texte.length; position++) {
    const code = texte.charCodeAt(position);
    // Codes 0 à 31 sauf tabulation (9) et saut de ligne (10), et 127 (DEL).
    if ((code < 32 && code !== 9 && code !== 10) || code === 127) return true;
  }
  return false;
}

// Contrôle un texte avant enregistrement. Renvoie { ok: true, valeur } (valeur
// normalisée ; tableau de points pour une liste) ou { ok: false, message } avec
// une explication en français simple.
export function validerTexte(champ, valeur) {
  if (!champConnu(champ)) {
    return { ok: false, message: "Ce champ ne peut pas être modifié." };
  }
  if (typeof valeur !== "string") {
    return { ok: false, message: "Le texte est invalide." };
  }

  const regles = CHAMPS_EDITABLES[champ];
  const texte = normaliserTexte(valeur);

  // Liste déroulante : une valeur de la liste, ou rien (null) si permis.
  if (regles.type === "choix") {
    if (texte === "" && regles.nullable) return { ok: true, valeur: null };
    if (!regles.choix.includes(texte)) return { ok: false, message: "Choisissez une valeur de la liste." };
    return { ok: true, valeur: texte };
  }

  if (aCaractereDeControle(texte)) {
    return { ok: false, message: "Le texte contient des caractères invisibles non autorisés." };
  }
  if (texte.length === 0) {
    return { ok: false, message: "Le texte est vide." };
  }
  if (regles.type === "liste") return validerListe(regles, texte);
  if (texte.length < regles.min) {
    return {
      ok: false,
      message: `Le texte est trop court : ${texte.length} caractères, minimum ${regles.min}.`,
    };
  }
  if (texte.length > regles.max) {
    return {
      ok: false,
      message: `Le texte est trop long : ${texte.length} caractères, maximum ${regles.max}.`,
    };
  }
  if (!regles.multiligne && texte.includes("\n")) {
    return { ok: false, message: "Ce champ tient sur une seule ligne : retirez les retours à la ligne." };
  }
  if (regles.unParagraphe && texte.includes("\n")) {
    return { ok: false, message: "Ce texte s'affiche en un seul paragraphe : retirez les retours à la ligne." };
  }
  if (regles.sansGras) {
    if (texte.includes("**")) return { ok: false, message: regles.messageSansGras ?? MESSAGE_SANS_GRAS };
  } else if (!regles.multiligne) {
    // Le titre s'affiche tel quel (pas de gras) : des ** y resteraient visibles.
    if (texte.includes("**")) {
      return { ok: false, message: "Le titre ne peut pas contenir de ** : le gras n'existe pas dans un titre." };
    }
  } else if (aGrasMalAppaire(texte)) {
    return {
      ok: false,
      message:
        "Il reste des ** mal appariés : un mot en gras s'écrit **mot** (deux étoiles de chaque côté, dans le même paragraphe).",
    };
  }

  return { ok: true, valeur: texte };
}

// Comparaison profonde de valeurs issues de JSON (null, booléens, nombres,
// chaînes, tableaux, objets simples). Volontairement sans dépendance.
function egalProfond(a, b) {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const clesA = Object.keys(a);
  const clesB = Object.keys(b);
  if (clesA.length !== clesB.length) return false;
  return clesA.every((cle) => Object.hasOwn(b, cle) && egalProfond(a[cle], b[cle]));
}

// Garde-fou : entre `avant` et `apres`, à part `cleVisee`, RIEN ne doit avoir
// changé (ni valeur, ni clé ajoutée ou retirée).
function verifierSeuleCleModifiee(avant, apres, cleVisee, prefixe = "") {
  for (const cle of Object.keys(avant)) {
    if (cle === cleVisee) continue;
    if (!Object.hasOwn(apres, cle) || !egalProfond(avant[cle], apres[cle])) {
      throw new Error(`Garde-fou : la clé « ${prefixe}${cle} » a été modifiée par erreur.`);
    }
  }
  for (const cle of Object.keys(apres)) {
    if (cle !== cleVisee && !Object.hasOwn(avant, cle)) {
      throw new Error(`Garde-fou : la clé « ${prefixe}${cle} » a été ajoutée par erreur.`);
    }
  }
}

// Applique UNE modification à `contenu` (le JSON contenuComplet) sans toucher à
// l'objet reçu. Renvoie { contenu: nouveauContenu, derives } où `derives` liste
// les colonnes à mettre à jour en parallèle (titreProposition, teaser).
// La valeur doit avoir été validée avant (validerTexte) : une chaîne, un
// tableau de chaînes pour une liste, ou null pour un choix vide permis.
export function appliquerModification(contenu, champ, valeur) {
  if (!champConnu(champ)) {
    throw new Error(`Champ non modifiable : ${String(champ)}`);
  }
  const regles = CHAMPS_EDITABLES[champ];
  if (regles.colonneProposition) {
    throw new Error(`Champ hors du contenu de l'analyse (colonne de la proposition) : ${champ}`);
  }
  if (regles.type === "liste") {
    if (!Array.isArray(valeur) || !valeur.every((point) => typeof point === "string")) {
      throw new TypeError("La valeur à enregistrer doit être une liste de chaînes de caractères.");
    }
  } else if (!(typeof valeur === "string" || (valeur === null && regles.type === "choix" && regles.nullable))) {
    throw new TypeError("La valeur à enregistrer doit être une chaîne de caractères.");
  }
  if (!estObjet(contenu)) {
    throw new Error("Le contenu de l'analyse est illisible : modification refusée.");
  }
  const chemin = cheminChamp(contenu, champ);
  if (!chemin) {
    throw new Error(regles.blocAbsent ?? "Ce bloc n'existe pas sur cette fiche : modification refusée.");
  }

  const nouveauContenu = structuredClone(contenu);
  const cleFinale = chemin[chemin.length - 1];
  const parentNouveau = chemin.slice(0, -1).reduce((objet, cle) => objet[cle], nouveauContenu);
  parentNouveau[cleFinale] = structuredClone(valeur);

  // Garde-fou à chaque niveau du chemin : seule la clé visée change, rien d'autre
  // (en particulier ni notation_detaillee, ni la note d'un critère, ni
  // version_basique.sources_principales).
  let avant = contenu;
  let apres = nouveauContenu;
  for (const [niveau, cle] of chemin.entries()) {
    verifierSeuleCleModifiee(avant, apres, String(cle), chemin.slice(0, niveau).map((c) => `${c}.`).join(""));
    avant = avant[cle];
    apres = apres[cle];
  }

  if (!egalProfond(contenu.notation_detaillee, nouveauContenu.notation_detaillee)) {
    throw new Error("Garde-fou : notation_detaillee a été modifiée par erreur.");
  }

  return { contenu: nouveauContenu, derives: regles.derives(valeur) };
}
