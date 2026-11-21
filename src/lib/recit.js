import { getScoreBands } from "./score.js";
import { nombresHorsFiche } from "./nombres-fiche.js";
import { longueurX, mentionneCandidat, nombreDeMots, remplirTweet } from "./reseaux.js";
import { GRAS_MAX_PAR_SLIDE, grasDesequilibre, nombreGras, sansGras } from "./texte-gras.js";
import { motCleNormalise } from "./illustrations.js";

// Carrousel détaillé (8 slides, ex-« récit ») et tweet long d'une fiche,
// écrits par Claude à la demande (bouton « Générer le carrousel détaillé » de
// /test/reseaux/<id>, ou scripts/recit.js) avec le prompt
// data/prompt-recit.md, en un seul appel. Rangés dans
// contenuComplet.reseaux_recit (nom de clé gardé). Ce fichier : le contrôle
// de la réponse du modèle (controlerRecit), l'assemblage du tweet long, les
// remarques (régénération ciblée, journal des retours) et le stockage.
// Fonctions PURES, testées par scripts/recit.test.js.
//
// Le modèle n'écrit ni score, ni niveau, ni pastille de note, ni lien, ni
// compte X : le code les ajoute (src/lib/score.js, marqueurs de src/lib/reseaux.js).

export const MOTS_MAX_CARTE = 35;
export const CARTES_MAX = 3;
export const TWEET_LONG_MIN = 800;
export const TWEET_LONG_MAX = 1500;
// Valeur d'une tuile chiffrée : au-delà, elle déborde (format court attendu,
// « ~600 Md€ », la précision dans la petite ligne).
export const VALEUR_TUILE_MAX = 12;
export const MOTS_MAX_QUESTION = 6;
// Au-delà de cette longueur d'URL, le lien « Ouvrir dans X » risque d'être
// tronqué par le navigateur ou par X : la page conseille « Copier ».
export const URL_INTENTION_MAX = 2000;

// Questions types de la couverture (le modèle peut aussi en écrire une courte,
// sur le modèle « Et la capitalisation ? »).
export const QUESTIONS_COUVERTURE = ["Est-ce tenable ?", "Est-ce réaliste ?", "Est-ce finançable ?", "Est-ce efficace ?", "Est-ce applicable ?"];
// Pastilles des cartes : liste fermée, chacune avec sa couleur fixe (pas
// d'orange : la charte le réserve au niveau de note qui l'utilise).
export const COULEURS_PASTILLES = {
  positif: "vert",
  possible: "vert",
  complémentaire: "vert",
  incertain: "jaune",
  différé: "jaune",
  débattu: "jaune",
  risque: "rouge",
  coûteux: "rouge",
  négatif: "rouge",
};
export const PASTILLES = Object.keys(COULEURS_PASTILLES);
// Les 5 critères du barème (src/lib/criteresScore.js) : une ligne du modèle par critère.
export const CLES_CRITERES = ["operationnalite_moyens", "efficacite", "effets_rebonds_externalites", "degre_preparation", "alignement_logique"];
const PARTIES_TWEET = ["accroche", "promesse", "exemple", "hic", "tient", "appel"];

function texte(valeur) {
  return typeof valeur === "string" ? valeur.replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, " ").trim() : "";
}

function sansAccents(t) {
  return String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// Tweet long assemblé, AVEC ses marqueurs (remplis à l'affichage) : les
// paragraphes du modèle, puis la ligne de note et le lien, écrits par le code.
export function assemblerTweetRecit(tweet) {
  return [
    tweet.accroche,
    tweet.promesse,
    tweet.exemple,
    tweet.hic,
    tweet.tient,
    "Note : {PASTILLE} {SCORE}/100 {APPRECIATION}",
    tweet.appel,
    "Analyse complète 👇 {LIEN}",
  ]
    .filter(Boolean)
    .join("\n\n");
}

// Libellés du barème (src/lib/score.js), cherchés comme mots entiers.
function palierEcrit(t) {
  const sans = t.toLowerCase();
  return getScoreBands()
    .map((bande) => bande.label)
    .find((label) => new RegExp(`(^|[^\\p{L}])${label.toLowerCase()}($|[^\\p{L}])`, "u").test(sans));
}

// Format court d'une valeur de tuile : « près de 600 milliards d'euros » →
// « ~600 Md€ », « 3 millions » → « 3 M », « 1 830 euros » → « 1 830 € ».
// Valeur laissée telle quelle si elle ne suit pas ce schéma (mots en plus).
export function valeurCourte(valeur) {
  const v = texte(valeur);
  const m = v.match(/^(près de|environ|quelque|presque)?\s*([+−-]?\d{1,3}(?:[\s  ]\d{3})*(?:,\d+)?|[+−-]?\d+(?:,\d+)?)\s*(milliards?|millions?|milliers?|Md|M)?\s*(d['’]euros|d['’]€|euros?|€)?$/i);
  if (!m) return v;
  const [, approx, nombre, unite, euro] = m;
  const u = unite ? { milliard: "Md", milliards: "Md", million: "M", millions: "M", millier: "k", milliers: "k", md: "Md", m: "M" }[unite.toLowerCase()] : "";
  const suffixe = u ? `${u}${euro ? "€" : ""}` : euro ? "€" : "";
  const court = `${approx ? "~" : ""}${nombre.replace(/[\s  ]/g, " ")}${suffixe ? ` ${suffixe}` : ""}`;
  return court.length < v.length ? court : v;
}

// Tuile { valeur, detail } normalisée : valeur au format court ; quand ce
// format perd une nuance (« près de » devenu « ~ »), la forme longue du
// modèle est reportée dans la petite ligne si elle y manque.
function tuileCourte(brute) {
  const valeur = texte(brute?.valeur);
  const detail = texte(brute?.detail);
  const courte = valeurCourte(valeur);
  if (courte === valeur || !courte.startsWith("~")) return { valeur: courte, detail };
  const precision = sansAccents(detail).includes(sansAccents(valeur)) ? detail : [valeur, detail].filter(Boolean).join(" · ");
  return { valeur: courte, detail: precision };
}

function pastilleControlee(brute, libelle, erreurs) {
  const pastille = texte(brute).toLowerCase();
  if (!PASTILLES.includes(pastille)) erreurs.push(`${libelle} : pastille « ${pastille || "(absente)"} » hors liste (${PASTILLES.join(", ")}).`);
  return pastille;
}

// Cartes { titre, texte, pastille } normalisées (3 au plus).
function cartes(liste, cle, avertissements, erreurs) {
  const brutes = Array.isArray(liste) ? liste : [];
  if (brutes.length > CARTES_MAX) avertissements.push(`${cle} : ${brutes.length} cartes, seules les ${CARTES_MAX} premières sont gardées.`);
  return brutes.slice(0, CARTES_MAX).map((carte, i) => ({
    titre: texte(carte?.titre),
    texte: texte(carte?.texte),
    pastille: pastilleControlee(carte?.pastille, `${cle} ${i + 1}`, erreurs),
  }));
}

// Contrôle de la réponse du modèle. Refus (erreurs) SEULEMENT pour : JSON
// invalide (structure ou champ manquant), nombre absent de la fiche, tiret
// cadratin, score ou niveau écrit par le modèle, pays ou année d'un précédent
// absents de la fiche, pastille hors liste, mot-clé d'illustration hors
// liste. Tout le reste est un avertissement.
//   raw : objet proposé par le modèle (ou récit déjà stocké, pour le relire) ;
//   ficheFinale : fiche envoyée au modèle (référence des nombres et des précédents) ;
//   valeurs : valeurs des marqueurs (valeursReseaux), pour mesurer le tweet ;
//   motsClesIllustration : liste fermée des mots-clés d'illustration du thème
//     (null : pas de contrôle, pour la relecture d'un récit stocké).
// Renvoie { valide, erreurs, avertissements, recit } ; recit : réponse
// normalisée (textes nettoyés, tweet assemblé), null si la structure est invalide.
export function controlerRecit(raw, { ficheFinale, candidatNom, valeurs, motsClesIllustration = null }) {
  const erreurs = [];
  const avertissements = [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { valide: false, erreurs: ["JSON invalide : un objet est attendu."], avertissements, recit: null };
  }

  const c = raw.couverture ?? {};
  const k = raw.concretement ?? {};
  const n = raw.note ?? {};
  const t = raw.tient ?? {};
  const recit = {
    couverture: { mesure: texte(c.mesure).replace(/[.\s]+$/, ""), question: texte(c.question), mot_cle: texte(c.mot_cle), chiffre_cle: texte(c.chiffre_cle) },
    concretement: {
      titre: texte(k.titre),
      texte: texte(k.texte),
      tuiles: Object.fromEntries(["aujourdhui", "propose", "ecart", "concernes"].map((cle) => [cle, tuileCourte(k.tuiles?.[cle])])),
      conclusion: texte(k.conclusion),
      sources: texte(k.sources),
    },
    note: {
      titre: texte(n.titre),
      explication: texte(n.explication),
      criteres: Object.fromEntries(CLES_CRITERES.map((cle) => [cle, texte(n.criteres?.[cle])])),
    },
    court_terme: { titre: texte(raw.court_terme?.titre), cartes: cartes(raw.court_terme?.cartes, "court terme, carte", avertissements, erreurs) },
    long_terme: { titre: texte(raw.long_terme?.titre), cartes: cartes(raw.long_terme?.cartes, "long terme, carte", avertissements, erreurs) },
    ailleurs: null,
    tient: {
      tient: (Array.isArray(t.tient) ? t.tient : []).map(texte).filter(Boolean),
      coince: (Array.isArray(t.coince) ? t.coince : []).map(texte).filter(Boolean),
    },
    illustration_mots_cles: (Array.isArray(raw.illustration_mots_cles) ? raw.illustration_mots_cles : []).map(motCleNormalise).filter(Boolean),
    legende_accroche: texte(raw.legende_accroche),
    tweet: Object.fromEntries(PARTIES_TWEET.map((partie) => [partie, texte(raw.tweet?.[partie])])),
  };
  if (!recit.couverture.chiffre_cle) delete recit.couverture.chiffre_cle;
  if (raw.ailleurs && typeof raw.ailleurs === "object" && Array.isArray(raw.ailleurs.precedents) && raw.ailleurs.precedents.length > 0) {
    if (raw.ailleurs.precedents.length > 2) avertissements.push(`à l’étranger : ${raw.ailleurs.precedents.length} précédents, seuls les 2 premiers sont gardés.`);
    recit.ailleurs = {
      titre: texte(raw.ailleurs.titre),
      precedents: raw.ailleurs.precedents.slice(0, 2).map((p, i) => ({
        pays: texte(p?.pays),
        annee: texte(String(p?.annee ?? "")),
        fait: texte(p?.fait),
        resultat: texte(p?.resultat),
        pastille: pastilleControlee(p?.pastille, `à l’étranger ${i + 1}`, erreurs),
      })),
      sources: texte(raw.ailleurs.sources),
    };
  }

  // Structure (JSON invalide si un champ attendu manque).
  const manquants = [
    ["couverture.mesure", recit.couverture.mesure],
    ["couverture.question", recit.couverture.question],
    ["concretement.titre", recit.concretement.titre],
    ["concretement.texte", recit.concretement.texte],
    ...["aujourdhui", "propose", "ecart", "concernes"].map((cle) => [`concretement.tuiles.${cle}.valeur`, recit.concretement.tuiles[cle].valeur]),
    ["note.titre", recit.note.titre],
    ["note.explication", recit.note.explication],
    ...CLES_CRITERES.map((cle) => [`note.criteres.${cle}`, recit.note.criteres[cle]]),
    ["court_terme.titre", recit.court_terme.titre],
    ["court_terme.cartes", recit.court_terme.cartes.length ? "ok" : ""],
    ["long_terme.titre", recit.long_terme.titre],
    ["long_terme.cartes", recit.long_terme.cartes.length ? "ok" : ""],
    ["tient.tient", recit.tient.tient.length ? "ok" : ""],
    ["tient.coince", recit.tient.coince.length ? "ok" : ""],
    ["legende_accroche", recit.legende_accroche],
    ...PARTIES_TWEET.map((partie) => [`tweet.${partie}`, recit.tweet[partie]]),
    ...[...recit.court_terme.cartes, ...recit.long_terme.cartes].flatMap((carte, i) => [[`carte ${i + 1}.texte`, carte.texte]]),
    ...(recit.ailleurs?.precedents ?? []).flatMap((p, i) => [
      [`ailleurs.precedents.${i}.pays`, p.pays],
      [`ailleurs.precedents.${i}.fait`, p.fait],
    ]),
  ]
    .filter(([, valeur]) => !valeur)
    .map(([chemin]) => chemin);
  if (manquants.length > 0) {
    return { valide: false, erreurs: [`JSON invalide : champ(s) manquant(s) ou vide(s) : ${manquants.join(", ")}.`], avertissements, recit: null };
  }
  recit.tweet_assemble = assemblerTweetRecit(recit.tweet);

  // Tous les textes écrits par le modèle, avec leur libellé et leur slide
  // (pour compter les mots en gras par slide).
  const textes = [
    ["couverture (mesure)", recit.couverture.mesure, "couverture"],
    ["couverture (question)", recit.couverture.question, "couverture"],
    ["couverture (mot clé)", recit.couverture.mot_cle, "couverture"],
    ["concrètement (titre)", recit.concretement.titre, "concretement"],
    ["concrètement (texte)", recit.concretement.texte, "concretement"],
    ...Object.entries(recit.concretement.tuiles).flatMap(([cle, { valeur, detail }]) => [
      [`concrètement (tuile ${cle})`, valeur, "concretement"],
      [`concrètement (tuile ${cle}, détail)`, detail, "concretement"],
    ]),
    ["concrètement (conclusion)", recit.concretement.conclusion, "concretement"],
    ["concrètement (sources)", recit.concretement.sources, "concretement"],
    ["note (titre)", recit.note.titre, "note"],
    ["note (explication)", recit.note.explication, "note"],
    ...CLES_CRITERES.map((cle) => [`note (critère ${cle})`, recit.note.criteres[cle], "note"]),
    ...["court_terme", "long_terme"].flatMap((partie) => [
      [`${partie} (titre)`, recit[partie].titre, partie],
      ...recit[partie].cartes.flatMap((carte, i) => [
        [`${partie}, carte ${i + 1} (titre)`, carte.titre, partie],
        [`${partie}, carte ${i + 1}`, carte.texte, partie],
      ]),
    ]),
    ...(recit.ailleurs
      ? [
          ["à l’étranger (titre)", recit.ailleurs.titre, "ailleurs"],
          ["à l’étranger (sources)", recit.ailleurs.sources, "ailleurs"],
          ...recit.ailleurs.precedents.flatMap((p, i) => [
            [`à l’étranger ${i + 1} (fait)`, p.fait, "ailleurs"],
            [`à l’étranger ${i + 1} (résultat)`, p.resultat, "ailleurs"],
          ]),
        ]
      : []),
    ...recit.tient.tient.map((point, i) => [`ce qui tient ${i + 1}`, point, "tient"]),
    ...recit.tient.coince.map((point, i) => [`ce qui coince ${i + 1}`, point, "tient"]),
    ["légende (accroche)", recit.legende_accroche, "legende"],
    ...PARTIES_TWEET.map((partie) => [`tweet long (${partie})`, recit.tweet[partie], "tweet"]),
  ];

  // Refus.
  const horsFiche = nombresHorsFiche(
    [...textes.map(([, t2]) => sansGras(t2).replace(/\{[A-Z]+\}/g, "")), ...(recit.ailleurs?.precedents ?? []).map((p) => p.annee)],
    ficheFinale,
  );
  if (horsFiche.length > 0) erreurs.push(`Nombre(s) absent(s) de la fiche : ${horsFiche.join(", ")}.`);
  for (const [libelle, t2] of textes) {
    if (t2.includes("—")) erreurs.push(`${libelle} : tiret cadratin (interdit).`);
    if (/\d+(?:[,.]\d+)?\s*(?:\/|sur)\s*100\b/i.test(t2) || /\{(SCORE|APPRECIATION|PASTILLE)\}/.test(t2) || /[🔴🟠🟡🟢]/u.test(t2)) {
      erreurs.push(`${libelle} : score ou pastille de note écrits par le modèle (le code les ajoute).`);
    }
    const palier = palierEcrit(sansGras(t2));
    if (palier) erreurs.push(`${libelle} : niveau « ${palier} » écrit par le modèle (le code l’ajoute).`);
  }
  // Précédents : pays et année doivent figurer dans la fiche.
  const ficheTexte = sansAccents(JSON.stringify(ficheFinale ?? {}));
  for (const [i, p] of (recit.ailleurs?.precedents ?? []).entries()) {
    if (!ficheTexte.includes(sansAccents(p.pays))) erreurs.push(`à l’étranger ${i + 1} : pays « ${p.pays} » absent de la fiche (jamais de précédent ajouté).`);
    if (p.annee && !ficheTexte.includes(sansAccents(p.annee))) erreurs.push(`à l’étranger ${i + 1} : année « ${p.annee} » absente de la fiche.`);
  }
  // Mots-clés d'illustration : 2 au plus, dans la liste fermée du thème.
  if (motsClesIllustration) {
    for (const mot of recit.illustration_mots_cles) {
      if (!motsClesIllustration.includes(mot)) erreurs.push(`illustration : mot-clé « ${mot} » hors de la liste du thème (${motsClesIllustration.join(", ") || "liste vide"}).`);
    }
  }
  if (recit.illustration_mots_cles.length > 2) {
    avertissements.push(`illustration : ${recit.illustration_mots_cles.length} mots-clés, seuls les 2 premiers sont gardés.`);
    recit.illustration_mots_cles = recit.illustration_mots_cles.slice(0, 2);
  }

  // Avertissements.
  const q = recit.couverture.question;
  if (!q.endsWith("?") || nombreDeMots(q) > MOTS_MAX_QUESTION) {
    avertissements.push(`couverture : question « ${q} » (une question courte, ${MOTS_MAX_QUESTION} mots au plus, finie par « ? », est attendue), « ${QUESTIONS_COUVERTURE[0]} » retenue.`);
    recit.couverture.question = QUESTIONS_COUVERTURE[0];
    recit.couverture.mot_cle = "tenable";
  }
  if (!recit.couverture.mot_cle) {
    // Question type sans mot clé : le dernier mot avant « ? ».
    recit.couverture.mot_cle = recit.couverture.question.replace(/\s*\?$/, "").split(/\s+/).at(-1) ?? "";
  }
  if (!recit.couverture.question.includes(recit.couverture.mot_cle)) {
    avertissements.push(`couverture : le mot clé « ${recit.couverture.mot_cle} » n’apparaît pas tel quel dans la question, il ne sera pas surligné.`);
  }
  if (!recit.concretement.conclusion) avertissements.push("concrètement : pas de phrase de conclusion.");
  if (!recit.concretement.sources) avertissements.push("concrètement : pas de ligne « Source : … ».");
  for (const [cle, { valeur }] of Object.entries(recit.concretement.tuiles)) {
    if (valeur.length > VALEUR_TUILE_MAX) avertissements.push(`concrètement (tuile ${cle}) : « ${valeur} » trop long pour la tuile (${VALEUR_TUILE_MAX} caractères au plus, format court « ~600 Md€ » attendu).`);
  }
  for (const [libelle, t2] of textes.filter(([l]) => !l.startsWith("tweet") && !l.startsWith("légende"))) {
    const mots = nombreDeMots(sansGras(t2));
    if (mots > MOTS_MAX_CARTE) avertissements.push(`${libelle} : ${mots} mots (${MOTS_MAX_CARTE} au plus).`);
    if (grasDesequilibre(t2)) avertissements.push(`${libelle} : balisage ** non fermé, ignoré.`);
  }
  const grasParSlide = {};
  for (const [, t2, slide] of textes) grasParSlide[slide] = (grasParSlide[slide] ?? 0) + nombreGras(t2);
  for (const [slide, nombre] of Object.entries(grasParSlide)) {
    if (["tweet", "legende"].includes(slide)) {
      if (nombre > 0) avertissements.push(`${slide === "tweet" ? "tweet long" : "légende"} : balisage ** inutile hors des slides (X et Instagram ne l’affichent pas).`);
    } else if (nombre > GRAS_MAX_PAR_SLIDE) {
      avertissements.push(`${slide} : ${nombre} passages en gras (${GRAS_MAX_PAR_SLIDE} au plus par slide), les suivants seront en texte normal.`);
    }
  }
  for (const [cote, points] of [["ce qui tient", recit.tient.tient], ["ce qui coince", recit.tient.coince]]) {
    if (points.length > 3) avertissements.push(`${cote} : ${points.length} puces, seules les 3 premières sont affichées.`);
  }
  if (!mentionneCandidat(recit.tweet.promesse, candidatNom)) avertissements.push("tweet long (promesse) : le candidat n’est pas nommé.");
  for (const [libelle, t2] of textes) {
    if (/(^|\s)@\w/.test(t2)) avertissements.push(`${libelle} : compte écrit à la main (@…) au lieu de {CANDIDAT}.`);
  }
  if (valeurs) {
    const longueur = longueurX(remplirTweet(recit.tweet_assemble, valeurs));
    if (longueur < TWEET_LONG_MIN || longueur > TWEET_LONG_MAX) {
      avertissements.push(`tweet long : ${longueur} caractères (${TWEET_LONG_MIN} à ${TWEET_LONG_MAX} visés).`);
    }
  }

  return { valide: erreurs.length === 0, erreurs, avertissements, recit };
}

// --- Remarques et régénération ciblée -------------------------------------------------

// Parties de la réponse du modèle visées par une remarque : une slide (par
// son type, src/lib/carrousel-recit.js), le tweet long, ou « toutes ».
// La slide de fin est écrite par le code : elle ne se régénère pas.
export const PARTIES_PAR_CIBLE = {
  couverture: ["couverture", "illustration_mots_cles"],
  concretement: ["concretement"],
  noteRecit: ["note"],
  effetsCourt: ["court_terme"],
  effetsLong: ["long_terme"],
  ailleurs: ["ailleurs"],
  tientCoince: ["tient"],
  tweet: ["tweet"],
};
const PARTIES_REPONSE = ["couverture", "concretement", "note", "court_terme", "long_terme", "ailleurs", "tient", "illustration_mots_cles", "legende_accroche", "tweet"];

export function cibleValide(cible) {
  return cible === "toutes" || Object.hasOwn(PARTIES_PAR_CIBLE, cible);
}

// Réponse du modèle (sans les champs du stockage) à partir d'un récit stocké.
export function reponseDepuisRecit(recit) {
  return Object.fromEntries(PARTIES_REPONSE.filter((p) => recit?.[p] !== undefined).map((p) => [p, recit[p]]));
}

// Remarque nettoyée (texte libre, 600 caractères au plus).
export function remarqueNettoyee(remarque) {
  return texte(remarque).slice(0, 600);
}

// Consigne ajoutée au message quand on régénère avec des remarques : la
// version précédente, les remarques, et la partie à réécrire. Les remarques
// ne passent jamais avant les règles du prompt.
export function consigneRemarques({ precedent, remarque, cible, libelleCible }) {
  const parties = cible === "toutes" ? null : PARTIES_PAR_CIBLE[cible];
  return [
    "RÉGÉNÉRATION AVEC REMARQUES.",
    "Voici la version précédente (même format JSON que ta réponse) :",
    JSON.stringify(reponseDepuisRecit(precedent), null, 2),
    "",
    "Remarques de l'équipe, à appliquer comme consignes supplémentaires. Elles ne passent JAMAIS avant les règles ci-dessus : si une remarque demande d'écrire la note, le niveau, un chiffre absent de la fiche, un précédent absent de la fiche ou un tiret cadratin, ignore cette partie de la remarque.",
    `« ${remarque} »`,
    "",
    parties
      ? `Ne réécris que ${libelleCible} (clé(s) JSON : ${parties.join(", ")}). Recopie toutes les autres clés à l'identique, sans rien changer. Réponds avec le JSON complet.`
      : "Réécris l'ensemble en tenant compte des remarques. Réponds avec le JSON complet.",
  ].join("\n");
}

// Récit fusionné : seule la partie visée vient de la nouvelle réponse, tout
// le reste est repris tel quel de la version précédente (les autres slides
// restent identiques, même si le modèle les a modifiées).
export function fusionnerRecit(precedent, nouveau, cible) {
  if (cible === "toutes") return reponseDepuisRecit(nouveau);
  const parties = PARTIES_PAR_CIBLE[cible] ?? [];
  const base = reponseDepuisRecit(precedent);
  for (const partie of parties) {
    if (nouveau?.[partie] === undefined) delete base[partie];
    else base[partie] = nouveau[partie];
  }
  return base;
}

// --- Stockage ------------------------------------------------------------------------

// Objet rangé dans contenuComplet.reseaux_recit.
export function recitPourStockage(recit, { modele, genereLe = new Date().toISOString(), illustration } = {}) {
  return { ...recit, genereLe, ...(modele ? { modele } : {}), ...(illustration ? { illustration } : {}) };
}

// Version gardée sous `precedent` : sans son propre précédent ni le journal.
function versionArchivee(recit) {
  if (!recit) return null;
  const { precedent: _p, retours: _r, ...reste } = recit;
  return reste;
}

// contenuComplet après écriture : seule la clé reseaux_recit change ; l'ancien
// récit (s'il y en avait un) y est gardé sous `precedent`, sans remonter plus
// loin ; le journal des remarques (`retours`) est conservé.
export function contenuAvecRecit(contenu, recit, retour = null) {
  const base = contenu ?? {};
  const ancien = versionArchivee(base.reseaux_recit);
  const retours = [...(base.reseaux_recit?.retours ?? []), ...(retour ? [retour] : [])];
  return { ...base, reseaux_recit: { ...recit, ...(ancien ? { precedent: ancien } : {}), ...(retours.length ? { retours } : {}) } };
}

// contenuComplet avec une entrée de plus au journal des remarques (régénération
// refusée : seul le journal change).
export function contenuAvecRetour(contenu, retour) {
  const base = contenu ?? {};
  if (!base.reseaux_recit) return base;
  return { ...base, reseaux_recit: { ...base.reseaux_recit, retours: [...(base.reseaux_recit.retours ?? []), retour] } };
}

// « Revenir à la version précédente » : la version précédente redevient la
// version actuelle, l'actuelle passe sous `precedent` (on peut donc revenir
// encore, pour comparer). Renvoie null s'il n'y a pas de version précédente.
export function contenuRevenuAuPrecedent(contenu, retour = null) {
  const actuel = contenu?.reseaux_recit;
  if (!actuel?.precedent) return null;
  const retours = [...(actuel.retours ?? []), ...(retour ? [retour] : [])];
  return { ...contenu, reseaux_recit: { ...actuel.precedent, precedent: versionArchivee(actuel), ...(retours.length ? { retours } : {}) } };
}

// Entrée du journal des remarques.
//   cible : "toutes", type de slide ou "tweet" ; slide : { numero, libelle } ou null ;
//   resultat : "acceptée" | "refusée" | "retour à la version précédente" ;
//   details : raisons du refus ou avertissements (liste courte).
export function entreeRetour({ remarque, cible, slide = null, resultat, details = [], cout = null, date = new Date().toISOString() }) {
  return {
    date,
    remarque,
    cible,
    ...(slide ? { slide } : {}),
    resultat,
    ...(details.length ? { details: details.slice(0, 8) } : {}),
    ...(cout !== null && cout !== undefined ? { cout: Math.round(cout * 10000) / 10000 } : {}),
  };
}
