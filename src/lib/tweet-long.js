import { formatScore, getScoreBadge } from "./score.js";
import { nombresHorsFiche } from "./nombres-fiche.js";
import { lienAnalyse, longueurX, URL_SITE } from "./reseaux.js";
import { nommeCandidat, palierEcrit, phrasesDe } from "./recit.js";
import { additionnerUsage, CARACTERES_PAR_TOKEN, coutClaude, MODELE_REEL } from "./reel-generation.js";

// Tweet long X d'une fiche (section 5 de /test/reseaux/<id>), écrit par
// Claude avec son propre prompt (data/prompt-tweet-long.md, qui fait foi) et
// son propre appel : bouton « Générer le tweet long » ou
// scripts/tweet-long.js. Rangé dans contenuComplet.reseaux_tweet_long.
//
// Le modèle écrit le corps (accroche, promesse, introduction de l'analyse,
// révélations, conclusion), en texte brut. Le code ajoute la ligne de score
// et la signature avec le lien : jamais le modèle. Fonctions PURES (l'appel
// à Claude est injecté), testées par scripts/tweet-long.test.js.

export const TWEET_LONG_MIN = 1200;
export const TWEET_LONG_MAX = 2000;
export const MODELE_TWEET_LONG = MODELE_REEL;
export const TENTATIVES_TWEET_LONG = 2;
// Corps de 900 à 1 600 caractères : environ 600 tokens de sortie.
export const TOKENS_SORTIE_TWEET_LONG = 700;

// Exemple de référence (data/prompt-tweet-long.md, « EXEMPLE DE RÉFÉRENCE ») :
// ses phrases ne doivent pas être reprises telles quelles.
export const EXEMPLE_CORPS = `Bruno Retailleau veut supprimer les cotisations sur les heures supplémentaires. Problème : les salariés en sont déjà largement exonérés.

Avec sa proposition de supprimer les cotisations sociales, hors CSG et CRDS, au-delà de 1 623 heures de travail par an, le candidat entend remettre au goût du jour le « travailler plus pour gagner plus ». À la clé, un gain annoncé de 230 € par mois.

Mais que changerait réellement cette réforme ? L'intelligence artificielle Perlimpinpin a passé la proposition au crible.

→ Pour les salariés, peu de nouveautés. Les 230 € annoncés viendraient essentiellement des heures travaillées en plus, et non de la réforme elle-même.

→ Pour les entreprises, en revanche, un véritable avantage. Elles paieraient moins de cotisations, y compris sur les heures supplémentaires qu'elles font déjà effectuer. De quoi les inciter à en proposer davantage.

Reste à savoir si elles le feront. En 2007, la France avait déjà expérimenté la défiscalisation des heures supplémentaires, sans augmentation démontrée du temps de travail effectif. La proposition de Retailleau se distingue toutefois par une incitation financière plus forte pour les employeurs.

Sur le papier, la mesure est réalisable. Mais son succès repose sur un pari : que les entreprises proposent suffisamment d'heures supplémentaires pour augmenter le pouvoir d'achat des salariés et compenser les pertes de recettes publiques.

Rien ne permet aujourd'hui de garantir que ce pari sera réussi.`;

// --- Ce que le code écrit -------------------------------------------------------------

// Pastille du tweet long (barème du 16 nov. 2026) : 🔴 0 à 34, 🟠 35 à 64,
// 🟢 65 à 100. Volontairement à part de `pastille` (src/lib/reseaux.js), qui
// garde le 🟡 des autres publications.
export function pastilleTweetLong(score) {
  const s = Number(score);
  return s >= 65 ? "🟢" : s >= 35 ? "🟠" : "🔴";
}

// « 🟠 Score Perlimpinpin : 51/100 — Plausible sous condition. »
export function ligneScore(score) {
  return `${pastilleTweetLong(score)} Score Perlimpinpin : ${formatScore(Number(score))}/100 — ${getScoreBadge(Number(score)).label}.`;
}

export function signature(url) {
  return `Notre analyse complète, nos calculs et toutes nos sources sont accessibles gratuitement ici : ${url}

Perlimpinpin est une association indépendante et apartisane, qui développe une intelligence artificielle en constante évolution pour éclairer le débat public par les faits. Vos retours contribuent à nous améliorer !`;
}

// URL publique canonique de la fiche (celle du fil X et de la carte) ; fiche
// pas encore publiée : l'accueil du site (avertissement à part).
export function urlTweetLong({ propositionId, publie }) {
  return publie ? lienAnalyse(propositionId) : URL_SITE;
}

// Texte final = corps du modèle + ligne vide + ligne de score + ligne vide + signature.
export function assemblerTweetLong(corps, { score, url }) {
  return `${corps}\n\n${ligneScore(score)}\n\n${signature(url)}`;
}

// --- Article envoyé au modèle ---------------------------------------------------------

function sansMarkdown(t) {
  return String(t ?? "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\r\n?/g, "\n")
    .trim();
}

// Texte d'un champ de fiche : chaîne, liste de chaînes, ou { synthese, texte }.
function texteChamp(valeur) {
  if (typeof valeur === "string") return sansMarkdown(valeur);
  if (Array.isArray(valeur)) return valeur.map(texteChamp).filter(Boolean).map((t) => `- ${t}`).join("\n");
  if (valeur && typeof valeur === "object") {
    return [valeur.synthese, valeur.texte].filter((t) => typeof t === "string" && t.trim()).map(sansMarkdown).join("\n\n");
  }
  return "";
}

// Une source : chaîne (« Titre : https://… ») ou objet structuré. Les adresses
// sont retirées (le modèle n'écrit aucun lien).
function texteSource(source) {
  if (typeof source === "string") return sansMarkdown(source).replace(/\s*:?\s*https?:\/\/\S+/g, "").replace(/[,;:\s]+$/, "");
  if (source && typeof source === "object") return [source.titre, source.organisme, source.date ?? source.annee].filter(Boolean).map(String).join(", ");
  return "";
}

// Sections de la fiche publique, dans l'ordre de la page. Le score, les
// sous-notes, le palier et les clés des étapes suivantes ne sont jamais envoyés.
const SECTIONS = [
  ["titre_fiche", "Titre"],
  ["resume_court", "Résumé"],
  ["mesure_reformulee", "La mesure"],
  ["nature_et_existant", "Nature de la mesure et dispositifs existants"],
  ["contexte_programme", "Place dans le programme"],
  ["contexte_national", "Contexte national"],
  ["contexte_international", "Contexte international et précédents"],
  ["impact_environnement", "Impact environnemental"],
  ["analyse_longevites", "Dans la durée"],
  ["impact_temporel_et_sectoriel", "Effets dans le temps et par secteur"],
  ["ce_qui_est_etabli", "Ce qui est établi"],
  ["ce_qui_est_probable", "Ce qui est probable"],
  ["ce_qui_est_discutable", "Ce qui est discutable"],
  ["ce_qui_est_inconnu", "Ce qui est inconnu"],
  ["angles_morts", "Angles morts"],
  ["verdict_final", "Verdict (forces et faiblesses)"],
  ["verdict_conclusion", "Conclusion"],
  ["ce_qui_la_ferait_tenir", "Ce qui la ferait tenir"],
  ["niveau_de_confiance", "Niveau de confiance"],
  ["limites", "Limites de l'analyse"],
];
const CLES_EXCLUES = new Set([
  "notation_detaillee",
  "analyse_par_criteres",
  "mesure_vers_objectif",
  "sources_utilisees",
  "teaser_accueil",
  "schema_version",
  "niveau_confiance_echelle",
  "qualification_juridique",
  "version_basique",
  "reseaux",
  "reseaux_recit",
  "reseaux_tweet_long",
  "reel",
  "reelPrecedent",
  "revision",
  "auditArbitrage",
  "score",
  "score_total",
  "appreciation",
]);

// Texte public complet de la fiche, à la place de [ARTICLE_COMPLET].
export function articleDepuisFiche(contenu) {
  const c = contenu ?? {};
  const blocs = [];
  const ajouter = (titre, texte) => {
    if (texte) blocs.push(`## ${titre}\n${texte}`);
  };
  for (const [cle, titre] of SECTIONS.slice(0, 3)) ajouter(titre, texteChamp(c[cle]));
  const objectif = c.mesure_vers_objectif;
  if (objectif && typeof objectif === "object") {
    ajouter(
      "Objectif visé et mécanisme",
      [objectif.objectif_vise && `Objectif visé : ${sansMarkdown(objectif.objectif_vise)}`, objectif.mecanisme_propose && `Mécanisme proposé : ${sansMarkdown(objectif.mecanisme_propose)}`].filter(Boolean).join("\n"),
    );
  }
  for (const [cle, titre] of SECTIONS.slice(3, 10)) ajouter(titre, texteChamp(c[cle]));
  // Raisonnement par critère : le titre et le texte, jamais la note. Ancien
  // format (une chaîne) : les sous-notes « (16/30, sans plafond) » et
  // « D'où 5/10 INCERTAIN. » sont retirées.
  if (typeof c.analyse_par_criteres === "string") {
    ajouter(
      "Raisonnement par critère",
      sansMarkdown(c.analyse_par_criteres)
        .replace(/\s*\(\d+(?:[,.]\d+)?\s*\/\s*\d+[^)]*\)/g, "")
        .replace(/\s*D[’']où (?:une note de )?\d+(?:[,.]\d+)?\s*\/\s*\d+(?:\s+[A-ZÉ]+)?\s*\./g, "")
        .replace(/\s*\d+(?:[,.]\d+)?\s*\/\s*\d+\s+(?:SOLIDE|INCERTAIN|FRAGILE|FAIBLE|BLOQUANT)\b\.?/g, ""),
    );
  } else if (Array.isArray(c.analyse_par_criteres)) {
    ajouter(
      "Raisonnement par critère",
      c.analyse_par_criteres
        .map((critere) => [critere?.titre ?? critere?.critere, texteChamp(critere?.texte)].filter(Boolean).join(" : "))
        .filter(Boolean)
        .join("\n\n"),
    );
  }
  for (const [cle, titre] of SECTIONS.slice(10)) ajouter(titre, texteChamp(c[cle]));
  // Autres champs de texte (schémas plus anciens ou plus récents).
  const connues = new Set(SECTIONS.map(([cle]) => cle));
  for (const [cle, valeur] of Object.entries(c)) {
    if (connues.has(cle) || CLES_EXCLUES.has(cle) || /score|note|palier|appreciation/i.test(cle)) continue;
    const texte = texteChamp(valeur);
    if (texte) ajouter(cle.replace(/_/g, " "), texte);
  }
  if (Array.isArray(c.sources_utilisees)) {
    ajouter("Sources", c.sources_utilisees.map(texteSource).filter(Boolean).map((s) => `- ${s}`).join("\n"));
  }
  return blocs.join("\n\n");
}

// Message envoyé : le prompt, [ARTICLE_COMPLET] et [URL_ARTICLE] remplacés
// (le « [URL] » de la signature décrite au modèle reste tel quel).
export function construireMessageTweetLong(prompt, contenu, url) {
  return String(prompt ?? "")
    .replace(/\r\n/g, "\n")
    .trim()
    .replace("[ARTICLE_COMPLET]", () => articleDepuisFiche(contenu))
    .replace("[URL_ARTICLE]", () => url);
}

export function requeteTweetLong(message) {
  return {
    model: MODELE_TWEET_LONG,
    max_tokens: 1500,
    thinking: { type: "disabled" },
    messages: [{ role: "user", content: message }],
    stream: true,
  };
}

// Coût estimé : premier essai accepté (min) ou second essai, qui renvoie
// aussi le texte refusé et les raisons (max).
export function estimationCoutTweetLong(caracteresMessage) {
  const entree = Math.ceil(caracteresMessage / CARACTERES_PAR_TOKEN);
  const min = { input_tokens: entree, output_tokens: TOKENS_SORTIE_TWEET_LONG };
  const max = { input_tokens: 2 * entree + TOKENS_SORTIE_TWEET_LONG + 200, output_tokens: 2 * TOKENS_SORTIE_TWEET_LONG };
  return { min: coutClaude(min), max: coutClaude(max), tokens: entree };
}

// --- Mise en page et contrôles --------------------------------------------------------

function sansAccents(t) {
  return String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// Forme de comparaison : sans accents ni majuscules, apostrophes unifiées,
// espaces et ponctuation réduits.
function forme(t) {
  return sansAccents(t)
    .replace(/[’']/g, "'")
    .replace(/[^\p{L}\p{N}']+/gu, " ")
    .trim();
}

// Mise en page du corps : une seule ligne vide entre paragraphes, pas
// d'espace en fin de ligne, chaque ligne qui commence par → séparée des
// autres par une ligne vide. Retire aussi un éventuel bloc de code ou des
// séparateurs « --- » autour du texte.
export function normaliserCorps(texte) {
  const lignes = String(texte ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((ligne) => ligne.replace(/[\s ]+$/u, "").replace(/^[ \t ]+/u, ""))
    .filter((ligne) => !/^(```\w*|-{3,})$/.test(ligne));
  const sortie = [];
  for (const ligne of lignes) {
    if (/^→/.test(ligne)) {
      if (sortie.length && sortie.at(-1) !== "") sortie.push("");
      sortie.push(ligne, "");
    } else {
      sortie.push(ligne);
    }
  }
  return sortie.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

const DEBUT_NON_PUBLIEE = "Fiche pas encore publiée";
const EMOJI =/[\p{Extended_Pictographic}\p{Regional_Indicator}\u{FE0F}\u{200D}\u{20E3}]/gu;
const PASTILLE_NOTE = /[🔴🟠🟡🟢]/u;
const URL_ECRITE = /https?:\/\/|\bwww\.|\b[\p{L}\d-]+\.(?:ai|fr|com|org|net|eu|io|gouv)\b/iu;
const HASHTAG = /(^|[\s(«"])#[\p{L}\p{N}_]+/u;
const MENTION_IA = /(?:intelligence artificielle|\bIA\b)\s+(?:de\s+)?Perlimpinpin/iu;
// Débuts d'accroche génériques (comparés sans accents ni majuscules).
export const ACCROCHES_GENERIQUES = [
  "nouvelle analyse",
  "perlimpinpin",
  "notre analyse",
  "analyse",
  "decryptage",
  "focus",
  "zoom sur",
  "aujourd'hui",
  "cette semaine",
  "on a analyse",
  "nous avons analyse",
  "l'intelligence artificielle",
  "l'ia",
  "notre ia",
  "bonjour",
  "thread",
  "dans cette analyse",
  "vous l'avez peut-etre",
];

// Phrases d'un corps, paragraphe par paragraphe (une flèche → ouvre toujours
// une nouvelle phrase).
export function phrasesCorps(t) {
  return String(t ?? "")
    .split(/\n+/)
    .flatMap((paragraphe) => phrasesDe(paragraphe.replace(/^→\s*/, "")));
}

// Phrase du corps qui introduit l'analyse (celle qui mentionne
// l'intelligence artificielle Perlimpinpin), ou "".
export function introDe(corps) {
  return phrasesCorps(corps).find((phrase) => MENTION_IA.test(phrase)) ?? "";
}

// Phrases de l'exemple de référence reprises telles quelles (8 mots au
// moins : les transitions courtes conseillées, « Sur le papier, la mesure
// est réalisable », ne comptent pas).
export function phrasesDeLExempleReprises(corps) {
  const cible = ` ${forme(corps)} `;
  return phrasesCorps(EXEMPLE_CORPS)
    .filter((phrase) => forme(phrase).split(" ").length >= 8)
    .filter((phrase) => cible.includes(` ${forme(phrase)} `));
}

// Contrôle de la réponse du modèle.
//   brut : texte renvoyé par le modèle ;
//   article : texte envoyé au modèle (référence des nombres) ;
//   score : note calculée par le code ; url : lien de la signature ;
//   publie : la fiche est-elle publiée ? (sinon, lien vers l'accueil) ;
//   introPrecedente : phrase d'introduction du dernier tweet long généré.
// Refus : nombre absent de la fiche, score / « /100 » / palier écrit par le
// modèle, URL, hashtag. Corrigés avec avertissement : emoji ou drapeau
// (retiré), tiret cadratin (virgule). Le reste : avertissements.
// Renvoie { valide, erreurs, avertissements, corps, texte }.
export function controlerTweetLong(brut, { article, candidatNom, score, url, publie = true, introPrecedente = "" }) {
  const erreurs = [];
  const avertissements = [];
  let corps = normaliserCorps(brut);
  if (!corps) return { valide: false, erreurs: ["Réponse vide."], avertissements, corps: "", texte: "" };

  // --- Refus ---
  const horsFiche = nombresHorsFiche([corps], article);
  if (horsFiche.length) erreurs.push(`Nombre(s) absent(s) de la fiche : ${horsFiche.join(", ")}.`);
  if (/\d+(?:[,.]\d+)?\s*(?:\/|sur)\s*100\b/i.test(corps) || /\/\s*100\b/.test(corps) || PASTILLE_NOTE.test(corps) || /score\s+perlimpinpin/i.test(corps)) {
    erreurs.push("Score ou note sur 100 écrit par le modèle (le code ajoute la ligne de score).");
  }
  const palier = palierEcrit(corps);
  if (palier) erreurs.push(`Palier « ${palier} » écrit par le modèle (le code l’ajoute dans la ligne de score).`);
  if (URL_ECRITE.test(corps)) erreurs.push("Lien écrit par le modèle (le code ajoute la signature et le lien).");
  const hashtag = corps.match(HASHTAG);
  if (hashtag) erreurs.push(`Hashtag écrit par le modèle (« ${hashtag[0].trim()} ») : aucun hashtag.`);

  // --- Corrections automatiques ---
  if (EMOJI.test(corps)) {
    EMOJI.lastIndex = 0;
    corps = normaliserCorps(corps.replace(EMOJI, "").replace(/[ \t]{2,}/g, " ").replace(/[ \t]+([,.])/g, "$1"));
    avertissements.push("Emoji ou drapeau dans le texte : retiré.");
  }
  EMOJI.lastIndex = 0;
  if (corps.includes("—")) {
    corps = corps.replace(/[ \t]*—[ \t]*/g, ", ").replace(/,\s*([,.;:!?])/g, "$1").replace(/^,\s*/gm, "");
    avertissements.push("Tiret cadratin dans le texte : remplacé par une virgule.");
  }

  const texte = assemblerTweetLong(corps, { score, url });

  // --- Avertissements ---
  const longueur = longueurX(texte);
  if (longueur < TWEET_LONG_MIN || longueur > TWEET_LONG_MAX) {
    avertissements.push(`Texte final de ${longueur.toLocaleString("fr-FR")} caractères (cible ${TWEET_LONG_MIN.toLocaleString("fr-FR")} à ${TWEET_LONG_MAX.toLocaleString("fr-FR")}).`);
  }
  const phrases = phrasesCorps(corps);
  if (!nommeCandidat(phrases.slice(0, 2).join(" "), candidatNom)) avertissements.push(`${candidatNom ?? "Le candidat"} n’est pas nommé dans les deux premières phrases.`);
  const debut = forme(corps.split("\n")[0]);
  const generique = ACCROCHES_GENERIQUES.find((formule) => debut === forme(formule) || debut.startsWith(`${forme(formule)} `));
  if (generique) avertissements.push(`L’accroche commence par une formule générique (« ${corps.split(/\s+/).slice(0, 3).join(" ")}… ») : commencer par le candidat et sa proposition.`);
  const intro = introDe(corps);
  if (!intro) avertissements.push("L’intelligence artificielle Perlimpinpin n’est pas mentionnée dans le texte.");
  else if (introPrecedente && forme(intro) === forme(introPrecedente)) avertissements.push(`Introduction de l’analyse identique à celle du dernier tweet long (« ${intro} ») : varier la formulation.`);
  const reprises = phrasesDeLExempleReprises(corps);
  if (reprises.length) {
    const liste = reprises.slice(0, 3).map((phrase) => `« ${phrase} »`).join(", ");
    avertissements.push(`Formulation de l’exemple reprise telle quelle : ${liste}${reprises.length > 3 ? ` (et ${reprises.length - 3} autre(s))` : ""}.`);
  }
  if (!publie) avertissements.push(`${DEBUT_NON_PUBLIEE} : le lien de la signature pointe vers ${URL_SITE}. Régénérez ou corrigez le lien après publication.`);

  return { valide: erreurs.length === 0, erreurs, avertissements, corps, texte };
}

// --- Génération (deux essais au plus) -----------------------------------------------

// `appeler(message)` → { texte, usage } (réponse de l'API). Le second essai
// renvoie au modèle son texte refusé et les raisons. Renvoie { tweetLong,
// usage, cout, errors, avertissements, derniere } ; tweetLong (objet rangé
// dans contenuComplet.reseaux_tweet_long) vaut null si les deux essais échouent.
export async function genererTweetLongCore({ contenu, candidatNom, score, propositionId, publie, prompt, appeler, introPrecedente = "", journal = console, date = () => new Date().toISOString() }) {
  const url = urlTweetLong({ propositionId, publie });
  const article = articleDepuisFiche(contenu);
  const base = construireMessageTweetLong(prompt, contenu, url);
  let usage = {};
  let errors = [];
  let derniere = null;

  for (let tentative = 1; tentative <= TENTATIVES_TWEET_LONG; tentative++) {
    const message =
      tentative === 1 || !derniere
        ? base
        : `${base}

ATTENTION : ton texte précédent a été refusé pour les raisons suivantes. Corrige-les, en gardant ce qui était bon. Retourne uniquement le texte corrigé.
${errors.map((error) => `- ${error}`).join("\n")}

Ton texte précédent :
${derniere}`;
    try {
      const reponse = await appeler(message);
      usage = additionnerUsage(usage, reponse?.usage);
      const controle = controlerTweetLong(reponse?.texte ?? "", { article, candidatNom, score, url, publie, introPrecedente });
      derniere = controle.corps || reponse?.texte || null;
      errors = controle.erreurs;
      if (controle.valide) {
        const cout = coutClaude(usage);
        return {
          tweetLong: { texte: controle.texte, corps_modele: controle.corps, date: date(), cout, avertissements: controle.avertissements },
          usage,
          cout,
          errors: [],
          avertissements: controle.avertissements,
        };
      }
    } catch (error) {
      errors = [error.message];
    }
    if (tentative < TENTATIVES_TWEET_LONG) {
      journal.error("  ⚠️  Tweet long : texte refusé, nouvelle tentative :");
      for (const error of errors) journal.error(`     - ${error}`);
    }
  }
  return { tweetLong: null, usage, cout: coutClaude(usage), errors, avertissements: [], derniere };
}

// --- Stockage et affichage ------------------------------------------------------------

// contenuComplet après écriture : seule la clé reseaux_tweet_long change.
export function contenuAvecTweetLong(contenu, tweetLong) {
  return { ...(contenu ?? {}), reseaux_tweet_long: tweetLong };
}

// Tweet long à afficher en section 5 : le nouveau (reseaux_tweet_long),
// réassemblé avec le score et le lien du moment (la fiche a pu être publiée
// depuis) ; sinon l'ancien, généré avec le carrousel détaillé
// (reseaux_recit), encore lisible. null s'il n'y en a aucun.
//   ancienTweet : texte de l'ancien tweet, marqueurs déjà remplis.
export function tweetLongAffiche(contenu, { score, propositionId, publie, ancienTweet = "" }) {
  const stocke = contenu?.reseaux_tweet_long;
  if (stocke?.corps_modele) {
    const url = urlTweetLong({ propositionId, publie });
    return {
      source: "tweet-long",
      texte: assemblerTweetLong(stocke.corps_modele, { score, url }),
      date: stocke.date ?? null,
      cout: stocke.cout ?? null,
      // L'avertissement « pas encore publiée » suit l'état actuel de la fiche.
      avertissements: [
        ...(stocke.avertissements ?? []).filter((a) => !a.startsWith(DEBUT_NON_PUBLIEE)),
        ...(publie ? [] : [`${DEBUT_NON_PUBLIEE} : le lien de la signature pointe vers ${URL_SITE}.`]),
      ],
    };
  }
  if (ancienTweet) return { source: "carrousel", texte: ancienTweet, date: contenu?.reseaux_recit?.genereLe ?? null, cout: null, avertissements: [] };
  return null;
}
