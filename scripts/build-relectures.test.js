import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderVue } from "./build-relectures.js";

// Rendu d'une fiche sur la page /relectures : sections en accordéon
// { synthese, texte } (format Étape 1 du pipeline) et texte simple (fiches
// déjà en ligne).

const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data/relectures");
const lire = (slug) => JSON.parse(readFileSync(path.join(DATA_DIR, `${slug}.json`), "utf8"));

// Les 13 sections en accordéon de validateEtape1Structure (scripts/lib/scoring.js).
const SECTIONS_ACCORDEON = [
  "mesure_reformulee", "contexte_programme", "contexte_national", "contexte_international",
  "impact_environnement", "analyse_longevites", "impact_temporel_et_sectoriel", "ce_qui_est_etabli",
  "ce_qui_est_probable", "ce_qui_est_discutable", "ce_qui_est_inconnu", "angles_morts", "limites",
];
const enAccordeon = (fiche) => {
  const f = structuredClone(fiche);
  for (const k of SECTIONS_ACCORDEON) {
    if (typeof f[k] === "string") f[k] = { synthese: `Synthèse de ${k} : l'essentiel.`, texte: f[k] };
  }
  return f;
};

// Contenu d'un élément d'identifiant donné (section, article ou div de la vue).
function zone(html, id) {
  const debut = html.indexOf(`id="${id}"`);
  assert.ok(debut >= 0, `id="${id}" absent`);
  const fin = html.indexOf(' id="', debut + id.length + 5);
  return html.slice(debut, fin < 0 ? undefined : fin);
}

// Fiches à l'ancien format (sections en texte simple) : les fiches au format
// accordéon (sections { synthese, texte }) ont leurs propres tests.
const fichesTexteSimple = () =>
  readdirSync(DATA_DIR)
    .filter((x) => x.endsWith(".json"))
    .filter((f) => typeof lire(f.replace(/\.json$/, "")).contexte_national === "string");

test("texte simple : aucune synthèse affichée pour les fiches déjà en ligne", () => {
  for (const f of fichesTexteSimple()) {
    const slug = f.replace(/\.json$/, "");
    assert.doesNotMatch(renderVue(slug, lire(slug)), /class="synthese"/, slug);
  }
});

test("accordéon : synthèse en tête de section, puis le texte découpé en paragraphes", () => {
  const fiche = lire("zemmour-retraites");
  const html = renderVue("zr", enAccordeon(fiche));

  const national = zone(html, "zr-national");
  const synthese = national.indexOf(`<p class="synthese">Synthèse de contexte_national : l&#x27;essentiel.</p>`);
  assert.ok(synthese >= 0, "synthèse absente");
  const premierParagraphe = fiche.contexte_national.trim().split(/\n\s*\n/)[0].slice(0, 40);
  assert.ok(national.indexOf(premierParagraphe.replace(/'/g, "&#x27;")) > synthese, "le texte doit suivre la synthèse");

  for (const [id, cle] of [
    ["zr-mesure-reformulee", "mesure_reformulee"], ["zr-programme", "contexte_programme"],
    ["zr-international", "contexte_international"], ["zr-longevite", "analyse_longevites"],
    ["zr-impact", "impact_temporel_et_sectoriel"], ["zr-ce_qui_est_etabli", "ce_qui_est_etabli"],
    ["zr-ce_qui_est_probable", "ce_qui_est_probable"], ["zr-ce_qui_est_discutable", "ce_qui_est_discutable"],
    ["zr-ce_qui_est_inconnu", "ce_qui_est_inconnu"], ["zr-angles", "angles_morts"], ["zr-fiabilite", "limites"],
  ]) {
    assert.match(zone(html, id), new RegExp(`<div class="body">.*<p class="synthese">Synthèse de ${cle} `, "s"), id);
  }
  // Limites : synthèse sous l'intertitre, avant la liste.
  assert.match(zone(html, "zr-fiabilite"), /Limites identifiées<\/h3><p class="synthese">[^<]*<\/p><ul class="plist"><li>/);
});

test("accordéon : mêmes identifiants et même texte qu'en texte simple, synthèses en plus", () => {
  for (const f of fichesTexteSimple()) {
    const slug = f.replace(/\.json$/, "");
    const fiche = lire(slug);
    const accordeon = renderVue(slug, enAccordeon(fiche));
    assert.equal(accordeon.replace(/<p class="synthese">[^<]*<\/p>/g, ""), renderVue(slug, fiche), slug);
  }
});

test("accordéon : texte en liste de points, impact_environnement et impact_temporel_et_sectoriel à null", () => {
  const fiche = enAccordeon(lire("zemmour-retraites"));
  fiche.angles_morts = { synthese: "Deux angles morts.", texte: ["Premier point.", "Second point."] };
  fiche.impact_environnement = null;
  fiche.impact_temporel_et_sectoriel = null;
  const html = renderVue("zr", fiche);
  assert.match(zone(html, "zr-angles"), /<p class="synthese">Deux angles morts\.<\/p><p>Premier point\.<\/p><p>Second point\.<\/p>/);
  assert.doesNotMatch(html, /id="zr-impact"/);
});

test("accordéon : synthèse échappée et placée dans la zone annotable (.body)", () => {
  const fiche = enAccordeon(lire("zemmour-retraites"));
  fiche.contexte_programme.synthese = `<script>alert("x")</script> & co`;
  const programme = zone(renderVue("zr", fiche), "zr-programme");
  assert.match(programme, /<div class="body"><p class="synthese">&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt; &amp; co<\/p>/);
});
