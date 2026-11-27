import { urlFiche } from "./slug.js";
import { URL_SITE } from "./reseaux.js";
import { formatDuree } from "./reel.js";
import { SONS, elementsScene, montageScene } from "./reel-montage.js";

// Contenu du « Tout télécharger (.zip) » de /test/reels/<id> : noms des
// fichiers, liste des images à récupérer (couverture, scènes, calques, sons)
// et textes (script, sous-titres, plan de montage, infos). Fonctions PURES,
// testées par scripts/reel-paquet.test.js. L'archive elle-même est assemblée
// dans le navigateur (src/lib/zip-simple.js, ReelPartage.js).

export function slugTexte(texte) {
  return String(texte ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export const NOM_COUVERTURE = "00-couverture.png";

// « 01-accroche.png » … « 09-appel-final.png ».
export function nomImageScene({ numero, nom }) {
  return `${String(numero).padStart(2, "0")}-${slugTexte(nom)}.png`;
}

// « calques/01-accroche » : un dossier de calques par scène.
export function dossierCalques(scene) {
  return `calques/${nomImageScene(scene).replace(/\.png$/, "")}`;
}

const NOMS_CALQUES = { icone: "icone", texte: "texte", chiffre: "chiffre" };

// Calques à télécharger : le fond (un seul pour toute la vidéo), puis pour
// chaque scène ses éléments présents ({ nom, scene, calque }).
// « calques/01-accroche/01-icone.png ».
export function fichiersCalques(scenes, { portrait = false } = {}) {
  return [
    { nom: "calques/fond.png", scene: null, calque: "fond" },
    ...scenes.flatMap((scene) =>
      elementsScene(scene, { portrait }).map((calque) => ({
        nom: `${dossierCalques(scene)}/${String(scene.numero).padStart(2, "0")}-${NOMS_CALQUES[calque]}.png`,
        scene: scene.numero,
        calque,
      })),
    ),
  ];
}

// Les 6 bruitages (public/reel/sons/).
export function fichiersSons() {
  return SONS.map((nom) => ({ nom: `sons/${nom}.wav`, url: `/reel/sons/${nom}.wav` }));
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

const LIBELLES_CALQUES = { icone: "icône", texte: "texte", chiffre: "chiffre" };

// Plan de montage en Markdown : la couverture, puis pour chaque scène
// l'image, le texte dit, les sous-titres, le texte à l'écran, les calques,
// les animations, la transition et le son.
export function planDeMontage(scenes, { nbMots, dureeEstimee, couverture = null, portrait = false } = {}) {
  const entete = [
    "# Plan de montage",
    "",
    nbMots ? `${nbMots} mots, durée estimée ${formatDuree(dureeEstimee)} (150 mots par minute).` : null,
    "Chaque image dure le temps de son paragraphe de voix.",
    "Calques : dans calques/, un PNG transparent par élément (icône, texte, chiffre), aligné sur l'image complète ; calques/fond.png sert à toute la vidéo.",
    "Sons : dans sons/, toujours nettement sous la voix.",
    "",
  ].filter((ligne) => ligne !== null);
  const blocCouverture = couverture
    ? [
        `## Couverture`,
        "",
        `- Image : ${NOM_COUVERTURE} (à choisir comme photo du Reel ; tout le contenu tient dans la zone centrale 1080 × 1350)`,
        `- Titre : « ${couverture.titre} »`,
        `- Question : « ${couverture.question} »`,
        "",
      ].join("\n")
    : null;
  const blocs = scenes.map((scene) => {
    const ecran = lignesEcran(scene.ecran);
    const montage = montageScene(scene);
    const calques = elementsScene(scene, { portrait }).map((c) => LIBELLES_CALQUES[c]);
    return [
      `## Scène ${scene.numero} · ${scene.nom}`,
      "",
      `- Image : ${nomImageScene(scene)}`,
      `- Texte dit : ${scene.voix}`,
      `- Sous-titres : ${scene.sousTitres}`,
      `- À l'écran : ${ecran.length ? ecran.join(" · ") : "(rien d'autre que le logo)"}`,
      `- Icône : ${scene.icone ?? (scene.id === "appel" ? "commente, partage" : "aucune")}`,
      `- Calques : ${dossierCalques(scene)}/ (${calques.join(", ")})`,
      montage.animations ? `- Animations : ${montage.animations}` : null,
      montage.transition ? `- Transition : ${montage.transition}` : null,
      `- Son : ${montage.son ?? "aucun"}`,
      "",
    ]
      .filter((ligne) => ligne !== null)
      .join("\n");
  });
  return `${[...entete, ...(blocCouverture ? [blocCouverture] : []), ...blocs].join("\n").trimEnd()}\n`;
}

// infos.txt : de quoi retrouver la fiche.
export function infosReel({ candidatNom, titre, score, palier, propositionId, slug = null, brouillon, genereLe }) {
  const lien = brouillon ? `${URL_SITE}/test/${propositionId} (brouillon, non publié)` : urlFiche({ id: propositionId, slug });
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
export function fichiersTexteReel({ scenes, texteVoix, texteSousTitres, nbMots, dureeEstimee, couverture, portrait, infos }) {
  return [
    { nom: "script-elevenlabs.txt", donnees: `${texteVoix}\n` },
    { nom: "sous-titres.txt", donnees: `${texteSousTitres}\n` },
    { nom: "plan-de-montage.md", donnees: planDeMontage(scenes, { nbMots, dureeEstimee, couverture, portrait }) },
    { nom: "infos.txt", donnees: infosReel(infos) },
  ];
}

// Fichiers binaires de l'archive pour un thème : couverture, 9 images,
// calques, sons. `url({ scene, calque })` donne l'adresse d'une image
// (scene : numéro ou « couverture »).
export function mediasReel(scenes, { url, portrait = false }) {
  return [
    { nom: NOM_COUVERTURE, url: url({ scene: "couverture" }) },
    ...scenes.map((scene) => ({ nom: nomImageScene(scene), url: url({ scene: scene.numero }) })),
    ...fichiersCalques(scenes, { portrait }).map(({ nom, scene, calque }) => ({ nom, url: url({ scene: scene ?? 1, calque }) })),
    ...fichiersSons(),
  ];
}

// Données de la page /test/reels/<id> (et de l'aperçu fictif) pour
// ReelPartage : textes, montage, URL des images, des calques et de la
// couverture dans les deux thèmes, sons, et contenu du zip.
// `url({ scene, theme, calque })` donne l'adresse d'une image.
export function donneesPartageReel({ assemble, portrait = false, duree, prefixeFichier, slug, propositionId, url, infos }) {
  const themes = ["sombre", "clair"];
  const parTheme = (f) => Object.fromEntries(themes.map((theme) => [theme, f(theme)]));
  return {
    texteVoix: assemble.texteVoix,
    texteSousTitres: assemble.texteSousTitres,
    nbMots: assemble.nbMots,
    duree,
    scenes: assemble.scenes.map((scene) => ({
      numero: scene.numero,
      nom: scene.nom,
      voix: scene.voix,
      sousTitres: scene.sousTitres,
      montage: montageScene(scene).resume,
    })),
    images: parTheme((theme) => assemble.scenes.map((scene) => url({ scene: scene.numero, theme }))),
    couverture: {
      titre: assemble.couverture.titre,
      question: assemble.couverture.question,
      images: parTheme((theme) => url({ scene: "couverture", theme })),
    },
    calques: parTheme((theme) =>
      assemble.scenes.map((scene) =>
        elementsScene(scene, { portrait }).map((calque) => ({ calque, url: url({ scene: scene.numero, theme, calque }) })),
      ),
    ),
    sons: fichiersSons(),
    prefixeFichier,
    // « Tout télécharger (.zip) » : textes préparés ici, images et sons
    // récupérés par le navigateur dans le thème choisi.
    paquet: {
      archive: parTheme((theme) => nomArchiveReel({ propositionId, slug, theme })),
      fichiersTexte: fichiersTexteReel({ ...assemble, portrait, infos }),
      medias: parTheme((theme) => mediasReel(assemble.scenes, { url: (o) => url({ ...o, theme }), portrait })),
    },
  };
}
