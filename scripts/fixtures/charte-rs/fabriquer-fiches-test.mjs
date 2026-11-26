// Fabrique les FICHES DE TEST de Teddy Riner de ce dossier, pour les
// démonstrations de la charte RS (scripts/demo-charte-rs.js) et les tests.
// Ce ne sont PAS des analyses publiées : textes et chiffres fabriqués pour le test.
//   node scripts/fixtures/charte-rs/fabriquer-fiches-test.mjs
import { mkdirSync, writeFileSync } from "node:fs";

const DOSSIER = "scripts/fixtures/charte-rs";
mkdirSync(DOSSIER, { recursive: true });

function fiche({ titre, theme, synthese, notes, contexte, verdict, conclusion, sources, cout = null }) {
  const [op, eff, reb, prep, ali] = notes;
  const total = op + eff + reb + prep + ali;
  const criteres = [
    ["operationnalite_moyens", "Opérationnalité & Moyens", op, 30],
    ["efficacite", "Efficacité", eff, 30],
    ["effets_rebonds_externalites", "Effets rebonds & Externalités", reb, 20],
    ["degre_preparation", "Degré de préparation", prep, 10],
    ["alignement_logique", "Alignement & Logique globale", ali, 10],
  ];
  return {
    _note: "FICHE DE TEST (charte RS, démonstration locale) : pas une analyse publiée, textes et chiffres fabriqués pour tester le rendu.",
    titre_fiche: titre,
    theme,
    fiche_complete: {
      mesure_reformulee: { synthese, texte: synthese },
      contexte_national: { synthese: contexte, texte: contexte },
      analyse_par_criteres: criteres.map(([critere, t, note, note_max]) => ({ critere, titre: t, note, note_max, texte: `${t} : ${note} sur ${note_max}.` })),
      notation_detaillee: { operationnalite_moyens_total: op, efficacite: eff, effets_rebonds_externalites: reb, degre_preparation: prep, alignement_logique: ali, score_total: total },
      verdict_final: verdict,
      verdict_conclusion: conclusion,
      ...(cout ? { cout_estime: cout } : {}),
      sources_utilisees: sources,
    },
  };
}

const fiches = {
  "riner-retraites": fiche({
    titre: "Retraites : garder la répartition, ajouter une part de capitalisation",
    theme: "retraites",
    synthese: "Garder la retraite par répartition, mieux tenir compte de la pénibilité et ne pas exclure une part de capitalisation.",
    notes: [21, 15, 13, 1, 6],
    contexte:
      "Selon le Conseil d'orientation des retraites (rapport annuel 2026), le système serait en déficit de 6,8 milliards d'euros en 2030 à règles inchangées. Les retraites représentent 14 % du PIB. Il y avait 2,5 personnes de 20 à 64 ans pour une personne de 65 ans ou plus en 2025, et environ 1,6 en 2070. Aux Pays-Bas, la capitalisation s'ajoute à la répartition par des régimes collectifs complémentaires financés par des cotisations en plus. Le Chili a détourné en 1981 des cotisations vers la capitalisation : la transition a creusé un déficit public d'environ 3,25 % du PIB par an (OCDE, présentation au Conseil d'orientation des retraites, novembre 2025). La capitalisation ne rapporterait qu'au bout de 30 à 40 ans ; à court terme (0 à 2 ans), le trou de 6,8 milliards resterait entier.",
    verdict: "La direction est raisonnable, mais sans levier chiffré, le plan ne comble pas le déficit attendu dès 2030. Une part de capitalisation, possible, n'est pas financée.",
    conclusion: "Une part des retraites en Bourse : possible, pas financé.",
    sources: ["Conseil d'orientation des retraites, rapport annuel 2026", "OCDE, présentation au Conseil d'orientation des retraites, novembre 2025"],
    cout: "non chiffré par le candidat",
  }),
  "riner-sante": fiche({
    titre: "Santé : 4 000 médecins de plus dans les déserts médicaux",
    theme: "sante",
    synthese: "Envoyer 4 000 jeunes médecins de plus dans les déserts médicaux d'ici 2030, avec une prime de 1 500 euros par mois.",
    notes: [24, 21, 14, 6, 7],
    contexte: "Environ 6 millions de Français n'ont pas de médecin traitant (Assurance maladie, 2025). Une prime de 1 500 euros par mois pour 4 000 médecins coûterait environ 72 millions d'euros par an.",
    verdict: "La mesure est finançable et ciblée ; elle dépend du nombre de médecins formés d'ici 2030.",
    conclusion: "Des médecins en plus là où il en manque : finançable, mais lent.",
    sources: ["Assurance maladie, 2025"],
    cout: "environ 72 millions d'euros par an",
  }),
  "riner-logement": fiche({
    titre: "Logement : 500 000 logements sociaux en 5 ans",
    theme: "logement",
    synthese: "Construire 500 000 logements sociaux en 5 ans, soit 100 000 par an.",
    notes: [12, 13, 9, 3, 4],
    contexte: "Environ 2,7 millions de ménages attendent un logement social (USH, 2025). Il s'en est construit environ 82 000 en 2024. Le coût public est estimé à 9 milliards d'euros par an.",
    verdict: "L'objectif est très au-dessus du rythme actuel, sans financement ni foncier identifiés.",
    conclusion: "100 000 logements sociaux par an : un rythme jamais tenu.",
    sources: ["Union sociale pour l'habitat, 2025"],
    cout: "environ 9 milliards d'euros par an",
  }),
  "riner-ecole": fiche({
    titre: "École : 2 heures de sport en plus par semaine au collège",
    theme: "education",
    synthese: "Ajouter 2 heures de sport par semaine au collège, encadrées par des éducateurs sportifs.",
    notes: [19, 18, 12, 6, 8],
    contexte: "Les collégiens ont 4 heures d'EPS par semaine en 6e et 3 heures ensuite. Il faudrait environ 10 000 éducateurs, pour un coût d'environ 400 millions d'euros par an.",
    verdict: "Mesure faisable et cohérente, mais l'emploi du temps des collégiens est déjà chargé.",
    conclusion: "Plus de sport au collège : faisable, si l'emploi du temps suit.",
    sources: ["Ministère de l'Éducation nationale, 2025"],
    cout: "environ 400 millions d'euros par an",
  }),
  "riner-climat": fiche({
    titre: "Climat : interdire les vols intérieurs de moins de 4 heures",
    theme: "energie-climat",
    synthese: "Interdire les vols intérieurs quand un train fait le trajet en moins de 4 heures.",
    notes: [9, 8, 6, 3, 4],
    contexte: "La loi Climat de 2021 interdit déjà les vols quand le train met moins de 2 h 30 ; 3 lignes seulement ont été supprimées. Les vols intérieurs pèsent environ 1 % des émissions de CO2 de la France.",
    verdict: "Le gain climatique serait faible, et le droit européen limite ces interdictions.",
    conclusion: "Moins de vols intérieurs : un gain faible, juridiquement fragile.",
    sources: ["Loi Climat et résilience, 2021", "Citepa, 2025"],
  }),
  "riner-emploi": fiche({
    titre: "Emploi : un service civique sportif pour 50 000 jeunes",
    theme: "emploi",
    synthese: "Créer un service civique sportif de 8 mois pour 50 000 jeunes sans emploi ni formation.",
    notes: [16, 13, 10, 4, 5],
    contexte: "Environ 1,4 million de jeunes de 15 à 29 ans ne sont ni en emploi, ni en études, ni en formation (Insee, 2024). Le service civique accueille déjà environ 80 000 jeunes par an. Coût estimé : 350 millions d'euros par an.",
    verdict: "Un dispositif existant à élargir ; l'effet sur l'emploi reste incertain.",
    conclusion: "Un service civique sportif : utile, effet sur l'emploi incertain.",
    sources: ["Insee, 2024", "Agence du service civique, 2025"],
    cout: "environ 350 millions d'euros par an",
  }),
};

for (const [nom, f] of Object.entries(fiches)) {
  writeFileSync(`${DOSSIER}/fiche-test-${nom}.json`, `${JSON.stringify(f, null, 2)}\n`);
  console.log(nom, f.fiche_complete.notation_detaillee.score_total);
}
