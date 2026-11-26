import { formatScore, getScoreBadge } from "./score.js";
import { nombresHorsFiche, extraireNombres } from "./nombres-fiche.js";
import { tournuresIA } from "./tournures-ia.js";
import { NOMS_PIXEL, nomPicto } from "./reel-pixel.js";
import { nomDeFamille, prenom } from "./charte-rs.js";
import { CLES_PAYS, paysCites, paysParCle } from "./reel-pays.js";
import { QUESTIONS_COUVERTURE, SONS, VARIANTES, avertissementVariabilite, questionCouverture } from "./reel-montage.js";

// Storyboard des Reels (v5, docs/prompt-reel.md et docs/charte-rs.pdf) : des
// scènes typées, 3 images clés par scène, voix off découpée en 3 morceaux,
// mouvement décrit en 3 phrases. L'objet `R` du prompt. Trois formats :
//   « mesure »     une proposition d'un candidat (≈ 1 min, 7 à 10 scènes) ;
//   « programme »  6 mesures d'un candidat, notées, puis le classement ;
//   « thematique » 4 à 8 candidats sur un thème, ordre alphabétique.
// Deux modes :
//   A « Script Claude » : Claude écrit le script et le storyboard ;
//   B « Script et voix off de l'équipe » : Claude découpe le texte de
//     l'équipe sans le réécrire (contrôle mot pour mot bloquant).
// Fonctions PURES (ni Next, ni base, ni fichiers), testées par
// scripts/reel-storyboard.test.js et scripts/reel-formats.test.js.

export const VERSION_STORYBOARD = 5;
export const SCENES_MIN = 7;
export const SCENES_MAX = 10;
export const DUREE_SCENE_MIN = 5;
export const DUREE_SCENE_MAX = 9;
export const MOTS_ECRAN_MAX = 7;
export const MOTS_PHRASE_MAX = 20;
export const MOTS_LIGNE_SOUS_TITRE = 8;
export const MOTS_PAR_SECONDE = 3;
export const IMAGE_FIXE_MAX = 2; // secondes sans changement visible
export const ECART_DUREE_CANDIDATS = 0.15;
export const URL_REEL = "perlimpinpin.ai";
export const SONS_MAX_STORYBOARD = 5;
export const MESURES_PROGRAMME = 6;
export const CANDIDATS_MIN = 4;
export const CANDIDATS_MAX = 8;

// --- Catalogue des scènes (section 4) ------------------------------------------
// Spécification d'un champ : « texte », « nombre », « icone », « booleen »,
// une liste ({ liste: spec, min, max }) ou un objet ({ objet: { champ: spec } }).
// { optionnel: true } : facultatif. `ecran: false` : champ de mise en page,
// pas un texte affiché (pas de contrôle des mots). `phrase: true` : une
// phrase entière (la proposition, notre regard), 20 mots au plus au lieu de 7.
const t = "texte";
const opt = (spec) => ({ ...(typeof spec === "string" ? { type: spec } : spec), optionnel: true });
const phrase = { type: "texte", phrase: true };
const numero = { type: "nombre", ecran: false };

export const TYPES_SCENES = {
  accroche: { nom: "Accroche", champs: { titre: t, surligne: t, icone: opt("icone") } },
  chiffres: {
    nom: "Le constat",
    champs: {
      etiquette: t,
      titre: t,
      rouge: opt(t),
      icone: opt("icone"),
      barres: { liste: { objet: { label: t, valeur: t, h: { type: "nombre", ecran: false }, fantome: opt("booleen") } }, min: 2, max: 4 },
    },
  },
  proposition: { nom: "La proposition", champs: { blocs: { liste: t, min: 2, max: 2 }, tampons: { liste: t, min: 0, max: 2, optionnel: true } } },
  note: { nom: "La note", champs: { score: { type: "nombre", ecran: false }, verdict: t } },
  cartes: {
    nom: "Trois effets",
    champs: { etiquette: t, titre: t, cartes: { liste: { objet: { icone: "icone", signe: t, texte: t } }, min: 3, max: 3 } },
  },
  compteur: { nom: "Le compteur", champs: { etiquette: t, titre: t, icone: opt("icone"), etapes: { liste: t, min: 3, max: 3 }, unite: t } },
  pays: {
    nom: "Ailleurs",
    champs: {
      etiquette: t,
      titre: t,
      titre3: opt(t),
      groupes: {
        liste: {
          objet: {
            pays: { liste: { type: "pays" }, min: 1, max: 3 },
            noms: { liste: t, min: 1, max: 3 },
            ok: "booleen",
            bilan: t,
            texte: t,
            carte2: opt(t),
          },
        },
        min: 1,
        max: 2,
      },
    },
  },
  avis: { nom: "Notre avis", champs: { debutTitre: t, finTitre: t, surligne: t, tient: t, coince: t } },
  fin: { nom: "Fin", champs: { question: t, url: { type: "texte", ecran: false }, mention: phrase } },
  // Format « programme » : titre fixe du code (« On a noté 6 mesures de [Nom]. »).
  "accroche-programme": { nom: "Accroche du programme", champs: {} },
  // Une des 6 mesures : `numero` (1 à 6, ordre du code) ; note et verdict du code.
  mesure: { nom: "Une mesure", champs: { numero, titre: t, proposition: phrase, icone: opt("icone") } },
  // Classement par note, moyenne calculée par le code.
  classement: { nom: "Le classement", champs: { titre: t } },
  // Format « thématique » : titre fixe du code (« [Thème] : ce que proposent les candidats. »).
  medaillons: { nom: "Les candidats", champs: {} },
  // Un candidat (`numero` : rang alphabétique du code). Sans fiche sur le
  // thème : ni proposition ni regard (le code affiche « Pas de proposition… »).
  candidat: { nom: "Un candidat", champs: { numero, titre: t, proposition: opt(phrase), regard: opt(phrase) } },
};

export const TYPES = Object.keys(TYPES_SCENES);

// Les trois formats : types permis, première scène, nombre de scènes.
export const FORMATS = {
  mesure: { nom: "Une mesure", types: ["accroche", "chiffres", "proposition", "note", "cartes", "compteur", "pays", "avis", "fin"], premiere: "accroche" },
  programme: { nom: "Programme", types: ["accroche-programme", "mesure", "classement", "fin"], premiere: "accroche-programme" },
  thematique: { nom: "Thématique", types: ["medaillons", "chiffres", "candidat", "classement", "fin"], premiere: "medaillons" },
};

// Types qui se suivent par nature : la règle « jamais deux fois le même
// type d'affilée » ne s'applique pas à eux.
export const SUITES_PERMISES = ["mesure", "candidat"];

export function formatValide(format) {
  return Object.hasOwn(FORMATS, format) ? format : "mesure";
}
const CHAMPS_COMMUNS = ["type", "voix", "mouvement", "son"];
const MOMENTS_SON = ["entree", "image2", "image3"];

// --- Petits outils ------------------------------------------------------------

export function texte(valeur) {
  return typeof valeur === "string" ? valeur.replace(/\s+/g, " ").trim() : "";
}

// Retours à la ligne et gras venus du gabarit HTML (« <br> », « <b> ») →
// texte simple (« \n ») et « **…** ».
function texteEcran(valeur) {
  if (typeof valeur !== "string") return "";
  return valeur
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?b>/gi, "**")
    .replace(/&nbsp;/g, " ")
    .replace(/<[^>]+>/g, "")
    .split("\n")
    .map(texte)
    .filter(Boolean)
    .join("\n");
}

export function sansGras(t2) {
  return String(t2 ?? "").replace(/\*\*/g, "");
}

export function nombreDeMots(t2) {
  return texte(sansGras(t2).replace(/\n/g, " "))
    .split(" ")
    .filter((mot) => /[\p{L}\p{N}]/u.test(mot)).length;
}

// Jetons comparés par le contrôle mot pour mot : lettres et chiffres, en
// minuscules ; ponctuation, apostrophes, tirets et « ** » ignorés.
export function jetons(t2) {
  return sansGras(t2).toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

// Score affiché : « 56 », « 38,5 ».
export function scoreTexte(score) {
  return String(formatScore(Number(score))).replace(".", ",");
}

export function verdictDuScore(score) {
  return getScoreBadge(Number(score)).label;
}

function memeTexte(a, b) {
  return jetons(a).join(" ") === jetons(b).join(" ");
}

// --- Variantes des phrases fixes (mode A) ---------------------------------------
// Reprises de la v3 : question signature, ouverture du verdict ; nouvel appel
// final (corriger l'analyse sur le site, lien en bio), en 3 morceaux.
export const VARIANTES_FIN = [
  ["Une analyse réalisée par **l’IA Perlimpinpin**.", "Vous voyez une erreur ? **Corrigez-la** sur notre site.", "**Lien en bio.**"],
  ["Cette analyse, c’est **l’IA Perlimpinpin**.", "Un oubli, une erreur ? **Aidez-nous à la corriger** sur le site.", "Le lien est **en bio**."],
  ["Analyse signée **l’IA Perlimpinpin**.", "Pas d’accord ? **Corrigez-la** avec nous sur le site.", "**Lien en bio.**"],
  ["Toute l’analyse est sur **le site Perlimpinpin**.", "Une erreur ? **Corrigez-la**, on met à jour avec vous.", "**Lien en bio.**"],
];

export const CLES_VARIANTES = { signature: VARIANTES.signature, verdict: VARIANTES.verdict, fin: VARIANTES_FIN };

function indexValide(liste, i) {
  return Number.isInteger(i) && i >= 0 && i < liste.length ? i : 0;
}

export function textesFixes(variantes = {}) {
  return {
    signature: VARIANTES.signature[indexValide(VARIANTES.signature, variantes?.signature)],
    verdict: VARIANTES.verdict[indexValide(VARIANTES.verdict, variantes?.verdict)],
    fin: VARIANTES_FIN[indexValide(VARIANTES_FIN, variantes?.fin)],
  };
}

// Tirage des variantes, en évitant celles des Reels précédents.
export function choisirVariantesStoryboard(precedentes = [], alea = Math.random) {
  const liste = [precedentes].flat().filter(Boolean);
  return Object.fromEntries(
    Object.entries(CLES_VARIANTES).map(([cle, valeurs]) => {
      const interdits = new Set(liste.map((v) => v?.[cle]).filter(Number.isInteger));
      const tous = valeurs.map((_, i) => i);
      const permis = tous.filter((i) => !interdits.has(i));
      const possibles = permis.length ? permis : tous;
      return [cle, possibles[Math.min(possibles.length - 1, Math.floor(alea() * possibles.length))]];
    }),
  );
}

// Consignes des phrases fixes ajoutées au message du mode A.
export function consignesFixes(variantes, { score }) {
  const f = textesFixes(variantes);
  return [
    "PHRASES FIXES DE CE REEL (à reprendre mot pour mot, gras compris) :",
    `- Scène \`accroche\`, fin du 3e morceau de voix : « ${f.signature} »`,
    `- Scène \`note\`, 1er morceau de voix : « ${f.verdict} » ; la note se dit « ${scoreTexte(score)} sur 100 » (en gras) ; \`score\` = ${formatScore(Number(score))}, \`verdict\` = « ${verdictDuScore(score).toLowerCase()} ».`,
    `- Scène \`fin\`, les 3 morceaux de voix, dans cet ordre : ${f.fin.map((m) => `« ${m} »`).join(", ")} ; \`url\` = « ${URL_REEL} ».`,
  ].join("\n");
}

// --- Lecture stricte de la réponse ----------------------------------------------

function lireValeur(spec, valeur, chemin, erreurs, options = {}) {
  const s = typeof spec === "string" ? { type: spec } : spec;
  if (valeur === undefined || valeur === null || valeur === "") {
    if (!s.optionnel) erreurs.push(`${chemin} : champ manquant.`);
    return undefined;
  }
  if (s.liste) {
    if (!Array.isArray(valeur)) {
      erreurs.push(`${chemin} : une liste est attendue.`);
      return undefined;
    }
    if ((s.min !== undefined && valeur.length < s.min) || (s.max !== undefined && valeur.length > s.max)) {
      erreurs.push(`${chemin} : ${valeur.length} élément(s), ${s.min === s.max ? s.min : `${s.min} à ${s.max}`} attendu(s).`);
    }
    return valeur.map((v, i) => lireValeur(s.liste, v, `${chemin}[${i + 1}]`, erreurs, options));
  }
  if (s.objet) {
    if (typeof valeur !== "object" || Array.isArray(valeur)) {
      erreurs.push(`${chemin} : un objet est attendu.`);
      return undefined;
    }
    for (const cle of Object.keys(valeur)) {
      if (!(cle in s.objet)) erreurs.push(`${chemin} : champ « ${cle} » inconnu.`);
    }
    return Object.fromEntries(
      Object.entries(s.objet)
        .map(([cle, sous]) => [cle, lireValeur(sous, valeur[cle], `${chemin}.${cle}`, erreurs, options)])
        .filter(([, v]) => v !== undefined),
    );
  }
  switch (s.type) {
    case "texte":
      if (typeof valeur !== "string" && typeof valeur !== "number") {
        erreurs.push(`${chemin} : un texte est attendu.`);
        return undefined;
      }
      return texteEcran(String(valeur));
    case "nombre":
      if (typeof valeur !== "number" || !Number.isFinite(valeur)) {
        erreurs.push(`${chemin} : un nombre est attendu.`);
        return undefined;
      }
      return valeur;
    case "booleen":
      if (typeof valeur !== "boolean") {
        erreurs.push(`${chemin} : vrai ou faux attendu.`);
        return undefined;
      }
      return valeur;
    case "icone": {
      // Les storyboards v4 rangés en base gardent leurs anciens noms (convertis).
      const nom = NOMS_PIXEL.includes(valeur) ? valeur : options.anciensPictos ? nomPicto(valeur) : null;
      if (!nom) {
        erreurs.push(`${chemin} : picto « ${valeur} » hors de la liste de la charte (${NOMS_PIXEL.join(", ")}).`);
        return undefined;
      }
      return nom;
    }
    case "pays":
      if (!CLES_PAYS.includes(valeur)) {
        erreurs.push(`${chemin} : pays « ${valeur} » inconnu (clés : ${CLES_PAYS.join(", ")}).`);
        return undefined;
      }
      return valeur;
    default:
      return valeur;
  }
}

function lireTroisTextes(valeur, chemin, erreurs) {
  if (!Array.isArray(valeur) || valeur.length !== 3) {
    erreurs.push(`${chemin} : 3 morceaux attendus.`);
    return Array.isArray(valeur) ? valeur.map((v) => texte(String(v ?? ""))) : [];
  }
  const sortie = valeur.map((v) => (typeof v === "string" ? texte(v) : ""));
  sortie.forEach((v, i) => {
    if (!v) erreurs.push(`${chemin}[${i + 1}] : texte vide.`);
  });
  return sortie;
}

function lireSonScene(brut, chemin, erreurs) {
  if (brut === undefined || brut === null) return null;
  if (typeof brut !== "object" || !SONS.includes(brut.nom) || brut.nom === "jingle-score" || !MOMENTS_SON.includes(brut.moment)) {
    erreurs.push(`${chemin} : son invalide (noms : ${SONS.filter((s) => s !== "jingle-score").join(", ")} ; moments : ${MOMENTS_SON.join(", ")}).`);
    return null;
  }
  return { nom: brut.nom, moment: brut.moment };
}

// Réponse brute du modèle → { storyboard, erreurs }. Refus (JSON invalide) si
// un type ou un champ est inconnu, si un champ attendu manque ou n'a pas la
// bonne forme. storyboard = { couverture: { titre, question }, scenes }.
// options : { format (la couverture n'est demandée qu'au format « mesure »),
// anciensPictos (vrai pour un storyboard v4 rangé en base) }.
export function lireStoryboard(raw, { format = "mesure", anciensPictos = false } = {}) {
  const erreurs = [];
  const options = { anciensPictos };
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.scenes)) {
    return { storyboard: null, erreurs: ['JSON invalide : un objet { "scenes": [ … ], "couverture": { … } } est attendu.'] };
  }
  for (const cle of Object.keys(raw)) {
    if (!["scenes", "couverture"].includes(cle)) erreurs.push(`JSON invalide : champ « ${cle} » inconnu à la racine.`);
  }
  const scenes = raw.scenes.map((brute, i) => {
    const chemin = `Scène ${i + 1}`;
    if (!brute || typeof brute !== "object") {
      erreurs.push(`${chemin} : un objet est attendu.`);
      return null;
    }
    const type = brute.type;
    const def = TYPES_SCENES[type];
    if (!def) {
      erreurs.push(`${chemin} : type « ${type} » inconnu (types : ${TYPES.join(", ")}).`);
      return null;
    }
    for (const cle of Object.keys(brute)) {
      if (!CHAMPS_COMMUNS.includes(cle) && !(cle in def.champs)) erreurs.push(`${chemin} (${type}) : champ « ${cle} » inconnu.`);
    }
    const scene = { type };
    for (const [champ, spec] of Object.entries(def.champs)) {
      const v = lireValeur(spec, brute[champ], `${chemin} (${type}).${champ}`, erreurs, options);
      if (v !== undefined) scene[champ] = v;
    }
    scene.voix = lireTroisTextes(brute.voix, `${chemin} (${type}).voix`, erreurs);
    scene.mouvement = lireTroisTextes(brute.mouvement, `${chemin} (${type}).mouvement`, erreurs);
    const son = lireSonScene(brute.son, `${chemin} (${type}).son`, erreurs);
    if (son) scene.son = son;
    return scene;
  });
  const c = raw.couverture && typeof raw.couverture === "object" ? raw.couverture : {};
  const couverture = { titre: texte(c.titre), question: texte(c.question) };
  if (!couverture.titre && formatValide(format) === "mesure") erreurs.push("Couverture : titre manquant.");
  return { storyboard: erreurs.length ? null : { couverture, scenes }, erreurs };
}

// --- Textes d'une scène --------------------------------------------------------

// Textes ajoutés à l'écran par la scène : [{ champ, texte }] (hors voix,
// mouvement, score, url, hauteurs des barres).
export function textesEcran(scene) {
  const def = TYPES_SCENES[scene?.type];
  if (!def) return [];
  const sortie = [];
  const parcourir = (spec, valeur, chemin) => {
    if (valeur === undefined || valeur === null) return;
    const s = typeof spec === "string" ? { type: spec } : spec;
    if (s.ecran === false) return;
    if (s.liste) return valeur.forEach((v, i) => parcourir(s.liste, v, `${chemin}[${i + 1}]`));
    if (s.objet) return Object.entries(s.objet).forEach(([cle, sous]) => parcourir(sous, valeur[cle], `${chemin}.${cle}`));
    if (s.type === "texte") sortie.push({ champ: chemin, texte: valeur });
  };
  Object.entries(def.champs).forEach(([champ, spec]) => parcourir(spec, scene[champ], champ));
  return sortie;
}

// Vrai si le champ est une phrase entière (20 mots au plus).
function estPhrase(scene, champ) {
  const spec = TYPES_SCENES[scene?.type]?.champs?.[champ];
  return Boolean(spec && typeof spec === "object" && spec.phrase);
}

// Morceaux de voix réellement dits : un morceau répété à l'identique juste
// après lui-même (même image prolongée) n'est dit qu'une fois.
export function morceauxDits(scene) {
  return (scene?.voix ?? []).filter((m, i, liste) => i === 0 || m !== liste[i - 1]);
}

// Texte dit par tout le Reel (sans les « ** »), une scène par paragraphe.
export function texteVoixStoryboard(scenes) {
  return (scenes ?? []).map((s) => morceauxDits(s).map(sansGras).join(" ")).join("\n\n");
}

// --- Contrôle mot pour mot (mode B) --------------------------------------------

// La suite des morceaux de voix (sans les « ** ») doit redonner le texte de
// l'équipe mot pour mot, ponctuation et casse ignorées. Renvoie null si tout
// concorde, sinon l'écart : { message, scene, morceau, position, attendu, trouve }.
export function ecartMotPourMot(scenes, script) {
  const attendus = jetons(script);
  const trouves = [];
  (scenes ?? []).forEach((scene, i) =>
    morceauxDits(scene).forEach((m, k) => jetons(m).forEach((mot) => trouves.push({ mot, scene: i + 1, morceau: k + 1 }))),
  );
  const n = Math.max(attendus.length, trouves.length);
  for (let i = 0; i < n; i++) {
    if (attendus[i] === trouves[i]?.mot) continue;
    const ou = trouves[i] ?? trouves.at(-1) ?? { scene: 1, morceau: 1 };
    const avant = attendus.slice(Math.max(0, i - 6), i).join(" ");
    const attendu = attendus[i] ?? "(fin du script)";
    const trouve = trouves[i]?.mot ?? "(fin du storyboard)";
    return {
      scene: ou.scene,
      morceau: ou.morceau,
      position: i + 1,
      attendu,
      trouve,
      message: `Le storyboard s’écarte du script au mot n° ${i + 1} (scène ${ou.scene}, morceau ${ou.morceau}) : le script dit « ${attendu} », le storyboard « ${trouve} »${avant ? `, après « …${avant} »` : ""}.`,
    };
  }
  return null;
}

// --- Minutage -------------------------------------------------------------------

// minutage.json (scripts/caler-voix.py) → { mots: [{ mot, debut, fin }],
// ecarts: [texte], source } ou { erreur }.
export function lireMinutage(brut) {
  if (!brut || typeof brut !== "object" || !Array.isArray(brut.mots) || brut.mots.length === 0) {
    return { erreur: "minutage.json invalide : une liste « mots » non vide est attendue (fichier produit par scripts/caler-voix.py)." };
  }
  const mots = [];
  for (const [i, m] of brut.mots.entries()) {
    const debut = Number(m?.debut);
    const fin = Number(m?.fin);
    if (typeof m?.mot !== "string" || !Number.isFinite(debut) || !Number.isFinite(fin) || fin < debut) {
      return { erreur: `minutage.json invalide : mot n° ${i + 1} mal formé (attendu { "mot", "debut", "fin" } en secondes).` };
    }
    mots.push({ mot: m.mot, debut, fin });
  }
  const ecarts = Array.isArray(brut.ecarts) ? brut.ecarts.filter((e) => typeof e === "string") : [];
  return { mots, ecarts, source: typeof brut.source === "string" ? brut.source : null };
}

function arrondi(x) {
  return Math.round(x * 100) / 100;
}

// Temps de chaque scène et de chaque morceau. Avec un minutage (mode B), les
// mots du storyboard sont pris dans l'ordre dans les mots minutés ; sans (ou
// s'ils ne concordent pas), durées estimées à 3 mots par seconde.
// Renvoie { estime, duree, scenes: [{ debut, fin, morceaux: [{ debut, fin }] }],
// jetons: [{ mot, debut, fin }] } (jetons du texte dit, pour les sous-titres).
export function tempsStoryboard(scenes, minutage = null) {
  const flux = [];
  if (minutage?.mots?.length) {
    for (const m of minutage.mots) for (const j of jetons(m.mot)) flux.push({ mot: j, debut: m.debut, fin: m.fin });
  }
  const dits = (scenes ?? []).map((s) => morceauxDits(s).map((m) => jetons(m)));
  const total = dits.flat(2).length;
  const concorde = flux.length > 0 && flux.length === total && dits.flat(2).every((mot, i) => flux[i].mot === mot);
  let curseur = 0;
  let t0 = 0;
  const tous = [];
  const resultat = dits.map((morceaux, i) => {
    const temps = morceaux.map((motsMorceau) => {
      if (concorde) {
        const premiers = flux.slice(curseur, curseur + motsMorceau.length);
        curseur += motsMorceau.length;
        tous.push(...premiers);
        return premiers.length ? { debut: premiers[0].debut, fin: premiers.at(-1).fin } : { debut: t0, fin: t0 };
      }
      const debut = t0;
      const fin = debut + motsMorceau.length / MOTS_PAR_SECONDE;
      motsMorceau.forEach((mot, k) => tous.push({ mot, debut: debut + k / MOTS_PAR_SECONDE, fin: debut + (k + 1) / MOTS_PAR_SECONDE }));
      t0 = fin;
      return { debut, fin };
    });
    // Image clé k → morceau k (un morceau répété garde le même temps).
    const voix = scenes[i].voix ?? [];
    const parImage = [];
    let j = -1;
    voix.forEach((m, k) => {
      if (k === 0 || m !== voix[k - 1]) j++;
      parImage.push(temps[Math.max(0, j)] ?? { debut: t0, fin: t0 });
    });
    return { debut: temps[0]?.debut ?? t0, fin: temps.at(-1)?.fin ?? t0, morceaux: parImage };
  });
  // Pas de trou entre deux scènes : chaque scène dure jusqu'au début de la suivante.
  for (let i = 0; i < resultat.length - 1; i++) resultat[i].fin = resultat[i + 1].debut;
  if (resultat.length) resultat[0].debut = 0;
  const arrondie = resultat.map((s) => ({
    debut: arrondi(s.debut),
    fin: arrondi(s.fin),
    morceaux: s.morceaux.map((m) => ({ debut: arrondi(m.debut), fin: arrondi(m.fin) })),
  }));
  return { estime: !concorde, duree: arrondi(resultat.at(-1)?.fin ?? 0), scenes: arrondie, jetons: tous };
}

// Minutage estimé (mode A, ou sans voix off) au format de minutage.json.
export function minutageEstime(scenes) {
  const mots = [];
  let t2 = 0;
  for (const scene of scenes ?? []) {
    for (const m of morceauxDits(scene)) {
      for (const mot of sansGras(m).split(/\s+/).filter(Boolean)) {
        const n = Math.max(1, jetons(mot).length);
        mots.push({ mot, debut: arrondi(t2), fin: arrondi(t2 + n / MOTS_PAR_SECONDE) });
        t2 += n / MOTS_PAR_SECONDE;
      }
    }
  }
  return { estime: true, source: `estimation à ${MOTS_PAR_SECONDE} mots par seconde (pas de voix off calée)`, mots, ecarts: [] };
}

// --- Sous-titres -----------------------------------------------------------------

function tempsSrt(s) {
  const ms = Math.round(s * 1000);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor(ms / 60_000) % 60;
  const sec = Math.floor(ms / 1000) % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`;
}

// Lignes de sous-titre d'un morceau de voix (charte p. 18) : 8 mots au plus
// par ligne, coupées de préférence sur la ponctuation. Les mots clés gardent
// leurs « ** » (refermés en bout de ligne s'ils sont coupés), pour passer en
// moutarde à l'écran. Même découpage pour l'image et pour sous-titres.srt.
export function lignesSousTitres(morceau) {
  const mots = texte(morceau).split(" ").filter(Boolean);
  const lignes = [];
  // Ne compte que les vrais mots (« ? », « : » seuls ne comptent pas).
  const compte = (liste) => liste.filter((m) => /[\p{L}\p{N}]/u.test(m)).length;
  let reste = mots;
  while (reste.length) {
    if (compte(reste) <= MOTS_LIGNE_SOUS_TITRE) {
      lignes.push(reste.join(" "));
      break;
    }
    // Au plus 8 mots ; coupure après la dernière ponctuation de ces 8 mots
    // (au moins 3 mots sur la ligne), sinon après le 8e mot.
    let n = 0;
    let fin = 0;
    while (fin < reste.length && (compte(reste.slice(0, fin + 1)) <= MOTS_LIGNE_SOUS_TITRE)) fin++;
    for (let k = fin; k >= 3; k--) {
      if (/[.,;:?!…»]\**$/.test(reste[k - 1])) {
        n = k;
        break;
      }
    }
    const coupe = n || fin;
    lignes.push(reste.slice(0, coupe).join(" "));
    reste = reste.slice(coupe);
  }
  // Un mot clé coupé entre deux lignes est refermé, puis rouvert.
  for (let i = 0; i < lignes.length - 1; i++) {
    if ((lignes[i].match(/\*\*/g) ?? []).length % 2 === 1) {
      lignes[i] = `${lignes[i]}**`;
      lignes[i + 1] = `**${lignes[i + 1]}`;
    }
  }
  return lignes;
}

// Nombre de mots d'une ligne de sous-titre (« 6,8 » compte pour un mot).
export function motsLigne(ligne) {
  return sansGras(ligne).split(/\s+/).filter((m) => /[\p{L}\p{N}]/u.test(m)).length;
}

// Lignes de plus de 8 mots dans un SRT : [{ numero, ligne, mots }].
export function lignesTropLongues(srt) {
  return String(srt ?? "")
    .replace(/\r\n/g, "\n")
    .split(/\n\n+/)
    .flatMap((bloc) => {
      const [n, , ...lignes] = bloc.split("\n");
      return lignes.filter(Boolean).map((ligne) => ({ numero: Number(n), ligne, mots: motsLigne(ligne) }));
    })
    .filter((l) => l.mots > MOTS_LIGNE_SOUS_TITRE);
}

// Sous-titres SRT : le texte exact du storyboard (sans « ** »), en lignes de
// 8 mots au plus coupées à la ponctuation, calées sur les temps des mots.
export function sousTitresSrt(scenes, temps) {
  const blocs = [];
  let i = 0;
  const jet = temps.jetons;
  for (const scene of scenes ?? []) {
    for (const m of morceauxDits(scene)) {
      for (const ligne of lignesSousTitres(sansGras(m))) {
        const n = jetons(ligne).length;
        const premier = jet[i] ?? jet.at(-1) ?? { debut: 0, fin: 0 };
        const dernier = jet[i + Math.max(0, n - 1)] ?? premier;
        i += n;
        blocs.push({ debut: premier.debut, fin: Math.max(dernier.fin, premier.debut + 0.3), texte: ligne });
      }
    }
  }
  return `${blocs.map((b, k) => `${k + 1}\n${tempsSrt(b.debut)} --> ${tempsSrt(b.fin)}\n${b.texte}\n`).join("\n")}`;
}

// --- Contrôle ---------------------------------------------------------------------

// Images clés où quelque chose bouge en continu (compteur, barres qui montent
// bloc par bloc, cases qui s'allument, adresse tapée lettre à lettre, cartes
// qui tombent) : elles ne comptent pas comme des images figées.
const IMAGES_ANIMEES = {
  note: [1, 2, 3],
  chiffres: [2],
  compteur: [2, 3],
  pays: [1],
  fin: [3],
  "accroche-programme": [2, 3],
  mesure: [3],
  classement: [2, 3],
  medaillons: [2],
  candidat: [3],
};

// Structure attendue d'un format : renvoie la liste des erreurs.
function controlerStructure(scenes, format, ctx) {
  const erreurs = [];
  const def = FORMATS[format];
  const n = scenes.length;
  for (const [i, s] of scenes.entries()) {
    if (!def.types.includes(s.type)) erreurs.push(`Scène ${i + 1} : le type \`${s.type}\` n'existe pas au format « ${def.nom} » (types : ${def.types.join(", ")}).`);
  }
  if (scenes[0]?.type !== def.premiere) erreurs.push(`La première scène doit être \`${def.premiere}\` au format « ${def.nom} » (ici « ${scenes[0]?.type} »).`);
  if (scenes.at(-1)?.type !== "fin") erreurs.push(`La dernière scène doit être une \`fin\` (ici « ${scenes.at(-1)?.type} »).`);
  scenes.forEach((s, i) => {
    if (i > 0 && s.type === scenes[i - 1].type && !SUITES_PERMISES.includes(s.type)) erreurs.push(`Scènes ${i} et ${i + 1} : deux \`${s.type}\` de suite.`);
  });
  if (format === "mesure") {
    if (n < SCENES_MIN || n > SCENES_MAX) erreurs.push(`${n} scènes : ${SCENES_MIN} à ${SCENES_MAX} attendues.`);
    return erreurs;
  }
  if (format === "programme") {
    const attendu = ["accroche-programme", ...Array(MESURES_PROGRAMME).fill("mesure"), "classement", "fin"];
    if (scenes.map((s) => s.type).join(",") !== attendu.join(",")) {
      erreurs.push(`Format « Programme » : ${attendu.length} scènes attendues dans cet ordre : accroche-programme, 6 × mesure, classement, fin (ici ${scenes.map((s) => s.type).join(", ")}).`);
    }
    const numeros = scenes.filter((s) => s.type === "mesure").map((s) => s.numero);
    if (numeros.join(",") !== [1, 2, 3, 4, 5, 6].join(",")) erreurs.push(`Scènes \`mesure\` : numéros ${numeros.join(", ")}, 1 à 6 dans l'ordre attendus (l'ordre où le candidat met ses mesures en avant).`);
    if ((ctx.mesures ?? []).length !== MESURES_PROGRAMME) erreurs.push(`Programme : ${(ctx.mesures ?? []).length} mesure(s) notée(s) sur 6 thèmes différents, 6 attendues.`);
    return erreurs;
  }
  // Thématique.
  const candidats = ctx.candidats ?? [];
  if (candidats.length < CANDIDATS_MIN || candidats.length > CANDIDATS_MAX) erreurs.push(`Thématique : ${candidats.length} candidat(s), ${CANDIDATS_MIN} à ${CANDIDATS_MAX} attendus.`);
  const attendu = ["medaillons", "chiffres", ...Array(candidats.length).fill("candidat"), "classement", "fin"];
  if (scenes.map((s) => s.type).join(",") !== attendu.join(",")) {
    erreurs.push(`Format « Thématique » : ${attendu.length} scènes attendues dans cet ordre : medaillons, chiffres, ${candidats.length} × candidat, classement, fin (ici ${scenes.map((s) => s.type).join(", ")}).`);
  }
  const numeros = scenes.filter((s) => s.type === "candidat").map((s) => s.numero);
  const ordre = candidats.map((_, i) => i + 1);
  if (numeros.join(",") !== ordre.join(",")) erreurs.push(`Scènes \`candidat\` : numéros ${numeros.join(", ")} ; l'ordre alphabétique demande ${ordre.join(", ")} (${candidats.map((c) => nomDeFamille(c.nom)).join(", ")}).`);
  return erreurs;
}

// Contrôle du storyboard. Refus (erreurs) :
//   - JSON invalide (type, champ ou picto inconnu, champ manquant) ;
//   - structure du format : nombre et ordre des scènes, première scène
//     (`accroche`, `accroche-programme` ou `medaillons`), dernière `fin`, deux
//     scènes de suite du même type (sauf les suites `mesure` et `candidat`),
//     mesures 1 à 6, candidats dans l'ordre alphabétique ;
//   - note, score ou verdict qui ne sont pas ceux du code ;
//   - texte à l'écran contenant un chiffre absent du script et des fiches ;
//   - candidat sans fiche à qui l'on prête une proposition ;
//   - ligne de sous-titre de plus de 8 mots ;
//   - pays cité sans carte ; « ** » non refermés ;
//   - mode A : phrases fixes absentes ; mode B : écart au texte de l'équipe.
// Avertissements : texte à l'écran de plus de 7 mots (20 pour une phrase),
// prénom du candidat à l'écran, tournures « IA », morceau sans mot clé ou
// avec plus de 2, scène hors de 5 à 9 s, image clé figée plus de 2 s
// (d'après minutage.json), écart de durée de plus de 15 % entre deux scènes
// `candidat`, variabilité, trop de sons.
// ctx = { format ("mesure" par défaut), mode: "A"|"B", ficheFinale, score,
//   candidatNom, script (mode B), minutage (mode B), variantes (mode A),
//   cartesDisponibles (clés), precedent (texte du dernier Reel),
//   mesures (programme : [{ numero, theme, score, fiche }]),
//   candidats (thématique : [{ nom, score|null, fiche|null }], ordre alphabétique),
//   anciensPictos }
export function controlerStoryboard(raw, ctx) {
  const format = formatValide(ctx?.format);
  const { storyboard, erreurs: erreursLecture } = lireStoryboard(raw, { format, anciensPictos: Boolean(ctx?.anciensPictos) });
  if (!storyboard) return { valide: false, erreurs: erreursLecture, avertissements: [], storyboard: null };
  const { mode = "A", ficheFinale = {}, score, script = "", minutage = null, variantes = null, precedent = null } = ctx ?? {};
  const cartesDisponibles = new Set(ctx?.cartesDisponibles ?? CLES_PAYS);
  const erreurs = [];
  const avertissements = [];
  const scenes = storyboard.scenes;
  const nom = (i) => `Scène ${i + 1} (${scenes[i].type})`;
  const mesures = ctx?.mesures ?? [];
  const candidats = ctx?.candidats ?? [];
  // Toutes les fiches du Reel (une, six ou une par candidat), pour les chiffres.
  const fiches = format === "mesure" ? [ficheFinale] : format === "programme" ? mesures.map((m) => m.fiche ?? {}) : candidats.map((c) => c.fiche ?? {});
  const nomsCandidats = format === "thematique" ? candidats.map((c) => c.nom) : [ctx?.candidatNom].filter(Boolean);

  erreurs.push(...controlerStructure(scenes, format, { mesures, candidats }));

  // La note : score et verdict du code.
  const verdict = verdictDuScore(score);
  scenes.forEach((s, i) => {
    if (s.type !== "note") return;
    if (Number(s.score) !== Number(formatScore(Number(score)))) erreurs.push(`${nom(i)} : score ${s.score}, le code calcule ${scoreTexte(score)}.`);
    if (texte(s.verdict).toLowerCase() !== verdict.toLowerCase()) erreurs.push(`${nom(i)} : verdict « ${s.verdict} », le code donne « ${verdict.toLowerCase()} ».`);
  });

  // Candidats : pas de proposition prêtée à qui n'a pas de fiche.
  scenes.forEach((s, i) => {
    if (s.type !== "candidat") return;
    const c = candidats[s.numero - 1];
    if (!c) return;
    if (!c.fiche && (s.proposition || s.regard)) erreurs.push(`${nom(i)} : ${nomDeFamille(c.nom)} n'a pas de fiche sur ce thème ; ni proposition ni regard (le code affiche « Pas de proposition publiée sur ce thème à ce jour »).`);
    if (c.fiche && (!s.proposition || !s.regard)) erreurs.push(`${nom(i)} : « proposition » et « regard » attendus pour ${nomDeFamille(c.nom)}.`);
  });

  // Voix : gras refermés, 1 ou 2 mots clés par morceau ; sous-titres de 8 mots par ligne.
  scenes.forEach((s, i) =>
    s.voix.forEach((m, k) => {
      if ((m.match(/\*\*/g) ?? []).length % 2 !== 0) erreurs.push(`${nom(i)}, morceau ${k + 1} : « ** » non refermé.`);
      const cles = (m.match(/\*\*(.+?)\*\*/g) ?? []).length;
      if (cles < 1 || cles > 2) avertissements.push(`${nom(i)}, morceau ${k + 1} : ${cles} mot(s) clé(s) en « ** », 1 ou 2 attendus.`);
      for (const ligne of lignesSousTitres(m)) {
        if (motsLigne(ligne) > MOTS_LIGNE_SOUS_TITRE) erreurs.push(`${nom(i)}, morceau ${k + 1} : ligne de sous-titre de ${motsLigne(ligne)} mots (« ${sansGras(ligne)} »), ${MOTS_LIGNE_SOUS_TITRE} au plus.`);
      }
    }),
  );

  // Textes ajoutés à l'écran.
  const voixEntiere = texteVoixStoryboard(scenes);
  const nombresScript = new Set(extraireNombres(mode === "B" ? `${script}\n${voixEntiere}` : voixEntiere));
  const prenoms = [...new Set(nomsCandidats.map(prenom).filter(Boolean))];
  scenes.forEach((s, i) => {
    for (const { champ, texte: t2 } of textesEcran(s)) {
      const mots = nombreDeMots(t2);
      const max = estPhrase(s, champ) ? MOTS_PHRASE_MAX : MOTS_ECRAN_MAX;
      if (mots > max) avertissements.push(`${nom(i)} : « ${champ} » fait ${mots} mots à l'écran (${max} au plus).`);
      const horsFiches = fiches.length ? fiches.map((f) => new Set(nombresHorsFiche([t2], f))).reduce((a, b) => new Set([...a].filter((x) => b.has(x)))) : new Set();
      for (const nombre of horsFiches) {
        if (!nombresScript.has(nombre)) erreurs.push(`${nom(i)} : « ${champ} » affiche « ${nombre} », absent du script et de la fiche.`);
      }
      for (const tournure of tournuresIA(t2)) avertissements.push(`${nom(i)} : « ${champ} », tournure qui sonne « IA » (« ${tournure} »).`);
      for (const p of prenoms) {
        if (new RegExp(`(^|[^\\p{L}])${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\p{L}]|$)`, "iu").test(sansGras(t2))) {
          avertissements.push(`${nom(i)} : « ${champ} » écrit le prénom « ${p} » ; seulement le nom de famille à l'écran.`);
        }
      }
    }
    if (mode === "A") {
      for (const tournure of tournuresIA(s.voix.join(" "))) avertissements.push(`${nom(i)} : voix, tournure qui sonne « IA » (« ${tournure} »).`);
    }
  });

  // Pays : chaque pays cité a sa carte.
  const montres = new Set(scenes.filter((s) => s.type === "pays").flatMap((s) => s.groupes.flatMap((g) => g.pays)));
  for (const cle of montres) {
    if (!cartesDisponibles.has(cle)) erreurs.push(`Carte « ${cle} » (${paysParCle(cle)?.nom ?? cle}) absente de public/reel/cartes/ : lancer node scripts/carte-pays.js ${cle}.`);
  }
  scenes.forEach((s, i) => {
    for (const cle of paysCites(s.voix.join(" "))) {
      if (!montres.has(cle)) erreurs.push(`${nom(i)} : ${paysParCle(cle).nom} est cité sans carte (à montrer dans une scène \`pays\`).`);
    }
  });

  // Sons : au plus 5 (le code ajoute le jingle de la note).
  const nbSons = scenes.filter((s) => s.son).length;
  if (nbSons > SONS_MAX_STORYBOARD) avertissements.push(`${nbSons} bruitages : ${SONS_MAX_STORYBOARD} au plus, en plus du jingle de la note.`);

  // Mode A : phrases fixes. Mode B : le texte de l'équipe, mot pour mot.
  if (mode === "A") {
    const f = textesFixes(variantes ?? {});
    const accroche = scenes[0];
    if (format === "mesure" && accroche?.type === "accroche" && !jetons(accroche.voix[2]).join(" ").endsWith(jetons(f.signature).join(" "))) {
      erreurs.push(`Scène 1 (accroche) : le 3e morceau doit finir par « ${f.signature} ».`);
    }
    scenes.forEach((s, i) => {
      if (s.type === "note") {
        if (!jetons(s.voix[0]).join(" ").includes(jetons(f.verdict).join(" "))) erreurs.push(`${nom(i)} : le 1er morceau doit contenir « ${f.verdict} ».`);
        if (!jetons(s.voix.join(" ")).join(" ").includes(jetons(`${scoreTexte(score)} sur 100`).join(" "))) erreurs.push(`${nom(i)} : la voix doit dire « ${scoreTexte(score)} sur 100 ».`);
      }
      if (s.type === "mesure" && mesures[s.numero - 1]) {
        const note = `${scoreTexte(mesures[s.numero - 1].score)} sur 100`;
        if (!jetons(s.voix.join(" ")).join(" ").includes(jetons(note).join(" "))) erreurs.push(`${nom(i)} : la voix doit dire « ${note} » (note du code).`);
      }
      if (s.type === "candidat" && candidats[s.numero - 1]?.fiche) {
        const note = `${scoreTexte(candidats[s.numero - 1].score)} sur 100`;
        if (!jetons(s.voix.join(" ")).join(" ").includes(jetons(note).join(" "))) erreurs.push(`${nom(i)} : la voix doit dire « ${note} » (note du code).`);
      }
    });
    const fin = scenes.at(-1);
    if (fin?.type === "fin" && !(fin.voix.length === 3 && fin.voix.every((m, k) => memeTexte(m, f.fin[k])))) {
      erreurs.push(`Scène ${scenes.length} (fin) : la voix doit reprendre l’appel fixe, « ${f.fin.map(sansGras).join(" ")} ».`);
    }
  } else {
    const ecart = ecartMotPourMot(scenes, script);
    if (ecart) erreurs.push(ecart.message);
  }

  const fin = scenes.at(-1);
  if (fin?.type === "fin" && fin.url && fin.url.replace(/^https?:\/\//, "").replace(/\/$/, "") !== URL_REEL) {
    avertissements.push(`Scène ${scenes.length} (fin) : adresse « ${fin.url} », « ${URL_REEL} » attendue.`);
  }

  // Durées.
  const temps = tempsStoryboard(scenes, minutage);
  temps.scenes.forEach((st, i) => {
    const d = Math.round((st.fin - st.debut) * 10) / 10;
    if (d < DUREE_SCENE_MIN || d > DUREE_SCENE_MAX) avertissements.push(`${nom(i)} : ${d.toFixed(1).replace(".", ",")} s, ${DUREE_SCENE_MIN} à ${DUREE_SCENE_MAX} s visées.`);
  });
  if (mode === "B" && minutage && temps.estime) {
    avertissements.push("minutage.json ne suit pas le storyboard mot pour mot : durées estimées à 3 mots par seconde.");
  }
  // Un changement visible toutes les 1 à 2 s : image clé figée trop longtemps.
  if (!temps.estime) avertissements.push(...imagesFigees(scenes, temps));
  // Thématique : même durée pour tous les candidats.
  const ecart = ecartDureesCandidats(scenes, temps);
  if (ecart) avertissements.push(ecart);

  const variabilite = avertissementVariabilite(voixEntiere, precedent);
  if (variabilite) avertissements.push(variabilite);

  return { valide: erreurs.length === 0, erreurs, avertissements, storyboard, temps, format };
}

// Changements visibles décrits par la phrase de mouvement d'une image clé :
// une action par membre de phrase (« La fenêtre s'ouvre en glitch, l'image
// se charge, puis le titre claque » : 3).
export function changementsDecrits(phrase) {
  return Math.max(1, String(phrase ?? "").split(/[,;]| puis | et (?=l[ae'’]|les |un |une |le |la )/i).filter((m) => m.trim().length > 3).length);
}

// Images clés qui restent plus de 2 s sans changement visible : durée de
// l'image (minutage.json) divisée par le nombre de changements décrits ; les
// images où quelque chose bouge en continu (compteur, barres, cases, adresse
// tapée) sont exclues.
export function imagesFigees(scenes, temps) {
  const sortie = [];
  scenes.forEach((s, i) => {
    const t = temps.scenes[i];
    [1, 2, 3].forEach((k) => {
      if ((IMAGES_ANIMEES[s.type] ?? []).includes(k)) return;
      const debut = t.morceaux[k - 1]?.debut ?? t.debut;
      const suivant = k < 3 ? t.morceaux[k]?.debut : t.fin;
      const d = (suivant ?? t.fin) - debut;
      const n = changementsDecrits(s.mouvement?.[k - 1]);
      if (d / n > IMAGE_FIXE_MAX + 0.05) {
        sortie.push(`Scène ${i + 1} (${s.type}), image ${k} : ${d.toFixed(1).replace(".", ",")} s pour ${n} changement${n > 1 ? "s" : ""} décrit${n > 1 ? "s" : ""}, plus de 2 s sans changement visible : ajouter un mouvement.`);
      }
    });
  });
  return sortie;
}

// Plus grand écart de durée entre deux scènes `candidat`, en avertissement
// au-delà de 15 % (de la plus courte).
export function ecartDureesCandidats(scenes, temps) {
  const durees = scenes.map((s, i) => (s.type === "candidat" ? { i, d: temps.scenes[i].fin - temps.scenes[i].debut } : null)).filter(Boolean);
  if (durees.length < 2) return null;
  const min = durees.reduce((a, b) => (b.d < a.d ? b : a));
  const max = durees.reduce((a, b) => (b.d > a.d ? b : a));
  if (min.d <= 0 || (max.d - min.d) / min.d <= ECART_DUREE_CANDIDATS) return null;
  const s = (x) => `${x.d.toFixed(1).replace(".", ",")} s`;
  return `Même durée pour tous les candidats : scène ${max.i + 1} (${s(max)}) et scène ${min.i + 1} (${s(min)}), ${Math.round(((max.d - min.d) / min.d) * 100)} % d'écart (15 % au plus).`;
}

// --- Classement (programme, thématique) ------------------------------------------------

// Lignes notées classées par note (la plus haute d'abord) et moyenne, calculées
// par le code. entrees : [{ libelle, score|null }] ; sans note : hors classement.
export function classement(entrees) {
  const notees = (entrees ?? []).filter((e) => Number.isFinite(Number(e.score)) && e.score !== null);
  const lignes = [...notees].sort((a, b) => Number(b.score) - Number(a.score) || String(a.libelle).localeCompare(String(b.libelle), "fr"));
  const moyenne = notees.length ? Math.round((notees.reduce((somme, e) => somme + Number(e.score), 0) / notees.length) * 10) / 10 : null;
  return { lignes, moyenne, sansNote: (entrees ?? []).filter((e) => !notees.includes(e)) };
}

// --- Couverture -------------------------------------------------------------------

// Couverture finale (format « mesure ») : titre du modèle (sinon le titre de
// l'accroche), question de la liste fermée, différente des Reels précédents.
// Pas de score.
export function couvertureStoryboard(storyboard, { exclues = [], alea = Math.random } = {}) {
  const accroche = storyboard.scenes.find((s) => s.type === "accroche");
  const titre = texte(storyboard.couverture?.titre) || texte(`${accroche?.titre ?? ""} ${accroche?.surligne ?? ""}`);
  const { question } = questionCouverture(storyboard.couverture?.question, { exclues: exclues.filter(Boolean), alea });
  return { titre, question, questionProposee: storyboard.couverture?.question ?? null, horsListe: Boolean(storyboard.couverture?.question) && !QUESTIONS_COUVERTURE.includes(storyboard.couverture.question) };
}

// Titres fixes des formats programme et thématique (charte p. 15 et 19), qui
// servent aussi de couverture. Seulement le nom de famille.
export function titreProgramme(candidatNom) {
  return `On a noté **6 mesures** de ${nomDeFamille(candidatNom)}.`;
}

export function titreThematique(themeLibelle) {
  return `${texte(themeLibelle)} : ce que proposent les candidats.`;
}

export function couvertureFormat(format, { candidatNom, themeLibelle } = {}) {
  if (format === "programme") return { titre: titreProgramme(candidatNom), question: null, horsListe: false };
  if (format === "thematique") return { titre: titreThematique(themeLibelle), question: null, horsListe: false };
  return null;
}

// --- Message final et check-list -----------------------------------------------------

export function formatTemps(secondes) {
  const s = Math.max(0, Math.round(secondes));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function formatDureeCourte(secondes) {
  const s = Math.max(0, Math.round(secondes));
  const m = Math.floor(s / 60);
  return m ? `${m} min ${String(s % 60).padStart(2, "0")} s` : `${s} s`;
}

// Message court de fin (section 2, point 9) : scènes, durée, écarts, points à valider.
export function messageFinal({ scenes, temps, ecarts = [], pointsAValider = [], mode }) {
  const duree = `${formatDureeCourte(temps.duree)}${temps.estime ? " (estimée à 3 mots par seconde)" : ""}`;
  const ecartsTexte =
    mode === "A" && !ecarts.length
      ? "pas encore de voix off enregistrée (écarts à mesurer avec caler-voix.py)"
      : ecarts.length
        ? `${ecarts.length} écart${ecarts.length > 1 ? "s" : ""} entre script et voix off`
        : "aucun écart entre script et voix off";
  const points = pointsAValider.length ? `${pointsAValider.length} point${pointsAValider.length > 1 ? "s" : ""} à valider` : "rien à valider";
  return `${scenes.length} scènes, ${duree}, ${ecartsTexte}, ${points}.`;
}

// Restes de maquette à l'écran (charte p. 20) : badge « exemple »,
// « Candidat A », texte de remplissage.
const RESTES_MAQUETTE = [/\bexemple\b/i, /\bcandidat [A-H]\b/, /\blorem\b/i, /\bxxx+\b/i, /\bà compléter\b/i];

export function restesMaquette(scenes, couverture = null) {
  const textes = [
    ...(scenes ?? []).flatMap((s, i) => textesEcran(s).map((x) => ({ ou: `Scène ${i + 1} (${s.type}) « ${x.champ} »`, t: x.texte }))),
    ...(couverture ? [{ ou: "Couverture", t: `${couverture.titre ?? ""} ${couverture.question ?? ""}` }] : []),
  ];
  return textes.filter((x) => RESTES_MAQUETTE.some((r) => r.test(sansGras(x.t)))).map((x) => `${x.ou} : « ${sansGras(x.t)} »`);
}

// Check-list « Vérifications avant publication » (charte p. 20), en haut de
// la page du Reel. etat : "ok" (vérifié par le code), "ko" (à corriger),
// "manuel" (à vérifier à l'œil), "sans-objet".
//   erreurs : erreurs du contrôle ; avertissements ; avertissementsZones ;
//   couleurs : { horsPalette: [] } (src/lib/reel-disposition.js) ;
//   grain : vrai si le fond granuleux est présent ; photos : etatPhotos ;
//   format, mode, storyboard, couverture, temps, minutage, srt.
export function checkList({
  format = "mesure",
  mode,
  storyboard,
  couverture = null,
  temps,
  erreurs = [],
  avertissements = [],
  avertissementsZones = [],
  couleurs = { horsPalette: [] },
  grain = false,
  photos = {},
  minutage = null,
  srt = "",
}) {
  const scenes = storyboard.scenes;
  const fin = scenes.at(-1);
  const voixFin = jetons(`${fin?.voix?.join(" ") ?? ""} ${fin?.mention ?? ""}`).join(" ");
  const tout = [...erreurs, ...avertissements];
  const chiffresOk = !tout.some((a) => /absent du script et de la fiche/.test(a));
  const textesCourts = !avertissements.some((a) => /mots à l'écran|sonne « IA »|prénom/.test(a));
  const couvertureSansNote = !couverture || !/\/\s?100|\bsur 100\b/.test(`${couverture.titre ?? ""} ${couverture.question ?? ""}`);
  const restes = restesMaquette(scenes, couverture);
  const longues = lignesTropLongues(srt);
  const ordreOk = !tout.some((a) => /ordre alphabétique|numéros/.test(a));
  const finOk = fin?.type === "fin" && /corrig/.test(voixFin) && /\bbio\b/.test(voixFin) && /\bia perlimpinpin\b/.test(voixFin);
  const voixCalee = minutage && !minutage.estime;
  return [
    { texte: "Chaque chiffre vient de l’analyse ou d’une source citée.", etat: chiffresOk ? "ok" : "ko", detail: chiffresOk ? "Chaque nombre à l’écran est dans la fiche ou le script." : "Voir les erreurs." },
    { texte: "La note n’est pas sur la couverture.", etat: couvertureSansNote ? "ok" : "ko", detail: couverture ? `Couverture : « ${sansGras(couverture.titre)}${couverture.question ? ` ${couverture.question}` : ""} »` : "" },
    {
      texte: "Chaque mot de la voix off est en sous-titre.",
      etat: mode === "B" ? "ok" : "manuel",
      detail: mode === "B" ? "Contrôle mot pour mot passé ; sous-titres tirés du texte de l’équipe." : "Sous-titres tirés du script ; à revérifier une fois la voix off enregistrée (mode B).",
    },
    { texte: "Sous-titres : 8 mots par ligne au plus.", etat: longues.length ? "ko" : "ok", detail: longues.length ? `${longues.length} ligne(s) trop longue(s).` : "Toutes les lignes de sous-titres.srt contrôlées." },
    { texte: "Les écarts entre script et voix off sont listés.", etat: voixCalee ? "ok" : "manuel", detail: voixCalee ? `${minutage.ecarts?.length ?? 0} écart(s) dans ecarts.txt.` : "Pas de voix off calée : lancer scripts/caler-voix.py." },
    { texte: "Textes à l’écran : 2 à 7 mots, parlés, nom de famille seulement.", etat: textesCourts ? "ok" : "ko", detail: textesCourts ? "Longueur, tournures « IA » et prénoms contrôlés." : "Voir les avertissements." },
    {
      texte: "Rien dans les zones d’interface d’Instagram.",
      etat: avertissementsZones.length ? "ko" : "ok",
      detail: avertissementsZones.length ? "Voir les avertissements de zones." : "Boîtes calculées : rien au-dessus de 250 px, sous 1 300 px ni dans les 150 px de droite.",
    },
    { texte: "Chaque pays cité a sa carte.", etat: "ok", detail: "Contrôlé (refus sinon)." },
    {
      texte: "Couleurs dans la palette (charbon, crème, moutarde, canard, rouille, olive, gris chaud, registre, jaune).",
      etat: couleurs.horsPalette?.length ? "ko" : "ok",
      detail: couleurs.horsPalette?.length ? `Hors palette : ${couleurs.horsPalette.join(", ")}.` : "Couleurs de chaque image listées et contrôlées.",
    },
    { texte: "Le grain est présent sur le fond.", etat: grain ? "ok" : "ko", detail: grain ? "Fond charbon granuleux (public/reel/v5/fond.png)." : "Fond granuleux absent : node scripts/reel-ressources.js." },
    {
      texte: "Photos créditées (couverture et credits.txt).",
      etat: photos.credits ? "ok" : "ko",
      detail: [
        photos.candidat ? "Candidat tramé." : "Photo du candidat tramée manquante.",
        photos.illustration ? "Illustration tramée." : "Pas d’illustration : panneau tramé à la place.",
        photos.credits ? "Crédits dans credits.txt." : "Crédits à compléter.",
      ].join(" "),
    },
    format === "mesure"
      ? { texte: "Ordre alphabétique et moyenne exacte.", etat: "sans-objet", detail: "Formats programme et thématique seulement." }
      : { texte: "Notes réelles, ordre alphabétique et moyenne exacte.", etat: ordreOk ? "ok" : "ko", detail: ordreOk ? "Notes, ordre et moyenne calculés par le code." : "Voir les erreurs." },
    { texte: "Aucun reste de maquette (« exemple », « Candidat A »).", etat: restes.length ? "ko" : "ok", detail: restes.length ? restes.join(" ; ") : "Textes à l’écran et couverture relus par le code." },
    {
      texte: "La fin présente l’IA Perlimpinpin et invite à corriger l’analyse sur le site.",
      etat: finOk ? "ok" : "ko",
      detail: fin?.type === "fin" ? `Dernière scène : « ${fin.voix.map(sansGras).join(" ")} »` : "Pas de scène de fin.",
    },
    { texte: "Même traitement que pour les autres candidats.", etat: "manuel", detail: "Structure, longueur, ton et visuel à comparer aux Reels des autres candidats." },
    {
      texte: "Photo conforme (fournie par l’équipe, jamais générée, visage non retouché).",
      etat: "manuel",
      detail: photos.bibliotheque ? "Photo de la bibliothèque validée." : "Pas encore de photo validée dans la bibliothèque : vignette du site tramée à la place.",
    },
  ].map((item) => ({ ...item, temps: temps?.estime }));
}

// --- Stockage ------------------------------------------------------------------------

// Objet rangé dans contenuComplet.reel (version 5 ; format « mesure »).
export function storyboardPourStockage({ mode, storyboard, couverture, variantes, avertissements, script, minutage, format = "mesure" }, { candidatNom, score, date = new Date() }) {
  return {
    version: VERSION_STORYBOARD,
    format,
    mode,
    storyboard,
    couverture,
    ...(variantes ? { variantes } : {}),
    ...(mode === "B" ? { script, minutage } : {}),
    texteVoix: texteVoixStoryboard(storyboard.scenes),
    avertissements,
    candidatNom: texte(candidatNom),
    score: Number(score),
    genereLe: date.toISOString(),
  };
}

// Storyboard v4 (avant la charte) ou v5.
export function estStoryboard(reel) {
  return (reel?.version === 4 || reel?.version === VERSION_STORYBOARD) && Array.isArray(reel?.storyboard?.scenes);
}
