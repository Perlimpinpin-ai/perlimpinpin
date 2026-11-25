/* eslint-disable @next/next/no-img-element -- next/og (Satori) ne connaît que <img>. */
import { appreciationCarte } from "@/lib/carte";
import { COULEURS_PASTILLES } from "@/lib/recit";
import { ECARTS, HAUT_ZONE, HAUTEUR, HAUTEUR_BANDE, BAS_ZONE, LARGEUR, LARGEUR_UTILE, MARGE, PICTO, STYLES, TEXTES_FIN, COUVERTURE } from "@/lib/mise-en-page-carrousel";

// Rendu des slides 1080 × 1350 du carrousel détaillé (JSX pour next/og :
// flexbox seulement, ni grid ni filtre), selon la direction artistique de
// docs/prompt-carrousel.md (section 4) :
//  - couverture et fin entièrement dans la couleur du candidat
//    (src/lib/couleurs-carrousel.js) ; slides 2 à 7 sur papier crème avec
//    grain, la couleur en accent (étiquettes, onglets, filets, numéros) ;
//  - titres sans empattement (Inter Medium), graisse moyenne, lettres
//    resserrées, lignes équilibrées ; cartes légèrement granuleuses ;
//    étiquettes et boutons en police à chasse fixe (Geist Mono) ;
//  - bande de hachures façon billet de banque en bas de chaque slide ;
//  - pictogramme pixel art seulement s'il reste de la place ;
//  - les lignes affichées sont celles calculées par
//    src/lib/mise-en-page-carrousel.js (mesure = rendu), tailles fixes.

const CREME = "#F3EDE0";
const CARTE = "#FBF8F1";
const ENCRE = "#1C1B19";
const GRIS = "#5F5A52";
const JAUNE = "#FFD23F";
const BLANC = "#FFFFFF";
const MONO = "GeistMono";
const COLONNE = { display: "flex", flexDirection: "column", width: LARGEUR_UTILE };

// Pictogramme pixel art de chaque slide (src/lib/icones-pixel.js).
export const PICTOS = { constat: "pieces", noteRecit: "balance", effetsCourt: "calendrier", effetsLong: "jauge", ailleurs: "globe", avis: "commente", fin: "idee" };

function rgba(hex, alpha) {
  const n = parseInt(String(hex).replace("#", ""), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

// --- Texte mis en page -----------------------------------------------------------------

// Lignes d'un bloc (mise-en-page-carrousel.bloc), telles que mesurées.
function Lignes({ b, couleur = ENCRE, graisseGras = 800 }) {
  const { style } = b;
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {b.lignes.map((ligne, i) => (
        <div key={i} style={{ display: "flex", height: style.taille * style.interligne, alignItems: "center", fontFamily: style.police === "mono" ? MONO : style.police === "serif" ? "Serif" : "Texte", fontSize: style.taille, letterSpacing: style.espacement, color: couleur, whiteSpace: "nowrap" }}>
          {ligne.mots.map((mot, j) => (
            <div key={j} style={{ display: "flex", marginRight: j < ligne.mots.length - 1 ? b.espace : 0 }}>
              {mot.segments.map((seg, k) => (
                <span key={k} style={{ fontWeight: seg.gras ? graisseGras : style.police === "texte800" ? 800 : style.police === "serif" ? 600 : 500 }}>
                  {seg.texte}
                </span>
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function Etiquette({ children, couleur, fond = "transparent", bordure, taille = 24 }) {
  return (
    <div style={{ display: "flex", alignItems: "center", height: ECARTS.etiquette, fontFamily: MONO, fontSize: taille, letterSpacing: 1, color: couleur, backgroundColor: fond, border: `2px solid ${bordure ?? couleur}`, borderRadius: 6, padding: "0 12px" }}>
      {children}
    </div>
  );
}

// --- Fond, en-tête, pied, bande ------------------------------------------------------------

// Hachures façon billet de banque : vagues fines entrecroisées.
function BandeBillet({ couleur, opacite = 0.55, hauteur = HAUTEUR_BANDE }) {
  const chemins = [];
  for (let k = 0; k < 6; k++) {
    let d = "";
    for (let x = 0; x <= LARGEUR; x += 6) {
      const y = 28 + 15 * Math.sin((2 * Math.PI * x) / 90 + (k * Math.PI) / 3) * (k % 2 ? 1 : -1);
      d += `${x ? "L" : "M"}${x},${y.toFixed(1)} `;
    }
    chemins.push(d);
  }
  return (
    <svg width={LARGEUR} height={hauteur} viewBox={`0 0 ${LARGEUR} ${HAUTEUR_BANDE}`} preserveAspectRatio="none" style={{ position: "absolute", left: 0, top: HAUTEUR - hauteur }}>
      <line x1="0" y1="1" x2={LARGEUR} y2="1" stroke={couleur} strokeWidth="2" opacity={opacite} />
      {chemins.map((d, i) => (
        <path key={i} d={d} fill="none" stroke={couleur} strokeWidth="1.3" opacity={opacite} />
      ))}
      <line x1="0" y1={HAUTEUR_BANDE - 1} x2={LARGEUR} y2={HAUTEUR_BANDE - 1} stroke={couleur} strokeWidth="2" opacity={opacite} />
    </svg>
  );
}

function EnTete({ slide, texte, accent }) {
  return (
    <>
      <div style={{ position: "absolute", left: MARGE, top: 58, display: "flex", fontFamily: "Texte", fontWeight: 800, fontSize: 24, letterSpacing: 4, color: texte }}>/ PERLIMPINPIN</div>
      <div style={{ position: "absolute", left: LARGEUR - MARGE - 160, top: 58, width: 160, display: "flex", justifyContent: "flex-end", fontFamily: MONO, fontSize: 24, color: accent }}>
        {`${String(slide.numero).padStart(2, "0")} / ${String(slide.total).padStart(2, "0")}`}
      </div>
    </>
  );
}

function Pied({ candidatNom, sujet, couleur }) {
  return (
    <div style={{ position: "absolute", left: MARGE, top: BAS_ZONE + 22, width: LARGEUR_UTILE, display: "flex", fontFamily: "Texte", fontWeight: 500, fontSize: 24, color: couleur }}>
      {sujet ? `${candidatNom} · ${sujet}` : candidatNom}
    </div>
  );
}

function Fond({ couleur, grain, opacite }) {
  return (
    <>
      <div style={{ position: "absolute", left: 0, top: 0, width: LARGEUR, height: HAUTEUR, backgroundColor: couleur, display: "flex" }} />
      {grain ? <img src={grain} alt="" width={LARGEUR} height={HAUTEUR} style={{ position: "absolute", left: 0, top: 0, width: LARGEUR, height: HAUTEUR, opacity: opacite }} /> : null}
    </>
  );
}

// Carte granuleuse (le grain du papier, plus discret, posé dans la carte).
function Carte({ children, hauteur, grain, marge = 0, padding = `${ECARTS.paddingCarte}px ${ECARTS.paddingCarteX}px`, bordGauche = null }) {
  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", width: LARGEUR_UTILE, height: hauteur, marginTop: marge, padding, borderRadius: 14, backgroundColor: CARTE, border: "1px solid rgba(28,27,25,.10)", overflow: "hidden", ...(bordGauche ? { borderLeft: `8px solid ${bordGauche}` } : {}) }}>
      {grain ? <img src={grain} alt="" width={LARGEUR} height={HAUTEUR} style={{ position: "absolute", left: 0, top: 0, width: LARGEUR, height: HAUTEUR, opacity: 0.5 }} /> : null}
      {children}
    </div>
  );
}

function Zone({ children }) {
  return <div style={{ position: "absolute", left: MARGE, top: HAUT_ZONE, width: LARGEUR_UTILE, height: BAS_ZONE - HAUT_ZONE, display: "flex", flexDirection: "column" }}>{children}</div>;
}

function Picto({ src }) {
  if (!src) return null;
  return <img src={src} alt="" width={PICTO} height={PICTO} style={{ position: "absolute", left: MARGE + LARGEUR_UTILE - PICTO, top: BAS_ZONE - PICTO, width: PICTO, height: PICTO }} />;
}

// --- Petits éléments --------------------------------------------------------------------

const TEINTES_PASTILLES = {
  vert: { couleur: "#1f7a45", fond: "#e3f2e7" },
  jaune: { couleur: "#7a5b00", fond: "#faefc6" },
  rouge: { couleur: "#b42318", fond: "#fbe6e3" },
};

function Pastille({ valeur }) {
  const { couleur, fond } = TEINTES_PASTILLES[COULEURS_PASTILLES[valeur]] ?? TEINTES_PASTILLES.jaune;
  return (
    <Etiquette couleur={couleur} fond={fond} bordure={rgba(couleur, 0.4)}>
      {valeur.toUpperCase()}
    </Etiquette>
  );
}

function Coche({ ok }) {
  const couleur = ok ? "#1f7a45" : "#b42318";
  return (
    <svg width="34" height="34" viewBox="0 0 34 34">
      <rect x="1.5" y="1.5" width="31" height="31" rx="4" fill="none" stroke={couleur} strokeWidth="3" />
      {ok ? <path d="M9 17 L15 23 L25 11" stroke={couleur} strokeWidth="4" fill="none" /> : <path d="M10 10 L24 24 M24 10 L10 24" stroke={couleur} strokeWidth="4" fill="none" />}
    </svg>
  );
}

// --- Couverture ----------------------------------------------------------------------------
// Calée sur le modèle Teddy Riner. Le moteur (next/og : Satori puis resvg) ne
// fait qu'empiler des images déjà prêtes (scripts/preparer-images-carrousel.js,
// scripts/detourer-candidats.py) : fond de couleur et grain, bloc foncé,
// papier jaune déchiré, illustration teintée, candidat détouré avec grain et
// liseré, puis les textes.

const C = COUVERTURE;
const BAS = HAUTEUR - C.bande;
const PAPIER = { gauche: 0, haut: BAS - 400, largeur: 560, hauteur: 400 };
const ILLUSTRATION = { gauche: 24, haut: BAS - 340, largeur: 500, hauteur: 330 };
const BOITE_CANDIDAT = { gauche: 520, droite: LARGEUR + 40, haut: 690, bas: BAS };
const BLOC = `508,792 ${LARGEUR},744 ${LARGEUR},${BAS} 470,${BAS}`;

// Mélange d'une couleur avec du blanc (part du blanc : 0 à 1).
function eclaircir(hex, part) {
  const n = parseInt(String(hex).replace("#", ""), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (255 - v) * part));
  return `rgb(${c.join(",")})`;
}

// Barre de progression : un tiret par slide, le premier plein.
function Progression({ slide }) {
  const n = slide.total;
  const largeur = n * 29 + (n - 1) * 10;
  return (
    <div style={{ position: "absolute", left: LARGEUR - C.marge - largeur, top: 86, width: largeur, height: 5, display: "flex" }}>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} style={{ width: 29, height: i < slide.numero ? 5 : 4, marginLeft: i ? 10 : 0, borderRadius: 2, backgroundColor: i < slide.numero ? BLANC : "rgba(255,255,255,.35)" }} />
      ))}
    </div>
  );
}

// Titre : mots blancs ; chaque suite de mots surlignés forme un seul bloc jaune.
function TitreCouverture({ b }) {
  const { style } = b;
  const hauteurLigne = style.taille * style.interligne;
  const pad = C.paddingSurlignage;
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {b.lignes.map((ligne, i) => {
        const groupes = [];
        for (const mot of ligne.mots) {
          const dernier = groupes.at(-1);
          if (dernier && dernier.jaune === Boolean(mot.jaune)) dernier.mots.push(mot);
          else groupes.push({ jaune: Boolean(mot.jaune), mots: [mot] });
        }
        return (
          <div key={i} style={{ display: "flex", height: hauteurLigne, alignItems: "stretch", marginLeft: groupes[0]?.jaune ? 0 : pad }}>
            {groupes.map((g, k) => (
              <div
                key={k}
                style={{
                  display: "flex",
                  alignItems: "center",
                  marginRight: k < groupes.length - 1 ? b.espace : 0,
                  marginBottom: 2,
                  ...(g.jaune ? { backgroundColor: JAUNE, padding: `0 ${pad}px` } : {}),
                  fontFamily: "Texte",
                  fontWeight: 800,
                  fontSize: style.taille,
                  letterSpacing: style.espacement,
                  color: g.jaune ? ENCRE : BLANC,
                  whiteSpace: "nowrap",
                }}
              >
                {g.mots.map((mot, j) => (
                  <span key={j} style={{ marginRight: j < g.mots.length - 1 ? b.espace : 0 }}>
                    {mot.segments[0].texte}
                  </span>
                ))}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// Candidat détouré : posé en bas de sa boîte, à sa taille réelle réduite.
function Candidat({ candidat }) {
  if (!candidat) return null;
  const boiteL = BOITE_CANDIDAT.droite - BOITE_CANDIDAT.gauche;
  const boiteH = BOITE_CANDIDAT.bas - BOITE_CANDIDAT.haut;
  if (!candidat.detoure) {
    // Repli : la vignette actuelle en tirage incliné.
    return (
      <div style={{ position: "absolute", left: 560, top: 720, display: "flex", boxShadow: "0 18px 40px rgba(0,0,0,.35)", transform: "rotate(-4deg)" }}>
        <img src={candidat.image} alt="" width={434} height={535} style={{ width: 434, height: 535 }} />
      </div>
    );
  }
  const echelle = Math.min(boiteL / candidat.largeur, boiteH / candidat.hauteur);
  const l = Math.round(candidat.largeur * echelle);
  const h = Math.round(candidat.hauteur * echelle);
  return <img src={candidat.image} alt="" width={l} height={h} style={{ position: "absolute", left: BOITE_CANDIDAT.gauche + Math.round((boiteL - l) / 2), top: BOITE_CANDIDAT.bas - h, width: l, height: h }} />;
}

function Couverture({ slide, mise, couleur, images }) {
  const hautCredits = mise.credits ? BAS - 10 - mise.credits.hauteur - 8 : BAS;
  return (
    <>
      <Fond couleur={couleur.fond} grain={images.grain} opacite={0.55} />
      <div style={{ position: "absolute", left: C.marge, top: 74, display: "flex", fontFamily: "Texte", fontWeight: 800, fontSize: 25, letterSpacing: 3, color: BLANC }}>/ PERLIMPINPIN</div>
      <Progression slide={slide} />
      <div style={{ position: "absolute", left: C.marge - C.paddingSurlignage, top: C.hautTitre, display: "flex", flexDirection: "column" }}>
        <TitreCouverture b={mise.titre} />
        <div style={{ display: "flex", marginTop: C.ecartSousTitre, marginLeft: C.paddingSurlignage }}>
          <Lignes b={mise.sousTitre} couleur="rgba(255,255,255,.88)" />
        </div>
      </div>
      <svg width={LARGEUR} height={HAUTEUR} viewBox={`0 0 ${LARGEUR} ${HAUTEUR}`} style={{ position: "absolute", left: 0, top: 0 }}>
        <polygon points={BLOC} fill={couleur.bloc} />
      </svg>
      {images.papier ? <img src={images.papier} alt="" width={PAPIER.largeur} height={PAPIER.hauteur} style={{ position: "absolute", left: PAPIER.gauche, top: PAPIER.haut, width: PAPIER.largeur, height: PAPIER.hauteur }} /> : null}
      {images.illustration ? (
        <img src={images.illustration} alt="" width={ILLUSTRATION.largeur} height={ILLUSTRATION.hauteur} style={{ position: "absolute", left: ILLUSTRATION.gauche, top: ILLUSTRATION.haut, width: ILLUSTRATION.largeur, height: ILLUSTRATION.hauteur }} />
      ) : null}
      <Candidat candidat={images.candidat} />
      <div style={{ position: "absolute", left: C.marge, top: hautCredits - 16 - 52, height: 52, display: "flex", alignItems: "center", padding: "0 20px", borderRadius: 6, backgroundColor: "#ECE8EE", fontFamily: MONO, fontSize: 26, color: ENCRE }}>
        <span>Glissez</span>
        <span style={{ marginLeft: 18, color: "#8A8790" }}>→</span>
      </div>
      {mise.credits ? (
        <div style={{ position: "absolute", left: C.marge, top: hautCredits, display: "flex", padding: "4px 10px", borderRadius: 3, backgroundColor: eclaircir(couleur.fond, 0.22) }}>
          <Lignes b={mise.credits} couleur={BLANC} />
        </div>
      ) : null}
      <BandeBillet couleur="#ffffff" opacite={0.45} hauteur={C.bande} />
    </>
  );
}

// --- Slides 2 à 7 (papier crème) -----------------------------------------------------------

function Papier({ slide, couleur, images, candidatNom, sujet, mise, children }) {
  return (
    <>
      <Fond couleur={CREME} grain={images.grain} opacite={0.9} />
      <EnTete slide={slide} texte={ENCRE} accent={couleur.fond} />
      <Zone>{children}</Zone>
      {mise.picto ? <Picto src={images.picto} /> : null}
      <Pied candidatNom={candidatNom} sujet={sujet} couleur={GRIS} />
      <BandeBillet couleur={couleur.fond} />
    </>
  );
}

function Constat({ mise, couleur, images }) {
  const largeurTuile = (LARGEUR_UTILE - ECARTS.tuileGap) / 2;
  return (
    <div style={COLONNE}>
      <div style={{ display: "flex" }}>
        <Etiquette couleur={couleur.fond}>LE CONSTAT</Etiquette>
      </div>
      <div style={{ display: "flex", marginTop: ECARTS.apresEtiquette }}>
        <Lignes b={mise.titre} />
      </div>
      <div style={{ display: "flex", marginTop: ECARTS.apresTitre }}>
        <Lignes b={mise.explication} />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", width: LARGEUR_UTILE, marginTop: ECARTS.bloc }}>
        {mise.tuiles.map((tuile, i) => (
          <div
            key={i}
            style={{ position: "relative", display: "flex", flexDirection: "column", justifyContent: "center", width: largeurTuile, height: ECARTS.tuile, marginTop: i >= 2 ? ECARTS.tuileGap : 0, padding: `${ECARTS.paddingTuile}px 24px`, borderRadius: 14, backgroundColor: tuile.jaune ? JAUNE : CARTE, border: tuile.jaune ? "none" : "1px solid rgba(28,27,25,.10)", overflow: "hidden" }}
          >
            {images.grain ? <img src={images.grain} alt="" width={LARGEUR} height={HAUTEUR} style={{ position: "absolute", left: 0, top: 0, width: LARGEUR, height: HAUTEUR, opacity: 0.45 }} /> : null}
            <div style={{ display: "flex", fontFamily: "Texte", fontWeight: 800, fontSize: STYLES.valeur.taille, letterSpacing: STYLES.valeur.espacement, lineHeight: STYLES.valeur.interligne, color: tuile.jaune ? ENCRE : couleur.fond, whiteSpace: "nowrap" }}>{tuile.valeur}</div>
            <div style={{ display: "flex", marginTop: 8 }}>
              <Lignes b={tuile.detail} couleur={tuile.jaune ? ENCRE : GRIS} />
            </div>
          </div>
        ))}
      </div>
      <Carte hauteur={mise.hauteurCarte} grain={images.grain} marge={ECARTS.bloc} bordGauche={couleur.fond}>
        <Lignes b={mise.proposition} />
        {mise.imprecisions ? (
          <div style={{ display: "flex", marginTop: 12 }}>
            <Lignes b={mise.imprecisions} couleur={GRIS} />
          </div>
        ) : null}
      </Carte>
      {mise.sources ? (
        <div style={{ display: "flex", marginTop: 16 }}>
          <Lignes b={mise.sources} couleur={GRIS} />
        </div>
      ) : null}
    </div>
  );
}

function NoteRecit({ slide, mise, couleur }) {
  const teinte = appreciationCarte(slide.score);
  return (
    <div style={COLONNE}>
      <div style={{ display: "flex" }}>
        <Etiquette couleur={couleur.fond}>LA NOTE PERLIMPINPIN</Etiquette>
      </div>
      <div style={{ display: "flex", alignItems: "center", height: ECARTS.scoreLigne, marginTop: ECARTS.apresEtiquette }}>
        <div style={{ display: "flex", alignItems: "baseline" }}>
          <div style={{ display: "flex", fontFamily: "Texte", fontWeight: 800, fontSize: STYLES.score.taille, letterSpacing: STYLES.score.espacement, lineHeight: 1, color: teinte.score }}>{slide.scoreAffiche}</div>
          <div style={{ display: "flex", fontFamily: "Texte", fontWeight: 500, fontSize: 48, color: GRIS, marginLeft: 8 }}>/100</div>
        </div>
        <div style={{ display: "flex", marginLeft: 32 }}>
          <Etiquette couleur={teinte.pastilleTexte} fond={teinte.pastilleFond} bordure={teinte.pastilleFond} taille={28}>
            {slide.palier.toUpperCase()}
          </Etiquette>
        </div>
      </div>
      <div style={{ display: "flex", marginTop: 18 }}>
        <Lignes b={mise.titre} />
      </div>
      <div style={{ display: "flex", marginTop: 14 }}>
        <Lignes b={mise.explication} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", marginTop: 22 }}>
        {mise.criteres.map((c, i) => (
          <div key={c.label} style={{ display: "flex", flexDirection: "column", marginTop: i ? 12 : 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", height: 36 }}>
              <div style={{ display: "flex", fontFamily: "Texte", fontWeight: 800, fontSize: 28, color: ENCRE }}>{c.label}</div>
              <div style={{ display: "flex", fontFamily: MONO, fontSize: 28, color: couleur.fond }}>{typeof c.note === "number" ? `${c.note}/${c.max}` : `–/${c.max}`}</div>
            </div>
            <div style={{ display: "flex", width: LARGEUR_UTILE, height: ECARTS.barre, marginTop: 8, borderRadius: 2, backgroundColor: rgba(ENCRE, 0.12) }}>
              <div style={{ display: "flex", width: Math.round((LARGEUR_UTILE * Math.max(0, Math.min(c.note ?? 0, c.max))) / c.max), height: ECARTS.barre, borderRadius: 2, backgroundColor: couleur.fond }} />
            </div>
            {c.ligne ? (
              <div style={{ display: "flex", marginTop: 8 }}>
                <Lignes b={c.ligne} couleur={GRIS} />
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function Onglets({ actif, couleur }) {
  const onglet = (cle, texte) => {
    const oui = actif === cle;
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: (LARGEUR_UTILE - 16) / 2, height: ECARTS.onglets, fontFamily: MONO, fontSize: 26, letterSpacing: 1, color: oui ? BLANC : couleur.fond, backgroundColor: oui ? couleur.fond : "transparent", border: `2px solid ${couleur.fond}`, borderRadius: 8 }}>
        {texte}
      </div>
    );
  };
  return (
    <div style={{ display: "flex", justifyContent: "space-between", width: LARGEUR_UTILE }}>
      {onglet("court", "COURT TERME · 0 À 2 ANS")}
      {onglet("long", "LONG TERME · PLUS TARD")}
    </div>
  );
}

function Effets({ slide, mise, couleur, images }) {
  return (
    <div style={COLONNE}>
      <Onglets actif={slide.onglet} couleur={couleur} />
      <div style={{ display: "flex", marginTop: ECARTS.bloc }}>
        <Lignes b={mise.titre} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", marginTop: ECARTS.apresTitre }}>
        {mise.effets.map((effet, i) => (
          <Carte key={i} hauteur={mise.hEffet[i]} grain={images.grain} marge={i ? ECARTS.carte : 0} padding={`22px ${ECARTS.paddingCarteX}px`}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", height: ECARTS.enteteCarte }}>
              <div style={{ display: "flex", fontFamily: "Texte", fontWeight: 800, fontSize: 30, color: couleur.fond }}>{effet.acteur}</div>
              <Pastille valeur={effet.pastille} />
            </div>
            <div style={{ display: "flex", marginTop: 8 }}>
              <Lignes b={effet.corps} />
            </div>
          </Carte>
        ))}
      </div>
    </div>
  );
}

function Ailleurs({ mise, couleur, images }) {
  return (
    <div style={COLONNE}>
      <div style={{ display: "flex" }}>
        <Etiquette couleur={couleur.fond}>AILLEURS OU AVANT</Etiquette>
      </div>
      <div style={{ display: "flex", marginTop: ECARTS.apresEtiquette }}>
        <Lignes b={mise.titre} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", marginTop: ECARTS.apresTitre }}>
        {mise.mesures.map((m, i) => (
          <Carte key={i} hauteur={mise.hMesure[i]} grain={images.grain} marge={i ? 18 : 0}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", height: 48 }}>
              <div style={{ display: "flex", alignItems: "baseline" }}>
                <div style={{ display: "flex", fontFamily: "Texte", fontWeight: 800, fontSize: 40, color: couleur.fond }}>{m.lieu}</div>
                {m.annee ? <div style={{ display: "flex", marginLeft: 16, fontFamily: MONO, fontSize: 28, color: GRIS }}>{m.annee}</div> : null}
              </div>
              <Pastille valeur={m.pastille} />
            </div>
            <div style={{ display: "flex", marginTop: 10 }}>
              <Lignes b={m.faitBloc} />
            </div>
            {m.resultatBloc ? (
              <div style={{ display: "flex", marginTop: 8 }}>
                <Lignes b={m.resultatBloc} />
              </div>
            ) : null}
          </Carte>
        ))}
      </div>
      {mise.sources ? (
        <div style={{ display: "flex", marginTop: 18 }}>
          <Lignes b={mise.sources} couleur={GRIS} />
        </div>
      ) : null}
    </div>
  );
}

function Avis({ mise, couleur, images }) {
  const carte = (ok, titre, points, hauteur, marge) => (
    <Carte hauteur={hauteur} grain={images.grain} marge={marge}>
      <div style={{ display: "flex", alignItems: "center", height: ECARTS.enteteCarte }}>
        <Coche ok={ok} />
        <div style={{ display: "flex", marginLeft: 14, fontFamily: MONO, fontSize: 26, letterSpacing: 1, color: ENCRE }}>{titre}</div>
      </div>
      {points.map((p, i) => (
        <div key={i} style={{ display: "flex", marginTop: 12 }}>
          <div style={{ display: "flex", width: 36, height: STYLES.courant.taille * STYLES.courant.interligne, alignItems: "center", fontFamily: "Texte", fontSize: 38, color: couleur.fond }}>•</div>
          <Lignes b={p} />
        </div>
      ))}
    </Carte>
  );
  return (
    <div style={COLONNE}>
      <div style={{ display: "flex" }}>
        <Etiquette couleur={BLANC} fond={couleur.fond} bordure={couleur.fond}>
          NOTRE AVIS
        </Etiquette>
      </div>
      <div style={{ display: "flex", marginTop: ECARTS.apresEtiquette }}>
        <Lignes b={mise.avis} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", marginTop: 30 }}>
        {carte(true, "CE QUI TIENT", mise.tient, mise.hTient, 0)}
        {carte(false, "CE QUI COINCE", mise.coince, mise.hCoince, ECARTS.carte)}
      </div>
    </div>
  );
}

// --- Fin (couleur du candidat) -------------------------------------------------------------

function Fin({ slide, mise, couleur, images }) {
  const clair = rgba("#ffffff", 0.82);
  return (
    <>
      <Fond couleur={couleur.fond} grain={images.grain} opacite={0.55} />
      <EnTete slide={slide} texte={BLANC} accent={clair} />
      <Zone>
        <Lignes b={mise.titre} couleur={BLANC} />
        <div style={{ display: "flex", marginTop: 30 }}>
          <Lignes b={mise.texte} couleur={clair} />
        </div>
        <div style={{ display: "flex", marginTop: 40, height: 64 }}>
          <div style={{ display: "flex", alignItems: "center", fontFamily: MONO, fontSize: 28, letterSpacing: 1, color: ENCRE, backgroundColor: JAUNE, borderRadius: 8, padding: "0 22px" }}>{TEXTES_FIN.bouton}</div>
        </div>
        <div style={{ display: "flex", height: 32, marginTop: 12, alignItems: "center", fontFamily: MONO, fontSize: 24, color: clair }}>{TEXTES_FIN.lien}</div>
        <div style={{ display: "flex", marginTop: 40 }}>
          <Lignes b={mise.association} couleur={BLANC} />
        </div>
        <div style={{ display: "flex", alignItems: "center", height: 40, marginTop: 32, fontFamily: MONO, fontSize: 26, color: clair }}>
          <svg width="24" height="30" viewBox="0 0 22 28" style={{ marginRight: 14 }}>
            <path d="M2 2 H20 V26 L11 19 L2 26 Z" fill="none" stroke={clair} strokeWidth="2.5" strokeLinejoin="round" />
          </svg>
          {TEXTES_FIN.enregistrer.toUpperCase()}
        </div>
        {mise.sources ? (
          <div style={{ display: "flex", marginTop: 28 }}>
            <Lignes b={mise.sources} couleur={clair} />
          </div>
        ) : null}
        {mise.credits ? (
          <div style={{ display: "flex", marginTop: 10 }}>
            <Lignes b={mise.credits} couleur={clair} />
          </div>
        ) : null}
      </Zone>
      {mise.picto ? <Picto src={images.picto} /> : null}
      <BandeBillet couleur="#ffffff" opacite={0.45} />
    </>
  );
}

const CONTENUS_PAPIER = { constat: Constat, noteRecit: NoteRecit, effetsCourt: Effets, effetsLong: Effets, ailleurs: Ailleurs, avis: Avis };

// Élément de la slide demandée. `mise` : miseEnPageSlide (mêmes lignes que la
// mesure) ; `couleur` : { fond, bloc } ; `images` (data URI) : grain, candidat
// ({ image, detoure }), illustration (traitée), picto.
export function elementSlideDetaille({ slide, mise, couleur, images = {}, candidatNom, sujet = "" }) {
  let contenu;
  if (slide.type === "couverture") contenu = <Couverture slide={slide} mise={mise} couleur={couleur} images={images} />;
  else if (slide.type === "fin") contenu = <Fin slide={slide} mise={mise} couleur={couleur} images={images} />;
  else {
    const Contenu = CONTENUS_PAPIER[slide.type];
    contenu = (
      <Papier slide={slide} couleur={couleur} images={images} candidatNom={candidatNom} sujet={sujet} mise={mise}>
        <Contenu slide={slide} mise={mise} couleur={couleur} images={images} />
      </Papier>
    );
  }
  return <div style={{ position: "relative", display: "flex", width: LARGEUR, height: HAUTEUR, overflow: "hidden", fontFamily: "Texte" }}>{contenu}</div>;
}

