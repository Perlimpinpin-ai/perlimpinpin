import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, parse } from "node:path";
import { slugCandidat } from "./carte.js";
import { slugTexte } from "./reel-paquet.js";
import { fichePourReel } from "./reel-generation.js";
import { themeLabel } from "./themes.js";
import { aleaFiche, choisirIllustration, creditLegende, creditVisible } from "./illustrations.js";
import { PHOTOS_CANDIDATS, photosDuCandidat } from "./photos-candidats.js";
import { couleursStoryboard, zonesStoryboard } from "./reel-disposition.js";
import { choisirCandidatsThematique, choisirMesuresProgramme, themeCourt } from "./reel-formats.js";
import {
  checkList,
  controlerStoryboard,
  couvertureFormat,
  couvertureStoryboard,
  estStoryboard,
  lireMinutage,
  messageFinal,
  minutageEstime,
  sousTitresSrt,
  texte,
} from "./reel-storyboard.js";

// Storyboard d'un Reel, tel que le voient les pages, la route des images et le
// zip : mêmes données des deux côtés. Côté serveur seulement (lecture de
// fichiers). Trois formats (« mesure », « programme », « thematique »).
//
// Sources :
//   - la base : contenuComplet.reel d'une fiche (format « mesure », v4 ou v5) ;
//   - une simulation (?simulation=A|B, mode édition) : la réponse simulée du
//     modèle rangée dans data/reel-demo/ (fiche-<id>/, programme-<slug>/,
//     thematique-<thème>/), avec un extrait des fiches lu une fois en base.
//     Aucun appel à Claude, rien n'est lu ni écrit en base.

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

const existe = (chemin) => existsSync(join(PUBLIC(), chemin));

// Fond granuleux présent (check-list : « le grain est présent »).
export const CHEMIN_FOND = join("reel", "v5", "fond.png");
export function grainPresent() {
  return existe(CHEMIN_FOND);
}

// Photo du candidat : bibliothèque validée du carrousel si elle existe, sinon
// la vignette du site (même repli que le carrousel). Tramée par
// scripts/reel-ressources.js.
export function photoCandidat(candidat) {
  const slug = slugCandidat(candidat);
  const validee = photosDuCandidat(slug, PHOTOS_CANDIDATS)[0] ?? null;
  return {
    pixel: join("reel", "photos", "candidats", `${slug}-pixel.png`),
    mosaique: join("reel", "photos", "candidats", `${slug}-mosaique.png`),
    bibliotheque: Boolean(validee),
    credit: validee
      ? `Photo de ${candidat.nom} : ${validee.auteur}, ${validee.licence}, ${validee.source ?? "Wikimedia Commons"} ${validee.lien ?? ""}`.trim()
      : `${candidat.nom} : vignette actuelle du site Perlimpinpin (pas encore de photo validée dans la bibliothèque), tramée par scripts/reel-ressources.js.`,
  };
}

// Image de thème de la banque du carrousel (Commons), choisie de façon stable
// pour la fiche (aleaFiche), tramée charbon / moutarde.
export function imageTheme(theme, graine) {
  const { illustration } = choisirIllustration({ theme, alea: aleaFiche(String(graine)) });
  if (!illustration) return null;
  const { dir, name } = parse(illustration.fichier);
  const dossier = join("reel", "photos", "themes", parse(dir).name);
  return { illustration, pixel: join(dossier, `${name}-pixel.png`), mosaique: join(dossier, `${name}-mosaique.png`), credit: creditLegende(illustration) };
}

// Présence des photos et crédits (page, check-list, credits.txt).
// candidats : liste des candidats montrés ; theme et graine : image de thème
// (format « mesure » seulement).
export function etatPhotos({ candidats, theme = null, graine = null }) {
  const photos = candidats.map(photoCandidat);
  const illustration = theme ? imageTheme(theme, graine) : null;
  const candidatOk = photos.every((p) => existe(p.pixel) && existe(p.mosaique));
  const illustrationOk = Boolean(illustration && existe(illustration.pixel) && existe(illustration.mosaique));
  return {
    candidat: candidatOk,
    illustration: illustrationOk,
    bibliotheque: photos.every((p) => p.bibliotheque),
    creditsCandidats: photos.map((p) => p.credit),
    creditIllustration: illustration?.credit ?? null,
    credits: candidatOk && (!theme || !illustrationOk || Boolean(illustration?.credit)),
    // Ancien nom gardé pour infos.txt.
    creditCandidat: photos.map((p) => p.credit).join(" ; "),
    chemins: { candidats: photos, illustration },
  };
}

function dataUri(chemin) {
  try {
    return `data:image/png;base64,${readFileSync(join(PUBLIC(), chemin)).toString("base64")}`;
  } catch {
    return null;
  }
}

// Images des fenêtres, portraits et médaillons en data URI (route des images).
// Format « mesure » et « programme » : candidat, candidatMosaique (et
// l'illustration au format « mesure ») ; thématique : candidat-1, candidat-2…
export function imagesPhotos(etat) {
  const trame = dataUri(join("reel", "v5", "trame.png"));
  const c = etat.photos.chemins;
  const sortie = {};
  c.candidats.forEach((p, i) => {
    sortie[`candidat-${i + 1}`] = dataUri(p.pixel);
    if (i === 0) {
      sortie.candidat = dataUri(p.pixel);
      sortie.candidatMosaique = dataUri(p.mosaique) ?? sortie.candidat;
    }
  });
  if (etat.format === "mesure") {
    sortie.illustration = (c.illustration && dataUri(c.illustration.pixel)) ?? trame;
    sortie.illustrationMosaique = (c.illustration && dataUri(c.illustration.mosaique)) ?? trame;
  }
  return sortie;
}

// Fonds (grain, voile) en data URI, mis en mémoire.
let fondsEnCache = null;
export function fondsRendu() {
  fondsEnCache ??= { fond: dataUri(CHEMIN_FOND), voile: dataUri(join("reel", "v5", "voile.png")) };
  return fondsEnCache;
}

// Ressources du rendu : fonds, photos tramées, grilles des cartes utilisées.
export function ressourcesRendu(etat) {
  const cles = new Set(etat.storyboard.scenes.filter((s) => s.type === "pays").flatMap((s) => s.groupes.flatMap((g) => g.pays)));
  return { fonds: fondsRendu(), photos: imagesPhotos(etat), cartes: Object.fromEntries([...cles].map((cle) => [cle, grilleCarte(cle)])) };
}

// --- Simulation -------------------------------------------------------------------

export function dossierDemo(propositionId) {
  return join(process.cwd(), "data", "reel-demo", `fiche-${propositionId}`);
}

export function dossierDemoFormat(format, cible) {
  return join(process.cwd(), "data", "reel-demo", `${format}-${slugTexte(cible)}`);
}

function lireDans(dossier, nom) {
  const chemin = join(dossier, nom);
  return existsSync(chemin) ? readFileSync(chemin, "utf8") : null;
}

// Fichiers de la simulation : { reponse, script, minutage } ou { erreur }.
function lireSimulationDans(dossier, mode, libelle) {
  const reponse = lireDans(dossier, `reponse-${mode}.json`);
  if (!reponse) return { erreur: `Pas de réponse simulée (${libelle}/reponse-${mode}.json).` };
  const sortie = { reponse: JSON.parse(reponse) };
  if (mode === "B") {
    sortie.script = lireDans(dossier, "script-B.txt") ?? "";
    const minutage = lireDans(dossier, "minutage-B.json");
    sortie.minutage = minutage ? JSON.parse(minutage) : null;
  }
  return sortie;
}

export function lireSimulation(propositionId, mode) {
  return lireSimulationDans(dossierDemo(propositionId), mode, `data/reel-demo/fiche-${propositionId}`);
}

// Extrait de la fiche rangé avec la simulation (data/reel-demo/fiche-<id>/fiche.json) :
// { proposition, analyse } ou null. Permet de voir la simulation sans base.
export function ficheSimulation(propositionId) {
  const brut = lireDans(dossierDemo(propositionId), "fiche.json");
  return brut ? JSON.parse(brut) : null;
}

// Données d'une simulation programme ou thématique (donnees.json) : les
// fiches publiées lues une fois en base, au format de src/lib/reel-formats.js.
export function donneesSimulationFormat(format, cible) {
  const brut = lireDans(dossierDemoFormat(format, cible), "donnees.json");
  return brut ? JSON.parse(brut) : null;
}

// Variantes des phrases fixes de la simulation (toujours les premières).
export const VARIANTES_SIMULATION = { signature: 0, verdict: 0, fin: 0 };

// --- État complet ------------------------------------------------------------------

// Partie commune aux trois formats : contrôle, couverture, zones, couleurs,
// photos, sous-titres, message, check-list.
function etatCommun({ format, raw, mode, script, minutageBrut, variantes, ctxControle, ctxImages, couvertureRangee, photos, simulation, genereLe, avertissementsRanges = [], anciensPictos = false }) {
  const minutageLu = minutageBrut ? lireMinutage(minutageBrut) : null;
  const erreurMinutage = minutageLu?.erreur ?? null;
  const minutage = minutageLu && !minutageLu.erreur ? minutageLu : null;
  const controle = controlerStoryboard(raw, { ...ctxControle, format, mode, script, minutage, variantes, cartesDisponibles: cartesDisponibles(), anciensPictos });
  if (!controle.storyboard) return { format, mode, simulation, erreurs: [...controle.erreurs, ...(erreurMinutage ? [erreurMinutage] : [])], storyboard: null };
  const storyboard = controle.storyboard;
  const couverture =
    format === "mesure" ? (couvertureRangee?.titre ? { ...couvertureRangee, horsListe: false } : couvertureStoryboard(storyboard, { alea: () => 0 })) : couvertureFormat(format, ctxImages);
  const zones = zonesStoryboard(storyboard.scenes, couverture, ctxImages);
  const couleurs = couleursStoryboard(storyboard.scenes, couverture, ctxImages);
  const avertissementsPhotos = [
    ...(!photos.candidat ? ["Photo tramée d’un candidat manquante : lancer node scripts/reel-ressources.js."] : []),
    ...(!photos.bibliotheque ? ["Pas encore de photo validée dans la bibliothèque (src/lib/photos-candidats.js) : vignette actuelle du site tramée à la place, comme dans le carrousel."] : []),
    ...(format === "mesure" && !photos.illustration ? ["Pas d’image de thème tramée : panneau tramé à la place (node scripts/reel-ressources.js)."] : []),
  ];
  const couvertureAvert = couverture.horsListe ? [`Couverture : question « ${couverture.questionProposee} » hors liste, remplacée par « ${couverture.question} ».`] : [];
  // Erreurs : celles du contrôle et les couleurs hors palette (refus). En
  // base, une erreur nouvelle (score changé depuis la génération…) devient un
  // point à corriger.
  const erreursToutes = [...controle.erreurs, ...couleurs.erreurs];
  const avertissements = [
    ...(simulation ? [] : erreursToutes.map((e) => `À corriger : ${e}`)),
    ...(erreurMinutage ? [erreurMinutage] : []),
    ...controle.avertissements,
    ...avertissementsRanges.filter((a) => !controle.avertissements.includes(a)),
    ...couvertureAvert,
    ...avertissementsPhotos,
  ];
  const temps = controle.temps;
  const minutageZip = minutage ? { ...minutageBrut } : minutageEstime(storyboard.scenes);
  const ecarts = minutage?.ecarts ?? [];
  const srt = sousTitresSrt(storyboard.scenes, temps);
  const pointsAValider = [...avertissements, ...zones];
  return {
    format,
    mode,
    simulation,
    valide: erreursToutes.length === 0,
    erreurs: simulation ? erreursToutes : [],
    storyboard,
    couverture,
    temps,
    script: mode === "B" ? script : storyboard.scenes.map((s) => s.voix.filter((m, i, l) => i === 0 || m !== l[i - 1]).map((m) => m.replace(/\*\*/g, "")).join(" ")).join("\n\n"),
    minutage: minutageZip,
    ecarts,
    srt,
    avertissements,
    zones,
    couleurs,
    photos,
    message: messageFinal({ scenes: storyboard.scenes, temps, ecarts, pointsAValider, mode }),
    checkList: checkList({ format, mode, storyboard, couverture, temps, erreurs: erreursToutes, avertissements, avertissementsZones: zones, couleurs, grain: grainPresent(), photos, minutage, srt }),
    genereLe,
    ctx: ctxImages,
  };
}

// Format « une mesure ».
//   proposition : { id, titre, theme, candidat: { nom, photoUrl } }
//   analyse : { id, statut, scoreFaisabilite, contenuComplet }
//   simulation : "A", "B" ou null (base)
// Renvoie null s'il n'y a rien à montrer (pas de Reel v4/v5 et pas de
// simulation), { erreur } si la simulation manque, sinon l'état.
export function etatStoryboard({ proposition, analyse, simulation = null }) {
  const contenu = analyse.contenuComplet ?? {};
  const score = analyse.scoreFaisabilite;
  const candidatNom = proposition.candidat.nom;
  const theme = themeLabel(proposition.theme) ?? proposition.theme ?? "";
  const photos = etatPhotos({ candidats: [proposition.candidat], theme: proposition.theme, graine: proposition.id });
  // Crédit de l'image de thème sur la couverture, quand sa licence le demande.
  const credit = photos.illustration ? creditVisible(photos.chemins.illustration.illustration) : null;
  const ctxImages = { format: "mesure", candidatNom, theme, credit };
  const fiche = fichePourReel(contenu);

  let mode;
  let raw;
  let script = "";
  let minutageBrut = null;
  let variantes = null;
  let genereLe = null;
  let avertissementsRanges = [];
  let anciensPictos = false;
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
    anciensPictos = reel.version === 4;
    avertissementsRanges = (reel.avertissements ?? []).filter((a) => !/^Scène \d+ \(.+\), image \d/.test(a));
  }
  const etat = etatCommun({
    format: "mesure",
    raw,
    mode,
    script,
    minutageBrut,
    variantes,
    ctxControle: { ficheFinale: fiche, score, candidatNom },
    ctxImages,
    couvertureRangee: simulation ? null : contenu.reel?.couverture,
    photos,
    simulation,
    genereLe,
    avertissementsRanges,
    anciensPictos,
  });
  return { ...etat, candidatNom: texte(candidatNom), theme, score };
}

// Formats « programme » (cible : slug du candidat) et « thématique » (cible :
// slug du thème). `donnees` : { fiches, candidatsConnus } (fiches publiées,
// au format de src/lib/reel-formats.js) ; options : choix (programme, numéros
// de fiches), avec (thématique, candidats sans fiche à montrer).
// Renvoie { selection, etat } : selection = mesures ou candidats retenus (et
// leur erreur) ; etat = null sans storyboard, { erreur } si la simulation
// manque, sinon l'état.
export function etatStoryboardFormat({ format, cible, donnees, simulation = null, choix = null, avec = [] }) {
  const fiches = donnees?.fiches ?? [];
  let selection;
  let ctxImages;
  let ctxControle;
  let candidatsMontres;
  if (format === "programme") {
    selection = choisirMesuresProgramme(fiches, { choix });
    const candidat = fiches[0]?.candidat ?? { nom: cible, photoUrl: null };
    ctxImages = { format, candidatNom: candidat.nom, theme: "programme", mesures: selection.mesures };
    ctxControle = { candidatNom: candidat.nom, mesures: selection.mesures };
    candidatsMontres = [candidat];
  } else {
    selection = choisirCandidatsThematique(fiches, cible, { avec, candidatsConnus: donnees?.candidatsConnus ?? [] });
    ctxImages = { format, theme: selection.theme, themeLibelle: selection.themeLibelle, themeCourt: selection.themeCourt, candidats: selection.candidats };
    ctxControle = { candidats: selection.candidats };
    candidatsMontres = selection.candidats.map((c) => ({ nom: c.nom, photoUrl: c.photoUrl }));
  }
  if (!simulation) return { selection, etat: null };
  const sim = lireSimulationDans(dossierDemoFormat(format, cible), simulation, `data/reel-demo/${format}-${slugTexte(cible)}`);
  if (sim.erreur) return { selection, etat: { erreur: sim.erreur } };
  const photos = etatPhotos({ candidats: candidatsMontres });
  const etat = etatCommun({
    format,
    raw: sim.reponse,
    mode: simulation,
    script: sim.script ?? "",
    minutageBrut: sim.minutage ?? null,
    variantes: simulation === "A" ? VARIANTES_SIMULATION : null,
    ctxControle,
    ctxImages,
    couvertureRangee: null,
    photos,
    simulation,
    genereLe: null,
  });
  if (selection.erreur && etat.storyboard) etat.erreurs = [selection.erreur, ...etat.erreurs];
  return {
    selection,
    etat: { ...etat, candidatNom: ctxImages.candidatNom ?? "", theme: format === "thematique" ? selection.themeLibelle : "programme", themeCourt: ctxImages.themeCourt ?? null, score: null },
  };
}

export { themeCourt };
