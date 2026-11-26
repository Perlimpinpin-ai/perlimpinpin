import { criteresPrincipaux } from "./criteresScore.js";
import { formatScore } from "./score.js";
import { nombresHorsFiche } from "./nombres-fiche.js";
import { palierEcrit, phrasesTropLongues, tournuresIA } from "./recit.js";
import { sansGras } from "./texte-gras.js";
import { sourcesPrincipales } from "./carrousel.js";
import { fichePourRecit } from "./recit-generation.js";
import { slugCandidat } from "./carte.js";
import { controleRegistre, couleursCandidat, couleursTheme, NOMS_COURTS_THEMES, PICTOS_THEMES, verdictDe } from "./charte-rs.js";
import { contientPrenom, ecartsEquite, estRubrique, exemplesPourPrompt, FORMULES, moyenneNotes, nomDeFamille, ordreAlphabetique, restesDeMaquette } from "./ecriture-charte.js";
import { getThemeBySlug, resolveTheme } from "./themes.js";

// Carrousels « analyse de programme » (10 slides : 6 mesures d'un candidat)
// et « thématique » (un thème, 4 à 8 candidats), charte RS pages 15 et 16.
// Un seul appel Claude par carrousel pour tous les textes (prompts
// data/prompt-programme.md et data/prompt-thematique.md) ; les notes, la
// moyenne, les verdicts, l'ordre, les couleurs, la couverture et la fin sont
// écrits par le code. Ce fichier : sélection, message au modèle, contrôle de
// sa réponse, assemblage des slides. Fonctions PURES, testées par
// scripts/charte-rs.test.js.
//
// Une fiche ici : { id, titre, theme, score, contenu (fiche finale), candidatNom, photoUrl }.
// Pas de fiche publiée = pas de note : seules les fiches publiées sont proposées.

export const NB_MESURES_PROGRAMME = 6;
export const CANDIDATS_MIN = 4;
export const CANDIDATS_MAX = 8;
export const SOUS_TITRE_PROGRAMME = "Lesquelles tiennent la route ?";
export const SOUS_TITRE_THEMATIQUE = "Qu’est-ce qui est vraiment faisable ?";
export const SANS_PROPOSITION = "Pas de proposition publiée sur ce thème à ce jour";

// Une note réelle : un nombre (null, vide ou texte → pas de note).
const aUneNote = (score) => score !== null && score !== undefined && score !== "" && Number.isFinite(Number(score));

function texte(valeur) {
  return typeof valeur === "string" ? valeur.replace(/\s+/g, " ").trim() : "";
}

export function nomCourtTheme(theme) {
  const slug = resolveTheme(theme);
  return NOMS_COURTS_THEMES[slug] ?? getThemeBySlug(slug)?.shortName ?? getThemeBySlug(slug)?.name ?? String(theme ?? "");
}

// --- Sélection -------------------------------------------------------------------------

// Programme : exactement 6 fiches publiées du candidat, sur 6 thèmes
// différents, rangées par le champ de tri saisi à la main (1 à 6, sans
// doublon) : le code ne devine pas l'ordre. Renvoie { fiches (ordonnées), erreurs }.
export function selectionProgramme(fiches, ordres) {
  const erreurs = [];
  const choisies = fiches.filter((f) => ordres[f.id] !== undefined && ordres[f.id] !== "" && ordres[f.id] !== null);
  if (choisies.length !== NB_MESURES_PROGRAMME) erreurs.push(`${choisies.length} fiche(s) choisie(s) : ${NB_MESURES_PROGRAMME} attendues.`);
  const sansNote = choisies.filter((f) => !aUneNote(f.score));
  if (sansNote.length) erreurs.push(`Pas d’analyse publiée, pas de note : ${sansNote.map((f) => f.titre).join(", ")}.`);
  const themes = choisies.map((f) => resolveTheme(f.theme) ?? f.theme);
  const doublons = [...new Set(themes.filter((t, i) => themes.indexOf(t) !== i))];
  if (doublons.length) erreurs.push(`Thème(s) en double : ${doublons.map(nomCourtTheme).join(", ")} (6 thèmes différents).`);
  const rangs = choisies.map((f) => Number(ordres[f.id]));
  const attendus = Array.from({ length: NB_MESURES_PROGRAMME }, (_, i) => i + 1);
  if (choisies.length === NB_MESURES_PROGRAMME && attendus.some((r) => !rangs.includes(r))) erreurs.push("Champ de tri : chaque rang de 1 à 6 une seule fois (l’ordre où le candidat met ses mesures en avant).");
  return { fiches: [...choisies].sort((a, b) => Number(ordres[a.id]) - Number(ordres[b.id])), erreurs };
}

// Thématique : 4 à 8 candidats, chacun avec au plus une fiche publiée sur le
// thème (ou aucune). Renvoie { candidats (ordre alphabétique), erreurs }.
// `candidats` : [{ nom, photoUrl, fiche | null }].
export function selectionThematique(theme, candidats) {
  const erreurs = [];
  if (candidats.length < CANDIDATS_MIN || candidats.length > CANDIDATS_MAX) erreurs.push(`${candidats.length} candidat(s) : ${CANDIDATS_MIN} à ${CANDIDATS_MAX} attendus.`);
  const slug = resolveTheme(theme);
  for (const c of candidats) {
    if (c.fiche && (resolveTheme(c.fiche.theme) ?? c.fiche.theme) !== slug) erreurs.push(`${c.nom} : la fiche « ${c.fiche.titre} » n’est pas sur le thème ${nomCourtTheme(theme)}.`);
    if (c.fiche && !aUneNote(c.fiche.score)) erreurs.push(`${c.nom} : pas d’analyse publiée, pas de note.`);
  }
  if (!candidats.some((c) => c.fiche)) erreurs.push("Aucun candidat n’a de fiche publiée sur ce thème.");
  return { candidats: ordreAlphabetique(candidats), erreurs };
}

// --- Message au modèle ------------------------------------------------------------------

// Fiche réduite envoyée au modèle : sans la note (le code l'écrit).
export function ficheReduite(f) {
  const { notation_detaillee: _n, analyse_par_criteres: _a, ...reste } = fichePourRecit(f.contenu);
  return { titre: f.titre, theme: nomCourtTheme(f.theme), ...reste };
}

function blocRegles(prompt) {
  return String(prompt ?? "").replace(/\r\n/g, "\n").replace("{EXEMPLES_TITRES}", exemplesPourPrompt()).trim();
}

export function messageProgramme(prompt, { candidatNom, fiches }) {
  const liste = fiches.map((f, i) => `MESURE ${i + 1} (${nomCourtTheme(f.theme)}) :\n${JSON.stringify(ficheReduite(f), null, 2)}`).join("\n\n");
  return `${blocRegles(prompt)}\n\nCANDIDAT : ${candidatNom} (nom de famille : ${nomDeFamille(candidatNom)})\n\nLES 6 FICHES, DANS L'ORDRE OÙ LE CANDIDAT LES MET EN AVANT :\n\n${liste}`;
}

export function messageThematique(prompt, { theme, candidats }) {
  const avec = candidats.filter((c) => c.fiche);
  const liste = avec.map((c) => `CANDIDAT : ${c.nom}\n${JSON.stringify(ficheReduite(c.fiche), null, 2)}`).join("\n\n");
  const sans = candidats.filter((c) => !c.fiche).map((c) => c.nom);
  return `${blocRegles(prompt)}\n\nTHÈME : ${nomCourtTheme(theme)}\nCANDIDATS AVEC UNE FICHE (ordre alphabétique, à garder) : ${avec.map((c) => c.nom).join(", ")}\nCANDIDATS SANS PROPOSITION PUBLIÉE (n'écris rien pour eux) : ${sans.join(", ") || "aucun"}\n\n${liste}`;
}

// --- Contrôles communs --------------------------------------------------------------------

// Contrôles d'un texte du modèle : refus (erreurs) pour un nombre absent de
// sa fiche, un tiret cadratin, une note ou un niveau du barème, un reste de
// maquette, un titre de rubrique ; avertissements pour les phrases trop
// longues et les tournures « IA ».
function controlerTexte({ libelle, t, fiche, titre = false, erreurs, avertissements, phrases = true }) {
  if (!t) return;
  const nus = sansGras(t);
  const hors = nombresHorsFiche([nus], fiche);
  if (hors.length) erreurs.push(`${libelle} : nombre(s) absent(s) de la fiche : ${hors.join(", ")}.`);
  if (t.includes("—")) erreurs.push(`${libelle} : tiret cadratin (interdit).`);
  if (/\d+(?:[,.]\d+)?\s*(?:\/|sur)\s*100\b/i.test(t)) erreurs.push(`${libelle} : note écrite par le modèle (le code l’ajoute).`);
  const palier = palierEcrit(nus);
  if (palier) erreurs.push(`${libelle} : niveau « ${palier} » écrit par le modèle (le code l’ajoute).`);
  const restes = restesDeMaquette(t);
  if (restes.length) erreurs.push(`${libelle} : reste de maquette (${restes.join(", ")}).`);
  if (titre && estRubrique(t)) erreurs.push(`${libelle} : « ${t} » est un intertitre de rubrique : chaque titre apporte un fait, un chiffre ou une conséquence.`);
  if (phrases) for (const { mots } of phrasesTropLongues(t)) avertissements.push(`${libelle} : phrase de ${mots} mots (25 au plus).`);
  for (const tournure of tournuresIA(t)) avertissements.push(`${libelle} : tournure « ${tournure} » qui sonne « IA ».`);
}

function unePhrase(libelle, t, avertissements) {
  if (t && t.split(/(?<=[.!?…])\s+(?=\p{Lu})/u).length > 1) avertissements.push(`${libelle} : une seule phrase attendue.`);
}

const PARTIES_LEGENDE = ["question", "avis", "effet"];

// --- Programme : contrôle de la réponse -------------------------------------------------

// Réponse attendue : { ensemble: { titre }, mesures: [{ titre, proposition,
// tient, coince, source }] × 6 (dans l'ordre donné), avis: { avis, solide,
// fragile }, legende: { question, avis, effet } }.
export function controlerProgramme(raw, { candidatNom, fiches }) {
  const erreurs = [];
  const avertissements = [];
  if (!raw || typeof raw !== "object") return { valide: false, erreurs: ["JSON invalide : un objet est attendu."], avertissements, programme: null };
  const mesures = (Array.isArray(raw.mesures) ? raw.mesures : []).map((m) => ({ titre: texte(m?.titre), proposition: texte(m?.proposition), tient: texte(m?.tient), coince: texte(m?.coince), source: texte(m?.source) }));
  const programme = {
    ensemble: { titre: texte(raw.ensemble?.titre) },
    mesures,
    avis: { avis: texte(raw.avis?.avis).replace(/^notre avis\s*:\s*/i, ""), solide: texte(raw.avis?.solide), fragile: texte(raw.avis?.fragile) },
    legende: Object.fromEntries(PARTIES_LEGENDE.map((p) => [p, texte(raw.legende?.[p])])),
  };
  const manquants = [
    ["ensemble.titre", programme.ensemble.titre],
    ["mesures", mesures.length === fiches.length ? "ok" : ""],
    ...mesures.flatMap((m, i) => ["titre", "proposition", "tient", "coince"].map((c) => [`mesures.${i}.${c}`, m[c]])),
    ["avis.avis", programme.avis.avis],
    ["avis.solide", programme.avis.solide],
    ["avis.fragile", programme.avis.fragile],
    ...PARTIES_LEGENDE.map((p) => [`legende.${p}`, programme.legende[p]]),
  ].filter(([, v]) => !v);
  if (manquants.length) return { valide: false, erreurs: [`JSON invalide : champ(s) manquant(s) ou vide(s) : ${manquants.map(([c]) => c).join(", ")}${mesures.length !== fiches.length ? ` (${mesures.length} mesures pour ${fiches.length} fiches)` : ""}.`], avertissements, programme: null };

  const toutes = fiches.map((f) => fichePourRecit(f.contenu));
  const c = (libelle, t, fiche, options = {}) => controlerTexte({ libelle, t, fiche, erreurs, avertissements, ...options });
  c("vue d’ensemble (titre)", programme.ensemble.titre, toutes, { titre: true });
  mesures.forEach((m, i) => {
    const fiche = toutes[i];
    c(`mesure ${i + 1} (titre)`, m.titre, fiche, { titre: true });
    c(`mesure ${i + 1} (proposition)`, m.proposition, fiche);
    c(`mesure ${i + 1} (ce qui tient)`, m.tient, fiche);
    c(`mesure ${i + 1} (ce qui coince)`, m.coince, fiche);
    c(`mesure ${i + 1} (source)`, m.source, fiche, { phrases: false });
    for (const champ of ["proposition", "tient", "coince"]) unePhrase(`mesure ${i + 1} (${champ})`, m[champ], avertissements);
    if (!m.source) avertissements.push(`mesure ${i + 1} : pas de source (la première source de la fiche sera affichée).`);
  });
  c("notre avis", programme.avis.avis, toutes, { titre: true });
  c("notre avis (la plus solide)", programme.avis.solide, toutes);
  c("notre avis (la plus fragile)", programme.avis.fragile, toutes);
  for (const p of PARTIES_LEGENDE) c(`légende (${p})`, programme.legende[p], toutes);
  const tous = [programme.ensemble.titre, ...mesures.flatMap((m) => [m.titre, m.proposition, m.tient, m.coince]), programme.avis.avis];
  if (tous.some((t) => contientPrenom(t, candidatNom) && !t.includes(candidatNom))) avertissements.push("Prénom du candidat employé seul : préférer le nom de famille.");
  return { valide: erreurs.length === 0, erreurs, avertissements, programme };
}

// --- Thématique : contrôle de la réponse -------------------------------------------------

// Réponse attendue : { constat: { titre, chiffres: [{ valeur, detail }] × 3,
// sources }, candidats: [{ nom, titre, proposition, regard, cout | null }]
// (ceux qui ont une fiche, ordre alphabétique), avis: { avis }, legende }.
export function controlerThematique(raw, { theme, candidats }) {
  const erreurs = [];
  const avertissements = [];
  if (!raw || typeof raw !== "object") return { valide: false, erreurs: ["JSON invalide : un objet est attendu."], avertissements, thematique: null };
  const avec = candidats.filter((x) => x.fiche);
  const cle = (n) => String(n ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const parNom = new Map((Array.isArray(raw.candidats) ? raw.candidats : []).map((x) => [cle(x?.nom), x]));
  const thematique = {
    constat: { titre: texte(raw.constat?.titre), chiffres: (Array.isArray(raw.constat?.chiffres) ? raw.constat.chiffres : []).slice(0, 3).map((ch) => ({ valeur: texte(ch?.valeur), detail: texte(ch?.detail) })), sources: texte(raw.constat?.sources) },
    candidats: avec.map((x) => {
      const r = parNom.get(cle(x.nom)) ?? {};
      return { nom: x.nom, titre: texte(r.titre), proposition: texte(r.proposition), regard: texte(r.regard), cout: texte(r.cout) || null };
    }),
    avis: { avis: texte(raw.avis?.avis).replace(/^notre avis\s*:\s*/i, "") },
    legende: Object.fromEntries(PARTIES_LEGENDE.map((p) => [p, texte(raw.legende?.[p])])),
  };
  const intrus = [...parNom.keys()].filter((n) => !avec.some((x) => cle(x.nom) === n));
  if (intrus.length) erreurs.push(`Texte écrit pour un candidat sans fiche sur ce thème (ou inconnu) : ${intrus.join(", ")}. Pas d’analyse, pas de texte.`);
  const manquants = [
    ["constat.titre", thematique.constat.titre],
    ["constat.chiffres", thematique.constat.chiffres.length ? "ok" : ""],
    ...thematique.candidats.flatMap((x) => ["titre", "proposition", "regard"].map((ch) => [`candidats.${x.nom}.${ch}`, x[ch]])),
    ["avis.avis", thematique.avis.avis],
    ...PARTIES_LEGENDE.map((p) => [`legende.${p}`, thematique.legende[p]]),
  ].filter(([, v]) => !v);
  if (manquants.length) return { valide: false, erreurs: [...erreurs, `JSON invalide : champ(s) manquant(s) ou vide(s) : ${manquants.map(([ch]) => ch).join(", ")}.`], avertissements, thematique: null };

  const toutes = avec.map((x) => fichePourRecit(x.fiche.contenu));
  const c = (libelle, t, fiche, options = {}) => controlerTexte({ libelle, t, fiche, erreurs, avertissements, ...options });
  c("constat (titre)", thematique.constat.titre, toutes, { titre: true });
  thematique.constat.chiffres.forEach((ch, i) => {
    c(`constat (chiffre ${i + 1})`, ch.valeur, toutes, { phrases: false });
    c(`constat (chiffre ${i + 1}, détail)`, ch.detail, toutes, { phrases: false });
  });
  if (thematique.constat.chiffres.length !== 3) avertissements.push(`constat : ${thematique.constat.chiffres.length} chiffre(s) clé(s), 3 attendus.`);
  if (!/\d/.test(thematique.constat.titre)) avertissements.push(`constat (titre) : « ${thematique.constat.titre} » sans chiffre : un titre de constat chiffré informe mieux.`);
  if (!thematique.constat.sources) avertissements.push("constat : pas de source.");
  thematique.candidats.forEach((x, i) => {
    const fiche = toutes[i];
    c(`${x.nom} (titre)`, x.titre, fiche, { titre: true });
    c(`${x.nom} (sa proposition)`, x.proposition, fiche);
    c(`${x.nom} (notre regard)`, x.regard, fiche);
    unePhrase(`${x.nom} (notre regard)`, x.regard, avertissements);
    if (x.cout) {
      c(`${x.nom} (coût)`, x.cout, fiche, { phrases: false });
      if (!/\d/.test(x.cout) && !/non chiffr/i.test(x.cout)) avertissements.push(`${x.nom} (coût) : « ${x.cout} » sans montant.`);
    }
  });
  c("comparatif (notre avis)", thematique.avis.avis, toutes, { titre: true });
  for (const p of PARTIES_LEGENDE) c(`légende (${p})`, thematique.legende[p], toutes);
  // Équité : même nombre de champs, longueur comparable.
  const avecCout = thematique.candidats.filter((x) => x.cout).length;
  for (const e of ecartsEquite(Object.fromEntries(thematique.candidats.map((x) => [x.nom, `${x.titre} ${x.proposition} ${x.regard}`])))) {
    avertissements.push(`Équité : ${e.nom}, ${e.mots} mots contre ${e.moyenne} en moyenne (écart de plus de 20 %).`);
  }
  if (avecCout > 0 && avecCout < thematique.candidats.length) avertissements.push(`Équité : coût estimé pour ${avecCout} candidat(s) sur ${thematique.candidats.length} (affiché seulement s’il est dans la fiche).`);
  return { valide: erreurs.length === 0, erreurs, avertissements, thematique };
}

// --- Assemblage ----------------------------------------------------------------------------

const TYPES = {
  couverture: "couverture",
  ensemble: "vue-d-ensemble",
  mesure: "mesure",
  avisProgramme: "notre-avis",
  constatTheme: "le-constat",
  candidat: "candidat",
  comparatif: "comparatif",
  fin: "fin",
};

function numeroter(brutes) {
  return brutes.map((s, i) => ({ ...s, numero: i + 1, total: brutes.length, fichier: `${String(i + 1).padStart(2, "0")}-${s.suffixe ?? TYPES[s.type]}.png` }));
}

function sourceFiche(f) {
  return sourcesPrincipales(f.contenu)[0] ?? "";
}

// Carrousel « analyse de programme ». Renvoie { slides, couleur, legende,
// credits, moyenne, avertissements, blocage, controles } ou { blocage } si le
// candidat n'est pas au registre. `programme` : réponse contrôlée.
// `credits` : crédits des photos Commons utilisées ; `blocageCredits` : photo
// utilisée sans auteur ni licence (contrôle bloquant), sinon null.
export function assemblerProgramme({ candidatNom, photoUrl = null, fiches, programme, pictos = PICTOS_THEMES, credits = [], blocageCredits = null }) {
  const couleur = couleursCandidat(candidatNom);
  if (!couleur) return { slides: [], blocage: controleRegistre(candidatNom), avertissements: [] };
  const avertissements = [];
  const notes = fiches.map((f) => Number(f.score));
  const moyenne = moyenneNotes(notes);
  const mesures = fiches.map((f, i) => {
    const note = formatScore(Number(f.score));
    const theme = resolveTheme(f.theme);
    return { rang: i + 1, ficheId: f.id, theme, themeNom: nomCourtTheme(f.theme), picto: pictos[theme] ?? null, note, verdict: verdictDe(note), titreFiche: f.titre, ...programme.mesures[i], source: programme.mesures[i].source || sourceFiche(f) };
  });
  // La plus solide et la plus fragile : par la note (à égalité, la première dans l'ordre du candidat).
  const solide = mesures.reduce((a, b) => (b.note > a.note ? b : a));
  const fragile = mesures.reduce((a, b) => (b.note < a.note ? b : a));
  const famille = nomDeFamille(candidatNom);
  const piedTexte = `${candidatNom} · Programme`;
  const brutes = [
    { type: "couverture", titre: `On a noté ==${NB_MESURES_PROGRAMME} mesures== de ${famille.replace(/\s+/g, " ")}.`, sousTitre: SOUS_TITRE_PROGRAMME, cartes: mesures.map((m) => ({ theme: m.theme, themeNom: m.themeNom, picto: m.picto })), credits },
    { type: "ensemble", moyenne, verdict: verdictDe(moyenne), titre: programme.ensemble.titre, mesures: mesures.map(({ rang, theme, themeNom, picto, note, verdict, titre }) => ({ rang, theme, themeNom, picto, note, verdict, titre })) },
    ...mesures.map((m) => ({ type: "mesure", suffixe: `mesure-${m.rang}`, ...m, total6: NB_MESURES_PROGRAMME })),
    { type: "avisProgramme", avis: programme.avis.avis, solide: { ...solide, phrase: programme.avis.solide }, fragile: { ...fragile, phrase: programme.avis.fragile } },
    { type: "fin", pluriel: true, sources: [...new Set(fiches.flatMap((f) => sourcesPrincipales(f.contenu).slice(0, 1)))].slice(0, 3), credits },
  ];
  const slides = numeroter(brutes).map((s) => ({ ...s, pied: piedTexte }));
  const sommes = fiches.map((f) => {
    const n = f.contenu?.notation_detaillee;
    return n ? Math.round(criteresPrincipaux(n).reduce((t, c) => t + (Number(c.note) || 0), 0)) === Math.round(Number(f.score)) : true;
  });
  const controles = {
    chiffresSources: true,
    sommeSousNotes: sommes.every(Boolean),
    noteHorsCouverture: !/\d+\s*\/\s*100/.test(brutes[0].titre),
    constatAvantProposition: true,
    titresInformatifs: true,
    nomFamilleCouverture: !contientPrenom(brutes[0].titre, candidatNom),
    insecables: true,
    couleurRegistre: true,
    creditsPresents: !blocageCredits,
    notesReelles: fiches.every((f) => aUneNote(f.score)),
    moyenneExacte: moyenne === moyenneNotes(slides.filter((s) => s.type === "mesure").map((s) => s.note)),
    sansResteMaquette: true,
    finConforme: true,
  };
  if (!controles.sommeSousNotes) avertissements.push({ cle: "notes", fort: true, message: "La somme des sous-notes d’une fiche n’égale pas sa note." });
  if (blocageCredits) avertissements.push({ cle: "crédits", fort: true, message: blocageCredits });
  else if (!credits.length) avertissements.push({ cle: "photo", message: "Aucune photo Commons validée : vignettes du site sur les slides (photos à cocher sur /test/photos-candidats)." });
  const legende = [programme.legende.question, programme.legende.avis, programme.legende.effet, "Lisez les analyses complètes et aidez-nous à les améliorer sur notre site : lien en bio.", `#Présidentielle2027 #${famille.replace(/[^\p{L}]/gu, "")} #Perlimpinpin`, credits.join("\n")]
    .filter(Boolean)
    .join("\n\n");
  return {
    slides,
    couleur,
    moyenne,
    legende,
    credits: [`Carrousel Perlimpinpin · ${candidatNom} · 6 mesures`, "", ...(credits.length ? credits : ["Aucune photo créditée."])].join("\n"),
    avertissements,
    blocage: blocageCredits,
    controles,
    archive: `programme-${slugCandidat({ nom: candidatNom, photoUrl })}.zip`,
  };
}

// Carrousel « thématique ». `candidats` : sélection en ordre alphabétique
// ({ nom, photoUrl, fiche | null }) ; `thematique` : réponse contrôlée.
export function assemblerThematique({ theme, candidats, thematique, couleursThemes, pictos = PICTOS_THEMES, credits = [], blocageCredits = null }) {
  const slug = resolveTheme(theme);
  const couleur = couleursTheme(slug, couleursThemes);
  const nomTheme = nomCourtTheme(slug);
  if (!couleur) return { slides: [], blocage: `Pas de couleur validée pour le thème ${nomTheme} (COULEURS_THEMES de src/lib/charte-rs.js) : génération refusée.`, avertissements: [] };
  const avertissements = [];
  const absents = candidats.map((c) => c.nom).filter((n) => !couleursCandidat(n));
  if (absents.length) return { slides: [], blocage: absents.map((n) => controleRegistre(n)).join(" "), avertissements };
  const ordonnes = ordreAlphabetique(candidats);
  const parNom = new Map(thematique.candidats.map((x) => [x.nom, x]));
  const fichesCandidats = ordonnes.map((c) => {
    const couleurC = couleursCandidat(c.nom);
    if (!c.fiche) return { nom: c.nom, photoUrl: c.photoUrl ?? null, couleur: couleurC, sansProposition: true };
    const note = formatScore(Number(c.fiche.score));
    const t = parNom.get(c.nom);
    return { nom: c.nom, photoUrl: c.photoUrl ?? null, couleur: couleurC, note, verdict: verdictDe(note), titre: t.titre, proposition: t.proposition, regard: t.regard, cout: t.cout, source: sourceFiche(c.fiche) };
  });
  const classement = fichesCandidats.filter((c) => !c.sansProposition).sort((a, b) => b.note - a.note || nomDeFamille(a.nom).localeCompare(nomDeFamille(b.nom), "fr"));
  const piedTexte = `${nomTheme} · Les candidats`;
  const brutes = [
    { type: "couverture", titre: `${nomTheme} : ce que proposent les ==candidats.==`, sousTitre: SOUS_TITRE_THEMATIQUE, picto: pictos[slug] ?? null, medaillons: fichesCandidats.map(({ nom, photoUrl, couleur: cc }) => ({ nom, famille: nomDeFamille(nom), photoUrl, couleur: cc })), credits },
    { type: "constatTheme", ...thematique.constat },
    ...fichesCandidats.map((c, i) => ({ type: "candidat", suffixe: `candidat-${i + 1}`, ...c })),
    { type: "comparatif", avis: thematique.avis.avis, classement: classement.map(({ nom, note, verdict, couleur: cc }) => ({ nom, note, verdict, couleur: cc })) },
    { type: "fin", pluriel: true, sources: [...new Set(ordonnes.filter((c) => c.fiche).flatMap((c) => sourcesPrincipales(c.fiche.contenu).slice(0, 1)))].slice(0, 3), credits },
  ];
  const slides = numeroter(brutes).map((s) => ({ ...s, pied: piedTexte }));
  const ordreSlides = slides.filter((s) => s.type === "candidat").map((s) => s.nom);
  const controles = {
    chiffresSources: Boolean(thematique.constat.sources),
    sommeSousNotes: true,
    noteHorsCouverture: true,
    constatAvantProposition: true,
    titresInformatifs: true,
    nomFamilleCouverture: true,
    insecables: true,
    couleurRegistre: true,
    creditsPresents: !blocageCredits,
    notesReelles: fichesCandidats.every((c) => c.sansProposition || Number.isFinite(c.note)),
    ordreAlphabetique: ordreSlides.join("|") === ordreAlphabetique(ordreSlides, (n) => n).join("|"),
    sansResteMaquette: true,
    finConforme: true,
  };
  if (blocageCredits) avertissements.push({ cle: "crédits", fort: true, message: blocageCredits });
  else if (!credits.length) avertissements.push({ cle: "photo", message: "Aucune photo Commons validée : vignettes du site sur les slides (photos à cocher sur /test/photos-candidats)." });
  const legende = [thematique.legende.question, thematique.legende.avis, thematique.legende.effet, "Lisez les analyses complètes et aidez-nous à les améliorer sur notre site : lien en bio.", `#Présidentielle2027 #${nomTheme.normalize("NFD").replace(/[^\p{L}]/gu, "")} #Perlimpinpin`, credits.join("\n")]
    .filter(Boolean)
    .join("\n\n");
  return {
    slides,
    couleur,
    legende,
    credits: [`Carrousel Perlimpinpin · ${nomTheme} · ${ordonnes.length} candidats`, "", ...(credits.length ? credits : ["Aucune photo créditée."])].join("\n"),
    avertissements,
    blocage: blocageCredits,
    controles,
    archive: `thematique-${slug}.zip`,
  };
}

export { FORMULES };
