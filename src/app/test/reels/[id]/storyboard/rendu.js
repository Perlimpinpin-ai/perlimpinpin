/* eslint-disable @next/next/no-img-element -- next/og (Satori) ne connaît que <img>. */
import { transparence } from "@/lib/charte-rs";
import { dataUriCarte, dataUriPixel } from "@/lib/reel-pixel";
import { COULEURS_CADRE, COULEURS_PLANCHE, HAUTEUR, LARGEUR, dispositionCouverture, dispositionImage, motsMarques } from "@/lib/reel-disposition";
import { TYPES_SCENES, formatTemps, sansGras } from "@/lib/reel-storyboard";
import { nomDeFamille } from "@/lib/charte-rs";

// Rendu next/og des images du storyboard (v5, charte graphique RS) : images
// clés 1080 × 1920, couverture, calques et planches. Positions ET couleurs
// viennent toutes de src/lib/reel-disposition.js (les mêmes boîtes servent au
// contrôle des zones sûres, les mêmes couleurs au contrôle de la palette) ;
// ici, seulement le dessin. Aucun code couleur dans ce fichier (contrôlé par
// scripts/charte-rs.test.js). JSX pour Satori : flexbox, pas de grid.
// `f` : échelle (1 pour une image, 0,4 dans une planche).

const POLICE = { display: "Inter Display", pixel: "Silkscreen", mono: "JetBrains Mono", texte: "Inter Display" };

// Ombre douce charbon (plus d'ombres décalées roses).
const ombreDouce = (c, f, force = 0.55) => `0 ${10 * f}px ${28 * f}px ${transparence(c, force)}`;

// Mots d'un texte, qui passent à la ligne d'eux-mêmes. Les mots surlignés (ou
// en gras, avec `groupeGras`) qui se suivent forment un seul bloc, coupé
// seulement s'il dépasse la largeur.
export function groupes(mots, { taille, w, ratio = 0.56, groupeGras = false }) {
  const sortie = [];
  for (const m of mots) {
    const marque = m.style === "surligne" ? "surligne" : groupeGras && m.gras ? "gras" : null;
    const dernier = sortie.at(-1);
    const largeur = (txt) => txt.length * taille * ratio;
    // Mot collé au précédent (« rouge. », « d’actifs ») : même bloc, sans espace.
    if (m.colle && dernier) {
      if (dernier.marque === marque && !dernier.suite) dernier.mot = `${dernier.mot}${m.mot}`;
      else (dernier.suite ??= []).push({ ...m, marque });
      continue;
    }
    if (marque && dernier?.marque === marque && !dernier.suite && largeur(`${dernier.mot} ${m.mot}`) <= w) dernier.mot = `${dernier.mot} ${m.mot}`;
    else sortie.push({ ...m, marque });
  }
  return sortie;
}

// Un bloc de mots (et les mots collés qui le suivent), chacun avec son style.
function Bloc({ m, style }) {
  if (!m.suite) return <span style={style(m)}>{m.mot}</span>;
  return (
    <div style={{ display: "flex", alignItems: "flex-end" }}>
      {[m, ...m.suite].map((x, q) => (
        <span key={q} style={style(x)}>
          {x.mot}
        </span>
      ))}
    </div>
  );
}

// Texte à segments : style null (couleur du texte), « accent » et mots en
// « ** » (moutarde), « rouge » (rouille), « surligne » (jaune derrière).
function Mots({ segments, taille, f, c, poids, police, interligne = 1, centre = false, w }) {
  const mots = segments.flatMap((seg) => motsMarques(seg.t).flatMap((ligne, i) => [...(i > 0 ? [{ saut: true }] : []), ...ligne.map((m) => ({ ...m, style: seg.style }))]));
  const lignes = [[]];
  for (const m of mots) (m.saut ? lignes.push([]) : lignes.at(-1).push(m));
  const couleur = (x) => (x.style === "rouge" ? c.rouge : x.style === "accent" || x.gras ? c.accent : c.texte);
  return (
    <div style={{ display: "flex", flexDirection: "column", width: w * f, alignItems: centre ? "center" : "flex-start" }}>
      {lignes.map((ligne, i) => (
        <div key={i} style={{ display: "flex", flexWrap: "wrap", justifyContent: centre ? "center" : "flex-start", columnGap: taille * 0.26 * f, rowGap: taille * (interligne - 0.9) * f }}>
          {groupes(ligne, { taille, w, ratio: 0.5 }).map((m, j) => {
            const surligne = m.marque === "surligne";
            const texte = (
              <Bloc
                key={j}
                m={m}
                style={(x) => ({
                  fontFamily: POLICE[police],
                  fontSize: taille * f,
                  fontWeight: poids,
                  lineHeight: 1,
                  letterSpacing: police === "display" ? -0.03 * taille * f : 0,
                  color: surligne ? c.surligneTexte : couleur(x),
                })}
              />
            );
            if (!surligne) return texte;
            return (
              <div key={j} style={{ display: "flex", alignItems: "center", height: taille * 0.98 * f, padding: `0 ${0.12 * taille * f}px`, backgroundColor: c.surligne }}>
                {texte}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function Texte({ el, f }) {
  return (
    <div style={{ position: "absolute", left: el.x * f, top: el.y * f, display: "flex" }}>
      <Mots segments={el.segments} taille={el.taille} f={f} c={el.c} poids={el.poids} police={el.police} interligne={el.interligne} centre={el.centre} w={el.w} />
    </div>
  );
}

// Libellé en police pixel (petit carré devant), ou étiquette de nom.
function Libelle({ el, f }) {
  return (
    <div style={{ position: "absolute", left: el.x * f, top: el.y * f, width: el.w * f, height: el.h * f, display: "flex", alignItems: "center", justifyContent: el.centre ? "center" : "flex-start", fontFamily: "Silkscreen", fontSize: el.taille * f, color: el.c.texte, whiteSpace: "nowrap" }}>
      {el.sansCarre ? null : <div style={{ width: el.taille * 0.45 * f, height: el.taille * 0.45 * f, backgroundColor: el.c.carre, marginRight: el.taille * 0.4 * f }} />}
      {el.texte}
    </div>
  );
}

// Fenêtre façon vieil ordinateur : barre canard, nom de fichier, photo tramée.
function Fenetre({ el, f, photos }) {
  const src = photos?.[el.image];
  const glitch = el.glitch ? `${-12 * f}px 0 0 ${transparence(el.c.glitchA, 0.75)}, ${12 * f}px 0 0 ${transparence(el.c.glitchB, 0.75)}` : null;
  return (
    <div
      style={{
        position: "absolute",
        left: el.x * f,
        top: el.y * f,
        width: el.w * f,
        display: "flex",
        flexDirection: "column",
        backgroundColor: el.c.corps,
        border: `${4 * f}px solid ${el.c.bord}`,
        boxShadow: glitch ?? ombreDouce(el.c.ombre, f, 0.7),
      }}
    >
      <div style={{ height: 52 * f, backgroundColor: el.c.barre, display: "flex", alignItems: "center", padding: `0 ${14 * f}px`, borderBottom: `${4 * f}px solid ${el.c.bord}`, fontFamily: "Silkscreen", fontSize: 22 * f, color: el.c.titre }}>
        <div style={{ width: 16 * f, height: 16 * f, border: `${3 * f}px solid ${el.c.titre}`, marginRight: 8 * f }} />
        <div style={{ width: 16 * f, height: 16 * f, border: `${3 * f}px solid ${el.c.titre}`, marginRight: 12 * f }} />
        <span style={{ display: "flex" }}>{el.nom}</span>
        <span style={{ marginLeft: "auto", fontFamily: "JetBrains Mono", fontSize: 18 * f }}>{el.image.endsWith("Mosaique") ? "chargement…" : "100%"}</span>
      </div>
      {src ? (
        <img src={src} alt="" width={el.w * f - 8 * f} height={el.hImage * f} style={{ width: el.w * f - 8 * f, height: el.hImage * f, objectFit: "cover", objectPosition: "top" }} />
      ) : (
        <div style={{ width: el.w * f - 8 * f, height: el.hImage * f, backgroundColor: el.c.corps }} />
      )}
    </div>
  );
}

// Portrait tramé, liseré jaune (programme, thématique).
function Portrait({ el, f, photos }) {
  const src = photos?.[el.image] ?? photos?.candidat;
  return (
    <div style={{ position: "absolute", left: el.x * f, top: el.y * f, width: el.w * f, height: el.h * f, display: "flex", backgroundColor: el.c.fond, border: `${8 * f}px solid ${el.c.liseré}` }}>
      {src ? <img src={src} alt="" width={el.w * f - 16 * f} height={el.h * f - 16 * f} style={{ objectFit: "cover", objectPosition: "top" }} /> : null}
    </div>
  );
}

// Médaillon rond dans la couleur du candidat, liseré jaune : couronne à sa
// couleur, photo tramée ronde au centre (visible même si la photo n'est pas
// détourée).
function Medaillon({ el, f, photos }) {
  const src = photos?.[el.image];
  const d = el.w * 0.74;
  return (
    <div style={{ position: "absolute", left: el.x * f, top: el.y * f, width: el.w * f, height: el.h * f, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 9999, backgroundColor: el.c.fond, border: `${7 * f}px solid ${el.c.liseré}` }}>
      {src ? <img src={src} alt="" width={d * f} height={d * f} style={{ width: d * f, height: d * f, borderRadius: 9999, objectFit: "cover", objectPosition: "top" }} /> : null}
    </div>
  );
}

// Haut de l'écran dans la couleur du candidat (scène `candidat`).
function Bandeau({ el, f }) {
  return <div style={{ position: "absolute", left: el.x * f, top: el.y * f, width: el.w * f, height: el.h * f, backgroundColor: el.c.fond, display: "flex" }} />;
}

function Pixel({ el, f }) {
  const img = dataUriPixel(el.nom, el.taille, { surFondSombre: el.surFondSombre });
  if (!img) return null;
  return <img src={img.src} alt="" width={img.largeur * f} height={img.hauteur * f} style={{ position: "absolute", left: el.x * f, top: el.y * f, ...(el.rotation ? { transform: `rotate(${el.rotation}deg)` } : {}) }} />;
}

function Carte({ el, f, cartes }) {
  const grille = cartes?.[el.cle];
  if (!grille) {
    return (
      <div style={{ position: "absolute", left: el.x * f, top: el.y * f, width: el.w * f, height: el.h * f, display: "flex", alignItems: "center", justifyContent: "center", border: `${3 * f}px dashed ${el.c.pays}`, color: el.c.pays, fontFamily: "Silkscreen", fontSize: 22 * f }}>
        carte {el.cle} manquante
      </div>
    );
  }
  const taille = Math.max(2, Math.floor(Math.min(el.w / grille[0].length, el.h / grille.length)));
  const img = dataUriCarte(grille, el.c.pays, taille);
  return (
    <div style={{ position: "absolute", left: el.x * f, top: el.y * f, width: el.w * f, height: el.h * f, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <img src={img.src} alt="" width={img.largeur * f} height={img.hauteur * f} />
    </div>
  );
}

// Barre faite de blocs (monte bloc par bloc).
function Colonne({ el, f }) {
  const n = Math.max(1, Math.floor((el.h + 6) / 40));
  return (
    <div style={{ position: "absolute", left: el.x * f, top: el.y * f, width: el.w * f, height: el.h * f, display: "flex", flexDirection: "column", justifyContent: "flex-end", opacity: el.fantome ? 0.5 : 1 }}>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} style={{ height: 34 * f, marginTop: 6 * f, backgroundColor: el.c.bloc, width: "100%" }} />
      ))}
    </div>
  );
}

// Grille de 100 cases dont les cases du score s'allument.
function Cases({ el, f }) {
  const gap = 6;
  const cote = (el.w - 19 * gap) / 20;
  return (
    <div style={{ position: "absolute", left: el.x * f, top: el.y * f, width: el.w * f, display: "flex", flexWrap: "wrap", columnGap: gap * f, rowGap: gap * f }}>
      {Array.from({ length: 100 }, (_, i) => (
        <div key={i} style={{ width: cote * f, height: cote * f, backgroundColor: i < el.allumees ? el.c.allume : transparence(el.c.eteint, 0.1) }} />
      ))}
    </div>
  );
}

// Jauge en blocs.
function Jauge({ el, f }) {
  const gap = 5;
  const w = (el.w - (el.blocs - 1) * gap) / el.blocs;
  return (
    <div style={{ position: "absolute", left: el.x * f, top: el.y * f, width: el.w * f, height: el.h * f, display: "flex", columnGap: gap * f }}>
      {Array.from({ length: el.blocs }, (_, i) => (
        <div key={i} style={{ width: w * f, height: el.h * f, backgroundColor: i < el.allumes ? el.c.allume : transparence(el.c.eteint, 0.12) }} />
      ))}
    </div>
  );
}

function Score({ el, f }) {
  return (
    <div style={{ position: "absolute", left: el.x * f, top: el.y * f, display: "flex", alignItems: "flex-end" }}>
      <span style={{ fontFamily: "Inter Display", fontWeight: 900, fontSize: el.taille * f, lineHeight: 0.85, letterSpacing: -0.06 * el.taille * f, color: el.c.valeur }}>{el.valeur}</span>
      <span style={{ fontFamily: "Inter Display", fontWeight: 900, fontSize: el.taille * 0.33 * f, lineHeight: 1, color: el.c.sur, marginLeft: 10 * f, marginBottom: el.taille * 0.05 * f }}>/100</span>
    </div>
  );
}

// Carte crème : picto, gros signe ou note, titre en police pixel, texte.
function CarteCreme({ el, f }) {
  const icone = el.icone ? dataUriPixel(el.icone, el.tailleIcone, { surFondSombre: false }) : null;
  const interieur = el.w - 2 * el.pad;
  const cTexte = { texte: el.c.texte, accent: el.c.texte, rouge: el.c.texte, surligne: el.c.fond, surligneTexte: el.c.texte };
  return (
    <div
      style={{
        position: "absolute",
        left: el.x * f,
        top: el.y * f,
        width: el.w * f,
        height: el.h * f,
        display: "flex",
        flexDirection: "column",
        alignItems: el.centre ? "center" : "flex-start",
        padding: `${el.pad * f}px`,
        backgroundColor: el.c.fond,
        boxShadow: ombreDouce(el.c.ombre, f),
      }}
    >
      {icone ? <img src={icone.src} alt="" width={icone.largeur * f} height={icone.hauteur * f} style={{ marginBottom: 14 * f }} /> : null}
      {el.gros ? <span style={{ fontFamily: "Inter Display", fontWeight: 900, fontSize: el.tailleGros * f, lineHeight: 1, color: el.c.gros, marginBottom: el.tailleGros * 0.25 * f }}>{el.gros}</span> : null}
      {el.titre ? <span style={{ fontFamily: "Silkscreen", fontSize: el.tailleTitre * f, color: el.c.titre, marginBottom: 12 * f, textTransform: "uppercase" }}>{el.titre}</span> : null}
      {el.texte ? <Mots segments={[{ t: el.texte, style: null }]} taille={el.tailleTexte} f={f} c={cTexte} poids={700} police="texte" interligne={1.22} centre={el.centre} w={interieur} /> : null}
    </div>
  );
}

// Bloc plein (proposition : « Répartition » + « Capitalisation »).
function BlocPlein({ el, f }) {
  return (
    <div style={{ position: "absolute", left: el.x * f, top: el.y * f, width: el.w * f, height: el.h * f, display: "flex", alignItems: "center", padding: `0 ${28 * f}px`, backgroundColor: el.c.fond, boxShadow: ombreDouce(el.c.ombre, f), fontFamily: "Inter Display", fontWeight: 900, fontSize: el.taille * f, letterSpacing: -0.03 * el.taille * f, color: el.c.texte }}>
      {el.texte}
    </div>
  );
}

function Tampon({ el, f }) {
  return (
    <div style={{ position: "absolute", left: el.x * f, top: el.y * f, height: el.h * f, display: "flex", alignItems: "center", padding: `0 ${22 * f}px`, border: `${5 * f}px solid ${el.c.bord}`, color: el.c.texte, fontFamily: "Silkscreen", fontSize: el.taille * f, transform: `rotate(${el.rotation}deg)`, whiteSpace: "nowrap" }}>
      {el.texte}
    </div>
  );
}

// Barre d'adresse crème, adresse tapée lettre à lettre, curseur moutarde.
function Adresse({ el, f }) {
  return (
    <div style={{ position: "absolute", left: el.x * f, top: el.y * f, width: el.w * f, height: el.h * f, display: "flex", alignItems: "center", padding: `0 ${30 * f}px`, backgroundColor: el.c.fond, color: el.c.texte, boxShadow: ombreDouce(el.c.ombre, f), fontFamily: "JetBrains Mono", fontSize: el.taille * f }}>
      <div style={{ width: 30 * f, height: 30 * f, border: `${6 * f}px solid ${el.c.loupe}`, borderRadius: 999, marginRight: 24 * f }} />
      <span>{el.texte}</span>
      <div style={{ width: 6 * f, height: 52 * f, backgroundColor: el.c.curseur, marginLeft: 6 * f }} />
    </div>
  );
}

function Compteur({ el, f }) {
  return (
    <div style={{ position: "absolute", left: el.x * f, top: el.y * f, display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
      <span style={{ fontFamily: "Inter Display", fontWeight: 900, fontSize: el.taille * f, lineHeight: 0.9, letterSpacing: -0.05 * el.taille * f, color: el.c.valeur }}>{el.valeur}</span>
      <span style={{ fontFamily: "Inter Display", fontWeight: 900, fontSize: 70 * f, color: el.c.unite, marginTop: 10 * f }}>{el.unite}</span>
    </div>
  );
}

// Sous-titres : blanc, gras, centré, ombre douce, sans boîte ni contour ;
// mot clé en moutarde ; une ligne par groupe de 8 mots au plus.
function SousTitre({ el, f }) {
  return (
    <div style={{ position: "absolute", left: el.x * f, top: el.y * f, width: el.w * f, display: "flex", flexDirection: "column", alignItems: "center" }}>
      {el.lignes.map((ligne, i) => (
        <div key={i} style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", columnGap: el.taille * 0.25 * f, marginBottom: el.taille * 0.12 * f }}>
          {groupes(motsMarques(ligne).flat(), { taille: el.taille, w: el.w, ratio: 0.53, groupeGras: true }).map((m, j) => (
            <Bloc key={j} m={m} style={(x) => ({ fontFamily: "Inter Display", fontWeight: 900, fontSize: el.taille * f, lineHeight: 1, color: x.gras ? el.c.cle : el.c.texte, textShadow: `0 ${3 * f}px ${12 * f}px ${transparence(el.c.ombre, 0.9)}` })} />
          ))}
        </div>
      ))}
    </div>
  );
}

const DESSINS = {
  texte: Texte,
  libelle: Libelle,
  fenetre: Fenetre,
  portrait: Portrait,
  medaillon: Medaillon,
  bandeau: Bandeau,
  pixel: Pixel,
  carte: Carte,
  colonne: Colonne,
  cases: Cases,
  jauge: Jauge,
  score: Score,
  carteCreme: CarteCreme,
  bloc: BlocPlein,
  tampon: Tampon,
  adresse: Adresse,
  compteur: Compteur,
  sousTitre: SousTitre,
};

function Element({ el, f, photos, cartes }) {
  const Dessin = DESSINS[el.genre];
  return Dessin ? <Dessin el={el} f={f} photos={photos} cartes={cartes} /> : null;
}

// En-tête : « / PERLIMPINPIN » à gauche, « nom · thème » en chasse fixe à
// droite, barre de progression en segments moutarde (un par scène).
function EnTete({ f, numero, total, info }) {
  const C = COULEURS_CADRE;
  return [
    <div key="marque" style={{ position: "absolute", left: 72 * f, top: 150 * f, width: 936 * f, display: "flex", alignItems: "center", fontFamily: "Silkscreen", fontSize: 30 * f, color: C.logo }}>
      / PERLIMPINPIN
      <span style={{ marginLeft: "auto", fontFamily: "JetBrains Mono", fontSize: 24 * f, color: C.info }}>{info}</span>
    </div>,
    <div key="progression" style={{ position: "absolute", left: 72 * f, top: 206 * f, width: 936 * f, display: "flex", columnGap: 8 * f }}>
      {Array.from({ length: total }, (_, k) => (
        <div key={k} style={{ flex: 1, height: 10 * f, backgroundColor: k < numero ? C.progression : transparence(C.progressionEteinte, 0.15) }} />
      ))}
    </div>,
  ];
}

// Une image 1080 × 1920 (à l'échelle f). calque : null (image complète),
// "fond", "visuel" ou "texte" (PNG transparents alignés sur l'image).
// Fond charbon granuleux (grain, grille de pixels discrète), voile de lignes
// de balayage par-dessus.
export function Cadre({ elements, f = 1, fonds, photos, cartes, entete = null, calque = null }) {
  const avecFond = !calque || calque === "fond";
  const visibles = calque === "fond" ? [] : elements.filter((el) => !calque || el.calque === calque || (calque === "visuel" && el.calque === "fond-scene"));
  return (
    <div style={{ position: "relative", width: LARGEUR * f, height: HAUTEUR * f, display: "flex", overflow: "hidden", backgroundColor: avecFond ? COULEURS_CADRE.fond : "transparent" }}>
      {avecFond && fonds?.fond ? <img src={fonds.fond} alt="" width={LARGEUR * f} height={HAUTEUR * f} style={{ position: "absolute", left: 0, top: 0 }} /> : null}
      {visibles.filter((el) => el.calque === "fond-scene").map((el) => <Element key={el.id} el={el} f={f} photos={photos} cartes={cartes} />)}
      {avecFond && entete ? EnTete({ f, ...entete }) : null}
      {visibles
        .filter((el) => el.calque !== "fond-scene")
        .map((el) => (
          <Element key={el.id} el={el} f={f} photos={photos} cartes={cartes} />
        ))}
      {avecFond && fonds?.voile ? <img src={fonds.voile} alt="" width={LARGEUR * f} height={HAUTEUR * f} style={{ position: "absolute", left: 0, top: 0 }} /> : null}
    </div>
  );
}

// Texte de droite de l'en-tête : « riner · retraites », « tondelier · programme »,
// « retraites · 5 candidats ».
function infoEntete(etat) {
  if (etat.format === "programme") return `${nomDeFamille(etat.candidatNom)} · programme`.toLowerCase();
  if (etat.format === "thematique") return `${etat.themeCourt ?? etat.theme} · ${etat.ctx?.candidats?.length ?? ""} candidats`.toLowerCase();
  return `${nomDeFamille(etat.candidatNom)} · ${etat.theme}`.toLowerCase();
}

// Contexte de mise en page d'un état (format, candidats, mesures…).
export function ctxEtat(etat) {
  return { format: etat.format ?? "mesure", candidatNom: etat.candidatNom, theme: etat.theme, ...(etat.ctx ?? {}) };
}

// Image clé k de la scène i (0-based).
export function elementImageCle({ etat, i, k, f = 1, ressources, calque = null }) {
  const scenes = etat.storyboard.scenes;
  return <Cadre elements={dispositionImage(scenes[i], k, ctxEtat(etat))} f={f} {...ressources} calque={calque} entete={{ numero: i + 1, total: scenes.length, info: infoEntete(etat) }} />;
}

export function elementCouverture({ etat, ressources }) {
  return <Cadre elements={dispositionCouverture(etat.couverture, ctxEtat(etat))} {...ressources} />;
}

// --- Planche : les 3 images clés d'une scène, la voix et le mouvement ---------------

export const PLANCHE = { f: 0.4, marge: 48, gap: 32, hautTexte: 330, entete: 110 };
export const LARGEUR_PLANCHE = Math.round(2 * PLANCHE.marge + 3 * LARGEUR * PLANCHE.f + 2 * PLANCHE.gap);
export const HAUTEUR_PLANCHE = Math.round(2 * PLANCHE.marge + PLANCHE.entete + HAUTEUR * PLANCHE.f + PLANCHE.hautTexte);

function TexteMarque({ texte: t, taille }) {
  const P = COULEURS_PLANCHE;
  const mots = groupes(motsMarques(t).flat(), { taille, w: 380, ratio: 0.55, groupeGras: true });
  return (
    <div style={{ display: "flex", flexWrap: "wrap", columnGap: taille * 0.26, rowGap: 6 }}>
      {mots.map((m, i) => (
        <Bloc key={i} m={m} style={(x) => ({ fontFamily: "Inter Display", fontWeight: x.gras ? 900 : 600, fontSize: taille, lineHeight: 1.2, color: P.encre, ...(x.gras ? { backgroundColor: P.jaune } : {}), padding: x.gras ? "0 4px" : 0 })} />
      ))}
    </div>
  );
}

export function elementPlanche({ etat, i, ressources }) {
  const P = COULEURS_PLANCHE;
  const scene = etat.storyboard.scenes[i];
  const temps = etat.temps.scenes[i];
  const duree = temps.fin - temps.debut;
  const largeurImage = LARGEUR * PLANCHE.f;
  const sujet = etat.format === "thematique" ? `${etat.themeCourt ?? etat.theme} · thématique` : etat.format === "programme" ? `${etat.candidatNom} · programme` : `${etat.candidatNom} · ${etat.theme}`;
  return (
    <div style={{ width: LARGEUR_PLANCHE, height: HAUTEUR_PLANCHE, display: "flex", flexDirection: "column", backgroundColor: P.papier, padding: PLANCHE.marge, fontFamily: "Inter Display" }}>
      <div style={{ height: PLANCHE.entete, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", fontSize: (TYPES_SCENES[scene.type]?.nom ?? scene.type).length > 14 ? 36 : 46, fontWeight: 900, letterSpacing: -1.2, color: P.encre }}>
            {`${i + 1}. ${TYPES_SCENES[scene.type]?.nom ?? scene.type}`}
            <span style={{ marginLeft: 18, fontFamily: "Silkscreen", fontSize: 26, fontWeight: 400, color: P.encre, backgroundColor: P.jaune, padding: "4px 12px" }}>{scene.type}</span>
          </div>
          <div style={{ display: "flex", fontSize: 26, fontWeight: 700, color: P.accent, marginTop: 8 }}>
            {`${formatTemps(temps.debut)} – ${formatTemps(temps.fin)} · ${duree.toFixed(1).replace(".", ",")} s${etat.temps.estime ? " (estimé)" : ""}`}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", fontSize: 20, color: P.gris, maxWidth: 520 }}>
          <span>{`Storyboard Reel · ${sujet}`}</span>
          <span>{`Planche ${String(i + 1).padStart(2, "0")} sur ${String(etat.storyboard.scenes.length).padStart(2, "0")} · mode ${etat.mode}`}</span>
        </div>
      </div>
      <div style={{ display: "flex", columnGap: PLANCHE.gap }}>
        {[1, 2, 3].map((k) => (
          <div key={k} style={{ width: largeurImage, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", width: largeurImage, height: HAUTEUR * PLANCHE.f, boxShadow: `0 6px 20px ${transparence(P.encre, 0.25)}` }}>{elementImageCle({ etat, i, k, f: PLANCHE.f, ressources })}</div>
            <div style={{ display: "flex", alignItems: "flex-start", marginTop: 18 }}>
              <div style={{ width: 36, height: 36, flexShrink: 0, backgroundColor: P.accent, color: P.numero, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 900, marginRight: 12 }}>{String(k)}</div>
              <div style={{ display: "flex", flexDirection: "column", width: largeurImage - 48 }}>
                <span style={{ fontSize: 17, color: P.gris, fontWeight: 600, marginBottom: 4 }}>VOIX OFF</span>
                <TexteMarque texte={scene.voix[k - 1]} taille={22} />
                <span style={{ fontSize: 17, color: P.gris, fontWeight: 600, marginTop: 12, marginBottom: 4 }}>MOUVEMENT</span>
                <span style={{ fontSize: 19, lineHeight: 1.3, color: P.texte, fontWeight: 500 }}>{sansGras(scene.mouvement[k - 1])}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
