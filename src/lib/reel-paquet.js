import { URL_SITE } from "./reseaux.js";
import { formatDuree } from "./reel.js";

// Contenu du « Tout télécharger (.zip) » de /test/reels/<id> : noms des
// fichiers et textes (script, sous-titres, plan de montage, infos). Fonctions
// PURES, testées par scripts/reel-paquet.test.js. L'archive elle-même est
// assemblée dans le navigateur (src/lib/zip-simple.js, ReelPartage.js), à
// partir des images déjà affichées sur la page.

export function slugTexte(texte) {
  return String(texte ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// « 01-accroche.png » … « 09-appel-final.png ».
export function nomImageScene({ numero, nom }) {
  return `${String(numero).padStart(2, "0")}-${slugTexte(nom)}.png`;
}

// « reel-93-teddy-riner-sombre.zip ».
export function nomArchiveReel({ propositionId, slug, theme }) {
  return `reel-${propositionId}-${slugTexte(slug) || "fiche"}-${theme}.zip`;
}

const LIBELLES_ECRAN = {
  titre: "Titre",
  chiffre: "Grand chiffre",
  legende: "Légende",
  tampon: "Tampon",
  question: "Question",
  nom: "Nom",
  score: "Score",
  palier: "Palier",
};

function lignesEcran(ecran = {}) {
  return Object.entries(ecran)
    .filter(([cle, valeur]) => cle !== "couleur" && valeur !== undefined && valeur !== "")
    .map(([cle, valeur]) => `${LIBELLES_ECRAN[cle] ?? cle} « ${valeur} »`);
}

// Plan de montage en Markdown : pour chaque scène, l'image, le texte dit, les
// sous-titres, le texte à l'écran et l'icône.
export function planDeMontage(scenes, { nbMots, dureeEstimee } = {}) {
  const entete = [
    "# Plan de montage",
    "",
    nbMots ? `${nbMots} mots, durée estimée ${formatDuree(dureeEstimee)} (150 mots par minute).` : null,
    "Chaque image dure le temps de son paragraphe de voix.",
    "",
  ].filter((ligne) => ligne !== null);
  const blocs = scenes.map((scene) => {
    const ecran = lignesEcran(scene.ecran);
    return [
      `## Scène ${scene.numero} · ${scene.nom}`,
      "",
      `- Image : ${nomImageScene(scene)}`,
      `- Texte dit : ${scene.voix}`,
      `- Sous-titres : ${scene.sousTitres}`,
      `- À l'écran : ${ecran.length ? ecran.join(" · ") : "(rien d'autre que le logo)"}`,
      `- Icône : ${scene.icone ?? (scene.id === "appel" ? "commente, partage" : "aucune")}`,
      "",
    ].join("\n");
  });
  return `${[...entete, ...blocs].join("\n").trimEnd()}\n`;
}

// infos.txt : de quoi retrouver la fiche.
export function infosReel({ candidatNom, titre, score, palier, propositionId, brouillon, genereLe }) {
  const lien = brouillon ? `${URL_SITE}/test/${propositionId} (brouillon, non publié)` : `${URL_SITE}/declarations/${propositionId}`;
  const date = genereLe
    ? new Date(genereLe).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Paris" })
    : "inconnue";
  return [
    `Candidat : ${candidatNom}`,
    `Fiche : ${titre}`,
    `Score : ${String(score).replace(".", ",")}/100`,
    `Palier : ${palier}`,
    `Lien : ${lien}`,
    `Script généré le : ${date}`,
    "",
  ].join("\n");
}

// Les 4 fichiers texte de l'archive (indépendants du thème des images).
export function fichiersTexteReel({ scenes, texteVoix, texteSousTitres, nbMots, dureeEstimee, infos }) {
  return [
    { nom: "script-elevenlabs.txt", donnees: `${texteVoix}\n` },
    { nom: "sous-titres.txt", donnees: `${texteSousTitres}\n` },
    { nom: "plan-de-montage.md", donnees: planDeMontage(scenes, { nbMots, dureeEstimee }) },
    { nom: "infos.txt", donnees: infosReel(infos) },
  ];
}
