import { calculerScore } from "./scoring.js";

// Cœur du rapport de scores (scripts/rapport-scores.js), sans base : testé par
// scripts/rapport-scores.test.js.

// analyses : [{ id, propositionId, scoreFaisabilite, contenuComplet, proposition }]
// → [{ analyseId, propositionId, candidat, titre, scoreModele, scoreColonne,
//      scoreCode, statut: "identique" | "ecart" | "ancien_bareme", details }]
export function comparerScores(analyses) {
  return analyses.map((a) => {
    const notation = a.contenuComplet?.notation_detaillee ?? null;
    const calcul = calculerScore(notation);
    const base = {
      analyseId: a.id,
      propositionId: a.propositionId,
      candidat: a.proposition?.candidat?.nom ?? "?",
      titre: a.proposition?.titre ?? a.contenuComplet?.titre_fiche ?? "(sans titre)",
      scoreModele: Number.isFinite(notation?.score_total) ? notation.score_total : null,
      scoreColonne: a.scoreFaisabilite,
    };
    if (!calcul) return { ...base, scoreCode: null, statut: "ancien_bareme", details: [] };
    const details = [];
    if (calcul.score_total !== base.scoreModele) details.push(`score_total ${base.scoreModele} → ${calcul.score_total}`);
    if (calcul.operationnalite_moyens_total !== notation.operationnalite_moyens_total) {
      details.push(`opérationnalité ${notation.operationnalite_moyens_total} → ${calcul.operationnalite_moyens_total}`);
    }
    if (calcul.plafond_applique !== notation.plafond_applique) {
      details.push(`plafond ${notation.plafond_applique} → ${calcul.plafond_applique}`);
    }
    if (base.scoreColonne !== calcul.score_total) details.push(`colonne scoreFaisabilite ${base.scoreColonne}`);
    return { ...base, scoreCode: calcul.score_total, statut: details.length ? "ecart" : "identique", details };
  });
}

const echapper = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\s+/g, " ");

export function rapportMarkdown(lignes, date) {
  const ecarts = lignes.filter((l) => l.statut === "ecart");
  const identiques = lignes.filter((l) => l.statut === "identique");
  const anciens = lignes.filter((l) => l.statut === "ancien_bareme");
  const out = [
    "# Rapport des scores : modèle et code",
    "",
    `Généré le ${date.toISOString()} — lecture seule, aucune fiche modifiée.`,
    "",
    `- Fiches publiées : ${lignes.length}`,
    `- Score identique : ${identiques.length}`,
    `- Écart : ${ecarts.length}`,
    `- Ancien barème (non recalculable) : ${anciens.length}`,
    "",
    "## Écarts",
    "",
  ];
  if (ecarts.length === 0) out.push("Aucun écart.");
  else {
    out.push("| Fiche | Candidat | Titre | Modèle | Code | Détail |", "|---|---|---|---|---|---|");
    for (const l of ecarts) {
      out.push(
        `| /declarations/${l.propositionId} (analyse ${l.analyseId}) | ${echapper(l.candidat)} | ${echapper(l.titre)} | ${l.scoreModele ?? "?"} | ${l.scoreCode} | ${echapper(l.details.join(" ; "))} |`,
      );
    }
  }
  out.push("", "## Ancien barème", "");
  if (anciens.length === 0) out.push("Aucune.");
  else for (const l of anciens) out.push(`- /declarations/${l.propositionId} (analyse ${l.analyseId}) — ${l.candidat} — ${l.titre}`);
  out.push("");
  return out.join("\n");
}
