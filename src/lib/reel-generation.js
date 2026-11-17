import { controlerReel, questionCouvertureDuReel, reelPourStockage } from "./reel.js";
import { choisirVariantes, consignesAntiRepetition, relancesUtilisees, variantesDuReelRange } from "./reel-montage.js";

// Génération du script d'un Reel, partagée par le bouton « Générer le Reel »
// de /test/reels (src/app/test/reels/actions.js) et par la ligne de commande
// (scripts/reel.js, via genererReel dans scripts/analyze.js). Fonctions PURES :
// l'appel à Claude (`appeler`) et la lecture de sa réponse (`analyser`) sont
// fournis par l'appelant. Testées par scripts/reel-generation.test.js.

// Tarif de claude-sonnet-5 (USD par million de tokens) : 2 $ en entrée, 10 $
// en sortie, écriture en cache × 1,25, lecture × 0,1. Source unique, reprise
// par l'estimation de coût du pipeline (scripts/analyze.js).
export const TARIF_CLAUDE_SONNET = { input: 2, cacheWrite: 2.5, cacheRead: 0.2, output: 10 };

export const MODELE_REEL = "claude-sonnet-5";
export const TENTATIVES_REEL = 2;

// Corps de la requête à l'API Anthropic : mêmes réglages que l'étape 3 ter
// (sans recherche web, donc sans outil, sans réflexion).
export function requeteReel(message) {
  return {
    model: MODELE_REEL,
    max_tokens: 4000,
    thinking: { type: "disabled" },
    messages: [{ role: "user", content: message }],
    stream: true,
  };
}

// Coût estimé d'un usage (format de l'API), en dollars, arrondi à 4 décimales.
// Mode lot (service_tier « batch ») : moitié prix.
export function coutClaude(usage = {}) {
  const {
    input_tokens = 0,
    cache_creation_input_tokens = 0,
    cache_read_input_tokens = 0,
    output_tokens = 0,
  } = usage;
  const facteur = usage.service_tier === "batch" ? 0.5 : 1;
  const t = TARIF_CLAUDE_SONNET;
  const cout =
    (facteur *
      (input_tokens * t.input +
        cache_creation_input_tokens * t.cacheWrite +
        cache_read_input_tokens * t.cacheRead +
        output_tokens * t.output)) /
    1_000_000;
  return Number(cout.toFixed(4));
}

// Caractères par token, pour un texte français mêlé de JSON (valeur prudente :
// un peu moins que la moyenne, pour ne pas sous-estimer).
export const CARACTERES_PAR_TOKEN = 3.2;
// Tokens de sortie d'une réponse (8 scènes, voix et sous-titres, JSON).
export const TOKENS_SORTIE = 1500;

// Usage estimé du meilleur cas (premier essai accepté) et du pire cas (second
// essai, qui renvoie aussi la réponse refusée et les erreurs), à partir de la
// taille du message du premier essai.
export function usageEstimeReel(caracteresMessage) {
  const entree = Math.ceil(caracteresMessage / CARACTERES_PAR_TOKEN);
  return {
    min: { input_tokens: entree, output_tokens: TOKENS_SORTIE },
    max: { input_tokens: 2 * entree + TOKENS_SORTIE + 300, output_tokens: 2 * TOKENS_SORTIE },
  };
}

// Coût estimé (en dollars) d'une génération, sans appel.
export function estimationCoutReel(caracteresMessage) {
  const { min, max } = usageEstimeReel(caracteresMessage);
  return { min: coutClaude(min), max: coutClaude(max), tokens: min.input_tokens };
}

// Fiche envoyée au modèle (et référence du contrôle des chiffres) : la fiche
// finale, sans les ajouts des étapes suivantes.
export function fichePourReel(ficheFinale) {
  const {
    version_basique: _basique,
    reseaux: _reseaux,
    reel: _reel,
    reelPrecedent: _reelPrecedent,
    revision: _revision,
    ...fiche
  } = ficheFinale ?? {};
  return fiche;
}

// Reels à ne pas imiter, le plus important d'abord : l'ancien Reel de la
// fiche (quand on génère à nouveau), puis les derniers Reels générés sur le
// site (sans doublon).
export function precedentsPourFiche(reelDeLaFiche, derniers = []) {
  const liste = [reelDeLaFiche, ...(derniers ?? [])].filter(Boolean);
  const vus = new Set();
  return liste.filter((reel) => {
    const cle = reel.genereLe ?? JSON.stringify(reel.scenes ?? null);
    if (vus.has(cle)) return false;
    vus.add(cle);
    return true;
  });
}

// Consignes « à ne pas reprendre », tirées des derniers Reels générés
// (`precedents` : objets contenuComplet.reel, le plus récent d'abord) :
// relances des 3 derniers, question de couverture du dernier.
export function consignesDepuisPrecedents(precedents = []) {
  const derniers = (precedents ?? []).filter(Boolean).slice(0, 3);
  return consignesAntiRepetition({
    relances: relancesUtilisees(derniers),
    questionCouverture: questionCouvertureDuReel(derniers[0]),
  });
}

// Message du premier essai : le prompt (data/prompt-reel.md), les consignes
// « à ne pas reprendre » (s'il y en a), puis la fiche.
export function construireMessageReel(prompt, ficheFinale, precedents = []) {
  const texte = String(prompt ?? "").replace(/\r\n/g, "\n").trim();
  const consignes = consignesDepuisPrecedents(precedents);
  return `${texte}${consignes ? `\n\n${consignes}` : ""}\n\nFICHE FINALE :\n${JSON.stringify(fichePourReel(ficheFinale), null, 2)}`;
}

// Le plus grand objet JSON à accolades équilibrées du texte (si le modèle a
// enrobé sa réponse d'un commentaire).
function plusGrandObjet(texte) {
  let meilleur = null;
  for (let debut = 0; debut < texte.length; debut++) {
    if (texte[debut] !== "{") continue;
    let profondeur = 0;
    for (let i = debut; i < texte.length; i++) {
      if (texte[i] === "{") profondeur++;
      else if (texte[i] === "}" && --profondeur === 0) {
        const candidat = texte.slice(debut, i + 1);
        if (!meilleur || candidat.length > meilleur.length) meilleur = candidat;
        break;
      }
    }
  }
  return meilleur;
}

// Texte de la réponse → objet JSON. Retire un éventuel bloc de code, sinon
// cherche le plus grand objet. Lève une erreur lisible si rien ne passe.
export function jsonDepuisTexte(texte) {
  const nettoye = String(texte ?? "")
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "");
  try {
    return JSON.parse(nettoye);
  } catch {
    const objet = plusGrandObjet(nettoye);
    if (objet) {
      try {
        return JSON.parse(objet);
      } catch {
        // échec traité ci-dessous
      }
    }
  }
  throw new Error("Réponse de Claude illisible (JSON invalide).");
}

export function additionnerUsage(total = {}, usage = {}) {
  const somme = { ...total };
  for (const [cle, valeur] of Object.entries(usage ?? {})) {
    somme[cle] = typeof valeur === "number" ? (somme[cle] ?? 0) + valeur : valeur;
  }
  return somme;
}

// Génère le Reel d'une fiche en deux essais au plus. Le second renvoie au
// modèle sa réponse refusée et les raisons du refus.
//   precedents : derniers Reels générés (le plus récent d'abord), pour varier
//     les phrases fixes, les relances et la question de couverture ;
//   alea : tirage au hasard (Math.random par défaut, injectable pour les tests).
//   appeler(message) → réponse brute de l'API (avec `usage`)
//   analyser(reponse) → objet JSON proposé par le modèle
//   journal : { warn, error } (console par défaut)
// Renvoie { reel, usage, errors, avertissements, derniere } : reel (objet
// rangé dans contenuComplet.reel) vaut null si les deux essais ont échoué ;
// errors donne alors la cause du dernier échec, derniere le Reel assemblé de
// la dernière réponse refusée.
export async function genererReelCore({
  ficheFinale,
  candidatNom,
  score,
  prompt,
  appeler,
  analyser,
  precedents = [],
  alea = Math.random,
  journal = console,
}) {
  const fiche = fichePourReel(ficheFinale);
  const basePrompt = construireMessageReel(prompt, ficheFinale, precedents);
  const liste = (precedents ?? []).filter(Boolean);
  // Le premier : l'ancien Reel de la fiche s'il existe, sinon le dernier généré
  // (référence de la mesure de variabilité).
  const precedent = liste[0] ?? null;
  // Variantes des phrases fixes et question de couverture : différentes des
  // deux premiers (ancien Reel de la fiche et dernier Reel généré).
  const variantes = choisirVariantes(liste.slice(0, 2).map(variantesDuReelRange), alea);
  const questionsExclues = liste.slice(0, 2).map(questionCouvertureDuReel);
  let usage = {};
  let errors = [];
  let derniere = null;
  let derniereAssemblee = null;

  for (let tentative = 1; tentative <= TENTATIVES_REEL; tentative++) {
    const message =
      tentative === 1 || !derniere
        ? basePrompt
        : `${basePrompt}

ATTENTION : ta réponse précédente a été refusée pour les raisons suivantes. Corrige-les, en gardant ce qui était accepté.
${errors.map((error) => `- ${error}`).join("\n")}

Ta réponse précédente :
${JSON.stringify(derniere, null, 2)}`;

    try {
      const reponse = await appeler(message);
      usage = additionnerUsage(usage, reponse?.usage);
      const raw = analyser(reponse);
      const controle = controlerReel(raw, { ficheFinale: fiche, candidatNom, score, variantes, precedent, questionsExclues, alea });
      derniere = raw;
      derniereAssemblee = controle.assemble;
      errors = controle.erreurs;
      if (controle.valide) {
        if (controle.avertissements.length > 0) {
          journal.warn(`  ⚠️  Reel : ${controle.avertissements.length} avertissement(s), à relire sur /test/reels :`);
          for (const a of controle.avertissements) journal.warn(`     - ${a}`);
        }
        return {
          reel: reelPourStockage(controle, { candidatNom, score }),
          usage,
          errors: [],
          avertissements: controle.avertissements,
        };
      }
    } catch (error) {
      errors = [error.message];
    }

    if (tentative < TENTATIVES_REEL) {
      journal.error("  ⚠️  Reel : script refusé, nouvelle tentative :");
      for (const error of errors) journal.error(`     - ${error}`);
    }
  }

  journal.error(`  ⚠️  Reel : ÉCHEC après ${TENTATIVES_REEL} tentatives, aucun Reel enregistré.`);
  for (const error of errors) journal.error(`     - ${error}`);
  return { reel: null, usage, errors, avertissements: [], derniere: derniereAssemblee };
}

// contenuComplet après écriture d'un Reel : la clé reel, et l'ancien Reel
// (s'il y en avait un) gardé sous reelPrecedent pour pouvoir revenir en
// arrière. Rien d'autre ne change.
export function contenuAvecReel(contenu, reel) {
  const base = contenu ?? {};
  return {
    ...base,
    ...(base.reel ? { reelPrecedent: base.reel } : {}),
    reel,
  };
}
