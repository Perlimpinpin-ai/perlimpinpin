/* eslint-disable @next/next/no-img-element -- next/og (Satori) ne connaît que <img>. */
import { lignesEstimees } from "@/lib/carte";
import { HAUTEUR_REEL, LARGEUR_REEL } from "@/lib/reel";

// Mise en page des 9 images 1080 × 1920 d'un Reel (JSX pour next/og : flexbox
// seulement, ni grid ni filter). Les données arrivent prêtes depuis route.js.
//
// Zone sûre : tout le texte important reste au centre. Instagram et TikTok
// masquent le haut (nom du compte), le bas (légende, musique) et la colonne
// de droite (boutons j'aime, commentaire, partage).
const ZONE = { gauche: 90, droite: 200, haut: 250, bas: 400 };
const LARGEUR_UTILE = LARGEUR_REEL - ZONE.gauche - ZONE.droite; // 790 px

// Couleurs par thème. Accent de la charte : jaune. Jamais de rouge ni de vert
// hors du score (scène 8, couleur du palier lue dans src/lib/carte.js).
export const PALETTES = {
  sombre: {
    texte: "#ffffff",
    secondaire: "rgba(255,255,255,0.78)",
    accent: "#ffd23f",
    caseEteinte: "rgba(255,255,255,0.13)",
    voile: "rgba(10,15,46,0.35)",
  },
  clair: {
    texte: "#14163a",
    secondaire: "#474b73",
    accent: "#b98500",
    caseEteinte: "rgba(27,31,74,0.10)",
    voile: "rgba(255,255,255,0.45)",
  },
};

// Plus grande taille (parmi `tailles`) qui tient en `maxLignes` lignes sur la
// largeur utile. Geist est un peu plus large qu'Inter : ratio 0,5.
function taille(texte, tailles, maxLignes, ratio = 0.5) {
  for (const t of tailles) {
    if (lignesEstimees(texte, t, LARGEUR_UTILE, ratio) <= maxLignes) return t;
  }
  return tailles[tailles.length - 1];
}

// Grand chiffre sur une ligne si possible (environ 0,58 × la taille par caractère).
function tailleChiffre(valeur) {
  const longueur = Math.max(1, Array.from(String(valeur ?? "")).length);
  return Math.max(96, Math.min(230, Math.floor(LARGEUR_UTILE / (longueur * 0.58))));
}

// --- Éléments communs ---------------------------------------------------------

// Satori dispose les fragments React en ligne : chaque scène est donc une vraie
// colonne.
function Colonne({ children }) {
  return <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", width: LARGEUR_UTILE }}>{children}</div>;
}

function Logo({ p, grand = false }) {
  const t = grand ? 46 : 30;
  return (
    <div style={{ display: "flex", alignItems: "center", fontFamily: "Geist", fontWeight: 500, fontSize: t, letterSpacing: t * 0.3, color: p.texte }}>
      <div style={{ width: t * 0.17, height: t * 1.5, backgroundColor: p.accent, transform: "skewX(-22deg)", marginRight: t * 0.7 }} />
      PERLIMPINPIN
    </div>
  );
}

function Etiquette({ p, children }) {
  return (
    <div style={{ display: "flex", fontFamily: "Geist Mono", fontWeight: 500, fontSize: 34, letterSpacing: 6, color: p.accent, marginBottom: 36 }}>
      {children}
    </div>
  );
}

function Icone({ src, taille: t = 220, marge = 48 }) {
  if (!src) return null;
  return <img src={src} alt="" width={t} height={t} style={{ marginBottom: marge }} />;
}

// Cadre commun : fond, logo en haut de la zone sûre, contenu centré dans la
// zone sûre.
function Cadre({ fond, p, children, logo = true }) {
  return (
    <div style={{ position: "relative", display: "flex", width: LARGEUR_REEL, height: HAUTEUR_REEL, fontFamily: "Geist", color: p.texte }}>
      <img src={fond} alt="" width={LARGEUR_REEL} height={HAUTEUR_REEL} style={{ position: "absolute", left: 0, top: 0 }} />
      {logo ? (
        <div style={{ position: "absolute", left: ZONE.gauche, top: ZONE.haut, display: "flex" }}>
          <Logo p={p} />
        </div>
      ) : null}
      <div
        style={{
          position: "absolute",
          left: ZONE.gauche,
          top: ZONE.haut + 90,
          width: LARGEUR_UTILE,
          height: HAUTEUR_REEL - ZONE.haut - 90 - ZONE.bas,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "flex-start",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Titre({ p, texte, tailles = [92, 80, 70, 62, 54], maxLignes = 4 }) {
  if (!texte) return null;
  const t = taille(texte, tailles, maxLignes);
  return <div style={{ display: "flex", fontWeight: 700, fontSize: t, lineHeight: 1.08, letterSpacing: -t * 0.025, color: p.texte }}>{texte}</div>;
}

function Chiffre({ p, valeur, legende }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {valeur ? (
        <div style={{ display: "flex", fontWeight: 700, fontSize: tailleChiffre(valeur), lineHeight: 1, letterSpacing: -4, color: p.accent }}>{valeur}</div>
      ) : null}
      {legende ? (
        <div style={{ display: "flex", marginTop: 28, fontWeight: 500, fontSize: taille(legende, [56, 50, 44], 3), lineHeight: 1.2, color: p.secondaire }}>
          {legende}
        </div>
      ) : null}
    </div>
  );
}

// --- Les 9 scènes -------------------------------------------------------------

function Accroche({ scene, p, icone }) {
  return (
    <Colonne>
      <div style={{ display: "flex", fontWeight: 700, fontSize: 56, lineHeight: 1.15, color: p.secondaire, marginBottom: 56 }}>
        {scene.ecran.surtitre}
      </div>
      <Icone src={icone} taille={200} />
      <Titre p={p} texte={scene.ecran.titre} />
      {scene.ecran.chiffre ? (
        <div style={{ display: "flex", marginTop: 40 }}>
          <Chiffre p={p} valeur={scene.ecran.chiffre} />
        </div>
      ) : null}
    </Colonne>
  );
}

function Presentation({ scene, p, portrait }) {
  const nom = scene.ecran.nom;
  return (
    <Colonne>
      {portrait ? (
        <div style={{ display: "flex", width: LARGEUR_UTILE, justifyContent: "center", marginBottom: 24 }}>
          <img src={portrait} alt="" width={560} height={700} style={{ objectFit: "contain" }} />
        </div>
      ) : (
        <div style={{ display: "flex", fontFamily: "Geist Mono", fontWeight: 500, fontSize: 34, letterSpacing: 6, color: p.accent, marginBottom: 28 }}>
          UNE PROMESSE DE
        </div>
      )}
      <div
        style={{
          display: "flex",
          fontWeight: 700,
          fontSize: portrait ? taille(nom, [96, 84, 72], 2) : taille(nom, [140, 120, 104, 90], 3),
          lineHeight: 1.02,
          letterSpacing: -3,
          color: p.texte,
        }}
      >
        {nom}
      </div>
      <div style={{ display: "flex", marginTop: 36, fontWeight: 500, fontSize: 46, lineHeight: 1.25, color: p.secondaire }}>
        Notre IA passe les promesses au crible des faits.
      </div>
    </Colonne>
  );
}

function Tient({ scene, p, icone }) {
  const tampon = (scene.ecran.tampon ?? "").toUpperCase();
  return (
    <Colonne>
      <Etiquette p={p}>CE QUI TIENT</Etiquette>
      <Icone src={icone} taille={260} marge={80} />
      {tampon ? (
        <div
          style={{
            display: "flex",
            transform: "rotate(-6deg)",
            border: `10px solid ${p.accent}`,
            borderRadius: 18,
            padding: "22px 40px",
            fontFamily: "Geist Mono",
            fontWeight: 500,
            fontSize: taille(tampon, [96, 84, 72, 62], 1, 0.75),
            letterSpacing: 4,
            lineHeight: 1.05,
            color: p.accent,
          }}
        >
          {tampon}
        </div>
      ) : null}
    </Colonne>
  );
}

function ChiffreLegende({ etiquette, scene, p, icone }) {
  return (
    <Colonne>
      <Etiquette p={p}>{etiquette}</Etiquette>
      <Icone src={icone} taille={200} />
      <Chiffre p={p} valeur={scene.ecran.chiffre} legende={scene.ecran.legende} />
    </Colonne>
  );
}

function TitreSeul({ etiquette, scene, p, icone }) {
  return (
    <Colonne>
      <Etiquette p={p}>{etiquette}</Etiquette>
      <Icone src={icone} taille={260} marge={64} />
      <Titre p={p} texte={scene.ecran.titre} />
    </Colonne>
  );
}

function Verdict({ scene, p, palier }) {
  const { score } = scene.ecran;
  const allumees = Math.max(0, Math.min(100, Math.round(score)));
  const CASE = 58;
  const ECART = 9;
  return (
    <Colonne>
      <Etiquette p={p}>SCORE PERLIMPINPIN</Etiquette>
      <div style={{ display: "flex", alignItems: "baseline" }}>
        <div style={{ display: "flex", fontWeight: 700, fontSize: 250, lineHeight: 1, letterSpacing: -10, color: palier.couleur }}>
          {String(score).replace(".", ",")}
        </div>
        <div style={{ display: "flex", fontWeight: 500, fontSize: 80, color: p.secondaire, marginLeft: 14 }}>/100</div>
      </div>
      <div
        style={{
          display: "flex",
          marginTop: 24,
          marginBottom: 56,
          padding: "14px 30px",
          borderRadius: 999,
          backgroundColor: palier.fond,
          color: palier.texte,
          fontWeight: 700,
          fontSize: 46,
        }}
      >
        {palier.label}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", width: CASE * 10 + ECART * 9, gap: ECART }}>
        {Array.from({ length: 100 }, (_, i) => (
          <div
            key={i}
            style={{ width: CASE, height: CASE, borderRadius: 6, backgroundColor: i < allumees ? palier.couleur : p.caseEteinte }}
          />
        ))}
      </div>
    </Colonne>
  );
}

function Appel({ p, icones }) {
  return (
    <Colonne>
      <div style={{ display: "flex", marginBottom: 56 }}>
        <img src={icones[0]} alt="" width={200} height={200} style={{ marginRight: 48 }} />
        <img src={icones[1]} alt="" width={200} height={200} />
      </div>
      <div style={{ display: "flex", fontWeight: 700, fontSize: 96, lineHeight: 1.05, letterSpacing: -2, color: p.texte }}>
        Et vous, qu’en pensez-vous ?
      </div>
      <div style={{ display: "flex", flexDirection: "column", marginTop: 40, fontWeight: 500, fontSize: 50, lineHeight: 1.3, color: p.secondaire }}>
        <div style={{ display: "flex" }}>Dites-le en commentaire.</div>
        <div style={{ display: "flex" }}>Partagez pour en débattre.</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", marginTop: 90 }}>
        <Logo p={p} grand />
        <div style={{ display: "flex", marginTop: 22, fontFamily: "Geist Mono", fontWeight: 500, fontSize: 40, letterSpacing: 2, color: p.accent }}>
          perlimpinpin.ai
        </div>
      </div>
    </Colonne>
  );
}

// Image de la scène demandée.
// `donnees` : { scene, theme, fond, icone, icones (appel), portrait, palier }.
export function elementScene({ scene, theme, fond, icone, icones, portrait, palier }) {
  const p = PALETTES[theme] ?? PALETTES.sombre;
  const contenu = (() => {
    switch (scene.id) {
      case "accroche":
        return <Accroche scene={scene} p={p} icone={icone} />;
      case "presentation":
        return <Presentation scene={scene} p={p} portrait={portrait} />;
      case "tient":
        return <Tient scene={scene} p={p} icone={icone} />;
      case "hic":
        return <ChiffreLegende etiquette="LE HIC" scene={scene} p={p} icone={icone} />;
      case "preuve":
        return <TitreSeul etiquette="LA PREUVE" scene={scene} p={p} icone={icone} />;
      case "facture":
        return <ChiffreLegende etiquette="LA FACTURE" scene={scene} p={p} icone={icone} />;
      case "nuance":
        return <TitreSeul etiquette="LA NUANCE" scene={scene} p={p} icone={icone} />;
      case "verdict":
        return <Verdict scene={scene} p={p} palier={palier} />;
      default:
        return <Appel p={p} icones={icones} />;
    }
  })();
  return (
    <Cadre fond={fond} p={p} logo={scene.id !== "appel"}>
      {contenu}
    </Cadre>
  );
}
