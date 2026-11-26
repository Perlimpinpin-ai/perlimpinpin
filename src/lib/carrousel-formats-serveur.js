import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { deflateRawSync, inflateRawSync } from "node:zlib";
import { slugCandidat } from "./carte.js";
import { resolveTheme } from "./themes.js";
import { couleursCandidat } from "./charte-rs.js";
import { assemblerProgramme, assemblerThematique, controlerProgramme, controlerThematique, messageProgramme, messageThematique, selectionProgramme, selectionThematique } from "./carrousel-formats.js";
import { debordementsFormat } from "./mise-en-page-formats.js";
import { mesureurCarrousel } from "./metriques-polices.js";
import { choisirPhoto, creditsPhoto } from "./photos-candidats.js";
import { cheminVignetteNb, existe, imagePrete, CHEMIN_GRAIN } from "./images-carrousel.js";

// Carrousels « analyse de programme » et « thématique », côté serveur :
// lecture des fiches PUBLIÉES (lecture seule, jamais d'écriture en base),
// état du carrousel gardé dans l'URL (sélection + réponse du modèle,
// compressée), assemblage, mise en page mesurée, images. Démonstration
// locale (« demo », hors production) : fiches de test et réponses simulées
// de data/demo-carrousel/charte-rs/, sans base ni appel payant.

export const DEMO_FORMATS = process.env.NODE_ENV !== "production";

// --- État dans l'URL -------------------------------------------------------------------

export function encoderEtat(etat) {
  return deflateRawSync(Buffer.from(JSON.stringify(etat))).toString("base64url");
}

export function decoderEtat(texte) {
  try {
    return JSON.parse(inflateRawSync(Buffer.from(String(texte ?? ""), "base64url")).toString("utf8"));
  } catch {
    return null;
  }
}

// --- Lecture des fiches publiées ----------------------------------------------------------

function ficheDe(proposition) {
  const analyse = proposition.analyses[0];
  return { id: proposition.id, titre: proposition.titre ?? proposition.texteOriginal?.slice(0, 80) ?? "", theme: proposition.theme, score: analyse.scoreFaisabilite, contenu: analyse.contenuComplet ?? {} };
}

const SELECTION = {
  id: true,
  titre: true,
  texteOriginal: true,
  theme: true,
  candidat: { select: { nom: true, photoUrl: true } },
  analyses: { where: { statut: "publie" }, orderBy: { createdAt: "desc" }, take: 1, select: { scoreFaisabilite: true, contenuComplet: true } },
};

// Candidat (par son slug) et ses fiches publiées.
export async function fichesDuCandidat(prisma, slug) {
  const candidats = await prisma.candidat.findMany({ select: { id: true, nom: true, photoUrl: true } });
  const candidat = candidats.find((c) => slugCandidat(c) === slug);
  if (!candidat) return null;
  const propositions = await prisma.proposition.findMany({ where: { candidatId: candidat.id }, select: SELECTION });
  return { candidat, fiches: propositions.filter((p) => p.analyses.length).map(ficheDe) };
}

// Tous les candidats et leurs fiches publiées sur un thème.
export async function fichesDuTheme(prisma, theme) {
  const slug = resolveTheme(theme);
  const candidats = await prisma.candidat.findMany({ select: { id: true, nom: true, photoUrl: true } });
  const propositions = await prisma.proposition.findMany({ where: { theme: slug }, select: { ...SELECTION, candidatId: true } });
  return candidats.map((c) => ({ ...c, fiches: propositions.filter((p) => p.candidatId === c.id && p.analyses.length).map(ficheDe) }));
}

// --- Démonstration locale --------------------------------------------------------------

function lireJson(chemin) {
  return JSON.parse(readFileSync(join(process.cwd(), chemin), "utf8"));
}

function ficheLocale({ fichier, id, theme = null }) {
  const brut = lireJson(fichier);
  const contenu = brut.fiche_complete ?? brut;
  return { id, titre: brut.titre_fiche ?? contenu.mesure_reformulee?.synthese, theme: brut.theme ?? theme, score: contenu.notation_detaillee?.score_total, contenu };
}

export function demoProgramme() {
  if (!DEMO_FORMATS) return null;
  const d = lireJson("data/demo-carrousel/charte-rs/programme-riner.json");
  return { candidat: { nom: d.candidat, photoUrl: null }, fiches: d.fiches.map(ficheLocale), ordres: Object.fromEntries(d.fiches.map((f) => [f.id, f.ordre])), reponse: d.reponse };
}

export function demoThematique() {
  if (!DEMO_FORMATS) return null;
  const d = lireJson("data/demo-carrousel/charte-rs/thematique-retraites.json");
  return { theme: d.theme, candidats: d.candidats.map((c) => ({ nom: c.nom, photoUrl: null, fiche: c.fiche ? ficheLocale(c.fiche) : null })), reponse: d.reponse };
}

// --- Photos ----------------------------------------------------------------------------

// Photo d'un candidat : photo Commons validée (bibliothèque cochée sur
// /test/photos-candidats) si elle existe, avec son crédit ; sinon la vignette
// du site. Jamais de photo générée ni retouchée.
export function photoCandidat(candidat) {
  const slug = slugCandidat(candidat);
  const photo = choisirPhoto({ slug, graine: "format" });
  if (photo && existe(photo.fichier)) {
    const credit = creditsPhoto(photo);
    return { chemin: photo.fichier, credit: credit?.court ?? null, complet: credit?.complet ?? null, sansCredit: !credit };
  }
  return { chemin: cheminVignetteNb(candidat), credit: null, complet: null, sansCredit: false };
}

function credits(candidats) {
  const photos = candidats.map((c) => ({ nom: c.nom, ...photoCandidat(c) }));
  const sans = photos.filter((p) => p.sansCredit).map((p) => p.nom);
  return {
    courts: [...new Set(photos.map((p) => p.credit).filter(Boolean))],
    blocage: sans.length ? `Crédit manquant pour la photo de ${sans.join(", ")} (auteur ou licence) : pas d’archive.` : null,
  };
}

// --- Assemblage ------------------------------------------------------------------------

// Carrousel « programme » à partir de l'état ({ ordres, reponse }) et des fiches lues.
export function carrouselProgramme({ candidat, fiches, ordres, reponse, pictos }) {
  const selection = selectionProgramme(fiches, ordres);
  if (selection.erreurs.length) return { erreurs: selection.erreurs, slides: [] };
  const controle = controlerProgramme(reponse, { candidatNom: candidat.nom, fiches: selection.fiches });
  if (!controle.valide) return { erreurs: controle.erreurs, slides: [] };
  const c = credits([candidat]);
  const resultat = assemblerProgramme({ candidatNom: candidat.nom, photoUrl: candidat.photoUrl, fiches: selection.fiches, programme: controle.programme, credits: c.courts, blocageCredits: c.blocage, ...(pictos ? { pictos } : {}) });
  return finaliser(resultat, controle.avertissements);
}

export function carrouselThematique({ theme, candidats, reponse, couleursThemes, pictos }) {
  const selection = selectionThematique(theme, candidats);
  if (selection.erreurs.length) return { erreurs: selection.erreurs, slides: [] };
  const controle = controlerThematique(reponse, { theme, candidats: selection.candidats });
  if (!controle.valide) return { erreurs: controle.erreurs, slides: [] };
  const c = credits(selection.candidats);
  const resultat = assemblerThematique({ theme, candidats: selection.candidats, thematique: controle.thematique, credits: c.courts, blocageCredits: c.blocage, ...(couleursThemes ? { couleursThemes } : {}), ...(pictos ? { pictos } : {}) });
  return finaliser(resultat, controle.avertissements);
}

function finaliser(resultat, avertissementsModele) {
  if (!resultat.slides.length) return { erreurs: [resultat.blocage], slides: [] };
  const debordements = debordementsFormat(resultat.slides, mesureurCarrousel());
  const avertissements = [...resultat.avertissements, ...avertissementsModele.map((message) => ({ cle: "textes", message })), ...debordements.map((d) => ({ cle: `slide ${d.numero}`, fort: true, message: `Texte trop long : ${d.bloc}, ${d.raison}. On ne réduit pas la police : raccourcir ce texte.` }))];
  const blocage = resultat.blocage ?? (debordements.length ? `Texte trop long sur la slide ${[...new Set(debordements.map((d) => d.numero))].join(", ")} : pas d’archive. Régénérez pour raccourcir.` : null);
  return { ...resultat, controles: { ...resultat.controles, grain: existe(CHEMIN_GRAIN) }, avertissements, debordements, blocage, erreurs: [] };
}

// Images d'une slide : grain, portrait(s) (data URI).
export async function imagesFormat(slide, { candidat = null, candidats = [] } = {}) {
  const grain = await imagePrete(CHEMIN_GRAIN);
  if (candidat) return { grain, portrait: await imagePrete(photoCandidat(candidat).chemin) };
  const besoin = slide.type === "couverture" ? candidats : slide.type === "candidat" ? candidats.filter((c) => c.nom === slide.nom) : [];
  const portraits = Object.fromEntries(await Promise.all(besoin.map(async (c) => [c.nom, await imagePrete(photoCandidat(c).chemin)])));
  return { grain, portraits };
}

// --- Génération (un seul appel Claude, deux essais au plus) --------------------------------

export async function lirePromptFormat(format) {
  return readFile(join(process.cwd(), "data", format === "programme" ? "prompt-programme.md" : "prompt-thematique.md"), "utf-8");
}

// `appeler(message)` → réponse brute ; `analyser(reponse)` → objet JSON.
// Renvoie { reponse | null, erreurs, avertissements, usage }.
export async function genererFormatCore({ format, prompt, donnees, appeler, analyser, tentatives = 2 }) {
  const base = format === "programme" ? messageProgramme(prompt, donnees) : messageThematique(prompt, donnees);
  const controler = (raw) => (format === "programme" ? controlerProgramme(raw, donnees) : controlerThematique(raw, donnees));
  let erreurs = [];
  let derniere = null;
  const usages = [];
  for (let essai = 1; essai <= tentatives; essai++) {
    const message = essai === 1 || !derniere ? base : `${base}\n\nATTENTION : ta réponse précédente a été refusée :\n${erreurs.map((e) => `- ${e}`).join("\n")}\n\nTa réponse précédente :\n${JSON.stringify(derniere, null, 2)}`;
    try {
      const reponse = await appeler(message);
      if (reponse?.usage) usages.push(reponse.usage);
      const brut = analyser(reponse);
      const controle = controler(brut);
      derniere = brut;
      erreurs = controle.erreurs;
      if (controle.valide) return { reponse: brut, erreurs: [], avertissements: controle.avertissements, usages };
    } catch (error) {
      erreurs = [error.message];
    }
  }
  return { reponse: null, erreurs, avertissements: [], usages };
}

// Candidat au registre ? (avant tout appel payant)
export function candidatsHorsRegistre(noms) {
  return noms.filter((n) => !couleursCandidat(n));
}

// --- Contexte d'une page ou d'une image ------------------------------------------------------

// Programme : { candidat, fiches } d'un candidat (slug), ou la démonstration (« demo »).
export async function contexteProgramme(prisma, slug) {
  if (slug === "demo") {
    const d = demoProgramme();
    return d ? { candidat: d.candidat, fiches: d.fiches, demo: d } : null;
  }
  return fichesDuCandidat(prisma, slug);
}

// Thématique : candidats et leurs fiches publiées sur le thème, ou la démonstration.
export async function contexteThematique(prisma, theme) {
  if (theme === "demo") {
    const d = demoThematique();
    if (!d) return null;
    return { theme: d.theme, candidats: d.candidats.map((c) => ({ nom: c.nom, photoUrl: null, fiches: c.fiche ? [c.fiche] : [] })), demo: d };
  }
  const slug = resolveTheme(theme);
  if (!slug) return null;
  return { theme: slug, candidats: await fichesDuTheme(prisma, slug) };
}

// Candidats retenus d'après le choix ({ nom: id de fiche | null }).
export function candidatsChoisis(contexte, choix) {
  return contexte.candidats
    .filter((c) => Object.hasOwn(choix ?? {}, c.nom))
    .map((c) => ({ nom: c.nom, photoUrl: c.photoUrl ?? null, fiche: c.fiches.find((f) => String(f.id) === String(choix[c.nom])) ?? null }));
}

// Carrousel à partir de l'état de l'URL (null si l'état est illisible).
export function carrouselDepuisEtat(format, contexte, etat) {
  if (!etat?.reponse) return null;
  if (format === "programme") return carrouselProgramme({ candidat: contexte.candidat, fiches: contexte.fiches, ordres: etat.ordres ?? {}, reponse: etat.reponse, pictos: contexte.pictos });
  return carrouselThematique({ theme: contexte.theme, candidats: candidatsChoisis(contexte, etat.choix), reponse: etat.reponse, couleursThemes: contexte.couleursThemes, pictos: contexte.pictos });
}
