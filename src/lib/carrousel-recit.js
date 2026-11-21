import { getScoreBadge } from "./score.js";
import { empreinte, slugCandidat } from "./carte.js";
import { criteresPrincipaux } from "./criteresScore.js";
import { resolveTheme } from "./themes.js";
import { remplirTweet, valeursReseaux } from "./reseaux.js";
import { conditionPrincipale, legendeEtCouleur, scoreAffiche, sourcesPrincipales, sujetCourt, texteRepris } from "./carrousel.js";
import { CLES_CRITERES, controlerRecit } from "./recit.js";
import { fichePourRecit } from "./recit-generation.js";

// Carrousel « récit » en 8 slides (7 sans précédent étranger), sa légende et
// le tweet long, assemblés à partir de contenuComplet.reseaux_recit (écrit
// par Claude, voir src/lib/recit-generation.js) et de la fiche. Écrits par le
// code : le nom du candidat sur la couverture, la note, le niveau, les notes
// des critères, la condition la plus forte (slide 7) et la dernière slide.
// Fonctions PURES, testées par scripts/recit.test.js.

export const TYPES_SLIDES_RECIT = {
  couverture: { fichier: "couverture", libelle: "Couverture" },
  concretement: { fichier: "concretement", libelle: "Concrètement" },
  noteRecit: { fichier: "la-note", libelle: "La note" },
  effetsCourt: { fichier: "court-terme", libelle: "Court terme" },
  effetsLong: { fichier: "long-terme", libelle: "Long terme" },
  ailleurs: { fichier: "ailleurs", libelle: "Ailleurs" },
  tientCoince: { fichier: "ce-qui-tient-ce-qui-coince", libelle: "Ce qui tient… et ce qui coince" },
  fin: { fichier: "fin", libelle: "Fin" },
};

// `donnees` : comme controlerCarrousel (src/lib/carrousel.js). Renvoie null si
// la fiche n'a pas encore de récit ; sinon { slides, legende, tweet,
// avertissements, version, couleur, sujet } (avertissements : { cle, message, fort? }).
export function carrouselRecit(donnees) {
  const { propositionId, analyseId, candidatNom, photoUrl, score, contenu } = donnees;
  const stocke = contenu?.reseaux_recit;
  if (!stocke) return null;
  const avertissements = [];

  // Relecture du récit enregistré face à la fiche actuelle : ce qui serait
  // refusé à la génération devient un avertissement fort.
  const valeurs = valeursReseaux({ candidatNom, score, propositionId });
  const controle = controlerRecit(stocke, { ficheFinale: fichePourRecit(contenu), candidatNom, valeurs });
  for (const erreur of controle.erreurs) avertissements.push({ cle: "récit", fort: true, message: erreur });
  for (const message of controle.avertissements) avertissements.push({ cle: "récit", message });
  const recit = controle.recit;
  const titre = texteRepris(donnees.titre, "titre de la mesure", avertissements);
  const sujet = sujetCourt(titre);
  if (!recit) return { slides: [], legende: "", tweet: "", avertissements, version: `${analyseId}-vide`, couleur: null, sujet };

  const nom = (t) => remplirTweet(t, { NOM: candidatNom, CANDIDAT: candidatNom });
  const cartes = (liste) => liste.map((carte) => ({ ...carte, titre: nom(carte.titre), texte: nom(carte.texte) }));

  // Critères : notes du code (notation_detaillee), lignes du modèle.
  const notation = contenu?.notation_detaillee;
  const criteres = notation
    ? criteresPrincipaux(notation).map((critere, i) => ({
        label: critere.label,
        note: critere.note,
        max: critere.max,
        ligne: nom(recit.note.criteres[CLES_CRITERES[i]] ?? ""),
      }))
    : [];
  if (!notation) avertissements.push({ cle: "slide « La note »", message: "Pas de notation détaillée dans la fiche : barres des critères absentes." });

  const brutes = [
    {
      type: "couverture",
      recit: true,
      theme: resolveTheme(donnees.theme),
      intro: `${candidatNom} veut`,
      mesure: nom(recit.couverture.mesure),
      chiffreCle: recit.couverture.chiffre_cle,
      question: recit.couverture.question,
    },
    {
      type: "concretement",
      titre: nom(recit.concretement.titre),
      texte: nom(recit.concretement.texte),
      tuiles: [
        { etiquette: "Aujourd’hui", ...recit.concretement.tuiles.aujourdhui },
        { etiquette: "Proposé", ...recit.concretement.tuiles.propose },
        { etiquette: "L’écart", ...recit.concretement.tuiles.ecart, cle: true },
        { etiquette: "Qui est concerné", ...recit.concretement.tuiles.concernes },
      ],
      sources: recit.concretement.sources,
    },
    {
      type: "noteRecit",
      score: Number(score),
      scoreAffiche: scoreAffiche(score),
      palier: getScoreBadge(Number(score)).label,
      titre: nom(recit.note.titre),
      explication: nom(recit.note.explication),
      criteres,
    },
    { type: "effetsCourt", onglet: "court", titre: nom(recit.court_terme.titre), cartes: cartes(recit.court_terme.cartes) },
    { type: "effetsLong", onglet: "long", titre: nom(recit.long_terme.titre), cartes: cartes(recit.long_terme.cartes) },
    recit.ailleurs
      ? {
          type: "ailleurs",
          titre: nom(recit.ailleurs.titre),
          precedents: recit.ailleurs.precedents.map((p) => ({ ...p, fait: nom(p.fait), resultat: nom(p.resultat) })),
          sources: recit.ailleurs.sources,
        }
      : null,
    {
      type: "tientCoince",
      tient: recit.tient.tient.slice(0, 3).map(nom),
      coince: recit.tient.coince.slice(0, 3).map(nom),
      condition: conditionPrincipale(contenu?.ce_qui_la_ferait_tenir, avertissements),
    },
    { type: "fin", sources: sourcesPrincipales(contenu) },
  ].filter(Boolean);
  if (!recit.ailleurs) {
    avertissements.push({ cle: "slide « Ailleurs »", message: `Slide sautée : la fiche ne cite aucun précédent étranger. Le carrousel passe à ${brutes.length} slides.` });
  }

  const total = brutes.length;
  const slides = brutes.map((slide, index) => {
    const numero = index + 1;
    const { fichier, libelle } = TYPES_SLIDES_RECIT[slide.type];
    return {
      ...slide,
      ...(slide.type === "couverture" ? { sousTitre: `Notre analyse en ${total} slides` } : {}),
      numero,
      total,
      fichier: `${String(numero).padStart(2, "0")}-${fichier}.png`,
      libelle,
    };
  });

  // Légende : accroche du modèle, le reste par le code (comme le carrousel 6 slides).
  const courts = (cote) => contenu?.reseaux?.tient?.[cote]?.[0];
  const tient = courts("tient_court") && courts("tient_pas_court") ? { oui: courts("tient_court"), non: courts("tient_pas_court") } : null;
  const { legende, couleur } = legendeEtCouleur({ ...donnees, titre, accroche: nom(recit.legende_accroche), tient }, avertissements);

  const tweet = remplirTweet(recit.tweet_assemble, valeurs);
  const version = `${analyseId}-r-${empreinte(JSON.stringify([candidatNom, slugCandidat({ nom: candidatNom, photoUrl }), couleur, sujet, slides]))}`;
  return { slides, legende, tweet, avertissements, version, couleur, sujet };
}

// Nom de l'archive : carrousel-recit-<id>-<slug du candidat>.zip.
export function nomArchiveRecit({ propositionId, candidatNom, photoUrl }) {
  return `carrousel-recit-${propositionId}-${slugCandidat({ nom: candidatNom, photoUrl })}.zip`;
}
