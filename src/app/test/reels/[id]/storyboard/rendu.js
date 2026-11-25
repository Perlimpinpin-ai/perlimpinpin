/* eslint-disable @next/next/no-img-element -- next/og (Satori) ne connaît que <img>. */
import { COULEURS, dataUriCarte, dataUriPixel, etincelles } from "@/lib/reel-pixel";
import { HAUTEUR, LARGEUR, dispositionCouverture, dispositionImage, motsMarques } from "@/lib/reel-disposition";
import { TYPES_SCENES, formatTemps, sansGras } from "@/lib/reel-storyboard";

// Rendu next/og des images du storyboard (v4) : images clés 1080 × 1920,
// couverture, calques et planches. Les positions viennent toutes de
// src/lib/reel-disposition.js (les mêmes boîtes servent au contrôle des zones
// sûres) ; ici, seulement le dessin. JSX pour Satori : flexbox, pas de grid.
// `f` : échelle (1 pour une image, 0,4 dans une planche).

const POLICE = { display: "Inter Display", pixel: "Silkscreen", mono: "JetBrains Mono", texte: "Inter Display" };

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

function Mots({ segments, taille, f, couleur, poids, police, interligne = 1, centre = false, w }) {
  const mots = segments.flatMap((seg) =>
    motsMarques(seg.t).flatMap((ligne, i) => [...(i > 0 ? [{ saut: true }] : []), ...ligne.map((m) => ({ ...m, style: seg.style }))]),
  );
  const lignes = [[]];
  for (const m of mots) (m.saut ? lignes.push([]) : lignes.at(-1).push(m));
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
                  fontWeight: x.gras && poids < 900 ? 900 : poids,
                  lineHeight: 1,
                  letterSpacing: police === "display" ? -0.03 * taille * f : 0,
                  color: surligne ? COULEURS.encre : x.style === "rouge" ? COULEURS.rouge : couleur,
                })}
              />
            );
            if (!surligne) return texte;
            return (
              <div
                key={j}
                style={{
                  display: "flex",
                  alignItems: "center",
                  height: taille * 0.98 * f,
                  padding: `0 ${0.12 * taille * f}px`,
                  backgroundColor: COULEURS.jaune,
                  boxShadow: `${8 * f}px ${8 * f}px 0 ${COULEURS.rose}`,
                }}
              >
                {texte}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function Etiquette({ el, f }) {
  const plein = !el.contour;
  return (
    <div
      style={{
        position: "absolute",
        left: el.x * f,
        top: el.y * f,
        height: el.h * f,
        display: "flex",
        alignItems: "center",
        padding: `0 ${18 * f}px`,
        fontFamily: "Silkscreen",
        fontSize: el.taille * f,
        color: plein ? COULEURS.encre : el.couleur,
        backgroundColor: plein ? el.couleur : "transparent",
        border: plein ? "none" : `${3 * f}px solid ${el.couleur}`,
        ...(plein ? { boxShadow: `${6 * f}px ${6 * f}px 0 ${COULEURS.rose}` } : {}),
        whiteSpace: "nowrap",
      }}
    >
      {el.texte}
    </div>
  );
}

function Fenetre({ el, f, photos }) {
  const src = photos?.[el.image];
  return (
    <div
      style={{
        position: "absolute",
        left: el.x * f,
        top: el.y * f,
        width: el.w * f,
        display: "flex",
        flexDirection: "column",
        backgroundColor: COULEURS.lavande,
        border: `${4 * f}px solid #fff`,
        boxShadow: el.glitch
          ? `${-14 * f}px 0 0 rgba(255,95,210,0.7), ${14 * f}px 0 0 rgba(61,220,255,0.6)`
          : `${12 * f}px ${12 * f}px 0 rgba(0,0,0,0.55)`,
        ...(el.rotation ? { transform: `rotate(${el.rotation}deg)` } : {}),
      }}
    >
      <div
        style={{
          height: 52 * f,
          backgroundColor: COULEURS.violet,
          display: "flex",
          alignItems: "center",
          padding: `0 ${14 * f}px`,
          borderBottom: `${4 * f}px solid ${COULEURS.encre}`,
          fontFamily: "Silkscreen",
          fontSize: 22 * f,
          color: "#fff",
        }}
      >
        <div style={{ width: 16 * f, height: 16 * f, backgroundColor: "#fff", marginRight: 8 * f, border: `${3 * f}px solid ${COULEURS.encre}` }} />
        <div style={{ width: 16 * f, height: 16 * f, backgroundColor: "#fff", marginRight: 12 * f, border: `${3 * f}px solid ${COULEURS.encre}` }} />
        <span style={{ display: "flex" }}>{el.nom}</span>
        <span style={{ marginLeft: "auto", fontFamily: "JetBrains Mono", fontSize: 18 * f, opacity: 0.8 }}>100%</span>
      </div>
      {src ? (
        <img src={src} alt="" width={el.w * f - 8 * f} height={el.hImage * f} style={{ width: el.w * f - 8 * f, height: el.hImage * f, objectFit: "cover", objectPosition: "top" }} />
      ) : (
        <div style={{ width: el.w * f - 8 * f, height: el.hImage * f, backgroundColor: COULEURS.violetFonce }} />
      )}
    </div>
  );
}

function Pixel({ el, f }) {
  const img = dataUriPixel(el.nom, el.taille);
  if (!img) return null;
  return (
    <img
      src={img.src}
      alt=""
      width={img.largeur * f}
      height={img.hauteur * f}
      style={{ position: "absolute", left: el.x * f, top: el.y * f, ...(el.rotation ? { transform: `rotate(${el.rotation}deg)` } : {}) }}
    />
  );
}

function Carte({ el, f, cartes }) {
  const grille = cartes?.[el.cle];
  if (!grille) {
    return (
      <div style={{ position: "absolute", left: el.x * f, top: el.y * f, width: el.w * f, height: el.h * f, display: "flex", alignItems: "center", justifyContent: "center", border: `${3 * f}px dashed ${el.couleur}`, color: el.couleur, fontFamily: "Silkscreen", fontSize: 22 * f }}>
        carte {el.cle} manquante
      </div>
    );
  }
  const taille = Math.max(2, Math.floor(Math.min(el.w / grille[0].length, el.h / grille.length)));
  const img = dataUriCarte(grille, el.couleur, taille);
  return (
    <div style={{ position: "absolute", left: el.x * f, top: el.y * f, width: el.w * f, height: el.h * f, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <img src={img.src} alt="" width={img.largeur * f} height={img.hauteur * f} />
    </div>
  );
}

function Colonne({ el, f }) {
  const n = Math.max(1, Math.floor((el.h + 6) / 40));
  return (
    <div style={{ position: "absolute", left: el.x * f, top: el.y * f, width: el.w * f, height: el.h * f, display: "flex", flexDirection: "column", justifyContent: "flex-end", opacity: el.fantome ? 0.55 : 1 }}>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} style={{ height: 34 * f, marginTop: 6 * f, backgroundColor: el.couleur, width: "100%" }} />
      ))}
    </div>
  );
}

function Cases({ el, f }) {
  const gap = 6;
  const cote = (el.w - 19 * gap) / 20;
  return (
    <div style={{ position: "absolute", left: el.x * f, top: el.y * f, width: el.w * f, display: "flex", flexWrap: "wrap", columnGap: gap * f, rowGap: gap * f }}>
      {Array.from({ length: 100 }, (_, i) => (
        <div key={i} style={{ width: cote * f, height: cote * f, backgroundColor: i < el.allumees ? COULEURS.jaune : "rgba(255,255,255,0.12)" }} />
      ))}
    </div>
  );
}

function Score({ el, f }) {
  return (
    <div style={{ position: "absolute", left: el.x * f, top: el.y * f, display: "flex", alignItems: "flex-end" }}>
      <span style={{ fontFamily: "Inter Display", fontWeight: 900, fontSize: 330 * f, lineHeight: 0.85, letterSpacing: -0.06 * 330 * f, color: COULEURS.jaune }}>{String(el.valeur)}</span>
      <span style={{ fontFamily: "Inter Display", fontWeight: 900, fontSize: 110 * f, lineHeight: 1, color: "rgba(255,255,255,0.6)", marginLeft: 12 * f, marginBottom: 14 * f }}>/100</span>
    </div>
  );
}

function CarteTexte({ el, f }) {
  const icone = el.icone ? dataUriPixel(el.icone, el.tailleIcone) : null;
  const interieur = el.w - 2 * el.pad;
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
        backgroundColor: el.fond,
        border: `${4 * f}px solid #fff`,
        boxShadow: `${10 * f}px ${10 * f}px 0 rgba(0,0,0,0.5)`,
      }}
    >
      {icone && !el.iconeEnLigne ? <img src={icone.src} alt="" width={icone.largeur * f} height={icone.hauteur * f} style={{ marginBottom: 14 * f }} /> : null}
      {el.titre ? (
        <div style={{ display: "flex", alignItems: "center" }}>
          {icone && el.iconeEnLigne ? <img src={icone.src} alt="" width={icone.largeur * f} height={icone.hauteur * f} style={{ marginRight: 16 * f }} /> : null}
          <Mots segments={[{ t: el.titre, style: null }]} taille={el.tailleTitre} f={f} couleur={el.couleurTitre} poids={900} police="display" interligne={1.05} centre={el.centre} w={interieur - (icone && el.iconeEnLigne ? icone.largeur + 16 : 0)} />
        </div>
      ) : null}
      {el.texte ? (
        <div style={{ display: "flex", marginTop: el.titre ? 8 * f : 0 }}>
          <Mots segments={[{ t: el.texte, style: null }]} taille={el.tailleTexte} f={f} couleur={COULEURS.encre} poids={500} police="texte" interligne={1.25} centre={el.centre} w={interieur} />
        </div>
      ) : null}
    </div>
  );
}

function Tampon({ el, f }) {
  return (
    <div
      style={{
        position: "absolute",
        left: el.x * f,
        top: el.y * f,
        height: el.h * f,
        display: "flex",
        alignItems: "center",
        padding: `0 ${22 * f}px`,
        border: `${5 * f}px solid ${el.couleur}`,
        color: el.couleur,
        fontFamily: "Silkscreen",
        fontSize: el.taille * f,
        transform: `rotate(${el.rotation}deg)`,
        whiteSpace: "nowrap",
      }}
    >
      {el.texte}
    </div>
  );
}

function Recherche({ el, f }) {
  return (
    <div
      style={{
        position: "absolute",
        left: el.x * f,
        top: el.y * f,
        width: el.w * f,
        height: el.h * f,
        display: "flex",
        alignItems: "center",
        padding: `0 ${30 * f}px`,
        backgroundColor: "#fff",
        color: COULEURS.encre,
        border: `${4 * f}px solid ${COULEURS.encre}`,
        boxShadow: `${10 * f}px ${10 * f}px 0 ${COULEURS.violet}`,
        fontFamily: "Inter Display",
        fontWeight: 700,
        fontSize: el.taille * f,
      }}
    >
      <div style={{ width: 30 * f, height: 30 * f, border: `${6 * f}px solid ${COULEURS.encre}`, borderRadius: 999, marginRight: 24 * f }} />
      <span>{el.texte}</span>
      <div style={{ width: 5 * f, height: 50 * f, backgroundColor: COULEURS.encre, marginLeft: 6 * f }} />
    </div>
  );
}

function Compteur({ el, f }) {
  return (
    <div style={{ position: "absolute", left: el.x * f, top: el.y * f, display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
      <span
        style={{
          fontFamily: "Inter Display",
          fontWeight: 900,
          fontSize: el.taille * f,
          lineHeight: 0.9,
          letterSpacing: -0.05 * el.taille * f,
          color: el.surligne ? COULEURS.encre : "#fff",
          ...(el.surligne ? { backgroundColor: COULEURS.jaune } : {}),
          ...(el.surligne ? { boxShadow: `${8 * f}px ${8 * f}px 0 ${COULEURS.rose}` } : {}),
          padding: el.surligne ? `${6 * f}px ${16 * f}px` : 0,
        }}
      >
        {el.valeur}
      </span>
      <span style={{ fontFamily: "Inter Display", fontWeight: 900, fontSize: 70 * f, color: "#fff", marginTop: 10 * f }}>{el.unite}</span>
    </div>
  );
}

function Texte({ el, f }) {
  return (
    <div style={{ position: "absolute", left: el.x * f, top: el.y * f, display: "flex", ...(el.police === "display" ? { textShadow: `0 0 ${34 * f}px rgba(140,107,255,0.35)` } : {}) }}>
      <Mots segments={el.segments} taille={el.taille} f={f} couleur={el.couleur} poids={el.poids} police={el.police} interligne={el.interligne} centre={el.centre} w={el.w} />
    </div>
  );
}

function SousTitre({ el, f }) {
  const mots = groupes(motsMarques(el.texte).flat(), { taille: el.taille, w: el.w - 2 * el.pad.h, ratio: 0.53, groupeGras: true });
  return (
    <div style={{ position: "absolute", left: el.x * f, top: el.y * f, width: el.w * f, display: "flex", justifyContent: "center" }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          columnGap: el.taille * 0.24 * f,
          rowGap: el.taille * 0.12 * f,
          padding: `${el.pad.v * f}px ${el.pad.h * f}px`,
          backgroundColor: "#fff",
          boxShadow: `${8 * f}px ${8 * f}px 0 ${COULEURS.violet}`,
        }}
      >
        {mots.map((m, i) => (
          <Bloc
            key={i}
            m={m}
            style={(x) => ({
              fontFamily: "Inter Display",
              fontWeight: 700,
              fontSize: el.taille * f,
              lineHeight: 1,
              color: COULEURS.encre,
              ...(x.gras ? { backgroundColor: COULEURS.jaune } : {}),
              padding: x.gras ? `0 ${5 * f}px` : 0,
            })}
          />
        ))}
      </div>
    </div>
  );
}

const DESSINS = {
  texte: Texte,
  etiquette: Etiquette,
  fenetre: Fenetre,
  pixel: Pixel,
  carte: Carte,
  colonne: Colonne,
  cases: Cases,
  score: Score,
  carteTexte: CarteTexte,
  tampon: Tampon,
  recherche: Recherche,
  compteur: Compteur,
  sousTitre: SousTitre,
};

function Element({ el, f, photos, cartes }) {
  const Dessin = DESSINS[el.genre];
  return Dessin ? <Dessin el={el} f={f} photos={photos} cartes={cartes} /> : null;
}

// En-tête du kit : « / PERLIMPINPIN », candidat · thème, barre de progression.
function EnTete({ f, numero, total, candidatNom, theme }) {
  return [
      <div key="marque" style={{ position: "absolute", left: 72 * f, top: 150 * f, width: 936 * f, display: "flex", alignItems: "center", fontFamily: "Silkscreen", fontSize: 30 * f, color: "#fff" }}>
        / PERLIMPINPIN
        <span style={{ marginLeft: "auto", fontFamily: "JetBrains Mono", fontSize: 24 * f, opacity: 0.7 }}>{`${candidatNom} · ${theme}`.toLowerCase()}</span>
      </div>,
      <div key="progression" style={{ position: "absolute", left: 72 * f, top: 206 * f, width: 936 * f, display: "flex", columnGap: 8 * f }}>
        {Array.from({ length: total }, (_, k) => (
          <div key={k} style={{ flex: 1, height: 8 * f, backgroundColor: k < numero ? COULEURS.jaune : "rgba(255,255,255,0.18)" }} />
        ))}
      </div>,
  ];
}

// Une image 1080 × 1920 (à l'échelle f). calque : null (image complète),
// "fond", "visuel" ou "texte" (PNG transparents alignés sur l'image).
export function Cadre({ elements, f = 1, fonds, photos, cartes, graine = 1, entete = null, calque = null }) {
  const avecFond = !calque || calque === "fond";
  const visibles = calque === "fond" ? [] : elements.filter((el) => !calque || el.calque === calque);
  return (
    <div style={{ position: "relative", width: LARGEUR * f, height: HAUTEUR * f, display: "flex", overflow: "hidden", backgroundColor: avecFond ? COULEURS.fond : "transparent" }}>
      {avecFond && fonds?.fond ? <img src={fonds.fond} alt="" width={LARGEUR * f} height={HAUTEUR * f} style={{ position: "absolute", left: 0, top: 0 }} /> : null}
      {avecFond
        ? etincelles(graine).map((p, i) => (
            <div key={`e${i}`} style={{ position: "absolute", left: p.x * f, top: p.y * f, width: 18 * f, height: 18 * f, backgroundColor: p.couleur, opacity: p.opacite }} />
          ))
        : null}
      {avecFond && entete ? EnTete({ f, ...entete }) : null}
      {visibles.map((el) => (
        <Element key={el.id} el={el} f={f} photos={photos} cartes={cartes} />
      ))}
      {avecFond && fonds?.voile ? <img src={fonds.voile} alt="" width={LARGEUR * f} height={HAUTEUR * f} style={{ position: "absolute", left: 0, top: 0 }} /> : null}
    </div>
  );
}

// Image clé k de la scène i (0-based).
export function elementImageCle({ etat, i, k, f = 1, ressources, calque = null }) {
  const scenes = etat.storyboard.scenes;
  const scene = scenes[i];
  const ctx = { candidatNom: etat.candidatNom, theme: etat.theme };
  return (
    <Cadre
      elements={dispositionImage(scene, k, ctx)}
      f={f}
      {...ressources}
      graine={i * 7 + k}
      calque={calque}
      entete={{ numero: i + 1, total: scenes.length, candidatNom: etat.candidatNom, theme: etat.theme }}
    />
  );
}

export function elementCouverture({ etat, ressources }) {
  const elements = dispositionCouverture(etat.couverture, { candidatNom: etat.candidatNom, theme: etat.theme });
  return <Cadre elements={elements} {...ressources} graine={99} />;
}

// --- Planche : les 3 images clés d'une scène, la voix et le mouvement ---------------

export const PLANCHE = { f: 0.4, marge: 48, gap: 32, hautTexte: 330, entete: 110 };
export const LARGEUR_PLANCHE = Math.round(2 * PLANCHE.marge + 3 * LARGEUR * PLANCHE.f + 2 * PLANCHE.gap);
export const HAUTEUR_PLANCHE = Math.round(2 * PLANCHE.marge + PLANCHE.entete + HAUTEUR * PLANCHE.f + PLANCHE.hautTexte);

function TexteMarque({ texte: t, taille }) {
  const mots = groupes(motsMarques(t).flat(), { taille, w: 380, ratio: 0.55, groupeGras: true });
  return (
    <div style={{ display: "flex", flexWrap: "wrap", columnGap: taille * 0.26, rowGap: 6 }}>
      {mots.map((m, i) => (
        <Bloc key={i} m={m} style={(x) => ({ fontFamily: "Inter Display", fontWeight: x.gras ? 900 : 600, fontSize: taille, lineHeight: 1.2, color: "#141413", ...(x.gras ? { backgroundColor: COULEURS.jaune } : {}), padding: x.gras ? "0 4px" : 0 })} />
      ))}
    </div>
  );
}

export function elementPlanche({ etat, i, ressources }) {
  const scene = etat.storyboard.scenes[i];
  const temps = etat.temps.scenes[i];
  const duree = temps.fin - temps.debut;
  const largeurImage = LARGEUR * PLANCHE.f;
  return (
    <div style={{ width: LARGEUR_PLANCHE, height: HAUTEUR_PLANCHE, display: "flex", flexDirection: "column", backgroundColor: "#F1ECE2", padding: PLANCHE.marge, fontFamily: "Inter Display" }}>
      <div style={{ height: PLANCHE.entete, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", fontSize: 46, fontWeight: 900, letterSpacing: -1.2, color: "#141413" }}>
            {`${i + 1}. ${TYPES_SCENES[scene.type]?.nom ?? scene.type}`}
            <span style={{ marginLeft: 18, fontFamily: "Silkscreen", fontSize: 26, fontWeight: 400, color: COULEURS.encre, backgroundColor: COULEURS.jaune, padding: "4px 12px" }}>{scene.type}</span>
          </div>
          <div style={{ display: "flex", fontSize: 26, fontWeight: 700, color: COULEURS.violet, marginTop: 8 }}>
            {`${formatTemps(temps.debut)} – ${formatTemps(temps.fin)} · ${duree.toFixed(1).replace(".", ",")} s${etat.temps.estime ? " (estimé)" : ""}`}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", fontSize: 22, color: "#6E6A62" }}>
          <span>{`Storyboard Reel · ${etat.candidatNom} · ${etat.theme}`}</span>
          <span>{`Planche ${String(i + 1).padStart(2, "0")} sur ${String(etat.storyboard.scenes.length).padStart(2, "0")} · mode ${etat.mode}`}</span>
        </div>
      </div>
      <div style={{ display: "flex", columnGap: PLANCHE.gap }}>
        {[1, 2, 3].map((k) => (
          <div key={k} style={{ width: largeurImage, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", width: largeurImage, height: HAUTEUR * PLANCHE.f, boxShadow: "0 6px 20px rgba(0,0,0,0.25)" }}>
              {elementImageCle({ etat, i, k, f: PLANCHE.f, ressources })}
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", marginTop: 18 }}>
              <div style={{ width: 36, height: 36, flexShrink: 0, backgroundColor: COULEURS.violet, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 900, marginRight: 12 }}>{String(k)}</div>
              <div style={{ display: "flex", flexDirection: "column", width: largeurImage - 48 }}>
                <span style={{ fontSize: 17, color: "#6E6A62", fontWeight: 600, marginBottom: 4 }}>VOIX OFF</span>
                <TexteMarque texte={scene.voix[k - 1]} taille={22} />
                <span style={{ fontSize: 17, color: "#6E6A62", fontWeight: 600, marginTop: 12, marginBottom: 4 }}>MOUVEMENT</span>
                <span style={{ fontSize: 19, lineHeight: 1.3, color: "#2A2926", fontWeight: 500 }}>{sansGras(scene.mouvement[k - 1])}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
