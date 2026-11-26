/* eslint-disable @next/next/no-img-element -- next/og (Satori) ne connaît que <img>. */
import { MARQUE, POLICES, SLIDE, melange, rgba } from "@/lib/charte-rs";

// Éléments communs des carrousels de la charte RS (docs/charte-rs.md), en JSX
// pour next/og (flexbox seulement, ni grid ni filtre CSS). Toutes les
// couleurs, polices et tailles viennent de src/lib/charte-rs.js : aucun code
// hexadécimal ici (scripts/charte-rs.test.js).

export const L = SLIDE.largeur;
export const H = SLIDE.hauteur;
export const FAMILLES = {
  couverture: POLICES.couverture.famille,
  titre: POLICES.titre.famille,
  serif: POLICES.serif.famille,
  mono: POLICES.mono.famille,
};
export const GRAISSES = { couverture: POLICES.couverture.graisse, titre: POLICES.titre.graisse, gras: POLICES.gras.graisse };

const famillePolice = (police) => (police === "mono" ? FAMILLES.mono : police === "serif" ? FAMILLES.serif : FAMILLES.titre);
const graissePolice = (police) => (police === "couverture" ? GRAISSES.couverture : police === "texte800" ? GRAISSES.gras : police === "serif" ? POLICES.serif.graisse : police === "mono" ? POLICES.mono.graisse : GRAISSES.titre);

// Générateur pseudo-aléatoire reproductible (mulberry32) : même graine,
// même motif ; la graine vient du numéro de slide.
export function hasard(graine) {
  let a = (Number(graine) * 2654435761) >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Lignes d'un bloc mesuré (src/lib/mise-en-page-carrousel.js, bloc), telles
// que mesurées : ce qui est mesuré est ce qui est dessiné.
export function Lignes({ b, couleur = MARQUE.texte, couleurGras = null }) {
  const { style } = b;
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {b.lignes.map((ligne, i) => (
        <div key={i} style={{ display: "flex", height: style.taille * style.interligne, alignItems: "center", fontFamily: famillePolice(style.police), fontSize: style.taille, letterSpacing: style.espacement, color: couleur, whiteSpace: "nowrap" }}>
          {ligne.mots.map((mot, j) => (
            <div key={j} style={{ display: "flex", marginRight: j < ligne.mots.length - 1 ? b.espace : 0 }}>
              {mot.segments.map((seg, k) => (
                <span key={k} style={{ fontWeight: seg.gras ? GRAISSES.gras : graissePolice(style.police), color: seg.gras && couleurGras ? couleurGras : couleur }}>
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

// Étiquette en chasse fixe (JetBrains Mono), sans ombre.
export function Etiquette({ children, couleur, fond = "transparent", bordure, taille = 24, hauteur = 40 }) {
  return (
    <div style={{ display: "flex", alignItems: "center", height: hauteur, fontFamily: FAMILLES.mono, fontSize: taille, letterSpacing: 1, color: couleur, backgroundColor: fond, border: `2px solid ${bordure ?? couleur}`, borderRadius: 6, padding: "0 12px", whiteSpace: "nowrap" }}>
      {children}
    </div>
  );
}

// Pastille du verdict : point de la couleur du verdict, libellé en chasse fixe.
export function PastilleVerdict({ verdict, taille = 26, surFonce = false }) {
  return (
    <div style={{ display: "flex", alignItems: "center", height: taille + 18, padding: "0 14px", borderRadius: 6, backgroundColor: surFonce ? rgba(MARQUE.blanc, 0.92) : rgba(verdict.couleur, 0.14), border: `2px solid ${verdict.couleur}`, fontFamily: FAMILLES.mono, fontSize: taille, color: MARQUE.encre, whiteSpace: "nowrap" }}>
      <div style={{ display: "flex", width: taille * 0.5, height: taille * 0.5, borderRadius: taille, backgroundColor: verdict.couleur, marginRight: 10 }} />
      {verdict.libelle.toLowerCase()}
    </div>
  );
}

// Fond plein + grain (obligatoire, charte page 10) : plus marqué sur la
// couleur (couverture, fin), léger sur le papier crème et les cartes.
export const GRAIN = { couleur: 0.6, creme: 0.42, carte: 0.3 };
export function Fond({ couleur, grain, opacite }) {
  return (
    <>
      <div style={{ position: "absolute", left: 0, top: 0, width: L, height: H, backgroundColor: couleur, display: "flex" }} />
      {grain ? <img src={grain} alt="" width={L} height={H} style={{ position: "absolute", left: 0, top: 0, width: L, height: H, opacity: opacite }} /> : null}
    </>
  );
}

// Carte granuleuse, sans bordure ni ombre forte.
export function Carte({ children, largeur, hauteur, grain, marge = 0, padding = "22px 30px", fond = MARQUE.carte, bordGauche = null, style = {} }) {
  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", width: largeur, height: hauteur, marginTop: marge, padding, borderRadius: 14, backgroundColor: fond, overflow: "hidden", ...(bordGauche ? { borderLeft: `8px solid ${bordGauche}` } : {}), ...style }}>
      {grain ? <img src={grain} alt="" width={L} height={H} style={{ position: "absolute", left: 0, top: 0, width: L, height: H, opacity: GRAIN.carte }} /> : null}
      {children}
    </div>
  );
}

// Logo « / PERLIMPINPIN » en haut à gauche, barre de progression en haut à droite.
export function EnTete({ numero, total, couleur, marge = 72, haut = 64 }) {
  const largeur = total * 26 + (total - 1) * 8;
  return (
    <>
      <div style={{ position: "absolute", left: marge, top: haut, display: "flex", fontFamily: FAMILLES.mono, fontWeight: POLICES.mono.graisse, fontSize: 24, letterSpacing: 3, color: couleur }}>
        <span style={{ color: couleur }}>/</span>
        <span style={{ marginLeft: 10 }}>PERLIMPINPIN</span>
      </div>
      <div style={{ position: "absolute", left: L - marge - largeur, top: haut + 12, width: largeur, height: 5, display: "flex" }}>
        {Array.from({ length: total }, (_, i) => (
          <div key={i} style={{ width: 26, height: i < numero ? 5 : 3, marginLeft: i ? 8 : 0, marginTop: i < numero ? 0 : 1, borderRadius: 2, backgroundColor: i < numero ? couleur : rgba(couleur === MARQUE.blanc ? MARQUE.blanc : MARQUE.encre, 0.28) }} />
        ))}
      </div>
    </>
  );
}

// Pied de page : « Candidat · Thème » (ou « Thème · Les candidats ») et numéro de slide.
export function Pied({ texte, numero, total, couleur, marge = 72, haut = 1238 }) {
  return (
    <div style={{ position: "absolute", left: marge, top: haut, width: L - 2 * marge, display: "flex", justifyContent: "space-between", fontFamily: FAMILLES.mono, fontSize: 24, color: couleur }}>
      <span>{texte}</span>
      <span>{`${numero}/${total}`}</span>
    </div>
  );
}

// Bande « billet de banque » (page 10) : bandes obliques remplies de hachures
// fines, traits cassés. Couverture et fin (`couverture`) : hachures blanches
// sur la couleur du candidat (encre sur les fonds clairs) ; ailleurs : couleurs du candidat. Le motif est tiré du numéro de
// slide : jamais le même d'une slide à l'autre.
export function BandeBillet({ graine, hauteur = 56, couleurs, couverture = false }) {
  const alea = hasard(graine);
  const pente = Math.round(hauteur * 0.9);
  const bandes = [];
  let x = -pente - Math.round(alea() * 60);
  let k = 0;
  while (x < L + pente) {
    const w = 70 + Math.round(alea() * 120);
    const teinte = couleurs[Math.floor(alea() * couleurs.length)];
    const fond = couverture ? rgba(teinte, [0.06, 0.12, 0, 0.18][k % 4]) : rgba(teinte, 0.08 + 0.1 * alea());
    const trait = couverture ? rgba(teinte, 0.55 + 0.35 * alea()) : rgba(teinte, 0.55 + 0.4 * alea());
    const pas = 4 + Math.round(alea() * 3);
    const croise = alea() < 0.35;
    let d = "";
    // Hachures obliques parallèles aux bords de la bande, cassées par endroits.
    for (let xi = x + 1; xi < x + w; xi += pas) {
      let y = 0;
      while (y < hauteur) {
        const long = 6 + alea() * 22;
        const y2 = Math.min(hauteur, y + long);
        const xa = xi + pente * (1 - y / hauteur);
        const xb = xi + pente * (1 - y2 / hauteur);
        d += `M${xa.toFixed(1)} ${y.toFixed(1)}L${xb.toFixed(1)} ${y2.toFixed(1)}`;
        y = y2 + (alea() < 0.3 ? 2 + alea() * 4 : 0.0001);
      }
    }
    let dCroise = "";
    if (croise) {
      for (let y = 2; y < hauteur; y += pas + 1) {
        const xa = x + pente * (1 - y / hauteur);
        const xb = xa + w;
        let xc = xa;
        while (xc < xb) {
          const xd = Math.min(xb, xc + 10 + alea() * 30);
          dCroise += `M${xc.toFixed(1)} ${y}L${xd.toFixed(1)} ${y}`;
          xc = xd + (alea() < 0.4 ? 3 + alea() * 6 : 0.0001);
        }
      }
    }
    bandes.push({ poly: `M${x + pente} 0L${x + pente + w} 0L${x + w} ${hauteur}L${x} ${hauteur}Z`, fond, trait, d, dCroise });
    x += w;
    k += 1;
  }
  return (
    <svg width={L} height={hauteur} viewBox={`0 0 ${L} ${hauteur}`} style={{ position: "absolute", left: 0, top: H - hauteur }}>
      {bandes.map((b, i) => (
        <g key={i}>
          <path d={b.poly} fill={b.fond} />
          <path d={b.d} stroke={b.trait} strokeWidth="1.1" fill="none" />
          {b.dCroise ? <path d={b.dCroise} stroke={b.trait} strokeWidth="0.9" fill="none" opacity="0.6" /> : null}
        </g>
      ))}
    </svg>
  );
}

// Couleurs de la bande hors couverture : la couleur du candidat, son accent et un mélange.
export function couleursBande(couleur) {
  return [couleur.fond, couleur.accent, melange(couleur.fond, couleur.accent, 0.5), couleur.accentCreme];
}

// Pixels légers (couverture « programme », page 10) : petits carrés très
// transparents, tailles et couleurs variées, plus denses près de la photo.
export function PixelsLegers({ graine, centre, couleurs, nombre = 140 }) {
  const alea = hasard(graine);
  const carres = [];
  for (let i = 0; i < nombre; i++) {
    const angle = alea() * 2 * Math.PI;
    const r = 160 + Math.pow(alea(), 1.8) * 520;
    const x = centre.x + Math.cos(angle) * r * 1.15;
    const y = centre.y + Math.sin(angle) * r * 0.9;
    if (x < 0 || x > L || y < 0 || y > H) continue;
    const t = [6, 8, 10, 12, 16, 20][Math.floor(alea() * 6)];
    carres.push({ x: Math.round(x / 4) * 4, y: Math.round(y / 4) * 4, t, c: couleurs[Math.floor(alea() * couleurs.length)], o: 0.06 + 0.16 * alea() * (1 - (r - 160) / 640) });
  }
  return (
    <svg width={L} height={H} viewBox={`0 0 ${L} ${H}`} style={{ position: "absolute", left: 0, top: 0 }}>
      {carres.map((p, i) => (
        <rect key={i} x={p.x} y={p.y} width={p.t} height={p.t} fill={p.c} opacity={p.o.toFixed(3)} />
      ))}
    </svg>
  );
}

// Portrait du candidat avec liseré jaune (programme, thématique), sans arche
// ni bloc derrière. `rond` : médaillon dans la couleur du candidat.
export function Portrait({ src, x, y, largeur, hauteur, rond = false, fond = MARQUE.encre, lisere = MARQUE.jaune, epaisseur = 10 }) {
  if (!src) return null;
  return (
    <div style={{ position: "absolute", left: x, top: y, width: largeur, height: hauteur, display: "flex", padding: epaisseur, backgroundColor: lisere, borderRadius: rond ? largeur : 6 }}>
      <div style={{ display: "flex", width: largeur - 2 * epaisseur, height: hauteur - 2 * epaisseur, backgroundColor: fond, borderRadius: rond ? largeur : 2, overflow: "hidden" }}>
        <img src={src} alt="" width={largeur - 2 * epaisseur} height={hauteur - 2 * epaisseur} style={{ width: largeur - 2 * epaisseur, height: hauteur - 2 * epaisseur, objectFit: "cover", objectPosition: "50% 20%", opacity: rond ? 0.92 : 1 }} />
      </div>
    </div>
  );
}

// Picto pixel art (data URI préparé par src/lib/pictos-charte.js).
export function Picto({ picto, x, y, style = {} }) {
  if (!picto) return null;
  return <img src={picto.src} alt="" width={picto.largeur} height={picto.hauteur} style={{ position: "absolute", left: x, top: y, width: picto.largeur, height: picto.hauteur, ...style }} />;
}

// Jauge de note : barre de la couleur du verdict.
export function Jauge({ note, max = 100, largeur, hauteur = 14, couleur, fond = rgba(MARQUE.encre, 0.12) }) {
  const plein = Math.round((largeur * Math.max(0, Math.min(Number(note) || 0, max))) / max);
  return (
    <div style={{ display: "flex", width: largeur, height: hauteur, borderRadius: 4, backgroundColor: fond }}>
      <div style={{ display: "flex", width: plein, height: hauteur, borderRadius: 4, backgroundColor: couleur }} />
    </div>
  );
}

// Bouton jaune de la fin.
export function BoutonJaune({ children }) {
  return <div style={{ display: "flex", alignItems: "center", height: 64, fontFamily: FAMILLES.mono, fontSize: 28, letterSpacing: 1, color: MARQUE.encre, backgroundColor: MARQUE.jaune, borderRadius: 8, padding: "0 22px" }}>{children}</div>;
}
