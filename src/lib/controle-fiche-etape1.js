// Contrôle d'une fiche d'étape 1 avant son entrée dans la file d'attente
// (table FicheEtape1) et, de nouveau, juste avant les étapes 2 et 3.
// UNE seule fonction, utilisée partout : page /test/depot,
// scripts/traiter-file-attente.js (traitement et import d'un dossier).
//
// Ce fichier n'importe pas le client Prisma : l'appelant passe sa base (`db`),
// ce qui le rend utilisable par le site (alias @/) comme par les scripts Node,
// et testable avec une fausse base (scripts/controle-fiche-etape1.test.js).

import { validateEtape1Structure } from "../../scripts/lib/scoring.js";
import { themeFiche } from "../../scripts/lib/themes-fiche.js";

// Même règle que les slugs de /relectures (scripts/relecture.js).
export const SLUG_FICHE = /^[a-z0-9-]{1,120}$/;

export const STATUTS_FILE = ["en_attente", "en_cours", "traitee", "erreur", "ignoree"];
export const SOURCES_FILE = ["depot", "claude", "import"];

const TIRET_CADRATIN = "—";

// Chemins (ex. « contexte_national.texte ») des textes, et des clés, qui
// contiennent un tiret cadratin.
export function cheminsAvecTiretCadratin(valeur, chemin = "") {
  if (typeof valeur === "string") return valeur.includes(TIRET_CADRATIN) ? [chemin || "(racine)"] : [];
  if (Array.isArray(valeur)) return valeur.flatMap((v, i) => cheminsAvecTiretCadratin(v, `${chemin}[${i}]`));
  if (valeur && typeof valeur === "object") {
    return Object.entries(valeur).flatMap(([k, v]) => {
      const sous = chemin ? `${chemin}.${k}` : k;
      return [...(k.includes(TIRET_CADRATIN) ? [`${sous} (nom de clé)`] : []), ...cheminsAvecTiretCadratin(v, sous)];
    });
  }
  return [];
}

const norm = (s) => String(s ?? "").trim().toLowerCase();

// Partie sans base : toutes les règles qui ne lisent que la fiche.
// nomsCandidats : noms exacts de la table Candidat.
export function erreursFiche(json, slug, { nomsCandidats = [] } = {}) {
  const erreurs = [];

  if (!SLUG_FICHE.test(String(slug ?? ""))) {
    erreurs.push(`Nom de fiche invalide : « ${slug ?? ""} » (minuscules, chiffres et tirets seulement, 120 caractères au plus).`);
  }

  if (!json || typeof json !== "object" || Array.isArray(json)) {
    erreurs.push("Le fichier doit contenir un objet JSON (la fiche d'étape 1).");
    return erreurs;
  }

  const { relecture, ...analyse } = json;

  // Structure d'étape 1 : 13 sections en accordéon { synthese, texte }, notation, etc.
  const structure = validateEtape1Structure(analyse);
  if (!structure.valid) erreurs.push(...structure.errors.map((e) => `Structure d'étape 1 : ${e}`));

  // Bloc relecture : candidat, thème et mesure initiale servent au pipeline.
  if (!relecture || typeof relecture !== "object" || Array.isArray(relecture)) {
    erreurs.push("Bloc « relecture » absent : il doit indiquer au moins candidat, theme et mesure_initiale.");
  } else {
    const candidat = relecture.candidat;
    if (typeof candidat !== "string" || !candidat.trim()) {
      erreurs.push("relecture.candidat : nom du candidat manquant.");
    } else if (!nomsCandidats.includes(candidat)) {
      const proche = nomsCandidats.find((n) => n.localeCompare(candidat.trim(), "fr", { sensitivity: "base" }) === 0);
      erreurs.push(
        `relecture.candidat : « ${candidat} » n'est pas un candidat de la base` +
          (proche ? ` (vouliez-vous dire « ${proche} » ?)` : "") +
          ". Le nom doit être écrit exactement comme sur le site.",
      );
    }
    if (!themeFiche(relecture.theme)) {
      erreurs.push(`relecture.theme : thème inconnu « ${relecture.theme ?? ""} ».`);
    }
    if (typeof relecture.mesure_initiale !== "string" || !relecture.mesure_initiale.trim()) {
      erreurs.push("relecture.mesure_initiale : texte de la mesure manquant.");
    }
  }

  const tirets = cheminsAvecTiretCadratin(json);
  if (tirets.length) {
    const liste = tirets.slice(0, 10).join(", ") + (tirets.length > 10 ? `, et ${tirets.length - 10} autre(s)` : "");
    erreurs.push(`Tiret cadratin (${TIRET_CADRATIN}) interdit, trouvé dans : ${liste}.`);
  }

  return erreurs;
}

// Une fiche de la file en erreur ou retirée peut être redéposée sous le même nom
// (corrigée) : sa ligne est alors remise en attente avec le nouveau contenu.
export const STATUTS_REMPLACABLES = ["erreur", "ignoree"];

// Contrôle complet : { ok, erreurs, remplaceId }.
//   db : client Prisma (ou fausse base dans les tests), en lecture seule ici.
//   ignorerId : id de la ligne FicheEtape1 en cours de traitement (elle ne
//   compte pas comme doublon d'elle-même).
//   remplaceId : id de la ligne en erreur ou retirée qui porte déjà ce nom
//   (à remettre en attente au lieu d'en créer une nouvelle), sinon null.
export async function controlerFicheEtape1(json, slug, { db, ignorerId = null } = {}) {
  if (!db) throw new Error("controlerFicheEtape1 : base (db) manquante.");
  const nomsCandidats = (await db.candidat.findMany({ select: { nom: true } })).map((c) => c.nom);
  const erreurs = erreursFiche(json, slug, { nomsCandidats });
  let remplaceId = null;

  if (SLUG_FICHE.test(String(slug ?? ""))) {
    // Doublon dans la file (le slug est unique) : bloquant, sauf pour une
    // fiche en erreur ou retirée, que l'on peut redéposer corrigée.
    const dansFile = await db.ficheEtape1.findFirst({
      where: { slug, ...(ignorerId != null ? { NOT: { id: ignorerId } } : {}) },
      select: { id: true, statut: true },
    });
    if (dansFile && STATUTS_REMPLACABLES.includes(dansFile.statut)) remplaceId = dansFile.id;
    else if (dansFile) erreurs.push(`Le nom « ${slug} » est déjà dans la file d'attente (fiche n° ${dansFile.id}, statut ${dansFile.statut}).`);

    // Fiche déjà faite : brouillon ou fiche publiée issue du robot de révision
    // (contenuComplet.revision.slug), hors corbeille.
    const dejaFaite = await db.analyse.findFirst({
      where: { contenuComplet: { path: ["revision", "slug"], equals: slug }, NOT: { statut: "corbeille" } },
      select: { id: true, statut: true },
    });
    if (dejaFaite) erreurs.push(`Fiche déjà faite : l'analyse n° ${dejaFaite.id} (${dejaFaite.statut}) porte le nom « ${slug} ».`);
  }

  // Même mesure déjà analysée pour ce candidat : analyze.js refuserait de toute
  // façon une seconde proposition au texte identique (après avoir payé les étapes 2 et 3).
  const r = json && typeof json === "object" ? json.relecture : null;
  if (r && typeof r.candidat === "string" && nomsCandidats.includes(r.candidat) && typeof r.mesure_initiale === "string" && r.mesure_initiale.trim()) {
    const propositions = await db.proposition.findMany({
      where: { candidat: { nom: r.candidat } },
      select: { id: true, texteOriginal: true },
    });
    const meme = propositions.find((p) => norm(p.texteOriginal) === norm(r.mesure_initiale));
    if (meme) erreurs.push(`Mesure déjà analysée pour ${r.candidat} : proposition n° ${meme.id}, même texte que relecture.mesure_initiale.`);
  }

  return { ok: erreurs.length === 0, erreurs, remplaceId };
}

// Paramètres d'analyze.js déduits d'une fiche contrôlée (comme le robot de
// révision) : l'analyse seule (sans le bloc relecture), candidat, thème du site, source.
export function parametresPipeline(json) {
  const { relecture, ...analyse } = json;
  const t = themeFiche(relecture.theme);
  return {
    analyse,
    candidat: relecture.candidat,
    theme: t.theme,
    themeRemplace: t.remplace,
    source: relecture.mesure_initiale.trim(),
    titre: typeof relecture.titre === "string" ? relecture.titre : null,
  };
}
