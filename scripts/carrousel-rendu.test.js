import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { recitDe } from "../src/lib/carrousel-serveur.js";
import { policesCarrousel } from "../src/lib/og-ressources.js";
import { miseEnPageSlide } from "../src/lib/mise-en-page-carrousel.js";
import { mesureurCarrousel } from "../src/lib/metriques-polices.js";
import { chargerRendu, controlerRendu } from "./lib/controle-rendu.js";

// Rendu RÉEL (next/og) des slides 1 à 3 du carrousel détaillé de deux fiches
// publiées (copiées dans scripts/fixtures/ le 23/11/2026) : Marine Le Pen
// « geler le prix du tabac » (34) et Jean-Luc Mélenchon « suspendre les 3 % »
// (105). La slide est rendue en mode contrôle (textes et cartes sur fond uni,
// sans pied de page, bande ni collage) et l'on compte les pixels dans les
// zones réservées (scripts/lib/controle-rendu.js) :
//  - tout texte qui touche une zone réservée doit être signalé par la mesure
//    (src/lib/mise-en-page-carrousel.js) et bloquer l'archive ;
//  - textes raccourcis : plus rien ne touche les zones réservées ;
//  - la slide 3 montre les 5 critères.

const fiche = (id) => JSON.parse(readFileSync(new URL(`./fixtures/carrousel-fiche-${id}.json`, import.meta.url), "utf8"));
const CREME = "#F3EDE0";

// Textes plus courts (ce que la relance « raccourcir » doit obtenir du modèle),
// aux tailles de la charte RS (titres à 64 px).
const COURTS = {
  34: {
    couverture: { question: "{NOM} veut-elle geler le prix du ==tabac== ?" },
    constat: {
      explication: "Le prix est l’outil le plus efficace contre le tabac en France.",
      proposition: "La proposition de {NOM} : geler les taxes sur le tabac.",
      imprecisions: "Elle ne dit ni combien de temps, ni comment compenser.",
      sources: "Sénat, OFDT (2019).",
    },
    note: { titre: "Le plan de {NOM} soulage les buralistes, pas la santé.", explication: "Simple à appliquer, mais contraire à l’outil le mieux démontré contre le tabagisme." },
  },
  105: {
    couverture: { question: "Mélenchon veut-il suspendre la règle des ==3 %== ?" },
    constat: {
      explication: "La règle des 3 % de déficit encadre les budgets depuis Maastricht.",
      proposition: "La proposition de {NOM} : suspendre la limite de 3 % pour tous les États.",
      imprecisions: "Elle ne dit ni pour combien de temps, ni ce qui la remplacerait.",
      sources: "Insee, Eurostat.",
    },
    note: { titre: "Le plan de {NOM} vise une vraie faille, pas le vrai frein.", explication: "Déjà suspendue en 2020. Le vrai frein reste le coût de la dette." },
  },
};

function raccourcie(id) {
  const f = fiche(id);
  const recit = f.analyse.contenuComplet.reseaux_recit;
  const c = COURTS[id];
  recit.couverture = { ...recit.couverture, ...c.couverture };
  recit.constat = { ...recit.constat, ...c.constat };
  recit.note = { ...recit.note, ...c.note };
  return f;
}

async function controler(rendu, polices, { proposition, analyse }, numeros) {
  const recit = recitDe(proposition, analyse);
  const resultats = [];
  for (const slide of recit.slides.filter((s) => numeros.includes(s.numero))) {
    const mise = miseEnPageSlide(slide, mesureurCarrousel());
    const fond = slide.type === "couverture" ? recit.couleur.fond : CREME;
    const { intrusions } = await controlerRendu(rendu, { slide, mise, couleur: recit.couleur, polices, candidatNom: proposition.candidat.nom, sujet: recit.sujet, fond });
    resultats.push({ slide, mise, intrusions });
  }
  return { recit, resultats };
}

test("rendu réel, fiches Le Pen et Mélenchon : tout texte qui touche le pied de page ou le collage est signalé et bloque l’archive", async (t) => {
  const rendu = await chargerRendu();
  if (!rendu) return t.skip("TypeScript absent : rendu JSX impossible hors de Next");
  const polices = await policesCarrousel();
  for (const id of [34, 105]) {
    const { recit, resultats } = await controler(rendu, polices, fiche(id), [1, 2, 3]);
    for (const { slide, mise, intrusions } of resultats) {
      if (intrusions.length) {
        assert.ok(mise.debordements.length > 0, `fiche ${id}, slide ${slide.numero} : texte dans ${intrusions.map((z) => z.zone).join(", ")} sans débordement signalé`);
        assert.ok(recit.blocageArchive, `fiche ${id} : débordement sans blocage de l’archive`);
      }
    }
    // Les textes d'origine débordent bien sur ces slides (cas des captures).
    assert.ok(resultats.some((r) => r.intrusions.length > 0), `fiche ${id} : les textes d’origine devraient déborder`);
    const note = resultats.find((r) => r.slide.type === "noteRecit");
    assert.equal(note.mise.criteres.length, 5, `fiche ${id} : les 5 critères`);
  }
});

test("rendu réel, textes raccourcis : rien ne touche les zones réservées, les 5 critères tiennent, l’archive n’est pas bloquée par la mise en page", async (t) => {
  const rendu = await chargerRendu();
  if (!rendu) return t.skip("TypeScript absent : rendu JSX impossible hors de Next");
  const polices = await policesCarrousel();
  for (const id of [34, 105]) {
    const { resultats } = await controler(rendu, polices, raccourcie(id), [1, 2, 3]);
    for (const { slide, mise, intrusions } of resultats) {
      assert.deepEqual(intrusions, [], `fiche ${id}, slide ${slide.numero} : texte dans une zone réservée`);
      assert.deepEqual(mise.debordements, [], `fiche ${id}, slide ${slide.numero} : débordement annoncé à tort`);
    }
    const note = resultats.find((r) => r.slide.type === "noteRecit");
    assert.equal(note.mise.criteres.length, 5);
    assert.ok(note.mise.boites.at(-1).y + note.mise.boites.at(-1).hauteur <= 1220, `fiche ${id} : le 5e critère tient au-dessus du pied de page`);
  }
});
