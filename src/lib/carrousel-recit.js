import { getScoreBadge } from "./score.js";
import { empreinte, slugCandidat } from "./carte.js";
import { criteresPrincipaux } from "./criteresScore.js";
import { resolveTheme } from "./themes.js";
import { remplirTweet, valeursReseaux } from "./reseaux.js";
import { hashtagsLegende, illustrationCouverture, LEGENDE_MAX, scoreAffiche, sourcesPrincipales, sujetCourt, texteRepris } from "./carrousel.js";
import { handleInstagramVerifie } from "./handles-instagram.js";
import { CLES_CRITERES, controlerRecit, formatAncien, SOUS_TITRE_COUVERTURE } from "./recit.js";
import { fichePourRecit } from "./recit-generation.js";
import { couleurCarrousel, COULEUR_NEUTRE } from "./couleurs-carrousel.js";
import { creditLegende, creditVisible, illustrationsPourFiche } from "./illustrations.js";
import { choisirPhoto, creditsPhoto, PHOTOS_CANDIDATS, PHOTOS_MIN, photosDuCandidat } from "./photos-candidats.js";

// Carrousel détaillé en 8 slides (7 sans mesure comparable), sa légende, ses
// crédits et le tweet long, assemblés à partir de contenuComplet.reseaux_recit
// (écrit par Claude, voir src/lib/recit-generation.js) et de la fiche, selon
// docs/prompt-carrousel.md (qui fait foi). Écrits par le code : le sous-titre
// de la couverture, la note, le verdict, les sous-notes, la slide de fin, la
// couleur du candidat, les crédits photo, les hashtags et la mention @.
// Fonctions PURES, testées par scripts/recit.test.js et
// scripts/carrousel-detaille.test.js.

export const TYPES_SLIDES_RECIT = {
  couverture: { fichier: "couverture", libelle: "Couverture" },
  constat: { fichier: "constat-et-proposition", libelle: "Le constat, puis la proposition" },
  noteRecit: { fichier: "la-note", libelle: "La note" },
  effetsCourt: { fichier: "court-terme", libelle: "Court terme" },
  effetsLong: { fichier: "long-terme", libelle: "Long terme" },
  ailleurs: { fichier: "ailleurs-ou-avant", libelle: "Ailleurs ou avant" },
  avis: { fichier: "notre-avis", libelle: "Notre avis" },
  fin: { fichier: "fin", libelle: "Fin" },
};

export const HASHTAGS_MIN = 3;
export const HASHTAGS_MAX_RECIT = 5;

// Hashtags d'une légende (mots commençant par #).
export function hashtagsDe(legende) {
  return String(legende ?? "").match(/(^|\s)#[\p{L}\p{N}_]+/gu)?.map((h) => h.trim()) ?? [];
}

// Avertissement si le nombre de hashtags sort de 3 à 5, sinon null.
export function controleHashtags(legende) {
  const nombre = hashtagsDe(legende).length;
  return nombre < HASHTAGS_MIN || nombre > HASHTAGS_MAX_RECIT ? `${nombre} hashtag(s) dans la légende (${HASHTAGS_MIN} à ${HASHTAGS_MAX_RECIT} attendus).` : null;
}

// Légende Instagram (section 5 du prompt) : 3 courts paragraphes, l'appel à
// lire et améliorer l'analyse, la mention @ si le compte est vérifié, 3 à 5
// hashtags et les crédits photo.
export function legendeRecit({ legende, candidatNom, theme, mention, credits }) {
  const nom = (t) => remplirTweet(t, { NOM: candidatNom, CANDIDAT: candidatNom });
  return [
    nom(legende.question),
    nom(legende.avis),
    nom(legende.effet),
    "Lisez l’analyse complète et aidez-nous à l’améliorer sur notre site : lien en bio.",
    mention ? `La proposition de ${mention}.` : null,
    hashtagsLegende({ candidatNom, theme }).join(" "),
    credits.length ? credits.join("\n") : null,
  ]
    .filter(Boolean)
    .join("\n\n");
}

// Crédits photo.
//  - courts : en tout petit en bas de la couverture : la photo Commons du
//    candidat, plus l'image de thème si sa licence exige un crédit visible
//    (CC BY, CC BY-SA) ; jamais pour CC0, domaine public ou Pexels ;
//  - fin : les mêmes lignes sur la slide de fin ;
//  - complets : tous les crédits avec leurs liens (credits.txt, fin de la
//    légende Instagram).
// `photo` : photo Commons du candidat (src/lib/photos-candidats.js) ou null.
export function creditsPhotos({ illustration, photo }) {
  const courts = [];
  const complets = [];
  const credit = creditsPhoto(photo);
  if (credit) {
    courts.push(credit.court);
    complets.push(credit.complet);
  }
  const visible = creditVisible(illustration);
  if (visible) courts.push(visible);
  if (illustration) complets.push(creditLegende(illustration));
  return { courts, fin: courts, complets };
}

// Nom du candidat sur la couverture : le nom de famille (avec sa particule)
// ne se coupe pas d'une ligne à l'autre (« Dominique / de Villepin »).
export function nomInsecable(candidatNom) {
  const [prenom, ...reste] = String(candidatNom ?? "").trim().split(/\s+/);
  return reste.length ? `${prenom} ${reste.join(" ")}` : (prenom ?? "");
}

// Nom de l'archive : carrousel-<slug du candidat>-<thème>.zip.
export function nomArchiveRecit({ candidatNom, photoUrl, theme }) {
  const slugTheme = resolveTheme(theme) ?? "sans-theme";
  return `carrousel-${slugCandidat({ nom: candidatNom, photoUrl })}-${slugTheme}.zip`;
}

// `donnees` : comme controlerCarrousel (src/lib/carrousel.js), plus
// `precedent` (true : la version précédente, gardée sous
// reseaux_recit.precedent, pour comparer) et `photoDemandee` (numéro de la
// photo du candidat, bouton « Changer de photo »). Renvoie null si la fiche n'a pas encore de
// carrousel détaillé (ou pas de version précédente) ; sinon
// { slides, legende, credits, tweet, avertissements, version, couleur, sujet,
//   illustration, photo, photos, blocageArchive, controles } (avertissements : { cle, message, fort? } ;
// controles : ce que la check-list « À relire » coche d'elle-même).
export function carrouselRecit(donnees) {
  const { propositionId, analyseId, candidatNom, photoUrl, score, contenu, theme, precedent = false } = donnees;
  const stocke = precedent ? contenu?.reseaux_recit?.precedent : contenu?.reseaux_recit;
  if (!stocke) return null;
  const avertissements = [];
  const titre = texteRepris(donnees.titre, "titre de la mesure", avertissements);
  const sujet = titre.length <= 32 ? titre : sujetCourt(titre);
  const vide = (raison) => ({ slides: [], legende: "", credits: "", tweet: "", avertissements, version: `${analyseId}-vide`, couleur: null, sujet, illustration: null, controles: { ...raison } });

  if (formatAncien(stocke)) {
    avertissements.push({ cle: "carrousel détaillé", fort: true, message: "Carrousel généré avec l’ancien format (v5) : cliquez sur « Générer à nouveau » pour passer au nouveau prompt (constat puis proposition, notre avis)." });
    return vide({});
  }

  // Relecture du récit enregistré face à la fiche actuelle : ce qui serait
  // refusé à la génération devient un avertissement fort.
  const valeurs = valeursReseaux({ candidatNom, score, propositionId });
  const controle = controlerRecit(stocke, { ficheFinale: fichePourRecit(contenu), candidatNom, valeurs, score });
  for (const erreur of controle.erreurs) avertissements.push({ cle: "carrousel détaillé", fort: true, message: erreur });
  for (const message of controle.avertissements) avertissements.push({ cle: "carrousel détaillé", message });
  const recit = controle.recit;
  if (!recit) return vide({});

  const nom = (t) => remplirTweet(t, { NOM: candidatNom, CANDIDAT: candidatNom });

  // Couleur du candidat (src/lib/couleurs-carrousel.js).
  const couleurChoisie = couleurCarrousel(candidatNom, donnees.couleursCarrousel ? { table: donnees.couleursCarrousel } : {});
  if (!couleurChoisie) {
    avertissements.push({ cle: "couleur", fort: true, message: `Pas de couleur attribuée à ${candidatNom} (src/lib/couleurs-carrousel.js) : couleur neutre provisoire.` });
  }
  const couleur = couleurChoisie ?? COULEUR_NEUTRE;

  // Image de thème : celle retenue à la génération de cette version, sinon tirage.
  const illustration = illustrationCouverture(
    { theme, contenu: { reseaux_recit: { illustration: stocke.illustration, illustration_mots_cles: recit.illustration_mots_cles } }, propositionId, demandee: donnees.illustrationDemandee ?? null, liste: donnees.illustrations },
    avertissements,
  );
  // Photo du candidat (Wikimedia Commons) : celle demandée, sinon celle
  // retenue à la génération (hors des 2 derniers carrousels du candidat),
  // sinon un tirage stable pour cette version ; aucune photo : vignette actuelle.
  const slug = slugCandidat({ nom: candidatNom, photoUrl });
  const listePhotos = donnees.photos ?? PHOTOS_CANDIDATS;
  const photosCandidat = photosDuCandidat(slug, listePhotos);
  const photo = choisirPhoto({ slug, demandee: donnees.photoDemandee ?? null, retenue: stocke.photo ?? null, graine: `${propositionId}-${stocke.genereLe ?? ""}`, liste: listePhotos });
  if (photosCandidat.length === 0) {
    avertissements.push({ cle: "photo", message: `Aucune photo de ${candidatNom} dans la bibliothèque (src/lib/photos-candidats.js) : vignette actuelle sur la couverture. Les chercher : node scripts/chercher-photos-candidats.js ${slug}, puis /test/photos-candidats.` });
  } else if (photosCandidat.length < PHOTOS_MIN) {
    avertissements.push({ cle: "photo", message: `Seulement ${photosCandidat.length} photo(s) de ${candidatNom} (${PHOTOS_MIN} au moins) : la couverture changera peu d’un carrousel à l’autre.` });
  }
  const credits = creditsPhotos({ illustration, photo });
  // Contrôle bloquant : pas d'archive sans le crédit de chaque photo utilisée.
  const blocageArchive = photo && !creditsPhoto(photo) ? `Crédit manquant pour la photo ${photo.n} de ${candidatNom} (auteur ou licence) : pas d’archive.` : illustration && !illustration.auteur ? "Crédit manquant pour l’image de thème : pas d’archive." : null;
  if (blocageArchive) avertissements.push({ cle: "crédits", fort: true, message: blocageArchive });

  // Critères : notes du code (notation_detaillee), lignes du modèle.
  const notation = contenu?.notation_detaillee;
  const criteres = notation
    ? criteresPrincipaux(notation).map((critere, i) => ({ label: critere.label, note: critere.note, max: critere.max, ligne: nom(recit.note.criteres[CLES_CRITERES[i]] ?? "") }))
    : [];
  if (!notation) avertissements.push({ cle: "slide « La note »", message: "Pas de notation détaillée dans la fiche : sous-notes des critères absentes." });

  const effets = (liste) => liste.map((e) => ({ ...e, acteur: nom(e.acteur), texte: nom(e.texte) }));
  const brutes = [
    { type: "couverture", photo: photo ? { n: photo.n, fichier: photo.fichier } : null, theme: resolveTheme(theme), question: remplirTweet(recit.couverture.question, { NOM: nomInsecable(candidatNom), CANDIDAT: candidatNom }), sousTitre: SOUS_TITRE_COUVERTURE, illustration, credits: credits.courts },
    {
      type: "constat",
      titre: nom(recit.constat.titre),
      explication: nom(recit.constat.explication),
      chiffres: recit.constat.chiffres,
      proposition: nom(recit.constat.proposition),
      imprecisions: nom(recit.constat.imprecisions ?? ""),
      sources: recit.constat.sources,
      theme: resolveTheme(theme),
    },
    { type: "noteRecit", score: Number(score), scoreAffiche: scoreAffiche(score), palier: getScoreBadge(Number(score)).label, titre: nom(recit.note.titre), explication: nom(recit.note.explication), criteres },
    { type: "effetsCourt", onglet: "court", titre: nom(recit.court_terme.titre), effets: effets(recit.court_terme.effets) },
    { type: "effetsLong", onglet: "long", titre: nom(recit.long_terme.titre), effets: effets(recit.long_terme.effets) },
    recit.ailleurs
      ? { type: "ailleurs", titre: nom(recit.ailleurs.titre), mesures: recit.ailleurs.mesures.map((m) => ({ ...m, fait: nom(m.fait), resultat: nom(m.resultat) })), sources: recit.ailleurs.sources }
      : null,
    { type: "avis", avis: nom(recit.avis.avis), tient: recit.avis.tient.slice(0, 3).map(nom), coince: recit.avis.coince.slice(0, 3).map(nom) },
    { type: "fin", sources: sourcesPrincipales(contenu), credits: credits.fin },
  ].filter(Boolean);
  if (!recit.ailleurs) {
    avertissements.push({ cle: "slide « Ailleurs ou avant »", message: `Slide sautée : la fiche ne cite aucune mesure comparable. Le carrousel passe à ${brutes.length} slides.` });
  }

  const total = brutes.length;
  const slides = brutes.map((slide, index) => {
    const numero = index + 1;
    const { fichier, libelle } = TYPES_SLIDES_RECIT[slide.type];
    return { ...slide, numero, total, fichier: `${String(numero).padStart(2, "0")}-${fichier}.png`, libelle };
  });

  // Légende (section 5) et contrôle des hashtags.
  const mention = handleInstagramVerifie(candidatNom, donnees.handlesInstagram);
  if (!mention) avertissements.push({ cle: "légende", message: `Pas de compte Instagram vérifié pour ${candidatNom} (src/lib/handles-instagram.js, verifie: true) : pas de mention @.` });
  const legende = legendeRecit({ legende: recit.legende, candidatNom, theme, mention, credits: credits.complets });
  const alerteHashtags = controleHashtags(legende);
  if (alerteHashtags) avertissements.push({ cle: "légende", message: alerteHashtags });
  if (legende.length > LEGENDE_MAX) avertissements.push({ cle: "légende", fort: true, message: `${legende.length} caractères (${LEGENDE_MAX} au plus sur Instagram) : à raccourcir avant de publier.` });
  const creditsTexte = [`Carrousel Perlimpinpin · ${candidatNom} · ${titre}`, "", ...(credits.complets.length ? credits.complets : ["Aucune photo créditée."])].join("\n");

  // Ce que la check-list « À relire avant de publier » vérifie d'elle-même.
  const erreurSur = (motif) => controle.erreurs.some((e) => motif.test(e));
  const controles = {
    constatAvantProposition: !erreurSur(/^slide 2/),
    chiffresSources: !erreurSur(/^Nombre\(s\) absent/) && Boolean(recit.constat.sources) && (!recit.ailleurs || Boolean(recit.ailleurs.sources)),
    noteHorsCouverture: !erreurSur(/^couverture/),
    creditsPresents: !blocageArchive && (!photo || Boolean(creditsPhoto(photo))),
  };

  const tweet = remplirTweet(recit.tweet_assemble, valeurs);
  const version = `${analyseId}-${precedent ? "p" : "r"}-${empreinte(JSON.stringify([candidatNom, slugCandidat({ nom: candidatNom, photoUrl }), couleur, sujet, slides]))}`;
  return { slides, legende, credits: creditsTexte, tweet, avertissements, version, couleur, couleurAttribuee: Boolean(couleurChoisie), sujet, illustration, photo, photos: photosCandidat.map((p) => p.n), blocageArchive, controles, illustrations: illustrationsPourFiche(theme, donnees.illustrations ?? undefined).map((ill) => ill.fichier) };
}

// Slides d'un carrousel détaillé stocké, dans l'ordre : [{ type, numero, libelle }].
export function slidesDuRecit(recit) {
  const types = ["couverture", "constat", "noteRecit", "effetsCourt", "effetsLong", ...(recit?.ailleurs ? ["ailleurs"] : []), "avis", "fin"];
  return types.map((type, i) => ({ type, numero: i + 1, libelle: TYPES_SLIDES_RECIT[type].libelle }));
}

// Slide visée par une remarque ({ numero, libelle }), ou null pour « toutes »,
// la légende et le tweet long.
export function slideDeCible(recit, cible) {
  const slide = slidesDuRecit(recit).find((s) => s.type === cible);
  return slide ? { numero: slide.numero, libelle: slide.libelle } : null;
}

// Choix du menu « Slide visée » de la barre de remarques. La slide de fin,
// écrite par le code, n'y figure pas.
export function ciblesRemarques(recit) {
  return [
    { valeur: "toutes", libelle: "Toutes les slides" },
    ...slidesDuRecit(recit)
      .filter((s) => s.type !== "fin")
      .map((s) => ({ valeur: s.type, libelle: `Slide ${s.numero} · ${s.libelle}` })),
    { valeur: "legende", libelle: "La légende" },
    { valeur: "tweet", libelle: "Le tweet long" },
  ];
}

// Check-list « À relire avant de publier » (section 6 du prompt) : chaque
// point avec `auto` (true/false : coché ou non par le code), null (à cocher
// à la main) ou "couleur" (vérifié dans le navigateur, d'après les couleurs
// des 2 derniers carrousels publiés).
export function listeARelire({ controles = {}, debordements = [] }) {
  return [
    { cle: "constat", libelle: "Le constat vient avant la proposition, et le texte parle de sa proposition.", auto: controles.constatAvantProposition ?? false },
    { cle: "sources", libelle: "Chaque chiffre vient de la fiche et est sourcé.", auto: controles.chiffresSources ?? false },
    { cle: "note", libelle: "La note n’est pas sur la couverture.", auto: controles.noteHorsCouverture ?? false },
    { cle: "debordement", libelle: "Aucun texte ne déborde, aucun titre n’est mal coupé.", auto: debordements.length === 0 },
    { cle: "couleur", libelle: "La couleur est celle du candidat et diffère des 2 derniers carrousels.", auto: "couleur" },
    { cle: "credits", libelle: "Les photos sont créditées sur la couverture et dans credits.txt.", auto: controles.creditsPresents ?? false },
    { cle: "traitement", libelle: "Le traitement est le même que pour les autres candidats.", auto: null },
  ];
}
