// Fiche type et réponse du modèle au format v6 (docs/prompt-carrousel.md),
// partagées par scripts/recit.test.js et scripts/carrousel-detaille.test.js.
import { valeursReseaux } from "../../src/lib/reseaux.js";

export const FICHE = {
  mesure_reformulee: { synthese: "Fabien Roussel veut porter le Smic à 2 200 euros brut par mois, soit une hausse de 20 %." },
  contexte_national: { texte: "Le Smic brut est de 1 830 euros. 3 millions de salariés sont au Smic." },
  contexte_international: { texte: "En Espagne, le salaire minimum est passé de 736 à 900 euros en 2019 ; l'emploi a moins progressé." },
  verdict_final: "Ce qui tient : le pouvoir d'achat des bas salaires. Ce qui ne tient pas : le coût pour les PME n'est pas chiffré.",
  notation_detaillee: {
    operationnalite_moyens_total: 18,
    efficacite: 12,
    effets_rebonds_externalites: 9,
    degre_preparation: 4,
    alignement_logique: 8,
    qualification_efficacite: "INCERTAIN",
  },
  ce_qui_la_ferait_tenir: ["Étaler la hausse : par paliers annuels.", "Chiffrer le coût : publier une étude d'impact.", "Compenser : un allègement ciblé."],
  sources_utilisees: ["Ministère du Travail, montants du Smic 2026 : https://travail.gouv.fr/smic", "Insee, salaires : https://insee.fr/x", "OCDE, Smic rapporté au salaire médian"],
  reseaux: { tient: { tient_court: ["Les bas salaires gagnent nettement"], tient_pas_court: ["Le coût pour les PME n'est pas chiffré"] } },
};

const PARAGRAPHE = "Une phrase de récit assez longue pour remplir le tweet sans changer le sens de la fiche ni ajouter de fait. ";
const effet = (acteur, texte, pastille) => ({ acteur, texte, pastille });

export function reponse(modifs = {}) {
  return {
    couverture: { question: "{NOM} veut-il un ==Smic à 2 200 euros== ?" },
    constat: {
      titre: "Les bas salaires peinent à suivre les prix.",
      explication: "Le Smic brut est de 1 830 euros. Trois millions de salariés en dépendent.",
      chiffres: [
        { valeur: "1 830 €", detail: "de Smic brut par mois" },
        { valeur: "3 millions", detail: "de salariés au Smic", jaune: true },
        { valeur: "2 200 €", detail: "brut par mois" },
        { valeur: "+20 %", detail: "de hausse" },
      ],
      proposition: "La proposition de {NOM} : porter le Smic à 2 200 euros brut par mois.",
      imprecisions: "Elle ne dit pas comment aider les petites entreprises.",
      sources: "Ministère du Travail",
    },
    note: {
      titre: "Le plan de {NOM} est facile à décider, plus dur à financer.",
      explication: "Le coût pour les entreprises n'est pas évalué. Le gain pour les salariés est réel.",
      criteres: {
        operationnalite_moyens: "Un décret suffit.",
        efficacite: "Le gain est réel.",
        effets_rebonds_externalites: "L'emploi peu qualifié est exposé.",
        degre_preparation: "Aucun chiffrage publié.",
        alignement_logique: "Cohérent avec le programme.",
      },
    },
    court_terme: {
      titre: "Un vrai gain sur la fiche de paie.",
      effets: [effet("Pour les salariés", "Le salaire brut augmenterait.", "positif"), effet("Pour les entreprises", "Le coût du travail monterait.", "négatif"), effet("Pour l'État", "Les aides au Smic coûteraient plus.", "coûteux")],
    },
    long_terme: {
      titre: "Le vrai débat porte sur l'emploi.",
      effets: [effet("L'emploi peu qualifié", "Les plus exposés pourraient perdre leur poste.", "débattu"), effet("Les salaires moyens", "Ils seraient tirés vers le haut.", "possible"), effet("Les prix", "Les prix pourraient monter un peu.", "incertain")],
    },
    ailleurs: {
      titre: "En Europe, une hausse comparable.",
      mesures: [{ lieu: "Espagne", annee: "2019", fait: "Le salaire minimum passe de 736 à 900 euros.", resultat: "L'emploi a moins progressé.", pastille: "débattu" }],
      sources: "Banque d'Espagne",
    },
    avis: { avis: "Le gain est réel, mais le coût pour les PME reste à chiffrer.", tient: ["Le gain brut est réel.", "La mesure est simple à décider."], coince: ["Le coût pour les PME n'est pas chiffré.", "L'emploi peu qualifié est exposé."] },
    legende: {
      question: "{NOM} veut porter le Smic à 2 200 euros brut. Est-ce tenable ?",
      avis: "Notre avis : le gain est réel, mais le coût pour les PME reste à chiffrer.",
      effet: "L'effet principal : un vrai gain sur la fiche de paie.",
    },
    tweet: {
      accroche: "Et si votre fiche de paie changeait d'un coup ?",
      promesse: `{CANDIDAT} veut porter le Smic à 2 200 euros brut. ${PARAGRAPHE}`,
      exemple: `Prenons une salariée au Smic à temps plein. ${PARAGRAPHE}${PARAGRAPHE}`,
      hic: `Sauf que… le coût pour les PME n'est pas chiffré. ${PARAGRAPHE}${PARAGRAPHE}`,
      tient: `Ce qui tient : le pouvoir d'achat des bas salaires. ${PARAGRAPHE}`,
      appel: "Et vous, vous en pensez quoi ?",
    },
    ...modifs,
  };
}

export const CONTEXTE = {
  ficheFinale: FICHE,
  candidatNom: "Fabien Roussel",
  score: 51,
  valeurs: valeursReseaux({ candidatNom: "Fabien Roussel", score: 51, propositionId: 42 }),
};
