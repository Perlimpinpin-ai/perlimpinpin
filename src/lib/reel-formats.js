import { resolveTheme, themeLabel } from "./themes.js";
import { cleAlphabetique, nomDeFamille } from "./charte-rs.js";
import { CANDIDATS_MAX, CANDIDATS_MIN, MESURES_PROGRAMME } from "./reel-storyboard.js";

// Choix des fiches des Reels « programme » et « thématique » (charte p. 15,
// 16 et 19), le même que pour les carrousels de ces formats. Fonctions PURES,
// testées par scripts/reel-formats.test.js.
//
// Une « fiche » ici : { propositionId, titre, theme, dateDeclaration,
//   candidat: { nom, photoUrl }, score, fiche (contenuComplet) } — seulement
// des fiches publiées (pas d'analyse = pas de note).

// Libellés courts des thèmes (libellés en police pixel, classement).
export const THEMES_COURTS = {
  logement: "Logement",
  economie: "Économie",
  "ia-numerique": "Numérique",
  education: "Éducation",
  "securite-justice": "Sécurité",
  sante: "Santé",
  retraites: "Retraites",
  emploi: "Emploi",
  "energie-climat": "Climat",
  "alimentation-agriculture": "Agriculture",
  immigration: "Immigration",
  "democratie-et-institutions": "Institutions",
};

// Picto de la liste fermée pour chaque thème.
export const PICTOS_THEMES = {
  logement: "house",
  economie: "wallet",
  "ia-numerique": "chart",
  education: "book",
  "securite-justice": "bank",
  sante: "heart",
  retraites: "hourglass",
  emploi: "factory",
  "energie-climat": "leaf",
  "alimentation-agriculture": "leaf",
  immigration: "globe",
  "democratie-et-institutions": "bubble",
};

export function themeCourt(theme) {
  const slug = resolveTheme(theme);
  return THEMES_COURTS[slug] ?? themeLabel(theme) ?? String(theme ?? "");
}

export function pictoTheme(theme) {
  return PICTOS_THEMES[resolveTheme(theme)] ?? "chart";
}

function date(f) {
  const t = Date.parse(f.dateDeclaration ?? "");
  return Number.isNaN(t) ? 0 : t;
}

// Ordre où le candidat met ses mesures en avant : date de déclaration (la
// plus ancienne d'abord), puis numéro de fiche.
function ordreDeclaration(a, b) {
  return date(a) - date(b) || Number(a.propositionId) - Number(b.propositionId);
}

// Programme : 6 thèmes différents, une fiche par thème (la première déclarée),
// dans l'ordre où le candidat les a mis en avant. `choix` : numéros de fiches
// imposés par l'équipe (?fiches=28,29,…), dans l'ordre voulu.
// Renvoie { mesures: [{ numero, propositionId, theme, themeCourt, icone, titre, score, fiche }], erreur }.
export function choisirMesuresProgramme(fiches, { choix = null } = {}) {
  const publiees = (fiches ?? []).filter((f) => Number.isFinite(Number(f.score)));
  let retenues;
  if (choix?.length) {
    retenues = choix.map((id) => publiees.find((f) => Number(f.propositionId) === Number(id))).filter(Boolean);
  } else {
    const vus = new Set();
    retenues = [...publiees].sort(ordreDeclaration).filter((f) => {
      const t = resolveTheme(f.theme) ?? f.theme;
      if (vus.has(t)) return false;
      vus.add(t);
      return true;
    });
  }
  const themes = new Set(retenues.map((f) => resolveTheme(f.theme) ?? f.theme));
  const erreurs = [];
  if (choix?.length && retenues.length !== choix.length) erreurs.push("Une des fiches demandées n'est pas une fiche publiée de ce candidat.");
  if (themes.size !== retenues.length) erreurs.push("Deux mesures choisies ont le même thème : 6 thèmes différents attendus.");
  const mesures = retenues.slice(0, MESURES_PROGRAMME).map((f, i) => ({
    numero: i + 1,
    propositionId: f.propositionId,
    theme: f.theme,
    themeCourt: themeCourt(f.theme),
    icone: pictoTheme(f.theme),
    titre: f.titre,
    score: Number(f.score),
    fiche: f.fiche ?? {},
  }));
  if (mesures.length < MESURES_PROGRAMME) {
    const nom = fiches?.[0]?.candidat?.nom ?? "ce candidat";
    erreurs.push(`${nomDeFamille(nom)} n'a que ${themes.size} thème(s) avec une fiche publiée (${publiees.length} fiche(s)) : il en faut 6 différents pour le format « programme ». Pas d'analyse, pas de note : rien n'est inventé.`);
  }
  return { mesures, erreur: erreurs.length ? erreurs.join(" ") : null };
}

// Thématique : une fiche par candidat sur le thème (la première déclarée),
// plus les candidats demandés sans fiche (`avec` : noms), en ordre
// alphabétique du nom de famille ; 4 à 8 candidats.
// Renvoie { candidats: [{ numero, nom, photoUrl, propositionId|null, titre|null, score|null, fiche|null }], erreur }.
export function choisirCandidatsThematique(fiches, theme, { avec = [], candidatsConnus = [] } = {}) {
  const slug = resolveTheme(theme) ?? theme;
  const duTheme = (fiches ?? []).filter((f) => (resolveTheme(f.theme) ?? f.theme) === slug && Number.isFinite(Number(f.score))).sort(ordreDeclaration);
  const parNom = new Map();
  for (const f of duTheme) if (!parNom.has(f.candidat.nom)) parNom.set(f.candidat.nom, f);
  const liste = [...parNom.values()].map((f) => ({ nom: f.candidat.nom, photoUrl: f.candidat.photoUrl ?? null, propositionId: f.propositionId, titre: f.titre, score: Number(f.score), fiche: f.fiche ?? {} }));
  for (const nom of avec ?? []) {
    if (liste.some((c) => c.nom === nom)) continue;
    const connu = (candidatsConnus ?? []).find((c) => c.nom === nom);
    liste.push({ nom, photoUrl: connu?.photoUrl ?? null, propositionId: null, titre: null, score: null, fiche: null });
  }
  const candidats = liste.sort((a, b) => cleAlphabetique(a.nom).localeCompare(cleAlphabetique(b.nom), "fr")).map((c, i) => ({ numero: i + 1, ...c }));
  const erreur =
    candidats.length < CANDIDATS_MIN || candidats.length > CANDIDATS_MAX
      ? `${candidats.length} candidat(s) pour « ${themeLabel(theme)} » : ${CANDIDATS_MIN} à ${CANDIDATS_MAX} attendus (ajouter des candidats sans proposition avec ?avec=…).`
      : null;
  return { candidats, erreur, theme: slug, themeLibelle: themeLabel(theme), themeCourt: themeCourt(theme) };
}
