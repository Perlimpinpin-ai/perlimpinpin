import { formatScore, getScoreBadge } from "./score.js";
import { couperTitre, empreinte, slugCandidat, sousTitreCarte } from "./carte.js";
import { handleX } from "./handles-x.js";
import { nombreDeMots, pastille, remplirTweet } from "./reseaux.js";
import { handleInstagram, hashtagCandidat, hashtagTheme } from "./handles-instagram.js";
import { themeCandidat } from "./couleurs-candidats.js";
import { resolveTheme } from "./themes.js";
import { aleaFiche, choisirIllustration, creditLegende, creditVisible, ILLUSTRATIONS } from "./illustrations.js";

// Carrousel Instagram d'une fiche (6 slides 1080 × 1350 et leur légende),
// assemblé par le code à partir des textes déjà présents dans la fiche :
// aucun appel à l'IA. Rendu des images : src/app/api/carrousel/[id]/ ;
// page de partage : /test/reseaux/[id]. Fonctions PURES (ni Next, ni base,
// ni fichiers), testées par scripts/carrousel.test.js.
//
// Score, palier, pastille et hashtags sont toujours écrits par le code
// (src/lib/score.js), jamais repris d'un texte du modèle.

export const LARGEUR_SLIDE = 1080;
export const HAUTEUR_SLIDE = 1350;
export const MOTS_MAX_SLIDE = 35;
export const LEGENDE_MAX = 2200;
export const HASHTAGS_MAX = 5;

// Nom de fichier (sans numéro) et libellé de chaque type de slide.
export const TYPES_SLIDES = {
  couverture: { fichier: "couverture", libelle: "Couverture" },
  mesure: { fichier: "la-mesure", libelle: "La mesure en clair" },
  note: { fichier: "la-note", libelle: "La note" },
  chiffre: { fichier: "le-chiffre", libelle: "Le chiffre" },
  tient: { fichier: "tient-tient-pas", libelle: "Tient / tient pas" },
  fin: { fichier: "fin", libelle: "Fin" },
};

// --- Textes repris de la fiche -------------------------------------------------

// Texte repris tel quel, nettoyé : gras Markdown retiré, espaces simples, et
// tiret cadratin remplacé par une virgule (signalé dans `avertissements`).
export function texteRepris(texte, cle, avertissements) {
  let t = String(texte ?? "").replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
  if (t.includes("—")) {
    avertissements.push({ cle, message: `Tiret cadratin remplacé par une virgule : « ${t} ».` });
    t = t
      .replace(/\s*—\s*/g, ", ")
      .replace(/^,\s*/, "")
      .replace(/,\s*([,.;:!?…])/g, "$1")
      .replace(/,\s*$/, "")
      .trim();
  }
  return t;
}

// Phrases d'un texte (coupe après . ! ? … suivis d'une majuscule, d'un
// chiffre ou d'un guillemet).
export function phrases(texte) {
  return String(texte ?? "")
    .split(/(?<=[.!?…])\s+(?=[«"“(\p{Lu}\d])/u)
    .map((phrase) => phrase.trim())
    .filter(Boolean);
}

// Raccourcit un texte à `max` mots, jamais au milieu d'un mot : d'abord à la
// phrase, sinon à la dernière virgule (ou deux-points, point-virgule) qui
// tient, sinon au mot ; dans ces deux derniers cas, avec « … ».
export function raccourcir(texte, max) {
  const t = String(texte ?? "").trim();
  if (nombreDeMots(t) <= max) return t;

  const parPhrases = phrases(t);
  let retenu = "";
  for (const phrase of parPhrases) {
    const essai = retenu ? `${retenu} ${phrase}` : phrase;
    if (nombreDeMots(essai) > max) break;
    retenu = essai;
  }
  if (retenu) return retenu;

  const premiere = parPhrases[0] ?? t;
  retenu = "";
  for (const morceau of premiere.split(/(?<=[,;:])\s+/)) {
    const essai = retenu ? `${retenu} ${morceau}` : morceau;
    if (nombreDeMots(essai) > max) break;
    retenu = essai;
  }
  if (retenu && nombreDeMots(retenu) >= Math.min(4, max)) return `${retenu.replace(/\s*[,;:]$/, "")}…`;

  const mots = premiere.split(/\s+/);
  retenu = "";
  for (const mot of mots) {
    const essai = retenu ? `${retenu} ${mot}` : mot;
    if (nombreDeMots(essai) > max) break;
    retenu = essai;
  }
  return `${retenu.replace(/[\s,;:.!?…]+$/, "")}…`;
}

function motsDe(textes) {
  return textes.reduce((total, texte) => total + nombreDeMots(texte), 0);
}

// --- Les slides ------------------------------------------------------------------

// 2. La mesure en clair : une ou deux phrases du résumé de la vue basique
// (contenuComplet.version_basique.resume), sinon de la mesure initiale
// (Proposition.texteOriginal, issue de relecture.mesure_initiale).
function slideMesure({ resumeBasique, mesureInitiale }, avertissements) {
  const depuisResume = typeof resumeBasique === "string" && resumeBasique.trim() !== "";
  const source = depuisResume ? "version_basique.resume" : "mesure initiale";
  const texte = texteRepris(depuisResume ? resumeBasique : mesureInitiale, `slide « La mesure » (${source})`, avertissements);
  const [premiere = "", seconde] = phrases(texte);
  let choisi = premiere;
  if (seconde && nombreDeMots(`${premiere} ${seconde}`) <= MOTS_MAX_SLIDE) choisi = `${premiere} ${seconde}`;
  const mots = nombreDeMots(choisi);
  if (mots <= MOTS_MAX_SLIDE) return { type: "mesure", texte: choisi, source };
  return { type: "mesure", texte: raccourcir(choisi, MOTS_MAX_SLIDE), source, raccourci: mots };
}

// 4. Le chiffre : grand nombre + explication (contenuComplet.reseaux.chiffre).
function slideChiffre(chiffre, avertissements) {
  if (!chiffre?.valeur || !chiffre?.explication) return null;
  const valeur = texteRepris(chiffre.valeur, "slide « Le chiffre » (valeur)", avertissements);
  const explication = texteRepris(chiffre.explication, "slide « Le chiffre » (explication)", avertissements);
  const mots = motsDe([valeur, explication]);
  if (mots <= MOTS_MAX_SLIDE) return { type: "chiffre", valeur, explication };
  return {
    type: "chiffre",
    valeur,
    explication: raccourcir(explication, Math.max(5, MOTS_MAX_SLIDE - nombreDeMots(valeur))),
    raccourci: mots,
  };
}

// 5. Tient / tient pas : versions courtes (tient_court, tient_pas_court),
// 2 au plus de chaque côté, comme dans le tweet. Au-delà de 35 mots, on retire
// le 2e point du côté le plus long, puis on coupe.
function slideTient(tient, avertissements) {
  if (!tient) return null;
  const cote = (courts, longs, nom) =>
    (Array.isArray(courts) && courts.length ? courts : Array.isArray(longs) ? longs : [])
      .slice(0, 2)
      .map((texte, i) => texteRepris(texte, `slide « Tient / tient pas » (${nom}.${i})`, avertissements))
      .filter(Boolean);
  let oui = cote(tient.tient_court, tient.tient, "tient_court");
  let non = cote(tient.tient_pas_court, tient.tient_pas, "tient_pas_court");
  if (oui.length === 0 || non.length === 0) return null;

  const mots = motsDe([...oui, ...non]);
  if (mots <= MOTS_MAX_SLIDE) return { type: "tient", tient: oui, tientPas: non };
  while (motsDe([...oui, ...non]) > MOTS_MAX_SLIDE && (oui.length > 1 || non.length > 1)) {
    const retirerOui =
      oui.length > 1 && (non.length === 1 || motsDe(oui) >= motsDe(non));
    if (retirerOui) oui = oui.slice(0, -1);
    else non = non.slice(0, -1);
  }
  if (motsDe([...oui, ...non]) > MOTS_MAX_SLIDE) {
    const parPoint = Math.floor(MOTS_MAX_SLIDE / 2);
    oui = oui.map((texte) => raccourcir(texte, parPoint));
    non = non.map((texte) => raccourcir(texte, parPoint));
  }
  return { type: "tient", tient: oui, tientPas: non, raccourci: mots };
}

// Texte d'une condition (« Titre : explication. ») ; un objet est accepté
// par prudence ({ titre, texte }).
function texteCondition(condition) {
  if (typeof condition === "string") return condition;
  if (condition && typeof condition === "object") {
    return [condition.titre, condition.texte].filter((t) => typeof t === "string" && t.trim()).join(" : ");
  }
  return "";
}

// 6. Ce qui la ferait tenir : les 3 conditions de ce_qui_la_ferait_tenir,
// chacune réduite à sa première phrase ; au-delà de 35 mots en tout, au
// titre de la condition (avant « : »), puis coupée.
export function slideConditions(liste, avertissements) {
  const conditions = (Array.isArray(liste) ? liste : [])
    .map(texteCondition)
    .map((texte, i) => texteRepris(texte, `slide « Ce qui la ferait tenir » (condition ${i + 1})`, avertissements))
    .filter(Boolean)
    .slice(0, 3);
  if (conditions.length === 0) return null;

  const premieres = conditions.map((texte) => phrases(texte)[0] ?? texte);
  const mots = motsDe(premieres);
  if (mots <= MOTS_MAX_SLIDE) return { type: "conditions", conditions: premieres };

  const titres = premieres.map((texte) => {
    const avant = texte.split(/\s:\s/)[0].replace(/[.\s]+$/, "");
    return avant && avant !== texte ? avant : texte;
  });
  const parCondition = Math.floor(MOTS_MAX_SLIDE / titres.length);
  const finales =
    motsDe(titres) <= MOTS_MAX_SLIDE ? titres : titres.map((texte) => raccourcir(texte, parCondition));
  return { type: "conditions", conditions: finales, raccourci: mots };
}

// --- Éléments communs aux deux carrousels -----------------------------------------

// Sujet court du pied de page (« Fabien Roussel · Smic ») : le début du titre,
// avant le premier mot de liaison (couperTitre, src/lib/carte.js), 4 mots au plus.
export function sujetCourt(titre) {
  const { noir } = couperTitre(titre);
  return noir.replace(/[\s,:;.]+$/, "").split(/\s+/).slice(0, 4).join(" ");
}

// Condition la plus forte (la première de ce_qui_la_ferait_tenir), réduite à
// son titre (avant « : ») ou à sa première phrase. null si la fiche n'en a pas.
export function conditionPrincipale(liste, avertissements) {
  const premiere = Array.isArray(liste) ? liste.find(Boolean) : null;
  if (!premiere) return null;
  const t = texteRepris(typeof premiere === "string" ? premiere : [premiere.titre, premiere.texte].filter(Boolean).join(" : "), "condition la plus forte", avertissements);
  const avant = t.split(/\s:\s/)[0].replace(/[.\s]+$/, "");
  return avant && avant !== t ? avant : phrases(t)[0] ?? t;
}

// Sources principales de la dernière slide : les 3 premières de
// sources_utilisees, sans leur adresse, raccourcies.
export function sourcesPrincipales(contenu) {
  const liste = Array.isArray(contenu?.sources_utilisees) ? contenu.sources_utilisees : [];
  // Source réduite à une adresse nue : le nom du site (« education.gouv.fr »).
  const nomSite = (texte) => {
    const m = String(texte).trim().match(/^https?:\/\/(?:www\.)?([^/\s]+)/i);
    return m ? m[1] : "";
  };
  const vus = new Set();
  return liste
    .map((source) => {
      const brut = String(typeof source === "string" ? source : (source?.titre ?? source?.nom ?? ""));
      return brut.replace(/\s*:?\s*https?:\/\/\S+/g, "").trim() || nomSite(brut);
    })
    .filter((source) => source && !vus.has(source) && vus.add(source))
    .slice(0, 3)
    .map((source) => (source.length > 70 ? `${source.slice(0, 69).replace(/[\s,;:]+\S*$/, "")}…` : source));
}

// --- La légende --------------------------------------------------------------------

// Accroche du tweet 1 (« 🔵 <la mesure en une ligne> : <premier verdict>. »),
// sans pastille ni compte X ; seule la partie après « : » est reprise, le
// titre de la mesure ouvrant déjà la ligne.
export function accrocheDuFil(reseaux, candidatNom) {
  const premierBloc = String(reseaux?.fil?.[0] ?? "").split(/\n\s*\n/)[0] ?? "";
  let texte = remplirTweet(premierBloc.replace(/^🔵\s*/u, ""), { CANDIDAT: candidatNom, NOM: candidatNom });
  const compteX = handleX(candidatNom);
  if (compteX) texte = texte.split(compteX).join(candidatNom);
  texte = texte.replace(/(^|\s)@(\w+)/g, "$1$2").trim();
  const [, apres] = texte.split(/\s:\s(.+)/s);
  return (apres ?? texte).trim();
}

export function scoreAffiche(score) {
  return String(formatScore(Number(score))).replace(".", ",");
}

export function hashtagsLegende({ candidatNom, theme }) {
  return ["#Presidentielle2027", hashtagCandidat(candidatNom), hashtagTheme(theme), "#FactChecking", "#Perlimpinpin"]
    .filter(Boolean)
    .slice(0, HASHTAGS_MAX);
}

function legendeInstagram({ titre, candidatNom, score, theme, mention, accroche, tient, credit }) {
  const blocs = [
    [`${pastille(score)} ${titre}${accroche ? ` : ${accroche}` : ""}`, sousTitreCarte(mention)].join("\n"),
    `Note Perlimpinpin : ${scoreAffiche(score)}/100, ${getScoreBadge(Number(score)).label}.`,
    tient ? [`✅ ${tient.oui}`, `❌ ${tient.non}`].join("\n") : null,
    "Analyse complète, sources et méthode : lien en bio.\nEt vous, ça tient ? Dites-le en commentaire.",
    hashtagsLegende({ candidatNom, theme }).join(" "),
    credit ?? null,
  ];
  return blocs.filter(Boolean).join("\n\n");
}

// Légende et couleur du candidat, communes aux deux carrousels (6 slides et
// récit), avec leurs avertissements : compte Instagram, hashtag du thème,
// longueur, couleur absente. Renvoie { legende, couleur }.
export function legendeEtCouleur(
  { titre, candidatNom, score, theme, accroche, tient, credit, handlesInstagram, couleursCandidats },
  avertissements,
) {
  const compte = handleInstagram(candidatNom, handlesInstagram);
  if (!compte) {
    avertissements.push({
      cle: "légende",
      message: `Pas de compte Instagram connu pour ${candidatNom} (src/lib/handles-instagram.js) : nom écrit sans @.`,
    });
  }
  if (!hashtagTheme(theme)) {
    avertissements.push({ cle: "légende", message: `Thème « ${theme ?? ""} » sans hashtag (src/lib/handles-instagram.js) : hashtag thème omis.` });
  }
  const legende = legendeInstagram({ titre, candidatNom, score, theme, mention: compte ?? candidatNom, accroche, tient, credit });
  if (legende.length > LEGENDE_MAX) {
    avertissements.push({
      cle: "légende",
      fort: true,
      message: `${legende.length} caractères (${LEGENDE_MAX} au plus sur Instagram) : à raccourcir avant de publier.`,
    });
  }
  const couleur = themeCandidat({ candidatNom, score, ...(couleursCandidats ? { table: couleursCandidats } : {}) });
  if (!couleur) {
    avertissements.push({
      cle: "couleur",
      message: `Pas de couleur définie pour ${candidatNom} (src/lib/couleurs-candidats.js) : style neutre.`,
    });
  }
  return { legende, couleur };
}

// Image de thème de la couverture (bibliothèque src/lib/illustrations.js),
// commune aux deux carrousels : celle retenue à la génération du carrousel
// détaillé (contenuComplet.reseaux_recit.illustration) si elle est toujours
// dans la bibliothèque, sinon un tirage stable pour la fiche dans le thème
// (orienté par les mots-clés du modèle s'il y en a). Thème sans image : null
// et un avertissement. Renvoie l'illustration (avec son crédit visible
// éventuel) ou null. `demandee` : fichier voulu (bouton « Changer d'image »),
// pris s'il fait partie des images de la fiche.
export function illustrationCouverture({ theme, contenu, propositionId, demandee = null, liste = ILLUSTRATIONS }, avertissements) {
  const retenue = contenu?.reseaux_recit?.illustration;
  const voulue = demandee ? choisirIllustration({ theme, demandee, liste }).illustration : null;
  const deja = voulue?.fichier === demandee ? voulue : retenue ? liste.find((ill) => ill.fichier === retenue) : null;
  const { illustration, avertissement } = deja
    ? { illustration: deja, avertissement: null }
    : choisirIllustration({ theme, motsCles: contenu?.reseaux_recit?.illustration_mots_cles ?? [], alea: aleaFiche(`illustration-${propositionId}`), liste });
  if (avertissement) avertissements.push({ cle: "image de thème", message: avertissement });
  if (retenue && !deja) avertissements.push({ cle: "image de thème", message: `L’image retenue à la génération (${retenue}) n’est plus dans la bibliothèque : nouveau tirage.` });
  return illustration ? { ...illustration, creditVisible: creditVisible(illustration) } : null;
}

// --- Assemblage et contrôles -----------------------------------------------------

// Carrousel complet d'une fiche, avec ses avertissements (jamais bloquants).
// `donnees` :
//   propositionId, analyseId, titre (titreCarte), candidatNom, photoUrl,
//   theme (Proposition.theme), score (Analyse.scoreFaisabilite),
//   contenu (Analyse.contenuComplet), resumeBasique (version_basique.resume
//   ou null), mesureInitiale (Proposition.texteOriginal),
//   handlesInstagram, couleursCandidats (facultatifs, pour les tests).
// Renvoie { slides, legende, avertissements, version, couleur } ; `couleur` :
// thème du candidat (themeCandidat, src/lib/couleurs-candidats.js) ou null. Chaque slide :
//   { type, numero, total, fichier, libelle, ...contenu }.
export function controlerCarrousel(donnees) {
  const { propositionId, analyseId, candidatNom, photoUrl, theme, score, contenu, resumeBasique, mesureInitiale } = donnees;
  const avertissements = [];
  const reseaux = contenu?.reseaux ?? null;
  const titre = texteRepris(donnees.titre, "titre de la mesure", avertissements);

  const sautees = [];
  const illustration = illustrationCouverture({ theme, contenu, propositionId, liste: donnees.illustrations }, avertissements);
  const brutes = [
    { type: "couverture", titre, sousTitre: sousTitreCarte(candidatNom).replace(/\.$/, ""), theme: resolveTheme(theme), illustration },
    slideMesure({ resumeBasique, mesureInitiale }, avertissements),
    { type: "note", score: Number(score), scoreAffiche: scoreAffiche(score), palier: getScoreBadge(Number(score)).label },
    slideChiffre(reseaux?.chiffre, avertissements) ?? (sautees.push("chiffre"), null),
    (() => {
      const tient = slideTient(reseaux?.tient, avertissements);
      if (!tient) return sautees.push("tient"), null;
      // La condition la plus forte de ce_qui_la_ferait_tenir, en petit.
      return { ...tient, condition: conditionPrincipale(contenu?.ce_qui_la_ferait_tenir, avertissements) };
    })(),
    // Fin commune aux deux carrousels (même slide que la 8 du récit).
    { type: "fin", sources: sourcesPrincipales(contenu), credit: illustration?.creditVisible ?? null },
  ].filter(Boolean);

  const total = brutes.length;
  const slides = brutes.map((slide, index) => {
    const numero = index + 1;
    const { fichier, libelle } = TYPES_SLIDES[slide.type];
    return { ...slide, numero, total, fichier: `${String(numero).padStart(2, "0")}-${fichier}.png`, libelle };
  });

  for (const slide of slides) {
    if (slide.raccourci) {
      avertissements.push({
        cle: `slide ${slide.numero} (${slide.libelle})`,
        message: `${slide.raccourci} mots, au-delà de ${MOTS_MAX_SLIDE} : raccourci, l’analyse le garde.`,
      });
    }
  }
  const raisons = {
    chiffre: "pas de chiffre dans la fiche (reseaux.chiffre)",
    tient: "pas de points « tient / tient pas » dans la fiche (reseaux.tient)",
  };
  for (const type of sautees) {
    avertissements.push({
      cle: `slide « ${TYPES_SLIDES[type].libelle} »`,
      message: `Slide sautée : ${raisons[type]}. Le carrousel passe à ${total} slides.`,
    });
  }

  // Légende et couleur du candidat.
  const accroche = reseaux?.fil?.[0] ? texteRepris(accrocheDuFil(reseaux, candidatNom), "légende (accroche du tweet 1)", avertissements) : "";
  if (!accroche) {
    avertissements.push({ cle: "légende", message: "Pas d’accroche (tweet 1 absent) : la première ligne ne porte que le titre." });
  }
  const slideTientRetenue = slides.find((slide) => slide.type === "tient");
  const tient = slideTientRetenue ? { oui: slideTientRetenue.tient[0], non: slideTientRetenue.tientPas[0] } : null;
  const { legende, couleur } = legendeEtCouleur({ ...donnees, titre, accroche, tient, credit: creditLegende(illustration) }, avertissements);

  // Version des images, dans l'URL (comme les cartes X) : identifiant de
  // l'analyse + empreinte de tout ce que les slides affichent.
  const sujet = sujetCourt(titre);
  const version = `${analyseId}-${empreinte(JSON.stringify([candidatNom, slugCandidat({ nom: candidatNom, photoUrl }), couleur, sujet, slides]))}`;

  return { slides, legende, avertissements, version, couleur, sujet };
}

// Contrôle seul de la longueur d'une légende modifiée à la main (compteur de
// la page de partage).
export function legendeTropLongue(texte) {
  return String(texte ?? "").length > LEGENDE_MAX;
}

// URL d'une slide (route src/app/api/carrousel/[id]/route.js).
// `recit` : carrousel détaillé en 8 slides (?version=recit) ; avec
// `precedent`, sa version précédente (?version=recit-precedent), à comparer.
// `photo` : numéro de la photo du candidat sur la couverture du carrousel détaillé ;
// `image` : fichier de l'image de thème voulue (« Changer d'image »).
export function cheminSlide({ propositionId, numero, version, brouillon = false, recit = false, precedent = false, photo = null, image = null }) {
  const params = new URLSearchParams({ ...(recit ? { version: precedent ? "recit-precedent" : "recit" } : {}), slide: String(numero), v: version });
  if (brouillon) params.set("brouillon", "1");
  if (photo !== null && photo !== undefined) params.set("photo", String(photo));
  if (image) params.set("image", String(image));
  return `/api/carrousel/${propositionId}?${params}`;
}

// Nom de l'archive : carrousel-<id>-<slug du candidat>.zip.
export function nomArchiveCarrousel({ propositionId, candidatNom, photoUrl }) {
  return `carrousel-${propositionId}-${slugCandidat({ nom: candidatNom, photoUrl })}.zip`;
}
