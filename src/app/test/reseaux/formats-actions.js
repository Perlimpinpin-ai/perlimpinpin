"use server";

import { prisma } from "@/lib/prisma";
import { isEditor } from "@/lib/test-auth";
import { appelerClaude, cleApiConfiguree } from "@/lib/claude-reel";
import { additionnerUsage, coutClaude, jsonDepuisTexte } from "@/lib/reel-generation";
import { requeteRecit } from "@/lib/recit-generation";
import { selectionProgramme, selectionThematique } from "@/lib/carrousel-formats";
import { candidatsChoisis, candidatsHorsRegistre, contexteProgramme, contexteThematique, encoderEtat, genererFormatCore, lirePromptFormat } from "@/lib/carrousel-formats-serveur";
import { controleRegistre, couleursTheme } from "@/lib/charte-rs";

// Actions des carrousels « analyse de programme » et « thématique » (charte
// RS) : UN SEUL appel à Claude par carrousel (deux essais au plus), lancé
// seulement par le bouton de la page. Rien n'est écrit en base : le résultat
// (sélection + réponse contrôlée) revient dans l'URL de la page. Chaque action
// revérifie le mode édition. TEST_DRY_RUN=1 : aucun appel payant.
// Démonstration (« demo », hors production) : réponse simulée, aucun appel.

const REFUS = (erreur) => ({ ok: false, erreur });

async function appeler(format, donnees) {
  if (process.env.TEST_DRY_RUN === "1") return { simulation: true };
  if (!cleApiConfiguree()) return { erreur: "ANTHROPIC_API_KEY n’est pas configurée sur ce serveur : génération impossible." };
  let usage = {};
  const resultat = await genererFormatCore({
    format,
    prompt: await lirePromptFormat(format),
    donnees,
    appeler: async (message) => {
      const r = await appelerClaude(requeteRecit(message));
      usage = additionnerUsage(usage, r?.usage);
      return r;
    },
    analyser: (r) => jsonDepuisTexte(r.texte),
  });
  return { ...resultat, cout: coutClaude(usage) };
}

// `ordres` : { idFiche: rang 1 à 6 } (champ de tri saisi à la main).
export async function genererProgrammeAction(slug, ordres) {
  try {
    if (!(await isEditor())) return REFUS("Page réservée aux personnes déverrouillées.");
    const contexte = await contexteProgramme(prisma, slug);
    if (!contexte) return REFUS("Candidat introuvable.");
    const refus = controleRegistre(contexte.candidat.nom);
    if (refus) return REFUS(refus);
    const selection = selectionProgramme(contexte.fiches, ordres ?? {});
    if (selection.erreurs.length) return REFUS(selection.erreurs.join(" "));
    if (contexte.demo) return { ok: true, e: encoderEtat({ ordres, reponse: contexte.demo.reponse }), message: "Démonstration : réponse simulée, aucun appel à Claude." };
    const r = await appeler("programme", { candidatNom: contexte.candidat.nom, fiches: selection.fiches });
    if (r.simulation) return { ok: true, simulation: true, message: "Mode simulation (TEST_DRY_RUN=1) : aucun appel à Claude." };
    if (r.erreur) return REFUS(r.erreur);
    if (!r.reponse) return { ok: false, erreur: `Réponse refusée après deux essais : ${r.erreurs.join(" ; ")}`, cout: r.cout };
    return { ok: true, e: encoderEtat({ ordres, reponse: r.reponse }), cout: r.cout, avertissements: r.avertissements };
  } catch (error) {
    return REFUS(`Erreur inattendue : ${error.message}`);
  }
}

// `choix` : { nomCandidat: id de la fiche sur le thème, ou null (pas de proposition) }.
export async function genererThematiqueAction(theme, choix) {
  try {
    if (!(await isEditor())) return REFUS("Page réservée aux personnes déverrouillées.");
    const contexte = await contexteThematique(prisma, theme);
    if (!contexte) return REFUS("Thème introuvable.");
    if (!couleursTheme(contexte.theme, contexte.couleursThemes)) return REFUS("Pas de couleur validée pour ce thème (COULEURS_THEMES de src/lib/charte-rs.js) : génération refusée.");
    const candidats = candidatsChoisis(contexte, choix);
    const hors = candidatsHorsRegistre(candidats.map((c) => c.nom));
    if (hors.length) return REFUS(hors.map((n) => controleRegistre(n)).join(" "));
    const selection = selectionThematique(contexte.theme, candidats);
    if (selection.erreurs.length) return REFUS(selection.erreurs.join(" "));
    if (contexte.demo) return { ok: true, e: encoderEtat({ choix, reponse: contexte.demo.reponse }), message: "Démonstration : réponse simulée, aucun appel à Claude." };
    const r = await appeler("thematique", { theme: contexte.theme, candidats: selection.candidats });
    if (r.simulation) return { ok: true, simulation: true, message: "Mode simulation (TEST_DRY_RUN=1) : aucun appel à Claude." };
    if (r.erreur) return REFUS(r.erreur);
    if (!r.reponse) return { ok: false, erreur: `Réponse refusée après deux essais : ${r.erreurs.join(" ; ")}`, cout: r.cout };
    return { ok: true, e: encoderEtat({ choix, reponse: r.reponse }), cout: r.cout, avertissements: r.avertissements };
  } catch (error) {
    return REFUS(`Erreur inattendue : ${error.message}`);
  }
}
