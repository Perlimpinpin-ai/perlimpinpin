import { lignesEstimees } from "./carte.js";
import { BLANC, COULEURS_CARROUSEL, couleurCandidat, couleursPermisesReels, nomDeFamille } from "./charte-rs.js";
import { PIXEL_ART, COULEURS, couleursPicto, taillePixel } from "./reel-pixel.js";
import { paysParCle } from "./reel-pays.js";
import { TYPES_SCENES, classement, lignesSousTitres, morceauxDits, scoreTexte, titreProgramme, titreThematique, verdictDuScore } from "./reel-storyboard.js";

// Mise en page des images clés des Reels (v5, charte graphique RS) : pour une
// scène et une image clé (1, 2 ou 3), la liste des éléments avec leur boîte en
// pixels (sur 1080 × 1920) ET leurs couleurs. Le rendu
// (src/app/test/reels/[id]/storyboard/rendu.js) dessine exactement ces boîtes
// avec ces couleurs, le contrôle des zones sûres mesure les boîtes et le
// contrôle de la palette liste les couleurs : une seule source.
//
// Écran pixel mid-century sur fond charbon. Grille commune de chaque écran :
// petit libellé en police pixel, titre fort, puis un seul visuel centré.
// Beaucoup d'air, pas de décor gratuit. Fonctions PURES, testées par
// scripts/reel-storyboard.test.js et scripts/reel-formats.test.js.

export const LARGEUR = 1080;
export const HAUTEUR = 1920;

// Zones sûres (charte p. 17).
export const ZONES = {
  haut: 250, // rien d'important au-dessus
  bas: 1300, // rien d'important en dessous (hors sous-titres)
  droite: LARGEUR - 150, // rien d'important à droite de 930 px (boutons)
  sousTitresHaut: 1330,
  sousTitresBas: 1450,
};
const G = 72; // marge gauche
const LARGEUR_UTILE = ZONES.droite - G; // 858 px
const CENTRE = G + LARGEUR_UTILE / 2;

// Couverture : tout le contenu dans la bande centrale 1080 × 1350.
export const ZONE_COUVERTURE = { haut: (HAUTEUR - 1350) / 2, bas: (HAUTEUR + 1350) / 2 };

// Rapport largeur / caractère selon la police (estimation des retours à la ligne).
const RATIO = { display: 0.56, pixel: 0.8, mono: 0.62, texte: 0.52 };

// Rapport hauteur / largeur des photos dans leurs fenêtres.
export const FORMAT_PHOTO = { candidat: 5 / 4, illustration: 3 / 4 };
const HAUTEUR_BARRE_FENETRE = 52;

const C = COULEURS;

// Couleurs du cadre commun (fond, en-tête, barre de progression).
export const COULEURS_CADRE = { fond: C.charbon, logo: C.creme, info: C.grisChaud, progression: C.moutarde, progressionEteinte: C.creme, ombre: C.charbon };

// Couleurs des planches de storyboard (feuille de travail, hors Reel) : celles
// du papier des carrousels.
export const COULEURS_PLANCHE = { papier: COULEURS_CARROUSEL.papier, encre: COULEURS_CARROUSEL.encre, gris: COULEURS_CARROUSEL.gris, texte: COULEURS_CARROUSEL.texteCourant, jaune: C.jaune, accent: C.canard, numero: C.creme };

// Couleurs d'un texte posé sur le fond charbon.
const SUR_CHARBON = { texte: C.creme, accent: C.moutarde, rouge: C.rouille, surligne: C.jaune, surligneTexte: C.charbon };

// --- Textes ----------------------------------------------------------------------

// Espaces insécables à la française : « Bourse ? » ne se coupe jamais avant « ? ».
export function insecables(t) {
  return String(t ?? "")
    .replace(/ (?=[?!:;»%€])/g, " ")
    .replace(/« /g, "« ");
}

// « Nos **retraites**\nsont » → lignes de mots : [[{ mot, gras }], …].
export function motsMarques(t) {
  return insecables(t)
    .split("\n")
    .map((ligne) => {
      const mots = [];
      let finEspace = true;
      ligne.split(/(\*\*.+?\*\*)/).forEach((morceau, i) => {
        const gras = i % 2 === 1;
        const brut = morceau.replace(/\*\*/g, "");
        if (!brut) return;
        // « rouge**. » ou « d’**actifs** » : le premier mot colle au précédent.
        const colle = mots.length > 0 && !finEspace && !/^[ \t]/.test(brut);
        brut
          .split(/[ \t]+/)
          .filter(Boolean)
          .forEach((mot, k) => mots.push({ mot, gras, ...(colle && k === 0 ? { colle: true } : {}) }));
        finEspace = /[ \t]$/.test(brut);
      });
      return mots;
    });
}

function nbLignes(t, taille, largeur, police) {
  return String(t ?? "")
    .replace(/\*\*/g, "")
    .split("\n")
    .reduce((n, ligne) => n + lignesEstimees(ligne, taille, largeur, RATIO[police] ?? 0.55), 0);
}

// Plus grande taille de `tailles` qui tient en `maxLignes` sur `largeur`.
function ajuster(t, tailles, maxLignes, largeur, police = "display") {
  return tailles.find((taille) => nbLignes(t, taille, largeur, police) <= maxLignes) ?? tailles.at(-1);
}

function largeurTexte(t, taille, police) {
  return Math.ceil(String(t ?? "").replace(/\*\*/g, "").length * taille * (RATIO[police] ?? 0.55));
}

// Texte : { genre: "texte", x, y, w, h, taille, police, poids, c, segments }.
// Segments : style null (couleur du texte), "surligne" (jaune derrière),
// "rouge" (rouille), "accent" (moutarde, mots en « ** » aussi).
function texteBloc({ id, x, y, w, texte: t, tailles, maxLignes = 4, police = "display", poids = 900, c = SUR_CHARBON, interligne = 0.98, surligne = "", rouge = "", centre = false, important = true }) {
  const complet = [t, rouge, surligne].filter(Boolean).join(" ");
  const taille = ajuster(complet, tailles, maxLignes, w, police);
  const lignes = nbLignes(complet, taille, w, police);
  const segments = [...(t ? [{ t, style: null }] : []), ...(rouge ? [{ t: rouge, style: "rouge" }] : []), ...(surligne ? [{ t: surligne, style: "surligne" }] : [])];
  return { id, genre: "texte", x, y, w, h: Math.ceil(lignes * taille * interligne + (surligne ? 0.12 * taille : 0)), taille, police, poids, c, interligne, segments, centre, important, calque: "texte" };
}

// Libellé en police pixel (« LE CONSTAT », « SCORE PERLIMPINPIN »), en tête d'écran.
function libelle({ id = "libelle", x = G, y = 290, texte: t, taille = 32, couleur = C.moutarde }) {
  const w = largeurTexte(t, taille, "pixel") + 34;
  return { id, genre: "libelle", x, y, w: Math.min(w, LARGEUR_UTILE), h: taille + 12, taille, texte: String(t).toUpperCase(), c: { texte: couleur, carre: couleur }, important: true, calque: "texte" };
}

// Petit texte en police pixel (nom d'un pays, d'un candidat).
function etiquettePixel({ id, x, y, texte: t, taille = 26, couleur = C.creme, w = null, centre = false }) {
  return { id, genre: "libelle", x, y, w: w ?? Math.min(largeurTexte(t, taille, "pixel") + 10, LARGEUR_UTILE), h: taille + 10, taille, texte: String(t).toUpperCase(), sansCarre: true, centre, c: { texte: couleur }, important: true, calque: "texte" };
}

// Fenêtre façon vieil ordinateur : barre de titre canard, nom de fichier, photo
// tramée. `chargement` : 0 (grosse mosaïque) à 1 (net) ; `glitch` : décalage.
function fenetre({ id, x, y, w, image, nom, glitch = false, format = null }) {
  const f = format ?? (image.startsWith("candidat") ? FORMAT_PHOTO.candidat : FORMAT_PHOTO.illustration);
  const hImage = Math.round(w * f);
  return {
    id,
    genre: "fenetre",
    x,
    y,
    w,
    h: HAUTEUR_BARRE_FENETRE + hImage + 8,
    hImage,
    image,
    nom,
    glitch,
    c: { barre: C.canard, bord: C.creme, titre: C.creme, corps: C.charbon, ombre: C.charbon, ...(glitch ? { glitchA: C.moutarde, glitchB: C.canard } : {}) },
    important: true,
    calque: "visuel",
  };
}

function picto({ id, nom, x, y, taille, rotation = 0, surFondSombre = true }) {
  const t = taillePixel(nom) ?? { colonnes: 10, lignes: 10 };
  return { id, genre: "pixel", nom, x, y, w: t.colonnes * taille, h: t.lignes * taille, taille, rotation, surFondSombre, c: Object.fromEntries(couleursPicto(nom).map((v, i) => [`p${i}`, v])), important: false, calque: "visuel" };
}

// Carte crème : titre (pixel), texte, picto facultatif.
function carteCreme({ id, x, y, w, titre = "", texte: t = "", tailleTitre = 26, tailleTexte = 36, icone = null, tailleIcone = 5, couleurTitre = C.canard, gros = "", tailleGros = 64, couleurGros = C.moutarde, centre = false, pad = 28 }) {
  const interieur = w - 2 * pad;
  const hIcone = icone ? (taillePixel(icone)?.lignes ?? 10) * tailleIcone + 14 : 0;
  const hGros = gros ? Math.round(tailleGros * 1.25) : 0;
  const hTitre = titre ? tailleTitre + 14 : 0;
  const hTexte = t ? nbLignes(t, tailleTexte, interieur, "texte") * tailleTexte * 1.22 : 0;
  return {
    id,
    genre: "carteCreme",
    x,
    y,
    w,
    h: Math.ceil(2 * pad + hIcone + hGros + hTitre + hTexte),
    pad,
    titre,
    texte: t,
    gros,
    tailleGros,
    tailleTitre,
    tailleTexte,
    icone,
    tailleIcone,
    centre,
    c: { fond: C.creme, titre: couleurTitre, texte: C.charbon, gros: couleurGros, ombre: C.charbon, ...(icone ? Object.fromEntries(couleursPicto(icone).map((v, i) => [`p${i}`, v])) : {}) },
    important: true,
    calque: "texte",
  };
}

// Tampon en police pixel, avec secousse (rotation).
function tampon({ id, x, y, texte: t, taille = 40, couleur = C.moutarde, rotation = -5 }) {
  return { id, genre: "tampon", x, y, w: largeurTexte(t, taille, "pixel") + 54, h: taille + 38, taille, texte: String(t).toUpperCase(), rotation, c: { bord: couleur, texte: couleur }, important: true, calque: "texte" };
}

// Tampon du verdict à droite de la note s'il y tient (sans entrer dans les
// 150 px de droite), sinon sous `ySous`.
function tamponVerdict({ note, sc, ySous, taille }) {
  const tp = tampon({ id: "verdict", x: 0, y: 0, texte: verdictDuScore(note), taille, couleur: couleurVerdict(note) });
  const xDroite = sc.x + sc.w + 30;
  if (xDroite + tp.w + 20 <= ZONES.droite) return { ...tp, x: xDroite, y: sc.y + Math.round((sc.h - tp.h) / 2) };
  return { ...tp, x: G + 10, y: ySous };
}

// Note /100 en grand (moutarde).
function score({ id = "score", x = G, y, valeur, taille = 300 }) {
  const t = String(valeur);
  return { id, genre: "score", x, y, w: Math.min(LARGEUR_UTILE, Math.round(t.length * taille * 0.6 + taille * 0.75)), h: Math.round(taille * 0.88), taille, valeur: t, c: { valeur: C.moutarde, sur: C.grisChaud }, important: true, calque: "texte" };
}

// Jauge en blocs (20 blocs de 5 points).
function jauge({ id = "jauge", x = G, y, w = LARGEUR_UTILE, valeur }) {
  return { id, genre: "jauge", x, y, w, h: 44, blocs: 20, allumes: Math.round(Number(valeur) / 5), c: { allume: C.moutarde, eteint: C.creme }, important: true, calque: "visuel" };
}

// Couleur du tampon d'un verdict, dans la palette des Reels (paliers du
// barème du site, src/lib/score.js : « solide et chiffré » dès 65).
function couleurVerdict(note) {
  const n = Number(note);
  if (n >= 65) return C.olive;
  if (n >= 50) return C.moutarde;
  if (n >= 40) return C.creme;
  return C.rouille;
}

// --- Sous-titres -------------------------------------------------------------------

// Sous-titre d'une image clé (charte p. 18) : blanc, gras, centré, ombre douce,
// sans boîte ni contour ; mot clé en moutarde ; 8 mots au plus par ligne.
export function sousTitre(t) {
  const lignes = lignesSousTitres(t);
  const largeurMax = ZONES.droite - 90;
  const hauteurZone = ZONES.sousTitresBas - ZONES.sousTitresHaut;
  let taille = 52;
  let n = lignes.length;
  for (taille of [52, 48, 44, 40, 36, 32]) {
    n = lignes.reduce((s, l) => s + lignesEstimees(l.replace(/\*\*/g, ""), taille, largeurMax, 0.54), 0);
    if (n * taille * 1.12 <= hauteurZone) break;
  }
  const h = Math.ceil(n * taille * 1.12);
  return { id: "sous-titres", genre: "sousTitre", x: 90, y: ZONES.sousTitresHaut, w: largeurMax, h, taille, lignes, texte: t, c: { texte: BLANC, cle: C.moutarde, ombre: C.charbon }, important: true, calque: "sous-titres" };
}

// --- Noms des fenêtres -------------------------------------------------------------

function nomFichier(t) {
  return `${String(t ?? "photo")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")}`;
}

// ctx : { candidatNom, theme } (noms des fenêtres).
export function nomsFenetres(ctx) {
  return { candidat: `${nomFichier(ctx?.candidatNom)}.png`, illustration: `${nomFichier(ctx?.theme || "illustration")}.jpg` };
}

// --- Scènes du format « une mesure » -------------------------------------------------

const DISPOSITIONS = {
  accroche(s, k, ctx) {
    const n = nomsFenetres(ctx);
    if (k === 1) return [fenetre({ id: "illustration", x: CENTRE - 340, y: 520, w: 680, image: "illustrationMosaique", nom: n.illustration, glitch: true })];
    const titre = k === 3 ? texteBloc({ id: "titre", x: G, y: 300, w: LARGEUR_UTILE, texte: s.titre, surligne: s.surligne, tailles: [96, 86, 76, 68], maxLignes: 3 }) : null;
    const yBas = k === 3 ? Math.min(760, Math.max(660, titre.y + titre.h + 50)) : 640;
    const els = [
      fenetre({ id: "illustration", x: G, y: yBas + 70, w: k === 3 ? 420 : 470, image: "illustration", nom: n.illustration }),
      fenetre({ id: "candidat", x: k === 3 ? 540 : 500, y: yBas, w: k === 3 ? 360 : 400, image: "candidat", nom: n.candidat, glitch: k === 2 }),
    ];
    if (titre) els.unshift(titre);
    return els;
  },

  chiffres(s, k) {
    const e = libelle({ texte: s.etiquette });
    const els = [e];
    if (s.icone) els.push(picto({ id: "objet-1", nom: s.icone, x: Math.min(e.x + e.w + 30, 820), y: 276, taille: 6 }));
    const titre = texteBloc({ id: "titre", x: G, y: 370, w: LARGEUR_UTILE, texte: s.titre, rouge: s.rouge, tailles: [100, 88, 78, 70], maxLignes: 3 });
    els.push(titre);
    if (k >= 2) {
      const base = 1200;
      const visibles = s.barres.filter((b) => !b.fantome || k === 3);
      const reelles = s.barres.filter((b) => !b.fantome);
      // La barre la plus grave (la plus haute des barres réelles) en rouille.
      const grave = reelles.reduce((a, b) => (Number(b.h) > Number(a.h) ? b : a), reelles[0]);
      const n = visibles.length;
      const gap = 44;
      const larg = Math.min(220, Math.floor((LARGEUR_UTILE - 40 - (n - 1) * gap) / n));
      const largTotale = n * larg + (n - 1) * gap;
      const x0 = Math.round(CENTRE - largTotale / 2);
      const hMax = Math.max(120, base - (titre.y + titre.h) - 160);
      const hauteurs = visibles.map((b) => Math.min(hMax, Math.max(40, Number(b.h) || 200)));
      visibles.forEach((b, j) => {
        const derniere = !b.fantome && reelles.indexOf(b) === reelles.length - 1;
        const h = k === 2 ? Math.round(hauteurs[j] * (derniere ? 0.35 : 0.8)) : hauteurs[j];
        const x = x0 + j * (larg + gap);
        const valeur = k === 2 && derniere ? "…" : b.valeur;
        const couleur = b.fantome ? C.grisChaud : b === grave ? C.rouille : C.canard;
        els.push({ id: `barre-${j + 1}`, genre: "colonne", x, y: base - h, w: larg, h, fantome: Boolean(b.fantome), c: { bloc: couleur }, important: true, calque: "visuel" });
        const tailleValeur = Math.min(56, Math.floor((larg + 30) / Math.max(1, String(valeur).length * 0.55)));
        els.push({
          id: `valeur-${j + 1}`,
          genre: "texte",
          x: x - 15,
          y: base - h - tailleValeur - 16,
          w: larg + 30,
          h: tailleValeur,
          taille: tailleValeur,
          police: b.fantome ? "pixel" : "display",
          poids: 900,
          c: { ...SUR_CHARBON, texte: b.fantome ? C.grisChaud : C.creme },
          interligne: 1,
          segments: [{ t: valeur, style: null }],
          centre: true,
          important: true,
          calque: "texte",
        });
        els.push(etiquettePixel({ id: `label-${j + 1}`, x: x - 10, y: base + 14, w: larg + 20, texte: b.label, taille: 26, couleur: C.grisChaud, centre: true }));
      });
    }
    return els;
  },

  proposition(s, k, ctx) {
    const n = nomsFenetres(ctx);
    const els = [libelle({ texte: "sa proposition" })];
    els.push(k === 1 ? fenetre({ id: "candidat", x: CENTRE - 280, y: 380, w: 560, image: "candidatMosaique", nom: n.candidat }) : fenetre({ id: "candidat", x: CENTRE - 210, y: 370, w: 420, image: "candidat", nom: n.candidat }));
    if (k >= 2) {
      const [a, b] = s.blocs;
      const taille = [56, 50, 44, 38].find((t) => Math.max(largeurTexte(a, t, "display"), largeurTexte(b, t, "display")) + 60 <= LARGEUR_UTILE - 120) ?? 38;
      const hBloc = Math.round(taille * 1.05 + 48);
      const y = 970;
      const bloc = (id, x, yb, t, fond, texteC) => ({
        id,
        genre: "bloc",
        x,
        y: yb,
        w: Math.min(LARGEUR_UTILE - 120, largeurTexte(t, taille, "display") + 60),
        h: hBloc,
        taille,
        texte: t,
        c: { fond, texte: texteC, ombre: C.charbon },
        important: true,
        calque: "texte",
      });
      const b1 = bloc("bloc-1", G, y, a, C.creme, C.charbon);
      const b2 = bloc("bloc-2", G + 120, y + hBloc + 26, b, C.moutarde, C.charbon);
      els.push(b1, { id: "plus", genre: "texte", x: G + 20, y: y + hBloc + 18, w: 80, h: 90, taille: 90, police: "display", poids: 900, c: SUR_CHARBON, interligne: 0.9, segments: [{ t: "+", style: "accent" }], important: true, calque: "texte" }, b2);
      if (k === 3) {
        // Tampons abattus sur la fenêtre du candidat, l'un sous l'autre.
        (s.tampons ?? []).forEach((t, j) => {
          const tp = tampon({ id: `tampon-${j + 1}`, x: 0, y: 600 + j * 120, texte: t, taille: 34, couleur: j ? C.creme : C.moutarde, rotation: j ? 4 : -5 });
          els.push({ ...tp, x: Math.min(ZONES.droite - tp.w - 20, 520 - j * 40) });
        });
      }
    }
    return els;
  },

  note(s, k) {
    const v = k === 1 ? Math.round(s.score * 0.2) : k === 2 ? Math.round(s.score * 0.73) : s.score;
    const els = [libelle({ texte: "score perlimpinpin" })];
    els.push(score({ y: 380, valeur: scoreTexte(v) }));
    els.push({ id: "cases", genre: "cases", x: G, y: 720, w: LARGEUR_UTILE, h: 216, allumees: v, c: { allume: C.moutarde, eteint: C.creme }, important: true, calque: "visuel" });
    if (k === 3) {
      const taille = Math.min(40, Math.floor((LARGEUR_UTILE - 110) / Math.max(1, String(s.verdict).length * 0.8)));
      els.push(tampon({ id: "verdict", x: G + 20, y: 1050, texte: s.verdict, taille, couleur: couleurVerdict(s.score) }));
    }
    return els;
  },

  cartes(s, k) {
    const els = [libelle({ texte: s.etiquette })];
    const titre = texteBloc({ id: "titre", x: G, y: 370, w: LARGEUR_UTILE, texte: s.titre, tailles: [92, 82, 74, 66], maxLignes: 3 });
    els.push(titre);
    const w = 270;
    const y0 = Math.max(720, titre.y + titre.h + 50);
    s.cartes.forEach((c, j) => {
      if (j >= k) return;
      els.push(carteCreme({ id: `carte-${j + 1}`, x: G + j * (w + 24), y: j === k - 1 && k < 3 ? y0 + 40 : y0, w, gros: c.signe, couleurGros: c.signe.includes("+") ? C.rouille : C.canard, texte: c.texte, tailleTexte: 32, icone: c.icone, tailleIcone: 9, centre: true }));
    });
    return els;
  },

  compteur(s, k) {
    const els = [libelle({ texte: s.etiquette })];
    const titre = texteBloc({ id: "titre", x: G, y: 370, w: LARGEUR_UTILE, texte: s.titre, tailles: [92, 82, 74, 66], maxLignes: 3 });
    els.push(titre);
    const y = Math.max(720, titre.y + titre.h + 60);
    els.push(picto({ id: "objet-1", nom: s.icone ?? "hourglass", x: 100, y, taille: 18, rotation: (k - 1) * 90 }));
    const valeur = s.etapes[k - 1];
    const x = 420;
    const taille = Math.min(k === 3 ? 190 : 150, Math.floor((ZONES.droite - x - 40) / Math.max(1, String(valeur).length * 0.58)));
    els.push({ id: "compteur", genre: "compteur", x, y: y + 20, w: ZONES.droite - x, h: Math.round(taille * 0.9 + 80), taille, valeur, unite: s.unite, c: { valeur: k === 3 ? C.moutarde : C.creme, unite: C.creme }, important: true, calque: "texte" });
    return els;
  },

  pays(s, k) {
    const [A, B] = s.groupes;
    const ok = (g) => (g.ok ? C.olive : C.rouille);
    const els = [libelle({ texte: s.etiquette })];
    els.push(texteBloc({ id: "titre", x: G, y: 360, w: LARGEUR_UTILE, texte: k < 3 ? s.titre : s.titre3 || s.titre, tailles: [80, 72, 64, 58], maxLignes: 2 }));
    const cartes = (g, boite, x0, y0, gap, prefixe) =>
      g.pays.map((cle, j) => ({ id: `${prefixe}-${cle}`, genre: "carte", cle, nomPays: paysParCle(cle)?.nom ?? cle, x: x0 + j * (boite.w + gap), y: y0, w: boite.w, h: boite.h, c: { pays: ok(g) }, important: true, calque: "visuel" }));
    if (k < 3) {
      const n = A.pays.length;
      const bw = k === 1 ? Math.min(400, Math.floor((LARGEUR_UTILE - (n - 1) * 40) / n)) : Math.min(300, Math.floor((LARGEUR_UTILE - (n - 1) * 40) / n));
      const boite = { w: bw, h: k === 1 ? 400 : 290 };
      const y0 = 570;
      els.push(...cartes(A, boite, G, y0, 40, "carte-a"));
      A.noms.forEach((nom, j) => els.push(etiquettePixel({ id: `nom-a-${j + 1}`, x: G + j * (bw + 40), y: y0 + boite.h + 16, texte: nom, taille: 28, couleur: ok(A) })));
      if (k === 2) els.push(carteCreme({ id: "bilan-a", x: G, y: 1000, w: LARGEUR_UTILE, titre: A.carte2 || A.bilan, texte: A.texte, tailleTexte: 34, couleurTitre: A.ok ? C.olive : C.rouille }));
    } else {
      els.push(...cartes(A, { w: 190, h: 190 }, G, 570, 24, "carte-a"));
      els.push(etiquettePixel({ id: "noms-a", x: G, y: 776, texte: A.noms.join(" · "), taille: 24, couleur: ok(A) }));
      if (B) {
        els.push(...cartes(B, { w: 230, h: 470 }, 680, 560, 0, "carte-b"));
        els.push(etiquettePixel({ id: "noms-b", x: 680, y: 1050, texte: B.noms.join(" · "), taille: 24, couleur: ok(B) }));
      }
      [A, B].filter(Boolean).forEach((g, j) =>
        els.push(carteCreme({ id: `bilan-${j ? "b" : "a"}`, x: G, y: 840 + j * 215, w: 580, titre: g.bilan, texte: g.texte, tailleTexte: 30, couleurTitre: g.ok ? C.olive : C.rouille })),
      );
    }
    return els;
  },

  avis(s, k) {
    const els = [libelle({ texte: "notre avis" })];
    const titre =
      k === 1
        ? texteBloc({ id: "titre", x: G, y: 370, w: LARGEUR_UTILE, texte: `${s.debutTitre}…`, tailles: [104, 92, 82], maxLignes: 4 })
        : texteBloc({ id: "titre", x: G, y: 370, w: LARGEUR_UTILE, texte: `${s.debutTitre}, ${s.finTitre}`, surligne: `${s.surligne}.`, tailles: [80, 72, 64, 58], maxLignes: 4 });
    els.push(titre);
    if (k >= 2) {
      const y = Math.max(k === 2 ? 820 : 780, titre.y + titre.h + 50);
      els.push(carteCreme({ id: "tient", x: G, y, w: 417, titre: "ce qui tient", texte: s.tient, tailleTexte: 34, icone: "check", tailleIcone: 5, couleurTitre: C.olive }));
      if (k === 3) els.push(carteCreme({ id: "coince", x: G + 441, y, w: 417, titre: "ce qui coince", texte: s.coince, tailleTexte: 34, icone: "cross", tailleIcone: 5, couleurTitre: C.rouille }));
    }
    return els;
  },

  // Fin (charte p. 15) : « Et vous, qu'en pensez-vous ? », barre d'adresse
  // crème où « perlimpinpin.ai » se tape lettre à lettre, mention de l'IA,
  // « Lien en bio » en moutarde.
  fin(s, k) {
    const els = [k === 1 ? picto({ id: "bulle", nom: "bubble", x: CENTRE - 240, y: 560, taille: 30 }) : picto({ id: "bulle", nom: "bubble", x: G, y: 300, taille: 12 })];
    if (k >= 2) {
      els.push(texteBloc({ id: "question", x: G, y: 460, w: LARGEUR_UTILE, texte: s.question, tailles: [100, 88, 78], maxLignes: 3 }));
      const url = String(s.url ?? "");
      const tape = k === 2 ? url.slice(0, Math.ceil(url.length / 2)) : url;
      els.push({ id: "adresse", genre: "adresse", x: G, y: 880, w: LARGEUR_UTILE, h: 104, taille: 46, texte: tape, c: { fond: C.creme, texte: C.charbon, curseur: C.moutarde, ombre: C.charbon, loupe: C.canard }, important: true, calque: "texte" });
    }
    if (k === 3) {
      els.push({ id: "mention", genre: "texte", x: G, y: 1030, w: LARGEUR_UTILE, h: 76, taille: 30, police: "mono", poids: 500, c: { ...SUR_CHARBON, texte: C.grisChaud }, interligne: 1.25, segments: [{ t: s.mention, style: null }], important: true, calque: "texte" });
      els.push({ id: "lien-bio", genre: "texte", x: G, y: 1150, w: LARGEUR_UTILE, h: 70, taille: 64, police: "display", poids: 900, c: { ...SUR_CHARBON, texte: C.moutarde }, interligne: 1, segments: [{ t: "Lien en bio", style: null }], important: true, calque: "texte" });
    }
    return els;
  },

  // --- Format « programme » ---------------------------------------------------------

  // Portrait au centre (liseré jaune), 6 cartes crème qui tombent une à une
  // (picto, thème, « ? »). Titre fixe : « On a noté 6 mesures de [Nom]. »
  "accroche-programme"(s, k, ctx) {
    const els = [texteBloc({ id: "titre", x: G, y: 300, w: LARGEUR_UTILE, texte: titreProgramme(ctx.candidatNom), tailles: [92, 84, 76], maxLignes: 2 })];
    els.push(portrait({ id: "portrait", x: CENTRE - 190, y: 640, w: 380, image: k === 1 ? "candidatMosaique" : "candidat" }));
    const mesures = ctx.mesures ?? [];
    const visibles = k === 1 ? 0 : k === 2 ? 3 : 6;
    mesures.slice(0, visibles).forEach((m, j) => {
      const gauche = j % 2 === 0;
      const rang = Math.floor(j / 2);
      els.push(
        carteCreme({
          id: `carte-${j + 1}`,
          x: gauche ? G : ZONES.droite - 190,
          y: 580 + rang * 236,
          w: 190,
          titre: m.themeCourt ?? m.theme,
          tailleTitre: 18,
          gros: "?/100",
          tailleGros: 46,
          couleurGros: C.moutarde,
          icone: m.icone,
          tailleIcone: 4,
          centre: true,
          pad: 18,
        }),
      );
    });
    return els;
  },

  // Une mesure : « MESURE 1/6 · RETRAITES », titre (l'info et le verdict),
  // bloc crème (picto, la proposition en une phrase), note /100, jauge, tampon.
  mesure(s, k, ctx) {
    const m = (ctx.mesures ?? [])[s.numero - 1] ?? {};
    const els = [libelle({ texte: `mesure ${s.numero}/${(ctx.mesures ?? []).length || 6} · ${m.themeCourt ?? m.theme ?? ""}` })];
    const titre = texteBloc({ id: "titre", x: G, y: 370, w: LARGEUR_UTILE, texte: s.titre, tailles: [84, 76, 68, 60], maxLignes: 3 });
    els.push(titre);
    // Image 1 : le picto du thème en grand, seul visuel centré.
    const icone = s.icone ?? m.icone;
    if (k === 1 && icone) {
      const t = taillePixel(icone);
      els.push(picto({ id: "objet-1", nom: icone, x: Math.round(CENTRE - (t.colonnes * 22) / 2), y: Math.max(720, titre.y + titre.h + 90), taille: 22 }));
    }
    if (k >= 2) {
      const bloc = carteCreme({ id: "proposition", x: G, y: Math.max(640, titre.y + titre.h + 50), w: LARGEUR_UTILE, titre: "la proposition", texte: s.proposition, tailleTexte: 36, icone: s.icone ?? m.icone ?? null, tailleIcone: 5 });
      els.push(bloc);
      if (k === 3 && Number.isFinite(Number(m.score))) {
        const y = Math.min(960, bloc.y + bloc.h + 40);
        const sc = score({ y, valeur: scoreTexte(m.score), taille: 150 });
        const j = jauge({ y: y + sc.h + 24, valeur: m.score });
        els.push(sc, j, tamponVerdict({ note: m.score, sc, ySous: j.y + j.h + 26, taille: 30 }));
      }
    }
    return els;
  },

  // Classement par note, moyenne du code. Programme : les 6 mesures ;
  // thématique : les candidats notés, puis ceux sans proposition.
  classement(s, k, ctx) {
    const els = [libelle({ texte: "le classement" })];
    const titre = texteBloc({ id: "titre", x: G, y: 370, w: LARGEUR_UTILE, texte: s.titre, tailles: [84, 76, 68], maxLignes: 2 });
    els.push(titre);
    const entrees = ctx.format === "programme" ? (ctx.mesures ?? []).map((m) => ({ libelle: m.themeCourt ?? m.theme, score: m.score })) : (ctx.candidats ?? []).map((c) => ({ libelle: nomDeFamille(c.nom), score: c.score }));
    const { lignes, moyenne, sansNote } = classement(entrees);
    const toutes = [...lignes, ...sansNote];
    const y0 = Math.max(560, titre.y + titre.h + 40);
    const pas = Math.min(96, Math.floor((1150 - y0) / Math.max(1, toutes.length)));
    const visibles = k === 1 ? 0 : k === 2 ? Math.ceil(toutes.length / 2) : toutes.length;
    // Les lignes arrivent de la dernière à la première (suspense).
    toutes.forEach((e, j) => {
      const rang = toutes.length - 1 - j;
      if (rang >= visibles && k < 3) return;
      const y = y0 + j * pas;
      const note = e.score === null || e.score === undefined ? null : Number(e.score);
      els.push(etiquettePixel({ id: `ligne-${j + 1}`, x: G, y: y + 6, w: 300, texte: `${note === null ? "–" : j + 1}. ${e.libelle}`, taille: 26, couleur: note === null ? C.grisChaud : C.creme }));
      if (note === null) {
        els.push(etiquettePixel({ id: `sans-note-${j + 1}`, x: 390, y: y + 6, w: 520, texte: "pas de proposition", taille: 22, couleur: C.grisChaud }));
      } else {
        els.push({ ...jauge({ id: `barre-${j + 1}`, x: 390, y: y + 4, w: 400, valeur: note }), h: 34 });
        els.push({ id: `note-${j + 1}`, genre: "texte", x: 810, y: y, w: 110, h: 44, taille: 44, police: "display", poids: 900, c: { ...SUR_CHARBON, texte: C.moutarde }, interligne: 1, segments: [{ t: scoreTexte(note), style: null }], important: true, calque: "texte" });
      }
    });
    if (k === 3 && moyenne !== null) {
      els.push({ id: "moyenne", genre: "texte", x: G, y: Math.min(1210, y0 + toutes.length * pas + 20), w: LARGEUR_UTILE, h: 60, taille: 52, police: "display", poids: 900, c: SUR_CHARBON, interligne: 1, segments: [{ t: "Moyenne : ", style: null }, { t: `${scoreTexte(moyenne)}/100`, style: "accent" }], important: true, calque: "texte" });
    }
    return els;
  },

  // --- Format « thématique » --------------------------------------------------------

  // Titre fixe et médaillons ronds dans la couleur de chaque candidat (liseré jaune).
  medaillons(s, k, ctx) {
    const candidats = ctx.candidats ?? [];
    const els = [libelle({ texte: ctx.themeCourt ?? ctx.theme ?? "le thème" })];
    els.push(texteBloc({ id: "titre", x: G, y: 370, w: LARGEUR_UTILE, texte: titreThematique(ctx.themeLibelle ?? ctx.theme), tailles: [84, 76, 68], maxLignes: 3 }));
    if (k === 1) return els;
    const visibles = k === 2 ? Math.ceil(candidats.length / 2) : candidats.length;
    const parLigne = Math.ceil(candidats.length / 2);
    const diametre = parLigne >= 4 ? 170 : 200;
    candidats.slice(0, visibles).forEach((c, j) => {
      const ligne = Math.floor(j / parLigne);
      const dansLigne = ligne === 0 ? parLigne : candidats.length - parLigne;
      const col = j - ligne * parLigne;
      const gap = Math.min(60, (LARGEUR_UTILE - dansLigne * diametre) / Math.max(1, dansLigne - 1));
      const largeurLigne = dansLigne * diametre + (dansLigne - 1) * gap;
      const x = Math.round(CENTRE - largeurLigne / 2 + col * (diametre + gap));
      const y = 680 + ligne * 290;
      els.push(medaillon({ id: `medaillon-${j + 1}`, x, y, d: diametre, nom: c.nom, image: `candidat-${j + 1}` }));
      els.push(etiquettePixel({ id: `nom-${j + 1}`, x: x - 30, y: y + diametre + 14, w: diametre + 60, texte: nomDeFamille(c.nom), taille: 22, centre: true }));
    });
    return els;
  },

  // Un candidat : haut de l'écran dans sa couleur (registre), portrait liseré
  // jaune, « CANDIDAT · 1/5 », titre, cartes « LA PROPOSITION » et « NOTRE
  // REGARD », note et tampon. Sans fiche : « Pas de proposition publiée sur ce
  // thème à ce jour », sans note.
  candidat(s, k, ctx) {
    const candidats = ctx.candidats ?? [];
    const c = candidats[s.numero - 1] ?? { nom: "" };
    const reg = couleurCandidat(c.nom) ?? { fond: C.canard, texte: C.creme };
    const surBandeau = { texte: reg.texte, accent: reg.texte, rouge: C.rouille, surligne: reg.surlignage ?? C.jaune, surligneTexte: C.charbon };
    const els = [{ id: "bandeau", genre: "bandeau", x: 0, y: 236, w: LARGEUR, h: 400, c: { fond: reg.fond }, important: false, calque: "fond-scene" }];
    els.push(portrait({ id: "portrait", x: G, y: 300, w: 220, image: `candidat-${s.numero}` }));
    els.push(libelle({ x: 330, y: 300, texte: `candidat · ${s.numero}/${candidats.length}`, couleur: reg.texte }));
    els.push(etiquettePixel({ id: "nom", x: 330, y: 352, texte: nomDeFamille(c.nom), taille: 30, couleur: reg.texte }));
    els.push(texteBloc({ id: "titre", x: 330, y: 420, w: ZONES.droite - 330, texte: s.titre, tailles: [60, 54, 48, 42], maxLignes: 3, c: surBandeau }));
    if (k === 1) return els;
    if (!c.fiche) {
      els.push(carteCreme({ id: "sans-proposition", x: G, y: 700, w: LARGEUR_UTILE, titre: "la proposition", texte: "Pas de proposition publiée sur ce thème à ce jour", tailleTexte: 40, couleurTitre: C.grisChaud }));
      return els;
    }
    const prop = carteCreme({ id: "proposition", x: G, y: 664, w: LARGEUR_UTILE, titre: "la proposition", texte: s.proposition, tailleTexte: 32 });
    els.push(prop);
    if (k === 3) {
      const regard = carteCreme({ id: "regard", x: G, y: prop.y + prop.h + 18, w: LARGEUR_UTILE, titre: "notre regard", texte: s.regard, tailleTexte: 32, couleurTitre: C.rouille });
      const y = Math.min(1150, regard.y + regard.h + 26);
      const sc = score({ y, valeur: scoreTexte(c.score), taille: 110 });
      els.push(regard, sc, tamponVerdict({ note: c.score, sc, ySous: sc.y + sc.h + 16, taille: 28 }));
    }
    return els;
  },
};

// Portrait tramé avec liseré jaune (programme, thématique).
function portrait({ id, x, y, w, image }) {
  return { id, genre: "portrait", x, y, w, h: Math.round(w * FORMAT_PHOTO.candidat), image, c: { liseré: C.jaune, fond: C.charbon }, important: true, calque: "visuel" };
}

// Médaillon rond dans la couleur du candidat, liseré jaune.
function medaillon({ id, x, y, d, nom, image }) {
  const reg = couleurCandidat(nom) ?? { fond: C.canard };
  return { id, genre: "medaillon", x, y, w: d, h: d, image, c: { fond: reg.fond, liseré: C.jaune }, important: true, calque: "visuel" };
}

// Éléments d'une image clé (k = 1, 2 ou 3), sous-titre compris.
// ctx : { format, candidatNom, theme, themeLibelle, themeCourt, mesures, candidats }.
export function dispositionImage(scene, k, ctx = {}) {
  const f = DISPOSITIONS[scene?.type];
  const els = f ? f(scene, k, ctx) : [];
  return [...els, sousTitre(scene?.voix?.[k - 1] ?? "")];
}

// Couverture : pas de score. « Une mesure » : fenêtres, titre de la mesure,
// question. Programme et thématique : leur titre fixe et leur visuel.
export function dispositionCouverture(couverture, ctx = {}) {
  const z = ZONE_COUVERTURE;
  const marque = libelle({ id: "marque", x: G, y: z.haut + 50, texte: "/ perlimpinpin", taille: 34, couleur: C.creme });
  if (ctx.format === "programme") {
    const els = DISPOSITIONS["accroche-programme"]({}, 3, ctx).map((e) => ({ ...e, y: e.y + 60 }));
    els.find((e) => e.id === "portrait").image = "candidat";
    return [marque, ...els];
  }
  if (ctx.format === "thematique") return [marque, ...DISPOSITIONS.medaillons({}, 3, ctx).map((e) => ({ ...e, y: e.y + 40 }))];
  const n = nomsFenetres(ctx);
  const t = texteBloc({ id: "titre", x: G, y: 1040, w: LARGEUR_UTILE, texte: couverture.titre, tailles: [100, 90, 80, 72], maxLignes: 3 });
  // Crédit de l'image de thème sur la couverture quand la licence le demande (charte p. 11).
  const credit = ctx.credit
    ? [{ id: "credit", genre: "texte", x: G, y: z.bas - 70, w: LARGEUR_UTILE, h: 44, taille: 20, police: "mono", poids: 500, c: { ...SUR_CHARBON, texte: C.grisChaud }, interligne: 1.1, segments: [{ t: ctx.credit, style: null }], important: true, calque: "texte" }]
    : [];
  return [
    marque,
    fenetre({ id: "illustration", x: G, y: z.haut + 220, w: 450, image: "illustration", nom: n.illustration }),
    fenetre({ id: "candidat", x: 480, y: z.haut + 150, w: 420, image: "candidat", nom: n.candidat }),
    t,
    texteBloc({ id: "question", x: G, y: Math.max(t.y + t.h + 40, 1390), w: LARGEUR_UTILE, texte: "", surligne: couverture.question ?? "", tailles: [64], maxLignes: 1 }),
    ...credit,
  ];
}

// --- Contrôle des couleurs -----------------------------------------------------------

// Couleurs d'un élément (celles de sa palette `c`).
export function couleursElement(el) {
  return Object.values(el?.c ?? {}).filter((v) => typeof v === "string" && v.startsWith("#")).map((v) => v.toUpperCase());
}

// Couleurs d'une image clé : celles du cadre et de chaque élément.
export function couleursImage(elements) {
  return [...new Set([...Object.values(COULEURS_CADRE), ...elements.flatMap(couleursElement)].map((v) => v.toUpperCase()))];
}

// Couleurs hors palette des Reels, du registre et du jaune (refus).
export function couleursHorsPalette(couleurs) {
  const permises = couleursPermisesReels();
  return [...new Set((couleurs ?? []).map((c) => String(c).toUpperCase()))].filter((c) => !permises.has(c));
}

// Couleurs de tout le storyboard, par scène, et celles hors palette (refus).
// Renvoie { parScene: [{ scene, type, couleurs }], horsPalette: [hex], erreurs }.
export function couleursStoryboard(scenes, couverture, ctx = {}) {
  const permises = couleursPermisesReels();
  const parScene = scenes.map((scene, i) => ({
    scene: i + 1,
    type: scene.type,
    couleurs: [...new Set([1, 2, 3].flatMap((k) => couleursImage(dispositionImage(scene, k, ctx))))].sort(),
  }));
  const couvertureCouleurs = couverture ? couleursImage(dispositionCouverture(couverture, ctx)) : [];
  const erreurs = [];
  const hors = new Set();
  parScene.forEach((p) =>
    p.couleurs
      .filter((c) => !permises.has(c))
      .forEach((c) => {
        hors.add(c);
        erreurs.push(`Scène ${p.scene} (${p.type}) : couleur ${c} hors de la palette des Reels, du registre et du jaune.`);
      }),
  );
  couvertureCouleurs.filter((c) => !permises.has(c)).forEach((c) => (hors.add(c), erreurs.push(`Couverture : couleur ${c} hors palette.`)));
  return { parScene, couverture: couvertureCouleurs.sort(), horsPalette: [...hors], erreurs };
}

// --- Contrôle des zones sûres -----------------------------------------------------------

// Boîte englobante d'un élément tourné (rotation en degrés, autour du centre).
export function boiteTournee(el) {
  const a = (Math.abs(el.rotation ?? 0) * Math.PI) / 180;
  if (!a) return { x0: el.x, y0: el.y, x1: el.x + el.w, y1: el.y + el.h };
  const w = el.w * Math.cos(a) + el.h * Math.sin(a);
  const h = el.w * Math.sin(a) + el.h * Math.cos(a);
  const cx = el.x + el.w / 2;
  const cy = el.y + el.h / 2;
  return { x0: cx - w / 2, y0: cy - h / 2, x1: cx + w / 2, y1: cy + h / 2 };
}

const NOMS_ELEMENTS = {
  titre: "le titre",
  libelle: "le libellé",
  etiquette: "l’étiquette",
  candidat: "la fenêtre du candidat",
  illustration: "la fenêtre de l’illustration",
  portrait: "le portrait",
  cases: "les cases de la note",
  score: "la note",
  jauge: "la jauge",
  verdict: "le tampon du verdict",
  adresse: "l’adresse du site",
  mention: "la mention",
  question: "la question",
  moyenne: "la moyenne",
};

function nomElement(el) {
  return NOMS_ELEMENTS[el.id] ?? `l’élément « ${el.id} »`;
}

function px(v) {
  return `${Math.round(v).toLocaleString("fr-FR")} px`;
}

// Avertissements de zones sûres pour une image : un par chevauchement.
// `ou` : « Scène 3 (proposition), image 2 ».
export function zonesImage(elements, ou, { couverture = false } = {}) {
  const avertissements = [];
  for (const el of elements) {
    if (el.genre === "sousTitre") {
      if (el.y + el.h > ZONES.sousTitresBas + 1) avertissements.push(`${ou} : sous-titre trop long, il déborde de la zone des sous-titres (bas à ${px(el.y + el.h)}).`);
      continue;
    }
    if (el.genre === "bandeau") continue;
    const b = boiteTournee(el);
    if (b.x0 < 0 || b.y0 < 0 || b.x1 > LARGEUR || b.y1 > HAUTEUR) avertissements.push(`${ou} : ${nomElement(el)} sort de l’image.`);
    if (couverture) {
      if (b.y0 < ZONE_COUVERTURE.haut || b.y1 > ZONE_COUVERTURE.bas) avertissements.push(`${ou} : ${nomElement(el)} sort de la bande centrale 1080 × 1350 (coupée dans la grille du profil).`);
      continue;
    }
    if (b.y1 > ZONES.sousTitresHaut && b.y0 < ZONES.sousTitresBas) {
      avertissements.push(`${ou} : ${nomElement(el)} empiète sur la zone des sous-titres (${px(Math.max(b.y0, ZONES.sousTitresHaut))} à ${px(Math.min(b.y1, ZONES.sousTitresBas))}).`);
      continue;
    }
    if (!el.important) continue;
    if (b.y0 < ZONES.haut) avertissements.push(`${ou} : ${nomElement(el)} monte au-dessus de 250 px (haut à ${px(b.y0)}).`);
    if (b.y1 > ZONES.bas) avertissements.push(`${ou} : ${nomElement(el)} descend sous 1 300 px (bas à ${px(b.y1)}).`);
    if (b.x1 > ZONES.droite) avertissements.push(`${ou} : ${nomElement(el)} entre dans les 150 px de droite (bord à ${px(b.x1)}).`);
  }
  return avertissements;
}

// Zones sûres de tout le storyboard (3 images par scène) et de la couverture.
export function zonesStoryboard(scenes, couverture, ctx = {}) {
  const avertissements = [];
  scenes.forEach((scene, i) => {
    [1, 2, 3].forEach((k) => {
      avertissements.push(...zonesImage(dispositionImage(scene, k, ctx), `Scène ${i + 1} (${scene.type}), image ${k}`));
    });
  });
  if (couverture) avertissements.push(...zonesImage(dispositionCouverture(couverture, ctx), "Couverture", { couverture: true }));
  return avertissements;
}

// Morceaux dits (pour la planche) : réexport pratique.
export { morceauxDits, TYPES_SCENES, PIXEL_ART };
