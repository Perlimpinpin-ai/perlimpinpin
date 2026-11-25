// Robot de révision d'une relecture close (.github/workflows/revision-relecture.yml,
// scripts/reviser-relecture.js) : partie sans réseau ni base, testée par
// scripts/reviser-relecture.test.js.
//
// - paramètres d'analyze.js déduits du bloc `relecture` (candidat, thème, source) ;
// - dossier et noms des fichiers de sortie dans data/analyses finales/ ;
// - anti-doublon (données lues en base par l'appelant) ;
// - bloc `archive`, construit par le code à partir des commentaires en base ;
// - corps de la PR et résumé du job.
//
// Repris du robot des étapes 2 et 3 (branche robot-pipeline, jamais fusionnée) :
// contrôle du candidat, anti-doublon par texte et par objectif_court, résumé.

import { THEMES_SITE, TABLE_THEMES, themeFiche } from "./themes-fiche.js";
import { instantParis, partiesParis } from "../relecture.js";

export const SITE_URL = "https://perlimpinpin.ai";
export const BONUS_RETENU = 20; // PerlimpinPOINTS, voir src/lib/club-points-core.js

export class RevisionError extends Error {}

// ---------- thème ----------

// Table des thèmes : scripts/lib/themes-fiche.js (partagée avec la file d'attente
// des fiches d'étape 1).
export { THEMES_SITE, TABLE_THEMES };

// { theme, remplace } : remplace = true si la table a servi (signalé dans le résumé).
export function themeDuSite(theme) {
  const r = themeFiche(theme);
  if (r) return r;
  throw new RevisionError(`Thème inconnu : « ${String(theme ?? "").trim()} ». Ajoute-le à TABLE_THEMES (scripts/lib/themes-fiche.js).`);
}

// ---------- source et candidat ----------

// Texte de la proposition (affiché comme « Mesure initiale » sur la fiche) :
// relecture.mesure_initiale seule. La citation et sa source restent dans le
// bloc relecture.extrait (page /relectures, archive) ; on ne les recopie pas
// ici, à la demande de la rédaction (25/10/2026).
export function sourceDepuisRelecture(relecture) {
  const mesure = String(relecture?.mesure_initiale ?? "").trim();
  if (!mesure) throw new RevisionError("relecture.mesure_initiale vide.");
  return mesure;
}

// Le nom doit exister exactement en base (Candidat.nom) : jamais de création.
export function verifierCandidat(nom, nomsEnBase) {
  if (nomsEnBase.includes(nom)) return;
  const proche = nomsEnBase.find((n) => n.localeCompare(nom, "fr", { sensitivity: "base" }) === 0);
  throw new RevisionError(
    `Candidat inconnu en base : « ${nom} »` + (proche ? ` (le plus proche : « ${proche} »)` : "") +
      ". Corrige relecture.candidat dans la fiche.",
  );
}

// ---------- fichiers de sortie ----------

// Dossiers existants de data/analyses finales/.
export const DOSSIERS_CANDIDATS = {
  "Dominique de Villepin": "DeVillepin",
  "Raphaël Glucksmann": "Glucksmann",
  "Marine Le Pen": "LePen",
  "Jean-Luc Mélenchon": "Melenchon",
  "Bruno Retailleau": "Retailleau",
  "Fabien Roussel": "Roussel",
  "Éric Zemmour": "Zemmour",
};

// { dossier, deduit } : hors table, nom sans le prénom, sans accents, chaque
// mot en majuscule (« Dominique de Villepin » → « DeVillepin »), signalé.
export function dossierCandidat(nom) {
  if (DOSSIERS_CANDIDATS[nom]) return { dossier: DOSSIERS_CANDIDATS[nom], deduit: false };
  const mots = String(nom).normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[\s'’-]+/).filter(Boolean);
  const dossier = mots
    .slice(mots.length > 1 ? 1 : 0)
    .map((m) => m[0].toUpperCase() + m.slice(1))
    .join("")
    .replace(/[^A-Za-z0-9]/g, "");
  if (!dossier) throw new RevisionError(`Dossier introuvable pour le candidat « ${nom} ».`);
  return { dossier, deduit: true };
}

export function cheminsSorties(slug, candidat) {
  const { dossier, deduit } = dossierCandidat(candidat);
  const base = `data/analyses finales/${dossier}/${slug.replaceAll("-", "_")}`;
  return { dossier, deduit, etape3: `${base}_etape3.json`, mistral: `${base}_etape2_mistral.json` };
}

// ---------- dates ----------

export function dateParis(now = new Date()) {
  const p = partiesParis(now);
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

export function debutJourParis(date) {
  const [y, m, d] = date.split("-").map(Number);
  return instantParis(y, m, d, 0, 0);
}

// ---------- anti-doublon ----------

// propositions : celles du candidat, avec leurs analyses
// ({ id, titre, texteOriginal, analyses: [{ id, statut, createdAt, contenuComplet }] }).
// Doublon si une proposition a le même texte (--source), ou si une analyse
// créée depuis la mise en relecture (relecture.date) a le même titre que la
// fiche relue ou le même objectif_court (l'étape 3 le recopie tel quel ; cela
// couvre aussi les fiches importées à la main avec un autre texte).
// Les analyses mises à la corbeille depuis /test ne comptent pas : c'est le
// geste prévu pour écarter un brouillon raté et relancer la révision. Le
// critère « même texte » reste bloquant quoi qu'il arrive, car analyze.js
// refuserait de toute façon une seconde proposition au texte identique.
export function trouverDoublon({ propositions, source, titre, objectifCourt, depuis }) {
  const debut = debutJourParis(depuis).getTime();
  const norm = (s) => String(s ?? "").trim().toLowerCase();
  for (const p of propositions) {
    if (norm(p.texteOriginal) === norm(source)) {
      return { analyseId: p.analyses?.[0]?.id ?? null, propositionId: p.id, critere: "même texte de proposition" };
    }
    for (const a of p.analyses ?? []) {
      if (a.statut === "corbeille") continue;
      if (new Date(a.createdAt).getTime() < debut) continue;
      const objectif = a.contenuComplet?.mesure_vers_objectif?.objectif_court;
      if (titre && norm(p.titre) === norm(titre)) {
        return { analyseId: a.id, propositionId: p.id, critere: `même titre, analyse créée depuis le ${depuis}` };
      }
      if (objectifCourt && objectif === objectifCourt) {
        return { analyseId: a.id, propositionId: p.id, critere: `même objectif « ${objectifCourt} », analyse créée depuis le ${depuis}` };
      }
    }
  }
  return null;
}

// ---------- commentaires et archive ----------

// Fichier passé à analyze.js --commentaires : ni nom ni e-mail.
export function commentairesPourModele(commentaires) {
  return commentaires.map((c) => ({ id: c.id, sectionLabel: c.sectionLabel ?? null, body: c.body, quotedText: c.quotedText ?? null }));
}

// Bloc relecture.archive, construit par le code : auteur, section et texte du
// commentaire copiés depuis la base, réponse et retenu repris de
// revision_relecture. Aucun autre champ (jamais d'e-mail).
export function construireArchive({ date, versionSuivante, revision, commentaires }) {
  const parId = new Map((revision?.reponses ?? []).map((r) => [r.commentaire_id, r]));
  const reponses = commentaires.map((c) => {
    const r = parId.get(c.id);
    if (!r) throw new RevisionError(`Aucune réponse pour le commentaire ${c.id}.`);
    return {
      commentaire_id: c.id,
      auteur: c.authorName ?? null,
      section: c.sectionLabel ?? null,
      commentaire: c.body,
      reponse: r.reponse,
      retenu: r.retenu,
    };
  });
  return {
    date,
    version_suivante: versionSuivante,
    ...(revision?.synthese ? { synthese: revision.synthese } : {}),
    reponses,
  };
}

// ---------- résumé et PR ----------

const CRITERES = [
  ["operationnalite_juridique", "Opérationnalité juridique", 10],
  ["operationnalite_budgetaire", "Opérationnalité budgétaire", 10],
  ["operationnalite_moyens_humains", "Moyens humains", 10],
  ["operationnalite_moyens_total", "Opérationnalité & Moyens", 30],
  ["efficacite", "Efficacité", 30],
  ["effets_rebonds_externalites", "Effets rebonds & Externalités", 20],
  ["degre_preparation", "Degré de préparation", 10],
  ["alignement_logique", "Alignement & Logique globale", 10],
];

export function criteresModifies(avant = {}, apres = {}) {
  return CRITERES.filter(([k]) => avant[k] !== apres[k]).map(([k, label, max]) => `${label} : ${avant[k] ?? "?"} → ${apres[k] ?? "?"}/${max}`);
}

export function premierePhrase(texte) {
  const t = String(texte ?? "").trim().split(/\n\s*\n/)[0];
  const m = /^.*?[.!?…](?=\s|$)/s.exec(t);
  return (m ? m[0] : t).replace(/\s+/g, " ").replace(/\|/g, "\\|").trim();
}

const dollars = (n) => (typeof n === "number" ? `~${n.toFixed(2)} $` : "?");

// Cache de l'étape 3 (coutPipeline.cacheEtape3, voir bilanCache dans
// analyze.js), pour vérifier le gain sans rien chercher. Sans cache utilisé,
// la ligne le dit : c'est le signe qu'il ne joue pas.
export function ligneCacheEtape3(cache) {
  const n = (x) => (x ?? 0).toLocaleString("fr-FR");
  if (!cache) return ["- Cache étape 3 : aucun token relu ni écrit en cache"];
  const iterations = cache.iterations !== undefined ? `, ${cache.iterations} itération(s) côté serveur` : "";
  return [
    `- Cache étape 3 : ${n(cache.lus)} tokens relus en cache, ${n(cache.ecrits)} écrits, ${n(cache.nonCaches)} non cachés${iterations} ; économie estimée ${dollars(cache.economieEstimee)}`,
  ];
}

// Markdown commun au corps de la PR et au résumé du job. Aucun nom d'adhérent.
export function rapportMarkdown({ slug, relecture, notationAvant, resultat, commentaires, theme, avertissements = [], lienPR = null, siteUrl = SITE_URL }) {
  const r = resultat;
  const notationApres = r.etape3?.fiche_complete?.notation_detaillee ?? {};
  const avisMistral = new Map((r.etape2?.contreAvisMistral?.commentaires ?? []).map((a) => [a.commentaire_id, a]));
  const reponses = new Map((r.revisionRelecture?.reponses ?? []).map((x) => [x.commentaire_id, x]));
  const cout = r.coutPipeline ?? {};
  const l = [
    `## Révision : ${relecture.titre} (${relecture.candidat})`,
    "",
    `- Brouillon : ${siteUrl}/test/${r.analyseId}`,
    ...(lienPR ? [`- Pull request : ${lienPR}`] : []),
    `- Score : ${notationAvant?.score_total ?? "?"} → **${r.score ?? "?"}/100** (version relue → fiche finale)`,
    `- Thème : ${theme}`,
    r.versionBasique?.ok
      ? "- Version basique (étape 3 bis) : ✓"
      : `- Version basique (étape 3 bis) : ✗ ${(r.versionBasique?.erreurs ?? []).join(" ; ") || "cause inconnue"}`,
    `- Coût total : ${dollars(cout.coutEstimeTotal)} (étape 2 ${dollars(cout.coutEstimeParEtape?.etape2)}, étape 3 ${dollars(cout.coutEstimeParEtape?.etape3)}, ` +
      `${cout.recherchesWeb ?? 0} recherche(s) web ${dollars(cout.coutEstimeParEtape?.recherchesWeb ?? 0)}, étape 3 bis ${dollars(cout.coutEstimeParEtape?.etape3bis)})`,
    ...ligneCacheEtape3(cout.cacheEtape3),
    "",
  ];
  const modifs = criteresModifies(notationAvant, notationApres);
  l.push("### Critères modifiés", "", ...(modifs.length ? modifs.map((m) => `- ${m}`) : ["Aucun."]), "");

  l.push(`### Commentaires (${commentaires.length})`, "");
  if (commentaires.length) {
    l.push("| Section | Type (étape 2) | Retenu | Réponse (1re phrase) |", "|---|---|---|---|");
    for (const c of commentaires) {
      const rep = reponses.get(c.id);
      const type = avisMistral.get(c.id)?.type ?? "?";
      l.push(`| ${(c.sectionLabel ?? "?").replace(/\|/g, "\\|")} | ${type} | ${rep?.retenu ? "oui" : "non"} | ${premierePhrase(rep?.reponse)} |`);
    }
  } else {
    l.push("Aucun commentaire : archive avec `reponses: []`.");
  }
  l.push("");
  if (r.revisionRelecture?.synthese) l.push("### Synthèse", "", r.revisionRelecture.synthese, "");
  if (r.revisionRelecture?.notes_pour_arno) l.push("### Notes pour Arno", "", r.revisionRelecture.notes_pour_arno, "");
  if (avertissements.length) l.push("### À vérifier", "", ...avertissements.map((a) => `- ${a}`), "");
  l.push(
    "### Valider",
    "",
    `1. Relire le brouillon ${siteUrl}/test/${r.analyseId} et les réponses ci-dessus.`,
    "2. Fusionner cette PR : archive et réponses publiées sur /relectures, PerlimpinPOINTS attribués (workflow « Après révision »).",
    "3. Cliquer sur Publier sur /test.",
    "",
    `Fiche : \`${slug}\``,
  );
  return l.join("\n") + "\n";
}
