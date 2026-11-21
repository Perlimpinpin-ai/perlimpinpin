import { test } from "node:test";
import assert from "node:assert/strict";
import { assemblerTweetRecit, contenuAvecRecit, controlerRecit, QUESTIONS_COUVERTURE } from "../src/lib/recit.js";
import {
  construireMessageRecit,
  estimationCoutRecit,
  fichePourRecit,
  genererRecitCore,
  requeteRecit,
} from "../src/lib/recit-generation.js";
import { carrouselRecit, nomArchiveRecit } from "../src/lib/carrousel-recit.js";
import { valeursReseaux } from "../src/lib/reseaux.js";
import { getScoreBadge } from "../src/lib/score.js";
import { contraste, couleurCandidat, couleursProches, texteSur, themeCandidat } from "../src/lib/couleurs-candidats.js";
import { controlerCarrousel } from "../src/lib/carrousel.js";

const FICHE = {
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
const carte = (titre, texte, pastille) => ({ titre, texte, pastille });

function reponse(modifs = {}) {
  return {
    couverture: { mesure: "un Smic à 2 200 euros brut", chiffre_cle: "2 200 euros", question: "Est-ce tenable ?" },
    concretement: {
      titre: "Concrètement, qu'est-ce qui est proposé ?",
      texte: "Aujourd'hui, le Smic brut est de 1 830 euros. {NOM} veut le porter à 2 200 euros.",
      tuiles: {
        aujourdhui: { valeur: "1 830 €", detail: "brut par mois" },
        propose: { valeur: "2 200 €", detail: "brut par mois" },
        ecart: { valeur: "+20 %", detail: "de hausse" },
        concernes: { valeur: "3 millions", detail: "de salariés" },
      },
      sources: "Ministère du Travail",
    },
    note: {
      titre: "Facile à décider, beaucoup plus dur à financer.",
      explication: "Le coût pour les entreprises n'est pas évalué.",
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
      cartes: [carte("Pour les salariés", "Le salaire brut augmente.", "positif"), carte("Pour les entreprises", "Le coût monte.", "négatif")],
    },
    long_terme: { titre: "Le vrai débat porte sur l'emploi.", cartes: [carte("L'emploi peu qualifié", "Les plus exposés.", "débattu")] },
    ailleurs: {
      titre: "En Europe, une hausse comparable.",
      precedents: [{ pays: "Espagne", annee: "2019", fait: "Le salaire minimum passe de 736 à 900 euros.", resultat: "L'emploi a moins progressé.", pastille: "débattu" }],
      sources: "Banque d'Espagne",
    },
    tient: { tient: ["Le gain brut est réel."], coince: ["Le coût pour les PME n'est pas chiffré."] },
    legende_accroche: "Ce que changerait vraiment un Smic à 2 200 euros brut.",
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

const CONTEXTE = {
  ficheFinale: FICHE,
  candidatNom: "Fabien Roussel",
  valeurs: valeursReseaux({ candidatNom: "Fabien Roussel", score: 51, propositionId: 42 }),
};

test("réponse conforme : acceptée, tweet assemblé avec ligne de note et lien du code", () => {
  const { valide, erreurs, avertissements, recit } = controlerRecit(reponse(), CONTEXTE);
  assert.deepEqual(erreurs, []);
  assert.ok(valide, avertissements.join("\n"));
  assert.match(recit.tweet_assemble, /\n\nNote : \{PASTILLE\} \{SCORE\}\/100 \{APPRECIATION\}\n\n/);
  assert.match(recit.tweet_assemble, /Analyse complète 👇 \{LIEN\}$/);
  assert.equal(recit.ailleurs.precedents[0].pays, "Espagne");
});

test("refus : JSON invalide ou champ manquant", () => {
  assert.equal(controlerRecit(null, CONTEXTE).valide, false);
  assert.match(controlerRecit("texte", CONTEXTE).erreurs[0], /JSON invalide/);
  const sansTuile = reponse();
  delete sansTuile.concretement.tuiles.ecart;
  assert.match(controlerRecit(sansTuile, CONTEXTE).erreurs[0], /concretement\.tuiles\.ecart\.valeur/);
  const sansCritere = reponse();
  delete sansCritere.note.criteres.efficacite;
  assert.match(controlerRecit(sansCritere, CONTEXTE).erreurs[0], /note\.criteres\.efficacite/);
});

test("refus : nombre absent de la fiche", () => {
  const r = reponse();
  r.court_terme.cartes[0].texte = "Le salaire monte de 333 euros.";
  const { valide, erreurs } = controlerRecit(r, CONTEXTE);
  assert.equal(valide, false);
  assert.match(erreurs.join(" "), /absent\(s\) de la fiche : 333/);
});

test("refus : tiret cadratin", () => {
  const r = reponse();
  r.tient.tient = ["Le gain—réel."];
  assert.match(controlerRecit(r, CONTEXTE).erreurs.join(" "), /tiret cadratin/);
});

test("refus : score ou niveau écrit par le modèle", () => {
  const avecScore = reponse();
  avecScore.note.titre = "Une mesure notée 51/100.";
  assert.match(controlerRecit(avecScore, CONTEXTE).erreurs.join(" "), /score ou pastille/);
  const avecNiveau = reponse();
  avecNiveau.note.explication = "Une mesure plausible sous condition.";
  assert.match(controlerRecit(avecNiveau, CONTEXTE).erreurs.join(" "), /niveau « Plausible sous condition »/);
});

test("refus : pays ou année d'un précédent absents de la fiche", () => {
  const pays = reponse();
  pays.ailleurs.precedents[0].pays = "Allemagne";
  assert.match(controlerRecit(pays, CONTEXTE).erreurs.join(" "), /pays « Allemagne » absent de la fiche/);
  const annee = reponse();
  annee.ailleurs.precedents[0].annee = "2022";
  assert.equal(controlerRecit(annee, CONTEXTE).valide, false);
});

test("avertissements seulement : question hors liste, chiffre clé absent de la mesure, carte trop longue, pastille inconnue, plus de 3 cartes", () => {
  const r = reponse();
  r.couverture.question = "Vraiment ?";
  r.couverture.chiffre_cle = "2 200 €";
  r.court_terme.cartes = [
    carte("A", Array.from({ length: 40 }, () => "mot").join(" "), "positif"),
    carte("B", "b", "joyeux"),
    carte("C", "c", "positif"),
    carte("D", "d", "positif"),
  ];
  const { valide, avertissements, recit } = controlerRecit(r, CONTEXTE);
  assert.ok(valide);
  const texte = avertissements.join("\n");
  assert.match(texte, /question « Vraiment \? » hors liste/);
  assert.equal(recit.couverture.question, QUESTIONS_COUVERTURE[0]);
  assert.match(texte, /chiffre clé « 2 200 € » n’apparaît pas/);
  assert.match(texte, /40 mots \(35 au plus\)/);
  assert.match(texte, /pastille « joyeux » hors liste/);
  assert.equal(recit.court_terme.cartes.length, 3);
  assert.equal(recit.court_terme.cartes[1].pastille, "incertain");
});

test("stockage : seule reseaux_recit change, l'ancien gardé sous precedent", () => {
  const contenu = { verdict_final: "x", reseaux: { a: 1 }, reseaux_recit: { couverture: "ancien", precedent: { couverture: "très ancien" } } };
  const apres = contenuAvecRecit(contenu, { couverture: "nouveau" });
  assert.deepEqual(Object.keys(apres).sort(), ["reseaux", "reseaux_recit", "verdict_final"]);
  assert.equal(apres.reseaux, contenu.reseaux);
  assert.deepEqual(apres.reseaux_recit.precedent, { couverture: "ancien" });
});

test("message : prompt puis fiche, sans les ajouts des étapes suivantes", () => {
  const message = construireMessageRecit("PROMPT", { ...FICHE, reseaux_recit: { x: 1 }, version_basique: { resume: "r" } });
  assert.match(message, /^PROMPT\n\nFICHE FINALE :\n/);
  assert.ok(!message.includes("version_basique"));
  assert.ok(!message.includes("reseaux_recit"));
  assert.deepEqual(Object.keys(fichePourRecit({ a: 1, reseaux: 2, reel: 3 })), ["a"]);
});

test("requête : mêmes réglages que l'étape 3 ter (Sonnet, sans outil ni réflexion)", () => {
  const corps = requeteRecit("m");
  assert.equal(corps.model, "claude-sonnet-5");
  assert.equal(corps.tools, undefined);
  assert.deepEqual(corps.thinking, { type: "disabled" });
});

test("coût estimé d'une fiche type (~40 000 caractères) : autour de 0,05 $", () => {
  const { min, max } = estimationCoutRecit(40_000);
  assert.ok(min > 0.02 && min < 0.06, `min ${min}`);
  assert.ok(max > min);
});

test("génération : second essai après un refus, coût additionné, sans appel réel", async () => {
  const messages = [];
  const refusee = reponse();
  refusee.note.titre = "Noté 51/100.";
  const reponses = [refusee, reponse()];
  const resultat = await genererRecitCore({
    ficheFinale: FICHE,
    candidatNom: "Fabien Roussel",
    score: 51,
    prompt: "PROMPT",
    appeler: async (message) => {
      messages.push(message);
      return { donnees: reponses[messages.length - 1], usage: { input_tokens: 10_000, output_tokens: 1_000 } };
    },
    analyser: (r) => r.donnees,
    journal: { error() {}, warn() {} },
  });
  assert.equal(messages.length, 2);
  assert.match(messages[1], /ta réponse précédente a été refusée/);
  assert.ok(resultat.recit);
  assert.equal(resultat.cout, 0.06);
  assert.equal(resultat.recit.modele, "claude-sonnet-5");
});

test("génération : échec après deux refus, rien à enregistrer", async () => {
  const resultat = await genererRecitCore({
    ficheFinale: FICHE,
    candidatNom: "Fabien Roussel",
    score: 51,
    prompt: "P",
    appeler: async () => ({ texte: "pas du JSON", usage: {} }),
    analyser: () => {
      throw new Error("Réponse de Claude illisible (JSON invalide).");
    },
    journal: { error() {}, warn() {} },
  });
  assert.equal(resultat.recit, null);
  assert.match(resultat.errors[0], /JSON invalide/);
});

function donneesRecit(modifs = {}) {
  const { recit } = controlerRecit(reponse(), CONTEXTE);
  return {
    propositionId: 42,
    analyseId: 7,
    titre: "Smic à 2 200 euros brut",
    candidatNom: "Fabien Roussel",
    photoUrl: "/photos/fabien-roussel.jpg",
    theme: "economie",
    score: 51,
    contenu: { ...FICHE, reseaux_recit: recit },
    handlesInstagram: {},
    ...modifs,
  };
}

test("carrousel récit : 8 slides, note, critères et fin par le code, légende et tweet remplis", () => {
  const { slides, legende, tweet, sujet } = carrouselRecit(donneesRecit());
  assert.equal(slides.length, 8);
  assert.deepEqual(
    slides.map((s) => s.type),
    ["couverture", "concretement", "noteRecit", "effetsCourt", "effetsLong", "ailleurs", "tientCoince", "fin"],
  );
  assert.equal(sujet, "Smic");
  assert.equal(slides[0].intro, "Fabien Roussel veut");
  assert.equal(slides[0].sousTitre, "Notre analyse en 8 slides");
  assert.equal(slides[0].fichier, "01-couverture.png");
  assert.equal(slides[7].fichier, "08-fin.png");
  assert.equal(slides[1].texte, "Aujourd'hui, le Smic brut est de 1 830 euros. Fabien Roussel veut le porter à 2 200 euros.");
  // Note : niveau et notes des 5 critères du barème, avec leurs vrais maxima.
  assert.equal(slides[2].palier, getScoreBadge(51).label);
  assert.deepEqual(slides[2].criteres.map((c) => `${c.note}/${c.max}`), ["18/30", "12/30", "9/20", "4/10", "8/10"]);
  assert.equal(slides[2].criteres[0].ligne, "Un décret suffit.");
  assert.equal(slides[6].condition, "Étaler la hausse");
  assert.deepEqual(slides[7].sources, ["Ministère du Travail, montants du Smic 2026", "Insee, salaires", "OCDE, Smic rapporté au salaire médian"]);
  assert.match(legende, /^🟡 Smic à 2 200 euros brut : Ce que changerait vraiment/);
  assert.match(tweet, /@Fabien_Roussel veut porter le Smic/);
  assert.match(tweet, /Note : 🟡 51\/100 Plausible sous condition/);
});

test("carrousel récit sans précédent étranger : 7 slides, avertissement", () => {
  const { recit } = controlerRecit(reponse({ ailleurs: null }), CONTEXTE);
  const { slides, avertissements } = carrouselRecit(donneesRecit({ contenu: { ...FICHE, reseaux_recit: recit } }));
  assert.equal(slides.length, 7);
  assert.ok(!slides.some((s) => s.type === "ailleurs"));
  assert.equal(slides[0].sousTitre, "Notre analyse en 7 slides");
  assert.deepEqual(slides.map((s) => `${s.numero}/${s.total}`), ["1/7", "2/7", "3/7", "4/7", "5/7", "6/7", "7/7"]);
  assert.ok(avertissements.some((a) => /Slide sautée : la fiche ne cite aucun précédent/.test(a.message)));
});

test("pas de récit : null ; archive récit", () => {
  assert.equal(carrouselRecit(donneesRecit({ contenu: FICHE })), null);
  assert.equal(nomArchiveRecit({ propositionId: 42, candidatNom: "Fabien Roussel" }), "carrousel-recit-42-fabien-roussel.zip");
});

test("assemblerTweetRecit : ordre fixe", () => {
  const t = assemblerTweetRecit({ accroche: "A", promesse: "P", exemple: "E", hic: "H", tient: "T", appel: "Q" });
  assert.equal(t, "A\n\nP\n\nE\n\nH\n\nT\n\nNote : {PASTILLE} {SCORE}/100 {APPRECIATION}\n\nQ\n\nAnalyse complète 👇 {LIEN}");
});

// --- Couleurs des candidats -----------------------------------------------------

test("couleur du candidat : table, texte lisible calculé, proximité avec le palier", () => {
  const table = { "Édouard Philippe": "#1D4ED8", "Fabien Roussel": "#fde047", X: "rouge" };
  assert.equal(couleurCandidat("Edouard Philippe", table), "#1d4ed8");
  assert.equal(couleurCandidat("X", table), null);
  assert.equal(couleurCandidat("Inconnu", table), null);
  assert.equal(texteSur("#1d4ed8"), "#ffffff");
  assert.equal(texteSur("#fde047"), "#18181b");
  assert.ok(contraste("#ffffff", "#000000") > 20);
  assert.ok(couleursProches("#d92d20", "#dc2626"));
  assert.ok(!couleursProches("#1d4ed8", "#d92d20"));
});

test("thème : note neutre si la couleur du candidat est proche de celle du palier", () => {
  const table = { A: "#dc2626" };
  // 10/100 : palier rouge (#d92d20) → proche.
  assert.equal(themeCandidat({ candidatNom: "A", score: 10, table }).noteNeutre, true);
  // 70/100 : palier vert → distinct.
  assert.equal(themeCandidat({ candidatNom: "A", score: 70, table }).noteNeutre, false);
  assert.equal(themeCandidat({ candidatNom: "B", score: 70, table }), null);
});

test("carrousel 6 slides : couleur absente → style neutre et avertissement ; présente → thème", () => {
  const base = {
    propositionId: 1, analyseId: 1, titre: "T", candidatNom: "Fabien Roussel", theme: "economie", score: 41,
    contenu: {}, mesureInitiale: "Une mesure.", handlesInstagram: {},
  };
  const sans = controlerCarrousel({ ...base, couleursCandidats: {} });
  assert.equal(sans.couleur, null);
  assert.ok(sans.avertissements.some((a) => a.cle === "couleur"));
  const avec = controlerCarrousel({ ...base, couleursCandidats: { "Fabien Roussel": "#1d4ed8" } });
  assert.equal(avec.couleur.couleur, "#1d4ed8");
  assert.equal(avec.couleur.texte, "#ffffff");
  assert.notEqual(avec.version, sans.version);
  assert.ok(!avec.avertissements.some((a) => a.cle === "couleur"));
});

// --- Bouton « Générer le récit » (base et appel simulés) ---------------------------

import { estimerRecitCore, genererRecitPourFicheCore } from "../src/lib/recit-action-core.js";

function fausseBase(contenu, { modifiee = false } = {}) {
  const ecritures = [];
  return {
    ecritures,
    proposition: {
      findUnique: async () => ({
        id: 42,
        candidat: { nom: "Fabien Roussel" },
        analyses: [{ id: 7, statut: "publie", scoreFaisabilite: 51, updatedAt: new Date(0), contenuComplet: contenu }],
      }),
    },
    analyse: {
      updateMany: async (requete) => {
        ecritures.push(requete);
        return { count: modifiee ? 0 : 1 };
      },
    },
  };
}

test("action : mode édition exigé, aucune lecture ni appel sinon", async () => {
  const r = await genererRecitPourFicheCore(42, { isEditor: async () => false, prisma: null, generer: () => assert.fail() });
  assert.equal(r.ok, false);
  assert.match(r.erreur, /Mode édition/);
});

test("action : simulation (TEST_DRY_RUN) sans appel ni écriture", async () => {
  const db = fausseBase(FICHE);
  const r = await genererRecitPourFicheCore(42, { isEditor: async () => true, prisma: db, dryRun: true, generer: () => assert.fail() });
  assert.ok(r.simulation);
  assert.equal(db.ecritures.length, 0);
});

test("action : sauvegarde puis écriture de la seule clé reseaux_recit, coût renvoyé", async () => {
  const db = fausseBase(FICHE);
  const etapes = [];
  const r = await genererRecitPourFicheCore(42, {
    isEditor: async () => true,
    prisma: db,
    cleConfiguree: true,
    sauvegarder: async () => {
      etapes.push("sauvegarde");
      return "logs/sauvegardes/x.json";
    },
    generer: async () => {
      etapes.push("generation");
      return { recit: { accroche: "a" }, cout: 0.041, avertissements: ["x"] };
    },
  });
  assert.ok(r.ok);
  assert.equal(r.cout, 0.041);
  assert.equal(r.sauvegarde, "logs/sauvegardes/x.json");
  assert.deepEqual(etapes, ["generation", "sauvegarde"]);
  const { data, where } = db.ecritures[0];
  assert.deepEqual(where, { id: 7, updatedAt: new Date(0) });
  assert.deepEqual(Object.keys(data.contenuComplet).sort(), [...Object.keys(FICHE), "reseaux_recit"].sort());
  assert.equal(data.contenuComplet.reseaux, FICHE.reseaux);
});

test("action : sauvegarde impossible (serveur sans disque) signalée, écriture quand même", async () => {
  const db = fausseBase(FICHE);
  const r = await genererRecitPourFicheCore(42, {
    isEditor: async () => true,
    prisma: db,
    cleConfiguree: true,
    sauvegarder: async () => {
      throw new Error("EROFS");
    },
    generer: async () => ({ recit: { accroche: "a" }, cout: 0.04 }),
  });
  assert.ok(r.ok);
  assert.equal(r.sauvegarde, null);
});

test("action : fiche modifiée pendant la génération, rien d'écrit ; refus du modèle, coût affiché", async () => {
  const modifiee = await genererRecitPourFicheCore(42, {
    isEditor: async () => true,
    prisma: fausseBase(FICHE, { modifiee: true }),
    cleConfiguree: true,
    sauvegarder: async () => null,
    generer: async () => ({ recit: { accroche: "a" }, cout: 0.04 }),
  });
  assert.equal(modifiee.ok, false);
  assert.match(modifiee.erreur, /modifiée pendant la génération/);
  const refuse = await genererRecitPourFicheCore(42, {
    isEditor: async () => true,
    prisma: fausseBase(FICHE),
    cleConfiguree: true,
    sauvegarder: async () => null,
    generer: async () => ({ recit: null, cout: 0.08, errors: ["Nombre(s) absent(s) de la fiche : 12."] }),
  });
  assert.equal(refuse.ok, false);
  assert.equal(refuse.cout, 0.08);
});

test("action : estimation du coût sans appel", async () => {
  const r = await estimerRecitCore(42, { isEditor: async () => true, prisma: fausseBase(FICHE), lirePrompt: async () => "PROMPT" });
  assert.ok(r.ok);
  assert.ok(r.min > 0 && r.max > r.min);
  assert.equal(r.aDejaUnRecit, false);
});
