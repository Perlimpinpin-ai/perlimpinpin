import { lignesEstimees } from "./carte.js";
import { PIXEL_ART, COULEURS, taillePixel } from "./reel-pixel.js";
import { paysParCle } from "./reel-pays.js";
import { TYPES_SCENES, morceauxDits } from "./reel-storyboard.js";

// Mise en page des images clés des Reels (storyboard v4) : pour une scène et
// une image clé (1, 2 ou 3), la liste des éléments avec leur boîte en pixels
// (sur 1080 × 1920). Le rendu (src/app/test/reels/[id]/storyboard/rendu.js)
// dessine exactement ces boîtes, et le contrôle des zones sûres les mesure :
// une seule source. Positions reprises du gabarit du kit Reel, recalées dans
// les zones sûres d'Instagram. Fonctions PURES, testées par
// scripts/reel-disposition.test.js.

export const LARGEUR = 1080;
export const HAUTEUR = 1920;

// Zones sûres (docs/prompt-reel.md, section 3).
export const ZONES = {
  haut: 250, // rien d'important au-dessus
  bas: 1300, // rien d'important en dessous (hors sous-titres)
  droite: LARGEUR - 150, // rien d'important à droite de 930 px (boutons)
  sousTitresHaut: 1330,
  sousTitresBas: 1450,
};
const G = 72; // marge gauche
const LARGEUR_UTILE = ZONES.droite - G; // 858 px

// Couverture : tout le contenu dans la bande centrale 1080 × 1350.
export const ZONE_COUVERTURE = { haut: (HAUTEUR - 1350) / 2, bas: (HAUTEUR + 1350) / 2 };

// Rapport largeur / caractère selon la police (estimation des retours à la ligne).
const RATIO = { display: 0.56, pixel: 0.8, mono: 0.62, texte: 0.52 };

// Rapport hauteur / largeur des photos dans leurs fenêtres.
export const FORMAT_PHOTO = { candidat: 5 / 4, illustration: 3 / 4 };
const HAUTEUR_BARRE_FENETRE = 52;

// --- Textes ----------------------------------------------------------------------

// « Nos **retraites**\nsont » → lignes de mots : [[{ mot, gras }], …].
// Espaces insécables à la française : « Bourse ? » ne se coupe jamais avant « ? ».
export function insecables(t) {
  return String(t ?? "")
    .replace(/ (?=[?!:;»%€])/g, " ")
    .replace(/« /g, "« ");
}

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

// Texte : { genre: "texte", x, y, w, h, taille, police, poids, couleur, lignes, segments }.
// `surligne` : partie du texte à surligner en jaune ; `rouge` : partie en rouge.
function texteBloc({ id, x, y, w, texte: t, tailles, maxLignes = 4, police = "display", poids = 900, couleur = COULEURS.blanc, interligne = 0.98, surligne = "", rouge = "", important = true }) {
  const complet = [t, rouge, surligne].filter(Boolean).join(" ");
  const taille = ajuster(complet, tailles, maxLignes, w, police);
  const lignes = nbLignes(complet, taille, w, police);
  const segments = [
    ...(t ? [{ t, style: null }] : []),
    ...(rouge ? [{ t: rouge, style: "rouge" }] : []),
    ...(surligne ? [{ t: surligne, style: "surligne" }] : []),
  ];
  return { id, genre: "texte", x, y, w, h: Math.ceil(lignes * taille * interligne + (surligne ? 0.12 * taille : 0)), taille, police, poids, couleur, interligne, segments, important, calque: "texte" };
}

function etiquette({ id = "etiquette", x = G, y = 300, texte: t, taille = 34, contour = false, couleur = COULEURS.jaune }) {
  const w = largeurTexte(t, taille, "pixel") + 40;
  return { id, genre: "etiquette", x, y, w: Math.min(w, LARGEUR_UTILE), h: taille + 20, taille, texte: t, contour, couleur, important: true, calque: "texte" };
}

function fenetre({ id, x, y, w, image, nom, rotation = 0, glitch = false }) {
  const format = image.startsWith("candidat") ? FORMAT_PHOTO.candidat : FORMAT_PHOTO.illustration;
  const hImage = Math.round(w * format);
  return { id, genre: "fenetre", x, y, w, h: HAUTEUR_BARRE_FENETRE + hImage + 8, hImage, image, nom, rotation, glitch, important: true, calque: "visuel" };
}

function pixel({ id, nom, x, y, taille, rotation = 0 }) {
  const t = taillePixel(nom) ?? { colonnes: 10, lignes: 10 };
  return { id, genre: "pixel", nom, x, y, w: t.colonnes * taille, h: t.lignes * taille, taille, rotation, important: false, calque: "visuel" };
}

// Carte texte (fond lavande) : titre, texte, icône facultative.
function carteTexte({ id, x, y, w, titre = "", texte: t = "", tailleTitre = 52, tailleTexte = 36, icone = null, tailleIcone = 0, fond = COULEURS.lavande, centre = false, couleurTitre = COULEURS.encre, iconeEnLigne = false }) {
  const pad = 30;
  const interieur = w - 2 * pad;
  const largeurIcone = icone ? (taillePixel(icone)?.colonnes ?? 10) * tailleIcone + 16 : 0;
  const hIcone = icone && !iconeEnLigne ? (taillePixel(icone)?.lignes ?? 10) * tailleIcone + 14 : 0;
  const hTitre = titre ? nbLignes(titre, tailleTitre, interieur - (iconeEnLigne ? largeurIcone : 0), "display") * tailleTitre * 1.05 : 0;
  const hTexte = t ? nbLignes(t, tailleTexte, interieur, "texte") * tailleTexte * 1.25 + (titre ? 8 : 0) : 0;
  return {
    id,
    genre: "carteTexte",
    x,
    y,
    w,
    h: Math.ceil(2 * pad + hIcone + hTitre + hTexte),
    pad,
    titre,
    texte: t,
    tailleTitre,
    tailleTexte,
    icone,
    tailleIcone,
    iconeEnLigne,
    fond,
    centre,
    couleurTitre,
    important: true,
    calque: "texte",
  };
}

function tampon({ id, x, y, texte: t, taille = 40, couleur = COULEURS.jaune, rotation = -6 }) {
  return { id, genre: "tampon", x, y, w: largeurTexte(t, taille, "pixel") + 54, h: taille + 38, taille, texte: t, couleur, rotation, important: true, calque: "texte" };
}

// --- Sous-titres -------------------------------------------------------------------

// Sous-titre d'une image clé : centré entre 90 et 930 px, de 1 330 à 1 450 px.
export function sousTitre(t) {
  const largeurMax = ZONES.droite - 90;
  const pad = { h: 22, v: 10 };
  const brut = String(t ?? "").replace(/\*\*/g, "");
  let taille = 50;
  let lignes = 1;
  for (taille of [50, 46, 42, 38, 34]) {
    lignes = lignesEstimees(brut, taille, largeurMax - 2 * pad.h, 0.53);
    if (lignes * taille * 1.12 + 2 * pad.v <= ZONES.sousTitresBas - ZONES.sousTitresHaut) break;
  }
  const h = Math.ceil(lignes * taille * 1.12 + 2 * pad.v);
  const w = Math.min(largeurMax, Math.ceil(Math.min(brut.length, (largeurMax - 2 * pad.h) / (taille * 0.53)) * taille * 0.53) + 2 * pad.h);
  return { id: "sous-titres", genre: "sousTitre", x: Math.round(90 + (largeurMax - w) / 2), y: ZONES.sousTitresHaut, w, h, taille, pad, texte: t, important: true, calque: "sous-titres" };
}

// --- Les 9 types de scène -----------------------------------------------------------

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

const DISPOSITIONS = {
  accroche(s, k, ctx) {
    const n = nomsFenetres(ctx);
    if (k === 1) return [fenetre({ id: "illustration", x: 190, y: 520, w: 700, image: "illustrationMosaique", nom: n.illustration, rotation: -3, glitch: true })];
    const titre = k === 3 ? texteBloc({ id: "titre", x: G, y: 300, w: LARGEUR_UTILE, texte: s.titre, surligne: s.surligne, tailles: [100, 88, 78, 70], maxLignes: 3 }) : null;
    const yBas = k === 3 ? Math.min(740, Math.max(640, titre.y + titre.h + 30)) : 640;
    const els = [
      fenetre({ id: "illustration", x: G - 16, y: yBas + 60, w: k === 3 ? 440 : 500, image: "illustration", nom: n.illustration, rotation: -5 }),
      fenetre({ id: "candidat", x: k === 3 ? 520 : 480, y: yBas, w: k === 3 ? 380 : 420, image: "candidat", nom: n.candidat, rotation: 4, glitch: k === 2 }),
    ];
    if (titre) els.unshift(titre);
    if (k === 3 && s.icone) els.push(pixel({ id: "objet-1", nom: s.icone, x: 760, y: Math.max(250, titre.y + titre.h - 40), taille: 7 }));
    return els;
  },

  chiffres(s, k) {
    const e = etiquette({ texte: s.etiquette });
    const els = [e];
    if (s.icone) els.push(pixel({ id: "objet-1", nom: s.icone, x: Math.min(e.x + e.w + 30, 800), y: k === 1 ? 282 : 296, taille: 8 }));
    const titre = texteBloc({ id: "titre", x: G, y: 410, w: LARGEUR_UTILE, texte: s.titre, rouge: s.rouge, tailles: [104, 92, 80, 70], maxLignes: 3 });
    els.push(titre);
    if (k >= 2) {
      const base = 1236;
      const visibles = s.barres.filter((b) => !b.fantome || k === 3);
      const reelles = s.barres.filter((b) => !b.fantome);
      const n = visibles.length;
      const gap = 36;
      const larg = Math.min(240, Math.floor((LARGEUR_UTILE - 40 - (n - 1) * gap) / n));
      const hMax = Math.max(120, base - (titre.y + titre.h) - 150);
      const hauteurs = visibles.map((b) => Math.min(hMax, Math.max(40, Number(b.h) || 200)));
      visibles.forEach((b, j) => {
        const derniere = !b.fantome && reelles.indexOf(b) === reelles.length - 1;
        const h = k === 2 ? Math.round(hauteurs[j] * (derniere ? 0.35 : 0.8)) : hauteurs[j];
        const x = G + 20 + j * (larg + gap);
        const valeur = k === 2 && derniere ? "…" : b.valeur;
        els.push({ id: `barre-${j + 1}`, genre: "colonne", x, y: base - h, w: larg, h, couleur: COULEURS.rouge, fantome: Boolean(b.fantome), important: true, calque: "visuel" });
        const tailleValeur = b.fantome ? 28 : Math.min(60, Math.floor((larg + 20) / Math.max(1, String(valeur).length * 0.55)));
        els.push(
          b.fantome
            ? { ...etiquette({ id: `valeur-${j + 1}`, x, y: base - h - 62, texte: valeur, taille: tailleValeur }), w: Math.min(larg + 40, largeurTexte(valeur, tailleValeur, "pixel") + 40) }
            : { id: `valeur-${j + 1}`, genre: "texte", x, y: base - h - tailleValeur - 14, w: larg + 30, h: tailleValeur, taille: tailleValeur, police: "display", poids: 900, couleur: COULEURS.blanc, interligne: 1, segments: [{ t: valeur, style: null }], important: true, calque: "texte" },
        );
        els.push({ id: `label-${j + 1}`, genre: "texte", x, y: base + 12, w: larg, h: 34, taille: 30, police: "pixel", poids: 400, couleur: COULEURS.blanc, interligne: 1.1, segments: [{ t: b.label, style: null }], centre: true, important: true, calque: "texte" });
      });
    }
    return els;
  },

  proposition(s, k, ctx) {
    // Tampons sous le dernier bloc.
    const surLigneTampons = (_s, els) => Math.min(1190, Math.max(...els.filter((e) => e.id.startsWith("bloc")).map((e) => e.y + e.h)) + 40);
    const n = nomsFenetres(ctx);
    const els = [k === 1 ? fenetre({ id: "candidat", x: 230, y: 330, w: 620, image: "candidatMosaique", nom: n.candidat }) : fenetre({ id: "candidat", x: 300, y: 290, w: 460, image: "candidat", nom: n.candidat })];
    if (k >= 2) {
      const [a, b] = s.blocs;
      // Sur une ligne si les deux blocs y tiennent en grand, sinon l'un sous l'autre.
      const largeurBloc = (t, taille) => Math.min(LARGEUR_UTILE - 130, largeurTexte(t, taille, "display") + 56);
      const surUneLigne = largeurTexte(a, 50, "display") + largeurTexte(b, 50, "display") + 2 * 56 + 130 <= LARGEUR_UTILE - 10;
      const taille = surUneLigne ? 50 : [56, 50, 44, 38].find((t) => Math.max(largeurTexte(a, t, "display"), largeurTexte(b, t, "display")) + 56 <= LARGEUR_UTILE - 130) ?? 38;
      const wa = largeurBloc(a, taille);
      const wb = largeurBloc(b, taille);
      const hBloc = Math.round(taille * 1.05 + 44);
      const y = 940;
      const bloc = (id, x, yb, w, t, fond) => ({ ...carteTexte({ id, x, y: yb, w, titre: t, tailleTitre: taille, fond }), pad: 22, h: hBloc });
      const plus = (x, yb) => ({ id: "plus", genre: "texte", x, y: yb, w: 90, h: 100, taille: 100, police: "display", poids: 900, couleur: COULEURS.jaune, interligne: 0.9, segments: [{ t: "+", style: null }], important: true, calque: "texte" });
      if (surUneLigne) {
        els.push(bloc("bloc-1", G, y, wa, a, COULEURS.lavande), plus(G + wa + 20, y - 6), bloc("bloc-2", G + wa + 130, y, wb, b, COULEURS.jaune));
      } else {
        els.push(bloc("bloc-1", G, y, wa, a, COULEURS.lavande), plus(G + 10, y + hBloc + 14), bloc("bloc-2", G + 130, y + hBloc + 20, wb, b, COULEURS.jaune));
      }
    }
    if (k === 3) {
      const yTampons = surLigneTampons(s, els);
      (s.tampons ?? []).forEach((t, j) => els.push(tampon({ id: `tampon-${j + 1}`, x: 110 + j * 400, y: yTampons - j * 16, texte: t, couleur: j ? COULEURS.rose : COULEURS.jaune, rotation: j ? 5 : -6 })));
    }
    return els;
  },

  note(s, k) {
    const v = k === 1 ? Math.round(s.score * 0.2) : k === 2 ? Math.round(s.score * 0.73) : s.score;
    const els = [etiquette({ texte: "score perlimpinpin", contour: true })];
    els.push({ id: "score", genre: "score", x: G, y: 400, w: 760, h: 290, valeur: v, important: true, calque: "texte" });
    els.push({ id: "cases", genre: "cases", x: G, y: 770, w: LARGEUR_UTILE, h: 216, allumees: v, important: true, calque: "visuel" });
    if (k === 3) {
      const taille = Math.min(40, Math.floor((LARGEUR_UTILE - 110) / Math.max(1, String(s.verdict).length * 0.8)));
      els.push(tampon({ id: "verdict", x: G + 20, y: 1120, texte: s.verdict, taille }));
    }
    return els;
  },

  cartes(s, k) {
    const els = [etiquette({ texte: s.etiquette })];
    const titre = texteBloc({ id: "titre", x: G, y: 410, w: LARGEUR_UTILE, texte: s.titre, tailles: [96, 86, 76, 68], maxLignes: 3 });
    els.push(titre);
    const w = 270;
    const y0 = Math.max(730, titre.y + titre.h + 30);
    s.cartes.forEach((c, j) => {
      if (j >= k) return;
      els.push(
        carteTexte({ id: `carte-${j + 1}`, x: G + j * (w + 24), y: j === k - 1 && k < 3 ? y0 + 40 : y0, w, titre: c.signe, texte: c.texte, tailleTitre: 72, tailleTexte: 32, icone: c.icone, tailleIcone: 13, centre: true, couleurTitre: COULEURS.rouge }),
      );
    });
    return els;
  },

  compteur(s, k) {
    const els = [etiquette({ texte: s.etiquette })];
    const titre = texteBloc({ id: "titre", x: G, y: 410, w: LARGEUR_UTILE, texte: s.titre, tailles: [96, 86, 76, 68], maxLignes: 3 });
    els.push(titre);
    const y = Math.max(720, titre.y + titre.h + 40);
    els.push(pixel({ id: "objet-1", nom: s.icone ?? "sablier", x: 100, y, taille: 20, rotation: (k - 1) * 90 }));
    const valeur = s.etapes[k - 1];
    const x = 420;
    const taille = Math.min(k === 3 ? 190 : 150, Math.floor((ZONES.droite - x - 40) / Math.max(1, String(valeur).length * 0.58)));
    els.push({ id: "compteur", genre: "compteur", x, y: y + 20, w: ZONES.droite - x, h: Math.round(taille * 0.9 + 80), taille, valeur, unite: s.unite, surligne: k === 3, important: true, calque: "texte" });
    if (k === 3) els.push(pixel({ id: "objet-2", nom: "courbe", x: 480, y: Math.min(1120, y + taille + 130), taille: 16 }));
    return els;
  },

  pays(s, k) {
    const [A, B] = s.groupes;
    const ok = (g) => (g.ok ? COULEURS.vert : COULEURS.rouge);
    const els = [etiquette({ texte: s.etiquette })];
    els.push(texteBloc({ id: "titre", x: G, y: 390, w: LARGEUR_UTILE, texte: k < 3 ? s.titre : s.titre3 || s.titre, tailles: [84, 76, 68, 60], maxLignes: 2 }));
    const cartes = (g, boite, x0, y0, gap, prefixe) =>
      g.pays.map((cle, j) => ({ id: `${prefixe}-${cle}`, genre: "carte", cle, nomPays: paysParCle(cle)?.nom ?? cle, x: x0 + j * (boite.w + gap), y: y0, w: boite.w, h: boite.h, couleur: ok(g), important: true, calque: "visuel" }));
    if (k < 3) {
      const n = A.pays.length;
      const bw = k === 1 ? Math.min(400, Math.floor((LARGEUR_UTILE - (n - 1) * 40) / n)) : Math.min(300, Math.floor((LARGEUR_UTILE - (n - 1) * 40) / n));
      const boite = { w: bw, h: k === 1 ? 400 : 290 };
      const y0 = k === 1 ? 600 : 570;
      els.push(...cartes(A, boite, G, y0, 40, "carte-a"));
      A.noms.forEach((nom, j) =>
        els.push(etiquette({ id: `nom-a-${j + 1}`, x: G + j * (bw + 40), y: y0 + boite.h + 20, texte: nom, taille: 28, contour: true, couleur: ok(A) })),
      );
      if (k === 2) {
        els.push(carteTexte({ id: "bilan-a", x: G, y: 1010, w: LARGEUR_UTILE, titre: A.carte2 || A.bilan, texte: A.texte, tailleTitre: 44, tailleTexte: 36, icone: A.ok ? "coche" : "croix", tailleIcone: 4, iconeEnLigne: true }));
      }
    } else {
      els.push(...cartes(A, { w: 190, h: 190 }, G, 600, 24, "carte-a"));
      els.push(etiquette({ id: "noms-a", x: G, y: 806, texte: A.noms.join(" · "), taille: 24, contour: true, couleur: ok(A) }));
      if (B) {
        els.push(...cartes(B, { w: 230, h: 470 }, 680, 590, 0, "carte-b"));
        els.push(etiquette({ id: "noms-b", x: 680, y: 1080, texte: B.noms.join(" · "), taille: 24, contour: true, couleur: ok(B) }));
      }
      [A, B].filter(Boolean).forEach((g, j) =>
        els.push(carteTexte({ id: `bilan-${j ? "b" : "a"}`, x: G, y: 870 + j * 205, w: 580, titre: g.bilan, texte: g.texte, tailleTitre: 40, tailleTexte: 30, icone: g.ok ? "coche" : "croix", tailleIcone: 4, iconeEnLigne: true, fond: g.ok ? COULEURS.lavande : "#FFE3DF" })),
      );
    }
    return els;
  },

  avis(s, k) {
    const els = [etiquette({ texte: "notre avis" })];
    const titre =
      k === 1
        ? texteBloc({ id: "titre", x: G, y: 410, w: LARGEUR_UTILE, texte: `${s.debutTitre}…`, tailles: [110, 96, 84], maxLignes: 4 })
        : texteBloc({ id: "titre", x: G, y: 410, w: LARGEUR_UTILE, texte: `${s.debutTitre}, ${s.finTitre}`, surligne: `${s.surligne}.`, tailles: [84, 76, 68, 60], maxLignes: 4 });
    els.push(titre);
    if (k >= 2) {
      const y = Math.max(k === 2 ? 820 : 780, titre.y + titre.h + 40);
      els.push(carteTexte({ id: "tient", x: G, y, w: 417, titre: "Tient", texte: s.tient, tailleTitre: 52, tailleTexte: 34, icone: "coche", tailleIcone: 5, iconeEnLigne: true }));
      if (k === 3) els.push(carteTexte({ id: "coince", x: G + 441, y, w: 417, titre: "Coince", texte: s.coince, tailleTitre: 52, tailleTexte: 34, icone: "croix", tailleIcone: 5, iconeEnLigne: true, fond: "#FFE3DF" }));
    }
    return els;
  },

  fin(s, k) {
    const els = [k === 1 ? pixel({ id: "bulle", nom: "bulle", x: 300, y: 560, taille: 30 }) : pixel({ id: "bulle", nom: "bulle", x: G, y: 300, taille: 16 })];
    if (k >= 2) els.push(texteBloc({ id: "question", x: G, y: 520, w: LARGEUR_UTILE, texte: s.question, tailles: [104, 92, 80], maxLignes: 3 }));
    if (k === 3) {
      els.push({ id: "adresse", genre: "recherche", x: G, y: 950, w: LARGEUR_UTILE, h: 100, taille: 44, texte: s.url, important: true, calque: "texte" });
      els.push({ id: "mention", genre: "texte", x: G, y: 1100, w: LARGEUR_UTILE, h: 70, taille: 28, police: "mono", poids: 500, couleur: COULEURS.blanc, interligne: 1.25, segments: [{ t: s.mention, style: null }], important: true, calque: "texte" });
    }
    return els;
  },
};

// Éléments d'une image clé (k = 1, 2 ou 3), sous-titre compris.
// ctx : { candidatNom, theme }.
export function dispositionImage(scene, k, ctx = {}) {
  const f = DISPOSITIONS[scene?.type];
  const els = f ? f(scene, k, ctx) : [];
  return [...els, sousTitre(scene?.voix?.[k - 1] ?? "")];
}

// Couverture : fenêtres, titre de la mesure, question. Pas de score.
export function dispositionCouverture({ titre, question }, ctx = {}) {
  const n = nomsFenetres(ctx);
  const z = ZONE_COUVERTURE;
  const t = texteBloc({ id: "titre", x: G, y: 1060, w: LARGEUR_UTILE, texte: titre, tailles: [108, 96, 86, 76], maxLignes: 3 });
  return [
    etiquette({ id: "marque", x: G, y: z.haut + 50, texte: "/ perlimpinpin", taille: 34 }),
    fenetre({ id: "illustration", x: G - 10, y: z.haut + 210, w: 470, image: "illustration", nom: n.illustration, rotation: -5 }),
    fenetre({ id: "candidat", x: 440, y: z.haut + 140, w: 450, image: "candidat", nom: n.candidat, rotation: 4 }),
    t,
    { ...etiquette({ id: "question", x: G, y: Math.max(t.y + t.h + 40, 1400), texte: question, taille: 60 }), h: 92 },
  ];
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
  etiquette: "l’étiquette",
  candidat: "la fenêtre du candidat",
  illustration: "la fenêtre de l’illustration",
  cases: "les cases de la note",
  score: "la note",
  verdict: "le tampon du verdict",
  adresse: "l’adresse du site",
  mention: "la mention",
  question: "la question",
};

function libelle(el) {
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
    const b = boiteTournee(el);
    if (b.x0 < 0 || b.y0 < 0 || b.x1 > LARGEUR || b.y1 > HAUTEUR) avertissements.push(`${ou} : ${libelle(el)} sort de l’image.`);
    if (couverture) {
      if (b.y0 < ZONE_COUVERTURE.haut || b.y1 > ZONE_COUVERTURE.bas) avertissements.push(`${ou} : ${libelle(el)} sort de la bande centrale 1080 × 1350 (coupée dans la grille du profil).`);
      continue;
    }
    if (b.y1 > ZONES.sousTitresHaut && b.y0 < ZONES.sousTitresBas) {
      avertissements.push(`${ou} : ${libelle(el)} empiète sur la zone des sous-titres (${px(Math.max(b.y0, ZONES.sousTitresHaut))} à ${px(Math.min(b.y1, ZONES.sousTitresBas))}).`);
      continue;
    }
    if (!el.important) continue;
    if (b.y0 < ZONES.haut) avertissements.push(`${ou} : ${libelle(el)} monte au-dessus de 250 px (haut à ${px(b.y0)}).`);
    if (b.y1 > ZONES.bas) avertissements.push(`${ou} : ${libelle(el)} descend sous 1 300 px (bas à ${px(b.y1)}).`);
    if (b.x1 > ZONES.droite) avertissements.push(`${ou} : ${libelle(el)} entre dans les 150 px de droite (bord à ${px(b.x1)}).`);
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
