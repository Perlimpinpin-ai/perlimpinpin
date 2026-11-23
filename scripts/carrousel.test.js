import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LEGENDE_MAX,
  MOTS_MAX_SLIDE,
  cheminSlide,
  controlerCarrousel,
  hashtagsLegende,
  nomArchiveCarrousel,
  phrases,
  raccourcir,
} from "../src/lib/carrousel.js";
import { handleInstagram, hashtagCandidat, hashtagTheme } from "../src/lib/handles-instagram.js";
import { getScoreBadge } from "../src/lib/score.js";
import { nombreDeMots } from "../src/lib/reseaux.js";

// Fiche complète, sur le modèle d'une fiche récente (reseaux de l'étape 3 ter,
// version basique, ce_qui_la_ferait_tenir à la racine).
function ficheComplete(modifs = {}) {
  return {
    propositionId: 42,
    analyseId: 7,
    titre: "Smic à 2 200 euros brut",
    candidatNom: "Fabien Roussel",
    photoUrl: "/photos/fabien-roussel.jpg",
    theme: "economie",
    score: 41,
    mesureInitiale: "Je propose de porter le Smic à 2 200 euros brut par mois dès le début du quinquennat.",
    resumeBasique:
      "Fabien Roussel veut porter le Smic à 2 200 euros brut par mois. La hausse serait de près de 20 %. Les entreprises devraient absorber le coût, sans aide de l'État annoncée.",
    contenu: {
      reseaux: {
        fil: [
          "🔵 Le Smic à 2 200 € brut : un vrai gain pour les salariés, un coût mal évalué.\n\nPerlimpinpin.ai analyse la proposition de {CANDIDAT}\n\nNote : {PASTILLE} {SCORE}/100 {APPRECIATION}\n\nOù ça coince ↓",
          "2/ …",
          "3/ …",
          "4/ …",
        ],
        chiffre: { valeur: "+20 %", explication: "La hausse du Smic proposée, la plus forte depuis 1968.", tweet: "…" },
        tient: {
          titre: "Smic à 2 200 euros",
          tient: ["Le pouvoir d'achat des bas salaires augmente nettement.", "Le Smic français reste sous la moyenne."],
          tient_pas: ["Le coût pour les petites entreprises n'est pas évalué.", "Aucune compensation n'est prévue."],
          tient_court: ["Les bas salaires gagnent nettement", "Le Smic reste dans la moyenne européenne"],
          tient_pas_court: ["Le coût pour les PME n'est pas chiffré", "Aucune compensation prévue"],
          tweet: "…",
        },
      },
      ce_qui_la_ferait_tenir: [
        "Étaler la hausse sur le quinquennat : passer par paliers annuels indexés sur la productivité, pour laisser aux PME le temps de s'adapter. Une seconde phrase qui ne sera pas reprise.",
        "Chiffrer le coût par taille d'entreprise : publier une étude d'impact avant le vote, avec des hypothèses explicites sur l'emploi.",
        "Prévoir une compensation ciblée : un allègement temporaire de cotisations pour les très petites entreprises les plus exposées.",
      ],
    },
    handlesInstagram: {},
    ...modifs,
  };
}

test("fiche complète : 6 slides, dans l'ordre, pagination 1/6 à 6/6", () => {
  const { slides } = controlerCarrousel(ficheComplete());
  assert.deepEqual(
    slides.map((s) => s.type),
    ["couverture", "mesure", "note", "chiffre", "tient", "fin"],
  );
  assert.deepEqual(slides.map((s) => `${s.numero}/${s.total}`), ["1/6", "2/6", "3/6", "4/6", "5/6", "6/6"]);
  assert.deepEqual(slides.map((s) => s.fichier), [
    "01-couverture.png",
    "02-la-mesure.png",
    "03-la-note.png",
    "04-le-chiffre.png",
    "05-tient-tient-pas.png",
    "06-fin.png",
  ]);
});

test("aucune slide ne dépasse 35 mots", () => {
  const { slides } = controlerCarrousel(ficheComplete());
  const textes = {
    mesure: (s) => [s.texte],
    chiffre: (s) => [s.valeur, s.explication],
    tient: (s) => [...s.tient, ...s.tientPas],
  };
  for (const slide of slides) {
    const morceaux = textes[slide.type]?.(slide) ?? [];
    const mots = morceaux.reduce((n, t) => n + nombreDeMots(t), 0);
    assert.ok(mots <= MOTS_MAX_SLIDE, `${slide.type} : ${mots} mots`);
  }
});

test("slide 2 : une ou deux phrases du résumé de la vue basique, sinon la mesure initiale", () => {
  const avec = controlerCarrousel(ficheComplete()).slides[1];
  assert.equal(avec.source, "version_basique.resume");
  assert.equal(avec.texte, "Fabien Roussel veut porter le Smic à 2 200 euros brut par mois. La hausse serait de près de 20 %.");
  const sans = controlerCarrousel(ficheComplete({ resumeBasique: null })).slides[1];
  assert.equal(sans.source, "mesure initiale");
  assert.equal(sans.texte, "Je propose de porter le Smic à 2 200 euros brut par mois dès le début du quinquennat.");
});

test("slide 5 : la condition la plus forte, réduite à son titre ; slide 6 : fin commune et sources", () => {
  const fiche = ficheComplete();
  fiche.contenu.sources_utilisees = ["Ministère du Travail, Smic 2026 : https://travail.gouv.fr", "Insee, salaires"];
  const { slides, sujet } = controlerCarrousel(fiche);
  assert.equal(slides[4].condition, "Étaler la hausse sur le quinquennat");
  assert.equal(slides[5].type, "fin");
  assert.deepEqual(slides[5].sources, ["Ministère du Travail, Smic 2026", "Insee, salaires"]);
  assert.equal(sujet, "Smic");
});

test("fiche sans ce_qui_la_ferait_tenir : pas de condition, 6 slides quand même", () => {
  const fiche = ficheComplete();
  delete fiche.contenu.ce_qui_la_ferait_tenir;
  const { slides } = controlerCarrousel(fiche);
  assert.equal(slides.length, 6);
  assert.equal(slides[4].condition, null);
  assert.equal(slides[5].fichier, "06-fin.png");
});

test("fiche sans chiffre : 5 slides, pagination 1/5 à 5/5, avertissement", () => {
  const fiche = ficheComplete();
  delete fiche.contenu.reseaux.chiffre;
  const { slides, avertissements } = controlerCarrousel(fiche);
  assert.equal(slides.length, 5);
  assert.deepEqual(slides.map((s) => `${s.numero}/${s.total}`), ["1/5", "2/5", "3/5", "4/5", "5/5"]);
  assert.deepEqual(slides.map((s) => s.type), ["couverture", "mesure", "note", "tient", "fin"]);
  assert.equal(slides[3].fichier, "04-tient-tient-pas.png");
  assert.ok(avertissements.some((a) => /Slide sautée : pas de chiffre/.test(a.message)));
});

test("fiche sans reseaux (ancienne fiche) : 4 slides, deux avertissements de slide sautée", () => {
  const fiche = ficheComplete();
  delete fiche.contenu.reseaux;
  delete fiche.contenu.ce_qui_la_ferait_tenir;
  const { slides, avertissements, legende } = controlerCarrousel(fiche);
  assert.deepEqual(slides.map((s) => s.type), ["couverture", "mesure", "note", "fin"]);
  assert.equal(avertissements.filter((a) => /Slide sautée/.test(a.message)).length, 2);
  assert.ok(!legende.includes("✅"));
});

test("tient / tient pas : versions courtes, au plus 2 de chaque côté", () => {
  const slide = controlerCarrousel(ficheComplete()).slides[4];
  assert.deepEqual(slide.tient, ["Les bas salaires gagnent nettement", "Le Smic reste dans la moyenne européenne"]);
  assert.deepEqual(slide.tientPas, ["Le coût pour les PME n'est pas chiffré", "Aucune compensation prévue"]);
});

test("tient / tient pas trop long : un point retiré, avertissement", () => {
  const long = "Un point volontairement très long pour dépasser à lui seul ou presque la limite de mots fixée sur une slide";
  const fiche = ficheComplete();
  fiche.contenu.reseaux.tient.tient_court = [long, long];
  fiche.contenu.reseaux.tient.tient_pas_court = ["Court", "Court aussi"];
  const { slides, avertissements } = controlerCarrousel(fiche);
  assert.equal(slides[4].tient.length, 1);
  assert.equal(slides[4].tientPas.length, 2);
  assert.ok(avertissements.some((a) => a.cle.startsWith("slide 5")));
});

test("légende : modèle, score et palier écrits par le code", () => {
  // Bibliothèque d'images vide : légende sans crédit photo (indépendant de src/lib/illustrations.js).
  const { legende } = controlerCarrousel({ ...ficheComplete(), illustrations: [] });
  // Avec une image de thème : son crédit termine la légende.
  const image = { fichier: "illustrations/economie/caisse.jpg", theme: "economie", motsCles: ["caisse"], source: "Wikimedia Commons", auteur: "Zoé Photo", licence: "CC BY-SA 4.0", lien: "https://commons.wikimedia.org/wiki/File:Caisse.jpg" };
  assert.ok(controlerCarrousel({ ...ficheComplete(), illustrations: [image] }).legende.endsWith("\n\nPhoto : Zoé Photo, CC BY-SA 4.0, Wikimedia Commons https://commons.wikimedia.org/wiki/File:Caisse.jpg"));
  assert.equal(
    legende,
    [
      "🟠 Smic à 2 200 euros brut : un vrai gain pour les salariés, un coût mal évalué.\nLa mesure de Fabien Roussel passée au crible.",
      "Note Perlimpinpin : 41/100, Partiellement fondé.",
      "✅ Les bas salaires gagnent nettement\n❌ Le coût pour les PME n'est pas chiffré",
      "Analyse complète, sources et méthode : lien en bio.\nEt vous, ça tient ? Dites-le en commentaire.",
      "#Presidentielle2027 #FabienRoussel #PouvoirDAchat #FactChecking #Perlimpinpin",
    ].join("\n\n"),
  );
  assert.ok(!legende.includes("@"));
});

test("score et palier toujours tirés de src/lib/score.js, jamais d'un texte du modèle", () => {
  for (const score of [12, 30, 41, 55, 72, 88]) {
    const fiche = ficheComplete({ score });
    // Le modèle a écrit une autre appréciation dans la fiche : ignorée.
    fiche.contenu.notation_detaillee = { score_total: 99, appreciation: "exemplaire" };
    const { slides, legende } = controlerCarrousel(fiche);
    const palier = getScoreBadge(score).label;
    assert.equal(slides[2].palier, palier);
    assert.equal(slides[2].score, score);
    assert.ok(legende.includes(`Note Perlimpinpin : ${score}/100, ${palier}.`));
  }
});

test("légende trop longue : avertissement fort", () => {
  const fiche = ficheComplete({ titre: "Mot ".repeat(600).trim() });
  const { legende, avertissements } = controlerCarrousel(fiche);
  assert.ok(legende.length > LEGENDE_MAX);
  const alerte = avertissements.find((a) => a.cle === "légende" && a.fort);
  assert.ok(alerte);
  assert.match(alerte.message, /2200 au plus/);
});

test("compte Instagram : @ si connu, sinon nom et avertissement", () => {
  const sans = controlerCarrousel(ficheComplete());
  assert.ok(sans.avertissements.some((a) => /Pas de compte Instagram connu pour Fabien Roussel/.test(a.message)));
  const avec = controlerCarrousel(ficheComplete({ handlesInstagram: { "Fabien Roussel": "fabien.roussel" } }));
  assert.ok(avec.legende.includes("La mesure de @fabien.roussel passée au crible."));
  assert.ok(!avec.avertissements.some((a) => /compte Instagram/.test(a.message)));
});

test("tiret cadratin repris : remplacé par une virgule, avertissement", () => {
  const fiche = ficheComplete({ resumeBasique: "Fabien Roussel veut un Smic à 2 200 euros — dès 2027. Rien d'autre." });
  const { slides, avertissements } = controlerCarrousel(fiche);
  assert.equal(slides[1].texte, "Fabien Roussel veut un Smic à 2 200 euros, dès 2027. Rien d'autre.");
  assert.ok(avertissements.some((a) => /Tiret cadratin/.test(a.message)));
});

test("5 hashtags au plus ; candidat et thème sans accents ni espaces", () => {
  assert.equal(hashtagCandidat("Jean-Luc Mélenchon"), "#JeanLucMelenchon");
  assert.equal(hashtagCandidat("Édouard Philippe"), "#EdouardPhilippe");
  assert.equal(hashtagTheme("Emploi & Chômage"), "#Emploi");
  assert.equal(hashtagTheme("inconnu"), null);
  assert.ok(hashtagsLegende({ candidatNom: "Marine Le Pen", theme: "logement" }).length <= 5);
  assert.deepEqual(hashtagsLegende({ candidatNom: "Marine Le Pen", theme: "???" }), [
    "#Presidentielle2027",
    "#MarineLePen",
    "#FactChecking",
    "#Perlimpinpin",
  ]);
});

test("handleInstagram : table vide par défaut, comparaison sans accents", () => {
  assert.equal(handleInstagram("Fabien Roussel"), null);
  assert.equal(handleInstagram("Edouard Philippe", { "Édouard Philippe": "@edouardphilippe" }), "@edouardphilippe");
  assert.equal(handleInstagram("X", { X: "pas un compte !" }), null);
});

test("raccourcir : à la phrase, sinon à la virgule, jamais au milieu d'un mot", () => {
  assert.deepEqual(phrases("Une phrase. Une autre ! Et 3 encore ?"), ["Une phrase.", "Une autre !", "Et 3 encore ?"]);
  assert.equal(raccourcir("Un deux trois. Quatre cinq six sept.", 4), "Un deux trois.");
  assert.equal(raccourcir("Un deux trois quatre, cinq six sept huit neuf.", 6), "Un deux trois quatre…");
  const coupe = raccourcir("Anticonstitutionnellement extraordinairement merveilleusement inimaginablement", 2);
  assert.equal(coupe, "Anticonstitutionnellement extraordinairement…");
});

test("version et chemins des slides", () => {
  const a = controlerCarrousel(ficheComplete());
  const b = controlerCarrousel(ficheComplete({ score: 42 }));
  assert.match(a.version, /^7-[0-9a-f]{8}$/);
  assert.notEqual(a.version, b.version);
  assert.equal(cheminSlide({ propositionId: 42, numero: 3, version: a.version }), `/api/carrousel/42?slide=3&v=${a.version}`);
  assert.match(cheminSlide({ propositionId: 42, numero: 1, version: "x", brouillon: true }), /&brouillon=1$/);
  assert.equal(
    nomArchiveCarrousel({ propositionId: 42, candidatNom: "Fabien Roussel", photoUrl: "/photos/fabien-roussel.jpg" }),
    "carrousel-42-fabien-roussel.zip",
  );
});
