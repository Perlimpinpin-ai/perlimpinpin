/* eslint-disable @next/next/no-img-element -- next/og (Satori) ne connaît que <img>. */
import { MARQUE, rgba } from "@/lib/charte-rs";
import { dataUriPicto } from "@/lib/pictos-charte";
import { HAUT_ZONE, BAS_ZONE, LARGEUR, LARGEUR_UTILE, MARGE, STYLES } from "@/lib/mise-en-page-carrousel";
import { GEO, positionsMedaillons } from "@/lib/mise-en-page-formats";
import { FinCharte, TitreCouverture } from "./CarrouselMesure";
import { BandeBillet, Carte, couleursBande, EnTete, Etiquette, FAMILLES, Fond, GRAIN, GRAISSES, H, Jauge, Lignes, PastilleVerdict, Picto, Pied, PixelsLegers, Portrait } from "./Primitives";

// Carrousel « thématique » (« [Thème] : ce que proposent les candidats »,
// 4 à 8 candidats, charte RS page 16) : SEULE LA PARTIE DONNÉES SE REMPLIT.
// Données : slides assemblées par src/lib/carrousel-formats.js
// (assemblerThematique : ordre alphabétique, notes et verdicts du code),
// lignes mesurées par src/lib/mise-en-page-formats.js.
//  1. couverture dans la couleur du THÈME, picto, médaillons ronds des
//     candidats dans leur couleur, liseré jaune, nom en chasse fixe ;
//  2. le constat ; 3 à N. une slide par candidat, ORDRE ALPHABÉTIQUE
//     (bandeau à sa couleur, portrait liseré jaune) ; comparatif (seule slide
//     classée par note) ; fin au pluriel.

const COLONNE = { display: "flex", flexDirection: "column", width: LARGEUR_UTILE };

function Couverture({ slide, mise, couleur, images }) {
  const picto = slide.picto ? dataUriPicto(slide.picto, { taille: 7, fondSombre: true, couleur: couleur.accent }) : null;
  const positions = positionsMedaillons(slide.medaillons.length);
  return (
    <>
      <Fond couleur={couleur.fond} grain={images.grain} opacite={GRAIN.couleur} />
      <PixelsLegers graine={slide.numero * 11} centre={{ x: 540, y: 900 }} couleurs={[MARQUE.blanc, MARQUE.jaune, couleur.accent]} nombre={90} />
      <EnTete numero={slide.numero} total={slide.total} couleur={couleur.texte} marge={84} haut={70} />
      <div style={{ position: "absolute", left: 84, top: GEO.couvTitreHaut, display: "flex", flexDirection: "column", width: LARGEUR - 168 }}>
        <TitreCouverture b={mise.titre} couleur={couleur} />
        <div style={{ display: "flex", marginTop: 30, marginLeft: 10 }}>
          <Lignes b={mise.sousTitre} couleur={rgba(couleur.texte, 0.9)} />
        </div>
      </div>
      {picto ? <Picto picto={picto} x={LARGEUR - 84 - picto.largeur} y={GEO.couvTitreHaut + mise.titre.hauteur + 20} /> : null}
      {slide.medaillons.map((m, i) => {
        const p = positions[i];
        return (
          <div key={m.nom} style={{ position: "absolute", left: p.x - 20, top: p.y, width: p.d + 40, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <Portrait src={images.portraits?.[m.nom]} x={20} y={0} largeur={p.d} hauteur={p.d} rond fond={m.couleur.fond} epaisseur={8} />
            <div style={{ display: "flex", marginTop: p.d + 12, fontFamily: FAMILLES.mono, fontSize: 24, color: couleur.texte, whiteSpace: "nowrap" }}>{m.famille.toUpperCase()}</div>
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

function Papier({ slide, couleur, images, children, mise, picto, haut = HAUT_ZONE, bandeCouleur = couleur }) {
  return (
    <>
      <Fond couleur={MARQUE.creme} grain={images.grain} opacite={GRAIN.creme} />
      <div style={{ position: "absolute", left: MARGE, top: haut, width: LARGEUR_UTILE, height: BAS_ZONE - haut, display: "flex", flexDirection: "column" }}>{children}</div>
      {mise.picto && picto ? <Picto picto={picto} x={MARGE + LARGEUR_UTILE - picto.largeur} y={BAS_ZONE - picto.hauteur} /> : null}
      <Pied texte={slide.pied} numero={slide.numero} total={slide.total} couleur={MARQUE.gris} />
      <BandeBillet graine={slide.numero} couleurs={couleursBande(bandeCouleur)} />
    </>
  );
}

function Constat({ slide, mise, couleur, images }) {
  return (
    <div style={COLONNE}>
      <div style={{ display: "flex" }}>
        <Etiquette couleur={couleur.accentCreme}>LE CONSTAT</Etiquette>
      </div>
      <div style={{ display: "flex", marginTop: 22 }}>
        <Lignes b={mise.titre} couleur={MARQUE.encre} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", width: LARGEUR_UTILE, marginTop: 30 }}>
        {mise.tuiles.map((t, i) => (
          <Carte key={i} largeur={mise.largeurTuile} hauteur={mise.hTuile} grain={images.grain} padding="24px 20px" fond={i === 0 ? MARQUE.jaune : MARQUE.carte}>
            <div style={{ display: "flex", fontFamily: FAMILLES.titre, fontWeight: GRAISSES.gras, fontSize: STYLES.valeur.taille, letterSpacing: STYLES.valeur.espacement, color: i === 0 ? MARQUE.encre : couleur.accentCreme, whiteSpace: "nowrap" }}>{t.valeur}</div>
            <div style={{ display: "flex", marginTop: 8 }}>
              <Lignes b={t.detail} couleur={i === 0 ? MARQUE.encre : MARQUE.gris} />
            </div>
          </Carte>
        ))}
      </div>
      {mise.source ? (
        <div style={{ display: "flex", marginTop: 18 }}>
          <Lignes b={mise.source} couleur={MARQUE.gris} />
        </div>
      ) : null}
    </div>
  );
}

// Bandeau à la couleur du candidat, portrait liseré jaune, nom.
function Bandeau({ slide, images }) {
  const c = slide.couleur;
  return (
    <>
      <div style={{ position: "absolute", left: 0, top: 0, width: LARGEUR, height: GEO.bandeau, display: "flex", backgroundColor: c.fond, overflow: "hidden" }}>
        {images.grain ? <img src={images.grain} alt="" width={LARGEUR} height={H} style={{ position: "absolute", left: 0, top: 0, width: LARGEUR, height: H, opacity: GRAIN.couleur }} /> : null}
      </div>
      <EnTete numero={slide.numero} total={slide.total} couleur={c.texte} />
      <Portrait src={images.portraits?.[slide.nom]} x={MARGE} y={124} largeur={180} hauteur={222} fond={c.accent} epaisseur={8} />
      <div style={{ position: "absolute", left: MARGE + 210, top: 150, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", fontFamily: FAMILLES.mono, fontSize: 24, color: rgba(c.texte, 0.85) }}>SA PROPOSITION SUR LE THÈME</div>
        <div style={{ display: "flex", marginTop: 6, fontFamily: FAMILLES.couverture, fontWeight: GRAISSES.couverture, fontSize: 72, letterSpacing: -2.5, color: c.texte, whiteSpace: "nowrap" }}>{slide.nom}</div>
      </div>
    </>
  );
}

function Candidat({ slide, mise, images }) {
  const c = slide.couleur;
  if (slide.sansProposition) {
    return (
      <div style={COLONNE}>
        <div style={{ display: "flex", marginTop: 160 }}>
          <Lignes b={mise.message} couleur={MARQUE.gris} />
        </div>
        <div style={{ display: "flex", marginTop: 30, fontFamily: FAMILLES.mono, fontSize: 24, color: MARQUE.gris }}>PAS DE FICHE, PAS DE NOTE</div>
      </div>
    );
  }
  const label = (t) => <div style={{ display: "flex", height: 34, alignItems: "center", fontFamily: FAMILLES.mono, fontSize: 24, color: c.accentCreme }}>{t}</div>;
  return (
    <div style={COLONNE}>
      <Lignes b={mise.titre} couleur={MARQUE.encre} />
      <div style={{ display: "flex", marginTop: 22 }}>{label("SA PROPOSITION")}</div>
      <div style={{ display: "flex", marginTop: 6 }}>
        <Lignes b={mise.proposition} />
      </div>
      <div style={{ display: "flex", marginTop: 20 }}>{label("NOTRE REGARD")}</div>
      <div style={{ display: "flex", marginTop: 6 }}>
        <Lignes b={mise.regard} couleur={MARQUE.encre} />
      </div>
      <Carte largeur={LARGEUR_UTILE} hauteur={slide.cout ? 196 : 152} grain={images.grain} marge={24} padding="18px 30px" bordGauche={slide.verdict.couleur}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 70 }}>
          <div style={{ display: "flex", alignItems: "baseline" }}>
            <div style={{ display: "flex", fontFamily: FAMILLES.mono, fontSize: 28, color: MARQUE.gris, marginRight: 20 }}>FAISABLE ?</div>
            <div style={{ display: "flex", fontFamily: FAMILLES.couverture, fontWeight: GRAISSES.couverture, fontSize: 64, letterSpacing: -2, color: slide.verdict.couleur }}>{String(slide.note).replace(".", ",")}</div>
            <div style={{ display: "flex", fontFamily: FAMILLES.titre, fontSize: 28, color: MARQUE.gris, marginLeft: 6 }}>/100</div>
          </div>
          <PastilleVerdict verdict={slide.verdict} taille={24} />
        </div>
        <div style={{ display: "flex", marginTop: 12 }}>
          <Jauge note={slide.note} largeur={LARGEUR_UTILE - 68} couleur={slide.verdict.couleur} />
        </div>
        {slide.cout ? <div style={{ display: "flex", marginTop: 16, fontFamily: FAMILLES.mono, fontSize: 24, color: MARQUE.texte }}>{`COÛT ESTIMÉ · ${slide.cout}`}</div> : null}
      </Carte>
    </div>
  );
}

function Comparatif({ slide, mise }) {
  return (
    <div style={COLONNE}>
      <Lignes b={mise.avis} couleur={MARQUE.encre} />
      <div style={{ display: "flex", height: 40, marginTop: 30, alignItems: "center", fontFamily: FAMILLES.mono, fontSize: 24, color: MARQUE.gris }}>LE CLASSEMENT, PAR NOTE</div>
      {slide.classement.map((c, i) => (
        <div key={c.nom} style={{ display: "flex", alignItems: "center", height: 84, marginTop: i ? 10 : 18, padding: "0 22px", borderRadius: 12, backgroundColor: MARQUE.carte }}>
          <div style={{ display: "flex", width: 44, fontFamily: FAMILLES.mono, fontSize: 30, color: MARQUE.gris }}>{i + 1}</div>
          <div style={{ display: "flex", width: 22, height: 22, borderRadius: 11, backgroundColor: c.couleur.fond, border: `3px solid ${MARQUE.jaune}`, marginRight: 16 }} />
          <div style={{ display: "flex", width: 330, fontFamily: FAMILLES.titre, fontWeight: GRAISSES.gras, fontSize: 30, color: MARQUE.encre, whiteSpace: "nowrap" }}>{c.nom}</div>
          <Jauge note={c.note} largeur={330} couleur={c.verdict.couleur} />
          <div style={{ display: "flex", marginLeft: "auto", fontFamily: FAMILLES.mono, fontSize: 30, color: MARQUE.encre }}>{`${String(c.note).replace(".", ",")}/100`}</div>
        </div>
      ))}
    </div>
  );
}

// Élément d'une slide du carrousel thématique. `couleur` : couleurs du THÈME
// (couverture, fin, accents) ; chaque slide candidat porte sa couleur du
// registre. `images` : grain, portraits ({ nom: data URI }).
export function CarrouselThematique({ slide, mise, couleur, images = {} }) {
  let contenu;
  if (slide.type === "couverture") contenu = <Couverture slide={slide} mise={mise} couleur={couleur} images={images} />;
  else if (slide.type === "fin") {
    const picto = dataUriPicto("bubble", { taille: 6, fondSombre: true, couleur: couleur.accent });
    contenu = <FinCharte slide={slide} mise={mise} couleur={couleur} images={{ ...images, picto }} pied={slide.pied} />;
  } else if (slide.type === "candidat") {
    contenu = (
      <>
        <Papier slide={slide} couleur={couleur} images={images} mise={mise} haut={GEO.bandeau + 36} bandeCouleur={slide.couleur}>
          <Candidat slide={slide} mise={mise} images={images} />
        </Papier>
        <Bandeau slide={slide} images={images} />
      </>
    );
  } else {
    const Contenu = { constatTheme: Constat, comparatif: Comparatif }[slide.type];
    const picto = slide.type === "constatTheme" ? dataUriPicto("chart", { taille: 6, couleur: couleur.accentCreme }) : null;
    contenu = (
      <>
        <Papier slide={slide} couleur={couleur} images={images} mise={mise} picto={picto}>
          <Contenu slide={slide} mise={mise} couleur={couleur} images={images} />
        </Papier>
        <EnTete numero={slide.numero} total={slide.total} couleur={MARQUE.encre} />
      </>
    );
  }
  return <div style={{ position: "relative", display: "flex", width: LARGEUR, height: H, overflow: "hidden", fontFamily: FAMILLES.titre }}>{contenu}</div>;
}
