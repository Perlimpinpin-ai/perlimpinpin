import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assemblerTweetRecit,
  cibleValide,
  consigneRemarques,
  contenuAvecRecit,
  contenuAvecRetour,
  contenuRevenuAuPrecedent,
  controlerRecit,
  COULEURS_PASTILLES,
  entreeRetour,
  fusionnerRecit,
  PASTILLES,
  QUESTIONS_COUVERTURE,
  valeurCourte,
} from "../src/lib/recit.js";
import { morceauxGras, motsGras, nombreGras, sansGras } from "../src/lib/texte-gras.js";
import { aleaFiche, choisirIllustration, creditLegende, creditVisible, motsClesDisponibles, themesBibliotheque } from "../src/lib/illustrations.js";
import { candidatesDepuisPexels, candidatesSimulees, entreesBibliotheque, reecrireListe, REPERE_DEBUT, REPERE_FIN } from "./lib/illustrations-pexels.js";
import { libelleCible, listeRetours, remarquesFrequentes } from "../src/lib/retours-recit.js";
import {
  construireMessageRecit,
  estimationCoutRecit,
  fichePourRecit,
  genererRecitCore,
  requeteRecit,
} from "../src/lib/recit-generation.js";
import { carrouselRecit, ciblesRemarques, nomArchiveRecit, slideDeCible } from "../src/lib/carrousel-recit.js";
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

test("avertissements seulement : question trop longue, mot clé absent, carte trop longue, plus de 3 cartes, trop de gras", () => {
  const r = reponse();
  r.couverture.question = "Est-ce que cette mesure est vraiment tenable ?";
  r.court_terme.cartes = [
    carte("A", Array.from({ length: 40 }, () => "mot").join(" "), "positif"),
    carte("B", "**un** **deux** **trois** **quatre**", "possible"),
    carte("C", "c", "positif"),
    carte("D", "d", "positif"),
  ];
  const { valide, avertissements, recit } = controlerRecit(r, CONTEXTE);
  assert.ok(valide);
  const texte = avertissements.join("\n");
  assert.match(texte, /question « Est-ce que cette mesure est vraiment tenable \? »/);
  assert.equal(recit.couverture.question, QUESTIONS_COUVERTURE[0]);
  assert.equal(recit.couverture.mot_cle, "tenable");
  assert.match(texte, /40 mots \(35 au plus\)/);
  assert.match(texte, /court_terme : 4 passages en gras \(3 au plus par slide\)/);
  assert.equal(recit.court_terme.cartes.length, 3);

  const motAbsent = reponse();
  motAbsent.couverture = { mesure: "un Smic à 2 200 euros brut", question: "Et les PME ?", mot_cle: "entreprises" };
  assert.match(controlerRecit(motAbsent, CONTEXTE).avertissements.join("\n"), /mot clé « entreprises » n’apparaît pas tel quel/);
});

test("couverture : question libre courte et mot clé surligné ; mesure sans point final", () => {
  const r = reponse();
  r.couverture = { mesure: "un Smic à 2 200 euros brut.", question: "Et les PME ?", mot_cle: "PME" };
  const { valide, recit } = controlerRecit(r, CONTEXTE);
  assert.ok(valide);
  assert.equal(recit.couverture.mesure, "un Smic à 2 200 euros brut");
  assert.equal(recit.couverture.question, "Et les PME ?");
  assert.equal(recit.couverture.mot_cle, "PME");
  // Question type sans mot clé : le dernier mot avant « ? ».
  const type = reponse();
  type.couverture = { mesure: "x", question: "Est-ce finançable ?" };
  assert.equal(controlerRecit(type, CONTEXTE).recit.couverture.mot_cle, "finançable");
});

test("refus : pastille hors liste ; liste élargie acceptée avec ses couleurs", () => {
  const r = reponse();
  r.court_terme.cartes[1].pastille = "joyeux";
  assert.match(controlerRecit(r, CONTEXTE).erreurs.join(" "), /pastille « joyeux » hors liste/);
  const orange = reponse();
  orange.long_terme.cartes[0].pastille = "orange";
  assert.equal(controlerRecit(orange, CONTEXTE).valide, false);
  for (const pastille of PASTILLES) {
    const ok = reponse();
    ok.long_terme.cartes[0].pastille = pastille;
    assert.ok(controlerRecit(ok, CONTEXTE).valide, pastille);
  }
  assert.deepEqual([...new Set(Object.values(COULEURS_PASTILLES))].sort(), ["jaune", "rouge", "vert"]);
});

test("refus : mot-clé d'illustration hors de la liste fermée du thème", () => {
  const r = reponse({ illustration_mots_cles: ["caisse", "fusee"] });
  const { valide, erreurs } = controlerRecit(r, { ...CONTEXTE, motsClesIllustration: ["billets", "caisse"] });
  assert.equal(valide, false);
  assert.match(erreurs.join(" "), /mot-clé « fusee » hors de la liste/);
  const ok = controlerRecit(reponse({ illustration_mots_cles: ["Caisse"] }), { ...CONTEXTE, motsClesIllustration: ["billets", "caisse"] });
  assert.ok(ok.valide);
  assert.deepEqual(ok.recit.illustration_mots_cles, ["caisse"]);
  // Relecture d'un récit stocké (liste null) : pas de contrôle.
  assert.ok(controlerRecit(r, CONTEXTE).valide);
});

test("tuiles : format court, la nuance « près de » gardée dans la petite ligne", () => {
  assert.equal(valeurCourte("près de 600 milliards d'euros"), "~600 Md€");
  assert.equal(valeurCourte("488 milliards d’euros"), "488 Md€");
  assert.equal(valeurCourte("3 millions"), "3 M");
  assert.equal(valeurCourte("1 830 euros"), "1 830 €");
  assert.equal(valeurCourte("+20 %"), "+20 %");
  assert.equal(valeurCourte("non chiffré"), "non chiffré");
  const r = reponse();
  r.concretement.tuiles.propose = { valeur: "près de 2 200 euros", detail: "brut par mois" };
  r.concretement.tuiles.aujourdhui = { valeur: "1 830 euros", detail: "brut par mois" };
  const { valide, recit } = controlerRecit(r, CONTEXTE);
  assert.ok(valide);
  assert.deepEqual(recit.concretement.tuiles.propose, { valeur: "~2 200 €", detail: "près de 2 200 euros · brut par mois" });
  assert.deepEqual(recit.concretement.tuiles.aujourdhui, { valeur: "1 830 €", detail: "brut par mois" });
  const longue = reponse();
  longue.concretement.tuiles.concernes = { valeur: "tous les salariés du privé", detail: "" };
  assert.match(controlerRecit(longue, CONTEXTE).avertissements.join("\n"), /trop long pour la tuile/);
});

test("gras : balisage **…** découpé en mots, 3 passages au plus, ponctuation collée", () => {
  assert.deepEqual(morceauxGras("a **b c** d"), [
    { texte: "a ", gras: false },
    { texte: "b c", gras: true },
    { texte: " d", gras: false },
  ]);
  assert.equal(sansGras("le **coût** non **chiffré**"), "le coût non chiffré");
  assert.equal(nombreGras("**a** **b** c"), 2);
  assert.deepEqual(motsGras("x **600 Md€**."), [[{ texte: "x", gras: false }], [{ texte: "600", gras: true }], [{ texte: "Md€", gras: true }, { texte: ".", gras: false }]]);
  assert.deepEqual(
    motsGras("**a** **b** **c** **d**").map((m) => m[0].gras),
    [true, true, true, false],
  );
  assert.deepEqual(morceauxGras("un ** seul"), [{ texte: "un  seul", gras: false }]);
});

test("stockage : seule reseaux_recit change, l'ancien gardé sous precedent", () => {
  const contenu = { verdict_final: "x", reseaux: { a: 1 }, reseaux_recit: { couverture: "ancien", precedent: { couverture: "très ancien" } } };
  const apres = contenuAvecRecit(contenu, { couverture: "nouveau" });
  assert.deepEqual(Object.keys(apres).sort(), ["reseaux", "reseaux_recit", "verdict_final"]);
  assert.equal(apres.reseaux, contenu.reseaux);
  assert.deepEqual(apres.reseaux_recit.precedent, { couverture: "ancien" });
});

test("message : prompt, mots-clés d'illustration, puis fiche, sans les ajouts des étapes suivantes", () => {
  const message = construireMessageRecit("PROMPT", { ...FICHE, reseaux_recit: { x: 1 }, version_basique: { resume: "r" } }, { motsClesIllustration: ["billets", "caisse"] });
  assert.match(message, /^PROMPT\n\nMOTS-CLÉS D'ILLUSTRATION DISPONIBLES POUR CE THÈME : billets, caisse\n\nFICHE FINALE :\n/);
  assert.match(construireMessageRecit("P", FICHE), /DISPONIBLES POUR CE THÈME : \(aucun : mets illustration_mots_cles à \[\]\)/);
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

test("pas de carrousel détaillé : null ; archive carrousel-detaille-<id>-<slug>.zip", () => {
  assert.equal(carrouselRecit(donneesRecit({ contenu: FICHE })), null);
  assert.equal(nomArchiveRecit({ propositionId: 42, candidatNom: "Fabien Roussel" }), "carrousel-detaille-42-fabien-roussel.zip");
});

test("carrousel détaillé : numéro de fiche sur les slides 3 à 7, mot clé, conclusion, slide « À l’étranger »", () => {
  const { slides } = carrouselRecit(donneesRecit());
  assert.deepEqual(slides.map((s) => s.numeroFiche ?? null), [null, null, "#42", "#42", "#42", "#42", "#42", null]);
  assert.equal(slides[0].motCle, "tenable");
  assert.equal(slides[5].libelle, "À l’étranger");
  assert.equal(slides[5].fichier, "06-a-l-etranger.png");
});

// --- Image de thème ---------------------------------------------------------------

const BIBLIO = [
  { fichier: "illustrations/economie/caisse.jpg", theme: "economie", motsCles: ["caisse"], source: "Pexels", auteur: "A", licence: "Licence Pexels", lien: "https://pexels.com/1" },
  { fichier: "illustrations/economie/billets.jpg", theme: "economie", motsCles: ["billets"], source: "Pexels", auteur: "B", licence: "Licence Pexels", lien: "https://pexels.com/2" },
  { fichier: "illustrations/fiscalite/formulaire.jpg", theme: "fiscalite", motsCles: ["formulaire"], source: "Wikimedia", auteur: "C", licence: "CC BY 4.0", lien: "https://w/3" },
  { fichier: "illustrations/retraites/banc.jpg", theme: "retraites", motsCles: ["banc"], source: "Pexels", auteur: "D", licence: "Licence Pexels", lien: "https://pexels.com/4" },
];

test("image de thème : thème de la fiche, mots-clés du modèle, dernière image évitée, thème vide signalé", () => {
  assert.deepEqual(themesBibliotheque("economie"), ["economie", "fiscalite"]);
  assert.deepEqual(motsClesDisponibles("economie", BIBLIO), ["billets", "caisse", "formulaire"]);
  assert.equal(choisirIllustration({ theme: "economie", motsCles: ["billets"], liste: BIBLIO }).illustration.fichier, "illustrations/economie/billets.jpg");
  // Tirage : alea 0 → la première ; en évitant la dernière utilisée.
  assert.equal(choisirIllustration({ theme: "retraites", alea: 0.5, liste: BIBLIO }).illustration.auteur, "D");
  assert.notEqual(choisirIllustration({ theme: "economie", alea: 0, derniere: "illustrations/economie/caisse.jpg", liste: BIBLIO }).illustration.fichier, "illustrations/economie/caisse.jpg");
  const vide = choisirIllustration({ theme: "sante", liste: BIBLIO });
  assert.equal(vide.illustration, null);
  assert.match(vide.avertissement, /Pas d'image de thème pour « sante »/);
  assert.equal(aleaFiche("x"), aleaFiche("x"));
  // Crédit visible seulement si la licence le demande ; toujours dans legende.txt.
  assert.equal(creditVisible(BIBLIO[0]), null);
  assert.equal(creditVisible(BIBLIO[2]), "Photo : C / Wikimedia");
  assert.match(creditLegende(BIBLIO[0]), /^Photo de couverture : A \/ Pexels \(Licence Pexels\)/);
});

test("image de thème : bibliothèque vide → couverture sans illustration et avertissement ; sinon image et crédit dans la légende", () => {
  const vide = carrouselRecit(donneesRecit({ illustrations: [] }));
  assert.equal(vide.slides[0].illustration, null);
  assert.ok(vide.avertissements.some((a) => a.cle === "image de thème" && /bibliothèque est vide/.test(a.message)));
  const plein = carrouselRecit(donneesRecit({ illustrations: BIBLIO }));
  assert.ok(plein.slides[0].illustration.fichier.startsWith("illustrations/"));
  assert.match(plein.legende, /Photo de couverture : /);
  // Carrousel 6 slides : même image (même tirage stable pour la fiche).
  const six = controlerCarrousel({ ...donneesRecit({ illustrations: BIBLIO }), contenu: { ...FICHE, reseaux_recit: undefined } });
  assert.equal(six.slides[0].illustration.fichier, choisirIllustration({ theme: "economie", alea: aleaFiche("illustration-42"), liste: BIBLIO }).illustration.fichier);
});

test("bibliothèque : candidates Pexels (20 au plus, sans doublon), entrées et réécriture de la liste", () => {
  const photo = (id) => ({ id, url: `https://pexels.com/photo/${id}`, photographer: `P${id}`, alt: "", src: { medium: "m", large2x: "l" } });
  const reponses = [{ photos: [photo(1), photo(2), photo(3), photo(4)] }, { photos: [photo(2), photo(5)] }];
  const candidates = candidatesDepuisPexels("economie", reponses);
  assert.deepEqual(candidates.map((c) => c.id), ["pexels-1", "pexels-2", "pexels-5", "pexels-3", "pexels-4"]);
  assert.equal(candidates[0].motCle, "caisse");
  assert.equal(candidatesSimulees("retraites").length, 20);
  const entrees = entreesBibliotheque("economie", [{ ...candidates[0] }, { ...candidates[1], motCle: "Caisse" }, candidatesSimulees("economie")[0]], BIBLIO);
  assert.deepEqual(entrees.map((e) => e.fichier), ["illustrations/economie/caisse-2.jpg", "illustrations/economie/caisse-3.jpg"]);
  const source = `avant\n${REPERE_DEBUT}\nexport const ILLUSTRATIONS = [];\n${REPERE_FIN}\naprès`;
  const reecrit = reecrireListe(source, entrees);
  assert.match(reecrit, /^avant\n\/\/ DEBUT LISTE ILLUSTRATIONS\nexport const ILLUSTRATIONS = \[\n {2}\{"fichier":"illustrations\/economie\/caisse-2\.jpg"/);
  assert.ok(!reecrit.includes("telechargement"));
  assert.match(reecrit, /\/\/ FIN LISTE ILLUSTRATIONS\naprès$/);
});

// --- Remarques et régénération ciblée -------------------------------------------------

test("remarques : seule la slide visée change, le reste est repris tel quel", () => {
  const { recit: precedent } = controlerRecit(reponse(), CONTEXTE);
  const nouveau = { ...reponse(), concretement: { ...reponse().concretement, texte: "Plus court." }, note: { ...reponse().note, titre: "Changé sans qu'on le demande." } };
  const fusion = fusionnerRecit(precedent, nouveau, "concretement");
  assert.equal(fusion.concretement.texte, "Plus court.");
  assert.equal(fusion.note.titre, precedent.note.titre);
  assert.deepEqual(fusion.tweet, precedent.tweet);
  assert.equal(fusionnerRecit(precedent, nouveau, "toutes").note.titre, "Changé sans qu'on le demande.");
  assert.equal(fusionnerRecit(precedent, { ...reponse(), ailleurs: null }, "ailleurs").ailleurs, null);
  const consigne = consigneRemarques({ precedent, remarque: "la slide 2 est trop chargée", cible: "concretement", libelleCible: "la slide 2 (« Concrètement »)" });
  assert.match(consigne, /ne passent JAMAIS avant les règles/);
  assert.match(consigne, /Ne réécris que la slide 2 \(« Concrètement »\) \(clé\(s\) JSON : concretement\)/);
  assert.ok(cibleValide("tweet") && cibleValide("toutes") && !cibleValide("fin"));
});

test("remarques : menu des slides (sans la fin), slide visée selon la présence d'un précédent étranger", () => {
  const { recit } = controlerRecit(reponse(), CONTEXTE);
  assert.deepEqual(ciblesRemarques(recit).map((c) => c.valeur), ["toutes", "couverture", "concretement", "noteRecit", "effetsCourt", "effetsLong", "ailleurs", "tientCoince", "tweet"]);
  assert.deepEqual(slideDeCible(recit, "tientCoince"), { numero: 7, libelle: "Ce qui tient… et ce qui coince" });
  assert.deepEqual(slideDeCible({ ...recit, ailleurs: null }, "tientCoince"), { numero: 6, libelle: "Ce qui tient… et ce qui coince" });
  assert.equal(slideDeCible(recit, "tweet"), null);
});

test("génération avec remarques : mêmes refus (chiffre absent de la fiche), fusion sur la slide visée", async () => {
  const { recit: precedent } = controlerRecit(reponse(), CONTEXTE);
  const messages = [];
  const tentatives = [
    { ...reponse(), concretement: { ...reponse().concretement, texte: "Le Smic passerait à 9 999 euros." } },
    { ...reponse(), concretement: { ...reponse().concretement, texte: "Plus court." }, note: { ...reponse().note, titre: "Autre." } },
  ];
  const resultat = await genererRecitCore({
    ficheFinale: FICHE,
    candidatNom: "Fabien Roussel",
    score: 51,
    prompt: "PROMPT",
    remarques: { precedent, remarque: "trop chargée", cible: "concretement", libelleCible: "la slide 2" },
    appeler: async (message) => {
      messages.push(message);
      return { donnees: tentatives[messages.length - 1], usage: { input_tokens: 10_000, output_tokens: 1_000 } };
    },
    analyser: (r) => r.donnees,
    journal: { error() {} },
  });
  assert.match(messages[0], /RÉGÉNÉRATION AVEC REMARQUES/);
  assert.match(messages[1], /Nombre\(s\) absent\(s\) de la fiche : 9999/);
  assert.equal(resultat.recit.concretement.texte, "Plus court.");
  assert.equal(resultat.recit.note.titre, precedent.note.titre);
});

test("journal des remarques et retour arrière : seule reseaux_recit change, l'historique est gardé", () => {
  const contenu = { verdict_final: "x", reseaux_recit: { couverture: "v1", retours: [{ remarque: "a" }] } };
  const retour = entreeRetour({ remarque: "trop chargée", cible: "concretement", slide: { numero: 2, libelle: "Concrètement" }, resultat: "acceptée", cout: 0.04567, date: "2026-11-21T10:00:00.000Z" });
  assert.deepEqual(retour, { date: "2026-11-21T10:00:00.000Z", remarque: "trop chargée", cible: "concretement", slide: { numero: 2, libelle: "Concrètement" }, resultat: "acceptée", cout: 0.0457 });
  const apres = contenuAvecRecit(contenu, { couverture: "v2" }, retour);
  assert.deepEqual(Object.keys(apres).sort(), ["reseaux_recit", "verdict_final"]);
  assert.deepEqual(apres.reseaux_recit.precedent, { couverture: "v1" });
  assert.equal(apres.reseaux_recit.retours.length, 2);
  // Refus : seul le journal change.
  const refus = contenuAvecRetour(contenu, { ...retour, resultat: "refusée" });
  assert.equal(refus.reseaux_recit.couverture, "v1");
  assert.equal(refus.reseaux_recit.retours.at(-1).resultat, "refusée");
  // Retour arrière : échange des deux versions, journal conservé, on peut revenir encore.
  const revenu = contenuRevenuAuPrecedent(apres, entreeRetour({ remarque: "", cible: "toutes", resultat: "retour à la version précédente" }));
  assert.equal(revenu.reseaux_recit.couverture, "v1");
  assert.equal(revenu.reseaux_recit.precedent.couverture, "v2");
  assert.equal(revenu.reseaux_recit.retours.length, 3);
  assert.equal(contenuRevenuAuPrecedent(revenu).reseaux_recit.couverture, "v2");
  assert.equal(contenuRevenuAuPrecedent(contenu), null);
});

test("page des retours : toutes fiches, plus récentes d'abord, remarques fréquentes regroupées", () => {
  const lignes = [
    { propositionId: 1, titre: "A", candidat: "X", statut: "publie", retours: [{ date: "2026-11-01", remarque: "La slide 2 est trop chargée", cible: "concretement", slide: { numero: 2, libelle: "Concrètement" }, resultat: "acceptée" }, { date: "2026-11-03", remarque: "", resultat: "retour à la version précédente" }] },
    { propositionId: 2, titre: "B", candidat: "Y", statut: "publie", retours: [{ date: "2026-11-02", remarque: "la slide 2 est trop chargée !", cible: "concretement", slide: { numero: 2, libelle: "Concrètement" }, resultat: "refusée" }] },
  ];
  const retours = listeRetours(lignes);
  assert.deepEqual(retours.map((r) => r.propositionId), [2, 1]);
  assert.equal(libelleCible(retours[0]), "Slide 2 · Concrètement");
  const frequentes = remarquesFrequentes(retours);
  assert.equal(frequentes.length, 1);
  assert.equal(frequentes[0].nombre, 2);
  assert.deepEqual(frequentes[0].fiches.sort(), [1, 2]);
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

import { estimerRecitCore, genererRecitPourFicheCore, regenererAvecRemarquesCore, revenirAuPrecedentCore } from "../src/lib/recit-action-core.js";

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

test("action remarques : slide visée réécrite seule, journal, ancienne version gardée ; refus noté au journal sans toucher au carrousel", async () => {
  const { recit } = controlerRecit(reponse(), CONTEXTE);
  const contenu = { ...FICHE, reseaux_recit: recit };
  const db = fausseBase(contenu);
  const options = { isEditor: async () => true, prisma: db, cleConfiguree: true, sauvegarder: async () => "s.json" };
  let recu = null;
  const r = await regenererAvecRemarquesCore(42, {
    ...options,
    remarque: "  la slide 2 est trop chargée ",
    cible: "concretement",
    generer: async (_c, opts) => {
      recu = opts.remarques;
      return { recit: { ...recit, concretement: { ...recit.concretement, texte: "Plus court." } }, cout: 0.05, avertissements: [] };
    },
  });
  assert.ok(r.ok, r.erreur);
  assert.equal(recu.remarque, "la slide 2 est trop chargée");
  assert.equal(recu.libelleCible, "la slide 2 (« Concrètement »)");
  const ecrit = db.ecritures[0].data.contenuComplet.reseaux_recit;
  assert.equal(ecrit.concretement.texte, "Plus court.");
  assert.equal(ecrit.precedent.concretement.texte, recit.concretement.texte);
  assert.equal(ecrit.retours[0].resultat, "acceptée");
  assert.deepEqual(ecrit.retours[0].slide, { numero: 2, libelle: "Concrètement" });

  const db2 = fausseBase(contenu);
  const refus = await regenererAvecRemarquesCore(42, { ...options, prisma: db2, remarque: "mets la note", cible: "noteRecit", generer: async () => ({ recit: null, cout: 0.08, errors: ["note (titre) : score ou pastille de note écrits par le modèle"] }) });
  assert.equal(refus.ok, false);
  const apresRefus = db2.ecritures[0].data.contenuComplet.reseaux_recit;
  assert.equal(apresRefus.note.titre, recit.note.titre);
  assert.equal(apresRefus.precedent, undefined);
  assert.equal(apresRefus.retours[0].resultat, "refusée");
  assert.match(apresRefus.retours[0].details[0], /score ou pastille/);

  assert.match((await regenererAvecRemarquesCore(42, { ...options, remarque: " ", cible: "toutes", generer: () => assert.fail() })).erreur, /Écrivez/);
  assert.match((await regenererAvecRemarquesCore(42, { ...options, remarque: "x", cible: "fin", generer: () => assert.fail() })).erreur, /inconnue/);
  const dry = await regenererAvecRemarquesCore(42, { ...options, dryRun: true, remarque: "x", cible: "toutes", generer: () => assert.fail() });
  assert.ok(dry.simulation);
});

test("action retour arrière : échange des versions sans appel, refusé sans version précédente", async () => {
  const db = fausseBase({ ...FICHE, reseaux_recit: { couverture: "v2", precedent: { couverture: "v1" } } });
  const r = await revenirAuPrecedentCore(42, { isEditor: async () => true, prisma: db, sauvegarder: async () => null });
  assert.ok(r.ok);
  const ecrit = db.ecritures[0].data.contenuComplet.reseaux_recit;
  assert.equal(ecrit.couverture, "v1");
  assert.equal(ecrit.precedent.couverture, "v2");
  assert.equal(ecrit.retours[0].resultat, "retour à la version précédente");
  const sans = await revenirAuPrecedentCore(42, { isEditor: async () => true, prisma: fausseBase(FICHE), sauvegarder: async () => null });
  assert.match(sans.erreur, /Pas de version précédente/);
});

test("action : estimation d'une régénération avec remarques plus chère (message avec la version précédente)", async () => {
  const { recit } = controlerRecit(reponse(), CONTEXTE);
  const base = { isEditor: async () => true, prisma: fausseBase({ ...FICHE, reseaux_recit: recit }), lirePrompt: async () => "PROMPT" };
  const simple = await estimerRecitCore(42, base);
  const avec = await estimerRecitCore(42, { ...base, remarque: "trop chargée", cible: "concretement" });
  assert.ok(avec.min > simple.min);
});
