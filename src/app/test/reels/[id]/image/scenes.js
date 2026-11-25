/* eslint-disable @next/next/no-img-element -- next/og (Satori) ne connaît que <img>. */
import { lignesEstimees } from "@/lib/carte";
import { HAUTEUR_REEL, LARGEUR_REEL } from "@/lib/reel";
import { elementsScene } from "@/lib/reel-montage";

// Mise en page des images 1080 × 1920 d'un Reel (JSX pour next/og : flexbox
// seulement, ni grid ni filter). Les données arrivent prêtes depuis route.js.
//
// Zone sûre : tout le texte important reste au centre. Instagram et TikTok
// masquent le haut (nom du compte), le bas (légende, musique) et la colonne
// de droite (boutons j'aime, commentaire, partage).
//
// Calques : avec `calque` (icone, texte ou chiffre), la même mise en page est
// dessinée sans fond, seuls les éléments de ce calque restant visibles (les
// autres à opacité nulle) : les PNG transparents se superposent exactement à
// l'image complète.
const ZONE = { gauche: 90, droite: 200, haut: 250, bas: 400 };
const LARGEUR_UTILE = LARGEUR_REEL - ZONE.gauche - ZONE.droite; // 790 px

// Couverture : tout le contenu dans la zone centrale 1080 × 1350 (la grille
// du profil Instagram coupe le haut et le bas).
const COUVERTURE = { haut: (HAUTEUR_REEL - 1350) / 2, hauteur: 1350, marge: 90 };
const LARGEUR_COUVERTURE = LARGEUR_REEL - 2 * COUVERTURE.marge; // 900 px

// Couleurs par thème. Accent de la charte : jaune. Jamais de rouge ni de vert
// hors du score (scène 8, couleur du palier lue dans src/lib/carte.js).
// Cyan et violet : reflets irisés (décalage « glitch », gros pixels).
export const PALETTES = {
  sombre: {
    texte: "#ffffff",
    secondaire: "rgba(255,255,255,0.78)",
    accent: "#ffd23f",
    cyan: "rgba(54,224,255,0.75)",
    violet: "rgba(164,107,255,0.75)",
    caseEteinte: "rgba(255,255,255,0.13)",
    voile: "rgba(10,15,46,0.35)",
  },
  clair: {
    texte: "#14163a",
    secondaire: "#474b73",
    accent: "#b98500",
    cyan: "rgba(0,168,214,0.55)",
    violet: "rgba(124,77,255,0.5)",
    caseEteinte: "rgba(27,31,74,0.10)",
    voile: "rgba(255,255,255,0.45)",
  },
};

// Jaune vif de la question de couverture (lisible sur les deux fonds).
const JAUNE = "#ffd23f";
const ENCRE = "#14163a";

// Plus grande taille (parmi `tailles`) qui tient en `maxLignes` lignes sur la
// largeur donnée. Geist est un peu plus large qu'Inter : ratio 0,5.
function taille(texte, tailles, maxLignes, ratio = 0.5, largeur = LARGEUR_UTILE) {
  for (const t of tailles) {
    if (lignesEstimees(texte, t, largeur, ratio) <= maxLignes) return t;
  }
  return tailles[tailles.length - 1];
}

// Grand chiffre sur une ligne si possible (environ 0,58 × la taille par caractère).
function tailleChiffre(valeur) {
  const longueur = Math.max(1, Array.from(String(valeur ?? "")).length);
  return Math.max(96, Math.min(230, Math.floor(LARGEUR_UTILE / (longueur * 0.58))));
}

// Style d'un élément selon le calque demandé : visible, ou présent mais
// transparent (pour garder la mise en page identique).
function vis(p, nom) {
  return p.calque && p.calque !== nom ? { opacity: 0 } : {};
}

// Espaces insécables à la française (avant €, Md€, %, ?, !, : ; » et après «) :
// « 1,70 € » ne se coupe jamais avant l’unité.
function insecables(t) {
  return String(t ?? "")
    .replace(/ (?=(?:Md|M|k)?€|%|[?!:;»])/g, " ")
    .replace(/« /g, "« ");
}

// Léger décalage de couleurs façon glitch, sur les mots forts seulement.
function glitch(p, ecart = 6) {
  return { textShadow: `-${ecart}px 0 ${p.cyan}, ${ecart}px 0 ${p.violet}` };
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
    <div style={{ display: "flex", fontFamily: "Geist Mono", fontWeight: 500, fontSize: 34, letterSpacing: 6, color: p.accent, marginBottom: 36, ...vis(p, "texte") }}>
      {children}
    </div>
  );
}

function Icone({ p, src, taille: t = 220, marge = 48 }) {
  if (!src) return null;
  return <img src={src} alt="" width={t} height={t} style={{ marginBottom: marge, ...vis(p, "icone") }} />;
}

// Traits de vitesse, dans la marge à gauche d'un grand chiffre (jamais sur le
// chiffre lui-même).
function TraitsVitesse({ couleur, hauteur }) {
  const traits = [
    { haut: 0.22, largeur: 46 },
    { haut: 0.45, largeur: 70 },
    { haut: 0.68, largeur: 34 },
  ];
  // Un vrai conteneur (Satori refuse un tableau renvoyé par un composant).
  return (
    <div style={{ position: "absolute", left: -88, top: 0, width: 88, height: hauteur, display: "flex" }}>
      {traits.map(({ haut, largeur }) => (
        <div
          key={haut}
          style={{
            position: "absolute",
            left: 74 - largeur,
            top: Math.round(hauteur * haut),
            width: largeur,
            height: 7,
            borderRadius: 4,
            backgroundColor: couleur,
            opacity: 0.6,
          }}
        />
      ))}
    </div>
  );
}

// Quelques gros pixels qui « s'envolent » sur les bords gauche et droit,
// hors de la zone du texte. Position propre à chaque scène.
function PixelsVolants({ p, graine, calque }) {
  const couleurs = [p.accent, p.cyan, p.violet];
  const pixels = [];
  for (const [cote, decalage] of [
    ["gauche", 311],
    ["droite", 97],
  ]) {
    const baseY = 640 + ((graine * 137 + decalage) % 560);
    for (let k = 0; k < 4; k++) {
      const t = 28 - 6 * k;
      const x = cote === "gauche" ? 60 - 18 * k - t : 935 + 22 * k;
      pixels.push(
        <div
          key={`${cote}-${k}`}
          style={{ position: "absolute", left: x, top: baseY - 46 * k, width: t, height: t, backgroundColor: couleurs[(k + graine) % 3], opacity: 0.85 - 0.15 * k }}
        />,
      );
    }
  }
  return <div style={{ position: "absolute", left: 0, top: 0, width: LARGEUR_REEL, height: HAUTEUR_REEL, display: "flex", ...vis(p, calque) }}>{pixels}</div>;
}

// Cadre commun : fond (sauf calque), logo en haut de la zone sûre, gros
// pixels sur les bords, contenu centré dans la zone sûre.
function Cadre({ fond, p, children, logo = true, graine, calquePixels }) {
  return (
    <div style={{ position: "relative", display: "flex", width: LARGEUR_REEL, height: HAUTEUR_REEL, fontFamily: "Geist", color: p.texte }}>
      {p.calque ? null : <img src={fond} alt="" width={LARGEUR_REEL} height={HAUTEUR_REEL} style={{ position: "absolute", left: 0, top: 0 }} />}
      {calquePixels ? <PixelsVolants p={p} graine={graine} calque={calquePixels} /> : null}
      {logo ? (
        <div style={{ position: "absolute", left: ZONE.gauche, top: ZONE.haut, display: "flex", ...vis(p, "texte") }}>
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
  return (
    <div style={{ display: "flex", fontWeight: 700, fontSize: t, lineHeight: 1.08, letterSpacing: -t * 0.025, color: p.texte, ...vis(p, "texte") }}>
      {insecables(texte)}
    </div>
  );
}

// Grand chiffre (calque chiffre), avec ses traits de vitesse et un léger glitch.
function GrandChiffre({ p, valeur }) {
  if (!valeur) return null;
  const t = tailleChiffre(valeur);
  return (
    <div style={{ position: "relative", display: "flex", ...vis(p, "chiffre") }}>
      <TraitsVitesse couleur={p.accent} hauteur={t} />
      <div style={{ display: "flex", fontWeight: 700, fontSize: t, lineHeight: 1, letterSpacing: -4, color: p.accent, ...glitch(p) }}>{insecables(valeur)}</div>
    </div>
  );
}

function Legende({ p, texte }) {
  if (!texte) return null;
  return (
    <div style={{ display: "flex", marginTop: 28, fontWeight: 500, fontSize: taille(texte, [56, 50, 44], 3), lineHeight: 1.2, color: p.secondaire, ...vis(p, "texte") }}>
      {insecables(texte)}
    </div>
  );
}

// --- Les 9 scènes -------------------------------------------------------------

function Accroche({ scene, p, icone }) {
  return (
    <Colonne>
      {/* D'abord la mesure, puis la question (même ordre que la voix). */}
      <Icone p={p} src={icone} taille={200} />
      <Titre p={p} texte={scene.ecran.titre} />
      {scene.ecran.chiffre ? (
        <div style={{ display: "flex", marginTop: 40 }}>
          <GrandChiffre p={p} valeur={scene.ecran.chiffre} />
        </div>
      ) : null}
      <div style={{ display: "flex", fontWeight: 700, fontSize: 56, lineHeight: 1.15, color: p.secondaire, marginTop: 64, ...vis(p, "texte") }}>
        {insecables(scene.ecran.question)}
      </div>
    </Colonne>
  );
}

function Presentation({ scene, p, portrait }) {
  const nom = scene.ecran.nom;
  return (
    <Colonne>
      {portrait ? (
        <div style={{ display: "flex", width: LARGEUR_UTILE, justifyContent: "center", marginBottom: 24, ...vis(p, "icone") }}>
          <img src={portrait} alt="" width={560} height={700} style={{ objectFit: "contain" }} />
        </div>
      ) : (
        <div style={{ display: "flex", fontFamily: "Geist Mono", fontWeight: 500, fontSize: 34, letterSpacing: 6, color: p.accent, marginBottom: 28, ...vis(p, "texte") }}>
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
          ...vis(p, "texte"),
        }}
      >
        {nom}
      </div>
      <div style={{ display: "flex", marginTop: 36, fontWeight: 500, fontSize: 46, lineHeight: 1.25, color: p.secondaire, ...vis(p, "texte") }}>
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
      <Icone p={p} src={icone} taille={260} marge={80} />
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
            ...glitch(p),
            ...vis(p, "texte"),
          }}
        >
          {insecables(tampon)}
        </div>
      ) : null}
    </Colonne>
  );
}

function ChiffreLegende({ etiquette, scene, p, icone }) {
  return (
    <Colonne>
      <Etiquette p={p}>{etiquette}</Etiquette>
      <Icone p={p} src={icone} taille={200} />
      <GrandChiffre p={p} valeur={scene.ecran.chiffre} />
      <Legende p={p} texte={scene.ecran.legende} />
    </Colonne>
  );
}

function TitreSeul({ etiquette, scene, p, icone }) {
  return (
    <Colonne>
      <Etiquette p={p}>{etiquette}</Etiquette>
      <Icone p={p} src={icone} taille={260} marge={64} />
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
      <div style={{ position: "relative", display: "flex", alignItems: "baseline", ...vis(p, "chiffre") }}>
        <TraitsVitesse couleur={palier.couleur} hauteur={250} />
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
          ...vis(p, "texte"),
        }}
      >
        {palier.label}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", width: CASE * 10 + ECART * 9, gap: ECART, ...vis(p, "chiffre") }}>
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

function Appel({ scene, p, icones }) {
  return (
    <Colonne>
      <div style={{ display: "flex", marginBottom: 56, ...vis(p, "icone") }}>
        <img src={icones[0]} alt="" width={200} height={200} style={{ marginRight: 48 }} />
        <img src={icones[1]} alt="" width={200} height={200} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", ...vis(p, "texte") }}>
        <div style={{ display: "flex", fontWeight: 700, fontSize: 96, lineHeight: 1.05, letterSpacing: -2, color: p.texte }}>
          {insecables(scene.ecran.titre ?? "Et vous, qu’en pensez-vous ?")}
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
      </div>
    </Colonne>
  );
}

// Image de la scène demandée (ou d'un de ses calques).
// `donnees` : { scene, theme, fond, icone, icones (appel), portrait, palier, calque }.
export function elementScene({ scene, theme, fond, icone, icones, portrait, palier, calque = null }) {
  const p = { ...(PALETTES[theme] ?? PALETTES.sombre), calque };
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
        return <Appel scene={scene} p={p} icones={icones} />;
    }
  })();
  // Gros pixels : avec l'icône, à défaut le chiffre ; jamais sur le portrait.
  const elements = elementsScene(scene, { portrait: Boolean(portrait) });
  const calquePixels = scene.id === "presentation" ? null : ["icone", "chiffre"].find((e) => elements.includes(e)) ?? null;
  return (
    <Cadre fond={fond} p={p} logo={scene.id !== "appel"} graine={scene.numero} calquePixels={calquePixels}>
      {contenu}
    </Cadre>
  );
}

// --- Couverture -----------------------------------------------------------------

// Image de couverture (photo du Reel sur Instagram) : la mesure en très gros,
// le portrait du candidat (sinon son nom), une question en jaune et le logo
// en petit. Pas de score (on garde le suspense). Même fond, mêmes polices.
// `couverture` : { titre, question, nom }.
export function elementCouverture({ couverture, theme, fond, portrait }) {
  const p = PALETTES[theme] ?? PALETTES.sombre;
  const { titre, question, nom } = couverture;
  const tailleTitre = taille(titre, [132, 118, 104, 92, 80], 3, 0.52, LARGEUR_COUVERTURE);
  return (
    <div style={{ position: "relative", display: "flex", width: LARGEUR_REEL, height: HAUTEUR_REEL, fontFamily: "Geist", color: p.texte }}>
      <img src={fond} alt="" width={LARGEUR_REEL} height={HAUTEUR_REEL} style={{ position: "absolute", left: 0, top: 0 }} />
      <PixelsVolants p={p} graine={4} calque="icone" />
      <div
        style={{
          position: "absolute",
          left: COUVERTURE.marge,
          top: COUVERTURE.haut,
          width: LARGEUR_COUVERTURE,
          height: COUVERTURE.hauteur,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: 30,
          paddingBottom: 40,
        }}
      >
        <Logo p={p} />
        <div
          style={{
            display: "flex",
            textAlign: "center",
            justifyContent: "center",
            fontWeight: 700,
            fontSize: tailleTitre,
            lineHeight: 1.04,
            letterSpacing: -tailleTitre * 0.03,
            color: p.texte,
          }}
        >
          {insecables(titre)}
        </div>
        {portrait ? (
          <img src={portrait} alt="" width={500} height={625} style={{ objectFit: "contain" }} />
        ) : (
          <div
            style={{
              display: "flex",
              textAlign: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: taille(nom, [120, 104, 90], 2, 0.5, LARGEUR_COUVERTURE),
              lineHeight: 1.02,
              letterSpacing: -3,
              color: p.secondaire,
            }}
          >
            {nom}
          </div>
        )}
        <div
          style={{
            display: "flex",
            transform: "rotate(-3deg)",
            backgroundColor: JAUNE,
            color: ENCRE,
            borderRadius: 22,
            padding: "18px 48px",
            fontWeight: 700,
            fontSize: taille(question, [104, 92, 80], 1, 0.55, LARGEUR_COUVERTURE - 100),
            lineHeight: 1.05,
            letterSpacing: -2,
            boxShadow: `-8px 0 0 ${p.cyan}, 8px 0 0 ${p.violet}`,
          }}
        >
          {insecables(question)}
        </div>
      </div>
    </div>
  );
}
