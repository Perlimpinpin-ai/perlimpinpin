import { test } from "node:test";
import assert from "node:assert/strict";
import { normaliser, motsCles, creerMoteur, motsDuCorps } from "../src/lib/recherche.js";

// Propositions fictives, inspirées des analyses réelles (data/analyses).
const DOCS = [
  { id: 1, candidat: "David Lisnard", theme: "Énergie & Climat", titre: "Suspendre les CEE pour faire baisser le prix du carburant", resume: "Pourrait faire baisser le prix à court terme, mais pose la question du financement de la rénovation énergétique.", texte: "David Lisnard propose de suspendre provisoirement les certificats d'économies d'énergie (CEE)." },
  { id: 2, candidat: "Jean-Luc Mélenchon", theme: "Retraites", titre: "Retour de la retraite à 60 ans", resume: "Abroger la réforme de 2023 et revenir à un départ à 60 ans.", texte: "Jean-Luc Mélenchon propose d'abroger la réforme des retraites de 2023 qui a porté l'âge légal à 64 ans et de rétablir le départ à taux plein dès 60 ans pour 40 annuités." },
  { id: 3, candidat: "Raphaël Glucksmann", theme: "Retraites", titre: "Abroger la réforme des retraites de 2023", resume: "Une nouvelle réforme fondée sur la pénibilité.", texte: "Raphaël Glucksmann propose d'abroger la réforme des retraites de 2023 (âge légal 64 ans) sans revenir simplement à l'état antérieur." },
  { id: 4, candidat: "Éric Zemmour", theme: "Retraites", titre: "Introduire la capitalisation dans les retraites", resume: "Une transition longue et coûteuse.", texte: "Éric Zemmour veut faire entrer peu à peu la capitalisation dans les retraites." },
  { id: 5, candidat: "Jean-Luc Mélenchon", theme: "Pouvoir d'achat", titre: "Bloquer les prix des produits de première nécessité", resume: "Geler par décret les prix de l'électricité et des produits essentiels.", texte: "Geler par décret les prix du gazole, de l'électricité et des produits de première nécessité, porter le SMIC net à 1 600 euros." },
  { id: 6, candidat: "Marine Tondelier", theme: "Logement", titre: "Généraliser l'encadrement des loyers", resume: "Étendre le dispositif à toutes les zones tendues.", texte: "Généraliser et pérenniser l'encadrement des loyers à toutes les zones tendues." },
  { id: 7, candidat: "Bruno Retailleau", theme: "Logement", titre: "Supprimer l'encadrement des loyers", resume: "Laisser le dispositif s'éteindre pour relancer l'offre.", texte: "Supprimer l'encadrement des loyers en laissant le dispositif expérimental s'éteindre en novembre 2026." },
  { id: 8, candidat: "Marine Le Pen", theme: "Logement", titre: "Abroger la loi SRU", resume: "Supprimer l'obligation de 20 à 25 % de logements sociaux.", texte: "Abroger la loi SRU qui impose aux communes un quota de logements sociaux." },
  { id: 9, candidat: "Bruno Retailleau", theme: "Immigration", titre: "Transformer l'AME en aide médicale d'urgence", resume: "Réduire l'immigration et limiter l'AME aux soins urgents.", texte: "Réduire l'immigration légale et illégale en durcissant les conditions de séjour." },
  { id: 10, candidat: "Marine Tondelier", theme: "Emploi & Salaires", titre: "Porter le SMIC à 2 000 euros brut", resume: "Une hausse d'environ 7 % au-delà de l'indexation.", texte: "Porter le SMIC à 2 000 € brut dès 2027." },
  { id: 11, candidat: "Édouard Philippe", theme: "Éducation Nationale", titre: "Augmenter de 20 % le salaire des enseignants", resume: "Moins de recrutements pour financer la hausse.", texte: "Recruter un peu moins de professeurs pour financer une hausse de 20 % du salaire moyen des enseignants." },
  { id: 12, candidat: "Marine Le Pen", theme: "Santé", titre: "Geler les taxes sur le tabac", resume: "Supprimer l'indexation du prix sur l'inflation.", texte: "Geler les taxes sur le tabac et supprimer l'indexation annuelle." },
];

const moteur = creerMoteur(DOCS);
const ids = (requete, limite) => moteur.rechercher(requete, limite).map((doc) => doc.id);

test("normaliser retire accents, majuscules et ponctuation", () => {
  assert.equal(normaliser("Énergie & Climat"), "energie climat");
  assert.equal(normaliser("RETRAÎTE"), "retraite");
});

test("motsCles ignore les petits mots et les pluriels simples", () => {
  assert.deepEqual(motsCles("Prix du carburant"), ["prix", "carburant"]);
  assert.deepEqual(motsCles("les retraites"), ["retraite"]);
  assert.deepEqual(motsCles("   "), []);
});

test("4 résultats maximum, classés par pertinence", () => {
  assert.ok(ids("retraite").length <= 4);
  assert.deepEqual(ids("retraite").slice(0, 3).sort(), [2, 3, 4]);
});

test("« retraite 64 » remonte les mesures sur l'âge de départ", () => {
  const [premier, second] = ids("retraite 64");
  assert.deepEqual([premier, second].sort(), [2, 3]);
});

test("accents et majuscules : retraîte, RETRAITE", () => {
  assert.deepEqual(ids("retraîte"), ids("retraite"));
  assert.deepEqual(ids("RETRAITE"), ids("retraite"));
});

test("fautes de frappe : carburent, retrite, loyé", () => {
  assert.equal(ids("carburent")[0], 1);
  assert.ok([2, 3, 4].includes(ids("retrite")[0]));
  assert.ok([6, 7].includes(ids("loyers")[0]));
});

test("synonymes : essence -> carburant / gazole", () => {
  const resultat = ids("essence");
  assert.ok(resultat.includes(1));
  assert.ok(resultat.includes(5));
});

test("« prix carburant » trouve la mesure même sans tous les mots", () => {
  assert.equal(ids("prix carburant")[0], 1);
});

test("recherche par candidat et pendant la frappe (début de mot)", () => {
  assert.ok(ids("melenchon").every((id) => [2, 5].includes(id)));
  assert.equal(ids("tondel").length, 2);
  assert.equal(ids("encadr")[0] === 6 || ids("encadr")[0] === 7, true);
});

test("raccourci thème ou candidat en tête des suggestions", () => {
  assert.deepEqual(moteur.raccourci("immigration"), { type: "theme", libelle: "Immigration" });
  assert.deepEqual(moteur.raccourci("melenchon"), { type: "candidat", libelle: "Jean-Luc Mélenchon" });
  assert.equal(moteur.raccourci("retraite 64"), null);
  const { raccourci, propositions } = moteur.suggestions("logement");
  assert.equal(raccourci.libelle, "Logement");
  assert.ok(propositions.length <= 3);
});

test("rien d'absurde pour une requête vide ou sans rapport", () => {
  assert.deepEqual(ids(""), []);
  assert.deepEqual(ids("de la"), []);
  assert.deepEqual(ids("xylophone"), []);
});

test("texte complet (corps) : un mot absent du titre et du résumé trouve l'analyse", () => {
  const docs = [
    ...DOCS,
    {
      id: 13, candidat: "Bruno Retailleau", theme: "Sécurité & Justice",
      titre: "Rétablir les peines planchers", resume: "Une réponse pénale plus systématique.",
      texte: "Instaurer des peines minimales pour les récidivistes.",
      corps: motsDuCorps("Le parc pénitentiaire compte déjà 80 000 détenus : la mesure accroîtrait la surpopulation des prisons."),
    },
  ];
  const plein = creerMoteur(docs);
  assert.deepEqual(plein.rechercher("prison").map((doc) => doc.id), [13]);
  assert.deepEqual(plein.rechercher("surpopulation carcerale").map((doc) => doc.id), [13]);
});

test("texte complet : passe après une mesure dont c'est le sujet", () => {
  const docs = [
    { ...DOCS[0], corps: "" },
    { ...DOCS[8], corps: motsDuCorps("Effet indirect possible sur le prix du carburant pour les ménages.") },
  ];
  assert.deepEqual(creerMoteur(docs).rechercher("carburant").map((doc) => doc.id)[0], 1);
});

test("motsDuCorps : sans doublons, sans nombres seuls ni petits mots", () => {
  assert.equal(motsDuCorps("Les prisons, la prison, 80 000 détenus"), "prison detenu");
});
