import { additionnerUsage, CARACTERES_PAR_TOKEN, coutClaude, MODELE_REEL } from "./reel-generation.js";
import { valeursReseaux } from "./reseaux.js";
import { controlerRecit, recitPourStockage } from "./recit.js";

// Génération du carrousel récit et du tweet long d'une fiche, partagée par le
// bouton « Générer le récit » de /test/reseaux/<id> et par scripts/recit.js.
// Fonctions PURES : l'appel à Claude (`appeler`) et la lecture de sa réponse
// (`analyser`) sont fournis par l'appelant. Testées par scripts/recit.test.js.

// Mêmes modèle et réglages que l'étape 3 ter (Claude Sonnet, sans recherche
// web, sans réflexion), en streaming.
export const MODELE_RECIT = MODELE_REEL;
export const TENTATIVES_RECIT = 2;

export function requeteRecit(message) {
  return {
    model: MODELE_RECIT,
    max_tokens: 4000,
    thinking: { type: "disabled" },
    messages: [{ role: "user", content: message }],
    stream: true,
  };
}

// Tokens de sortie d'une réponse (textes des 7 slides du modèle, légende,
// tweet long, JSON).
export const TOKENS_SORTIE_RECIT = 1800;

// Fiche envoyée au modèle (et référence du contrôle des nombres) : la fiche
// finale, sans les ajouts des étapes suivantes.
export function fichePourRecit(ficheFinale) {
  const {
    version_basique: _basique,
    reseaux: _reseaux,
    reseaux_recit: _recit,
    reel: _reel,
    reelPrecedent: _reelPrecedent,
    revision: _revision,
    ...fiche
  } = ficheFinale ?? {};
  return fiche;
}

// Message du premier essai : le prompt (data/prompt-recit.md), puis la fiche.
export function construireMessageRecit(prompt, ficheFinale) {
  const texte = String(prompt ?? "").replace(/\r\n/g, "\n").trim();
  return `${texte}\n\nFICHE FINALE :\n${JSON.stringify(fichePourRecit(ficheFinale), null, 2)}`;
}

// Usage estimé du meilleur cas (premier essai accepté) et du pire cas (second
// essai, qui renvoie aussi la réponse refusée et les erreurs).
export function usageEstimeRecit(caracteresMessage) {
  const entree = Math.ceil(caracteresMessage / CARACTERES_PAR_TOKEN);
  return {
    min: { input_tokens: entree, output_tokens: TOKENS_SORTIE_RECIT },
    max: { input_tokens: 2 * entree + TOKENS_SORTIE_RECIT + 300, output_tokens: 2 * TOKENS_SORTIE_RECIT },
  };
}

export function estimationCoutRecit(caracteresMessage) {
  const { min, max } = usageEstimeRecit(caracteresMessage);
  return { min: coutClaude(min), max: coutClaude(max), tokens: min.input_tokens };
}

// Génère le récit d'une fiche en deux essais au plus ; le second renvoie au
// modèle sa réponse refusée et les raisons du refus.
//   appeler(message) → réponse brute de l'API (avec `usage`)
//   analyser(reponse) → objet JSON proposé par le modèle (lève si illisible)
// Renvoie { recit, usage, cout, errors, avertissements, derniere } : recit
// (objet rangé dans contenuComplet.reseaux_recit) vaut null si les deux essais
// ont échoué ; derniere : la dernière réponse refusée, normalisée si possible.
export async function genererRecitCore({ ficheFinale, candidatNom, score, propositionId = 0, prompt, appeler, analyser, journal = console }) {
  const fiche = fichePourRecit(ficheFinale);
  const contexte = { ficheFinale: fiche, candidatNom, valeurs: valeursReseaux({ candidatNom, score, propositionId }) };
  const base = construireMessageRecit(prompt, ficheFinale);
  let usage = {};
  let errors = [];
  let derniere = null;

  for (let tentative = 1; tentative <= TENTATIVES_RECIT; tentative++) {
    const message =
      tentative === 1 || !derniere
        ? base
        : `${base}

ATTENTION : ta réponse précédente a été refusée pour les raisons suivantes. Corrige-les, en gardant ce qui était accepté.
${errors.map((error) => `- ${error}`).join("\n")}

Ta réponse précédente :
${JSON.stringify(derniere, null, 2)}`;

    try {
      const reponse = await appeler(message);
      usage = additionnerUsage(usage, reponse?.usage);
      const raw = analyser(reponse);
      const controle = controlerRecit(raw, contexte);
      derniere = controle.recit ?? raw;
      errors = controle.erreurs;
      if (controle.valide) {
        return {
          recit: recitPourStockage(controle.recit, { modele: MODELE_RECIT }),
          usage,
          cout: coutClaude(usage),
          errors: [],
          avertissements: controle.avertissements,
        };
      }
    } catch (error) {
      errors = [error.message];
    }
    if (tentative < TENTATIVES_RECIT) {
      journal.error("  ⚠️  Récit : réponse refusée, nouvelle tentative :");
      for (const error of errors) journal.error(`     - ${error}`);
    }
  }

  journal.error(`  ⚠️  Récit : ÉCHEC après ${TENTATIVES_RECIT} tentatives, rien n'est enregistré.`);
  for (const error of errors) journal.error(`     - ${error}`);
  return { recit: null, usage, cout: coutClaude(usage), errors, avertissements: [], derniere };
}
