import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { slugCandidat } from "./carte.js";
import { slugTexte } from "./reel-paquet.js";
import { fichePourReel } from "./reel-generation.js";
import { zonesStoryboard } from "./reel-disposition.js";
import {
  checkList,
  controlerStoryboard,
  couvertureStoryboard,
  estStoryboard,
  lireMinutage,
  messageFinal,
  minutageEstime,
  sousTitresSrt,
  texte,
} from "./reel-storyboard.js";

// Storyboard d'une fiche, tel que le voient la page /test/reels/<id>, la
// route des images (src/app/test/reels/[id]/storyboard) et le zip : mêmes
// données des deux côtés. Côté serveur seulement (lecture de fichiers).
//
// Deux sources :
//   - la base : contenuComplet.reel en version 4 (bouton « Script Claude » ou
//     dépôt « Script et voix off de l'équipe ») ;
//   - une simulation (?simulation=A|B, mode édition) : la réponse simulée du
//     modèle rangée dans data/reel-demo/fiche-<id>/ (reponse-A.json, ou
//     reponse-B.json avec script-B.txt et minutage-B.json). Aucun appel à
//     Claude, rien n'est écrit en base.

const PUBLIC = () => join(process.cwd(), "public");

// --- Ressources sur disque -------------------------------------------------------

export function cartesDisponibles() {
  try {
    return readdirSync(join(PUBLIC(), "reel", "cartes"))
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.slice(0, -5));
  } catch {
    return [];
  }
}

export function grilleCarte(cle) {
  try {
    return JSON.parse(readFileSync(join(PUBLIC(), "reel", "cartes", `${cle}.json`), "utf8"));
  } catch {
    return null;
  }
}

export function slugTheme(theme) {
  return slugTexte(theme) || "illustration";
}

// Chemins des photos tramées (scripts/reel-ressources.js), relatifs à public/.
export function cheminsPhotos(candidat, theme) {
  const slug = slugCandidat(candidat);
  const t = slugTheme(theme);
  return {
    candidat: join("reel", "photos", "candidats", `${slug}-pixel.png`),
    candidatMosaique: join("reel", "photos", "candidats", `${slug}-mosaique.png`),
    illustration: join("reel", "photos", "themes", `${t}-pixel.png`),
    illustrationMosaique: join("reel", "photos", "themes", `${t}-mosaique.png`),
  };
}

function lireCredits() {
  try {
    return JSON.parse(readFileSync(join(PUBLIC(), "illustrations", "credits.json"), "utf8"));
  } catch {
    return {};
  }
}

// Présence des photos et crédits (page, check-list, infos.txt).
export function etatPhotos(candidat, theme) {
  const chemins = cheminsPhotos(candidat, theme);
  const existe = (c) => existsSync(join(PUBLIC(), c));
  const creditIllustration = lireCredits()[slugTheme(theme)] ?? null;
  const candidatOk = existe(chemins.candidat) && existe(chemins.candidatMosaique);
  const illustrationOk = existe(chemins.illustration) && existe(chemins.illustrationMosaique);
  return {
    candidat: candidatOk,
    illustration: illustrationOk,
    creditCandidat: "Illustration du site Perlimpinpin (public/photos), tramée par scripts/reel-ressources.js.",
    creditIllustration,
    credits: candidatOk && (!illustrationOk || Boolean(creditIllustration)),
    chemins,
  };
}

function dataUri(chemin) {
  try {
    return `data:image/png;base64,${readFileSync(join(PUBLIC(), chemin)).toString("base64")}`;
  } catch {
    return null;
  }
}

// Images des fenêtres en data URI (route des images). Illustration absente :
// le panneau tramé (public/reel/v4/trame.png).
export function imagesPhotos(candidat, theme) {
  const c = cheminsPhotos(candidat, theme);
  const trame = dataUri(join("reel", "v4", "trame.png"));
  return {
    candidat: dataUri(c.candidat),
    candidatMosaique: dataUri(c.candidatMosaique) ?? dataUri(c.candidat),
    illustration: dataUri(c.illustration) ?? trame,
    illustrationMosaique: dataUri(c.illustrationMosaique) ?? trame,
  };
}

// --- Simulation -------------------------------------------------------------------

export function dossierDemo(propositionId) {
  return join(process.cwd(), "data", "reel-demo", `fiche-${propositionId}`);
}

// Fichiers de la simulation : { reponse, script, minutage } ou { erreur }.
export function lireSimulation(propositionId, mode) {
  const dossier = dossierDemo(propositionId);
  const lire = (nom) => {
    const chemin = join(dossier, nom);
    return existsSync(chemin) ? readFileSync(chemin, "utf8") : null;
  };
  const reponse = lire(`reponse-${mode}.json`);
  if (!reponse) return { erreur: `Pas de réponse simulée pour cette fiche (data/reel-demo/fiche-${propositionId}/reponse-${mode}.json).` };
  const sortie = { reponse: JSON.parse(reponse) };
  if (mode === "B") {
    sortie.script = lire("script-B.txt") ?? "";
    const minutage = lire("minutage-B.json");
    sortie.minutage = minutage ? JSON.parse(minutage) : null;
  }
  return sortie;
}

// Variantes des phrases fixes de la simulation (toujours les premières).
export const VARIANTES_SIMULATION = { signature: 0, verdict: 0, fin: 0 };

// --- État complet ------------------------------------------------------------------

// Tout ce que montrent la page, les images et le zip.
//   proposition : { id, titre, theme, candidat: { nom, photoUrl } }
//   analyse : { id, statut, scoreFaisabilite, contenuComplet }
//   simulation : "A", "B" ou null (base)
// Renvoie null s'il n'y a rien à montrer (pas de Reel v4 et pas de simulation),
// { erreur } si la simulation manque, sinon l'état.
export function etatStoryboard({ proposition, analyse, simulation = null }) {
  const contenu = analyse.contenuComplet ?? {};
  const score = analyse.scoreFaisabilite;
  const candidatNom = proposition.candidat.nom;
  const ctxImages = { candidatNom, theme: proposition.theme };
  const fiche = fichePourReel(contenu);

  let mode;
  let raw;
  let script = "";
  let minutageBrut = null;
  let variantes = null;
  let genereLe = null;
  let avertissementsRanges = [];
  if (simulation) {
    const sim = lireSimulation(proposition.id, simulation);
    if (sim.erreur) return { erreur: sim.erreur };
    mode = simulation;
    raw = sim.reponse;
    script = sim.script ?? "";
    minutageBrut = sim.minutage ?? null;
    variantes = mode === "A" ? VARIANTES_SIMULATION : null;
  } else {
    const reel = contenu.reel;
    if (!estStoryboard(reel)) return null;
    mode = reel.mode;
    raw = { couverture: reel.storyboard.couverture, scenes: reel.storyboard.scenes };
    script = reel.script ?? "";
    minutageBrut = reel.minutage ?? null;
    variantes = reel.variantes ?? null;
    genereLe = reel.genereLe ?? null;
    avertissementsRanges = (reel.avertissements ?? []).filter((a) => !/^Scène \d+ \(.+\), image \d/.test(a));
  }

  const minutageLu = minutageBrut ? lireMinutage(minutageBrut) : null;
  const erreurMinutage = minutageLu?.erreur ?? null;
  const minutage = minutageLu && !minutageLu.erreur ? minutageLu : null;
  const controle = controlerStoryboard(raw, {
    mode,
    ficheFinale: fiche,
    score,
    script,
    minutage,
    variantes,
    cartesDisponibles: cartesDisponibles(),
  });
  if (!controle.storyboard) {
    return { mode, simulation, erreurs: [...controle.erreurs, ...(erreurMinutage ? [erreurMinutage] : [])], storyboard: null };
  }
  const storyboard = controle.storyboard;
  // Couverture rangée à la génération (question déjà choisie face aux Reels
  // précédents) ; en simulation, celle du modèle.
  const rangee = simulation ? null : contenu.reel?.couverture;
  const couverture = rangee?.titre ? { ...rangee, horsListe: false } : couvertureStoryboard(storyboard, { alea: () => 0 });
  const zones = zonesStoryboard(storyboard.scenes, couverture, ctxImages);
  const photos = etatPhotos(proposition.candidat, proposition.theme);
  const avertissementsPhotos = [
    ...(!photos.candidat ? [`Photo tramée du candidat manquante (public/${photos.chemins.candidat.replace(/\\/g, "/")}) : lancer node scripts/reel-ressources.js.`] : []),
    ...(!photos.illustration ? [`Pas d’illustration pour le thème « ${proposition.theme ?? "?"} » : panneau tramé à la place (ajouter public/illustrations/${slugTheme(proposition.theme)}.jpg, son crédit dans public/illustrations/credits.json, puis node scripts/reel-ressources.js).`] : []),
    ...(photos.illustration && !photos.creditIllustration ? [`Crédit de l’illustration « ${slugTheme(proposition.theme)} » à noter dans public/illustrations/credits.json.`] : []),
  ];
  const couvertureAvert = couverture.horsListe ? [`Couverture : question « ${couverture.questionProposee} » hors liste, remplacée par « ${couverture.question} ».`] : [];
  // En base, une erreur nouvelle (score changé depuis la génération…) devient un point à corriger.
  const erreursActuelles = simulation ? controle.erreurs : controle.erreurs.map((e) => `À corriger : ${e}`);
  const avertissements = [
    ...(simulation ? [] : erreursActuelles),
    ...(erreurMinutage ? [erreurMinutage] : []),
    ...controle.avertissements,
    ...avertissementsRanges.filter((a) => !controle.avertissements.includes(a)),
    ...couvertureAvert,
    ...avertissementsPhotos,
  ];
  const temps = controle.temps;
  const minutageZip = minutage ? { ...minutageBrut } : minutageEstime(storyboard.scenes);
  const ecarts = minutage?.ecarts ?? [];
  const pointsAValider = [...avertissements, ...zones];
  return {
    mode,
    simulation,
    valide: controle.valide,
    erreurs: simulation ? controle.erreurs : [],
    storyboard,
    couverture,
    temps,
    script: mode === "B" ? script : storyboard.scenes.map((s) => s.voix.filter((m, i, l) => i === 0 || m !== l[i - 1]).map((m) => m.replace(/\*\*/g, "")).join(" ")).join("\n\n"),
    minutage: minutageZip,
    ecarts,
    srt: sousTitresSrt(storyboard.scenes, temps),
    avertissements,
    zones,
    photos,
    message: messageFinal({ scenes: storyboard.scenes, temps, ecarts, pointsAValider, mode }),
    checkList: checkList({ mode, storyboard, temps, avertissements, avertissementsZones: zones, photos, minutage }),
    genereLe,
    candidatNom: texte(candidatNom),
    theme: proposition.theme ?? "",
    score,
  };
}
