import { getScoreBands } from "./score.js";
import { nombresHorsFiche } from "./nombres-fiche.js";
import { longueurX, mentionneCandidat, nombreDeMots, remplirTweet } from "./reseaux.js";
import { grasDesequilibre, MOTS_GRAS_MAX_PAR_SLIDE, nombreGras, nombreMotsGras, sansGras } from "./texte-gras.js";
import { motCleNormalise } from "./illustrations.js";
import { contientChiffre, contientPrenom, estRubrique, FORMULES, restesDeMaquette } from "./ecriture-charte.js";

// Carrousel détaillé (8 slides) d'une fiche, écrit par Claude
// à la demande (bouton « Générer le carrousel détaillé » de
// /test/reseaux/<id>, ou scripts/recit.js) avec le prompt
// data/prompt-recit.md (sections 1, 2 et 5 de docs/prompt-carrousel.md, qui
// fait foi), en un seul appel. Rangés dans contenuComplet.reseaux_recit (nom
// de clé gardé). Ce fichier : le contrôle de la réponse du modèle
// (controlerRecit), l'assemblage du tweet long, les remarques (régénération
// ciblée, journal des retours) et le stockage. Fonctions PURES, testées par
// scripts/recit.test.js.
//
// Le modèle n'écrit ni score, ni verdict, ni sous-note, ni lien, ni compte :
// le code les ajoute (src/lib/score.js, marqueurs de src/lib/reseaux.js).

// Format de la réponse (v6 : constat puis proposition, notre avis). Un
// carrousel stocké dans un format plus ancien est signalé, à régénérer.
export const FORMAT_RECIT = 6;

export const MOTS_MAX_PHRASE = 25;
export const MOTS_MAX_QUESTION = 14;
export const SURLIGNES_MIN = 1;
export const SURLIGNES_MAX = 3;
export const CHIFFRES_CONSTAT = 4;
export const EFFETS_PAR_SLIDE = 3;
export const TWEET_LONG_MIN = 800;
export const TWEET_LONG_MAX = 1500;
// Valeur d'une tuile chiffrée : au-delà, elle déborde (format court attendu,
// « ~600 Md€ », la précision dans la petite ligne).
export const VALEUR_TUILE_MAX = 12;
// Au-delà de cette longueur d'URL, le lien « Ouvrir dans X » risque d'être
// tronqué par le navigateur ou par X : la page conseille « Copier ».
export const URL_INTENTION_MAX = 2000;

// Sous-titre fixe de la couverture, écrit par le code.
export const SOUS_TITRE_COUVERTURE = FORMULES.sousTitreCouverture;

// Tournures qui sonnent « IA » (avertissement). Liste enrichissable : une
// expression par entrée, comparée sans accents ni majuscules, en mots entiers.
export const TOURNURES_IA = [
  "en somme",
  "crucial",
  "cruciale",
  "cruciaux",
  "il est important de noter",
  "il est essentiel de",
  "en définitive",
  "force est de constater",
  "par ailleurs",
  "il convient de",
  "enjeu majeur",
  "véritable",
  "dans un contexte de",
  "en outre",
  "de surcroît",
  "il est à noter",
  "un levier puissant",
  "à l'aune de",
  "plus que jamais",
];

// Pastilles des effets : liste fermée, chacune avec sa couleur fixe (pas
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
const PARTIES_LEGENDE = ["question", "avis", "effet"];

function texte(valeur) {
  return typeof valeur === "string" ? valeur.replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, " ").trim() : "";
}

function sansAccents(t) {
  return String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// --- Petites fonctions de contrôle (exportées pour les tests) -----------------------

// Balisage du surlignage jaune de la couverture : ==mot== ou ==groupe de mots==.
// Morceaux [{ texte, jaune }] ; un == sans fermeture est ignoré.
export function morceauxSurlignes(t) {
  const morceaux = [];
  let reste = String(t ?? "");
  while (reste.length) {
    const debut = reste.indexOf("==");
    const fin = debut >= 0 ? reste.indexOf("==", debut + 2) : -1;
    if (debut < 0 || fin < 0) {
      morceaux.push({ texte: reste.replace(/==/g, ""), jaune: false });
      break;
    }
    if (debut > 0) morceaux.push({ texte: reste.slice(0, debut), jaune: false });
    const dedans = reste.slice(debut + 2, fin);
    if (dedans.trim()) morceaux.push({ texte: dedans, jaune: true });
    reste = reste.slice(fin + 2);
  }
  return morceaux.filter((m) => m.texte);
}

export function sansSurlignage(t) {
  return morceauxSurlignes(t).map((m) => m.texte).join("");
}

export function nombreSurlignes(t) {
  return morceauxSurlignes(t).filter((m) => m.jaune).length;
}

// Phrases d'un texte (coupe après . ! ? … suivis d'une majuscule, d'un chiffre
// ou d'un guillemet ; « {NOM} » compte comme un mot).
export function phrasesDe(t) {
  return String(t ?? "")
    .split(/(?<=[.!?…])\s+(?=[«"“({\p{Lu}\d])/u)
    .map((p) => p.trim())
    .filter(Boolean);
}

// Phrases de plus de `max` mots.
export function phrasesTropLongues(t, max = MOTS_MAX_PHRASE) {
  return phrasesDe(sansGras(sansSurlignage(t)))
    .map((phrase) => ({ phrase, mots: nombreDeMots(phrase) }))
    .filter(({ mots }) => mots > max);
}

// Tournures « IA » présentes dans un texte (liste TOURNURES_IA par défaut).
export function tournuresIA(t, liste = TOURNURES_IA) {
  const s = ` ${sansAccents(sansGras(t)).replace(/[’']/g, "'")} `;
  return liste.filter((tournure) => {
    const motif = sansAccents(tournure).replace(/[’']/g, "'").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^\\p{L}])${motif}($|[^\\p{L}])`, "u").test(s);
  });
}

// Le texte nomme-t-il le candidat ? Le marqueur {NOM} ou {CANDIDAT}, son nom
// complet, son nom sans le prénom, ou son dernier mot de 4 lettres au moins,
// en mots entiers (« Le Pen » ne se confond pas avec « pension »).
export function nommeCandidat(t, candidatNom) {
  if (/\{(NOM|CANDIDAT)\}/.test(t ?? "")) return true;
  if (!candidatNom) return false;
  const s = ` ${sansAccents(sansGras(sansSurlignage(t)))} `;
  const mots = String(candidatNom).trim().split(/\s+/);
  const formes = [candidatNom, mots.slice(1).join(" "), mots.at(-1).length >= 4 ? mots.at(-1) : ""].map(sansAccents).filter((forme) => forme.length >= 4);
  return formes.some((forme) => new RegExp(`(^|[^\\p{L}])${forme.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\p{L}])`, "u").test(s));
}

// Verbe au conditionnel présent (« réduirait », « pourraient », « serions »…).
// Repérage par la terminaison, sur des mots d'au moins 6 lettres (évite
// « mais », « jamais », « vrais »).
export function contientConditionnel(t) {
  return /(^|[^\p{L}])\p{L}{2,}r(?:ais|ait|ions|iez|aient)($|[^\p{L}])/u.test(sansGras(t));
}

// Libellés du barème (src/lib/score.js), cherchés comme mots entiers.
export function palierEcrit(t) {
  const sans = t.toLowerCase();
  return getScoreBands()
    .map((bande) => bande.label)
    .find((label) => new RegExp(`(^|[^\\p{L}])${label.toLowerCase()}($|[^\\p{L}])`, "u").test(sans));
}

// La note du candidat écrite telle quelle (« 45 », « 45,5 ») dans un texte.
function scoreEcrit(t, score) {
  if (score === null || score === undefined || !Number.isFinite(Number(score))) return false;
  const formes = [String(score), String(score).replace(".", ",")];
  return formes.some((forme) => new RegExp(`(^|[^\\d,.])${forme.replace(".", "\\.")}($|[^\\d,.])`).test(t));
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

// Format court d'une valeur de tuile : « près de 600 milliards d'euros » →
// « ~600 Md€ », « 3 millions » → « 3 M », « 1 830 euros » → « 1 830 € ».
// Valeur laissée telle quelle si elle ne suit pas ce schéma (mots en plus).
export function valeurCourte(valeur) {
  const v = texte(valeur);
  const m = v.match(/^(près de|environ|quelque|presque)?\s*([+−-]?\d{1,3}(?:[\s  ]\d{3})*(?:,\d+)?|[+−-]?\d+(?:,\d+)?)\s*(milliards?|millions?|milliers?|Md|M)?\s*(d['’]euros|d['’]€|euros?|€)?$/i);
  if (!m) return v;
  const [, approx, nombre, unite, euro] = m;
  const u = unite ? { milliard: "Md", milliards: "Md", million: "M", millions: "M", millier: "k", milliers: "k", md: "Md", m: "M" }[unite.toLowerCase()] : "";
  const suffixe = u ? `${u}${euro ? "€" : ""}` : euro ? "€" : "";
  const court = `${approx ? "~" : ""}${nombre.replace(/[\s  ]/g, " ")}${suffixe ? ` ${suffixe}` : ""}`;
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

// Effets { acteur, texte, pastille } normalisés (3 au plus).
function effets(liste, cle, avertissements, erreurs) {
  const bruts = Array.isArray(liste) ? liste : [];
  if (bruts.length !== EFFETS_PAR_SLIDE && bruts.length > 0) {
    avertissements.push(`${cle} : ${bruts.length} effet(s), ${EFFETS_PAR_SLIDE} attendus${bruts.length > EFFETS_PAR_SLIDE ? `, seuls les ${EFFETS_PAR_SLIDE} premiers sont gardés` : ""}.`);
  }
  return bruts.slice(0, EFFETS_PAR_SLIDE).map((effet, i) => ({
    acteur: texte(effet?.acteur ?? effet?.titre),
    texte: texte(effet?.texte),
    pastille: pastilleControlee(effet?.pastille, `${cle} ${i + 1}`, erreurs),
  }));
}

// Récit stocké dans un format plus ancien (v5 et avant : « concretement »).
export function formatAncien(recit) {
  return Boolean(recit && typeof recit === "object" && (recit.concretement || recit.tient?.tient) && !recit.constat);
}

// Contrôle de la réponse du modèle. Refus (erreurs) pour : JSON invalide
// (structure ou champ manquant), nombre absent de la fiche, tiret cadratin,
// score ou niveau écrit par le modèle, couverture qui porte la note ou le
// verdict, slide 2 où la proposition passe avant le constat ou sans le nom du
// candidat, lieu ou année d'une mesure comparable absents de la fiche,
// pastille hors liste, mot-clé d'illustration hors liste. Tout le reste est
// un avertissement.
//   raw : objet proposé par le modèle (ou récit déjà stocké, pour le relire) ;
//   ficheFinale : fiche envoyée au modèle (référence des nombres et des mesures comparables) ;
//   valeurs : valeurs des marqueurs (valeursReseaux), pour mesurer le tweet ;
//   score : note calculée par le code (pour la repérer sur la couverture) ;
//   motsClesIllustration : liste fermée des mots-clés d'illustration du thème
//     (null : pas de contrôle, pour la relecture d'un récit stocké).
// Renvoie { valide, erreurs, avertissements, recit } ; recit : réponse
// normalisée (textes nettoyés, tweet assemblé), null si la structure est invalide.
export function controlerRecit(raw, { ficheFinale, candidatNom, valeurs, score = null, motsClesIllustration = null }) {
  const erreurs = [];
  const avertissements = [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { valide: false, erreurs: ["JSON invalide : un objet est attendu."], avertissements, recit: null };
  }
  if (formatAncien(raw)) {
    return { valide: false, erreurs: ["Carrousel détaillé au format précédent (v5) : à régénérer avec le nouveau prompt."], avertissements, recit: null };
  }

  const c = raw.couverture ?? {};
  const k = raw.constat ?? {};
  const n = raw.note ?? {};
  const a = raw.avis ?? {};
  const chiffresBruts = Array.isArray(k.chiffres) ? k.chiffres : [];
  const recit = {
    couverture: { question: texte(c.question) },
    constat: {
      titre: texte(k.titre),
      explication: texte(k.explication),
      chiffres: chiffresBruts.slice(0, CHIFFRES_CONSTAT).map((chiffre) => ({ ...tuileCourte(chiffre), jaune: chiffre?.jaune === true })),
      proposition: texte(k.proposition),
      imprecisions: texte(k.imprecisions),
      sources: texte(k.sources),
    },
    note: {
      titre: texte(n.titre),
      explication: texte(n.explication),
      // Lignes par critère : facultatives (anciennes versions), plus affichées.
      criteres: Object.fromEntries(CLES_CRITERES.map((cle) => [cle, texte(n.criteres?.[cle])])),
    },
    court_terme: { titre: texte(raw.court_terme?.titre), effets: effets(raw.court_terme?.effets, "court terme, effet", avertissements, erreurs) },
    long_terme: { titre: texte(raw.long_terme?.titre), effets: effets(raw.long_terme?.effets, "long terme, effet", avertissements, erreurs) },
    ailleurs: null,
    avis: {
      avis: texte(a.avis).replace(/^notre avis\s*:\s*/i, ""),
      tient: (Array.isArray(a.tient) ? a.tient : []).map(texte).filter(Boolean),
      coince: (Array.isArray(a.coince) ? a.coince : []).map(texte).filter(Boolean),
    },
    illustration_mots_cles: (Array.isArray(raw.illustration_mots_cles) ? raw.illustration_mots_cles : []).map(motCleNormalise).filter(Boolean),
    illustration_sujet: motCleNormalise(raw.illustration_sujet ?? ""),
    legende: Object.fromEntries(PARTIES_LEGENDE.map((partie) => [partie, texte(raw.legende?.[partie])])),
  };
  // Tweet long : plus demandé au modèle (il a son propre prompt,
  // src/lib/tweet-long.js). Celui d'un ancien carrousel stocké reste lu.
  const avecTweet = Boolean(raw.tweet && typeof raw.tweet === "object");
  if (avecTweet) recit.tweet = Object.fromEntries(PARTIES_TWEET.map((partie) => [partie, texte(raw.tweet?.[partie])]));
  const mesuresBrutes = Array.isArray(raw.ailleurs?.mesures) ? raw.ailleurs.mesures : [];
  if (raw.ailleurs && typeof raw.ailleurs === "object" && mesuresBrutes.length > 0) {
    if (mesuresBrutes.length > 2) avertissements.push(`ailleurs ou avant : ${mesuresBrutes.length} mesures, seules les 2 premières sont gardées.`);
    recit.ailleurs = {
      titre: texte(raw.ailleurs.titre),
      mesures: mesuresBrutes.slice(0, 2).map((m, i) => ({
        lieu: texte(m?.lieu ?? m?.pays),
        annee: texte(String(m?.annee ?? "")),
        fait: texte(m?.fait),
        resultat: texte(m?.resultat),
        pastille: pastilleControlee(m?.pastille, `ailleurs ou avant ${i + 1}`, erreurs),
      })),
      sources: texte(raw.ailleurs.sources),
    };
  }

  // Structure (JSON invalide si un champ attendu manque).
  const manquants = [
    ["couverture.question", recit.couverture.question],
    ["constat.titre", recit.constat.titre],
    ["constat.explication", recit.constat.explication],
    ["constat.chiffres", recit.constat.chiffres.length ? "ok" : ""],
    ...recit.constat.chiffres.map((chiffre, i) => [`constat.chiffres.${i}.valeur`, chiffre.valeur]),
    ["constat.proposition", recit.constat.proposition],
    ["note.titre", recit.note.titre],
    ["note.explication", recit.note.explication],
    ["court_terme.titre", recit.court_terme.titre],
    ["court_terme.effets", recit.court_terme.effets.length ? "ok" : ""],
    ["long_terme.titre", recit.long_terme.titre],
    ["long_terme.effets", recit.long_terme.effets.length ? "ok" : ""],
    ...["court_terme", "long_terme"].flatMap((partie) =>
      recit[partie].effets.flatMap((effet, i) => [
        [`${partie}.effets.${i}.acteur`, effet.acteur],
        [`${partie}.effets.${i}.texte`, effet.texte],
      ]),
    ),
    ["avis.avis", recit.avis.avis],
    ["avis.tient", recit.avis.tient.length ? "ok" : ""],
    ["avis.coince", recit.avis.coince.length ? "ok" : ""],
    ...PARTIES_LEGENDE.map((partie) => [`legende.${partie}`, recit.legende[partie]]),
    ...(avecTweet ? PARTIES_TWEET.map((partie) => [`tweet.${partie}`, recit.tweet[partie]]) : []),
    ...(recit.ailleurs?.mesures ?? []).flatMap((m, i) => [
      [`ailleurs.mesures.${i}.lieu`, m.lieu],
      [`ailleurs.mesures.${i}.fait`, m.fait],
    ]),
  ]
    .filter(([, valeur]) => !valeur)
    .map(([chemin]) => chemin);
  if (manquants.length > 0) {
    return { valide: false, erreurs: [`JSON invalide : champ(s) manquant(s) ou vide(s) : ${manquants.join(", ")}.`], avertissements, recit: null };
  }
  if (avecTweet) recit.tweet_assemble = assemblerTweetRecit(recit.tweet);

  // Tous les textes écrits par le modèle : [libellé, texte, slide, phrases à contrôler ?].
  const textes = [
    ["couverture (question)", recit.couverture.question, "couverture", true],
    ["slide 2 (titre)", recit.constat.titre, "constat", true],
    ["slide 2 (explication)", recit.constat.explication, "constat", true],
    ...recit.constat.chiffres.flatMap(({ valeur, detail }, i) => [
      [`slide 2 (chiffre ${i + 1})`, valeur, "constat", false],
      [`slide 2 (chiffre ${i + 1}, détail)`, detail, "constat", true],
    ]),
    ["slide 2 (proposition)", recit.constat.proposition, "constat", true],
    ["slide 2 (ce qu’elle ne précise pas)", recit.constat.imprecisions, "constat", true],
    ["slide 2 (sources)", recit.constat.sources, "constat", false],
    ["slide 3 (titre)", recit.note.titre, "note", true],
    ["slide 3 (explication)", recit.note.explication, "note", true],
    ...[
      ["court_terme", "slide 4"],
      ["long_terme", "slide 5"],
    ].flatMap(([partie, nom]) => [
      [`${nom} (titre)`, recit[partie].titre, partie, true],
      ...recit[partie].effets.flatMap((effet, i) => [
        [`${nom}, effet ${i + 1} (acteur)`, effet.acteur, partie, false],
        [`${nom}, effet ${i + 1}`, effet.texte, partie, true],
      ]),
    ]),
    ...(recit.ailleurs
      ? [
          ["ailleurs ou avant (titre)", recit.ailleurs.titre, "ailleurs", true],
          ["ailleurs ou avant (sources)", recit.ailleurs.sources, "ailleurs", false],
          ...recit.ailleurs.mesures.flatMap((m, i) => [
            [`ailleurs ou avant ${i + 1} (fait)`, m.fait, "ailleurs", true],
            [`ailleurs ou avant ${i + 1} (résultat)`, m.resultat, "ailleurs", true],
          ]),
        ]
      : []),
    ["notre avis", recit.avis.avis, "avis", true],
    ...recit.avis.tient.map((point, i) => [`ce qui tient ${i + 1}`, point, "avis", true]),
    ...recit.avis.coince.map((point, i) => [`ce qui coince ${i + 1}`, point, "avis", true]),
    ...PARTIES_LEGENDE.map((partie) => [`légende (${partie})`, recit.legende[partie], "legende", true]),
    ...(avecTweet ? PARTIES_TWEET.map((partie) => [`tweet long (${partie})`, recit.tweet[partie], "tweet", false]) : []),
  ];

  // --- Refus ---
  const horsFiche = nombresHorsFiche(
    [...textes.map(([, t2]) => sansGras(sansSurlignage(t2)).replace(/\{[A-Z]+\}/g, "")), ...(recit.ailleurs?.mesures ?? []).map((m) => m.annee)],
    ficheFinale,
  );
  if (horsFiche.length > 0) erreurs.push(`Nombre(s) absent(s) de la fiche : ${horsFiche.join(", ")}.`);
  for (const [libelle, t2] of textes) {
    if (t2.includes("—")) erreurs.push(`${libelle} : tiret cadratin (interdit).`);
    if (/\d+(?:[,.]\d+)?\s*(?:\/|sur)\s*100\b/i.test(t2) || /\{(SCORE|APPRECIATION|PASTILLE)\}/.test(t2) || /[🔴🟠🟡🟢]/u.test(t2)) {
      erreurs.push(`${libelle} : score ou pastille de note écrits par le modèle (le code les ajoute).`);
    }
    const palier = palierEcrit(sansGras(sansSurlignage(t2)));
    if (palier) erreurs.push(`${libelle} : niveau « ${palier} » écrit par le modèle (le code l’ajoute).`);
  }
  // Couverture : jamais la note ni le verdict.
  const question = sansSurlignage(recit.couverture.question);
  if (scoreEcrit(question, score) || /\bnot[ée]e?s?\b/i.test(question) || /\bverdict\b/i.test(question)) {
    erreurs.push(`couverture : la note ou le verdict apparaît (« ${question} ») : jamais sur la couverture.`);
  }
  // Charte RS (page 4) : couverture avec le seul nom de famille (marqueur
  // {NOM}, rempli par le code), pas d'intertitre de rubrique, aucun reste de maquette.
  if (contientPrenom(recit.couverture.question, candidatNom)) {
    erreurs.push(`couverture : prénom du candidat (« ${question} ») : seulement le nom de famille ({NOM}).`);
  }
  for (const [libelle, titre] of [
    ["slide 2 (titre)", recit.constat.titre],
    ["slide 3 (titre)", recit.note.titre],
    ["slide 4 (titre)", recit.court_terme.titre],
    ["slide 5 (titre)", recit.long_terme.titre],
    ["ailleurs ou avant (titre)", recit.ailleurs?.titre ?? ""],
    ["notre avis", recit.avis.avis],
  ]) {
    if (titre && estRubrique(titre)) erreurs.push(`${libelle} : « ${titre} » est un intertitre de rubrique : chaque titre apporte un fait, un chiffre ou une conséquence.`);
  }
  for (const [libelle, t2] of textes) {
    const restes = restesDeMaquette(t2.replace(/\{(NOM|CANDIDAT)\}/g, ""));
    if (restes.length) erreurs.push(`${libelle} : reste de maquette (${restes.join(", ")}).`);
  }
  // Slide 2 : le constat d'abord, la proposition ensuite, avec le nom du candidat.
  for (const [libelle, t2] of [
    ["titre", recit.constat.titre],
    ["explication", recit.constat.explication],
  ]) {
    if (nommeCandidat(t2, candidatNom) || /\b(sa proposition|son plan|sa reforme|il propose|elle propose|le candidat|la candidate)\b/.test(sansAccents(t2))) {
      erreurs.push(`slide 2 (${libelle}) : la proposition du candidat apparaît avant le constat (« ${t2} »). Le titre et l’explication portent sur le constat seul.`);
    }
  }
  if (!nommeCandidat(recit.constat.proposition, candidatNom)) {
    erreurs.push(`slide 2 (proposition) : le nom du candidat manque (« La proposition de {NOM} : … » attendu).`);
  }
  // Mesures comparables : lieu et année doivent figurer dans la fiche.
  const ficheTexte = sansAccents(JSON.stringify(ficheFinale ?? {}));
  for (const [i, m] of (recit.ailleurs?.mesures ?? []).entries()) {
    if (!ficheTexte.includes(sansAccents(m.lieu))) erreurs.push(`ailleurs ou avant ${i + 1} : lieu « ${m.lieu} » absent de la fiche (jamais de mesure ajoutée).`);
    if (m.annee && !ficheTexte.includes(sansAccents(m.annee))) erreurs.push(`ailleurs ou avant ${i + 1} : année « ${m.annee} » absente de la fiche.`);
  }
  // Mots-clés d'illustration : 2 au plus, dans la liste fermée de la
  // bibliothèque ; `illustration_sujet` : le sujet concret de la mesure.
  if (motsClesIllustration) {
    for (const mot of recit.illustration_mots_cles) {
      if (!motsClesIllustration.includes(mot)) erreurs.push(`illustration : mot-clé « ${mot} » hors de la liste de la bibliothèque (${motsClesIllustration.join(", ") || "liste vide"}).`);
    }
    if (!recit.illustration_sujet) avertissements.push("illustration : sujet de la mesure (illustration_sujet) absent.");
  }
  if (recit.illustration_mots_cles.length > 2) {
    avertissements.push(`illustration : ${recit.illustration_mots_cles.length} mots-clés, seuls les 2 premiers sont gardés.`);
    recit.illustration_mots_cles = recit.illustration_mots_cles.slice(0, 2);
  }

  // --- Avertissements ---
  // Couverture.
  const q = recit.couverture.question;
  const surlignes = nombreSurlignes(q);
  if (surlignes < SURLIGNES_MIN || surlignes > SURLIGNES_MAX) avertissements.push(`couverture : ${surlignes} mot(s) clé(s) surligné(s) (==…==), ${SURLIGNES_MIN} à ${SURLIGNES_MAX} attendus.`);
  if (!question.trim().endsWith("?")) avertissements.push(`couverture : « ${question} » n’est pas une question (« ? » final attendu).`);
  if (nombreDeMots(question.replace(/\{NOM\}/g, candidatNom ?? "X")) > MOTS_MAX_QUESTION) avertissements.push(`couverture : question de ${nombreDeMots(question)} mots (${MOTS_MAX_QUESTION} au plus).`);
  if (!nommeCandidat(q, candidatNom)) avertissements.push("couverture : la question ne nomme pas le candidat.");
  if (nombreGras(q) > 0) {
    avertissements.push("couverture : balisage ** inutile (le surlignage jaune se marque ==…==), retiré.");
    recit.couverture.question = sansGras(q);
  }
  // Slide 2.
  if (!contientChiffre(recit.constat.titre)) avertissements.push(`slide 2 (titre) : « ${recit.constat.titre} » sans chiffre : un titre de constat chiffré informe mieux (« Retraites : un trou de 6,8 milliards en 2030. »).`);
  if (recit.constat.chiffres.length !== CHIFFRES_CONSTAT) avertissements.push(`slide 2 : ${recit.constat.chiffres.length} chiffre(s) clé(s), ${CHIFFRES_CONSTAT} attendus.`);
  const jaunes = recit.constat.chiffres.filter((ch) => ch.jaune).length;
  if (jaunes !== 1) {
    avertissements.push(`slide 2 : ${jaunes} chiffre(s) en jaune, un seul attendu (le premier ${jaunes ? "marqué" : "chiffre"} est retenu).`);
    const retenu = Math.max(0, recit.constat.chiffres.findIndex((ch) => ch.jaune));
    recit.constat.chiffres = recit.constat.chiffres.map((ch, i) => ({ ...ch, jaune: i === retenu }));
  }
  for (const [i, { valeur }] of recit.constat.chiffres.entries()) {
    if (valeur.length > VALEUR_TUILE_MAX) avertissements.push(`slide 2 (chiffre ${i + 1}) : « ${valeur} » trop long pour la tuile (${VALEUR_TUILE_MAX} caractères au plus, format court « ~600 Md€ » attendu).`);
  }
  if (!/^la proposition de\b/i.test(recit.constat.proposition)) avertissements.push("slide 2 (proposition) : la phrase devrait commencer par « La proposition de {NOM} : ».");
  if (!recit.constat.imprecisions) avertissements.push("slide 2 : pas de phrase sur ce que la proposition ne précise pas.");
  if (!recit.constat.sources) avertissements.push("slide 2 : pas de ligne « Source : … ».");
  // Slide 3.
  if (!nommeCandidat(recit.note.titre, candidatNom)) avertissements.push("slide 3 (titre) : le titre d’avis ne nomme pas le candidat.");
  // Slides 4 et 5 : effets au conditionnel.
  for (const [partie, nom] of [
    ["court_terme", "slide 4"],
    ["long_terme", "slide 5"],
  ]) {
    for (const [i, effet] of recit[partie].effets.entries()) {
      if (!contientConditionnel(effet.texte)) avertissements.push(`${nom}, effet ${i + 1} (${effet.acteur}) : pas de verbe au conditionnel (« réduirait », « pourrait »…).`);
    }
  }
  // Slide 7.
  for (const [cote, points] of [
    ["ce qui tient", recit.avis.tient],
    ["ce qui coince", recit.avis.coince],
  ]) {
    if (points.length < 2 || points.length > 3) avertissements.push(`${cote} : ${points.length} point(s), 2 à 3 attendus${points.length > 3 ? " (les 3 premiers sont affichés)" : ""}.`);
  }
  if (phrasesDe(recit.avis.avis).length > 1) avertissements.push("notre avis : une seule phrase attendue.");
  // Phrases trop longues et tournures « IA » (slides et légende).
  for (const [libelle, t2, , phrases] of textes) {
    if (phrases) {
      for (const { mots } of phrasesTropLongues(t2)) avertissements.push(`${libelle} : phrase de ${mots} mots (${MOTS_MAX_PHRASE} au plus).`);
    }
    for (const tournure of tournuresIA(t2)) avertissements.push(`${libelle} : tournure « ${tournure} » qui sonne « IA ».`);
    if (grasDesequilibre(t2)) avertissements.push(`${libelle} : balisage ** non fermé, ignoré.`);
  }
  // Gras par slide.
  const grasParSlide = {};
  for (const [, t2, slide] of textes) grasParSlide[slide] = (grasParSlide[slide] ?? 0) + (["tweet", "legende"].includes(slide) ? nombreGras(t2) : nombreMotsGras(t2));
  for (const [slide, nombre] of Object.entries(grasParSlide)) {
    if (["tweet", "legende"].includes(slide)) {
      if (nombre > 0) avertissements.push(`${slide === "tweet" ? "tweet long" : "légende"} : balisage ** inutile hors des slides (X et Instagram ne l’affichent pas).`);
    } else if (nombre > MOTS_GRAS_MAX_PAR_SLIDE) {
      avertissements.push(`${slide} : ${nombre} mots en gras (${MOTS_GRAS_MAX_PAR_SLIDE} au plus par slide), les passages en trop seront en texte normal.`);
    }
  }
  if (avecTweet && !mentionneCandidat(recit.tweet.promesse, candidatNom)) avertissements.push("tweet long (promesse) : le candidat n’est pas nommé.");
  for (const [libelle, t2] of textes) {
    if (/(^|\s)@\w/.test(t2)) avertissements.push(`${libelle} : compte écrit à la main (@…) au lieu de {CANDIDAT}.`);
    if (libelle.startsWith("légende") && /(^|\s)#\w/.test(t2)) avertissements.push(`${libelle} : hashtag écrit par le modèle (le code les ajoute).`);
  }
  if (valeurs && avecTweet) {
    const longueur = longueurX(remplirTweet(recit.tweet_assemble, valeurs));
    if (longueur < TWEET_LONG_MIN || longueur > TWEET_LONG_MAX) {
      avertissements.push(`tweet long : ${longueur} caractères (${TWEET_LONG_MIN} à ${TWEET_LONG_MAX} visés).`);
    }
  }

  return { valide: erreurs.length === 0, erreurs, avertissements, recit };
}

// --- Remarques et régénération ciblée -------------------------------------------------

// Parties de la réponse du modèle visées par une remarque : une slide (par
// son type, src/lib/carrousel-recit.js), la légende, ou « toutes ». Le tweet
// long n'en fait plus partie (son propre bouton, src/lib/tweet-long.js).
// La slide de fin est écrite par le code : elle ne se régénère pas.
export const PARTIES_PAR_CIBLE = {
  couverture: ["couverture", "illustration_mots_cles", "illustration_sujet"],
  constat: ["constat"],
  noteRecit: ["note"],
  effetsCourt: ["court_terme"],
  effetsLong: ["long_terme"],
  ailleurs: ["ailleurs"],
  avis: ["avis"],
  legende: ["legende"],
};
const PARTIES_REPONSE = ["couverture", "constat", "note", "court_terme", "long_terme", "ailleurs", "avis", "illustration_mots_cles", "illustration_sujet", "legende"];

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
    "Remarques de l'équipe, à appliquer comme consignes supplémentaires. Elles ne passent JAMAIS avant les règles ci-dessus : si une remarque demande d'écrire la note, le niveau, un chiffre absent de la fiche, une mesure comparable absente de la fiche ou un tiret cadratin, ignore cette partie de la remarque.",
    `« ${remarque} »`,
    "",
    parties
      ? `Ne réécris que ${libelleCible} (clé(s) JSON : ${parties.join(", ")}). Recopie toutes les autres clés à l'identique, sans rien changer. Réponds avec le JSON complet.`
      : "Réécris l'ensemble en tenant compte des remarques. Réponds avec le JSON complet.",
  ].join("\n");
}

// Consigne de la relance quand un texte déborde de sa slide au rendu : les
// champs à raccourcir, le reste recopié à l'identique. On ne réduit jamais la
// police : on raccourcit le texte.
// Hauteur d'une ligne de texte courant (38 px, interligne 1,32), pour dire
// au modèle combien de lignes gagner.
const LIGNE_COURANTE = 38 * 1.32;

export function consigneRaccourcir(precedent, debordements) {
  const detail = (d) => {
    const lignes = d.manque ? Math.max(1, Math.ceil(d.manque / LIGNE_COURANTE)) : null;
    const gain = lignes ? ` Il faut gagner au moins ${lignes} ligne(s) de texte (${d.manque} px).` : "";
    const champs = d.champs?.length ? ` Raccourcis un ou plusieurs de ces champs : ${d.champs.join(", ")}.` : "";
    return `- slide ${d.numero} (${d.libelle}) : ${d.bloc}.${gain}${champs}`;
  };
  return [
    "TEXTE TROP LONG POUR LA SLIDE.",
    "Voici ta réponse (acceptée), mais certains textes débordent de leur slide au rendu (on ne réduit jamais la police) :",
    ...debordements.map(detail),
    "",
    "Raccourcis UNIQUEMENT ces textes (phrases plus courtes, même sens, mêmes chiffres), sans changer les autres. Recopie toutes les autres clés à l'identique. Réponds avec le JSON complet.",
    JSON.stringify(reponseDepuisRecit(precedent), null, 2),
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
  return { ...recit, format: FORMAT_RECIT, genereLe, ...(modele ? { modele } : {}), ...(illustration ? { illustration } : {}) };
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
// Un ancien tweet long (généré avec le carrousel) est reporté sur la nouvelle
// version, pour rester lisible en section 5.
export function contenuAvecRecit(contenu, recit, retour = null) {
  const base = contenu ?? {};
  const ancien = versionArchivee(base.reseaux_recit);
  const retours = [...(base.reseaux_recit?.retours ?? []), ...(retour ? [retour] : [])];
  const ancienTweet = !recit.tweet_assemble && ancien?.tweet_assemble ? { tweet: ancien.tweet, tweet_assemble: ancien.tweet_assemble } : {};
  return { ...base, reseaux_recit: { ...recit, ...ancienTweet, ...(ancien ? { precedent: ancien } : {}), ...(retours.length ? { retours } : {}) } };
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
