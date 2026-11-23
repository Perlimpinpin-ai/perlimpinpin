import { fichePourReel, additionnerUsage, consignesDepuisPrecedents } from "./reel-generation.js";
import { questionCouvertureDuReel } from "./reel.js";
import {
  choisirVariantesStoryboard,
  consignesFixes,
  controlerStoryboard,
  couvertureStoryboard,
  scoreTexte,
  storyboardPourStockage,
  verdictDuScore,
} from "./reel-storyboard.js";

// Génération du storyboard d'un Reel (v4) par Claude, en deux essais au plus,
// pour les deux modes du bouton de /test/reels/<id> :
//   A : Claude écrit le script et le storyboard ;
//   B : Claude découpe le script de l'équipe sans le réécrire.
// Fonctions PURES : l'appel à Claude (`appeler`) et la lecture de sa réponse
// (`analyser`) sont fournis par l'appelant. Testées par
// scripts/reel-storyboard.test.js.

export const TENTATIVES_STORYBOARD = 2;

// Variantes rangées des Reels précédents (v4 seulement : la v3 avait d'autres clés).
function variantesV4(reel) {
  return reel?.version === 4 ? reel.variantes ?? null : null;
}

// Consignes propres au mode, ajoutées après le prompt.
export function consignesMode(mode, { variantes = null, score, script = "" }) {
  const note = `LA NOTE (calculée par le code, à recopier dans la scène \`note\`) : \`score\` = ${scoreTexte(score).replace(",", ".")}, \`verdict\` = « ${verdictDuScore(score).toLowerCase()} ».`;
  if (mode === "B") {
    return [
      "MODE B : SCRIPT ET VOIX OFF DE L'ÉQUIPE.",
      "Le script ci-dessous a été écrit et enregistré par l'équipe. Tu ne le réécris JAMAIS : tu le découpes en scènes, tu choisis les types, tu coupes chaque scène en 3 morceaux et tu places les mots clés en `**…**`.",
      "La suite de tous tes morceaux de voix, une fois les `**` retirés, doit redonner le script mot pour mot, dans l'ordre : aucun mot ajouté, retiré, remplacé ou déplacé, mêmes chiffres, même ponctuation. Un refus sinon.",
      "Les textes à l'écran reprennent ses mots. La dernière scène est une `fin` même si le script ne finit pas par l'appel habituel.",
      note,
      "",
      "SCRIPT DE L'ÉQUIPE :",
      String(script ?? "").trim(),
    ].join("\n");
  }
  return [
    "MODE A : TU ÉCRIS LE SCRIPT.",
    "La voix off (tes morceaux de voix mis bout à bout) est le script que l'équipe enregistrera ensuite : des phrases courtes, faciles à dire, environ 150 à 230 mots en tout. Écris les nombres comme dans la fiche (« 6,8 milliards », « 2030 », « 30 % ») : ce sont aussi les sous-titres.",
    "Jamais de deux-points ni de tiret cadratin dans la voix : un point, une virgule ou des points de suspension.",
    note,
    consignesFixes(variantes, { score }),
  ].join("\n");
}

// Message complet du premier essai.
export function construireMessageStoryboard({ prompt, ficheFinale, mode, variantes, score, script, precedents = [] }) {
  const texte = String(prompt ?? "").replace(/\r\n/g, "\n").trim();
  const antiRepetition = mode === "A" ? consignesDepuisPrecedents(precedents) : "";
  return [
    texte,
    consignesMode(mode, { variantes, score, script }),
    antiRepetition,
    `FICHE FINALE :\n${JSON.stringify(fichePourReel(ficheFinale), null, 2)}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

// Génère le storyboard d'une fiche. Renvoie { reel, usage, errors,
// avertissements } ; reel (objet rangé dans contenuComplet.reel) vaut null si
// les deux essais ont échoué, errors donne alors la cause du dernier échec.
//   mode : "A" ou "B" ; script et minutage (objet lu) : mode B ;
//   precedents : derniers Reels (le plus récent d'abord), pour varier.
export async function genererStoryboardCore({
  mode,
  ficheFinale,
  candidatNom,
  score,
  prompt,
  script = "",
  minutage = null,
  appeler,
  analyser,
  precedents = [],
  cartesDisponibles,
  alea = Math.random,
  journal = console,
}) {
  const liste = (precedents ?? []).filter(Boolean);
  const variantes = mode === "A" ? choisirVariantesStoryboard(liste.slice(0, 2).map(variantesV4), alea) : null;
  const base = construireMessageStoryboard({ prompt, ficheFinale, mode, variantes, score, script, precedents: liste });
  const fiche = fichePourReel(ficheFinale);
  let usage = {};
  let errors = [];
  let derniere = null;

  for (let tentative = 1; tentative <= TENTATIVES_STORYBOARD; tentative++) {
    const message =
      tentative === 1 || !derniere
        ? base
        : `${base}

ATTENTION : ta réponse précédente a été refusée pour les raisons suivantes. Corrige-les, en gardant ce qui était accepté.
${errors.map((e) => `- ${e}`).join("\n")}

Ta réponse précédente :
${JSON.stringify(derniere, null, 2)}`;
    try {
      const reponse = await appeler(message);
      usage = additionnerUsage(usage, reponse?.usage);
      const raw = analyser(reponse);
      derniere = raw;
      const controle = controlerStoryboard(raw, {
        mode,
        ficheFinale: fiche,
        score,
        script,
        minutage,
        variantes,
        cartesDisponibles,
        precedent: liste[0]?.texteVoix ?? null,
      });
      errors = controle.erreurs;
      if (controle.valide) {
        const couverture = couvertureStoryboard(controle.storyboard, { exclues: liste.slice(0, 2).map(questionCouvertureDuReel), alea });
        const avertissements = [
          ...controle.avertissements,
          ...(couverture.horsListe ? [`Couverture : question « ${couverture.questionProposee} » hors liste, remplacée par « ${couverture.question} ».`] : []),
        ];
        return {
          reel: storyboardPourStockage(
            { mode, storyboard: controle.storyboard, couverture: { titre: couverture.titre, question: couverture.question }, variantes, avertissements, script, minutage },
            { candidatNom, score },
          ),
          usage,
          errors: [],
          avertissements,
        };
      }
    } catch (error) {
      errors = [error.message];
    }
    if (tentative < TENTATIVES_STORYBOARD) {
      journal.error("  ⚠️  Storyboard : refusé, nouvelle tentative :");
      for (const e of errors) journal.error(`     - ${e}`);
    }
  }
  return { reel: null, usage, errors, avertissements: [] };
}
