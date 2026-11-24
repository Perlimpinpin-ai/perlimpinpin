import { formatScore, getScoreBadge } from "./score.js";
import { handleX } from "./handles-x.js";
import { urlFiche } from "./slug.js";

// Publications X d'une analyse (contenuComplet.reseaux, étape 3 ter du
// pipeline). Les textes sont enregistrés AVEC leurs marqueurs ({CANDIDAT},
// {NOM}, {PASTILLE}, {SCORE}, {APPRECIATION}, {LIEN}) et remplis seulement à
// l'affichage : le score, le compte X (src/lib/handles-x.js) et le lien sont
// donc toujours ceux du moment. Fonctions PURES, partagées par le pipeline
// (scripts/lib/scoring.js) et les pages /test.

export const MARQUEURS = ["CANDIDAT", "NOM", "PASTILLE", "SCORE", "APPRECIATION", "LIEN"];
export const LONGUEUR_X_MAX = 280;
export const URL_SITE = "https://perlimpinpin.ai";

const PASTILLES = {
  "red-dark": "🔴",
  red: "🔴",
  orange: "🟠",
  amber: "🟡",
  green: "🟢",
  "green-dark": "🟢",
};

export function pastille(score) {
  return PASTILLES[getScoreBadge(score).color] ?? "🟠";
}

// Adresse publique de la fiche : son slug s'il existe (fiche publiée), sinon
// son numéro (brouillon : /declarations/<numéro> redirigera vers le slug une
// fois la fiche publiée).
export function lienAnalyse(propositionId, slug = null) {
  return urlFiche({ id: propositionId, slug });
}

// Valeurs des marqueurs pour une fiche. Sans propositionId (pendant le
// pipeline, avant l'enregistrement), un lien factice : X compte de toute
// façon chaque lien pour 23 caractères.
export function valeursReseaux({ candidatNom, score, propositionId = 0, slug = null, handles }) {
  return {
    CANDIDAT: handleX(candidatNom, handles) ?? candidatNom,
    NOM: candidatNom,
    PASTILLE: pastille(score),
    SCORE: String(formatScore(score)),
    APPRECIATION: getScoreBadge(score).label,
    LIEN: lienAnalyse(propositionId, slug),
  };
}

// « de {NOM} » devient « d’Édouard Philippe » devant une voyelle ou un h (pas
// devant un compte X : « de @… »).
export function remplirTweet(texte, valeurs) {
  return String(texte ?? "")
    .replace(/(^|[^\p{L}])(de|que) \{(NOM|CANDIDAT)\}/gu, (tout, avant, mot, nom) => {
      const valeur = valeurs[nom];
      if (typeof valeur !== "string" || !/^[aeiouyh]/i.test(valeur.normalize("NFD"))) return tout;
      return `${avant}${mot === "de" ? "d’" : "qu’"}${valeur}`;
    })
    .replace(/\{([A-Z]+)\}/g, (marqueur, nom) => valeurs[nom] ?? marqueur);
}

// Marqueurs obligatoires de chaque tweet. Le compte X ({CANDIDAT}) seulement
// dans le premier tweet de chaque format ; le nom sans @ ({NOM}) dans les
// tweets 2 à 4 du fil, pour ne pas notifier le candidat à chaque réponse.
export const MARQUEURS_PAR_TWEET = {
  "fil.0": ["CANDIDAT", "PASTILLE", "SCORE", "APPRECIATION"],
  "fil.1": ["NOM"],
  "fil.2": ["NOM"],
  "fil.3": ["NOM", "LIEN"],
  "chiffre.tweet": ["CANDIDAT", "PASTILLE", "SCORE", "LIEN"],
  "tient.tweet": ["CANDIDAT", "PASTILLE", "SCORE", "LIEN"],
};

// --- Parties variables et assemblage ---------------------------------------
// Le modèle n'écrit que les parties variables (voir data/prompt-reseaux.md) ;
// le code les assemble avec les parties fixes (formules, marqueurs, lien).
// Ce qui est enregistré dans contenuComplet.reseaux est le résultat assemblé,
// toujours avec ses marqueurs.

// Parties variables de chaque tweet (clé « format.partie »). Pour le tweet
// « tient », « courts_tient » et « courts_tient_pas » désignent les versions
// courtes des points (seules les 2 premières de chaque côté vont dans le tweet).
export const PARTIES_PAR_TWEET = {
  "fil.0": ["fil.accroche", "fil.suspense"],
  "fil.1": ["fil.tweet2"],
  "fil.2": ["fil.tweet3"],
  "fil.3": ["fil.angle_mort", "fil.point_solide"],
  "chiffre.tweet": ["chiffre.valeur", "chiffre.explication", "chiffre.mesure_courte"],
  "tient.tweet": ["tient.titre", "tient.courts_tient", "tient.courts_tient_pas"],
};

const POINTS_DANS_LE_TWEET = 2;

// Parties « virtuelles » des points : « tient.courts_tient » (toutes les
// versions courtes d'un côté) et « tient.textes_tient » (tous les textes de
// l'image), lues et réécrites comme des listes de chaînes.
function champDesPoints(cle) {
  const [format, champ] = cle.split(".");
  const virtuel = format === "tient" ? champ.match(/^(courts|textes)_(tient|tient_pas)$/) : null;
  return virtuel ? { cote: virtuel[2], propriete: virtuel[1] === "courts" ? "court" : "texte" } : null;
}

export function lirePartie(parties, cle) {
  const points = champDesPoints(cle);
  if (points) return (parties?.tient?.[points.cote] ?? []).map((point) => point[points.propriete]);
  const [format, champ] = cle.split(".");
  return parties?.[format]?.[champ];
}

export function ecrirePartie(parties, cle, valeur) {
  const copie = structuredClone(parties);
  const points = champDesPoints(cle);
  if (points) {
    valeur.forEach((texte, index) => {
      const point = copie.tient[points.cote][index];
      if (point) copie.tient[points.cote][index] = { ...point, [points.propriete]: texte };
    });
    return copie;
  }
  const [format, champ] = cle.split(".");
  copie[format] = { ...copie[format], [champ]: valeur };
  return copie;
}

// --- Nettoyage par le code -----------------------------------------------------

// « 1,8M » → « 1,8 million », « 3 Md » → « 3 milliards » ; « 141 M€ » reste tel quel.
export function nombresSansAbreviation(texte) {
  return String(texte ?? "").replace(/(\d+(?:,\d+)?)\s?(Md|M)(?![€\p{L}\p{N}])/gu, (_, nombre, unite) => {
    const pluriel = Number(nombre.replace(",", ".")) >= 2 ? "s" : "";
    return `${nombre} ${unite === "Md" ? "milliard" : "million"}${pluriel}`;
  });
}

// Après « L’angle mort … : » ou « Point solide : », minuscule initiale
// (« Aucune compensation… » → « aucune compensation… », « Abroger… » →
// « abroger… »), sauf pour un sigle (« HLM… ») ou un nom propre, repéré par
// deux mots de suite qui commencent par une majuscule (« Marine Le Pen… »).
export function minusculeInitiale(texte) {
  const t = String(texte ?? "");
  const mots = t.match(/^(\p{L}+)(?:[’'\s-]+(\p{L}+))?/u);
  if (!mots) return t;
  const [, premier, second] = mots;
  const majuscule = (mot) => Boolean(mot) && /^\p{Lu}/u.test(mot);
  if (premier.length > 1 && premier === premier.toUpperCase()) return t;
  if (majuscule(premier) && majuscule(second)) return t;
  return t.charAt(0).toLowerCase() + t.slice(1);
}

// « 25% » → « 25 % » (espace avant le signe, comme dans la fiche).
export function espaceAvantPourcent(texte) {
  return String(texte ?? "").replace(/(\d)\s?%/g, "$1 %");
}

// Retire ce que le code ajoute lui-même, si le modèle l'a écrit quand même,
// écrit les nombres sans abréviation et met une espace avant « % ».
function nettoyer(texte, { debut = null, fin = null } = {}) {
  let t = String(texte ?? "").trim();
  if (debut) t = t.replace(debut, "").trim();
  if (fin) t = t.replace(fin, "").trim();
  return espaceAvantPourcent(nombresSansAbreviation(t));
}

function nettoyerPoint(point) {
  return {
    texte: nettoyer(point.texte),
    court: nettoyer(point.court, { debut: /^[✅❌]\s*/u }),
  };
}

// Parties normalisées (débuts « 2/ », flèche et point final de la phrase de
// suspense, majuscules après deux-points, abréviations… corrigés).
export function normaliserParties(p) {
  return {
    fil: {
      accroche: nettoyer(p.fil.accroche, { debut: /^🔵\s*/u }),
      suspense: nettoyer(p.fil.suspense, { fin: /\s*↓?\s*\.?\s*↓?\s*$/u }),
      tweet2: nettoyer(p.fil.tweet2, { debut: /^2\/\s*/ }),
      tweet3: nettoyer(p.fil.tweet3, { debut: /^3\/\s*/ }),
      angle_mort: minusculeInitiale(nettoyer(p.fil.angle_mort, { debut: /^4\/\s*L[’']angle mort[^:]*:\s*/i })),
      point_solide: p.fil.point_solide
        ? minusculeInitiale(nettoyer(p.fil.point_solide, { debut: /^Point solide\s*:\s*/i })) || null
        : null,
    },
    chiffre: {
      valeur: nettoyer(p.chiffre.valeur, { fin: /\.$/ }),
      explication: nettoyer(p.chiffre.explication),
      mesure_courte: nettoyer(p.chiffre.mesure_courte, { fin: /\.$/ }),
    },
    tient: {
      titre: nettoyer(p.tient.titre, { fin: /\.$/ }),
      tient: p.tient.tient.map(nettoyerPoint),
      tient_pas: p.tient.tient_pas.map(nettoyerPoint),
      // Posés par le code (titre de la fiche, repli), conservés d'une passe à l'autre.
      ...(p.tient.titre_source ? { titre_source: p.tient.titre_source } : {}),
      ...(p.tient.dans_le_tweet ? { dans_le_tweet: p.tient.dans_le_tweet } : {}),
      ...(p.tient.entete_court ? { entete_court: true } : {}),
    },
  };
}

// Titre de la carte et du tweet « tient » : le titre court de la fiche
// (titre_fiche) s'il existe et fait 40 caractères au plus ; sinon celui du
// modèle, signalé par un avertissement sur la page de partage.
export const TITRE_TIENT_MAX = 40;

export function appliquerTitreFiche(parties, titreFiche) {
  const titre = typeof titreFiche === "string" ? titreFiche.trim() : "";
  const copie = structuredClone(parties);
  if (titre && titre.length <= TITRE_TIENT_MAX) copie.tient = { ...copie.tient, titre, titre_source: "fiche" };
  else copie.tient = { ...copie.tient, titre_source: "modele" };
  return copie;
}

// Repli du tweet « tient » quand il dépasse 280 caractères, appliqué avant le
// contrôle final (replierTweetTient, scripts/lib/scoring.js) : le code retire
// du tweet le 2e point du côté qui en a le plus (à égalité, celui dont la
// version courte est la plus longue), en gardant au moins 1 point de chaque
// côté. L'image garde tous ses points. Renvoie null si plus rien ne peut être
// retiré (l'en-tête court prend alors le relais).
export function retirerUnPointDuTweet(parties) {
  const actuel = parties.tient.dans_le_tweet ?? {
    tient: Math.min(POINTS_DANS_LE_TWEET, parties.tient.tient.length),
    tient_pas: Math.min(POINTS_DANS_LE_TWEET, parties.tient.tient_pas.length),
  };
  const candidats = ["tient", "tient_pas"]
    .filter((cote) => actuel[cote] > 1)
    .map((cote) => ({ cote, n: actuel[cote], longueur: longueurX(parties.tient[cote][actuel[cote] - 1].court) }))
    .sort((a, b) => b.n - a.n || b.longueur - a.longueur);
  if (candidats.length === 0) return null;
  const { cote } = candidats[0];
  const copie = structuredClone(parties);
  copie.tient.dans_le_tweet = { ...actuel, [cote]: actuel[cote] - 1 };
  return copie;
}

// Tweets assemblés (avec marqueurs) à partir des parties normalisées. L'image
// « tient » garde les `texte` (15 mots au plus) ; le tweet reprend les `court`
// des 2 premiers points de chaque côté. Les versions courtes sont aussi
// enregistrées (tient_court, tient_pas_court) pour la relecture.
export function assemblerReseaux(p) {
  const blocs = (...morceaux) => morceaux.filter((m) => m !== null && m !== undefined).join("\n\n");
  const dansLeTweet = (cote) => p.tient.dans_le_tweet?.[cote] ?? POINTS_DANS_LE_TWEET;
  const courts = (cote) => p.tient[cote].slice(0, dansLeTweet(cote)).map((point) => point.court);
  // Points retirés du tweet par le repli (retirerUnPointDuTweet).
  const retires = ["tient", "tient_pas"].reduce(
    (total, cote) => total + Math.min(POINTS_DANS_LE_TWEET, p.tient[cote].length) - courts(cote).length,
    0,
  );
  return {
    fil: [
      blocs(
        `🔵 ${p.fil.accroche}`,
        "Perlimpinpin.ai analyse la proposition de {CANDIDAT}",
        "Note : {PASTILLE} {SCORE}/100 {APPRECIATION}",
        `${p.fil.suspense} ↓`,
      ),
      `2/ ${p.fil.tweet2}`,
      `3/ ${p.fil.tweet3}`,
      blocs(
        `4/ L’angle mort de la proposition de {NOM} : ${p.fil.angle_mort}`,
        p.fil.point_solide ? `Point solide : ${p.fil.point_solide}` : null,
        "Analyse complète 👇 {LIEN}",
      ),
    ],
    chiffre: {
      valeur: p.chiffre.valeur,
      explication: p.chiffre.explication,
      tweet: blocs(
        `${p.chiffre.valeur}. ${p.chiffre.explication}`,
        `{CANDIDAT} propose ${p.chiffre.mesure_courte}. Notre analyse : {PASTILLE} {SCORE}/100 👇 {LIEN}`,
      ),
    },
    tient: {
      titre: p.tient.titre,
      tient: p.tient.tient.map((point) => point.texte),
      tient_pas: p.tient.tient_pas.map((point) => point.texte),
      tient_court: p.tient.tient.map((point) => point.court),
      tient_pas_court: p.tient.tient_pas.map((point) => point.court),
      ...(p.tient.titre_source ? { titre_source: p.tient.titre_source } : {}),
      ...(retires > 0 ? { points_retires: retires } : {}),
      ...(p.tient.entete_court ? { entete_court: true } : {}),
      tweet: blocs(
        // En-tête court (repli) : sans « la proposition de ».
        p.tient.entete_court
          ? `${p.tient.titre}, {CANDIDAT} : ce qui tient, ce qui ne tient pas.`
          : `${p.tient.titre}, la proposition de {CANDIDAT} : ce qui tient, ce qui ne tient pas.`,
        [...courts("tient").map((court) => `✅ ${court}`), ...courts("tient_pas").map((court) => `❌ ${court}`)].join("\n"),
        "{PASTILLE} {SCORE}/100 · Analyse complète 👇 {LIEN}",
      ),
    },
  };
}

// Budget en caractères de chaque partie variable, pour cette fiche : 280 moins
// les parties fixes remplies (nom ou compte X, appréciation, score, lien
// compté 23), puis réparti entre les parties du tweet. Pour le tweet
// « tient », un budget total pour les versions courtes reprises (2 de chaque
// côté au plus).
const PART_FIXE = { suspense: 80, point_solide: 60, valeur: 12, mesure_courte: 50, titre: 40 };

export function budgetsParties(valeurs) {
  const pointVide = { texte: "", court: "" };
  const vides = {
    fil: { accroche: "", suspense: "", tweet2: "", tweet3: "", angle_mort: "", point_solide: "x" },
    chiffre: { valeur: "", explication: "", mesure_courte: "" },
    tient: { titre: "", tient: [pointVide, pointVide], tient_pas: [pointVide, pointVide] },
  };
  const tweets = assemblerReseaux(vides);
  const reste = (texte, retrait = 0) => LONGUEUR_X_MAX - longueurX(remplirTweet(texte, valeurs)) + retrait;
  const fil0 = reste(tweets.fil[0]);
  const fil3 = reste(tweets.fil[3], 1); // le « x » du point solide vide
  const chiffre = reste(tweets.chiffre.tweet);
  const tient = reste(tweets.tient.tweet);
  return {
    "fil.accroche": fil0 - PART_FIXE.suspense,
    "fil.suspense": PART_FIXE.suspense,
    "fil.tweet2": reste(tweets.fil[1]),
    "fil.tweet3": reste(tweets.fil[2]),
    "fil.angle_mort": fil3 - PART_FIXE.point_solide,
    "fil.point_solide": PART_FIXE.point_solide,
    "chiffre.valeur": PART_FIXE.valeur,
    "chiffre.mesure_courte": PART_FIXE.mesure_courte,
    "chiffre.explication": chiffre - PART_FIXE.valeur - PART_FIXE.mesure_courte,
    "tient.titre": PART_FIXE.titre,
    "tient.court": tient - PART_FIXE.titre,
  };
}

// Longueur comptée par X (règles de twitter-text) : tout lien compte 23, un
// domaine nu comme « Perlimpinpin.ai » aussi (X le transforme en lien), un
// emoji compte 2, et chaque caractère hors des plages « latines » aussi
// (€, …, ↓ comptent 2 ; é, «, ’ comptent 1).
const PLAGES_SIMPLES = [
  [0, 4351],
  [8192, 8205],
  [8208, 8223],
  [8242, 8247],
];
const segmenteur = new Intl.Segmenter("fr", { granularity: "grapheme" });

function poidsCaractere(codePoint) {
  return PLAGES_SIMPLES.some(([min, max]) => codePoint >= min && codePoint <= max) ? 1 : 2;
}

export function longueurX(texte) {
  let liens = 0;
  const sansLiens = String(texte ?? "")
    .replace(/https?:\/\/\S+/gi, () => {
      liens += 1;
      return "";
    })
    .replace(/\bperlimpinpin\.ai\b/gi, () => {
      liens += 1;
      return "";
    });
  let longueur = liens * 23;
  for (const { segment } of segmenteur.segment(sansLiens)) {
    if (/\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(segment)) longueur += 2;
    else for (const caractere of segment) longueur += poidsCaractere(caractere.codePointAt(0));
  }
  return longueur;
}

// Les 6 tweets d'une fiche, dans l'ordre de publication conseillé, marqueurs
// remplis. `reseaux` : contenuComplet.reseaux (déjà validé).
export function tweetsReseaux(reseaux, valeurs) {
  if (!reseaux) return [];
  return [
    ...(reseaux.fil ?? []).map((texte, index) => ({ format: "score", cle: `fil.${index}`, texte: remplirTweet(texte, valeurs) })),
    { format: "chiffre", cle: "chiffre.tweet", texte: remplirTweet(reseaux.chiffre?.tweet, valeurs) },
    { format: "tient", cle: "tient.tweet", texte: remplirTweet(reseaux.tient?.tweet, valeurs) },
  ].map((tweet) => ({ ...tweet, longueur: longueurX(tweet.texte) }));
}

// --- Avertissements de relecture (jamais de refus) ---------------------------

// Une version courte commence par un déterminant (« Le », « L’ », « Aucune »…)
// ou par un nom propre ou un sigle (« Marine Le Pen », « HLM ») ; « Retire un
// levier… » (verbe sans sujet) est signalé.
const DEBUTS_ADMIS = new Set(["le", "la", "l", "les", "un", "une", "aucun", "aucune", "ce", "cette", "son", "sa", "ses"]);

function commenceParUnSujet(texte) {
  const mots = String(texte ?? "").trim().match(/^(\p{L}+)(?:[’'\s-]+(\p{L}+))?/u);
  if (!mots) return false;
  const [, premier, second] = mots;
  if (DEBUTS_ADMIS.has(premier.toLowerCase())) return true;
  if (premier.length > 1 && premier === premier.toUpperCase()) return true; // sigle
  return /^\p{Lu}/u.test(premier) && Boolean(second) && /^\p{Lu}/u.test(second); // nom propre
}

// Deux nombres séparés seulement par une espace (« depuis 2000 20 à 25 % »),
// hors séparateur de milliers (« 1 100 communes », « 2 900 000 »).
export function nombresColles(texte) {
  return [...String(texte ?? "").matchAll(/(\d+(?:,\d+)?)[  ](\d+(?:,\d+)?)/g)]
    .filter(([, a, b]) => !(/^\d{1,3}$/.test(a) && /^\d{3}$/.test(b)))
    .map(([tout]) => tout);
}

// Limites de mots : des avertissements, jamais des refus (les tenir à tout prix
// poussait le modèle à déformer le sens).
export const LIMITES_MOTS = { suspense: 15, titre: 6, explication: 20, texte: 15, court: 10 };

export function nombreDeMots(texte) {
  return String(texte ?? "").split(/\s+/).filter((mot) => /[\p{L}\p{N}]/u.test(mot)).length;
}

// Libellés d'appréciation de plusieurs mots, repérés tels quels (« fragile »,
// « exemplaire »… sont aussi des mots courants).
const APPRECIATIONS = ["Solide et chiffré", "Plausible sous condition", "Partiellement fondé"];

// Le tweet nomme-t-il le candidat ? Le marqueur ({NOM} ou {CANDIDAT}), son nom
// complet, ou son nom de famille écrit en toutes lettres (« Le Pen »,
// « de Villepin » ou « Villepin »), sans tenir compte des accents ni de la casse.
function sansAccents(texte) {
  return String(texte ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function mentionneCandidat(texte, candidatNom) {
  if (/\{(NOM|CANDIDAT)\}/.test(texte ?? "")) return true;
  if (!candidatNom) return false;
  const t = sansAccents(texte);
  const mots = String(candidatNom).trim().split(/\s+/);
  const formes = [candidatNom, mots.slice(1).join(" "), mots.at(-1)]
    .map(sansAccents)
    .filter((forme) => forme.length >= 3);
  return formes.some((forme) => t.includes(forme));
}

// Liste de { cle, message } pour la page de partage et scripts/reseaux.js.
// `valeurs` (valeursReseaux) : nom du candidat et valeurs des marqueurs, pour
// mesurer les tweets et vérifier que chacun nomme le candidat.
export function avertissementsReseaux(reseaux, { valeurs } = {}) {
  if (!reseaux) return [];
  const avertissements = [];
  const tient = reseaux.tient ?? {};
  const fil = reseaux.fil ?? [];

  // Avertissement fort : tweet encore trop long après le repli et les passes.
  if (valeurs) {
    for (const tweet of tweetsReseaux(reseaux, valeurs)) {
      if (tweet.longueur > LONGUEUR_X_MAX) {
        avertissements.push({
          cle: tweet.cle,
          fort: true,
          message: `${tweet.longueur} caractères comptés par X (${LONGUEUR_X_MAX} au plus) : à raccourcir avant de poster.`,
        });
      }
    }
  }

  // Chaque tweet nomme le candidat, et les autres marqueurs obligatoires sont là.
  const tweetsAssembles = {
    "fil.0": fil[0],
    "fil.1": fil[1],
    "fil.2": fil[2],
    "fil.3": fil[3],
    "chiffre.tweet": reseaux.chiffre?.tweet,
    "tient.tweet": tient.tweet,
  };
  for (const [cle, marqueurs] of Object.entries(MARQUEURS_PAR_TWEET)) {
    const texte = tweetsAssembles[cle];
    if (typeof texte !== "string") continue;
    if (!mentionneCandidat(texte, valeurs?.NOM)) {
      avertissements.push({ cle, message: "Le candidat n'est pas nommé (ni marqueur, ni nom complet, ni nom de famille)." });
    }
    for (const marqueur of marqueurs.filter((m) => m !== "NOM" && m !== "CANDIDAT")) {
      if (!texte.includes(`{${marqueur}}`)) avertissements.push({ cle, message: `Le marqueur {${marqueur}} manque.` });
    }
  }

  if (tient.titre_source === "modele") {
    avertissements.push({
      cle: "tient.titre",
      message: `Titre écrit par le modèle (le titre court de la fiche manque ou dépasse ${TITRE_TIENT_MAX} caractères) : « ${tient.titre} ».`,
    });
  }
  if (tient.points_retires) {
    avertissements.push({
      cle: "tient.tweet",
      message: `${tient.points_retires} point(s) retiré(s) du tweet pour tenir en ${LONGUEUR_X_MAX} caractères (l'image les garde).`,
    });
  }
  if (tient.entete_court) {
    avertissements.push({ cle: "tient.tweet", message: "En-tête raccourci (« la proposition de » retiré) pour tenir en 280 caractères." });
  }

  // Limites de mots.
  const suspense = String(fil[0] ?? "").split("\n").map((ligne) => ligne.trim()).filter(Boolean).at(-1) ?? "";
  const limites = [
    ["fil.0 (suspense)", fil[0] ? [suspense.replace(/\s*↓$/u, "")] : [], LIMITES_MOTS.suspense],
    ["tient.titre", tient.titre_source === "fiche" || !tient.titre ? [] : [tient.titre], LIMITES_MOTS.titre],
    ["chiffre.explication", reseaux.chiffre?.explication ? [reseaux.chiffre.explication] : [], LIMITES_MOTS.explication],
    ["tient.tient", tient.tient ?? [], LIMITES_MOTS.texte],
    ["tient.tient_pas", tient.tient_pas ?? [], LIMITES_MOTS.texte],
    ["tient.tient (court)", tient.tient_court ?? [], LIMITES_MOTS.court],
    ["tient.tient_pas (court)", tient.tient_pas_court ?? [], LIMITES_MOTS.court],
  ];
  for (const [cle, textes, max] of limites) {
    for (const texte of textes) {
      const mots = nombreDeMots(texte);
      if (mots > max) avertissements.push({ cle, message: `${mots} mots (${max} conseillés) : « ${texte} ».` });
    }
  }

  // Compte X, note, pastille ou appréciation écrits à la main au lieu des
  // marqueurs ; compte X ({CANDIDAT}) dans les réponses du fil.
  const tweets = [
    ...fil.map((texte, i) => [`fil.${i}`, texte]),
    ["chiffre.tweet", reseaux.chiffre?.tweet],
    ["tient.tweet", tient.tweet],
  ].filter(([, texte]) => typeof texte === "string");
  for (const [cle, texte] of tweets) {
    for (const [, nom] of texte.matchAll(/\{([^}]*)\}/g)) {
      if (!MARQUEURS.includes(nom)) avertissements.push({ cle, message: `Marqueur inconnu {${nom}}, laissé tel quel.` });
    }
    if (/(^|\s)@\w/.test(texte)) avertissements.push({ cle, message: "Compte X écrit à la main (@…) au lieu de {CANDIDAT}." });
    if (["fil.1", "fil.2", "fil.3"].includes(cle) && texte.includes("{CANDIDAT}")) {
      avertissements.push({ cle, message: "Compte X dans une réponse du fil : le candidat sera notifié plusieurs fois." });
    }
    if (/\d+(?:[.,]\d+)?\s*\/\s*100/.test(texte)) avertissements.push({ cle, message: "Note sur 100 écrite à la main, hors {SCORE}." });
    if (/[🔴🟠🟡🟢]/u.test(texte)) avertissements.push({ cle, message: "Pastille écrite à la main, hors {PASTILLE}." });
    const appreciation = APPRECIATIONS.find((label) => texte.toLowerCase().includes(label.toLowerCase()));
    if (appreciation) avertissements.push({ cle, message: `Appréciation « ${appreciation} » écrite à la main, hors {APPRECIATION}.` });
  }
  for (const [cote, emoji] of [["tient_court", "✅"], ["tient_pas_court", "❌"]]) {
    (tient[cote] ?? []).forEach((court, i) => {
      if (!commenceParUnSujet(court)) {
        avertissements.push({ cle: `tient.${cote}.${i}`, message: `Version courte sans sujet apparent : « ${emoji} ${court} ».` });
      }
    });
  }
  const textes = [
    ...(reseaux.fil ?? []).map((texte, i) => [`fil.${i}`, texte]),
    ["chiffre.tweet", reseaux.chiffre?.tweet],
    ["chiffre.explication", reseaux.chiffre?.explication],
    ["tient.tweet", tient.tweet],
    ...(tient.tient ?? []).map((texte, i) => [`tient.tient.${i}`, texte]),
    ...(tient.tient_pas ?? []).map((texte, i) => [`tient.tient_pas.${i}`, texte]),
  ];
  for (const [cle, texte] of textes) {
    for (const extrait of nombresColles(texte)) {
      avertissements.push({ cle, message: `Deux nombres côte à côte : « ${extrait} ».` });
    }
  }
  return avertissements;
}

// Lien « Ouvrir dans X », texte prérempli (l'image se joint à la main).
export function lienIntentionX(texte) {
  return `https://x.com/intent/post?text=${encodeURIComponent(texte)}`;
}
