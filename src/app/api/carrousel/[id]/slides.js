/* eslint-disable @next/next/no-img-element -- next/og (Satori) ne connaît que <img>. */
import GrilleScore from "@/components/og/GrilleScore";
import { appreciationCarte, couperTitre, lignesEstimees } from "@/lib/carte";
import { HAUTEUR_SLIDE, LARGEUR_SLIDE } from "@/lib/carrousel";

// Mise en page des slides 1080 × 1350 du carrousel Instagram (JSX pour
// next/og : flexbox seulement, ni grid ni filter). Les données arrivent
// prêtes depuis route.js (src/lib/carrousel.js). Même style que les cartes X
// (src/app/api/carte/[id]/cartes.js) : fond clair, lueurs bleues, police
// Inter ; accent jaune ; l'orange n'apparaît que comme couleur du palier
// « Partiellement fondé » (appreciationCarte, lue dans src/lib/score.js).
// Corps de texte : 40 px au moins.

const FOND = "#fbfaf8";
const NOIR = "#0d0d10";
const ENCRE = "#1c1d22";
const GRIS = "#8a8c96";
// Jaune de la charte (le même que les Reels).
const JAUNE = "#ffd23f";

const MARGE = 80;
const LARGEUR_UTILE = LARGEUR_SLIDE - 2 * MARGE; // 920 px

// Plus grande taille de la liste pour laquelle le texte tient en `hauteur`
// (estimation de lignesEstimees, src/lib/carte.js), sinon la plus petite.
function taille(texte, tailles, { largeur = LARGEUR_UTILE, hauteur, interligne = 1.2, ratio = 0.5 }) {
  for (const t of tailles) {
    if (lignesEstimees(texte, t, largeur, ratio) * t * interligne <= hauteur) return t;
  }
  return tailles.at(-1);
}

// --- Éléments communs ---------------------------------------------------------

function Lueurs() {
  return (
    <>
      <div style={{ position: "absolute", left: 300, top: -220, width: 600, height: 520, borderRadius: "50%", backgroundImage: "radial-gradient(circle at center, rgba(180,160,255,.25) 0%, rgba(180,160,255,0) 70%)" }} />
      <div style={{ position: "absolute", left: 480, top: 220, width: 860, height: 1100, borderRadius: "50%", backgroundImage: "radial-gradient(circle at center, rgba(92,130,240,.45) 0%, rgba(92,130,240,0) 70%)" }} />
      <div style={{ position: "absolute", left: -260, top: 980, width: 760, height: 620, borderRadius: "50%", backgroundImage: "radial-gradient(circle at center, rgba(255,210,63,.32) 0%, rgba(255,210,63,0) 70%)" }} />
    </>
  );
}

function Logo() {
  return (
    <div style={{ position: "absolute", left: MARGE, top: 62, display: "flex", alignItems: "center", fontWeight: 500, fontSize: 24, letterSpacing: 7, color: ENCRE }}>
      <div style={{ width: 4, height: 36, backgroundColor: ENCRE, transform: "skewX(-22deg)", marginRight: 18 }} />
      PERLIMPINPIN
    </div>
  );
}

// Sur une pastille claire : reste lisible sur le portrait de la couverture.
function Pagination({ numero, total }) {
  return (
    <div style={{ position: "absolute", right: MARGE - 14, bottom: 52, display: "flex", padding: "4px 14px", borderRadius: 999, backgroundColor: "rgba(251,250,248,.85)", fontWeight: 500, fontSize: 30, color: GRIS }}>
      {numero}/{total}
    </div>
  );
}

// Nom du candidat, discret, en bas à gauche (slides 2 à 6).
function Signature({ candidatNom }) {
  return (
    <div style={{ position: "absolute", left: MARGE, bottom: 58, display: "flex", fontWeight: 500, fontSize: 30, color: GRIS }}>
      {candidatNom}
    </div>
  );
}

function Slide({ slide, candidatNom, children }) {
  return (
    <div style={{ position: "relative", display: "flex", width: LARGEUR_SLIDE, height: HAUTEUR_SLIDE, backgroundColor: FOND, overflow: "hidden", fontFamily: "Inter" }}>
      <Lueurs />
      <Logo />
      {children}
      {slide.type !== "couverture" ? <Signature candidatNom={candidatNom} /> : null}
      <Pagination numero={slide.numero} total={slide.total} />
    </div>
  );
}

// Zone de contenu, sous le logo et au-dessus du pied.
// Largeur et hauteur explicites : dans un fragment, Satori ne déduit pas la
// largeur d'un bloc absolu de left + right.
function Zone({ children, centre = true, haut = 170, bas = 150 }) {
  return (
    <div style={{ position: "absolute", left: MARGE, top: haut, width: LARGEUR_UTILE, height: HAUTEUR_SLIDE - haut - bas, display: "flex", flexDirection: "column", justifyContent: centre ? "center" : "flex-start" }}>
      {children}
    </div>
  );
}

// Petit trait jaune et intitulé de la slide.
function Intitule({ children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", marginBottom: 36 }}>
      <div style={{ width: 64, height: 10, borderRadius: 5, backgroundColor: JAUNE, marginBottom: 20 }} />
      <div style={{ display: "flex", fontWeight: 800, fontSize: 30, letterSpacing: 5, color: GRIS }}>{children}</div>
    </div>
  );
}

function Pictogramme({ ok }) {
  const couleur = ok ? "#1f9d55" : "#d92d20";
  return (
    <svg width="52" height="52" viewBox="0 0 44 44">
      <circle cx="22" cy="22" r="22" fill={couleur} />
      {ok ? (
        <path d="M12 23 L19 30 L32 15" stroke="white" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M14 14 L30 30 M30 14 L14 30" stroke="white" strokeWidth="5" fill="none" strokeLinecap="round" />
      )}
    </svg>
  );
}

// --- Les slides -------------------------------------------------------------------

// 1. Couverture : titre en très gros, portrait bleu (sinon le nom en grand),
// « La mesure de … passée au crible », « Glissez → ».
function Couverture({ slide, candidatNom, photo }) {
  const { noir, gris } = couperTitre(slide.titre);
  const tailleTitre = taille(slide.titre, [132, 120, 108, 96, 86, 76, 68, 60], { hauteur: photo ? 400 : 470, interligne: 1, ratio: 0.47 });
  const mots = [
    ...noir.split(" ").filter(Boolean).map((mot) => ({ mot, couleur: NOIR })),
    ...gris.split(" ").filter(Boolean).map((mot) => ({ mot, couleur: GRIS })),
  ];
  return (
    <>
      {photo ? (
        <img src={photo} alt="" width={640} height={800} style={{ position: "absolute", left: 470, top: 580, objectFit: "contain" }} />
      ) : null}
      {/* Titre puis sous-titre (et, sans portrait, le nom en grand), l'un sous l'autre. */}
      <div style={{ position: "absolute", left: MARGE, top: 160, width: LARGEUR_UTILE, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", flexWrap: "wrap", width: LARGEUR_UTILE, fontWeight: 800, fontSize: tailleTitre, lineHeight: 1, letterSpacing: -tailleTitre * 0.04 }}>
          {mots.map(({ mot, couleur }, index) => (
            <span key={index} style={{ color: couleur, marginRight: tailleTitre * 0.22 }}>
              {mot}
            </span>
          ))}
        </div>
        <div style={{ width: 56, height: 4, backgroundColor: GRIS, marginTop: 48, marginBottom: 28 }} />
        <div style={{ display: "flex", width: photo ? 400 : LARGEUR_UTILE, fontWeight: 500, fontSize: 44, lineHeight: 1.2, letterSpacing: -0.5, color: ENCRE }}>{slide.sousTitre}</div>
        {photo ? null : (
          <div style={{ display: "flex", width: LARGEUR_UTILE, marginTop: 70, fontWeight: 800, fontSize: taille(candidatNom, [130, 110, 96, 84], { hauteur: 280, interligne: 1, ratio: 0.55 }), lineHeight: 1, letterSpacing: -4, color: "#3d5bd9" }}>
            {candidatNom}
          </div>
        )}
      </div>
      <div style={{ position: "absolute", left: MARGE, bottom: 64, display: "flex", padding: "14px 32px", borderRadius: 999, backgroundColor: JAUNE, color: NOIR, fontWeight: 800, fontSize: 40 }}>
        Glissez →
      </div>
    </>
  );
}

// 2. La mesure en clair.
function Mesure({ slide }) {
  const t = taille(slide.texte, [68, 62, 56, 50, 46, 42, 40], { hauteur: 760, interligne: 1.22 });
  return (
    <Zone>
      <Intitule>LA MESURE</Intitule>
      <div style={{ display: "flex", fontWeight: 500, fontSize: t, lineHeight: 1.22, letterSpacing: -0.5, color: NOIR }}>{slide.texte}</div>
    </Zone>
  );
}

// 3. La note : score dans la couleur du palier, badge, grille de 100 carrés.
function Note({ slide }) {
  const teinte = appreciationCarte(slide.score);
  return (
    <Zone haut={150}>
      <Intitule>NOTE PERLIMPINPIN</Intitule>
      <div style={{ display: "flex", alignItems: "baseline" }}>
        <div style={{ display: "flex", fontWeight: 800, fontSize: 230, lineHeight: 1, letterSpacing: -9, color: teinte.score }}>{slide.scoreAffiche}</div>
        <div style={{ display: "flex", fontWeight: 500, fontSize: 84, color: GRIS, marginLeft: 12 }}>/100</div>
      </div>
      <div style={{ display: "flex", marginTop: 26, marginBottom: 44 }}>
        <div style={{ display: "flex", padding: "12px 30px", borderRadius: 999, backgroundColor: teinte.pastilleFond, color: teinte.pastilleTexte, fontWeight: 800, fontSize: 44 }}>
          {slide.palier}
        </div>
      </div>
      <GrilleScore score={slide.score} couleur={teinte.score} taille={52} ecart={8} />
    </Zone>
  );
}

// 4. Le chiffre : grand nombre souligné de jaune, explication.
function Chiffre({ slide }) {
  const longueur = Math.max(1, Array.from(slide.valeur).length);
  const tailleValeur = Math.min(260, Math.floor(LARGEUR_UTILE / (longueur * 0.6)));
  const t = taille(slide.explication, [58, 52, 48, 44, 40], { hauteur: 420 });
  return (
    <Zone>
      <Intitule>LE CHIFFRE</Intitule>
      <div style={{ display: "flex" }}>
        <div style={{ position: "relative", display: "flex" }}>
          <div style={{ position: "absolute", left: -8, right: -8, bottom: tailleValeur * 0.06, height: tailleValeur * 0.32, backgroundColor: JAUNE, borderRadius: 8 }} />
          <div style={{ display: "flex", fontWeight: 800, fontSize: tailleValeur, lineHeight: 1, letterSpacing: -tailleValeur * 0.03, color: NOIR, whiteSpace: "nowrap" }}>
            {slide.valeur}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", marginTop: 48, fontWeight: 500, fontSize: t, lineHeight: 1.22, letterSpacing: -0.5, color: ENCRE }}>{slide.explication}</div>
    </Zone>
  );
}

function Bloc({ ok, titre, points, tailleTexte }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", width: LARGEUR_UTILE, padding: "30px 36px", borderRadius: 24, backgroundColor: "rgba(255,255,255,.82)", border: "1px solid rgba(0,0,0,.06)", boxShadow: "0 10px 30px rgba(40,50,90,.08)" }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        <Pictogramme ok={ok} />
        <div style={{ marginLeft: 18, fontWeight: 800, fontSize: 42, letterSpacing: -0.5, color: NOIR }}>{titre}</div>
      </div>
      {points.map((point, index) => (
        <div key={index} style={{ display: "flex", marginTop: 20, fontWeight: 500, fontSize: tailleTexte, lineHeight: 1.22, color: ENCRE }}>
          {point}
        </div>
      ))}
    </div>
  );
}

// 5. Tient / tient pas : deux blocs empilés.
function Tient({ slide }) {
  const tous = [...slide.tient, ...slide.tientPas].join(" ");
  const t = taille(tous, [46, 44, 42, 40], { largeur: LARGEUR_UTILE - 72, hauteur: 560 });
  return (
    <Zone>
      <Intitule>TIENT / TIENT PAS</Intitule>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <Bloc ok titre="Ce qui tient" points={slide.tient} tailleTexte={t} />
        <div style={{ height: 32 }} />
        <Bloc ok={false} titre="Ce qui ne tient pas" points={slide.tientPas} tailleTexte={t} />
      </div>
    </Zone>
  );
}

function TitreJaune({ children, tailleTexte = 64 }) {
  return (
    <div style={{ display: "flex" }}>
      <div style={{ display: "flex", padding: "10px 26px", borderRadius: 16, backgroundColor: JAUNE, color: NOIR, fontWeight: 800, fontSize: tailleTexte, letterSpacing: -1.5, lineHeight: 1.1 }}>
        {children}
      </div>
    </div>
  );
}

// 6. Ce qui la ferait tenir : titre jaune, 3 conditions, appel en bas.
function Conditions({ slide }) {
  const t = taille(slide.conditions.join(" "), [52, 48, 44, 42, 40], { largeur: LARGEUR_UTILE - 90, hauteur: 560 });
  return (
    <>
      <Zone haut={170} bas={330}>
        <TitreJaune>Ce qui la ferait tenir</TitreJaune>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 40 }}>
          {slide.conditions.map((condition, index) => (
            <div key={index} style={{ display: "flex", alignItems: "flex-start", marginTop: index ? 30 : 0 }}>
              <div style={{ display: "flex", flexShrink: 0, width: 62, height: 62, borderRadius: 31, backgroundColor: JAUNE, color: NOIR, fontWeight: 800, fontSize: 36, alignItems: "center", justifyContent: "center", marginRight: 28 }}>
                {index + 1}
              </div>
              <div style={{ display: "flex", width: LARGEUR_UTILE - 90, fontWeight: 500, fontSize: t, lineHeight: 1.2, color: ENCRE }}>{condition}</div>
            </div>
          ))}
        </div>
      </Zone>
      <div style={{ position: "absolute", left: MARGE, width: LARGEUR_UTILE, bottom: 140, display: "flex", flexDirection: "column", paddingTop: 30, borderTop: "3px solid rgba(13,13,16,.12)" }}>
        <div style={{ display: "flex", fontWeight: 800, fontSize: 42, color: NOIR }}>Analyse complète : lien en bio</div>
        <div style={{ display: "flex", marginTop: 12, fontWeight: 500, fontSize: 40, color: ENCRE }}>Et vous, ça tient ? Dites-le en commentaire</div>
      </div>
    </>
  );
}

// 6 bis (anciennes fiches, sans ce_qui_la_ferait_tenir) : appel à l'action seul.
function Appel() {
  return (
    <Zone>
      <div style={{ display: "flex", fontWeight: 800, fontSize: 84, lineHeight: 1.05, letterSpacing: -3, color: NOIR }}>
        Analyse complète, sources et méthode : lien en bio
      </div>
      <div style={{ display: "flex", marginTop: 56 }}>
        <TitreJaune tailleTexte={52}>Rejoignez le Club pour commenter</TitreJaune>
      </div>
    </Zone>
  );
}

const CONTENUS = { couverture: Couverture, mesure: Mesure, note: Note, chiffre: Chiffre, tient: Tient, conditions: Conditions, appel: Appel };

// Élément de la slide demandée (une entrée de controlerCarrousel().slides).
export function elementSlide({ slide, candidatNom, photo }) {
  const Contenu = CONTENUS[slide.type];
  return (
    <Slide slide={slide} candidatNom={candidatNom}>
      <Contenu slide={slide} candidatNom={candidatNom} photo={photo} />
    </Slide>
  );
}
