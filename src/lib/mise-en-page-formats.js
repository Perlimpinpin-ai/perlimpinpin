import { bloc, blocCouverture, controleTitre, controleZones, empiler, avisMinuscule, hTexte, miseEnPageFin, HAUT_ZONE, HAUTEUR_ZONE, LARGEUR, LARGEUR_UTILE, STYLES, ZONE_PIED } from "./mise-en-page-carrousel.js";

// Mise en page des carrousels « analyse de programme » et « thématique »
// (charte RS, pages 15 et 16), calculée AVANT le rendu avec la largeur réelle
// des polices, comme src/lib/mise-en-page-carrousel.js : tailles fixes, titres
// équilibrés, zones réservées (pied de page, bande). Un texte qui y entre est
// un débordement nommé, avec les champs du modèle à raccourcir (on ne réduit
// jamais la police). Rendu : src/components/carrousels/CarrouselProgramme.js
// et CarrouselThematique.js. Fonctions PURES.

export const GEO = {
  // Couvertures
  couvTitreHaut: 190,
  couvTitreLargeur: LARGEUR - 2 * 84,
  photo: { x: 330, y: 560, largeur: 420, hauteur: 520 },
  carte: { largeur: 236, hauteur: 150 },
  medaillon: 190,
  // Slides de contenu
  ligneEnsemble: 92,
  ecartEnsemble: 10,
  scoreEnsemble: 150,
  enteteMesure: 56,
  carteNote: 160,
  enteteCarte: 44,
  bandeau: 330,
};

// Cartes en arc autour de la photo (programme) : 3 à gauche, 3 à droite.
export function positionsCartes() {
  const { largeur, hauteur } = GEO.carte;
  const ys = [600, 790, 980];
  const decalages = [36, 0, 36];
  return [
    ...ys.map((y, i) => ({ x: 44 + decalages[i], y })),
    ...ys.map((y, i) => ({ x: LARGEUR - 44 - largeur - decalages[i], y })),
  ].map((p) => ({ ...p, largeur, hauteur }));
}

// Médaillons de la couverture thématique : 1 ou 2 rangées centrées.
export function positionsMedaillons(n) {
  const d = GEO.medaillon;
  const parRangee = n <= 4 ? n : Math.ceil(n / 2);
  const rangees = n <= 4 ? [n] : [parRangee, n - parRangee];
  const pas = 230;
  return rangees.flatMap((nb, r) => {
    const debut = (LARGEUR - (nb - 1) * pas - d) / 2;
    return Array.from({ length: nb }, (_, i) => ({ x: Math.round(debut + i * pas), y: (n <= 4 ? 800 : 700) + r * 270, d }));
  });
}

const titreBloc = (t, m) => bloc(t, STYLES.titre, LARGEUR_UTILE, m, { equilibre: true });
const courant = (t, m, largeur = LARGEUR_UTILE) => bloc(t, STYLES.courant, largeur, m);
const source = (t, m) => (t ? bloc(`Source : ${t}`, STYLES.sources, LARGEUR_UTILE, m, { gras: false }) : null);
const INTERIEUR = LARGEUR_UTILE - 2 * 30;
const hCarte = (b) => 2 * 22 + GEO.enteteCarte + 6 + hTexte(b);

function couverture(slide, m) {
  const d = [];
  const titre = blocCouverture(slide.titre, m, { largeur: GEO.couvTitreLargeur });
  const sousTitre = bloc(slide.sousTitre, STYLES.sousTitre, GEO.couvTitreLargeur, m, { equilibre: true, gras: false });
  controleTitre(titre, "titre de couverture", d, 3);
  const credits = slide.credits?.length ? bloc(slide.credits.join(" · "), STYLES.creditsCouverture, LARGEUR - 2 * 84, m, { gras: false }) : null;
  return { titre, sousTitre, credits, hauteur: 0, debordements: d };
}

// --- Programme ------------------------------------------------------------------------

function ensemble(slide, m) {
  const d = [];
  const titre = titreBloc(slide.titre, m);
  controleTitre(titre, "titre de la vue d’ensemble", d);
  const { hauteur, boites } = empiler([
    ["étiquette", 40],
    ["moyenne", GEO.scoreEnsemble, 18],
    ["titre", hTexte(titre), 10],
    ...slide.mesures.map((x, i) => [`mesure ${x.rang}`, GEO.ligneEnsemble, i ? GEO.ecartEnsemble : 26]),
  ]);
  controleZones(boites, [ZONE_PIED], ["ensemble.titre"], d);
  return { titre, hauteur, boites, debordements: d };
}

function mesure(slide, m) {
  const d = [];
  const i = slide.rang - 1;
  const titre = titreBloc(slide.titre, m);
  controleTitre(titre, "titre de la mesure", d);
  const proposition = courant(slide.proposition, m);
  const tient = courant(slide.tient, m, INTERIEUR);
  const coince = courant(slide.coince, m, INTERIEUR);
  const src = source(slide.source, m);
  const { hauteur, boites } = empiler([
    ["en-tête", GEO.enteteMesure],
    ["titre", hTexte(titre), 18],
    ["« La proposition »", 34, 20],
    ["proposition", hTexte(proposition), 6],
    ["note", GEO.carteNote, 22],
    ["ce qui tient", hCarte(tient), 18],
    ["ce qui coince", hCarte(coince), 14],
    ["source", src ? hTexte(src) : 0, 14],
  ]);
  controleZones(boites, [ZONE_PIED], [`mesures.${i}.proposition`, `mesures.${i}.tient`, `mesures.${i}.coince`, `mesures.${i}.titre`], d);
  return { titre, proposition, tient, coince, source: src, hTient: hCarte(tient), hCoince: hCarte(coince), hauteur, boites, debordements: d };
}

function avisProgramme(slide, m) {
  const d = [];
  const avis = bloc(`Notre avis : ${avisMinuscule(slide.avis)}`, STYLES.titreAvis, LARGEUR_UTILE, m, { equilibre: true });
  controleTitre(avis, "notre avis", d, 4);
  const largeurPhrase = LARGEUR_UTILE - 2 * 30;
  const solide = courant(slide.solide.phrase, m, largeurPhrase);
  const fragile = courant(slide.fragile.phrase, m, largeurPhrase);
  const hMise = (b) => 2 * 22 + 44 + 8 + 44 + 6 + hTexte(b);
  const { hauteur, boites } = empiler([
    ["notre avis", hTexte(avis)],
    ["la plus solide", hMise(solide), 28],
    ["la plus fragile", hMise(fragile), 16],
    ["légende des verdicts", 40 + 3 * 34, 26],
  ]);
  controleZones(boites, [ZONE_PIED], ["avis.solide", "avis.fragile", "avis.avis"], d);
  return { avis, solide, fragile, hSolide: hMise(solide), hFragile: hMise(fragile), hauteur, boites, debordements: d };
}

// --- Thématique -------------------------------------------------------------------------

function constatTheme(slide, m) {
  const d = [];
  const titre = titreBloc(slide.titre, m);
  controleTitre(titre, "titre du constat", d);
  const largeurTuile = (LARGEUR_UTILE - 2 * 16) / 3;
  const tuiles = slide.chiffres.map((ch, i) => {
    const valeur = m(ch.valeur, STYLES.valeur.taille, STYLES.valeur.police, STYLES.valeur.espacement);
    if (valeur > largeurTuile - 40) d.push({ bloc: `chiffre ${i + 1} (« ${ch.valeur} »)`, raison: "valeur plus large que la tuile", champs: [`constat.chiffres.${i}.valeur`] });
    return { ...ch, detail: bloc(ch.detail, STYLES.petit, largeurTuile - 40, m, { gras: false }) };
  });
  const hTuile = Math.max(170, ...tuiles.map((t) => 24 + 62 + 8 + hTexte(t.detail) + 24));
  const src = source(slide.sources, m);
  const { hauteur, boites } = empiler([
    ["étiquette", 40],
    ["titre", hTexte(titre), 22],
    ["chiffres clés", hTuile, 30],
    ["source", src ? hTexte(src) : 0, 18],
  ]);
  controleZones(boites, [ZONE_PIED], ["constat.titre", "constat.sources"], d);
  return { titre, tuiles, hTuile, largeurTuile, source: src, hauteur, boites, debordements: d };
}

function candidat(slide, m) {
  const d = [];
  const haut = GEO.bandeau + 36;
  if (slide.sansProposition) {
    const message = bloc(`${slide.sansPropositionTexte}.`, { ...STYLES.bilan, taille: 46 }, LARGEUR_UTILE, m, { equilibre: true, gras: false });
    return { message, hauteur: 0, debordements: d };
  }
  const champ = (c) => `candidats.${slide.nom}.${c}`;
  const titre = titreBloc(slide.titre, m);
  controleTitre(titre, `titre de ${slide.nom}`, d);
  const proposition = courant(slide.proposition, m);
  const regard = courant(slide.regard, m);
  const { hauteur, boites } = empiler(
    [
      ["titre", hTexte(titre)],
      ["« Sa proposition »", 34, 22],
      ["sa proposition", hTexte(proposition), 6],
      ["« Notre regard »", 34, 20],
      ["notre regard", hTexte(regard), 6],
      ["faisable ?", slide.cout ? 196 : 152, 24],
    ],
    { haut },
  );
  controleZones(boites, [ZONE_PIED], [champ("proposition"), champ("regard"), champ("titre")], d);
  return { titre, proposition, regard, haut, hauteur, boites, debordements: d };
}

function comparatif(slide, m) {
  const d = [];
  const avis = bloc(`Notre avis : ${avisMinuscule(slide.avis)}`, STYLES.titreAvis, LARGEUR_UTILE, m, { equilibre: true });
  controleTitre(avis, "notre avis", d, 4);
  const { hauteur, boites } = empiler([
    ["notre avis", hTexte(avis)],
    ["étiquette « classement »", 40, 30],
    ...slide.classement.map((c, i) => [c.nom, 84, i ? 10 : 18]),
  ]);
  controleZones(boites, [ZONE_PIED], ["avis.avis"], d);
  return { avis, hauteur, boites, debordements: d };
}

const MISES = { couverture, ensemble, mesure, avisProgramme, constatTheme, candidat, comparatif, fin: miseEnPageFin };

// Mise en page d'une slide des formats programme / thématique.
export function miseEnPageFormat(slide, mesurer) {
  const f = MISES[slide.type];
  if (!f) return { hauteur: 0, debordements: [], picto: false };
  const r = f({ sansPropositionTexte: "Pas de proposition publiée sur ce thème à ce jour", ...slide }, mesurer);
  return { ...r, picto: ["ensemble", "mesure", "constatTheme", "fin"].includes(slide.type) ? HAUTEUR_ZONE - (r.hauteur ?? 0) >= 172 : false };
}

export function debordementsFormat(slides, mesurer) {
  return slides.flatMap((s) => miseEnPageFormat(s, mesurer).debordements.map((d) => ({ numero: s.numero, libelle: s.type, ...d })));
}

export { HAUT_ZONE };
