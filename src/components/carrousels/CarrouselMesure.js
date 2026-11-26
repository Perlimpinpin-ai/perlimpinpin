/* eslint-disable @next/next/no-img-element -- next/og (Satori) ne connaît que <img>. */
import { COULEURS_PASTILLES } from "@/lib/recit";
import { MARQUE, VERDICTS, melange, rgba, verdictDe } from "@/lib/charte-rs";
import { ECARTS, HAUT_ZONE, HAUTEUR, BAS_ZONE, LARGEUR, LARGEUR_UTILE, MARGE, PICTO, STYLES, TEXTES_FIN, COUVERTURE } from "@/lib/mise-en-page-carrousel";
import { BandeBillet, BoutonJaune, Carte, couleursBande, EnTete, Etiquette, FAMILLES, Fond, GRAIN, GRAISSES, Lignes, PastilleVerdict, Pied } from "./Primitives";

// Carrousel « une mesure » (8 slides 1080 × 1350, charte RS pages 13 et 14) :
// SEULE LA PARTIE DONNÉES SE REMPLIT. Ce composant ne reçoit que des données
// (slide assemblée par src/lib/carrousel-recit.js, lignes mesurées par
// src/lib/mise-en-page-carrousel.js, couleurs du registre, images prêtes) ;
// le design ne change pas sans validation.
//  - couverture et fin dans la couleur du candidat, slides 2 à 7 sur papier
//    crème avec grain, la couleur en accent ;
//  - couverture : nom de famille, mots clés surlignés, sous-titre DM Serif,
//    collage (candidat détouré N&B + grain, liseré blanc, devant le bloc
//    d'accent du registre ; papier jaune tramé déchiré, illustration teintée) ;
//  - slide 3 : score et barres dans la couleur du verdict, pastille en chasse fixe ;
//  - slide 7 : « Notre avis : … » puis « Ce qui tient… et ce qui coince. » ;
//  - bande « billet de banque » tirée du numéro de slide, pictos pixel art
//    seulement s'il reste de la place.

const COLONNE = { display: "flex", flexDirection: "column", width: LARGEUR_UTILE };

// Picto de chaque slide (liste fermée de la charte, src/lib/charte-rs.js).
export const PICTOS = { constat: "chart", noteRecit: "check", effetsCourt: "calendar", effetsLong: "hourglass", ailleurs: "globe", avis: "bubble", fin: "bubble" };

const VERDICT_PASTILLE = { vert: VERDICTS.solide.couleur, jaune: VERDICTS.plausible.couleur, rouge: VERDICTS.peuRealiste.couleur };

function PastilleEffet({ valeur }) {
  return <PastilleVerdict verdict={{ libelle: valeur, couleur: VERDICT_PASTILLE[COULEURS_PASTILLES[valeur]] ?? VERDICTS.plausible.couleur }} taille={22} />;
}

function Coche({ ok }) {
  const couleur = ok ? VERDICTS.solide.couleur : VERDICTS.peuRealiste.couleur;
  return (
    <svg width="34" height="34" viewBox="0 0 34 34">
      <circle cx="17" cy="17" r="16" fill={couleur} />
      {ok ? <path d="M9 17 L15 23 L25 11" stroke={MARQUE.blanc} strokeWidth="4" fill="none" /> : <path d="M11 11 L23 23 M23 11 L11 23" stroke={MARQUE.blanc} strokeWidth="4" fill="none" />}
    </svg>
  );
}

function PictoSlide({ src }) {
  if (!src) return null;
  return <img src={src.src} alt="" width={src.largeur} height={src.hauteur} style={{ position: "absolute", left: MARGE + LARGEUR_UTILE - src.largeur, top: BAS_ZONE - src.hauteur, width: src.largeur, height: src.hauteur }} />;
}

// --- Couverture ----------------------------------------------------------------------------

const C = COUVERTURE;
const BAS = HAUTEUR - C.bande;
const PAPIER = { gauche: 0, haut: BAS - 400, largeur: 560, hauteur: 400 };
const ILLUSTRATION = { gauche: 24, haut: BAS - 340, largeur: 500, hauteur: 330 };
const BOITE_CANDIDAT = { gauche: 520, droite: LARGEUR + 40, haut: 690, bas: BAS };
const BLOC = `508,792 ${LARGEUR},744 ${LARGEUR},${BAS} 470,${BAS}`;

// Titre : mots dans la couleur du texte ; chaque suite de mots surlignés forme
// un seul bloc (jaune, blanc sur le beurre d'Attal), texte en encre.
export function TitreCouverture({ b, couleur, centre = false }) {
  const { style } = b;
  const hauteurLigne = style.taille * style.interligne;
  const pad = C.paddingSurlignage;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: centre ? "center" : "flex-start" }}>
      {b.lignes.map((ligne, i) => {
        const groupes = [];
        for (const mot of ligne.mots) {
          const dernier = groupes.at(-1);
          if (dernier && dernier.jaune === Boolean(mot.jaune)) dernier.mots.push(mot);
          else groupes.push({ jaune: Boolean(mot.jaune), mots: [mot] });
        }
        return (
          <div key={i} style={{ display: "flex", height: hauteurLigne, alignItems: "stretch", marginLeft: groupes[0]?.jaune || centre ? 0 : pad }}>
            {groupes.map((g, k) => (
              <div
                key={k}
                style={{
                  display: "flex",
                  alignItems: "center",
                  marginRight: k < groupes.length - 1 ? b.espace : 0,
                  marginBottom: 2,
                  ...(g.jaune ? { backgroundColor: couleur.surlignage, padding: `0 ${pad}px` } : {}),
                  fontFamily: FAMILLES.couverture,
                  fontWeight: GRAISSES.couverture,
                  fontSize: style.taille,
                  letterSpacing: style.espacement,
                  color: g.jaune ? MARQUE.encre : couleur.texte,
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

// Candidat détouré (liseré blanc déjà posé par scripts/detourer-candidats.py),
// sinon la vignette en tirage avec un liseré blanc.
function Candidat({ candidat }) {
  if (!candidat) return null;
  const boiteL = BOITE_CANDIDAT.droite - BOITE_CANDIDAT.gauche;
  const boiteH = BOITE_CANDIDAT.bas - BOITE_CANDIDAT.haut;
  if (!candidat.detoure) {
    return (
      <div style={{ position: "absolute", left: 640, top: 850, display: "flex", padding: 10, backgroundColor: MARQUE.blanc, boxShadow: `0 14px 30px ${rgba(MARQUE.encre, 0.3)}`, transform: "rotate(-4deg)" }}>
        <img src={candidat.image} alt="" width={340} height={420} style={{ width: 340, height: 420 }} />
      </div>
    );
  }
  const echelle = Math.min(boiteL / candidat.largeur, boiteH / candidat.hauteur);
  const l = Math.round(candidat.largeur * echelle);
  const h = Math.round(candidat.hauteur * echelle);
  return <img src={candidat.image} alt="" width={l} height={h} style={{ position: "absolute", left: BOITE_CANDIDAT.gauche + Math.round((boiteL - l) / 2), top: BOITE_CANDIDAT.bas - h, width: l, height: h }} />;
}

function Couverture({ slide, mise, couleur, images, controle = false }) {
  const hautCredits = mise.credits ? BAS - 10 - mise.credits.hauteur - 8 : BAS;
  return (
    <>
      <Fond couleur={couleur.fond} grain={images.grain} opacite={GRAIN.couleur} />
      <EnTete numero={slide.numero} total={slide.total} couleur={couleur.texte} marge={C.marge} haut={70} />
      <div style={{ position: "absolute", left: C.marge - C.paddingSurlignage, top: C.hautTitre, display: "flex", flexDirection: "column" }}>
        <TitreCouverture b={mise.titre} couleur={couleur} />
        <div style={{ display: "flex", marginTop: C.ecartSousTitre, marginLeft: C.paddingSurlignage }}>
          <Lignes b={mise.sousTitre} couleur={rgba(couleur.texte, 0.9)} />
        </div>
      </div>
      {controle ? null : (
        <svg width={LARGEUR} height={HAUTEUR} viewBox={`0 0 ${LARGEUR} ${HAUTEUR}`} style={{ position: "absolute", left: 0, top: 0 }}>
          <polygon points={BLOC} fill={couleur.accent} />
        </svg>
      )}
      {images.papier ? <img src={images.papier} alt="" width={PAPIER.largeur} height={PAPIER.hauteur} style={{ position: "absolute", left: PAPIER.gauche, top: PAPIER.haut, width: PAPIER.largeur, height: PAPIER.hauteur }} /> : null}
      {images.illustration ? (
        <img src={images.illustration} alt="" width={ILLUSTRATION.largeur} height={ILLUSTRATION.hauteur} style={{ position: "absolute", left: ILLUSTRATION.gauche, top: ILLUSTRATION.haut, width: ILLUSTRATION.largeur, height: ILLUSTRATION.hauteur }} />
      ) : null}
      <Candidat candidat={images.candidat} />
      {controle ? null : (
        <div style={{ position: "absolute", left: C.marge, top: hautCredits - 16 - 52, height: 52, display: "flex", alignItems: "center", padding: "0 20px", borderRadius: 6, backgroundColor: MARQUE.carte, fontFamily: FAMILLES.mono, fontSize: 26, color: MARQUE.encre }}>
          <span>Glissez</span>
          <span style={{ marginLeft: 18, color: MARQUE.gris }}>→</span>
        </div>
      )}
      {mise.credits && !controle ? (
        <div style={{ position: "absolute", left: C.marge, top: hautCredits, display: "flex", padding: "4px 10px", borderRadius: 3, backgroundColor: couleur.clair ? rgba(MARQUE.carte, 0.85) : melange(couleur.fond, MARQUE.blanc, 0.22) }}>
          <Lignes b={mise.credits} couleur={couleur.clair ? MARQUE.encre : MARQUE.blanc} />
        </div>
      ) : null}
      {controle ? null : <BandeBillet graine={slide.numero} hauteur={C.bande} couleurs={[couleur.texte]} couverture />}
    </>
  );
}

// --- Slides 2 à 7 (papier crème) -----------------------------------------------------------

function Papier({ slide, couleur, images, pied, mise, children, controle = false }) {
  return (
    <>
      <Fond couleur={MARQUE.creme} grain={images.grain} opacite={GRAIN.creme} />
      <EnTete numero={slide.numero} total={slide.total} couleur={MARQUE.encre} />
      <div style={{ position: "absolute", left: MARGE, top: HAUT_ZONE, width: LARGEUR_UTILE, height: BAS_ZONE - HAUT_ZONE, display: "flex", flexDirection: "column" }}>{children}</div>
      {mise.picto ? <PictoSlide src={images.picto} /> : null}
      {controle ? null : <Pied texte={pied} numero={slide.numero} total={slide.total} couleur={MARQUE.gris} />}
      {controle ? null : <BandeBillet graine={slide.numero} couleurs={couleursBande(couleur)} />}
    </>
  );
}

function Constat({ mise, couleur, images }) {
  const largeurTuile = (LARGEUR_UTILE - ECARTS.tuileGap) / 2;
  return (
    <div style={COLONNE}>
      <div style={{ display: "flex" }}>
        <Etiquette couleur={couleur.accentCreme}>LE CONSTAT</Etiquette>
      </div>
      <div style={{ display: "flex", marginTop: ECARTS.apresEtiquette }}>
        <Lignes b={mise.titre} couleur={MARQUE.encre} />
      </div>
      <div style={{ display: "flex", marginTop: ECARTS.apresTitre }}>
        <Lignes b={mise.explication} couleurGras={MARQUE.encre} />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", width: LARGEUR_UTILE, marginTop: ECARTS.bloc }}>
        {mise.tuiles.map((tuile, i) => (
          <div key={i} style={{ position: "relative", display: "flex", flexDirection: "column", justifyContent: "center", width: largeurTuile, height: ECARTS.tuile, marginTop: i >= 2 ? ECARTS.tuileGap : 0, padding: `${ECARTS.paddingTuile}px 24px`, borderRadius: 14, backgroundColor: tuile.jaune ? MARQUE.jaune : MARQUE.carte, overflow: "hidden" }}>
            {images.grain ? <img src={images.grain} alt="" width={LARGEUR} height={HAUTEUR} style={{ position: "absolute", left: 0, top: 0, width: LARGEUR, height: HAUTEUR, opacity: GRAIN.carte }} /> : null}
            <div style={{ display: "flex", fontFamily: FAMILLES.titre, fontWeight: GRAISSES.gras, fontSize: STYLES.valeur.taille, letterSpacing: STYLES.valeur.espacement, lineHeight: STYLES.valeur.interligne, color: tuile.jaune ? MARQUE.encre : couleur.accentCreme, whiteSpace: "nowrap" }}>{tuile.valeur}</div>
            <div style={{ display: "flex", marginTop: 8 }}>
              <Lignes b={tuile.detail} couleur={tuile.jaune ? MARQUE.encre : MARQUE.gris} />
            </div>
          </div>
        ))}
      </div>
      <Carte largeur={LARGEUR_UTILE} hauteur={mise.hauteurCarte} grain={images.grain} marge={ECARTS.bloc} bordGauche={couleur.accentCreme} padding={`${ECARTS.paddingCarte}px ${ECARTS.paddingCarteX}px`}>
        <Lignes b={mise.proposition} couleurGras={MARQUE.encre} />
        {mise.imprecisions ? (
          <div style={{ display: "flex", marginTop: 12 }}>
            <Lignes b={mise.imprecisions} couleur={MARQUE.gris} />
          </div>
        ) : null}
      </Carte>
      {mise.sources ? (
        <div style={{ display: "flex", marginTop: 16 }}>
          <Lignes b={mise.sources} couleur={MARQUE.gris} />
        </div>
      ) : null}
    </div>
  );
}

function NoteRecit({ slide, mise, couleur }) {
  const verdict = verdictDe(slide.score);
  return (
    <div style={COLONNE}>
      <div style={{ display: "flex" }}>
        <Etiquette couleur={couleur.accentCreme}>LA NOTE PERLIMPINPIN</Etiquette>
      </div>
      <div style={{ display: "flex", alignItems: "center", height: ECARTS.scoreLigne, marginTop: ECARTS.apresEtiquette }}>
        <div style={{ display: "flex", alignItems: "baseline" }}>
          <div style={{ display: "flex", fontFamily: FAMILLES.couverture, fontWeight: GRAISSES.couverture, fontSize: STYLES.score.taille, letterSpacing: STYLES.score.espacement, lineHeight: 1, color: verdict.couleur }}>{slide.scoreAffiche}</div>
          <div style={{ display: "flex", fontFamily: FAMILLES.titre, fontWeight: GRAISSES.titre, fontSize: 56, color: MARQUE.gris, marginLeft: 10 }}>/100</div>
        </div>
        <div style={{ display: "flex", marginLeft: 36 }}>
          <PastilleVerdict verdict={verdict} taille={28} />
        </div>
      </div>
      <div style={{ display: "flex", marginTop: ECARTS.apresScore }}>
        <Lignes b={mise.titre} couleur={MARQUE.encre} />
      </div>
      <div style={{ display: "flex", marginTop: ECARTS.apresTitreNote }}>
        <Lignes b={mise.explication} couleurGras={MARQUE.encre} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", marginTop: ECARTS.avantCriteres }}>
        {mise.criteres.map((c, i) => (
          <div key={c.label} style={{ display: "flex", flexDirection: "column", marginTop: i ? ECARTS.critereEcart : 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", height: ECARTS.critereLigne }}>
              <div style={{ display: "flex", fontFamily: FAMILLES.titre, fontWeight: GRAISSES.gras, fontSize: STYLES.critereNom.taille, color: MARQUE.encre }}>{c.label}</div>
              <div style={{ display: "flex", fontFamily: FAMILLES.mono, fontSize: STYLES.critereNom.taille, color: MARQUE.encre }}>{typeof c.note === "number" ? `${c.note}/${c.max}` : `–/${c.max}`}</div>
            </div>
            <div style={{ display: "flex", width: LARGEUR_UTILE, height: ECARTS.critereBarre, marginTop: ECARTS.critereBarreEcart, borderRadius: 4, backgroundColor: rgba(MARQUE.encre, 0.1) }}>
              <div style={{ display: "flex", width: Math.round((LARGEUR_UTILE * Math.max(0, Math.min(c.note ?? 0, c.max))) / c.max), height: ECARTS.critereBarre, borderRadius: 4, backgroundColor: verdict.couleur }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Onglets({ actif, couleur }) {
  const onglet = (cle, haut, bas) => {
    const oui = actif === cle;
    return (
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", width: (LARGEUR_UTILE - 16) / 2, height: ECARTS.onglets, padding: "0 18px", fontFamily: FAMILLES.mono, color: oui ? MARQUE.blanc : MARQUE.gris, backgroundColor: oui ? MARQUE.encre : rgba(MARQUE.encre, 0.07), borderRadius: 8 }}>
        <div style={{ display: "flex", fontSize: 26, color: oui ? MARQUE.blanc : MARQUE.texte }}>{haut}</div>
        <div style={{ display: "flex", fontSize: 24, color: oui ? rgba(MARQUE.blanc, 0.7) : MARQUE.gris }}>{bas}</div>
      </div>
    );
  };
  return (
    <div style={{ display: "flex", justifyContent: "space-between", width: LARGEUR_UTILE }}>
      {onglet("court", "Court terme", "0 à 2 ans")}
      {onglet("long", "Long terme", "après plusieurs années")}
    </div>
  );
}

function Effets({ slide, mise, couleur, images }) {
  return (
    <div style={COLONNE}>
      <Onglets actif={slide.onglet} couleur={couleur} />
      <div style={{ display: "flex", marginTop: ECARTS.bloc }}>
        <Lignes b={mise.titre} couleur={MARQUE.encre} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", marginTop: ECARTS.apresTitre }}>
        {mise.effets.map((effet, i) => (
          <Carte key={i} largeur={LARGEUR_UTILE} hauteur={mise.hEffet[i]} grain={images.grain} marge={i ? ECARTS.carte : 0}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", height: ECARTS.enteteCarte }}>
              <div style={{ display: "flex", fontFamily: FAMILLES.titre, fontWeight: GRAISSES.gras, fontSize: 30, color: MARQUE.encre }}>{effet.acteur}</div>
              <PastilleEffet valeur={effet.pastille} />
            </div>
            <div style={{ display: "flex", marginTop: 8 }}>
              <Lignes b={effet.corps} couleurGras={MARQUE.encre} />
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
        <Etiquette couleur={couleur.accentCreme}>AILLEURS OU AVANT</Etiquette>
      </div>
      <div style={{ display: "flex", marginTop: ECARTS.apresEtiquette }}>
        <Lignes b={mise.titre} couleur={MARQUE.encre} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", marginTop: ECARTS.apresTitre }}>
        {mise.mesures.map((m, i) => (
          <Carte key={i} largeur={LARGEUR_UTILE} hauteur={mise.hMesure[i]} grain={images.grain} marge={i ? 18 : 0}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", height: 48 }}>
              <div style={{ display: "flex", alignItems: "baseline" }}>
                <div style={{ display: "flex", fontFamily: FAMILLES.titre, fontWeight: GRAISSES.gras, fontSize: 40, color: MARQUE.encre }}>{m.lieu}</div>
                {m.annee ? <div style={{ display: "flex", marginLeft: 16, fontFamily: FAMILLES.mono, fontSize: 28, color: MARQUE.gris }}>{m.annee}</div> : null}
              </div>
              <PastilleEffet valeur={m.pastille} />
            </div>
            <div style={{ display: "flex", marginTop: 10 }}>
              <Lignes b={m.faitBloc} couleurGras={MARQUE.encre} />
            </div>
            {m.resultatBloc ? (
              <div style={{ display: "flex", marginTop: 8 }}>
                <Lignes b={m.resultatBloc} couleurGras={MARQUE.encre} />
              </div>
            ) : null}
          </Carte>
        ))}
      </div>
      {mise.sources ? (
        <div style={{ display: "flex", marginTop: 18 }}>
          <Lignes b={mise.sources} couleur={MARQUE.gris} />
        </div>
      ) : null}
    </div>
  );
}

function Avis({ mise, couleur, images }) {
  const carte = (ok, titre, points, hauteur, marge) => (
    <Carte largeur={LARGEUR_UTILE} hauteur={hauteur} grain={images.grain} marge={marge}>
      <div style={{ display: "flex", alignItems: "center", height: ECARTS.enteteCarte }}>
        <Coche ok={ok} />
        <div style={{ display: "flex", marginLeft: 14, fontFamily: FAMILLES.titre, fontWeight: GRAISSES.gras, fontSize: 32, color: MARQUE.encre }}>{titre}</div>
      </div>
      {points.map((p, i) => (
        <div key={i} style={{ display: "flex", marginTop: 12 }}>
          <div style={{ display: "flex", width: 36, height: STYLES.courant.taille * STYLES.courant.interligne, alignItems: "center", fontFamily: FAMILLES.titre, fontSize: 38, color: couleur.accentCreme }}>•</div>
          <Lignes b={p} couleurGras={MARQUE.encre} />
        </div>
      ))}
    </Carte>
  );
  return (
    <div style={COLONNE}>
      <Lignes b={mise.avis} couleur={MARQUE.encre} />
      <div style={{ display: "flex", marginTop: ECARTS.apresTitre }}>
        <Lignes b={mise.bilan} couleur={couleur.accentCreme} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", marginTop: 26 }}>
        {carte(true, "Ce qui tient", mise.tient, mise.hTient, 0)}
        {carte(false, "Ce qui coince", mise.coince, mise.hCoince, ECARTS.carte)}
      </div>
    </div>
  );
}

// --- Fin (couleur du candidat) -------------------------------------------------------------

function Fin({ slide, mise, couleur, images, pied, controle = false }) {
  const doux = rgba(couleur.texte, 0.82);
  return (
    <>
      <Fond couleur={couleur.fond} grain={images.grain} opacite={GRAIN.couleur} />
      <EnTete numero={slide.numero} total={slide.total} couleur={couleur.texte} />
      <div style={{ position: "absolute", left: MARGE, top: HAUT_ZONE, width: LARGEUR_UTILE, height: BAS_ZONE - HAUT_ZONE, display: "flex", flexDirection: "column" }}>
        <Lignes b={mise.titre} couleur={couleur.texte} />
        <div style={{ display: "flex", marginTop: 30 }}>
          <Lignes b={mise.texte} couleur={doux} />
        </div>
        <div style={{ display: "flex", marginTop: 40 }}>
          <BoutonJaune>{mise.bouton ?? TEXTES_FIN.bouton}</BoutonJaune>
        </div>
        <div style={{ display: "flex", height: 32, marginTop: 12, alignItems: "center", fontFamily: FAMILLES.mono, fontSize: 24, color: doux }}>{TEXTES_FIN.lien}</div>
        <div style={{ display: "flex", marginTop: 40 }}>
          <Lignes b={mise.association} couleur={couleur.texte} />
        </div>
        <div style={{ display: "flex", alignItems: "center", height: 40, marginTop: 32, fontFamily: FAMILLES.mono, fontSize: 26, color: doux }}>
          <svg width="24" height="30" viewBox="0 0 22 28" style={{ marginRight: 14 }}>
            <path d="M2 2 H20 V26 L11 19 L2 26 Z" fill="none" stroke={doux} strokeWidth="2.5" strokeLinejoin="round" />
          </svg>
          {TEXTES_FIN.enregistrer}
        </div>
        {mise.sources ? (
          <div style={{ display: "flex", marginTop: 28 }}>
            <Lignes b={mise.sources} couleur={doux} />
          </div>
        ) : null}
        {mise.credits ? (
          <div style={{ display: "flex", marginTop: 10 }}>
            <Lignes b={mise.credits} couleur={doux} />
          </div>
        ) : null}
      </div>
      {mise.picto ? <PictoSlide src={images.picto} /> : null}
      {controle ? null : <Pied texte={pied} numero={slide.numero} total={slide.total} couleur={doux} />}
      {controle ? null : <BandeBillet graine={slide.numero} couleurs={[couleur.texte]} couverture />}
    </>
  );
}

const CONTENUS_PAPIER = { constat: Constat, noteRecit: NoteRecit, effetsCourt: Effets, effetsLong: Effets, ailleurs: Ailleurs, avis: Avis };

// Élément de la slide demandée. `mise` : miseEnPageSlide (mêmes lignes que la
// mesure) ; `couleur` : couleurs du registre (src/lib/charte-rs.js,
// couleursCandidat) ; `images` (data URI) : grain, papier, candidat
// ({ image, detoure }), illustration (traitée), picto ({ src, largeur, hauteur }) ;
// `pied` : « Candidat · Thème ».
// `controle` (tests, scripts/carrousel-rendu.test.js) : seulement les textes
// et les cartes sur un fond uni, sans grain, image, pied de page, bande ni
// collage : un pixel non uni dans une zone réservée est un texte qui y entre.
export function CarrouselMesure({ slide, mise, couleur, images: imagesFournies = {}, candidatNom, sujet = "", pied = null, controle = false }) {
  const images = controle ? {} : imagesFournies;
  const textePied = pied ?? (sujet ? `${candidatNom} · ${sujet}` : candidatNom);
  let contenu;
  if (slide.type === "couverture") contenu = <Couverture slide={slide} mise={mise} couleur={couleur} images={images} controle={controle} />;
  else if (slide.type === "fin") contenu = <Fin slide={slide} mise={mise} couleur={couleur} images={images} pied={textePied} controle={controle} />;
  else {
    const Contenu = CONTENUS_PAPIER[slide.type];
    contenu = (
      <Papier slide={slide} couleur={couleur} images={images} pied={textePied} mise={mise} controle={controle}>
        <Contenu slide={slide} mise={mise} couleur={couleur} images={images} />
      </Papier>
    );
  }
  return <div style={{ position: "relative", display: "flex", width: LARGEUR, height: HAUTEUR, overflow: "hidden", fontFamily: FAMILLES.titre }}>{contenu}</div>;
}

export const elementSlideDetaille = CarrouselMesure;

// Fin et collage réutilisés par les formats « programme » et « thématique ».
export { Fin as FinCharte };
