import { additionnerUsage, CARACTERES_PAR_TOKEN, coutClaude, MODELE_REEL } from "./reel-generation.js";
import { valeursReseaux } from "./reseaux.js";
import { consigneRaccourcir, consigneRemarques, controlerRecit, fusionnerRecit, recitPourStockage } from "./recit.js";

// Génération du carrousel détaillé (ex-« récit ») et du tweet long d'une
// fiche, partagée par le bouton « Générer le carrousel détaillé » de
// /test/reseaux/<id> (et la régénération avec remarques) et par scripts/recit.js.
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
export const TOKENS_SORTIE_RECIT = 2200;

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
// Avec la liste fermée des mots-clés d'illustration du thème avant la fiche ;
// en régénération, la consigne des remarques (version précédente, remarque,
// partie à réécrire) à la fin.
export function construireMessageRecit(prompt, ficheFinale, { motsClesIllustration = [], remarques = null } = {}) {
  const texte = String(prompt ?? "").replace(/\r\n/g, "\n").trim();
  const mots = `MOTS-CLÉS D'ILLUSTRATION DISPONIBLES POUR CE THÈME : ${motsClesIllustration.length ? motsClesIllustration.join(", ") : "(aucun : mets illustration_mots_cles à [])"}`;
  const base = `${texte}\n\n${mots}\n\nFICHE FINALE :\n${JSON.stringify(fichePourRecit(ficheFinale), null, 2)}`;
  return remarques ? `${base}\n\n${consigneRemarques(remarques)}` : base;
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

// Débordements au rendu d'une réponse acceptée : une relance au plus pour
// raccourcir les textes visés (consigneRaccourcir). Renvoie { recit,
// avertissements, debordements, usage } ; la relance n'est gardée que si
// elle passe les mêmes contrôles et déborde moins.
async function raccourcirSiBesoin({ controle, base, contexte, appeler, analyser, debordements, journal }) {
  const message = (d) => `Texte trop long, slide ${d.numero} (${d.libelle}) : ${d.bloc}, ${d.raison}. On ne réduit pas la police : raccourcir ce texte.`;
  const avant = debordements ? debordements(controle.recit) : [];
  let retenu = { recit: controle.recit, avertissements: controle.avertissements, debordements: avant, usage: {} };
  if (avant.length > 0) {
    journal.error(`  ⚠️  Carrousel détaillé : ${avant.length} texte(s) trop long(s), relance pour raccourcir.`);
    try {
      const reponse = await appeler(`${base}\n\n${consigneRaccourcir(controle.recit, avant)}`);
      retenu.usage = reponse?.usage ?? {};
      const second = controlerRecit(analyser(reponse), contexte);
      if (second.valide) {
        const apres = debordements(second.recit);
        if (apres.length < avant.length) retenu = { recit: second.recit, avertissements: second.avertissements, debordements: apres, usage: retenu.usage };
      }
    } catch (error) {
      journal.error(`     - relance impossible : ${error.message}`);
    }
  }
  return { ...retenu, avertissements: [...retenu.avertissements, ...retenu.debordements.map(message)] };
}

// Génère le récit d'une fiche en deux essais au plus ; le second renvoie au
// modèle sa réponse refusée et les raisons du refus.
//   appeler(message) → réponse brute de l'API (avec `usage`)
//   analyser(reponse) → objet JSON proposé par le modèle (lève si illisible)
// Renvoie { recit, usage, cout, errors, avertissements, derniere } : recit
// (objet rangé dans contenuComplet.reseaux_recit) vaut null si les deux essais
// ont échoué ; derniere : la dernière réponse refusée, normalisée si possible.
//   motsClesIllustration : liste fermée du thème (src/lib/illustrations.js) ;
//   remarques : { precedent, remarque, cible, libelleCible } pour une
//     régénération avec remarques : seule la partie visée est reprise de la
//     réponse (fusionnerRecit), le reste vient de la version précédente, puis
//     le tout passe les mêmes contrôles ;
//   debordements(recit) → [{ numero, libelle, bloc, raison }] : textes qui ne
//     tiennent pas dans leur slide au rendu (src/lib/mise-en-page-carrousel.js).
//     Réponse acceptée mais qui déborde : UNE relance demande au modèle de
//     raccourcir ces textes ; la version qui déborde le moins est gardée, et
//     les débordements restants deviennent des avertissements.
export async function genererRecitCore({ ficheFinale, candidatNom, score, propositionId = 0, prompt, appeler, analyser, motsClesIllustration = [], remarques = null, debordements = null, journal = console }) {
  const fiche = fichePourRecit(ficheFinale);
  const contexte = { ficheFinale: fiche, candidatNom, score, valeurs: valeursReseaux({ candidatNom, score, propositionId }), motsClesIllustration };
  const base = construireMessageRecit(prompt, ficheFinale, { motsClesIllustration, remarques });
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
      const brut = analyser(reponse);
      const raw = remarques ? fusionnerRecit(remarques.precedent, brut, remarques.cible) : brut;
      const controle = controlerRecit(raw, contexte);
      derniere = controle.recit ?? raw;
      errors = controle.erreurs;
      if (controle.valide) {
        const accepte = await raccourcirSiBesoin({ controle, base, contexte, appeler, analyser, debordements, journal });
        usage = additionnerUsage(usage, accepte.usage);
        return {
          recit: recitPourStockage(accepte.recit, { modele: MODELE_RECIT }),
          usage,
          cout: coutClaude(usage),
          errors: [],
          avertissements: accepte.avertissements,
          debordements: accepte.debordements,
        };
      }
    } catch (error) {
      errors = [error.message];
    }
    if (tentative < TENTATIVES_RECIT) {
      journal.error("  ⚠️  Carrousel détaillé : réponse refusée, nouvelle tentative :");
      for (const error of errors) journal.error(`     - ${error}`);
    }
  }

  journal.error(`  ⚠️  Carrousel détaillé : ÉCHEC après ${TENTATIVES_RECIT} tentatives, rien n'est enregistré.`);
  for (const error of errors) journal.error(`     - ${error}`);
  return { recit: null, usage, cout: coutClaude(usage), errors, avertissements: [], derniere };
}
