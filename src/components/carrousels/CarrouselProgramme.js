/* eslint-disable @next/next/no-img-element -- next/og (Satori) ne connaît que <img>. */
import { MARQUE, legendeVerdicts, rgba } from "@/lib/charte-rs";
import { dataUriPicto } from "@/lib/pictos-charte";
import { HAUT_ZONE, BAS_ZONE, LARGEUR, LARGEUR_UTILE, MARGE, STYLES } from "@/lib/mise-en-page-carrousel";
import { GEO, positionsCartes } from "@/lib/mise-en-page-formats";
import { FinCharte, TitreCouverture } from "./CarrouselMesure";
import { BandeBillet, Carte, PhotoGrain, prechargerImages, couleursBande, EnTete, Etiquette, FAMILLES, Fond, GRAIN, GRAISSES, H, Jauge, Lignes, PastilleVerdict, Picto, Pied, PixelsLegers, Portrait } from "./Primitives";

// Carrousel « analyse de programme » (10 slides, charte RS page 15) : SEULE
// LA PARTIE DONNÉES SE REMPLIT. Données : slides assemblées par
// src/lib/carrousel-formats.js (assemblerProgramme : notes, moyenne et
// verdicts calculés par le code), lignes mesurées par
// src/lib/mise-en-page-formats.js, couleurs du registre, images prêtes.
//  1. couverture fixe : « On a noté 6 mesures de [Nom]. », photo au centre
//     avec liseré jaune (sans arche ni bloc), pixels légers, 6 cartes en arc ;
//  2. vue d'ensemble : moyenne, verdict, titre d'avis, 6 barres ;
//  3 à 8. une slide par mesure ; 9. notre avis ; 10. fin au pluriel.

const COLONNE = { display: "flex", flexDirection: "column", width: LARGEUR_UTILE };

// Photo détourée au centre, liseré jaune déjà posé (charte RS, page 11),
// posée en bas de la zone photo ; grain ajouté sur la silhouette seulement.
function PhotoDetouree({ photo, zone, grain }) {
  const echelle = Math.min(zone.largeur / photo.largeur, zone.hauteur / photo.hauteur);
  const l = Math.round(photo.largeur * echelle);
  const h = Math.round(photo.hauteur * echelle);
  return (
    <div style={{ position: "absolute", left: zone.x + Math.round((zone.largeur - l) / 2), top: zone.y + zone.hauteur - h, width: l, height: h, display: "flex" }}>
      <PhotoGrain image={photo.image} grain={grain} largeur={l} hauteur={h} opacite={0.5} />
    </div>
  );
}

function Couverture({ slide, mise, couleur, images }) {
  const p = GEO.photo;
  return (
    <>
      <Fond couleur={couleur.fond} grain={images.grain} opacite={GRAIN.couleur} />
      <PixelsLegers graine={slide.numero * 7 + 3} centre={{ x: p.x + p.largeur / 2, y: p.y + p.hauteur / 2 }} couleurs={[MARQUE.blanc, MARQUE.jaune, couleur.accent, couleur.texte]} />
      <EnTete numero={slide.numero} total={slide.total} couleur={couleur.texte} marge={84} haut={70} />
      <div style={{ position: "absolute", left: 84, top: GEO.couvTitreHaut, display: "flex", flexDirection: "column", alignItems: "center", width: LARGEUR - 168 }}>
        <TitreCouverture b={mise.titre} couleur={couleur} centre />
        <div style={{ display: "flex", marginTop: 26 }}>
          <Lignes b={mise.sousTitre} couleur={rgba(couleur.texte, 0.9)} />
        </div>
      </div>
      {images.portraitDetoure ? <PhotoDetouree photo={images.portraitDetoure} zone={p} grain={images.grain} /> : <Portrait src={images.portrait} x={p.x} y={p.y} largeur={p.largeur} hauteur={p.hauteur} lisere={MARQUE.jaune} />}
      {positionsCartes().map((pos, i) => {
        const c = slide.cartes[i];
        const picto = c?.picto ? dataUriPicto(c.picto, { taille: 3, couleur: couleur.accentCreme, etincelles: false }) : null;
        return (
          <div key={i} style={{ position: "absolute", left: pos.x, top: pos.y, width: pos.largeur, height: pos.hauteur, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "16px 18px", borderRadius: 12, backgroundColor: MARQUE.carte, transform: `rotate(${[-4, -1, 3, 4, 1, -3][i]}deg)` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", fontFamily: FAMILLES.mono, fontSize: 24, color: MARQUE.gris }}>{String(i + 1).padStart(2, "0")}</div>
              {picto ? <img src={picto.src} alt="" width={picto.largeur} height={picto.hauteur} style={{ width: picto.largeur, height: picto.hauteur }} /> : null}
            </div>
            <div style={{ display: "flex", fontFamily: FAMILLES.titre, fontWeight: GRAISSES.gras, fontSize: 30, color: MARQUE.encre }}>{c?.themeNom}</div>
            <div style={{ display: "flex", fontFamily: FAMILLES.mono, fontSize: 26, color: couleur.accentCreme }}>?/100</div>
          </div>
        );
      })}
      {mise.credits ? (
        <div style={{ position: "absolute", left: 84, top: H - 28 - 16 - mise.credits.hauteur, display: "flex" }}>
          <Lignes b={mise.credits} couleur={rgba(couleur.texte, 0.85)} />
        </div>
      ) : null}
      <BandeBillet graine={slide.numero} hauteur={28} couleurs={[couleur.texte]} couverture />
    </>
  );
}

function Papier({ slide, couleur, images, children, mise, picto }) {
  return (
    <>
      <Fond couleur={MARQUE.creme} grain={images.grain} opacite={GRAIN.creme} />
      <EnTete numero={slide.numero} total={slide.total} couleur={MARQUE.encre} />
      <div style={{ position: "absolute", left: MARGE, top: HAUT_ZONE, width: LARGEUR_UTILE, height: BAS_ZONE - HAUT_ZONE, display: "flex", flexDirection: "column" }}>{children}</div>
      {mise.picto && picto ? <Picto picto={picto} x={MARGE + LARGEUR_UTILE - picto.largeur} y={BAS_ZONE - picto.hauteur} /> : null}
      <Pied texte={slide.pied} numero={slide.numero} total={slide.total} couleur={MARQUE.gris} />
      <BandeBillet graine={slide.numero} couleurs={couleursBande(couleur)} />
    </>
  );
}

function Score({ note, verdict, taille = 140 }) {
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      <div style={{ display: "flex", alignItems: "baseline" }}>
        <div style={{ display: "flex", fontFamily: FAMILLES.couverture, fontWeight: GRAISSES.couverture, fontSize: taille, letterSpacing: -taille * 0.04, lineHeight: 1, color: verdict.couleur }}>{String(note).replace(".", ",")}</div>
        <div style={{ display: "flex", fontFamily: FAMILLES.titre, fontSize: taille * 0.34, color: MARQUE.gris, marginLeft: 8 }}>/100</div>
      </div>
      <div style={{ display: "flex", marginLeft: 30 }}>
        <PastilleVerdict verdict={verdict} taille={26} />
      </div>
    </div>
  );
}

function Ensemble({ slide, mise, couleur }) {
  return (
    <div style={COLONNE}>
      <div style={{ display: "flex" }}>
        <Etiquette couleur={couleur.accentCreme}>VUE D’ENSEMBLE · MOYENNE DES 6 MESURES</Etiquette>
      </div>
      <div style={{ display: "flex", height: GEO.scoreEnsemble, marginTop: 18, alignItems: "center" }}>
        <Score note={slide.moyenne} verdict={slide.verdict} />
      </div>
      <div style={{ display: "flex", marginTop: 10 }}>
        <Lignes b={mise.titre} couleur={MARQUE.encre} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", marginTop: 26 }}>
        {slide.mesures.map((m, i) => {
          const picto = m.picto ? dataUriPicto(m.picto, { taille: 3, couleur: couleur.accentCreme, etincelles: false }) : null;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", height: GEO.ligneEnsemble, marginTop: i ? GEO.ecartEnsemble : 0, padding: "0 22px", borderRadius: 12, backgroundColor: MARQUE.carte }}>
              <div style={{ display: "flex", width: 64, justifyContent: "center" }}>{picto ? <img src={picto.src} alt="" width={picto.largeur} height={picto.hauteur} style={{ width: picto.largeur, height: picto.hauteur }} /> : null}</div>
              <div style={{ display: "flex", flexDirection: "column", marginLeft: 18, width: 600 }}>
                <div style={{ display: "flex", fontFamily: FAMILLES.titre, fontWeight: GRAISSES.gras, fontSize: 30, color: MARQUE.encre }}>{`${m.rang}. ${m.themeNom}`}</div>
                <div style={{ display: "flex", marginTop: 10 }}>
                  <Jauge note={m.note} largeur={580} couleur={m.verdict.couleur} />
                </div>
              </div>
              <div style={{ display: "flex", marginLeft: "auto", fontFamily: FAMILLES.mono, fontSize: 32, color: MARQUE.encre }}>{`${String(m.note).replace(".", ",")}/100`}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CarteTexte({ titre, ok, b, hauteur, grain, marge }) {
  return (
    <Carte largeur={LARGEUR_UTILE} hauteur={hauteur} grain={grain} marge={marge}>
      <div style={{ display: "flex", alignItems: "center", height: GEO.enteteCarte }}>
        <svg width="30" height="30" viewBox="0 0 34 34">
          <circle cx="17" cy="17" r="16" fill={ok ? legendeVerdicts()[0].couleur : legendeVerdicts().at(-1).couleur} />
          {ok ? <path d="M9 17 L15 23 L25 11" stroke={MARQUE.blanc} strokeWidth="4" fill="none" /> : <path d="M11 11 L23 23 M23 11 L11 23" stroke={MARQUE.blanc} strokeWidth="4" fill="none" />}
        </svg>
        <div style={{ display: "flex", marginLeft: 12, fontFamily: FAMILLES.titre, fontWeight: GRAISSES.gras, fontSize: 30, color: MARQUE.encre }}>{titre}</div>
      </div>
      <div style={{ display: "flex", marginTop: 6 }}>
        <Lignes b={b} />
      </div>
    </Carte>
  );
}

function Mesure({ slide, mise, couleur, images }) {
  const picto = slide.picto ? dataUriPicto(slide.picto, { taille: 3, couleur: couleur.accentCreme, etincelles: false }) : null;
  return (
    <div style={COLONNE}>
      <div style={{ display: "flex", alignItems: "center", height: GEO.enteteMesure }}>
        <Etiquette couleur={MARQUE.blanc} fond={couleur.accentCreme} bordure={couleur.accentCreme}>{`MESURE ${slide.rang}/${slide.total6}`}</Etiquette>
        {picto ? <img src={picto.src} alt="" width={picto.largeur} height={picto.hauteur} style={{ width: picto.largeur, height: picto.hauteur, marginLeft: 18 }} /> : null}
        <div style={{ display: "flex", marginLeft: 14, fontFamily: FAMILLES.mono, fontSize: 26, color: MARQUE.gris }}>{slide.themeNom.toUpperCase()}</div>
      </div>
      <div style={{ display: "flex", marginTop: 18 }}>
        <Lignes b={mise.titre} couleur={MARQUE.encre} />
      </div>
      <div style={{ display: "flex", height: 34, marginTop: 20, alignItems: "center", fontFamily: FAMILLES.mono, fontSize: 24, color: couleur.accentCreme }}>LA PROPOSITION</div>
      <div style={{ display: "flex", marginTop: 6 }}>
        <Lignes b={mise.proposition} />
      </div>
      <Carte largeur={LARGEUR_UTILE} hauteur={GEO.carteNote} grain={images.grain} marge={22} padding="18px 30px">
        <Score note={slide.note} verdict={slide.verdict} taille={84} />
        <div style={{ display: "flex", marginTop: 16 }}>
          <Jauge note={slide.note} largeur={LARGEUR_UTILE - 60} hauteur={16} couleur={slide.verdict.couleur} />
        </div>
      </Carte>
      <CarteTexte titre="Ce qui tient" ok b={mise.tient} hauteur={mise.hTient} grain={images.grain} marge={18} />
      <CarteTexte titre="Ce qui coince" ok={false} b={mise.coince} hauteur={mise.hCoince} grain={images.grain} marge={14} />
      {mise.source ? (
        <div style={{ display: "flex", marginTop: 14 }}>
          <Lignes b={mise.source} couleur={MARQUE.gris} />
        </div>
      ) : null}
    </div>
  );
}

function AvisProgramme({ slide, mise, couleur, images }) {
  const carte = (libelle, m, b, hauteur, marge) => (
    <Carte largeur={LARGEUR_UTILE} hauteur={hauteur} grain={images.grain} marge={marge} bordGauche={m.verdict.couleur}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 44 }}>
        <div style={{ display: "flex", fontFamily: FAMILLES.mono, fontSize: 24, color: MARQUE.gris }}>{libelle}</div>
        <PastilleVerdict verdict={m.verdict} taille={22} />
      </div>
      <div style={{ display: "flex", alignItems: "center", height: 44, marginTop: 8 }}>
        <div style={{ display: "flex", fontFamily: FAMILLES.titre, fontWeight: GRAISSES.gras, fontSize: 34, color: MARQUE.encre }}>{m.themeNom}</div>
        <div style={{ display: "flex", marginLeft: 16, fontFamily: FAMILLES.mono, fontSize: 30, color: m.verdict.couleur }}>{`${String(m.note).replace(".", ",")}/100`}</div>
      </div>
      <div style={{ display: "flex", marginTop: 6 }}>
        <Lignes b={b} />
      </div>
    </Carte>
  );
  return (
    <div style={COLONNE}>
      <Lignes b={mise.avis} couleur={MARQUE.encre} />
      {carte("LA PLUS SOLIDE", slide.solide, mise.solide, mise.hSolide, 28)}
      {carte("LA PLUS FRAGILE", slide.fragile, mise.fragile, mise.hFragile, 16)}
      <div style={{ display: "flex", flexDirection: "column", marginTop: 26 }}>
        <div style={{ display: "flex", height: 40, alignItems: "center", fontFamily: FAMILLES.mono, fontSize: 24, color: MARQUE.gris }}>LÉGENDE DES VERDICTS</div>
        <div style={{ display: "flex", flexWrap: "wrap", width: LARGEUR_UTILE }}>
          {legendeVerdicts().map((v) => (
            <div key={v.libelle} style={{ display: "flex", alignItems: "center", width: LARGEUR_UTILE / 2, height: 34, fontFamily: FAMILLES.mono, fontSize: 24, color: MARQUE.texte }}>
              <div style={{ display: "flex", width: 16, height: 16, borderRadius: 8, backgroundColor: v.couleur, marginRight: 12 }} />
              {`${v.libelle.toLowerCase()} · ${v.min} à ${v.max}`}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const PICTO_SLIDE = { ensemble: "chart", fin: "bubble" };

// Élément d'une slide du carrousel « programme ». `images` : grain, portrait
// (data URI de la photo du candidat) ; `couleur` : couleurs du registre.
export function CarrouselProgramme({ slide, mise, couleur, images = {} }) {
  let contenu;
  if (slide.type === "couverture") contenu = <Couverture slide={slide} mise={mise} couleur={couleur} images={images} />;
  else if (slide.type === "fin") {
    const picto = dataUriPicto("bubble", { taille: 6, fondSombre: !couleur.clair, couleur: couleur.accent });
    contenu = <FinCharte slide={slide} mise={mise} couleur={couleur} images={{ ...images, picto }} pied={slide.pied} />;
  } else {
    const Contenu = { ensemble: Ensemble, mesure: Mesure, avisProgramme: AvisProgramme }[slide.type];
    const picto = PICTO_SLIDE[slide.type] ? dataUriPicto(PICTO_SLIDE[slide.type], { taille: 6, couleur: couleur.accentCreme }) : null;
    contenu = (
      <Papier slide={slide} couleur={couleur} images={images} mise={mise} picto={picto}>
        <Contenu slide={slide} mise={mise} couleur={couleur} images={images} />
      </Papier>
    );
  }
  const precharges = slide.type === "couverture" && images.portraitDetoure ? prechargerImages([images.portraitDetoure.image, images.grain]) : null;
  return (
    <div style={{ position: "relative", display: "flex", width: LARGEUR, height: H, overflow: "hidden", fontFamily: FAMILLES.titre }}>
      {precharges}
      {contenu}
    </div>
  );
}

export const STYLES_PROGRAMME = STYLES;
