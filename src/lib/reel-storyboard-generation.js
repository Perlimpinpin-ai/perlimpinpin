import { fichePourReel, additionnerUsage, consignesDepuisPrecedents } from "./reel-generation.js";
import { questionCouvertureDuReel } from "./reel.js";
import { nomDeFamille } from "./charte-rs.js";
import {
  FORMATS,
  choisirVariantesStoryboard,
  consignesFixes,
  controlerStoryboard,
  couvertureFormat,
  couvertureStoryboard,
  formatValide,
  scoreTexte,
  storyboardPourStockage,
  textesFixes,
  titreProgramme,
  titreThematique,
  verdictDuScore,
} from "./reel-storyboard.js";

// Génération du storyboard d'un Reel (v5) par Claude, en deux essais au plus
// et un seul appel par essai, pour les trois formats (« mesure »,
// « programme », « thematique ») et les deux modes :
//   A : Claude écrit le script et le storyboard ;
//   B : Claude découpe le script de l'équipe sans le réécrire.
// Fonctions PURES : l'appel à Claude (`appeler`) et la lecture de sa réponse
// (`analyser`) sont fournis par l'appelant. Testées par
// scripts/reel-storyboard.test.js.

export const TENTATIVES_STORYBOARD = 2;

// Variantes rangées des Reels précédents (v4 et v5 : la v3 avait d'autres clés).
function variantesV4(reel) {
  return reel?.version >= 4 ? reel.variantes ?? null : null;
}

// Consignes propres au format programme ou thématique : la liste fixée par
// le code (mesures 1 à 6, ou candidats dans l'ordre alphabétique), avec la
// note et le verdict du code.
export function consignesFormat(format, { candidatNom = "", mesures = [], candidats = [], themeLibelle = "", variantes = null } = {}) {
  const f = textesFixes(variantes ?? {});
  const fin = `- Scène \`fin\`, les 3 morceaux de voix, dans cet ordre : ${f.fin.map((m) => `« ${m} »`).join(", ")} ; \`url\` = « perlimpinpin.ai ».`;
  if (format === "programme") {
    return [
      `FORMAT « PROGRAMME » (types : ${FORMATS.programme.types.join(", ")}). Exactement 9 scènes, dans cet ordre : accroche-programme, mesure (numéros 1 à 6, dans l'ordre ci-dessous), classement, fin.`,
      `Le titre de l'accroche est fixé par le code : « ${titreProgramme(candidatNom).replace(/\*\*/g, "")} ». Voix type : « Alors, lesquelles tiennent la route ? ».`,
      "Chaque scène `mesure` : `numero`, `titre` (2 à 7 mots, l'info et le verdict), `proposition` (une phrase de 20 mots au plus), `icone` facultatif. Sa voix dit le numéro, le thème, puis la note du code (« Un : les retraites… 56 sur 100. »).",
      "LES 6 MESURES (ordre où le candidat les met en avant ; note et verdict du code, à ne jamais changer) :",
      ...mesures.map((m) => `  ${m.numero}. ${m.themeCourt} · « ${m.titre} » · ${scoreTexte(m.score)} sur 100 · ${verdictDuScore(m.score).toLowerCase()}`),
      "Scène `classement` : `titre` seulement ; le code classe les mesures et calcule la moyenne.",
      fin,
    ].join("\n");
  }
  return [
    `FORMAT « THÉMATIQUE » (types : ${FORMATS.thematique.types.join(", ")}). Exactement ${candidats.length + 4} scènes, dans cet ordre : medaillons, chiffres (le constat), une scène candidat par candidat (numéros 1 à ${candidats.length}, ordre alphabétique ci-dessous), classement, fin.`,
    `Le titre des médaillons est fixé par le code : « ${titreThematique(themeLibelle)} ». Voix type : « Qu'est-ce qui est vraiment faisable ? ».`,
    "Chaque scène `candidat` : `numero`, `titre` (2 à 7 mots), `proposition` (une phrase de 20 mots au plus) et `regard` (une phrase critique de 20 mots au plus). Candidat sans fiche : ni proposition ni regard ; la voix dit seulement qu'il n'y a pas de proposition publiée sur ce thème. Même longueur de voix pour tous les candidats (15 % d'écart au plus). Seulement le nom de famille à l'écran.",
    "LES CANDIDATS (ordre alphabétique ; note et verdict du code, à ne jamais changer ; l'ordre par note n'apparaît que dans le classement) :",
    ...candidats.map((c) => `  ${c.numero}. ${nomDeFamille(c.nom)} · ${c.fiche ? `« ${c.titre} » · ${scoreTexte(c.score)} sur 100 · ${verdictDuScore(c.score).toLowerCase()}` : "pas de proposition publiée sur ce thème"}`),
    "Scène `classement` : `titre` seulement ; le code classe les candidats notés et calcule la moyenne.",
    fin,
  ].join("\n");
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
// Formats programme et thématique : les consignes du format et les fiches
// (une par mesure ou par candidat), en un seul message.
export function construireMessageStoryboard({ prompt, ficheFinale, mode, variantes, score, script, precedents = [], format = "mesure", candidatNom = "", mesures = [], candidats = [], themeLibelle = "" }) {
  const texte = String(prompt ?? "").replace(/\r\n/g, "\n").trim();
  const antiRepetition = mode === "A" ? consignesDepuisPrecedents(precedents) : "";
  if (formatValide(format) !== "mesure") {
    const fiches =
      format === "programme"
        ? mesures.map((m) => ({ mesure: m.numero, theme: m.themeCourt, fiche: fichePourReel(m.fiche) }))
        : candidats.filter((c) => c.fiche).map((c) => ({ candidat: c.numero, nom: nomDeFamille(c.nom), fiche: fichePourReel(c.fiche) }));
    const consignesModeFormat =
      mode === "B"
        ? consignesMode("B", { score: 0, script })
            .split("\n")
            .filter((l) => !l.startsWith("LA NOTE"))
            .join("\n")
        : "MODE A : TU ÉCRIS LE SCRIPT. La voix off (tes morceaux de voix mis bout à bout) est le script que l'équipe enregistrera ensuite : des phrases courtes, faciles à dire. Écris les nombres comme dans les fiches. Jamais de deux-points ni de tiret cadratin dans la voix, sauf « Un : … » au début d'une mesure.";
    return [texte, consignesModeFormat, consignesFormat(format, { candidatNom, mesures, candidats, themeLibelle, variantes }), antiRepetition, `FICHES :\n${JSON.stringify(fiches, null, 2)}`]
      .filter(Boolean)
      .join("\n\n");
  }
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
  format = "mesure",
  mesures = [],
  candidats = [],
  themeLibelle = "",
}) {
  const liste = (precedents ?? []).filter(Boolean);
  const variantes = mode === "A" ? choisirVariantesStoryboard(liste.slice(0, 2).map(variantesV4), alea) : null;
  const base = construireMessageStoryboard({ prompt, ficheFinale, mode, variantes, score, script, precedents: liste, format, candidatNom, mesures, candidats, themeLibelle });
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
        format,
        candidatNom,
        mesures,
        candidats,
      });
      errors = controle.erreurs;
      if (controle.valide) {
        const couverture =
          formatValide(format) === "mesure"
            ? couvertureStoryboard(controle.storyboard, { exclues: liste.slice(0, 2).map(questionCouvertureDuReel), alea })
            : couvertureFormat(format, { candidatNom, themeLibelle });
        const avertissements = [
          ...controle.avertissements,
          ...(couverture.horsListe ? [`Couverture : question « ${couverture.questionProposee} » hors liste, remplacée par « ${couverture.question} ».`] : []),
        ];
        return {
          reel: storyboardPourStockage(
            { mode, storyboard: controle.storyboard, couverture: { titre: couverture.titre, question: couverture.question }, variantes, avertissements, script, minutage, format: formatValide(format) },
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
