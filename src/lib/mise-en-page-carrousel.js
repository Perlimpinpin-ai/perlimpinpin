import { motsGras } from "./texte-gras.js";
import { morceauxSurlignes } from "./recit.js";

// Mise en page du carrousel détaillé (8 slides 1080 × 1350, direction
// artistique de docs/prompt-carrousel.md, section 4), calculée AVANT le rendu
// avec la largeur réelle des polices (src/lib/metriques-polices.js) :
//  - chaque bloc de texte est coupé en lignes ici, et le rendu
//    (src/app/api/carrousel/[id]/slides-detaille.js) affiche exactement ces
//    lignes : ce qui est mesuré est ce qui est dessiné ;
//  - les titres sont répartis sur des lignes équilibrées, jamais un mot seul
//    en bout de ligne ;
//  - tailles FIXES (texte courant 38 px, 24 px au moins pour les plus petits) :
//    on ne réduit jamais la police ;
//  - chaque bloc est empilé à sa position réelle (y, hauteur), avec les mêmes
//    écarts que le rendu. Zones RÉSERVÉES : le pied de page et la bande de
//    hachures (slides 2 à 8), le collage de la couverture (bloc foncé, photo
//    du candidat, papier jaune). Tout bloc de texte qui y entre est un
//    débordement, nommé, avec les champs du modèle à raccourcir : la
//    génération relance le modèle sur ces champs ; s'il en reste, avertissement
//    rouge et pas d'archive (src/lib/carrousel-serveur.js).
// Fonctions PURES : `mesurer(texte, taille, police, espacement)` est fourni
// par l'appelant. Testées par scripts/carrousel-detaille.test.js.

export const LARGEUR = 1080;
export const HAUTEUR = 1350;
export const MARGE = 72;
export const LARGEUR_UTILE = LARGEUR - 2 * MARGE; // 936
export const HAUT_ZONE = 150;
export const HAUTEUR_BANDE = 56; // hachures « billet de banque »
export const BAS_ZONE = HAUTEUR - HAUTEUR_BANDE - 74; // 1220 : pied de page en dessous
export const HAUTEUR_ZONE = BAS_ZONE - HAUT_ZONE;

// Styles de texte : taille, interligne, police, espacement des lettres.
export const STYLES = {
  couverture: { taille: 104, interligne: 1.06, police: "texte800", espacement: -4.4 },
  sousTitre: { taille: 42, interligne: 1.45, police: "serif", espacement: 0 },
  creditsCouverture: { taille: 24, interligne: 1.25, police: "texte500", espacement: 0 },
  titre: { taille: 60, interligne: 1.1, police: "texte500", espacement: -1.8 },
  titreAvis: { taille: 52, interligne: 1.14, police: "texte500", espacement: -1.4 },
  titreFin: { taille: 66, interligne: 1.08, police: "texte500", espacement: -2 },
  courant: { taille: 38, interligne: 1.32, police: "texte500", espacement: 0 },
  secondaire: { taille: 30, interligne: 1.3, police: "texte500", espacement: 0 },
  critere: { taille: 26, interligne: 1.28, police: "texte500", espacement: 0 },
  petit: { taille: 24, interligne: 1.3, police: "texte500", espacement: 0 },
  etiquette: { taille: 24, interligne: 1.2, police: "mono", espacement: 1 },
  valeur: { taille: 56, interligne: 1.05, police: "texte800", espacement: -1.5 },
  score: { taille: 172, interligne: 1, police: "texte800", espacement: -7 },
  // Slide 3 (la note) : titre d'avis en taille de texte courant.
  titreNote: { taille: 42, interligne: 1.2, police: "texte800", espacement: -0.8 },
  critereNom: { taille: 30, interligne: 1.2, police: "texte800", espacement: 0 },
};

// Espacements verticaux (px), partagés par la mesure et le rendu.
export const ECARTS = {
  etiquette: 40, // hauteur d'une étiquette
  apresEtiquette: 22,
  apresTitre: 20,
  bloc: 20,
  carte: 16,
  paddingCarte: 22,
  paddingCarteX: 30,
  tuile: 156,
  tuileGap: 16,
  paddingTuile: 12,
  onglets: 72,
  scoreLigne: 178,
  enteteCarte: 44,
  barre: 10,
  // Slide 3 : critères (nom et sous-note, barre épaisse, de l'air entre eux).
  apresScore: 24,
  apresTitreNote: 16,
  avantCriteres: 28,
  critereLigne: 40,
  critereBarreEcart: 10,
  critereBarre: 18,
  critereEcart: 22,
  bordCarte: 2, // bordures haute et basse des cartes (1 px chacune)
};

// Zone réservée des slides 2 à 8 : pied de page et bande de hachures, sous la
// zone de contenu. Aucun texte ne doit y entrer.
export const ZONE_PIED = { nom: "le pied de page", x: 0, y: BAS_ZONE, largeur: LARGEUR, hauteur: HAUTEUR - BAS_ZONE };
export const TITRES_LIGNES_MAX = 3;
export const PICTO = 112;

// Couverture, calée sur le modèle Teddy Riner (docs/prompt-carrousel.md, section 4).
export const COUVERTURE = {
  marge: 84,
  hautTitre: 190,
  largeurTitre: 720,
  ecartSousTitre: 44,
  largeurSousTitre: 640,
  basTexte: 860, // le titre et le sous-titre s'arrêtent au-dessus du collage
  largeurCredits: LARGEUR - 2 * 84,
  lignesCredits: 2, // photo du candidat, plus l'image de thème si sa licence exige un crédit (CC BY…)
  bande: 28, // bande de hachures plus fine sur la couverture
  paddingSurlignage: 10,
};
// Collage de la couverture (mêmes coordonnées que le rendu,
// src/app/api/carrousel/[id]/slides-detaille.js), avec 16 px de marge : bloc
// foncé incliné et photo du candidat à droite, papier jaune déchiré en bas à
// gauche (avec « Glissez » et les crédits).
const BAS_COUVERTURE = HAUTEUR - 28;
export const ZONES_COUVERTURE = [
  { nom: "la photo du candidat", x: 470, y: 744 - 16, largeur: LARGEUR - 470, hauteur: HAUTEUR - 744 + 16 },
  { nom: "le papier jaune", x: 0, y: BAS_COUVERTURE - 400 - 16, largeur: 560, hauteur: 400 + 16 },
];
const PLACE_PICTO = PICTO + 40;

// --- Coupure des lignes ------------------------------------------------------------

function largeurMot(segments, style, mesurer) {
  return segments.reduce((total, seg) => total + mesurer(seg.texte, style.taille, seg.gras ? "texte800" : style.police, style.espacement), 0);
}

function espace(style, mesurer) {
  return mesurer(" ", style.taille, style.police, style.espacement);
}

// Apostrophe typographique (’) : la droite (') laisse un blanc de trop dans
// Satori, et la typographie française préfère la courbe.
// Les groupes de chiffres (« 2 200 ») restent ensemble : espace insécable.
export function apostrophes(texte) {
  return String(texte ?? "")
    .replace(/'/g, "’")
    .replace(/(\d) (?=\d{3}\b)/g, "$1\u00A0")
    // Espace ins\u00E9cable avant : ; ! ? % \u20AC \u00BB et apr\u00E8s \u00AB (jamais une ligne qui
    // commence par \u00AB : \u00BB).
    .replace(/ ([:;!?%\u20AC\u00BB])/g, "\u00A0$1")
    .replace(/\u00AB /g, "\u00AB\u00A0");
}

// Mots mesurés d'un texte riche (gras **…**) : [{ segments, largeur }].
export function motsMesures(brut, style, mesurer, { gras = true } = {}) {
  const texte = apostrophes(brut);
  const mots = gras ? motsGras(texte) : String(texte ?? "").split(/\s+/).filter(Boolean).map((mot) => [{ texte: mot, gras: false }]);
  return mots.map((segments) => ({ segments, largeur: largeurMot(segments, style, mesurer) }));
}

// Lignes au plus juste (texte courant) : [{ mots, largeur }].
export function couperLignes(mots, largeur, largeurEspace) {
  const lignes = [];
  let courante = null;
  for (const mot of mots) {
    if (courante && courante.largeur + largeurEspace + mot.largeur <= largeur) {
      courante.mots.push(mot);
      courante.largeur += largeurEspace + mot.largeur;
    } else {
      courante = { mots: [mot], largeur: mot.largeur };
      lignes.push(courante);
    }
  }
  return lignes;
}

// Lignes équilibrées (titres) : le même nombre de lignes qu'au plus juste,
// des longueurs aussi proches que possible, et jamais un mot seul sur la
// dernière ligne (une ligne de plus si c'est le seul moyen). `malCoupe` :
// impossible sans mot seul en bout de ligne, ou un mot plus large que la ligne.
export function couperEquilibre(mots, largeur, largeurEspace) {
  const n = mots.length;
  if (n === 0) return { lignes: [], malCoupe: false };
  const trop = mots.some((m) => m.largeur > largeur);
  const largeurDe = (i, j) => mots.slice(i, j).reduce((t, m) => t + m.largeur, 0) + largeurEspace * (j - i - 1);
  const auPlusJuste = couperLignes(mots, largeur, largeurEspace).length;

  // Programmation dynamique : coût = somme des carrés des blancs à droite,
  // pour exactement k lignes ; la dernière ligne garde au moins 2 mots.
  const essayer = (k) => {
    const cout = Array.from({ length: k + 1 }, () => new Array(n + 1).fill(Infinity));
    const choix = Array.from({ length: k + 1 }, () => new Array(n + 1).fill(-1));
    cout[0][0] = 0;
    for (let l = 1; l <= k; l++) {
      for (let j = 1; j <= n; j++) {
        for (let i = l - 1; i < j; i++) {
          if (cout[l - 1][i] === Infinity) continue;
          const w = largeurDe(i, j);
          if (w > largeur && j - i > 1) continue;
          if (l === k && j === n && n >= 2 && k >= 2 && j - i < 2) continue;
          const c = cout[l - 1][i] + (largeur - w) ** 2;
          if (c < cout[l][j]) {
            cout[l][j] = c;
            choix[l][j] = i;
          }
        }
      }
    }
    if (cout[k][n] === Infinity) return null;
    const lignes = [];
    for (let l = k, j = n; l > 0; l--) {
      const i = choix[l][j];
      lignes.unshift({ mots: mots.slice(i, j), largeur: largeurDe(i, j) });
      j = i;
    }
    return lignes;
  };
  for (const k of [auPlusJuste, auPlusJuste + 1]) {
    if (k > n) break;
    const lignes = essayer(k);
    if (lignes) return { lignes, malCoupe: trop };
  }
  return { lignes: couperLignes(mots, largeur, largeurEspace), malCoupe: true };
}

// Bloc de texte mis en page : { lignes, style, hauteur, malCoupe }.
export function bloc(texte, style, largeur, mesurer, { equilibre = false, gras = true } = {}) {
  const mots = motsMesures(texte, style, mesurer, { gras });
  const e = espace(style, mesurer);
  const { lignes, malCoupe } = equilibre ? couperEquilibre(mots, largeur, e) : { lignes: couperLignes(mots, largeur, e), malCoupe: false };
  return { lignes, style, espace: e, hauteur: lignes.length * style.taille * style.interligne, malCoupe };
}

// Titre de couverture : mots avec surlignage jaune (==…==), lignes équilibrées.
export function blocCouverture(question, mesurer) {
  const style = STYLES.couverture;
  const mots = [];
  for (const { texte, jaune } of morceauxSurlignes(apostrophes(question))) {
    for (const mot of texte.split(/[ \t\n]+/).filter(Boolean)) {
      const largeur = mesurer(mot, style.taille, style.police, style.espacement);
      mots.push({ segments: [{ texte: mot, gras: false }], jaune, largeur });
    }
  }
  const e = espace(style, mesurer);
  // Le surlignage déborde de chaque côté de la ligne (padding) : place réservée.
  // Colonne de 720 px comme le modèle ; toute la largeur (entre les marges de
  // la couverture) si le titre dépasserait 3 lignes : au-delà, le sous-titre
  // descendrait sur le collage. La taille ne change jamais.
  let coupe = couperEquilibre(mots, COUVERTURE.largeurTitre - 2 * COUVERTURE.paddingSurlignage, e);
  if (coupe.lignes.length > 3) coupe = couperEquilibre(mots, LARGEUR - 2 * COUVERTURE.marge - 2 * COUVERTURE.paddingSurlignage, e);
  const { lignes, malCoupe } = coupe;
  return { lignes, style, espace: e, hauteur: lignes.length * style.taille * style.interligne, malCoupe };
}

// --- Mise en page de chaque slide ------------------------------------------------------

const hTexte = (b) => b.hauteur;

// Débordement : { bloc, raison, champs?, manque? } ; champs : clés du modèle
// à raccourcir ; manque : hauteur à gagner (px).

// Empilement vertical des blocs d'une slide à partir du haut de la zone de
// contenu : [nom, hauteur, écart avant]. Renvoie { hauteur, boites } ;
// boites : [{ nom, x, y, largeur, hauteur }] en coordonnées de la slide.
export function empiler(elements, { haut = HAUT_ZONE, x = MARGE, largeur = LARGEUR_UTILE } = {}) {
  const boites = [];
  let y = haut;
  for (const [nom, h, avant = 0] of elements) {
    if (!h) continue;
    y += avant;
    boites.push({ nom, x, y, largeur, hauteur: h });
    y += h;
  }
  return { hauteur: y - haut, boites };
}

// Deux rectangles se touchent-ils ?
export function seTouchent(a, b) {
  return a.x < b.x + b.largeur && b.x < a.x + a.largeur && a.y < b.y + b.hauteur && b.y < a.y + a.hauteur;
}

// Boîtes qui entrent dans une zone réservée → un débordement nommé, avec les
// champs du modèle à raccourcir et la hauteur à gagner.
function controleZones(boites, zones, champs, debordements) {
  const touchees = boites.flatMap((b) => zones.filter((z) => seTouchent(b, z)).map((z) => ({ b, z })));
  if (!touchees.length) return;
  const manque = Math.max(...touchees.map(({ b, z }) => Math.ceil(b.y + b.hauteur - z.y)));
  const noms = [...new Set(touchees.map(({ b, z }) => `« ${b.nom} » touche ${z.nom}`))];
  debordements.push({ bloc: noms.join(" ; "), raison: `${manque} px de trop`, champs, manque });
}

function controleTitre(b, nom, debordements, max = TITRES_LIGNES_MAX) {
  if (b.malCoupe) debordements.push({ bloc: nom, raison: "titre mal coupé (mot seul en bout de ligne ou mot trop long)" });
  if (b.lignes.length > max) debordements.push({ bloc: nom, raison: `${b.lignes.length} lignes (${max} au plus)` });
}

function miseEnPageCouverture(slide, m) {
  const debordements = [];
  const titre = blocCouverture(slide.question, m);
  const sousTitre = bloc(slide.sousTitre, STYLES.sousTitre, COUVERTURE.largeurSousTitre, m, { equilibre: true, gras: false });
  controleTitre(titre, "question de couverture", debordements, 5);
  // Chaque ligne du titre et du sous-titre, à sa place réelle, ne doit pas
  // toucher le collage (photo du candidat, bloc foncé, papier jaune).
  const hauteur = titre.hauteur + COUVERTURE.ecartSousTitre + sousTitre.hauteur;
  const hTitre = STYLES.couverture.taille * STYLES.couverture.interligne;
  const hSous = STYLES.sousTitre.taille * STYLES.sousTitre.interligne;
  const pad = COUVERTURE.paddingSurlignage;
  const boites = [
    ...titre.lignes.map((l, i) => ({ nom: `question, ligne ${i + 1}`, x: COUVERTURE.marge - pad, y: COUVERTURE.hautTitre + i * hTitre, largeur: l.largeur + 2 * pad, hauteur: hTitre })),
    ...sousTitre.lignes.map((l, i) => ({ nom: `sous-titre, ligne ${i + 1}`, x: COUVERTURE.marge, y: COUVERTURE.hautTitre + titre.hauteur + COUVERTURE.ecartSousTitre + i * hSous, largeur: l.largeur, hauteur: hSous })),
  ];
  controleZones(boites, ZONES_COUVERTURE, ["couverture.question"], debordements);
  // Crédit photo en petit, en bas : une seule ligne.
  const credits = slide.credits?.length ? bloc(slide.credits.join(" · "), STYLES.creditsCouverture, COUVERTURE.largeurCredits - 20, m, { gras: false }) : null;
  if (credits && credits.lignes.length > COUVERTURE.lignesCredits) debordements.push({ bloc: "crédits photo", raison: `${credits.lignes.length} lignes (${COUVERTURE.lignesCredits} au plus) : auteur trop long, à abréger dans src/lib/photos-candidats.js ou src/lib/illustrations.js` });
  return { titre, sousTitre, credits, hauteur, boites, debordements };
}

function miseEnPageConstat(slide, m) {
  const d = [];
  const titre = bloc(slide.titre, STYLES.titre, LARGEUR_UTILE, m, { equilibre: true });
  controleTitre(titre, "titre du constat", d);
  const explication = bloc(slide.explication, STYLES.courant, LARGEUR_UTILE, m);
  const largeurTuile = (LARGEUR_UTILE - ECARTS.tuileGap) / 2;
  const interieurTuile = largeurTuile - 2 * 24;
  const tuiles = slide.chiffres.map((chiffre, i) => {
    const valeur = m(chiffre.valeur, STYLES.valeur.taille, STYLES.valeur.police, STYLES.valeur.espacement);
    const detail = bloc(chiffre.detail, STYLES.petit, interieurTuile, m, { gras: false });
    if (valeur > interieurTuile) d.push({ bloc: `chiffre ${i + 1} (« ${chiffre.valeur} »)`, raison: "valeur plus large que la tuile" });
    if (detail.lignes.length > 2) d.push({ bloc: `chiffre ${i + 1} (détail)`, raison: `${detail.lignes.length} lignes (2 au plus)` });
    return { ...chiffre, detail };
  });
  const rangees = Math.ceil(tuiles.length / 2);
  const interieurCarte = LARGEUR_UTILE - 2 * ECARTS.paddingCarteX - 8;
  const proposition = bloc(slide.proposition, STYLES.courant, interieurCarte, m);
  const imprecisions = slide.imprecisions ? bloc(slide.imprecisions, STYLES.secondaire, interieurCarte, m) : null;
  const sources = slide.sources ? bloc(`Source : ${slide.sources}`, STYLES.petit, LARGEUR_UTILE, m, { gras: false }) : null;
  const hauteurCarte = 2 * ECARTS.paddingCarte + ECARTS.bordCarte + hTexte(proposition) + (imprecisions ? 12 + hTexte(imprecisions) : 0);
  const { hauteur, boites } = empiler([
    ["étiquette « Le constat »", ECARTS.etiquette],
    ["titre", hTexte(titre), ECARTS.apresEtiquette],
    ["explication", hTexte(explication), ECARTS.apresTitre],
    ["chiffres clés", rangees * ECARTS.tuile + (rangees - 1) * ECARTS.tuileGap, ECARTS.bloc],
    ["proposition", hauteurCarte, ECARTS.bloc],
    ["Source : …", sources ? hTexte(sources) : 0, 16],
  ]);
  controleZones(boites, [ZONE_PIED], ["constat.explication", "constat.proposition", "constat.imprecisions", "constat.sources", "constat.titre"], d);
  return { titre, explication, tuiles, proposition, imprecisions, sources, hauteurCarte, hauteur, boites, debordements: d };
}

// Slide 3 : score en grand, titre d'avis et explication en taille de texte
// courant, puis les 5 critères (nom, sous-note, barre), sans phrase par critère.
export const HAUTEUR_CRITERE = ECARTS.critereLigne + ECARTS.critereBarreEcart + ECARTS.critereBarre;
function miseEnPageNote(slide, m) {
  const d = [];
  const titre = bloc(slide.titre, STYLES.titreNote, LARGEUR_UTILE, m, { equilibre: true });
  controleTitre(titre, "titre d’avis", d);
  const explication = bloc(slide.explication, STYLES.courant, LARGEUR_UTILE, m);
  const criteres = slide.criteres.map((c) => ({ label: c.label, note: c.note, max: c.max }));
  const { hauteur, boites } = empiler([
    ["étiquette « La note »", ECARTS.etiquette],
    ["score", ECARTS.scoreLigne, ECARTS.apresEtiquette],
    ["titre d’avis", hTexte(titre), ECARTS.apresScore],
    ["explication", hTexte(explication), ECARTS.apresTitreNote],
    ...criteres.map((c, i) => [c.label, HAUTEUR_CRITERE, i ? ECARTS.critereEcart : ECARTS.avantCriteres]),
  ]);
  controleZones(boites, [ZONE_PIED], ["note.explication", "note.titre"], d);
  return { titre, explication, criteres, hauteur, boites, debordements: d };
}

function miseEnPageEffets(slide, m) {
  const d = [];
  const titre = bloc(slide.titre, STYLES.titre, LARGEUR_UTILE, m, { equilibre: true });
  controleTitre(titre, "titre", d);
  const interieur = LARGEUR_UTILE - 2 * ECARTS.paddingCarteX;
  const effets = slide.effets.map((effet) => ({ ...effet, corps: bloc(effet.texte, STYLES.courant, interieur, m) }));
  const hEffet = (e) => 2 * 22 + ECARTS.bordCarte + ECARTS.enteteCarte + 8 + hTexte(e.corps);
  const partie = slide.onglet === "long" ? "long_terme" : "court_terme";
  const { hauteur, boites } = empiler([
    ["onglets", ECARTS.onglets],
    ["titre", hTexte(titre), ECARTS.bloc],
    ...effets.map((e, i) => [`effet « ${e.acteur} »`, hEffet(e), i ? ECARTS.carte : ECARTS.apresTitre]),
  ]);
  controleZones(boites, [ZONE_PIED], [...effets.map((_, i) => `${partie}.effets.${i}.texte`), `${partie}.titre`], d);
  return { titre, effets, hEffet: effets.map(hEffet), hauteur, boites, debordements: d };
}

function miseEnPageAilleurs(slide, m) {
  const d = [];
  const titre = bloc(slide.titre, STYLES.titre, LARGEUR_UTILE, m, { equilibre: true });
  controleTitre(titre, "titre", d);
  const interieur = LARGEUR_UTILE - 2 * ECARTS.paddingCarteX;
  const mesures = slide.mesures.map((mesure) => ({
    ...mesure,
    faitBloc: bloc(mesure.fait, STYLES.courant, interieur, m),
    resultatBloc: mesure.resultat ? bloc(mesure.resultat, STYLES.courant, interieur, m) : null,
  }));
  const hMesure = (x) => 2 * ECARTS.paddingCarte + ECARTS.bordCarte + 48 + 10 + hTexte(x.faitBloc) + (x.resultatBloc ? 8 + hTexte(x.resultatBloc) : 0);
  const sources = slide.sources ? bloc(`Source : ${slide.sources}`, STYLES.petit, LARGEUR_UTILE, m, { gras: false }) : null;
  const { hauteur, boites } = empiler([
    ["étiquette « Ailleurs ou avant »", ECARTS.etiquette],
    ["titre", hTexte(titre), ECARTS.apresEtiquette],
    ...mesures.map((x, i) => [`mesure « ${x.lieu} »`, hMesure(x), i ? 18 : ECARTS.apresTitre]),
    ["Source : …", sources ? hTexte(sources) : 0, 18],
  ]);
  controleZones(boites, [ZONE_PIED], [...mesures.flatMap((_, i) => [`ailleurs.mesures.${i}.fait`, `ailleurs.mesures.${i}.resultat`]), "ailleurs.sources"], d);
  return { titre, mesures, hMesure: mesures.map(hMesure), sources, hauteur, boites, debordements: d };
}

function miseEnPageAvis(slide, m) {
  const d = [];
  const avis = bloc(slide.avis, STYLES.titreAvis, LARGEUR_UTILE, m, { equilibre: true });
  controleTitre(avis, "notre avis", d, 4);
  const interieur = LARGEUR_UTILE - 2 * ECARTS.paddingCarteX - 36;
  const points = (liste) => liste.map((p) => bloc(p, STYLES.courant, interieur, m));
  const tient = points(slide.tient);
  const coince = points(slide.coince);
  const hCarte = (liste) => 2 * ECARTS.paddingCarte + ECARTS.bordCarte + ECARTS.enteteCarte + liste.reduce((t, p) => t + 12 + hTexte(p), 0);
  const { hauteur, boites } = empiler([
    ["étiquette « Notre avis »", ECARTS.etiquette],
    ["notre avis", hTexte(avis), ECARTS.apresEtiquette],
    ["ce qui tient", hCarte(tient), 30],
    ["ce qui coince", hCarte(coince), ECARTS.carte],
  ]);
  controleZones(boites, [ZONE_PIED], [...slide.tient.map((_, i) => `avis.tient.${i}`), ...slide.coince.map((_, i) => `avis.coince.${i}`), "avis.avis"], d);
  return { avis, tient, coince, hTient: hCarte(tient), hCoince: hCarte(coince), hauteur, boites, debordements: d };
}

export const TEXTES_FIN = {
  titre: "Une analyse réalisée par l’IA Perlimpinpin.",
  texte: "Lisez l’analyse complète sur notre site et aidez-nous à l’améliorer : chaque correction ou source ajoutée la rend plus juste.",
  bouton: "LIRE ET AMÉLIORER L’ANALYSE →",
  lien: "sur notre site · lien en bio",
  association: "Perlimpinpin est une association citoyenne et indépendante. **Rejoignez-nous !**",
  enregistrer: "Enregistrez ce post pour le retrouver",
};

function miseEnPageFin(slide, m) {
  const d = [];
  const titre = bloc(TEXTES_FIN.titre, STYLES.titreFin, LARGEUR_UTILE, m, { equilibre: true });
  const texte = bloc(TEXTES_FIN.texte, STYLES.courant, LARGEUR_UTILE, m);
  const association = bloc(TEXTES_FIN.association, STYLES.courant, LARGEUR_UTILE, m);
  const sources = slide.sources?.length ? bloc(`Sources : ${slide.sources.join(" · ")}`, STYLES.petit, LARGEUR_UTILE, m, { gras: false }) : null;
  const credits = slide.credits?.length ? bloc(slide.credits.join(" · "), STYLES.petit, LARGEUR_UTILE, m, { gras: false }) : null;
  const { hauteur, boites } = empiler([
    ["titre", hTexte(titre)],
    ["texte", hTexte(texte), 30],
    ["bouton", 64, 40],
    ["lien", 32, 12],
    ["association", hTexte(association), 40],
    ["enregistrer", 40, 32],
    ["Sources : …", sources ? hTexte(sources) : 0, 28],
    ["crédits photo", credits ? hTexte(credits) : 0, 10],
  ]);
  controleZones(boites, [ZONE_PIED], [], d);
  return { titre, texte, association, sources, credits, hauteur, boites, debordements: d };
}

const MISES_EN_PAGE = {
  couverture: miseEnPageCouverture,
  constat: miseEnPageConstat,
  noteRecit: miseEnPageNote,
  effetsCourt: miseEnPageEffets,
  effetsLong: miseEnPageEffets,
  ailleurs: miseEnPageAilleurs,
  avis: miseEnPageAvis,
  fin: miseEnPageFin,
};

// Mise en page d'une slide (carrouselRecit().slides[i]) :
// { ...blocs, hauteur, debordements, picto } ; picto : vrai s'il reste assez
// de place en bas de la zone pour un pictogramme (jamais collé à un titre).
export function miseEnPageSlide(slide, mesurer) {
  const fonction = MISES_EN_PAGE[slide.type];
  if (!fonction) return { hauteur: 0, debordements: [], picto: false };
  const resultat = fonction(slide, mesurer);
  const picto = slide.type !== "couverture" && HAUTEUR_ZONE - resultat.hauteur >= PLACE_PICTO;
  return { ...resultat, picto };
}

// Débordements de tout un carrousel : [{ numero, libelle, bloc, raison }].
export function debordementsCarrousel(slides, mesurer) {
  return slides.flatMap((slide) => miseEnPageSlide(slide, mesurer).debordements.map((d) => ({ numero: slide.numero, libelle: slide.libelle, ...d })));
}

// Avertissement lisible d'un débordement.
export function messageDebordement(d) {
  return `Texte trop long, slide ${d.numero} (${d.libelle}) : ${d.bloc}, ${d.raison}. On ne réduit pas la police : raccourcir ce texte.`;
}
