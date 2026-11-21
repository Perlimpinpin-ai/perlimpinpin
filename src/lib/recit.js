import { getScoreBands } from "./score.js";
import { nombresHorsFiche } from "./nombres-fiche.js";
import { longueurX, mentionneCandidat, nombreDeMots, remplirTweet } from "./reseaux.js";

// Carrousel « récit » (8 slides) et tweet long d'une fiche, écrits par Claude
// à la demande (bouton « Générer le récit » de /test/reseaux/<id>, ou
// scripts/recit.js) avec le prompt data/prompt-recit.md, en un seul appel.
// Rangés dans contenuComplet.reseaux_recit. Ce fichier : le contrôle de la
// réponse du modèle (controlerRecit), l'assemblage du tweet long et le
// stockage. Fonctions PURES, testées par scripts/recit.test.js.
//
// Le modèle n'écrit ni score, ni niveau, ni pastille de note, ni lien, ni
// compte X : le code les ajoute (src/lib/score.js, marqueurs de src/lib/reseaux.js).

export const MOTS_MAX_CARTE = 35;
export const CARTES_MAX = 3;
export const TWEET_LONG_MIN = 800;
export const TWEET_LONG_MAX = 1500;
// Au-delà de cette longueur d'URL, le lien « Ouvrir dans X » risque d'être
// tronqué par le navigateur ou par X : la page conseille « Copier ».
export const URL_INTENTION_MAX = 2000;

// Liste fermée des questions de la couverture et des pastilles des cartes.
export const QUESTIONS_COUVERTURE = ["Est-ce tenable ?", "Est-ce réaliste ?", "Est-ce finançable ?", "Est-ce efficace ?", "Est-ce applicable ?"];
export const PASTILLES = ["positif", "négatif", "débattu", "incertain"];
// Les 5 critères du barème (src/lib/criteresScore.js) : une ligne du modèle par critère.
export const CLES_CRITERES = ["operationnalite_moyens", "efficacite", "effets_rebonds_externalites", "degre_preparation", "alignement_logique"];
const PARTIES_TWEET = ["accroche", "promesse", "exemple", "hic", "tient", "appel"];

function texte(valeur) {
  return typeof valeur === "string" ? valeur.replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, " ").trim() : "";
}

function sansAccents(t) {
  return String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// Tweet long assemblé, AVEC ses marqueurs (remplis à l'affichage) : les
// paragraphes du modèle, puis la ligne de note et le lien, écrits par le code.
export function assemblerTweetRecit(tweet) {
  return [
    tweet.accroche,
    tweet.promesse,
    tweet.exemple,
    tweet.hic,
    tweet.tient,
    "Note : {PASTILLE} {SCORE}/100 {APPRECIATION}",
    tweet.appel,
    "Analyse complète 👇 {LIEN}",
  ]
    .filter(Boolean)
    .join("\n\n");
}

// Libellés du barème (src/lib/score.js), cherchés comme mots entiers.
function palierEcrit(t) {
  const sans = t.toLowerCase();
  return getScoreBands()
    .map((bande) => bande.label)
    .find((label) => new RegExp(`(^|[^\\p{L}])${label.toLowerCase()}($|[^\\p{L}])`, "u").test(sans));
}

// Cartes { titre, texte, pastille } normalisées (3 au plus).
function cartes(liste, cle, avertissements) {
  const brutes = Array.isArray(liste) ? liste : [];
  if (brutes.length > CARTES_MAX) avertissements.push(`${cle} : ${brutes.length} cartes, seules les ${CARTES_MAX} premières sont gardées.`);
  return brutes.slice(0, CARTES_MAX).map((carte, i) => {
    const pastille = texte(carte?.pastille).toLowerCase();
    if (!PASTILLES.includes(pastille)) avertissements.push(`${cle} ${i + 1} : pastille « ${pastille || "(absente)"} » hors liste, « incertain » retenu.`);
    return { titre: texte(carte?.titre), texte: texte(carte?.texte), pastille: PASTILLES.includes(pastille) ? pastille : "incertain" };
  });
}

// Contrôle de la réponse du modèle. Refus (erreurs) SEULEMENT pour : JSON
// invalide (structure ou champ manquant), nombre absent de la fiche, tiret
// cadratin, score ou niveau écrit par le modèle, pays ou année d'un précédent
// absents de la fiche. Tout le reste est un avertissement.
//   raw : objet proposé par le modèle (ou récit déjà stocké, pour le relire) ;
//   ficheFinale : fiche envoyée au modèle (référence des nombres et des précédents) ;
//   valeurs : valeurs des marqueurs (valeursReseaux), pour mesurer le tweet.
// Renvoie { valide, erreurs, avertissements, recit } ; recit : réponse
// normalisée (textes nettoyés, tweet assemblé), null si la structure est invalide.
export function controlerRecit(raw, { ficheFinale, candidatNom, valeurs }) {
  const erreurs = [];
  const avertissements = [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { valide: false, erreurs: ["JSON invalide : un objet est attendu."], avertissements, recit: null };
  }

  const c = raw.couverture ?? {};
  const k = raw.concretement ?? {};
  const n = raw.note ?? {};
  const t = raw.tient ?? {};
  const tuile = (cle) => ({ valeur: texte(k.tuiles?.[cle]?.valeur), detail: texte(k.tuiles?.[cle]?.detail) });
  const recit = {
    couverture: { mesure: texte(c.mesure), chiffre_cle: texte(c.chiffre_cle), question: texte(c.question) },
    concretement: {
      titre: texte(k.titre),
      texte: texte(k.texte),
      tuiles: { aujourdhui: tuile("aujourdhui"), propose: tuile("propose"), ecart: tuile("ecart"), concernes: tuile("concernes") },
      sources: texte(k.sources),
    },
    note: {
      titre: texte(n.titre),
      explication: texte(n.explication),
      criteres: Object.fromEntries(CLES_CRITERES.map((cle) => [cle, texte(n.criteres?.[cle])])),
    },
    court_terme: { titre: texte(raw.court_terme?.titre), cartes: cartes(raw.court_terme?.cartes, "court terme, carte", avertissements) },
    long_terme: { titre: texte(raw.long_terme?.titre), cartes: cartes(raw.long_terme?.cartes, "long terme, carte", avertissements) },
    ailleurs: null,
    tient: {
      tient: (Array.isArray(t.tient) ? t.tient : []).map(texte).filter(Boolean),
      coince: (Array.isArray(t.coince) ? t.coince : []).map(texte).filter(Boolean),
    },
    legende_accroche: texte(raw.legende_accroche),
    tweet: Object.fromEntries(PARTIES_TWEET.map((partie) => [partie, texte(raw.tweet?.[partie])])),
  };
  if (raw.ailleurs && typeof raw.ailleurs === "object" && Array.isArray(raw.ailleurs.precedents) && raw.ailleurs.precedents.length > 0) {
    if (raw.ailleurs.precedents.length > 2) avertissements.push(`ailleurs : ${raw.ailleurs.precedents.length} précédents, seuls les 2 premiers sont gardés.`);
    recit.ailleurs = {
      titre: texte(raw.ailleurs.titre),
      precedents: raw.ailleurs.precedents.slice(0, 2).map((p, i) => {
        const pastille = texte(p?.pastille).toLowerCase();
        if (!PASTILLES.includes(pastille)) avertissements.push(`ailleurs ${i + 1} : pastille « ${pastille || "(absente)"} » hors liste, « incertain » retenu.`);
        return {
          pays: texte(p?.pays),
          annee: texte(String(p?.annee ?? "")),
          fait: texte(p?.fait),
          resultat: texte(p?.resultat),
          pastille: PASTILLES.includes(pastille) ? pastille : "incertain",
        };
      }),
      sources: texte(raw.ailleurs.sources),
    };
  }

  // Structure (JSON invalide si un champ attendu manque).
  const manquants = [
    ["couverture.mesure", recit.couverture.mesure],
    ["couverture.chiffre_cle", recit.couverture.chiffre_cle],
    ["concretement.titre", recit.concretement.titre],
    ["concretement.texte", recit.concretement.texte],
    ...["aujourdhui", "propose", "ecart", "concernes"].map((cle) => [`concretement.tuiles.${cle}.valeur`, recit.concretement.tuiles[cle].valeur]),
    ["note.titre", recit.note.titre],
    ["note.explication", recit.note.explication],
    ...CLES_CRITERES.map((cle) => [`note.criteres.${cle}`, recit.note.criteres[cle]]),
    ["court_terme.titre", recit.court_terme.titre],
    ["court_terme.cartes", recit.court_terme.cartes.length ? "ok" : ""],
    ["long_terme.titre", recit.long_terme.titre],
    ["long_terme.cartes", recit.long_terme.cartes.length ? "ok" : ""],
    ["tient.tient", recit.tient.tient.length ? "ok" : ""],
    ["tient.coince", recit.tient.coince.length ? "ok" : ""],
    ["legende_accroche", recit.legende_accroche],
    ...PARTIES_TWEET.map((partie) => [`tweet.${partie}`, recit.tweet[partie]]),
    ...[...recit.court_terme.cartes, ...recit.long_terme.cartes].flatMap((carte, i) => [[`carte ${i + 1}.texte`, carte.texte]]),
    ...(recit.ailleurs?.precedents ?? []).flatMap((p, i) => [
      [`ailleurs.precedents.${i}.pays`, p.pays],
      [`ailleurs.precedents.${i}.fait`, p.fait],
    ]),
  ]
    .filter(([, valeur]) => !valeur)
    .map(([chemin]) => chemin);
  if (manquants.length > 0) {
    return { valide: false, erreurs: [`JSON invalide : champ(s) manquant(s) ou vide(s) : ${manquants.join(", ")}.`], avertissements, recit: null };
  }
  recit.tweet_assemble = assemblerTweetRecit(recit.tweet);

  // Tous les textes écrits par le modèle, avec leur libellé.
  const textes = [
    ["couverture (mesure)", recit.couverture.mesure],
    ["couverture (chiffre clé)", recit.couverture.chiffre_cle],
    ["concrètement (titre)", recit.concretement.titre],
    ["concrètement (texte)", recit.concretement.texte],
    ...Object.entries(recit.concretement.tuiles).flatMap(([cle, { valeur, detail }]) => [
      [`concrètement (tuile ${cle})`, valeur],
      [`concrètement (tuile ${cle}, détail)`, detail],
    ]),
    ["concrètement (sources)", recit.concretement.sources],
    ["note (titre)", recit.note.titre],
    ["note (explication)", recit.note.explication],
    ...CLES_CRITERES.map((cle) => [`note (critère ${cle})`, recit.note.criteres[cle]]),
    ...["court_terme", "long_terme"].flatMap((partie) => [
      [`${partie} (titre)`, recit[partie].titre],
      ...recit[partie].cartes.flatMap((carte, i) => [
        [`${partie}, carte ${i + 1} (titre)`, carte.titre],
        [`${partie}, carte ${i + 1}`, carte.texte],
      ]),
    ]),
    ...(recit.ailleurs
      ? [
          ["ailleurs (titre)", recit.ailleurs.titre],
          ["ailleurs (sources)", recit.ailleurs.sources],
          ...recit.ailleurs.precedents.flatMap((p, i) => [
            [`ailleurs ${i + 1} (fait)`, p.fait],
            [`ailleurs ${i + 1} (résultat)`, p.resultat],
          ]),
        ]
      : []),
    ...recit.tient.tient.map((point, i) => [`ce qui tient ${i + 1}`, point]),
    ...recit.tient.coince.map((point, i) => [`ce qui coince ${i + 1}`, point]),
    ["légende (accroche)", recit.legende_accroche],
    ...PARTIES_TWEET.map((partie) => [`tweet long (${partie})`, recit.tweet[partie]]),
  ];

  // Refus.
  const horsFiche = nombresHorsFiche(
    [...textes.map(([, t2]) => t2.replace(/\{[A-Z]+\}/g, "")), ...(recit.ailleurs?.precedents ?? []).map((p) => p.annee)],
    ficheFinale,
  );
  if (horsFiche.length > 0) erreurs.push(`Nombre(s) absent(s) de la fiche : ${horsFiche.join(", ")}.`);
  for (const [libelle, t2] of textes) {
    if (t2.includes("—")) erreurs.push(`${libelle} : tiret cadratin (interdit).`);
    if (/\d+(?:[,.]\d+)?\s*(?:\/|sur)\s*100\b/i.test(t2) || /\{(SCORE|APPRECIATION|PASTILLE)\}/.test(t2) || /[🔴🟠🟡🟢]/u.test(t2)) {
      erreurs.push(`${libelle} : score ou pastille de note écrits par le modèle (le code les ajoute).`);
    }
    const palier = palierEcrit(t2);
    if (palier) erreurs.push(`${libelle} : niveau « ${palier} » écrit par le modèle (le code l’ajoute).`);
  }
  // Précédents : pays et année doivent figurer dans la fiche.
  const ficheTexte = sansAccents(JSON.stringify(ficheFinale ?? {}));
  for (const [i, p] of (recit.ailleurs?.precedents ?? []).entries()) {
    if (!ficheTexte.includes(sansAccents(p.pays))) erreurs.push(`ailleurs ${i + 1} : pays « ${p.pays} » absent de la fiche (jamais de précédent ajouté).`);
    if (p.annee && !ficheTexte.includes(sansAccents(p.annee))) erreurs.push(`ailleurs ${i + 1} : année « ${p.annee} » absente de la fiche.`);
  }

  // Avertissements.
  if (!QUESTIONS_COUVERTURE.includes(recit.couverture.question)) {
    avertissements.push(`couverture : question « ${recit.couverture.question || "(absente)"} » hors liste, « ${QUESTIONS_COUVERTURE[0]} » retenue.`);
    recit.couverture.question = QUESTIONS_COUVERTURE[0];
  }
  if (!recit.couverture.mesure.includes(recit.couverture.chiffre_cle)) {
    avertissements.push(`couverture : le chiffre clé « ${recit.couverture.chiffre_cle} » n’apparaît pas tel quel dans la mesure, il ne sera pas surligné.`);
  }
  for (const [libelle, t2] of textes.filter(([l]) => !l.startsWith("tweet") && !l.startsWith("légende"))) {
    const mots = nombreDeMots(t2);
    if (mots > MOTS_MAX_CARTE) avertissements.push(`${libelle} : ${mots} mots (${MOTS_MAX_CARTE} au plus).`);
  }
  for (const [cote, points] of [["ce qui tient", recit.tient.tient], ["ce qui coince", recit.tient.coince]]) {
    if (points.length > 3) avertissements.push(`${cote} : ${points.length} puces, seules les 3 premières sont affichées.`);
  }
  if (!mentionneCandidat(recit.tweet.promesse, candidatNom)) avertissements.push("tweet long (promesse) : le candidat n’est pas nommé.");
  for (const [libelle, t2] of textes) {
    if (/(^|\s)@\w/.test(t2)) avertissements.push(`${libelle} : compte écrit à la main (@…) au lieu de {CANDIDAT}.`);
  }
  if (valeurs) {
    const longueur = longueurX(remplirTweet(recit.tweet_assemble, valeurs));
    if (longueur < TWEET_LONG_MIN || longueur > TWEET_LONG_MAX) {
      avertissements.push(`tweet long : ${longueur} caractères (${TWEET_LONG_MIN} à ${TWEET_LONG_MAX} visés).`);
    }
  }

  return { valide: erreurs.length === 0, erreurs, avertissements, recit };
}

// Objet rangé dans contenuComplet.reseaux_recit.
export function recitPourStockage(recit, { modele, genereLe = new Date().toISOString() } = {}) {
  return { ...recit, genereLe, ...(modele ? { modele } : {}) };
}

// contenuComplet après écriture : seule la clé reseaux_recit change ; l'ancien
// récit (s'il y en avait un) y est gardé sous `precedent`, sans remonter plus loin.
export function contenuAvecRecit(contenu, recit) {
  const base = contenu ?? {};
  const ancien = base.reseaux_recit ? { ...base.reseaux_recit } : null;
  if (ancien) delete ancien.precedent;
  return { ...base, reseaux_recit: { ...recit, ...(ancien ? { precedent: ancien } : {}) } };
}
