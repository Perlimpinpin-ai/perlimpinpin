/* eslint-disable @next/next/no-img-element -- next/og (Satori) ne connaît que <img>. */
import { appreciationCarte, lignesEstimees, slugCandidat } from "@/lib/carte";
import { HAUTEUR_SLIDE, LARGEUR_SLIDE } from "@/lib/carrousel";
import { contraste, couleursProches, TEXTE_CLAIR } from "@/lib/couleurs-candidats";

// Mise en page des slides 1080 × 1350 des deux carrousels Instagram (JSX pour
// next/og : flexbox seulement, ni grid ni filter). Les données arrivent
// prêtes depuis route.js (src/lib/carrousel.js pour le carrousel 6 slides,
// src/lib/carrousel-recit.js pour le récit).
//
// Style commun (v3) :
//  - deux fonds qui alternent : la couleur du candidat (src/lib/couleurs-candidats.js,
//    bleu nuit tant qu'elle manque) pour la couverture, la note et la fin ;
//    un papier clair à plat pour les slides de contenu ;
//  - même cadre partout : « / PERLIMPINPIN » et barre de progression en haut,
//    « Candidat · sujet » et « n/total » en bas, mince bandeau rayé ;
//  - titres en Source Serif 4 (« Serif »), texte en Inter (« Texte » : Geist
//    s’affiche mal dans Satori, voir policesCarrousel), étiquettes en Geist Mono ;
//  - un seul élément en jaune par slide ; la note garde la couleur de son
//    niveau (src/lib/score.js via appreciationCarte) ; contraste calculé.

const PAPIER = "#f5f0e6";
const CARTE = "#fffdf8";
const ENCRE = "#1c1b19";
const GRIS = "#6f6a60";
const JAUNE = "#ffd23f";
const BLEU_NUIT = "#1b2a4a";
const LAVANDE = "#c9b8e8";

const MARGE = 80;
const LARGEUR_UTILE = LARGEUR_SLIDE - 2 * MARGE; // 920 px
const HAUT_CONTENU = 160;
const BAS_CONTENU = 150;
const HAUTEUR_CONTENU = HAUTEUR_SLIDE - HAUT_CONTENU - BAS_CONTENU;

const SERIF = "Serif";
const MONO = "GeistMono";

// Slides sur la couleur du candidat ; toutes les autres sur papier.
const SUR_COULEUR = new Set(["couverture", "note", "noteRecit", "fin"]);

// Plus grande taille de la liste pour laquelle le texte tient en `hauteur`.
function taille(texte, tailles, { largeur = LARGEUR_UTILE, hauteur, interligne = 1.25, ratio = 0.52 }) {
  for (const t of tailles) {
    if (lignesEstimees(texte, t, largeur, ratio) * t * interligne <= hauteur) return t;
  }
  return tailles.at(-1);
}

function rgba(hex, alpha) {
  const n = parseInt(String(hex).replace("#", ""), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

// Couleurs d'une slide.
function palette(couleur, type) {
  if (!SUR_COULEUR.has(type)) {
    return { fond: PAPIER, texte: ENCRE, secondaire: GRIS, tiretVu: ENCRE, tiretAVenir: "rgba(28,27,25,.18)", surCouleur: false };
  }
  // La note revient au bleu nuit si la couleur du candidat est proche de celle du niveau.
  const fond = couleur && !(type.startsWith("note") && couleur.noteNeutre) ? couleur.couleur : BLEU_NUIT;
  const texte = couleur && fond === couleur.couleur ? couleur.texte : TEXTE_CLAIR;
  const clair = texte === TEXTE_CLAIR;
  return {
    fond,
    texte,
    secondaire: clair ? "rgba(255,255,255,.74)" : "rgba(24,24,27,.66)",
    tiretVu: texte,
    tiretAVenir: clair ? "rgba(255,255,255,.28)" : "rgba(24,24,27,.2)",
    surCouleur: true,
  };
}

// --- Cadre commun -----------------------------------------------------------------------

function EnTete({ slide, p }) {
  return (
    <>
      <div style={{ position: "absolute", left: MARGE, top: 72, display: "flex", alignItems: "center", fontWeight: 800, fontSize: 24, letterSpacing: 4, color: p.texte }}>
        <span style={{ marginRight: 12 }}>/</span>
        PERLIMPINPIN
      </div>
      {/* Barre de progression, calée à droite par sa largeur (Satori perd
          un bloc absolu placé par `right` dans un fragment). */}
      <div style={{ position: "absolute", left: LARGEUR_SLIDE - MARGE - (slide.total * 38 - 8), top: 84, width: slide.total * 38 - 8, height: 5, display: "flex" }}>
        {Array.from({ length: slide.total }, (_, i) => (
          <div key={i} style={{ width: 30, height: 5, borderRadius: 3, marginLeft: i ? 8 : 0, backgroundColor: i < slide.numero ? p.tiretVu : p.tiretAVenir }} />
        ))}
      </div>
    </>
  );
}

function Pied({ slide, p, candidatNom, sujet }) {
  return (
    <div style={{ position: "absolute", left: MARGE, right: MARGE, bottom: 62, display: "flex", justifyContent: "space-between", fontWeight: 500, fontSize: 26, color: p.secondaire }}>
      <div style={{ display: "flex" }}>{sujet ? `${candidatNom} · ${sujet}` : candidatNom}</div>
      <div style={{ display: "flex" }}>
        {slide.numero}/{slide.total}
      </div>
    </div>
  );
}

// Mince bandeau rayé, aux couleurs de la charte (discret).
function Rayures({ couleurCandidat }) {
  // Teintes visibles sur les deux fonds (papier et couleur du candidat).
  const teintes = [JAUNE, LAVANDE, couleurCandidat ?? "#4f6fd6"];
  return (
    <div style={{ position: "absolute", left: -20, top: HAUTEUR_SLIDE - 12, width: LARGEUR_SLIDE + 40, height: 12, display: "flex", overflow: "hidden", opacity: 0.6 }}>
      {Array.from({ length: 90 }, (_, i) => (
        <div key={i} style={{ width: 9, height: 12, marginRight: 4, backgroundColor: teintes[Math.floor(i / 5) % teintes.length], transform: "skewX(-35deg)" }} />
      ))}
    </div>
  );
}

function Cadre({ slide, p, couleur, candidatNom, sujet, children }) {
  return (
    <div style={{ position: "relative", display: "flex", width: LARGEUR_SLIDE, height: HAUTEUR_SLIDE, backgroundColor: p.fond, overflow: "hidden", fontFamily: "Texte" }}>
      <EnTete slide={slide} p={p} />
      {children}
      {slide.type === "couverture" ? null : <Pied slide={slide} p={p} candidatNom={candidatNom} sujet={sujet} />}
      <Rayures couleurCandidat={couleur?.couleur} />
    </div>
  );
}

// Zone de contenu (largeur et hauteur explicites : Satori ne les déduit pas
// toujours de left + right dans un fragment).
function Zone({ children, centre = false, haut = HAUT_CONTENU, hauteur = HAUTEUR_CONTENU }) {
  return (
    <div style={{ position: "absolute", left: MARGE, top: haut, width: LARGEUR_UTILE, height: hauteur, display: "flex", flexDirection: "column", justifyContent: centre ? "center" : "flex-start" }}>
      {children}
    </div>
  );
}

// --- Petits éléments ---------------------------------------------------------------------

function TitreSerif({ children, p, tailleTexte = 60, marge = 28 }) {
  return (
    <div style={{ display: "flex", fontFamily: SERIF, fontWeight: 600, fontSize: tailleTexte, lineHeight: 1.08, letterSpacing: -tailleTexte * 0.015, color: p.texte, marginBottom: marge }}>
      {children}
    </div>
  );
}

function Texte({ children, p, tailleTexte = 36, gras = false, couleur, marge = 0 }) {
  return (
    <div style={{ display: "flex", fontWeight: gras ? 800 : 500, fontSize: tailleTexte, lineHeight: 1.3, color: couleur ?? p.texte, marginTop: marge }}>
      {children}
    </div>
  );
}

function Etiquette({ children, couleur, fond, bordure, tailleTexte = 22 }) {
  return (
    <div style={{ display: "flex", fontFamily: MONO, fontWeight: 500, fontSize: tailleTexte, letterSpacing: 0.5, color: couleur, backgroundColor: fond ?? "transparent", border: bordure ? `1.5px solid ${bordure}` : "none", borderRadius: 8, padding: "5px 12px" }}>
      {children}
    </div>
  );
}

const PASTILLES = {
  positif: { couleur: "#1f7a45", fond: "#e6f4ea" },
  négatif: { couleur: "#b42318", fond: "#fde9e7" },
  débattu: { couleur: "#7a5b00", fond: "#fbf1cc" },
  incertain: { couleur: "#55524c", fond: "#ecebe7" },
};

function Pastille({ valeur }) {
  const { couleur, fond } = PASTILLES[valeur] ?? PASTILLES.incertain;
  return (
    <Etiquette couleur={couleur} fond={fond} bordure={rgba(couleur.length === 7 ? couleur : "#555555", 0.35)} tailleTexte={20}>
      {`• ${valeur}`}
    </Etiquette>
  );
}

function Carte({ children, fond = CARTE, padding = "24px 30px", marge = 0 }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", width: LARGEUR_UTILE, padding, borderRadius: 18, backgroundColor: fond, border: "1px solid rgba(28,27,25,.07)", marginTop: marge }}>
      {children}
    </div>
  );
}

function Pictogramme({ ok, tailleIcone = 40 }) {
  const couleur = ok ? "#1f9d55" : "#d92d20";
  return (
    <svg width={tailleIcone} height={tailleIcone} viewBox="0 0 44 44">
      <circle cx="22" cy="22" r="22" fill={couleur} />
      {ok ? (
        <path d="M12 23 L19 30 L32 15" stroke="white" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M14 14 L30 30 M30 14 L14 30" stroke="white" strokeWidth="5" fill="none" strokeLinecap="round" />
      )}
    </svg>
  );
}

// Score dans la couleur de son niveau ; sur une pastille papier si cette
// couleur ne se lit pas assez sur le fond (contraste < 3).
function Score({ slide, p, tailleScore }) {
  const teinte = appreciationCarte(slide.score);
  const lisible = contraste(teinte.score, p.fond) >= 3;
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      <div style={{ display: "flex", alignItems: "baseline", ...(lisible ? {} : { backgroundColor: PAPIER, borderRadius: 20, padding: "6px 22px" }) }}>
        <div style={{ display: "flex", fontWeight: 800, fontSize: tailleScore, lineHeight: 1, letterSpacing: -tailleScore * 0.04, color: teinte.score }}>{slide.scoreAffiche}</div>
        <div style={{ display: "flex", fontWeight: 500, fontSize: tailleScore * 0.32, color: lisible ? p.secondaire : GRIS, marginLeft: 8 }}>/100</div>
      </div>
      <div style={{ display: "flex", marginLeft: 28 }}>
        <Etiquette couleur={teinte.pastilleTexte} fond={teinte.pastilleFond} tailleTexte={26}>
          {slide.palier}
        </Etiquette>
      </div>
    </div>
  );
}

function Glissez() {
  return (
    <div style={{ position: "absolute", left: MARGE, bottom: 130, display: "flex" }}>
      <Etiquette couleur={ENCRE} fond="#ffffff" tailleTexte={26}>
        Glissez →
      </Etiquette>
    </div>
  );
}

// --- Slides communes ---------------------------------------------------------------------

// Couverture en collage (fond candidat), sur le modèle des maquettes :
//  - en bas à gauche, un panneau au bord supérieur déchiré : la photo du thème
//    en duotone jaune (public/carrousel/themes/<thème>.jpg, préparée par
//    scripts/images-couverture.js), sinon une trame de points jaunes ;
//  - un bloc bleu encre incliné derrière le portrait ;
//  - le portrait détouré en noir et blanc (public/portraits-nb/), en grand, en
//    bas à droite ; sans lui, la vignette du site, sinon le portrait bleu ;
//  - en haut à droite, un « sticker » incliné du thème s'il existe ;
//  - le titre en gras blanc, le chiffre clé surligné en jaune (récit), la
//    question, « Notre analyse en N slides », « Glissez → ».
// Carrousel 6 slides : le titre de la mesure et « La mesure de … passée au crible ».
const BLEU_ENCRE = "#1f2a78";
const HAUT_PANNEAU = 800;

// Réglage vertical du portrait par candidat (slug, en pixels ; négatif = plus
// haut), pour les portraits détourés dont la tête est plus basse dans le cadre.
const DECALAGES_PORTRAIT = { "raphael-glucksmann": -60 };

// Bord déchiré du panneau : une ligne de crêtes irrégulières (coordonnées
// dans le panneau, 780 × 550).
const CRETES = [
  [0, 130], [55, 62], [96, 104], [150, 26], [205, 92], [248, 48], [300, 118], [356, 40], [404, 96],
  [452, 58], [510, 128], [566, 70], [612, 112], [668, 64], [720, 120], [780, 150],
];
const POLYGONE_PANNEAU = [...CRETES, [780, 550], [0, 550]].map(([x, y]) => `${x},${y}`).join(" ");

function PanneauTheme({ imageTheme }) {
  return (
    <svg width={780} height={550} viewBox="0 0 780 550" style={{ position: "absolute", left: 0, top: HAUT_PANNEAU }}>
      <defs>
        <clipPath id="dechire">
          <polygon points={POLYGONE_PANNEAU} />
        </clipPath>
        <pattern id="trame" width="18" height="18" patternUnits="userSpaceOnUse">
          <circle cx="9" cy="9" r="4.2" fill="#b98a12" />
        </pattern>
      </defs>
      {imageTheme ? (
        <image href={imageTheme} x="0" y="0" width="780" height="550" preserveAspectRatio="xMidYMid slice" clipPath="url(#dechire)" />
      ) : (
        <g>
          <polygon points={POLYGONE_PANNEAU} fill="#f2c230" />
          <polygon points={POLYGONE_PANNEAU} fill="url(#trame)" opacity="0.55" />
        </g>
      )}
    </svg>
  );
}

function Couverture({ slide, p, photo, illustration, portrait, imageTheme, sticker, cadre, candidatNom }) {
  if (portrait || cadre || imageTheme || sticker) return <CouvertureCollage slide={slide} p={p} portrait={portrait} illustration={illustration} photo={photo} imageTheme={imageTheme} sticker={sticker} cadre={cadre} candidatNom={candidatNom} />;
  return <CouvertureSimple slide={slide} p={p} photo={photo} illustration={illustration} />;
}

// Mots du titre de couverture, avec le chiffre clé surligné et la question à la ligne.
function motsCouverture(slide) {
  const morceaux = [];
  if (slide.recit) {
    const { intro, mesure, chiffreCle } = slide;
    const i = chiffreCle ? mesure.indexOf(chiffreCle) : -1;
    const avant = i >= 0 ? mesure.slice(0, i) : mesure;
    const apres = i >= 0 ? mesure.slice(i + chiffreCle.length) : "";
    for (const mot of `${intro} ${avant}`.split(/\s+/).filter(Boolean)) morceaux.push({ mot });
    if (i >= 0) morceaux.push({ mot: chiffreCle, jaune: true });
    for (const mot of apres.split(/\s+/).filter(Boolean)) morceaux.push({ mot });
    slide.question.split(/\s+/).filter(Boolean).forEach((mot, j) => morceaux.push({ mot, ligne: j === 0 }));
  } else {
    for (const mot of slide.titre.split(/\s+/).filter(Boolean)) morceaux.push({ mot });
  }
  return morceaux;
}

function TitreCouverture({ morceaux, p, t, largeur }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", width: largeur, fontWeight: 800, fontSize: t, lineHeight: 1.04, letterSpacing: -t * 0.035, color: p.texte }}>
      {morceaux.flatMap(({ mot, jaune, ligne }, index) => [
        ...(ligne ? [<div key={`s${index}`} style={{ display: "flex", width: largeur, height: 0 }} />] : []),
        <span key={index} style={{ marginRight: t * 0.22, marginBottom: 4, ...(jaune ? { backgroundColor: JAUNE, color: ENCRE, padding: `0 ${t * 0.08}px`, borderRadius: 6 } : {}) }}>
          {mot}
        </span>,
      ])}
    </div>
  );
}

function CouvertureCollage({ slide, p, portrait, illustration, photo, imageTheme, sticker, cadre, candidatNom }) {
  const morceaux = motsCouverture(slide);
  const largeurTitre = sticker ? 760 : LARGEUR_UTILE;
  const t = taille(morceaux.map((m) => m.mot).join(" "), [96, 88, 80, 72, 66, 60, 54], { largeur: largeurTitre, hauteur: 380, interligne: 1.04, ratio: 0.55 });
  // Bloc encre : remplacé par le noir si le fond du candidat est déjà un bleu proche.
  const bloc = couleursProches(p.fond, BLEU_ENCRE, 120) ? ENCRE : BLEU_ENCRE;
  return (
    <>
      <PanneauTheme imageTheme={imageTheme} />
      <svg width={LARGEUR_SLIDE} height={HAUTEUR_SLIDE} viewBox={`0 0 ${LARGEUR_SLIDE} ${HAUTEUR_SLIDE}`} style={{ position: "absolute", left: 0, top: 0 }}>
        <polygon points={`640,770 ${LARGEUR_SLIDE},700 ${LARGEUR_SLIDE},${HAUTEUR_SLIDE} 600,${HAUTEUR_SLIDE}`} fill={bloc} />
      </svg>
      {portrait ? (
        <img src={portrait} alt="" width={680} height={850} style={{ position: "absolute", left: 420, top: 560 + (DECALAGES_PORTRAIT[slugCandidat({ nom: candidatNom })] ?? 0), width: 680, height: 850, objectFit: "contain" }} />
      ) : cadre ? (
        // Sans détourage : l'illustration en noir et blanc, en tirage photo incliné.
        <div style={{ position: "absolute", left: 520, top: 610, display: "flex", padding: 14, backgroundColor: "#fbfaf6", boxShadow: "0 18px 40px rgba(0,0,0,.35)", transform: "rotate(-4deg)" }}>
          <img src={cadre} alt="" width={460} height={575} style={{ width: 460, height: 575, objectFit: "cover" }} />
        </div>
      ) : illustration ? (
        <img src={illustration} alt="" width={440} height={550} style={{ position: "absolute", left: 560, top: 700, width: 440, height: 550, objectFit: "cover", borderRadius: 22 }} />
      ) : photo ? (
        <img src={photo} alt="" width={640} height={800} style={{ position: "absolute", left: 440, top: 580, objectFit: "contain" }} />
      ) : null}
      {sticker ? (
        <img src={sticker} alt="" width={300} height={300} style={{ position: "absolute", left: 790, top: -10, width: 300, height: 300, objectFit: "contain", transform: "rotate(12deg)" }} />
      ) : null}
      <div style={{ position: "absolute", left: MARGE, top: 150, width: LARGEUR_UTILE, display: "flex", flexDirection: "column" }}>
        <TitreCouverture morceaux={morceaux} p={p} t={t} largeur={largeurTitre} />
        <div style={{ display: "flex", width: 520, marginTop: 30, fontFamily: SERIF, fontWeight: 600, fontSize: 40, lineHeight: 1.15, color: p.secondaire }}>{slide.sousTitre}</div>
      </div>
      <div style={{ position: "absolute", left: MARGE, top: HAUTEUR_SLIDE - 120, display: "flex" }}>
        <Etiquette couleur={ENCRE} fond="#ffffff" tailleTexte={26}>
          Glissez →
        </Etiquette>
      </div>
    </>
  );
}

// Couverture sans portrait ni image de thème (repli) : la mise en page précédente.
function CouvertureSimple({ slide, p, photo, illustration }) {
  const morceaux = [];
  if (slide.recit) {
    const { intro, mesure, chiffreCle } = slide;
    const i = chiffreCle ? mesure.indexOf(chiffreCle) : -1;
    const avant = i >= 0 ? mesure.slice(0, i) : mesure;
    const apres = i >= 0 ? mesure.slice(i + chiffreCle.length) : "";
    for (const mot of `${intro} ${avant}`.split(/\s+/).filter(Boolean)) morceaux.push({ mot });
    if (i >= 0) morceaux.push({ mot: chiffreCle, jaune: true });
    for (const mot of apres.split(/\s+/).filter(Boolean)) morceaux.push({ mot });
    for (const mot of slide.question.split(/\s+/).filter(Boolean)) morceaux.push({ mot, ligne: mot === slide.question.split(/\s+/)[0] });
  } else {
    for (const mot of slide.titre.split(/\s+/).filter(Boolean)) morceaux.push({ mot });
  }
  const texteTitre = morceaux.map((m) => m.mot).join(" ");
  const t = taille(texteTitre, [100, 92, 84, 76, 68, 60, 54], { hauteur: 420, interligne: 1.05, ratio: 0.55 });
  const image = illustration ?? photo;
  return (
    <>
      <Zone>
        <div style={{ display: "flex", flexWrap: "wrap", width: LARGEUR_UTILE, fontWeight: 800, fontSize: t, lineHeight: 1.05, letterSpacing: -t * 0.035, color: p.texte }}>
          {morceaux.flatMap(({ mot, jaune, ligne }, index) => [
            ...(ligne ? [<div key={`s${index}`} style={{ display: "flex", width: LARGEUR_UTILE, height: 0 }} />] : []),
            <span
              key={index}
              style={{
                marginRight: t * 0.22,
                marginBottom: 4,
                ...(jaune ? { backgroundColor: JAUNE, color: ENCRE, padding: `0 ${t * 0.08}px`, borderRadius: 6 } : {}),
              }}
            >
              {mot}
            </span>,
          ])}
        </div>
        <div style={{ display: "flex", width: image ? 480 : LARGEUR_UTILE, marginTop: 34, fontFamily: SERIF, fontWeight: 600, fontSize: 40, lineHeight: 1.15, color: p.secondaire }}>
          {slide.sousTitre}
        </div>
      </Zone>
      {illustration ? (
        <img src={illustration} alt="" width={440} height={550} style={{ position: "absolute", left: 560, top: 640, width: 440, height: 550, objectFit: "cover", borderRadius: 22 }} />
      ) : photo ? (
        <img src={photo} alt="" width={520} height={650} style={{ position: "absolute", left: 520, top: 560, objectFit: "contain" }} />
      ) : null}
      <Glissez />
    </>
  );
}

// Fin (fond candidat, commune aux deux carrousels).
function Fin({ slide, p }) {
  return (
    <Zone centre>
      <TitreSerif p={p} tailleTexte={66}>
        Une analyse réalisée par l’IA Perlimpinpin.
      </TitreSerif>
      <Texte p={p} tailleTexte={34} couleur={p.secondaire}>
        Elle s’appuie sur des milliers de documents officiels et scientifiques publics, et s’améliore grâce à vos retours sur notre site : chaque correction ou source ajoutée rend l’analyse plus juste.
      </Texte>
      <div style={{ display: "flex", marginTop: 44 }}>
        <Etiquette couleur={ENCRE} fond={JAUNE} tailleTexte={28}>
          Lire et améliorer l’analyse complète →
        </Etiquette>
      </div>
      <div style={{ display: "flex", marginTop: 12, fontFamily: MONO, fontSize: 22, color: p.secondaire }}>sur le site officiel · lien en bio</div>
      <div style={{ display: "flex", flexWrap: "wrap", marginTop: 48, fontWeight: 500, fontSize: 34, lineHeight: 1.3, color: p.texte }}>
        <span>Perlimpinpin est une association citoyenne et indépendante.&nbsp;</span>
        <span style={{ fontWeight: 800 }}>Rejoignez-nous !</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", marginTop: 40, fontWeight: 500, fontSize: 26, color: p.secondaire }}>
        <svg width="22" height="28" viewBox="0 0 22 28" style={{ marginRight: 14 }}>
          <path d="M2 2 H20 V26 L11 19 L2 26 Z" fill="none" stroke={p.secondaire} strokeWidth="2.5" strokeLinejoin="round" />
        </svg>
        Enregistrez ce post pour le retrouver
      </div>
      {slide.sources?.length ? (
        <div style={{ display: "flex", marginTop: 26, fontWeight: 500, fontSize: 20, lineHeight: 1.35, color: p.secondaire }}>Sources : {slide.sources.join(" · ")}</div>
      ) : null}
    </Zone>
  );
}

// Ce qui tient… et ce qui coince (papier) : deux cartes, puis en petit la
// condition la plus forte quand la fiche a ce_qui_la_ferait_tenir.
function TientCoince({ slide, p }) {
  const oui = slide.tient ?? [];
  const non = slide.coince ?? slide.tientPas ?? [];
  const t = taille([...oui, ...non].join(" "), [36, 34, 32, 30], { largeur: LARGEUR_UTILE - 100, hauteur: 600, interligne: 1.3 });
  const bloc = (ok, titre, points) => (
    <Carte marge={ok ? 0 : 24} padding="26px 32px">
      <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
        <Pictogramme ok={ok} />
        <div style={{ display: "flex", marginLeft: 14, fontWeight: 800, fontSize: 36, color: ENCRE }}>{titre}</div>
      </div>
      {points.map((point, i) => (
        <div key={i} style={{ display: "flex", marginTop: 12 }}>
          <div style={{ display: "flex", width: 30, fontSize: t, color: GRIS }}>•</div>
          <div style={{ display: "flex", width: LARGEUR_UTILE - 100, fontWeight: 500, fontSize: t, lineHeight: 1.3, color: ENCRE }}>{point}</div>
        </div>
      ))}
    </Carte>
  );
  return (
    <Zone>
      <TitreSerif p={p}>Ce qui tient… et ce qui coince.</TitreSerif>
      {bloc(true, "Ce qui tient", oui)}
      {bloc(false, "Ce qui coince", non)}
      {slide.condition ? (
        <div style={{ display: "flex", flexWrap: "wrap", marginTop: 26, fontWeight: 500, fontSize: 26, lineHeight: 1.3, color: GRIS }}>
          <span style={{ fontWeight: 800, color: ENCRE }}>Ce qui la ferait tenir :&nbsp;</span>
          <span>{slide.condition}</span>
        </div>
      ) : null}
    </Zone>
  );
}

// --- Carrousel 6 slides --------------------------------------------------------------------

function Mesure({ slide, p }) {
  const t = taille(slide.texte, [52, 48, 44, 40, 36], { hauteur: 700, interligne: 1.3 });
  return (
    <Zone centre>
      <TitreSerif p={p} tailleTexte={66}>
        Concrètement, qu’est-ce qui est proposé ?
      </TitreSerif>
      <Texte p={p} tailleTexte={t}>
        {slide.texte}
      </Texte>
    </Zone>
  );
}

// Note (fond candidat) : score, niveau, grille de 100 carrés.
function Note({ slide, p }) {
  const teinte = appreciationCarte(slide.score);
  return (
    <Zone centre>
      <div style={{ display: "flex", fontFamily: MONO, fontSize: 26, letterSpacing: 2, color: p.secondaire, marginBottom: 24 }}>NOTE PERLIMPINPIN</div>
      <Score slide={slide} p={p} tailleScore={220} />
      <div style={{ display: "flex", flexWrap: "wrap", width: 10 * 52 + 9 * 8, gap: 8, marginTop: 52 }}>
        {Array.from({ length: 100 }, (_, i) => (
          <div key={i} style={{ width: 52, height: 52, borderRadius: 6, backgroundColor: i < Math.round(slide.score) ? teinte.score : rgba(p.texte, 0.16) }} />
        ))}
      </div>
    </Zone>
  );
}

// Le chiffre (papier) : grand nombre surligné de jaune, explication.
function Chiffre({ slide, p }) {
  const longueur = Math.max(1, Array.from(slide.valeur).length);
  const tailleValeur = Math.min(240, Math.floor(LARGEUR_UTILE / (longueur * 0.62)));
  const t = taille(slide.explication, [52, 48, 44, 40, 36], { hauteur: 400 });
  return (
    <Zone centre>
      <TitreSerif p={p}>Le chiffre à retenir</TitreSerif>
      <div style={{ display: "flex", marginTop: 10 }}>
        <div style={{ display: "flex", fontWeight: 800, fontSize: tailleValeur, lineHeight: 1.05, letterSpacing: -tailleValeur * 0.03, color: ENCRE, backgroundColor: JAUNE, borderRadius: 14, padding: `0 ${Math.round(tailleValeur * 0.1)}px`, whiteSpace: "nowrap" }}>
          {slide.valeur}
        </div>
      </div>
      <Texte p={p} tailleTexte={t} marge={44}>
        {slide.explication}
      </Texte>
    </Zone>
  );
}

// --- Carrousel récit -------------------------------------------------------------------------

function Concretement({ slide, p }) {
  const tuile = ({ etiquette, valeur, detail, cle }) => (
    <div key={etiquette} style={{ display: "flex", flexDirection: "column", width: (LARGEUR_UTILE - 20) / 2, padding: "20px 24px", borderRadius: 16, backgroundColor: cle ? JAUNE : CARTE, border: "1px solid rgba(28,27,25,.07)", marginBottom: 20 }}>
      <div style={{ display: "flex", fontFamily: MONO, fontSize: 20, letterSpacing: 1.5, color: cle ? ENCRE : GRIS }}>{etiquette.toUpperCase()}</div>
      <div style={{ display: "flex", fontWeight: 800, fontSize: taille(valeur, [50, 44, 38, 32], { largeur: 380, hauteur: 60, interligne: 1.1, ratio: 0.58 }), lineHeight: 1.1, color: ENCRE, marginTop: 6 }}>{valeur}</div>
      {detail ? <div style={{ display: "flex", fontWeight: 500, fontSize: 22, lineHeight: 1.25, color: cle ? ENCRE : GRIS, marginTop: 6 }}>{detail}</div> : null}
    </div>
  );
  return (
    <Zone>
      <TitreSerif p={p} tailleTexte={taille(slide.titre, [62, 56, 50], { hauteur: 150, interligne: 1.08, ratio: 0.48 })}>
        {slide.titre}
      </TitreSerif>
      <Texte p={p} tailleTexte={taille(slide.texte, [36, 34, 32, 30], { hauteur: 280 })}>
        {slide.texte}
      </Texte>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", width: LARGEUR_UTILE, marginTop: 34 }}>{slide.tuiles.map(tuile)}</div>
      {slide.sources ? <div style={{ display: "flex", marginTop: 6, fontWeight: 500, fontSize: 20, lineHeight: 1.35, color: GRIS }}>Sources : {slide.sources}</div> : null}
    </Zone>
  );
}

// Note du récit (fond candidat) : score, niveau, phrase-titre, explication,
// les 5 critères du barème en barres (notes du code, lignes du modèle).
function NoteRecit({ slide, p }) {
  return (
    <Zone>
      <Score slide={slide} p={p} tailleScore={150} />
      <div style={{ display: "flex", marginTop: 26 }}>
        <TitreSerif p={p} tailleTexte={taille(slide.titre, [54, 48, 44], { hauteur: 130, interligne: 1.08, ratio: 0.48 })} marge={14}>
          {slide.titre}
        </TitreSerif>
      </div>
      <Texte p={p} tailleTexte={28} couleur={p.secondaire}>
        {slide.explication}
      </Texte>
      <div style={{ display: "flex", flexDirection: "column", marginTop: 22 }}>
        {slide.criteres.map(({ label, note, max, ligne }) => (
          <div key={label} style={{ display: "flex", flexDirection: "column", marginTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 27, color: p.texte }}>
              <span>{label}</span>
              <span>{typeof note === "number" ? `${note}/${max}` : `–/${max}`}</span>
            </div>
            <div style={{ display: "flex", width: LARGEUR_UTILE, height: 9, borderRadius: 5, backgroundColor: rgba(p.texte, 0.2), marginTop: 7 }}>
              <div style={{ display: "flex", width: Math.round((LARGEUR_UTILE * Math.max(0, Math.min(note ?? 0, max))) / max), height: 9, borderRadius: 5, backgroundColor: p.texte }} />
            </div>
            {ligne ? <div style={{ display: "flex", marginTop: 6, fontWeight: 500, fontSize: 22, lineHeight: 1.25, color: p.secondaire }}>{ligne}</div> : null}
          </div>
        ))}
      </div>
    </Zone>
  );
}

// Court terme / long terme (papier) : onglets, titre, 3 cartes avec pastille.
function Effets({ slide, p }) {
  const onglet = (cle, titre, sous) => {
    const actif = slide.onglet === cle;
    return (
      <div style={{ display: "flex", flexDirection: "column", width: (LARGEUR_UTILE - 16) / 2, padding: "14px 22px", borderRadius: 14, backgroundColor: actif ? ENCRE : CARTE, border: "1px solid rgba(28,27,25,.07)" }}>
        <div style={{ display: "flex", fontWeight: 800, fontSize: 28, color: actif ? "#ffffff" : GRIS }}>{titre}</div>
        <div style={{ display: "flex", fontWeight: 500, fontSize: 22, color: actif ? "rgba(255,255,255,.75)" : GRIS }}>{sous}</div>
      </div>
    );
  };
  const t = taille(slide.cartes.map((c) => c.texte).join(" "), [32, 30, 28], { largeur: LARGEUR_UTILE - 60, hauteur: 540, interligne: 1.3 });
  return (
    <Zone>
      <div style={{ display: "flex", justifyContent: "space-between", width: LARGEUR_UTILE, marginBottom: 34 }}>
        {onglet("court", "Court terme", "Dans l’année")}
        {onglet("long", "Long terme", "Après plusieurs années")}
      </div>
      <TitreSerif p={p} tailleTexte={taille(slide.titre, [56, 50, 46], { hauteur: 130, interligne: 1.08, ratio: 0.48 })}>
        {slide.titre}
      </TitreSerif>
      {slide.cartes.map((carte, i) => (
        <Carte key={i} marge={i ? 18 : 0}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", fontWeight: 800, fontSize: 32, color: ENCRE }}>{carte.titre}</div>
            <Pastille valeur={carte.pastille} />
          </div>
          <div style={{ display: "flex", marginTop: 8, fontWeight: 500, fontSize: t, lineHeight: 1.3, color: ENCRE }}>{carte.texte}</div>
        </Carte>
      ))}
    </Zone>
  );
}

// Ailleurs (papier) : 1 ou 2 précédents cités par la fiche.
function Ailleurs({ slide, p }) {
  return (
    <Zone>
      <TitreSerif p={p} tailleTexte={taille(slide.titre, [60, 54, 48], { hauteur: 200, interligne: 1.08, ratio: 0.48 })}>
        {slide.titre}
      </TitreSerif>
      {slide.precedents.map((prec, i) => (
        <Carte key={i} marge={i ? 22 : 0} padding="26px 32px">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "baseline" }}>
              <div style={{ display: "flex", fontWeight: 800, fontSize: 38, color: ENCRE }}>{prec.pays}</div>
              {prec.annee ? <div style={{ display: "flex", marginLeft: 14, fontFamily: MONO, fontSize: 24, color: GRIS }}>{prec.annee}</div> : null}
            </div>
            <Pastille valeur={prec.pastille} />
          </div>
          <div style={{ display: "flex", marginTop: 12, fontWeight: 800, fontSize: 30, lineHeight: 1.3, color: ENCRE }}>{prec.fait}</div>
          {prec.resultat ? <div style={{ display: "flex", marginTop: 8, fontWeight: 500, fontSize: 30, lineHeight: 1.3, color: ENCRE }}>{prec.resultat}</div> : null}
        </Carte>
      ))}
      {slide.sources ? <div style={{ display: "flex", marginTop: 20, fontWeight: 500, fontSize: 20, lineHeight: 1.35, color: GRIS }}>Sources : {slide.sources}</div> : null}
    </Zone>
  );
}

const CONTENUS = {
  couverture: Couverture,
  mesure: Mesure,
  note: Note,
  chiffre: Chiffre,
  tient: TientCoince,
  fin: Fin,
  concretement: Concretement,
  noteRecit: NoteRecit,
  effetsCourt: Effets,
  effetsLong: Effets,
  ailleurs: Ailleurs,
  tientCoince: TientCoince,
};

// Élément de la slide demandée (une entrée de controlerCarrousel().slides ou
// de carrouselRecit().slides). `couleur` : thème du candidat ou null ;
// `sujet` : sujet court du pied de page. Images de la couverture (data URI) :
// `portrait` (détouré noir et blanc), `imageTheme` (photo du thème en
// duotone), `sticker` (objet du thème) ; replis : `illustration` (vignette
// du site), `photo` (portrait bleu).
export function elementSlide({ slide, candidatNom, sujet = "", photo = null, illustration = null, portrait = null, cadre = null, imageTheme = null, sticker = null, couleur = null }) {
  const Contenu = CONTENUS[slide.type];
  const p = palette(couleur, slide.type);
  return (
    <Cadre slide={slide} p={p} couleur={couleur} candidatNom={candidatNom} sujet={sujet}>
      <Contenu slide={slide} p={p} photo={photo} illustration={illustration} portrait={portrait} imageTheme={imageTheme} sticker={sticker} cadre={cadre} candidatNom={candidatNom} />
    </Cadre>
  );
}
