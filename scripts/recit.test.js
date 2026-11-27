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
import { CONTEXTE, FICHE, reponse } from "./lib/recit-fixture.js";

test("réponse conforme : acceptée, tweet assemblé avec ligne de note et lien du code", () => {
  const { valide, erreurs, avertissements, recit } = controlerRecit(reponse(), CONTEXTE);
  assert.deepEqual(erreurs, []);
  assert.ok(valide);
  assert.deepEqual(avertissements, []);
  assert.match(recit.tweet_assemble, /\n\nNote : \{PASTILLE\} \{SCORE\}\/100 \{APPRECIATION\}\n\n/);
  assert.match(recit.tweet_assemble, /Analyse complète 👇 \{LIEN\}$/);
  assert.equal(recit.ailleurs.mesures[0].lieu, "Espagne");
  assert.equal(recit.constat.chiffres[1].valeur, "3 M");
});

test("refus : JSON invalide, champ manquant, ancien format v5", () => {
  assert.equal(controlerRecit(null, CONTEXTE).valide, false);
  assert.match(controlerRecit("texte", CONTEXTE).erreurs[0], /JSON invalide/);
  const sansProposition = reponse();
  delete sansProposition.constat.proposition;
  assert.match(controlerRecit(sansProposition, CONTEXTE).erreurs[0], /constat\.proposition/);
  const sansExplication = reponse();
  delete sansExplication.note.explication;
  assert.match(controlerRecit(sansExplication, CONTEXTE).erreurs[0], /note\.explication/);
  // Les lignes par critère ne sont plus demandées : leur absence est acceptée.
  const sansCriteres = reponse();
  delete sansCriteres.note.criteres;
  assert.equal(controlerRecit(sansCriteres, CONTEXTE).valide, true);
  assert.match(controlerRecit({ concretement: { titre: "x" }, tient: { tient: ["a"] } }, CONTEXTE).erreurs[0], /format précédent \(v5\)/);
});

test("refus : nombre absent de la fiche, tiret cadratin, score ou niveau écrit par le modèle", () => {
  const r = reponse();
  r.court_terme.effets[0].texte = "Le salaire monterait de 333 euros.";
  assert.match(controlerRecit(r, CONTEXTE).erreurs.join(" "), /absent\(s\) de la fiche : 333/);
  const tiret = reponse();
  tiret.avis.tient = ["Le gain—réel.", "b"];
  assert.match(controlerRecit(tiret, CONTEXTE).erreurs.join(" "), /tiret cadratin/);
  const avecScore = reponse();
  avecScore.note.titre = "Une mesure notée 51/100.";
  assert.match(controlerRecit(avecScore, CONTEXTE).erreurs.join(" "), /score ou pastille/);
  const avecNiveau = reponse();
  avecNiveau.note.explication = "Une mesure plausible sous condition.";
  assert.match(controlerRecit(avecNiveau, CONTEXTE).erreurs.join(" "), /niveau « Plausible sous condition »/);
});

test("refus : lieu ou année d'une mesure comparable absents de la fiche ; pastille hors liste", () => {
  const lieu = reponse();
  lieu.ailleurs.mesures[0].lieu = "Allemagne";
  assert.match(controlerRecit(lieu, CONTEXTE).erreurs.join(" "), /lieu « Allemagne » absent de la fiche/);
  const annee = reponse();
  annee.ailleurs.mesures[0].annee = "2022";
  assert.equal(controlerRecit(annee, CONTEXTE).valide, false);
  const p = reponse();
  p.court_terme.effets[1].pastille = "joyeux";
  assert.match(controlerRecit(p, CONTEXTE).erreurs.join(" "), /pastille « joyeux » hors liste/);
  for (const pastille of PASTILLES) {
    const ok = reponse();
    ok.long_terme.effets[0].pastille = pastille;
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
  assert.ok(controlerRecit(r, CONTEXTE).valide);
});

test("tuiles : format court, la nuance « près de » gardée dans la petite ligne, un seul chiffre en jaune", () => {
  assert.equal(valeurCourte("près de 600 milliards d'euros"), "~600 Md€");
  assert.equal(valeurCourte("488 milliards d’euros"), "488 Md€");
  assert.equal(valeurCourte("3 millions"), "3 M");
  assert.equal(valeurCourte("1 830 euros"), "1 830 €");
  assert.equal(valeurCourte("non chiffré"), "non chiffré");
  const r = reponse();
  r.constat.chiffres[2] = { valeur: "près de 2 200 euros", detail: "brut par mois" };
  const { recit } = controlerRecit(r, CONTEXTE);
  assert.deepEqual(recit.constat.chiffres[2], { valeur: "~2 200 €", detail: "près de 2 200 euros · brut par mois", jaune: false });
  const deux = reponse();
  deux.constat.chiffres[0].jaune = true;
  const c = controlerRecit(deux, CONTEXTE);
  assert.match(c.avertissements.join("\n"), /2 chiffre\(s\) en jaune/);
  assert.deepEqual(c.recit.constat.chiffres.map((x) => x.jaune), [true, false, false, false]);
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
  assert.match(message, /^PROMPT\n\nMOTS-CLÉS D'ILLUSTRATION DISPONIBLES \(toute la bibliothèque\) : billets, caisse\n\nFICHE FINALE :\n/);
  assert.match(construireMessageRecit("P", FICHE), /DISPONIBLES \(toute la bibliothèque\) : \(aucun : mets illustration_mots_cles à \[\]\)/);
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
    couleursCarrousel: { "Fabien Roussel": { nom: "Brique", fond: "#B33A2B", accent: "#1C2A5E" } },
    photos: [],
    ...modifs,
  };
}

test("carrousel détaillé : 8 slides, note, critères, sous-titre et fin par le code, légende et tweet remplis", () => {
  const { slides, legende, tweet, sujet, couleur } = carrouselRecit(donneesRecit());
  assert.deepEqual(
    slides.map((s) => s.type),
    ["couverture", "constat", "noteRecit", "effetsCourt", "effetsLong", "ailleurs", "avis", "fin"],
  );
  assert.equal(sujet, "Smic à 2 200 euros brut");
  assert.equal(slides[0].question, "Roussel veut-il un ==Smic à 2 200 euros== ?");
  assert.equal(slides[0].sousTitre, "Sa proposition : bonne idée… ou poudre de perlimpinpin ?");
  assert.equal(slides[0].fichier, "01-couverture.png");
  assert.equal(slides[1].fichier, "02-constat-et-proposition.png");
  assert.equal(slides[7].fichier, "08-fin.png");
  assert.equal(slides[1].proposition, "La proposition de Fabien Roussel : porter le Smic à 2 200 euros brut par mois.");
  assert.equal(slides[2].palier, getScoreBadge(51).label);
  assert.deepEqual(slides[2].criteres.map((c) => `${c.note}/${c.max}`), ["18/30", "12/30", "9/20", "4/10", "8/10"]);
  assert.equal(slides[6].avis, "Le gain est réel, mais le coût pour les PME reste à chiffrer.");
  assert.deepEqual(slides[7].sources, ["Ministère du Travail, montants du Smic 2026", "Insee, salaires", "OCDE, Smic rapporté au salaire médian"]);
  assert.deepEqual([couleur.fond, couleur.bloc], ["#B33A2B", "#1C2A5E"]);
  assert.match(legende, /^Fabien Roussel veut porter le Smic à 2 200 euros brut\. Est-ce tenable \?\n\nNotre avis : /);
  assert.match(legende, /lien en bio/);
  assert.match(tweet, /@Fabien_Roussel veut porter le Smic/);
  assert.match(tweet, /Note : 🟡 51\/100 Plausible sous condition/);
});

test("carrousel détaillé sans mesure comparable : 7 slides, avertissement", () => {
  const { recit } = controlerRecit(reponse({ ailleurs: null }), CONTEXTE);
  const { slides, avertissements } = carrouselRecit(donneesRecit({ contenu: { ...FICHE, reseaux_recit: recit } }));
  assert.equal(slides.length, 7);
  assert.deepEqual(slides.map((s) => `${s.numero}/${s.total}`), ["1/7", "2/7", "3/7", "4/7", "5/7", "6/7", "7/7"]);
  assert.ok(avertissements.some((a) => /Slide sautée : la fiche ne cite aucune mesure comparable/.test(a.message)));
});

test("pas de carrousel détaillé : null ; ancien format signalé ; archive carrousel-<slug>-<thème>.zip", () => {
  assert.equal(carrouselRecit(donneesRecit({ contenu: FICHE })), null);
  const ancien = carrouselRecit(donneesRecit({ contenu: { ...FICHE, reseaux_recit: { concretement: {}, tient: { tient: [] } } } }));
  assert.equal(ancien.slides.length, 0);
  assert.match(ancien.avertissements[0].message, /ancien format/);
  assert.equal(nomArchiveRecit({ candidatNom: "Fabien Roussel", theme: "economie" }), "carrousel-fabien-roussel-economie.zip");
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
  // Mots-clés de toute la bibliothèque : le modèle choisit selon la mesure.
  assert.deepEqual(motsClesDisponibles("economie", BIBLIO), ["banc", "billets", "caisse", "formulaire"]);
  assert.equal(choisirIllustration({ theme: "economie", motsCles: ["billets"], liste: BIBLIO }).illustration.fichier, "illustrations/economie/billets.jpg");
  // Tirage : alea 0 → la première ; en évitant la dernière utilisée.
  assert.equal(choisirIllustration({ theme: "retraites", alea: 0.5, liste: BIBLIO }).illustration.auteur, "D");
  assert.notEqual(choisirIllustration({ theme: "economie", alea: 0, derniere: "illustrations/economie/caisse.jpg", liste: BIBLIO }).illustration.fichier, "illustrations/economie/caisse.jpg");
  const vide = choisirIllustration({ theme: "sante", liste: BIBLIO });
  assert.equal(vide.illustration, null);
  assert.match(vide.avertissement, /Pas d'image de thème pour « sante » ni dans le dossier de secours/);
  assert.equal(aleaFiche("x"), aleaFiche("x"));
  // Crédit visible seulement si la licence le demande ; toujours dans legende.txt.
  assert.equal(creditVisible(BIBLIO[0]), null);
  assert.equal(creditVisible(BIBLIO[2]), "Photo : C, CC BY 4.0, Wikimedia");
  assert.equal(creditLegende(BIBLIO[0]), "Photo : A, Licence Pexels, Pexels https://pexels.com/1");
});

test("image de thème : bibliothèque vide → couverture sans illustration et avertissement ; sinon image et crédit dans la légende", () => {
  const vide = carrouselRecit(donneesRecit({ illustrations: [] }));
  assert.equal(vide.slides[0].illustration, null);
  assert.ok(vide.avertissements.some((a) => a.cle === "image de thème" && /ni dans le dossier de secours/.test(a.message)));
  const plein = carrouselRecit(donneesRecit({ illustrations: BIBLIO }));
  assert.ok(plein.slides[0].illustration.fichier.startsWith("illustrations/"));
  assert.match(plein.legende, /Photo : [A-D], /);
  assert.match(plein.credits, /Photo : [A-D], /);
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

test("carrousel sans tweet long (nouveau format) : accepté ; l'ancien tweet est reporté sur la nouvelle version", () => {
  const { tweet: _t, ...sansTweet } = reponse();
  const controle = controlerRecit(sansTweet, CONTEXTE);
  assert.equal(controle.valide, true, controle.erreurs.join(" | "));
  assert.equal(controle.recit.tweet, undefined);
  assert.equal(controle.recit.tweet_assemble, undefined);
  assert.ok(!controle.avertissements.some((a) => a.startsWith("tweet long")));
  const ancien = controlerRecit(reponse(), CONTEXTE).recit;
  const contenu = contenuAvecRecit({ reseaux_recit: ancien }, controle.recit);
  assert.equal(contenu.reseaux_recit.tweet_assemble, ancien.tweet_assemble);
  assert.equal(contenu.reseaux_recit.precedent.couverture.question, ancien.couverture.question);
});

test("remarques : seule la slide visée change, le reste est repris tel quel", () => {
  const { recit: precedent } = controlerRecit(reponse(), CONTEXTE);
  const nouveau = { ...reponse(), constat: { ...reponse().constat, explication: "Plus court." }, note: { ...reponse().note, titre: "Changé sans qu'on le demande." } };
  const fusion = fusionnerRecit(precedent, nouveau, "constat");
  assert.equal(fusion.constat.explication, "Plus court.");
  assert.equal(fusion.note.titre, precedent.note.titre);
  // Le tweet long n'est plus renvoyé au modèle (son propre prompt, src/lib/tweet-long.js).
  assert.equal(fusion.tweet, undefined);
  assert.equal(fusionnerRecit(precedent, nouveau, "toutes").note.titre, "Changé sans qu'on le demande.");
  assert.equal(fusionnerRecit(precedent, { ...reponse(), ailleurs: null }, "ailleurs").ailleurs, null);
  const consigne = consigneRemarques({ precedent, remarque: "la slide 2 est trop chargée", cible: "constat", libelleCible: "la slide 2 (« Le constat »)" });
  assert.match(consigne, /ne passent JAMAIS avant les règles/);
  assert.match(consigne, /Ne réécris que la slide 2 \(« Le constat »\) \(clé\(s\) JSON : constat\)/);
  assert.ok(!cibleValide("tweet") && cibleValide("legende") && cibleValide("toutes") && !cibleValide("fin"));
});

test("remarques : menu des slides (sans la fin), slide visée selon la présence d'une mesure comparable", () => {
  const { recit } = controlerRecit(reponse(), CONTEXTE);
  assert.deepEqual(ciblesRemarques(recit).map((c) => c.valeur), ["toutes", "couverture", "constat", "noteRecit", "effetsCourt", "effetsLong", "ailleurs", "avis", "legende"]);
  assert.deepEqual(slideDeCible(recit, "avis"), { numero: 7, libelle: "Notre avis" });
  assert.deepEqual(slideDeCible({ ...recit, ailleurs: null }, "avis"), { numero: 6, libelle: "Notre avis" });
  assert.equal(slideDeCible(recit, "tweet"), null);
});

test("génération avec remarques : mêmes refus (chiffre absent de la fiche), fusion sur la slide visée", async () => {
  const { recit: precedent } = controlerRecit(reponse(), CONTEXTE);
  const messages = [];
  const tentatives = [
    { ...reponse(), constat: { ...reponse().constat, explication: "Le Smic passerait à 9 999 euros." } },
    { ...reponse(), constat: { ...reponse().constat, explication: "Plus court." }, note: { ...reponse().note, titre: "Autre." } },
  ];
  const resultat = await genererRecitCore({
    ficheFinale: FICHE,
    candidatNom: "Fabien Roussel",
    score: 51,
    prompt: "PROMPT",
    remarques: { precedent, remarque: "trop chargée", cible: "constat", libelleCible: "la slide 2" },
    appeler: async (message) => {
      messages.push(message);
      return { donnees: tentatives[messages.length - 1], usage: { input_tokens: 10_000, output_tokens: 1_000 } };
    },
    analyser: (r) => r.donnees,
    journal: { error() {} },
  });
  assert.match(messages[0], /RÉGÉNÉRATION AVEC REMARQUES/);
  assert.match(messages[1], /Nombre\(s\) absent\(s\) de la fiche : 9999/);
  assert.equal(resultat.recit.constat.explication, "Plus court.");
  assert.equal(resultat.recit.note.titre, precedent.note.titre);
});

test("génération : texte qui déborde → une relance pour raccourcir, version qui déborde le moins gardée", async () => {
  const messages = [];
  const longue = reponse();
  longue.constat.explication = "Le Smic brut est de 1 830 euros. Trois millions de salariés en dépendent, dans tous les secteurs.";
  const reponses = [longue, reponse()];
  const trop = (recit) => (recit.constat.explication.length > 80 ? [{ numero: 2, libelle: "Le constat", bloc: "contenu", raison: "40 px de trop" }] : []);
  const resultat = await genererRecitCore({
    ficheFinale: FICHE,
    candidatNom: "Fabien Roussel",
    score: 51,
    prompt: "PROMPT",
    appeler: async (message) => {
      messages.push(message);
      return { donnees: reponses[messages.length - 1], usage: { input_tokens: 1000, output_tokens: 100 } };
    },
    analyser: (r) => r.donnees,
    debordements: trop,
    journal: { error() {} },
  });
  assert.equal(messages.length, 2);
  assert.match(messages[1], /TEXTE TROP LONG POUR LA SLIDE/);
  assert.match(messages[1], /slide 2 \(Le constat\) : contenu/);
  assert.equal(resultat.recit.constat.explication, reponse().constat.explication);
  assert.deepEqual(resultat.debordements, []);
  // Relance qui déborde encore : la première version est gardée, avec l'avertissement.
  const toujours = await genererRecitCore({
    ficheFinale: FICHE,
    candidatNom: "Fabien Roussel",
    score: 51,
    prompt: "PROMPT",
    appeler: async () => ({ donnees: longue, usage: {} }),
    analyser: (r) => r.donnees,
    debordements: trop,
    journal: { error() {} },
  });
  assert.ok(toujours.recit);
  assert.match(toujours.avertissements.join("\n"), /Texte trop long, slide 2 \(Le constat\)/);
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
    { propositionId: 1, titre: "A", candidat: "X", statut: "publie", retours: [{ date: "2026-11-01", remarque: "La slide 2 est trop chargée", cible: "constat", slide: { numero: 2, libelle: "Le constat" }, resultat: "acceptée" }, { date: "2026-11-03", remarque: "", resultat: "retour à la version précédente" }] },
    { propositionId: 2, titre: "B", candidat: "Y", statut: "publie", retours: [{ date: "2026-11-02", remarque: "la slide 2 est trop chargée !", cible: "constat", slide: { numero: 2, libelle: "Le constat" }, resultat: "refusée" }] },
  ];
  const retours = listeRetours(lignes);
  assert.deepEqual(retours.map((r) => r.propositionId), [2, 1]);
  assert.equal(libelleCible(retours[0]), "Slide 2 · Le constat");
  assert.equal(libelleCible({ cible: "legende" }), "Légende");
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

import { changerPhotoCore, estimerRecitCore, genererRecitPourFicheCore, regenererAvecRemarquesCore, revenirAuPrecedentCore } from "../src/lib/recit-action-core.js";

function fausseBase(contenu, { modifiee = false } = {}) {
  const ecritures = [];
  return {
    ecritures,
    proposition: {
      findUnique: async () => ({
        id: 42,
        titre: "Smic à 2 200 euros brut",
        theme: "economie",
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
    cible: "constat",
    generer: async (_c, opts) => {
      recu = opts;
      return { recit: { ...recit, constat: { ...recit.constat, explication: "Plus court." } }, cout: 0.05, avertissements: [] };
    },
  });
  assert.ok(r.ok, r.erreur);
  assert.equal(recu.remarques.remarque, "la slide 2 est trop chargée");
  assert.equal(recu.remarques.libelleCible, "la slide 2 (« Le constat, puis la proposition »)");
  assert.equal(recu.proposition.id, 42);
  const ecrit = db.ecritures[0].data.contenuComplet.reseaux_recit;
  assert.equal(ecrit.constat.explication, "Plus court.");
  assert.equal(ecrit.precedent.constat.explication, recit.constat.explication);
  assert.equal(ecrit.retours[0].resultat, "acceptée");
  assert.deepEqual(ecrit.retours[0].slide, { numero: 2, libelle: "Le constat, puis la proposition" });

  const db2 = fausseBase(contenu);
  const refus = await regenererAvecRemarquesCore(42, { ...options, prisma: db2, remarque: "mets la note", cible: "noteRecit", generer: async () => ({ recit: null, cout: 0.08, errors: ["slide 3 (titre) : score ou pastille de note écrits par le modèle"] }) });
  assert.equal(refus.ok, false);
  const apresRefus = db2.ecritures[0].data.contenuComplet.reseaux_recit;
  assert.equal(apresRefus.note.titre, recit.note.titre);
  assert.equal(apresRefus.precedent, undefined);
  assert.equal(apresRefus.retours[0].resultat, "refusée");
  assert.match(apresRefus.retours[0].details[0], /score ou pastille/);

  const legende = await regenererAvecRemarquesCore(42, { ...options, prisma: fausseBase(contenu), remarque: "plus court", cible: "legende", generer: async () => ({ recit, cout: 0.01, avertissements: [] }) });
  assert.ok(legende.ok, legende.erreur);
  assert.match(legende.message, /la légende/);

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

test("action : « Changer de photo » tire une autre photo côté serveur et la mémorise dans le carrousel", async () => {
  const photos = [1, 2, 3].map((n) => ({ slug: "fabien-roussel", n, deposee: true, credit: "X" }));
  const db = fausseBase({ ...FICHE, reseaux_recit: { couverture: "v1", photo: 2, genereLe: "2026-11-01" } });
  const options = { isEditor: async () => true, prisma: db, sauvegarder: async () => null, photos };
  // Carrousel précédent du candidat (après celui de cette fiche) : la 3 ; il ne reste que la 1.
  const r = await changerPhotoCore(42, { ...options, imagesRecentes: async () => ({ photos: [2, 3] }), alea: () => "a" });
  assert.ok(r.ok);
  assert.equal(r.photo, 1);
  const ecrit = db.ecritures[0].data.contenuComplet.reseaux_recit;
  assert.equal(ecrit.photo, 1);
  assert.equal(ecrit.couverture, "v1", "rien d'autre ne change");
  assert.equal(ecrit.precedent, undefined, "pas de nouvelle version");
  // Une seule photo : rien à changer, rien d'écrit.
  const seule = fausseBase({ ...FICHE, reseaux_recit: { couverture: "v1", photo: 1 } });
  const r2 = await changerPhotoCore(42, { ...options, prisma: seule, photos: photos.slice(0, 1) });
  assert.equal(r2.ok, false);
  assert.equal(seule.ecritures.length, 0);
  assert.equal((await changerPhotoCore(42, { ...options, isEditor: async () => false })).ok, false);
});

test("action : estimation d'une régénération avec remarques plus chère (message avec la version précédente)", async () => {
  const { recit } = controlerRecit(reponse(), CONTEXTE);
  const base = { isEditor: async () => true, prisma: fausseBase({ ...FICHE, reseaux_recit: recit }), lirePrompt: async () => "PROMPT" };
  const simple = await estimerRecitCore(42, base);
  const avec = await estimerRecitCore(42, { ...base, remarque: "trop chargée", cible: "constat" });
  assert.ok(avec.min > simple.min);
});
