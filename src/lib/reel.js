import { formatScore, getScoreBadge } from "./score.js";
import { appreciationCarte, empreinte } from "./carte.js";
import { scoreEnLettres } from "./nombres-en-lettres.js";
import { NOMS_ICONES } from "./icones-pixel.js";
import { nombresHorsFiche } from "./nombres-fiche.js";

// Reel vertical (environ 1 min 30) d'une analyse : script de voix off et
// 9 images. Même principe que les publications X (src/lib/reseaux.js) : le
// modèle (étape 3 quater, data/prompt-reel.md) n'écrit que les parties
// variables ; le code écrit les parties fixes, le score (en chiffres et en
// lettres) et le palier, puis assemble et contrôle.
// Fonctions PURES (ni Next, ni base, ni fichiers), testées par
// scripts/reel.test.js.

// Les 9 scènes, toujours dans cet ordre.
export const SCENES_REEL = [
  { numero: 1, id: "accroche", nom: "Accroche" },
  { numero: 2, id: "presentation", nom: "Présentation" },
  { numero: 3, id: "tient", nom: "Ce qui tient" },
  { numero: 4, id: "hic", nom: "Le hic" },
  { numero: 5, id: "preuve", nom: "La preuve" },
  { numero: 6, id: "facture", nom: "La facture" },
  { numero: 7, id: "nuance", nom: "La nuance" },
  { numero: 8, id: "verdict", nom: "Verdict" },
  { numero: 9, id: "appel", nom: "Appel final" },
];

// Scènes dont le modèle écrit une partie (l'appel final est entièrement fixe).
export const SCENES_MODELE = SCENES_REEL.filter((s) => s.id !== "appel").map((s) => s.id);

// Ce que le modèle écrit pour chaque scène :
//  - voixRequise : `voix` et `sousTitres` non vides (sinon refus) ;
//  - icone : une icône de la liste fermée est exigée (sinon refus) ;
//  - ecran : champs d'écran attendus (requis : absent = avertissement) ;
//  - phrases : nombre de phrases attendu dans `voix` (hors plage = avertissement).
export const REGLES_SCENES = {
  accroche: { voixRequise: true, icone: true, ecran: { titre: "requis", chiffre: "facultatif" }, phrases: [1, 1] },
  presentation: { voixRequise: false, icone: false, ecran: {}, phrases: [0, 1] },
  tient: { voixRequise: true, icone: true, ecran: { tampon: "requis" }, phrases: [2, 2] },
  hic: { voixRequise: true, icone: true, ecran: { chiffre: "requis", legende: "requis" }, phrases: [2, 4] },
  preuve: { voixRequise: true, icone: true, ecran: { titre: "requis" }, phrases: [2, 2] },
  facture: { voixRequise: true, icone: true, ecran: { chiffre: "requis", legende: "requis" }, phrases: [2, 2] },
  nuance: { voixRequise: true, icone: true, ecran: { titre: "facultatif" }, phrases: [1, 2] },
  verdict: { voixRequise: true, icone: false, ecran: {}, phrases: [1, 1] },
};

// Longueurs maximales du texte à l'écran (au-delà : avertissement).
export const LIMITES_ECRAN = { titre: 8, legende: 10, tampon: 3, chiffre: 4 };

// Textes fixes (écrits par le code, jamais par le modèle).
export const TEXTES_FIXES = {
  accroche: "Bonne idée… ou poudre de Perlimpinpin ?",
  presentation: "Chez Perlimpinpin, notre IA passe les promesses au crible des faits. Allez, on vérifie !",
  verdictDebut: "Alors, verdict ? Chez Perlimpinpin, chaque promesse est notée sur cent.",
  verdictDebutSousTitres: "Alors, verdict ? Chez Perlimpinpin, chaque promesse est notée sur 100.",
  appel:
    "Et vous, qu'en pensez-vous ? Dites-le en commentaire, on améliore l'analyse avec vous. Et partagez pour en débattre. L'analyse complète est sur Perlimpinpin !",
};

// Débit de la voix off retenu pour estimer la durée.
export const MOTS_PAR_MINUTE = 150;
// Durée visée (au-delà : avertissement), en secondes.
export const DUREE_MIN = 75;
export const DUREE_MAX = 105;
// Longueur visée du script complet, fixes compris (au-delà : avertissement).
export const MOTS_MIN = 200;
export const MOTS_MAX = 230;

// Icônes fixes de l'appel final.
export const ICONES_APPEL = ["commente", "partage"];

// --- Petits outils -------------------------------------------------------------

function texte(valeur) {
  return typeof valeur === "string" ? valeur.replace(/\s+/g, " ").trim() : "";
}

export function nombreDeMots(t) {
  return texte(t).split(" ").filter((mot) => /[\p{L}\p{N}]/u.test(mot)).length;
}

export function nombreDePhrases(t) {
  return texte(t)
    .split(/[.!?…]+(?:\s|$)/)
    .filter((phrase) => /[\p{L}\p{N}]/u.test(phrase)).length;
}

// « de Marine Le Pen » / « d’Édouard Philippe ».
export function deCandidat(nom) {
  const propre = texte(nom);
  const initiale = propre.normalize("NFD").charAt(0).toLowerCase();
  return /[aeiouyh]/.test(initiale) ? `d’${propre}` : `de ${propre}`;
}

// Durée en secondes → « 1 min 28 s ».
export function formatDuree(secondes) {
  const s = Math.max(0, Math.round(secondes));
  const minutes = Math.floor(s / 60);
  const reste = s % 60;
  if (minutes === 0) return `${reste} s`;
  return reste === 0 ? `${minutes} min` : `${minutes} min ${String(reste).padStart(2, "0")} s`;
}

// Score pour les sous-titres : « 38 », « 38,5 ».
function scoreEnChiffres(score) {
  return String(formatScore(Number(score))).replace(".", ",");
}

// Palier du barème (src/lib/score.js) et sa couleur hexadécimale, lue dans la
// table des cartes X (src/lib/carte.js) : une seule source pour les couleurs.
export function palierReel(score) {
  const badge = getScoreBadge(Number(score));
  const teinte = appreciationCarte(Number(score));
  return { label: badge.label, couleur: teinte.score, fond: teinte.pastilleFond, texte: teinte.pastilleTexte };
}

// --- Lecture de la réponse du modèle ------------------------------------------

// Réponse brute → { variables, erreurs }. `variables` : un objet par scène du
// modèle, { voix, sousTitres, ecran, icone }, textes nettoyés. Toute erreur de
// structure est bloquante (« JSON invalide »).
export function lireReponseReel(raw) {
  const erreurs = [];
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.scenes)) {
    return { variables: null, erreurs: ["JSON invalide : un objet { \"scenes\": [ … ] } est attendu."] };
  }
  const variables = {};
  for (const [index, scene] of raw.scenes.entries()) {
    const id = scene?.id;
    if (!SCENES_MODELE.includes(id)) {
      erreurs.push(`JSON invalide : scène ${index + 1}, id « ${id} » inconnu (attendus : ${SCENES_MODELE.join(", ")}).`);
      continue;
    }
    if (variables[id]) {
      erreurs.push(`JSON invalide : la scène « ${id} » apparaît deux fois.`);
      continue;
    }
    const regles = REGLES_SCENES[id];
    const ecranBrut = scene.ecran && typeof scene.ecran === "object" && !Array.isArray(scene.ecran) ? scene.ecran : {};
    const ecran = {};
    for (const champ of Object.keys(regles.ecran)) {
      const valeur = texte(ecranBrut[champ]);
      if (valeur) ecran[champ] = valeur;
    }
    const voix = texte(scene.voix);
    const sousTitres = texte(scene.sousTitres);
    if (regles.voixRequise && (!voix || !sousTitres)) {
      erreurs.push(`JSON invalide : scène « ${id} », « voix » et « sousTitres » doivent être des textes non vides.`);
    }
    if (Boolean(voix) !== Boolean(sousTitres)) {
      if (!regles.voixRequise) erreurs.push(`JSON invalide : scène « ${id} », « voix » et « sousTitres » vont ensemble.`);
    }
    variables[id] = { voix, sousTitres, ecran, icone: texte(scene.icone) || null };
  }
  for (const id of SCENES_MODELE) {
    if (!variables[id] && !erreurs.some((e) => e.includes(`« ${id} »`))) {
      erreurs.push(`JSON invalide : la scène « ${id} » manque.`);
    }
  }
  return { variables: erreurs.length > 0 ? null : variables, erreurs };
}

// --- Assemblage ------------------------------------------------------------------

// Variables (une entrée par scène du modèle) + nom du candidat + score →
// les 9 scènes complètes, le script et les sous-titres.
export function assemblerReel(variables, { candidatNom, score }) {
  const v = (id) => variables?.[id] ?? { voix: "", sousTitres: "", ecran: {}, icone: null };
  const nom = texte(candidatNom) || "ce candidat";
  const palier = palierReel(score);
  const joindre = (...parties) => parties.map(texte).filter(Boolean).join(" ");

  const precision = v("presentation");
  const avecPrecision = (t) => (t ? `, ${t.replace(/^[,\s]+|[.\s]+$/g, "")}` : "");
  const presentationVoix = `Une promesse ${deCandidat(nom)}${avecPrecision(precision.voix)}. ${TEXTES_FIXES.presentation}`;
  const presentationSousTitres = `Une promesse ${deCandidat(nom)}${avecPrecision(precision.sousTitres)}. ${TEXTES_FIXES.presentation}`;

  const verdictVoix = joindre(TEXTES_FIXES.verdictDebut, `Ici, ${scoreEnLettres(score)} sur cent. ${palier.label}.`, v("verdict").voix);
  const verdictSousTitres = joindre(
    TEXTES_FIXES.verdictDebutSousTitres,
    `Ici, ${scoreEnChiffres(score)} sur 100. ${palier.label}.`,
    v("verdict").sousTitres,
  );

  const scenes = SCENES_REEL.map(({ numero, id, nom: nomScene }) => {
    const base = { numero, id, nom: nomScene };
    switch (id) {
      case "accroche":
        return {
          ...base,
          voix: joindre(TEXTES_FIXES.accroche, v(id).voix),
          sousTitres: joindre(TEXTES_FIXES.accroche, v(id).sousTitres),
          ecran: { surtitre: TEXTES_FIXES.accroche, ...v(id).ecran },
          icone: v(id).icone,
        };
      case "presentation":
        return { ...base, voix: presentationVoix, sousTitres: presentationSousTitres, ecran: { nom }, icone: null };
      case "verdict":
        return {
          ...base,
          voix: verdictVoix,
          sousTitres: verdictSousTitres,
          ecran: { score: formatScore(Number(score)), palier: palier.label, couleur: palier.couleur },
          icone: null,
        };
      case "appel":
        return { ...base, voix: TEXTES_FIXES.appel, sousTitres: TEXTES_FIXES.appel, ecran: {}, icone: null };
      default:
        return { ...base, voix: v(id).voix, sousTitres: v(id).sousTitres, ecran: { ...v(id).ecran }, icone: v(id).icone };
    }
  });

  const texteVoix = scenes.map((s) => s.voix).join("\n\n");
  const texteSousTitres = scenes.map((s) => s.sousTitres).join("\n\n");
  const nbMots = nombreDeMots(texteVoix);
  return {
    scenes,
    texteVoix,
    texteSousTitres,
    nbMots,
    dureeEstimee: Math.round((nbMots / MOTS_PAR_MINUTE) * 60),
    palier,
  };
}

// --- Contrôle ----------------------------------------------------------------------

// Contrôle unique du Reel. Refus (erreurs) SEULEMENT pour :
//  - un JSON invalide (structure, scène manquante, voix vide…) ;
//  - un nombre des sous-titres ou de l'écran absent de la fiche ;
//  - un deux-points ou un tiret cadratin dans la voix ;
//  - une icône hors de la liste fermée.
// Tout le reste est un avertissement, affiché sur la page /test/reels/<id>.
// Renvoie { valide, erreurs, avertissements, variables, assemble }.
export function controlerReel(raw, { ficheFinale, candidatNom, score }) {
  const { variables, erreurs: erreursStructure } = lireReponseReel(raw);
  if (!variables) return { valide: false, erreurs: erreursStructure, avertissements: [], variables: null, assemble: null };

  const erreurs = [];
  const avertissements = [];

  for (const id of SCENES_MODELE) {
    const { voix, sousTitres, ecran, icone } = variables[id];
    const regles = REGLES_SCENES[id];

    if (/:/.test(voix)) erreurs.push(`Scène « ${id} » : deux-points dans la voix (interdit).`);
    if (/—/.test(voix)) erreurs.push(`Scène « ${id} » : tiret cadratin dans la voix (interdit).`);

    if (regles.icone) {
      if (!icone) erreurs.push(`Scène « ${id} » : icône manquante (liste fermée).`);
      else if (!NOMS_ICONES.includes(icone)) erreurs.push(`Scène « ${id} » : icône « ${icone} » hors de la liste fermée.`);
    }

    const horsFiche = nombresHorsFiche([sousTitres, ...Object.values(ecran)], ficheFinale);
    for (const nombre of horsFiche) {
      erreurs.push(`Scène « ${id} » : le nombre « ${nombre} » n'apparaît pas dans la fiche.`);
    }

    // Avertissements.
    if (/\d/.test(voix)) avertissements.push(`Scène « ${id} » : chiffres dans la voix, à écrire en toutes lettres.`);
    if (/[:—]/.test(sousTitres)) avertissements.push(`Scène « ${id} » : deux-points ou tiret cadratin dans les sous-titres.`);
    for (const [champ, statut] of Object.entries(regles.ecran)) {
      if (statut === "requis" && !ecran[champ]) avertissements.push(`Scène « ${id} » : « ${champ} » manque à l'écran.`);
      const limite = LIMITES_ECRAN[champ];
      if (ecran[champ] && limite && nombreDeMots(ecran[champ]) > limite) {
        avertissements.push(`Scène « ${id} » : « ${champ} » trop long à l'écran (${nombreDeMots(ecran[champ])} mots, ${limite} au plus).`);
      }
    }
    const [min, max] = regles.phrases;
    const phrases = nombreDePhrases(voix);
    if (voix && (phrases < min || phrases > max)) {
      const attendu = min === max ? `${min}` : `${min} à ${max}`;
      avertissements.push(`Scène « ${id} » : ${phrases} phrase(s) dans la voix, ${attendu} attendue(s).`);
    }
  }

  if (!texte(candidatNom)) avertissements.push("Candidat non nommé : la scène 2 dira « ce candidat ».");

  const assemble = assemblerReel(variables, { candidatNom, score });
  if (assemble.dureeEstimee < DUREE_MIN || assemble.dureeEstimee > DUREE_MAX) {
    avertissements.push(
      `Durée estimée ${formatDuree(assemble.dureeEstimee)}, hors de ${formatDuree(DUREE_MIN)} à ${formatDuree(DUREE_MAX)} (${assemble.nbMots} mots à ${MOTS_PAR_MINUTE} mots par minute).`,
    );
  } else if (assemble.nbMots < MOTS_MIN || assemble.nbMots > MOTS_MAX) {
    avertissements.push(`${assemble.nbMots} mots au total, ${MOTS_MIN} à ${MOTS_MAX} visés.`);
  }

  return { valide: erreurs.length === 0, erreurs, avertissements, variables, assemble };
}

// Objet rangé dans contenuComplet.reel : les parties du modèle (pour
// réassembler à l'affichage avec le score courant) et le résultat assemblé
// au moment de la génération.
export function reelPourStockage({ variables, assemble, avertissements }, { candidatNom, score, date = new Date() }) {
  return {
    scenes: SCENES_MODELE.map((id) => ({ id, ...variables[id] })),
    texteVoix: assemble.texteVoix,
    texteSousTitres: assemble.texteSousTitres,
    nbMots: assemble.nbMots,
    dureeEstimee: assemble.dureeEstimee,
    avertissements,
    candidatNom: texte(candidatNom),
    score: Number(score),
    genereLe: date.toISOString(),
  };
}

// contenuComplet.reel → variables (pour assemblerReel).
export function variablesDuReel(reel) {
  if (!reel || !Array.isArray(reel.scenes)) return null;
  return Object.fromEntries(reel.scenes.map(({ id, ...reste }) => [id, reste]));
}

// --- Images -------------------------------------------------------------------------

export const THEMES_REEL = ["sombre", "clair"];
export const LARGEUR_REEL = 1080;
export const HAUTEUR_REEL = 1920;

// Version des images dans l'URL : identifiant de l'analyse + empreinte de
// tout ce que les images affichent. Le moindre changement donne une nouvelle
// URL (cache « pour toujours » des fiches publiées, comme les cartes X).
export function versionReel({ analyseId, candidatNom, score, reel }) {
  const contenu = JSON.stringify([candidatNom ?? "", score, palierReel(score).label, reel?.scenes ?? null]);
  return `${analyseId}-${empreinte(contenu)}`;
}

export function cheminImageReel({ propositionId, scene, theme = "sombre", brouillon = false, version }) {
  const params = new URLSearchParams({ scene: String(scene), theme });
  if (version) params.set("v", version);
  if (brouillon) params.set("brouillon", "1");
  return `/test/reels/${propositionId}/image?${params}`;
}
