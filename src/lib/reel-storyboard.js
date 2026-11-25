import { formatScore, getScoreBadge } from "./score.js";
import { nombresHorsFiche, extraireNombres } from "./nombres-fiche.js";
import { tournuresIA } from "./tournures-ia.js";
import { NOMS_PIXEL } from "./reel-pixel.js";
import { CLES_PAYS, paysCites, paysParCle } from "./reel-pays.js";
import { QUESTIONS_COUVERTURE, SONS, VARIANTES, avertissementVariabilite, questionCouverture } from "./reel-montage.js";

// Storyboard des Reels (v4, docs/prompt-reel.md) : 7 à 10 scènes typées, 3
// images clés par scène, voix off découpée en 3 morceaux, mouvement décrit
// en 3 phrases. L'objet `R` du prompt. Deux modes :
//   A « Script Claude » : Claude écrit le script et le storyboard ;
//   B « Script et voix off de l'équipe » : Claude découpe le texte de
//     l'équipe sans le réécrire (contrôle mot pour mot bloquant).
// Fonctions PURES (ni Next, ni base, ni fichiers), testées par
// scripts/reel-storyboard.test.js.

export const SCENES_MIN = 7;
export const SCENES_MAX = 10;
export const DUREE_SCENE_MIN = 5;
export const DUREE_SCENE_MAX = 9;
export const MOTS_ECRAN_MAX = 7;
export const MOTS_PAR_SECONDE = 3;
export const URL_REEL = "perlimpinpin.ai";
export const SONS_MAX_STORYBOARD = 5;

// --- Catalogue des scènes (section 4) ------------------------------------------
// Spécification d'un champ : « texte », « nombre », « icone », « booleen »,
// une liste ({ liste: spec, min, max }) ou un objet ({ objet: { champ: spec } }).
// Suffixe « ? » ou { optionnel: true } : facultatif. `ecran: false` : champ
// de mise en page, pas un texte affiché (pas de contrôle des mots).
const t = "texte";
const opt = (spec) => ({ ...(typeof spec === "string" ? { type: spec } : spec), optionnel: true });

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
  fin: { nom: "Fin", champs: { question: t, url: { type: "texte", ecran: false }, mention: t } },
};

export const TYPES = Object.keys(TYPES_SCENES);
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

function lireValeur(spec, valeur, chemin, erreurs) {
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
    return valeur.map((v, i) => lireValeur(s.liste, v, `${chemin}[${i + 1}]`, erreurs));
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
        .map(([cle, sous]) => [cle, lireValeur(sous, valeur[cle], `${chemin}.${cle}`, erreurs)])
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
    case "icone":
      if (!NOMS_PIXEL.includes(valeur)) {
        erreurs.push(`${chemin} : objet pixel « ${valeur} » hors de la liste (${NOMS_PIXEL.join(", ")}).`);
        return undefined;
      }
      return valeur;
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
export function lireStoryboard(raw) {
  const erreurs = [];
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
      const v = lireValeur(spec, brute[champ], `${chemin} (${type}).${champ}`, erreurs);
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
  if (!couverture.titre) erreurs.push("Couverture : titre manquant.");
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

// Sous-titres SRT : le texte exact du storyboard (sans « ** »), en lignes de
// 8 mots au plus coupées à la ponctuation, calées sur les temps des mots.
export function sousTitresSrt(scenes, temps) {
  const blocs = [];
  let i = 0;
  const jet = temps.jetons;
  for (const scene of scenes ?? []) {
    for (const m of morceauxDits(scene)) {
      const mots = sansGras(m).split(/\s+/).filter(Boolean);
      let courant = [];
      mots.forEach((mot, k) => {
        courant.push(mot);
        const fin = k === mots.length - 1 || courant.length >= 8 || (/[.,;:?!…]$/.test(mot) && courant.length >= 3);
        if (!fin) return;
        const n = courant.reduce((somme, x) => somme + jetons(x).length, 0);
        const premier = jet[i] ?? jet.at(-1) ?? { debut: 0, fin: 0 };
        const dernier = jet[i + Math.max(0, n - 1)] ?? premier;
        i += n;
        blocs.push({ debut: premier.debut, fin: Math.max(dernier.fin, premier.debut + 0.3), texte: courant.join(" ") });
        courant = [];
      });
    }
  }
  return `${blocs.map((b, k) => `${k + 1}\n${tempsSrt(b.debut)} --> ${tempsSrt(b.fin)}\n${b.texte}\n`).join("\n")}`;
}

// --- Contrôle ---------------------------------------------------------------------

// Contrôle du storyboard. Refus (erreurs) :
//   - JSON invalide (type ou champ inconnu, champ manquant) ;
//   - moins de 7 ou plus de 10 scènes ;
//   - deux scènes de suite du même type ; première autre que `accroche`,
//     dernière autre que `fin` ;
//   - scène `note` dont le score ou le verdict ne sont pas ceux du code ;
//   - texte à l'écran contenant un chiffre absent du script et de la fiche ;
//   - pays cité sans carte ; « ** » non refermés ;
//   - mode A : phrases fixes absentes ; mode B : écart au texte de l'équipe.
// Avertissements : texte à l'écran de plus de 7 mots, tournures « IA »,
// morceau sans mot clé ou avec plus de 2, scène hors de 5 à 9 s, variabilité,
// trop de sons.
// ctx = { mode: "A"|"B", ficheFinale, score, script (mode B), minutage (mode B),
//   variantes (mode A), cartesDisponibles (clés), precedent (texte du dernier Reel) }
export function controlerStoryboard(raw, ctx) {
  const { storyboard, erreurs: erreursLecture } = lireStoryboard(raw);
  if (!storyboard) return { valide: false, erreurs: erreursLecture, avertissements: [], storyboard: null };
  const { mode = "A", ficheFinale = {}, score, script = "", minutage = null, variantes = null, precedent = null } = ctx ?? {};
  const cartesDisponibles = new Set(ctx?.cartesDisponibles ?? CLES_PAYS);
  const erreurs = [];
  const avertissements = [];
  const scenes = storyboard.scenes;
  const nom = (i) => `Scène ${i + 1} (${scenes[i].type})`;

  if (scenes.length < SCENES_MIN || scenes.length > SCENES_MAX) {
    erreurs.push(`${scenes.length} scènes : ${SCENES_MIN} à ${SCENES_MAX} attendues.`);
  }
  if (scenes[0]?.type !== "accroche") erreurs.push(`La première scène doit être une \`accroche\` (ici « ${scenes[0]?.type} »).`);
  if (scenes.at(-1)?.type !== "fin") erreurs.push(`La dernière scène doit être une \`fin\` (ici « ${scenes.at(-1)?.type} »).`);
  scenes.forEach((s, i) => {
    if (i > 0 && s.type === scenes[i - 1].type) erreurs.push(`Scènes ${i} et ${i + 1} : deux \`${s.type}\` de suite.`);
  });

  // La note : score et verdict du code.
  const verdict = verdictDuScore(score);
  scenes.forEach((s, i) => {
    if (s.type !== "note") return;
    if (Number(s.score) !== Number(formatScore(Number(score)))) erreurs.push(`${nom(i)} : score ${s.score}, le code calcule ${scoreTexte(score)}.`);
    if (texte(s.verdict).toLowerCase() !== verdict.toLowerCase()) erreurs.push(`${nom(i)} : verdict « ${s.verdict} », le code donne « ${verdict.toLowerCase()} ».`);
  });

  // Voix : gras refermés, 1 ou 2 mots clés par morceau.
  scenes.forEach((s, i) =>
    s.voix.forEach((m, k) => {
      if ((m.match(/\*\*/g) ?? []).length % 2 !== 0) erreurs.push(`${nom(i)}, morceau ${k + 1} : « ** » non refermé.`);
      const cles = (m.match(/\*\*(.+?)\*\*/g) ?? []).length;
      if (cles < 1 || cles > 2) avertissements.push(`${nom(i)}, morceau ${k + 1} : ${cles} mot(s) clé(s) en « ** », 1 ou 2 attendus.`);
    }),
  );

  // Textes ajoutés à l'écran.
  const voixEntiere = texteVoixStoryboard(scenes);
  const nombresScript = new Set(extraireNombres(mode === "B" ? `${script}\n${voixEntiere}` : voixEntiere));
  scenes.forEach((s, i) => {
    for (const { champ, texte: t2 } of textesEcran(s)) {
      const mots = nombreDeMots(t2);
      if (mots > MOTS_ECRAN_MAX) avertissements.push(`${nom(i)} : « ${champ} » fait ${mots} mots à l'écran (${MOTS_ECRAN_MAX} au plus).`);
      for (const nombre of nombresHorsFiche([t2], ficheFinale)) {
        if (!nombresScript.has(nombre)) erreurs.push(`${nom(i)} : « ${champ} » affiche « ${nombre} », absent du script et de la fiche.`);
      }
      for (const tournure of tournuresIA(t2)) avertissements.push(`${nom(i)} : « ${champ} », tournure qui sonne « IA » (« ${tournure} »).`);
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
    if (accroche?.type === "accroche" && !jetons(accroche.voix[2]).join(" ").endsWith(jetons(f.signature).join(" "))) {
      erreurs.push(`Scène 1 (accroche) : le 3e morceau doit finir par « ${f.signature} ».`);
    }
    scenes.forEach((s, i) => {
      if (s.type !== "note") return;
      if (!jetons(s.voix[0]).join(" ").includes(jetons(f.verdict).join(" "))) erreurs.push(`${nom(i)} : le 1er morceau doit contenir « ${f.verdict} ».`);
      if (!jetons(s.voix.join(" ")).join(" ").includes(jetons(`${scoreTexte(score)} sur 100`).join(" "))) {
        erreurs.push(`${nom(i)} : la voix doit dire « ${scoreTexte(score)} sur 100 ».`);
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

  const variabilite = avertissementVariabilite(voixEntiere, precedent);
  if (variabilite) avertissements.push(variabilite);

  return { valide: erreurs.length === 0, erreurs, avertissements, storyboard, temps };
}

// --- Couverture -------------------------------------------------------------------

// Couverture finale : titre du modèle (sinon le titre de l'accroche), question
// de la liste fermée, différente des Reels précédents. Pas de score.
export function couvertureStoryboard(storyboard, { exclues = [], alea = Math.random } = {}) {
  const accroche = storyboard.scenes.find((s) => s.type === "accroche");
  const titre = texte(storyboard.couverture?.titre) || texte(`${accroche?.titre ?? ""} ${accroche?.surligne ?? ""}`);
  const { question } = questionCouverture(storyboard.couverture?.question, { exclues: exclues.filter(Boolean), alea });
  return { titre, question, questionProposee: storyboard.couverture?.question ?? null, horsListe: Boolean(storyboard.couverture?.question) && !QUESTIONS_COUVERTURE.includes(storyboard.couverture.question) };
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

// Check-list de la section 6. etat : "ok", "ko" ou "manuel" (à vérifier à l'œil).
export function checkList({ mode, storyboard, temps, avertissements = [], avertissementsZones = [], photos = {}, minutage = null }) {
  const scenes = storyboard.scenes;
  const fin = scenes.at(-1);
  const voixFin = jetons(fin?.voix?.join(" ") ?? "").join(" ");
  const textesCourts = !avertissements.some((a) => /mots à l'écran|sonne « IA »/.test(a));
  const zoneSousTitres = !avertissementsZones.some((a) => /sous-titres/.test(a));
  return [
    {
      texte: "Chaque mot de la voix off apparaît en sous-titre, dans l’ordre, sans reformulation.",
      etat: mode === "B" ? "ok" : "manuel",
      detail: mode === "B" ? "Contrôle mot pour mot passé ; sous-titres tirés du texte de l’équipe." : "Sous-titres tirés du script ; à revérifier une fois la voix off enregistrée (mode B).",
    },
    {
      texte: "Les écarts entre script et voix off sont listés.",
      etat: minutage && !minutage.estime ? "ok" : "manuel",
      detail: minutage && !minutage.estime ? `${minutage.ecarts?.length ?? 0} écart(s) dans ecarts.txt.` : "Pas de voix off calée : lancer scripts/caler-voix.py.",
    },
    { texte: "Les textes ajoutés à l’écran sont courts, parlés et sans chiffre inventé.", etat: textesCourts ? "ok" : "ko", detail: textesCourts ? "Chiffres contrôlés, 7 mots au plus, aucune tournure « IA »." : "Voir les avertissements." },
    { texte: "Aucune scène n’empiète sur la zone des sous-titres (l’export le signale).", etat: zoneSousTitres ? "ok" : "ko", detail: zoneSousTitres ? "Boîtes calculées : rien entre 1 330 et 1 450 px." : "Voir les avertissements de zones." },
    {
      texte: "Les photos sont tramées, dans des fenêtres, et leurs crédits sont notés.",
      etat: photos.candidat && photos.illustration && photos.credits ? "ok" : photos.candidat ? "manuel" : "ko",
      detail: [photos.candidat ? "Candidat tramé." : "Photo du candidat tramée manquante.", photos.illustration ? "Illustration tramée." : "Pas d’illustration : panneau tramé à la place.", photos.credits ? "Crédits dans infos.txt." : "Crédits à compléter."].join(" "),
    },
    { texte: "Chaque pays cité a sa carte.", etat: "ok", detail: "Contrôlé (refus sinon)." },
    { texte: "Deux scènes qui se suivent n’ont jamais le même type.", etat: "ok", detail: "Contrôlé (refus sinon)." },
    {
      texte: "Le Reel se termine par l’appel à corriger l’analyse sur le site et le lien en bio.",
      etat: fin?.type === "fin" && /corrig/.test(voixFin) && /\bbio\b/.test(voixFin) ? "ok" : "ko",
      detail: fin?.type === "fin" ? `Dernière scène : « ${fin.voix.map(sansGras).join(" ")} »` : "Pas de scène de fin.",
    },
  ].map((item) => ({ ...item, temps: temps?.estime }));
}

// --- Stockage ------------------------------------------------------------------------

// Objet rangé dans contenuComplet.reel (version 4).
export function storyboardPourStockage({ mode, storyboard, couverture, variantes, avertissements, script, minutage }, { candidatNom, score, date = new Date() }) {
  return {
    version: 4,
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

export function estStoryboard(reel) {
  return reel?.version === 4 && Array.isArray(reel?.storyboard?.scenes);
}
