import { URL_SITE } from "./reseaux.js";
import { slugTexte } from "./reel-paquet.js";
import { fichiersSons } from "./reel-paquet.js";
import { nomsFenetres } from "./reel-disposition.js";
import { TYPES_SCENES, formatTemps, morceauxDits, sansGras } from "./reel-storyboard.js";

// Contenu du « Tout télécharger (.zip) » du storyboard (v4). Fonctions PURES,
// testées par scripts/reel-storyboard.test.js. L'archive est assemblée dans
// le navigateur (src/lib/zip-simple.js), comme en v3.
//
// reel-<slug-candidat>-<theme>.zip
// ├── 00-couverture.png
// ├── planches/planche-01.png …
// ├── images/scene-01-1.png …
// ├── calques/fond.png, calques/01-accroche/01-visuel.png, 01-texte.png …
// ├── sons/*.wav
// ├── sous-titres.srt
// ├── minutage.json
// ├── ecarts.txt
// ├── storyboard.json (l'objet R)
// ├── script.txt (texte dit, pour caler-voix.py)
// └── infos.txt (crédits photo, mode A ou B)

const deux = (n) => String(n).padStart(2, "0");

export function nomArchiveStoryboard({ candidatNom, theme }) {
  return `reel-${slugTexte(candidatNom) || "candidat"}-${slugTexte(theme) || "theme"}.zip`;
}

// Paramètre `image` de la route (src/app/test/reels/[id]/storyboard).
export const imageScene = (i, k) => `scene-${deux(i + 1)}-${k}`;
export const imagePlanche = (i) => `planche-${deux(i + 1)}`;
export const imageCalque = (i, calque) => `calque-${deux(i + 1)}-${calque}`;

// Fichiers images et sons de l'archive : [{ nom, url }]. `url(image)` donne
// l'adresse d'une image de la route.
export function mediasStoryboard(scenes, url) {
  return [
    { nom: "00-couverture.png", url: url("couverture") },
    ...scenes.map((_, i) => ({ nom: `planches/planche-${deux(i + 1)}.png`, url: url(imagePlanche(i)) })),
    ...scenes.flatMap((_, i) => [1, 2, 3].map((k) => ({ nom: `images/scene-${deux(i + 1)}-${k}.png`, url: url(imageScene(i, k)) }))),
    { nom: "calques/fond.png", url: url("fond") },
    ...scenes.flatMap((s, i) =>
      ["visuel", "texte"].map((calque) => ({ nom: `calques/${deux(i + 1)}-${s.type}/${deux(i + 1)}-${calque}.png`, url: url(imageCalque(i, calque)) })),
    ),
    ...fichiersSons(),
  ];
}

// storyboard.json : l'objet R du gabarit (données seulement), minutage compris.
export function objetR(etat) {
  const noms = nomsFenetres({ candidatNom: etat.candidatNom, theme: etat.theme });
  return {
    candidat: etat.candidatNom,
    theme: etat.theme,
    mode: etat.mode,
    photos: { nomCandidat: noms.candidat, nomIllustration: noms.illustration },
    couverture: { titre: etat.couverture.titre, question: etat.couverture.question },
    dureesEstimees: Boolean(etat.temps.estime),
    scenes: etat.storyboard.scenes.map((s, i) => ({ ...s, debut: etat.temps.scenes[i].debut, fin: etat.temps.scenes[i].fin })),
  };
}

export function ecartsTexte(etat) {
  if (etat.mode === "A" && !(etat.minutage && !etat.minutage.estime)) {
    return "Pas encore de voix off enregistrée (mode A) : écarts à mesurer avec scripts/caler-voix.py, puis passer en mode B.\n";
  }
  return etat.ecarts.length ? `${etat.ecarts.join("\n")}\n` : "Aucun écart : la voix off suit le script.\n";
}

export function infosStoryboard(etat, { titre, propositionId, brouillon, palier, simulation = null }) {
  const lien = brouillon ? `${URL_SITE}/test/${propositionId} (brouillon, non publié)` : `${URL_SITE}/declarations/${propositionId}`;
  const date = etat.genereLe
    ? new Date(etat.genereLe).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Paris" })
    : simulation
      ? "simulation (rien en base)"
      : "inconnue";
  return [
    `Candidat : ${etat.candidatNom}`,
    `Fiche : ${titre}`,
    `Thème : ${etat.theme}`,
    `Score : ${String(etat.score).replace(".", ",")}/100 (${palier})`,
    `Lien : ${lien}`,
    `Mode : ${etat.mode === "A" ? "A, script écrit par Claude" : "B, script et voix off de l’équipe"}${simulation ? " (simulation, aucun appel à Claude)" : ""}`,
    `Storyboard généré le : ${date}`,
    `Durée : ${formatTemps(etat.temps.duree)}${etat.temps.estime ? " (estimée à 3 mots par seconde)" : " (calée sur la voix off)"}`,
    "",
    "Crédits photo :",
    `- Candidat : ${etat.photos.creditCandidat}`,
    `- Illustration : ${etat.photos.illustration ? etat.photos.creditIllustration ?? "CRÉDIT À COMPLÉTER (public/illustrations/credits.json)" : "aucune (panneau tramé dessiné par le code)"}`,
    "",
    `Message : ${etat.message}`,
    "",
  ].join("\n");
}

// Texte dit, une scène par paragraphe (entrée de scripts/caler-voix.py en mode A).
export function scriptDit(scenes) {
  return `${scenes.map((s) => morceauxDits(s).map(sansGras).join(" ")).join("\n\n")}\n`;
}

export function fichiersTexteStoryboard(etat, infos) {
  return [
    { nom: "sous-titres.srt", donnees: etat.srt },
    { nom: "minutage.json", donnees: `${JSON.stringify(etat.minutage, null, 2)}\n` },
    { nom: "ecarts.txt", donnees: ecartsTexte(etat) },
    { nom: "storyboard.json", donnees: `${JSON.stringify(objetR(etat), null, 2)}\n` },
    { nom: "script.txt", donnees: etat.mode === "B" ? `${etat.script.trim()}\n` : scriptDit(etat.storyboard.scenes) },
    { nom: "infos.txt", donnees: infosStoryboard(etat, infos) },
  ];
}

// Données de la page pour le composant client (ReelStoryboard).
export function donneesPageStoryboard(etat, { url, infos }) {
  const scenes = etat.storyboard.scenes;
  return {
    mode: etat.mode,
    simulation: etat.simulation,
    message: etat.message,
    checkList: etat.checkList,
    avertissements: etat.avertissements,
    zones: etat.zones,
    duree: formatTemps(etat.temps.duree),
    estime: etat.temps.estime,
    couverture: { ...etat.couverture, url: url("couverture") },
    script: etat.mode === "B" ? etat.script : scriptDit(scenes),
    srt: etat.srt,
    scenes: scenes.map((s, i) => ({
      numero: i + 1,
      type: s.type,
      nom: TYPES_SCENES[s.type]?.nom ?? s.type,
      debut: formatTemps(etat.temps.scenes[i].debut),
      fin: formatTemps(etat.temps.scenes[i].fin),
      duree: (etat.temps.scenes[i].fin - etat.temps.scenes[i].debut).toFixed(1).replace(".", ","),
      voix: s.voix,
      mouvement: s.mouvement,
      planche: url(imagePlanche(i)),
      images: [1, 2, 3].map((k) => url(imageScene(i, k))),
    })),
    paquet: {
      archive: nomArchiveStoryboard({ candidatNom: etat.candidatNom, theme: etat.theme }),
      fichiersTexte: fichiersTexteStoryboard(etat, infos),
      medias: mediasStoryboard(scenes, url),
    },
  };
}
