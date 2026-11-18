// Montage d'un Reel : listes fermées (animations, transitions, sons, questions
// de couverture, relances), variantes des phrases fixes, règles imposées par
// le code, phrases du plan de montage pour Matis et mesure de la variabilité
// d'un script à l'autre. Fonctions PURES (ni Next, ni base, ni fichiers),
// testées par scripts/reel-montage.test.js. Aucune dépendance vers reel.js.

// --- Listes fermées ---------------------------------------------------------------

// Entrée d'un élément à l'écran. `compteur` : seulement pour un chiffre.
export const ENTREES = ["pop-rebond", "glisse-gauche", "glisse-bas", "machine-a-ecrire", "pixel-par-pixel", "zoom-impact", "compteur"];

// Transition vers la scène suivante. `extinction-ecran` : seulement en fin de vidéo.
export const TRANSITIONS = ["allumage-ecran", "plongee-pixel", "coupe-glitch", "vague-gros-pixels", "coupe-seche", "extinction-ecran"];

// Bruitages (public/reel/sons/<nom>.wav, scripts/generer-sons-reel.js).
// `jingle-score` : seulement au verdict, imposé par le code.
export const SONS = ["blip", "whoosh", "impact", "piece", "glitch", "jingle-score"];
export const SONS_MAX = 6;

// Moment du son dans la scène (choisi par le modèle ; « score » : verdict, imposé).
export const MOMENTS_SON = ["entree", "chiffre", "transition"];

// Question de couverture (4 mots au plus), liste à enrichir.
export const QUESTIONS_COUVERTURE = ["C'est possible ?", "Ça tient ?", "Vraiment ?", "C'est réaliste ?", "Ça marche ?", "Qui paie ?"];

// Relances proposées au modèle (scène « hic » surtout). Celles des 3 derniers
// Reels lui sont signalées, à ne pas reprendre.
export const RELANCES = [
  "Sauf que voilà",
  "Seulement voilà",
  "Mais attention",
  "Petit souci",
  "Pas si vite",
  "Et là, ça coince",
  "Le hic ?",
  "Vous voyez le problème ?",
  "Vous voyez le souci ?",
  "Ça se complique",
  "Mauvaise surprise",
];

// Éléments d'une scène (un calque PNG transparent chacun, en plus du fond).
export const ELEMENTS = ["icone", "texte", "chiffre"];

// --- Variantes des phrases fixes ------------------------------------------------
// Ce qui ne bouge jamais : « poudre de Perlimpinpin », « notée sur cent », le
// score, le palier, l'appel à commenter et à partager. La variante 0 est le
// texte d'origine (Reels générés avant les variantes).

export const VARIANTES = {
  signature: [
    "Bonne idée… ou poudre de Perlimpinpin ?",
    "Vrai bon plan… ou poudre de Perlimpinpin ?",
    "Promesse solide… ou poudre de Perlimpinpin ?",
    "Idée en béton… ou poudre de Perlimpinpin ?",
    "Coup de génie… ou poudre de Perlimpinpin ?",
  ],
  presentation: [
    "Chez Perlimpinpin, notre IA passe les promesses au crible des faits. Allez, on vérifie !",
    "Chez Perlimpinpin, notre IA passe les promesses au crible des faits. On a fouillé. Verdict dans une minute.",
    "Chez Perlimpinpin, notre IA confronte chaque promesse aux faits. On a passé ça au crible. Accrochez-vous.",
    "Chez Perlimpinpin, notre IA vérifie les promesses, chiffres à l'appui. Allez, on regarde ça !",
    "Chez Perlimpinpin, notre IA confronte chaque promesse aux faits. On a tout épluché. C'est parti !",
  ],
  verdict: ["Alors, verdict ?", "Le moment de vérité.", "Et la note ?", "Alors, ça donne quoi ?", "Place au verdict."],
  appel: [
    {
      voix: "Et vous, qu'en pensez-vous ? Dites-le en commentaire, on améliore l'analyse avec vous. Et partagez pour en débattre. L'analyse complète est sur Perlimpinpin !",
      titre: "Et vous, qu’en pensez-vous ?",
    },
    {
      voix: "Et vous, qu'en pensez-vous ? Dites-le en commentaire, vos remarques améliorent l'analyse. Et partagez la vidéo pour lancer le débat. Toute l'analyse est sur Perlimpinpin !",
      titre: "Et vous, qu’en pensez-vous ?",
    },
    {
      voix: "Et vous, vous en dites quoi ? Dites-le en commentaire, on améliore l'analyse avec vous. Partagez pour en débattre autour de vous. L'analyse complète est sur Perlimpinpin !",
      titre: "Et vous, vous en dites quoi ?",
    },
    {
      voix: "Vous êtes d'accord avec cette note ? Dites-le en commentaire, on améliore l'analyse avec vous. Et partagez pour en débattre. Le détail est sur Perlimpinpin !",
      titre: "D’accord avec cette note ?",
    },
    {
      voix: "Et vous, convaincus ? Dites-le en commentaire, on corrige avec vous si besoin. Et partagez pour en débattre. L'analyse complète est sur Perlimpinpin !",
      titre: "Et vous, convaincus ?",
    },
  ],
};

// Fin fixe de l'ouverture du verdict (après la variante).
export const VERDICT_SUR_CENT = "Chez Perlimpinpin, chaque promesse est notée sur cent.";
export const VERDICT_SUR_CENT_SOUS_TITRES = "Chez Perlimpinpin, chaque promesse est notée sur 100.";

// Index de variante valide (0 par défaut : Reels plus anciens).
function indexValide(liste, index) {
  return Number.isInteger(index) && index >= 0 && index < liste.length ? index : 0;
}

export function textesVariantes(variantes = {}) {
  const i = (cle) => indexValide(VARIANTES[cle], variantes?.[cle]);
  return {
    signature: VARIANTES.signature[i("signature")],
    presentation: VARIANTES.presentation[i("presentation")],
    verdict: VARIANTES.verdict[i("verdict")],
    appel: VARIANTES.appel[i("appel")],
  };
}

// Tirage d'un index au hasard dans [0, n[, en évitant `exclus` (un index
// ou une liste). Si tout est exclu, tout redevient possible.
function tirer(n, exclus, alea) {
  const interdits = new Set([exclus].flat());
  const tous = Array.from({ length: n }, (_, i) => i);
  const permis = tous.filter((i) => !interdits.has(i));
  const possibles = permis.length > 0 ? permis : tous;
  return possibles[Math.min(possibles.length - 1, Math.floor(alea() * possibles.length))];
}

// Variantes tirées au hasard à chaque génération, en évitant celles des
// Reels précédents (`precedentes` : un objet variantes, une liste de ces
// objets, ou rien) : l'ancien Reel de la fiche et le dernier Reel généré.
export function choisirVariantes(precedentes = null, alea = Math.random) {
  const liste = [precedentes].flat().filter(Boolean);
  return Object.fromEntries(
    Object.keys(VARIANTES).map((cle) => {
      const avant = liste.map((v) => v[cle]).filter(Number.isInteger);
      return [cle, tirer(VARIANTES[cle].length, avant, alea)];
    }),
  );
}

// Variantes d'un Reel rangé : celles tirées à sa génération, ou la variante 0
// (texte d'origine) pour un Reel plus ancien.
export function variantesDuReelRange(reel) {
  if (!reel) return null;
  return reel.variantes ?? Object.fromEntries(Object.keys(VARIANTES).map((cle) => [cle, 0]));
}

// --- Petits outils ------------------------------------------------------------------

function texte(valeur) {
  return typeof valeur === "string" ? valeur.replace(/\s+/g, " ").trim() : "";
}

function motsDe(t) {
  return texte(t).split(" ").filter((mot) => /[\p{L}\p{N}]/u.test(mot)).length;
}

// Comparaison souple : minuscules, sans accents, apostrophes et ponctuation.
export function normaliserPhrase(t) {
  return texte(t)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[’']/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function decouperPhrases(t) {
  return texte(t)
    .split(/(?<=[.!?…])\s+/)
    .map(normaliserPhrase)
    .filter(Boolean);
}

// Petite empreinte stable (pour un tirage « au hasard » reproductible).
function graine(t) {
  let h = 2166136261;
  for (const c of String(t)) h = Math.imul(h ^ c.codePointAt(0), 16777619) >>> 0;
  return h;
}

// --- Variabilité d'un script à l'autre -----------------------------------------

// Part (de 0 à 1) des phrases de `texteVoix` déjà présentes, à l'identique,
// dans `texteReference` (le dernier Reel généré).
export function partPhrasesIdentiques(texteVoix, texteReference) {
  const phrases = decouperPhrases(texteVoix);
  if (phrases.length === 0) return 0;
  const reference = new Set(decouperPhrases(texteReference));
  return phrases.filter((p) => reference.has(p)).length / phrases.length;
}

// Avertissement si moins de 20 % du texte a changé depuis le dernier Reel.
export const VARIABILITE_MIN = 0.2;
export function avertissementVariabilite(texteVoix, texteReference) {
  if (!texte(texteReference)) return null;
  const part = partPhrasesIdentiques(texteVoix, texteReference);
  // Arrondi au millième : 4 phrases sur 5 reprises = exactement 20 % de changement.
  if (Math.round((1 - part) * 1000) / 1000 >= VARIABILITE_MIN) return null;
  return `Script trop proche du dernier Reel généré : ${Math.round(part * 100)} % de phrases identiques (au moins 20 % du texte doit changer).`;
}

// Relances de la liste présentes dans les Reels donnés (3 derniers).
export function relancesUtilisees(reels = []) {
  const textes = reels.map((r) => ` ${normaliserPhrase(r?.texteVoix)} `);
  return RELANCES.filter((relance) => {
    const cle = ` ${normaliserPhrase(relance)} `;
    return textes.some((t) => t.includes(cle));
  });
}

// Consignes « à ne pas reprendre », ajoutées au message envoyé au modèle.
export function consignesAntiRepetition({ relances = [], questionCouverture = null } = {}) {
  const lignes = [];
  if (relances.length > 0) lignes.push(`- Relances déjà utilisées dans les 3 derniers Reels, à ne pas reprendre : ${relances.map((r) => `« ${r} »`).join(", ")}.`);
  if (questionCouverture) lignes.push(`- Question de couverture du Reel précédent, à ne pas reprendre : « ${questionCouverture} ».`);
  return lignes.length ? `À NE PAS REPRENDRE (pour que les Reels ne sonnent pas tous pareil) :\n${lignes.join("\n")}` : "";
}

// --- Couverture ------------------------------------------------------------------------

// Question de couverture : celle du modèle si elle est dans la liste et
// différente du Reel précédent ; sinon une autre, tirée au hasard.
// Renvoie { question, remplacee }.
// `exclues` : autres questions à éviter (ancien Reel de la fiche, dernier Reel).
export function questionCouverture(proposee, { precedente = null, exclues = [], alea = Math.random } = {}) {
  const valeur = texte(proposee);
  const interdites = [precedente, ...exclues].filter(Boolean);
  if (valeur && QUESTIONS_COUVERTURE.includes(valeur) && !interdites.includes(valeur)) return { question: valeur, remplacee: false };
  const exclus = interdites.map((q) => QUESTIONS_COUVERTURE.indexOf(q)).filter((i) => i >= 0);
  return { question: QUESTIONS_COUVERTURE[tirer(QUESTIONS_COUVERTURE.length, exclus, alea)], remplacee: Boolean(valeur) };
}

// Reel généré avant la couverture : question choisie par le code, toujours la
// même pour un même titre.
export function questionCouvertureParDefaut(titre) {
  return QUESTIONS_COUVERTURE[graine(titre) % QUESTIONS_COUVERTURE.length];
}

// --- Animations et sons ------------------------------------------------------------

// Lecture des champs `animation` et `son` d'une scène de la réponse (formes
// seulement ; les valeurs sont vérifiées par erreursMontage).
export function lireAnimation(brut) {
  if (!brut || typeof brut !== "object") return null;
  const entrees = Array.isArray(brut.entrees)
    ? brut.entrees
        .filter((e) => e && typeof e === "object")
        .map((e) => ({ element: texte(e.element), effet: texte(e.effet) }))
        .filter((e) => e.element || e.effet)
    : [];
  const transition = texte(brut.transition) || null;
  return entrees.length || transition ? { entrees, transition } : null;
}

export function lireSon(brut) {
  if (!brut) return null;
  if (typeof brut === "string") return texte(brut) ? { nom: texte(brut), moment: null } : null;
  if (typeof brut !== "object") return null;
  const nom = texte(brut.nom);
  return nom ? { nom, moment: texte(brut.moment) || null } : null;
}

// Refus : valeurs hors des listes fermées.
export function erreursMontage(id, { animation, son }) {
  const erreurs = [];
  for (const { element, effet } of animation?.entrees ?? []) {
    if (!ELEMENTS.includes(element)) erreurs.push(`Scène « ${id} » : élément d'animation « ${element} » inconnu (${ELEMENTS.join(", ")}).`);
    if (!ENTREES.includes(effet)) erreurs.push(`Scène « ${id} » : entrée « ${effet} » hors de la liste fermée.`);
  }
  if (animation?.transition && !TRANSITIONS.includes(animation.transition)) {
    erreurs.push(`Scène « ${id} » : transition « ${animation.transition} » hors de la liste fermée.`);
  }
  if (son) {
    if (!SONS.includes(son.nom)) erreurs.push(`Scène « ${id} » : son « ${son.nom} » hors de la liste fermée.`);
    if (son.moment && !MOMENTS_SON.includes(son.moment)) erreurs.push(`Scène « ${id} » : moment du son « ${son.moment} » hors de la liste fermée.`);
  }
  return erreurs;
}

// Éléments présents dans une scène assemblée (un calque chacun).
// `portrait` : le portrait bleu du candidat existe (scène 2).
export function elementsScene(scene, { portrait = false } = {}) {
  const elements = [];
  if (scene.id === "presentation" ? portrait : scene.id === "appel" || Boolean(scene.icone)) elements.push("icone");
  elements.push("texte");
  if (scene.id === "verdict" || scene.ecran?.chiffre) elements.push("chiffre");
  return elements;
}

const ENTREE_PAR_DEFAUT = { icone: "pop-rebond", texte: "machine-a-ecrire", chiffre: "zoom-impact" };
const TRANSITIONS_PAR_DEFAUT = ["allumage-ecran", "coupe-glitch", "plongee-pixel", "vague-gros-pixels", "coupe-seche"];

// Animations finales des 9 scènes, à partir des choix du modèle et des règles
// du code :
//  - scène 1 : le texte entre en premier, en zoom-impact ;
//  - verdict : le score en compteur, puis la grille qui s'allume case par case ;
//  - dernière scène : extinction-ecran, et seulement elle ;
//  - jamais deux fois la même transition à la suite ;
//  - compteur réservé aux chiffres ; valeur hors liste ou absente : par défaut.
// `scenes` : scènes assemblées, avec `animationModele` (ou rien).
// Renvoie un tableau { entrees: [{ element, effet }], transition, grille }
// et la liste des corrections faites (avertissements).
export function animationsReel(scenes, { portrait = false } = {}) {
  const corrections = [];
  const resultat = scenes.map((scene, index) => {
    const elements = elementsScene(scene, { portrait });
    const modele = scene.animationModele ?? null;
    const vus = new Set();
    let entrees = [];
    for (const { element, effet } of modele?.entrees ?? []) {
      if (!elements.includes(element) || vus.has(element)) continue;
      vus.add(element);
      let choix = ENTREES.includes(effet) ? effet : ENTREE_PAR_DEFAUT[element];
      if (choix === "compteur" && element !== "chiffre") {
        corrections.push(`Scène ${scene.numero} : « compteur » réservé aux chiffres, remplacé par « ${ENTREE_PAR_DEFAUT[element]} ».`);
        choix = ENTREE_PAR_DEFAUT[element];
      }
      entrees.push({ element, effet: choix });
    }
    for (const element of elements) if (!vus.has(element)) entrees.push({ element, effet: ENTREE_PAR_DEFAUT[element] });

    if (scene.id === "accroche") {
      entrees = [{ element: "texte", effet: "zoom-impact" }, ...entrees.filter((e) => e.element !== "texte")];
    }
    if (scene.id === "verdict") {
      entrees = [{ element: "chiffre", effet: "compteur" }, ...entrees.filter((e) => e.element !== "chiffre")];
    }
    const derniere = index === scenes.length - 1;
    const voulue = modele?.transition && TRANSITIONS.includes(modele.transition) ? modele.transition : null;
    return { entrees, transition: derniere ? "extinction-ecran" : voulue, grille: scene.id === "verdict", numero: scene.numero };
  });

  // Transitions : défaut, pas d'extinction avant la fin, pas de doublon à la suite.
  for (let i = 0; i < resultat.length - 1; i++) {
    const precedente = i > 0 ? resultat[i - 1].transition : null;
    let t = resultat[i].transition;
    if (t === "extinction-ecran") {
      corrections.push(`Scène ${resultat[i].numero} : « extinction-ecran » réservée à la fin de la vidéo, transition remplacée.`);
      t = null;
    } else if (t && t === precedente) {
      corrections.push(`Scène ${resultat[i].numero} : même transition que la scène précédente (« ${t} »), remplacée.`);
      t = null;
    }
    if (!t) {
      // Défaut en rotation (selon la place de la scène), différent des voisines.
      const suivante = resultat[i + 1].transition;
      const n = TRANSITIONS_PAR_DEFAUT.length;
      for (let k = 0; k < n && !t; k++) {
        const c = TRANSITIONS_PAR_DEFAUT[(i + k) % n];
        if (c !== precedente && c !== suivante) t = c;
      }
    }
    resultat[i].transition = t;
  }
  return { animations: resultat.map(({ numero: _n, ...reste }) => reste), corrections };
}

// Sons finaux des 9 scènes : jingle-score imposé au verdict (et seulement
// là), un son au plus par scène, SONS_MAX sur toute la vidéo (les premiers
// gardés). Renvoie { sons: [{ nom, moment } | null], corrections }.
export function sonsReel(scenes) {
  const corrections = [];
  let restants = SONS_MAX - (scenes.some((s) => s.id === "verdict") ? 1 : 0);
  const sons = scenes.map((scene) => {
    if (scene.id === "verdict") return { nom: "jingle-score", moment: "score" };
    const son = scene.sonModele;
    if (!son || !SONS.includes(son.nom)) return null;
    if (son.nom === "jingle-score") {
      corrections.push(`Scène ${scene.numero} : « jingle-score » réservé au verdict, son retiré.`);
      return null;
    }
    if (restants <= 0) {
      corrections.push(`Scène ${scene.numero} : son « ${son.nom} » retiré (${SONS_MAX} sons au plus sur toute la vidéo).`);
      return null;
    }
    restants--;
    const moment = MOMENTS_SON.includes(son.moment) ? son.moment : "entree";
    return { nom: son.nom, moment: moment === "chiffre" && !scene.ecran?.chiffre ? "entree" : moment };
  });
  return { sons, corrections };
}

// --- Phrases du plan de montage (pour Matis) --------------------------------------

const EFFETS = {
  "pop-rebond": ["apparaît avec un petit rebond", "apparaissent avec un petit rebond"],
  "glisse-gauche": ["glisse depuis la gauche", "glissent depuis la gauche"],
  "glisse-bas": ["monte depuis le bas", "montent depuis le bas"],
  "machine-a-ecrire": ["s'écrit lettre par lettre", "s'écrivent lettre par lettre"],
  "pixel-par-pixel": ["se dessine pixel par pixel", "se dessinent pixel par pixel"],
  "zoom-impact": ["arrive en zoom", "arrivent en zoom"],
  compteur: ["défile comme un compteur", "défilent comme un compteur"],
};

export const NOMS_TRANSITIONS = {
  "allumage-ecran": "allumage d'écran",
  "plongee-pixel": "plongée dans les pixels",
  "coupe-glitch": "coupe glitch",
  "vague-gros-pixels": "vague de gros pixels",
  "coupe-seche": "coupe sèche",
  "extinction-ecran": "extinction d'écran (fin de la vidéo)",
};

export const MOMENTS_LIBELLES = {
  entree: "dès que la scène apparaît",
  chiffre: "quand le chiffre arrive",
  transition: "sur la transition",
  score: "quand le score s'affiche",
};

// « l'icône », « le chiffre « 6,8 Md€ » »… ; pluriel : true pour « les icônes ».
function libelleElement(scene, element) {
  const e = scene.ecran ?? {};
  if (element === "icone") {
    if (scene.id === "presentation") return ["le portrait", false];
    if (scene.id === "appel") return ["les icônes", true];
    return ["l'icône", false];
  }
  if (element === "chiffre") return [scene.id === "verdict" ? `le score ${String(e.score).replace(".", ",")}` : `le chiffre ${e.chiffre}`, false];
  switch (scene.id) {
    case "accroche":
      return [e.titre ? `le titre « ${e.titre} »` : "le titre", false];
    case "presentation":
      return ["le nom", false];
    case "tient":
      return [e.tampon ? `le tampon « ${e.tampon.toUpperCase()} »` : "le tampon", false];
    case "hic":
    case "facture":
      return ["la légende", false];
    case "verdict":
      return [e.palier ? `le palier « ${e.palier} »` : "le palier", false];
    case "appel":
      return ["le texte", false];
    default:
      return ["le titre", false];
  }
}

function majuscule(t) {
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// Montage d'une scène assemblée (avec animation et son) en phrases simples :
// { animations, transition, son, resume }.
export function montageScene(scene) {
  const { entrees = [], transition, grille } = scene.animation ?? {};
  const morceaux = entrees.flatMap(({ element, effet }) => {
    const verbe = (EFFETS[effet] ?? EFFETS["pop-rebond"])[element === "icone" && scene.id === "appel" ? 1 : 0];
    // Verdict : « le score défile comme un compteur jusqu'à 38, et la grille… ».
    if (scene.id === "verdict" && element === "chiffre") {
      const score = String(scene.ecran?.score).replace(".", ",");
      const debut = effet === "compteur" ? `le score ${verbe} jusqu'à ${score}` : `le score ${score} ${verbe}`;
      return [grille ? `${debut}, et la grille s'allume case par case` : debut];
    }
    const [libelle] = libelleElement(scene, element);
    return [`${libelle} ${verbe}`];
  });
  const animations = morceaux.length ? `${majuscule(morceaux.join(", puis "))}.` : "";
  const transitionTexte = transition ? majuscule(NOMS_TRANSITIONS[transition] ?? transition) : null;
  const son = scene.son
    ? `${scene.son.nom}.wav, ${MOMENTS_LIBELLES[scene.son.moment] ?? MOMENTS_LIBELLES.entree}, à mettre nettement sous la voix`
    : null;
  const resume = [
    animations,
    transitionTexte ? `Transition : ${NOMS_TRANSITIONS[transition] ?? transition}.` : null,
    `Son : ${scene.son ? `${scene.son.nom} (${MOMENTS_LIBELLES[scene.son.moment] ?? MOMENTS_LIBELLES.entree})` : "aucun"}.`,
  ]
    .filter(Boolean)
    .join(" ");
  return { animations, transition: transitionTexte, son, resume };
}

// Titre de couverture trop long (avertissement).
export const MOTS_TITRE_COUVERTURE = 8;
export function motsTitreCouverture(titre) {
  return motsDe(titre);
}
