import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  cheminsAvecTiretCadratin,
  controlerFicheEtape1,
  erreursFiche,
  parametresPipeline,
} from "../src/lib/controle-fiche-etape1.js";

// Contrôle des fiches d'étape 1 de la file d'attente, avec une FAUSSE base :
// aucune connexion réelle, et toute écriture lève une erreur.

const ROOT = path.resolve(import.meta.dirname, "..");
const FICHE = JSON.parse(readFileSync(path.join(ROOT, "data/relectures/attal-constitution-du-travail.json"), "utf8"));
const SLUG = "attal-constitution-du-travail";
const CANDIDATS = ["Gabriel Attal", "Éric Zemmour"];
const copie = () => structuredClone(FICHE);

function fausseBase({ dansFile = null, analyse = null, propositions = [] } = {}) {
  const appels = [];
  const interdit = (nom) => async () => {
    throw new Error(`ÉCRITURE INTERDITE : ${nom}`);
  };
  return {
    appels,
    candidat: { findMany: async () => CANDIDATS.map((nom) => ({ nom })) },
    ficheEtape1: {
      findFirst: async (args) => {
        appels.push({ nom: "ficheEtape1.findFirst", args });
        return dansFile;
      },
      create: interdit("ficheEtape1.create"),
      update: interdit("ficheEtape1.update"),
    },
    analyse: {
      findFirst: async (args) => {
        appels.push({ nom: "analyse.findFirst", args });
        return analyse;
      },
    },
    proposition: {
      findMany: async (args) => {
        appels.push({ nom: "proposition.findMany", args });
        return propositions;
      },
    },
  };
}

test("fiche conforme : ok, aucune erreur", async () => {
  assert.deepEqual(erreursFiche(copie(), SLUG, { nomsCandidats: CANDIDATS }), []);
  const r = await controlerFicheEtape1(copie(), SLUG, { db: fausseBase() });
  assert.deepEqual(r, { ok: true, erreurs: [], remplaceId: null });
});

test("structure d'étape 1 : section en accordéon manquante ou en texte simple refusée", () => {
  const f = copie();
  delete f.contexte_national;
  f.limites = "texte simple";
  const e = erreursFiche(f, SLUG, { nomsCandidats: CANDIDATS });
  assert.ok(e.some((x) => x.startsWith("Structure d'étape 1 : contexte_national")));
  assert.ok(e.some((x) => x.startsWith("Structure d'étape 1 : limites")));
});

test("objet JSON exigé", () => {
  for (const v of [null, [], "texte", 3]) {
    assert.match(erreursFiche(v, SLUG, { nomsCandidats: CANDIDATS }).join("\n"), /objet JSON/);
  }
});

test("bloc relecture obligatoire", () => {
  const { relecture, ...sans } = copie();
  assert.ok(relecture);
  assert.match(erreursFiche(sans, SLUG, { nomsCandidats: CANDIDATS }).join("\n"), /Bloc « relecture » absent/);
});

test("relecture.candidat : nom exact de la table Candidat, proposition si la casse ou les accents diffèrent", () => {
  const f = copie();
  f.relecture.candidat = "eric zemmour";
  const e = erreursFiche(f, SLUG, { nomsCandidats: CANDIDATS }).join("\n");
  assert.match(e, /n'est pas un candidat de la base/);
  assert.match(e, /« Éric Zemmour »/);
  f.relecture.candidat = "Inconnu";
  assert.match(erreursFiche(f, SLUG, { nomsCandidats: CANDIDATS }).join("\n"), /« Inconnu » n'est pas un candidat/);
  delete f.relecture.candidat;
  assert.match(erreursFiche(f, SLUG, { nomsCandidats: CANDIDATS }).join("\n"), /candidat : nom du candidat manquant/);
});

test("relecture.theme reconnu et relecture.mesure_initiale non vide (sinon le pipeline échouerait après avoir payé)", () => {
  const f = copie();
  f.relecture.theme = "Culture et loisirs";
  f.relecture.mesure_initiale = "  ";
  const e = erreursFiche(f, SLUG, { nomsCandidats: CANDIDATS }).join("\n");
  assert.match(e, /thème inconnu « Culture et loisirs »/);
  assert.match(e, /mesure_initiale : texte de la mesure manquant/);
});

test("slug : minuscules, chiffres et tirets seulement", () => {
  for (const s of ["Attal-Travail", "attal_travail", "attal travail", "", "a".repeat(121), undefined]) {
    assert.match(erreursFiche(copie(), s, { nomsCandidats: CANDIDATS }).join("\n"), /Nom de fiche invalide/, String(s));
  }
  assert.deepEqual(erreursFiche(copie(), "a-1-b", { nomsCandidats: CANDIDATS }), []);
});

test("tiret cadratin interdit partout, y compris dans le bloc relecture et les tableaux", () => {
  const f = copie();
  f.contexte_national.texte += " — ajout";
  f.relecture.titre = "Titre — sous-titre";
  f.sources_utilisees = [...f.sources_utilisees, "Source — 2026"];
  const chemins = cheminsAvecTiretCadratin(f);
  assert.ok(chemins.includes("contexte_national.texte"));
  assert.ok(chemins.includes("relecture.titre"));
  assert.ok(chemins.includes(`sources_utilisees[${f.sources_utilisees.length - 1}]`));
  assert.match(erreursFiche(f, SLUG, { nomsCandidats: CANDIDATS }).join("\n"), /Tiret cadratin/);
  // Le tiret demi-cadratin et le trait d'union restent permis.
  assert.deepEqual(cheminsAvecTiretCadratin({ a: "2025–2026", b: "porte-parole" }), []);
});

test("doublon dans la file : refusé, sauf la ligne elle-même (ignorerId)", async () => {
  const db = fausseBase({ dansFile: { id: 4, statut: "en_attente" } });
  const r = await controlerFicheEtape1(copie(), SLUG, { db });
  assert.equal(r.ok, false);
  assert.match(r.erreurs.join("\n"), /déjà dans la file d'attente \(fiche n° 4, statut en_attente\)/);

  const db2 = fausseBase();
  await controlerFicheEtape1(copie(), SLUG, { db: db2, ignorerId: 4 });
  const appel = db2.appels.find((a) => a.nom === "ficheEtape1.findFirst");
  assert.deepEqual(appel.args.where, { slug: SLUG, NOT: { id: 4 } });
});

test("fiche de la file en erreur ou retirée : redéposable, sa ligne sera remplacée (remplaceId)", async () => {
  for (const statut of ["erreur", "ignoree"]) {
    const r = await controlerFicheEtape1(copie(), SLUG, { db: fausseBase({ dansFile: { id: 7, statut } }) });
    assert.deepEqual(r, { ok: true, erreurs: [], remplaceId: 7 }, statut);
  }
  for (const statut of ["en_attente", "en_cours", "traitee"]) {
    const r = await controlerFicheEtape1(copie(), SLUG, { db: fausseBase({ dansFile: { id: 7, statut } }) });
    assert.equal(r.ok, false, statut);
    assert.equal(r.remplaceId, null);
  }
});

test("fiche déjà faite : analyse portant ce slug (contenuComplet.revision.slug), hors corbeille", async () => {
  const db = fausseBase({ analyse: { id: 90, statut: "publie" } });
  const r = await controlerFicheEtape1(copie(), SLUG, { db });
  assert.equal(r.ok, false);
  assert.match(r.erreurs.join("\n"), /Fiche déjà faite : l'analyse n° 90 \(publie\)/);
  const appel = db.appels.find((a) => a.nom === "analyse.findFirst");
  assert.deepEqual(appel.args.where, {
    contenuComplet: { path: ["revision", "slug"], equals: SLUG },
    NOT: { statut: "corbeille" },
  });
});

test("même mesure déjà analysée pour ce candidat (texte identique, casse et espaces ignorés)", async () => {
  const texte = FICHE.relecture.mesure_initiale;
  const db = fausseBase({ propositions: [{ id: 12, texteOriginal: `  ${texte.toUpperCase()} ` }] });
  const r = await controlerFicheEtape1(copie(), SLUG, { db });
  assert.equal(r.ok, false);
  assert.match(r.erreurs.join("\n"), /Mesure déjà analysée pour Gabriel Attal : proposition n° 12/);
});

test("base obligatoire, et aucune écriture pendant le contrôle", async () => {
  await assert.rejects(() => controlerFicheEtape1(copie(), SLUG), /base \(db\) manquante/);
  // fausseBase lève une erreur à toute écriture : le contrôle ci-dessus n'en fait aucune.
  const r = await controlerFicheEtape1(copie(), SLUG, { db: fausseBase() });
  assert.equal(r.ok, true);
});

test("parametresPipeline : analyse sans le bloc relecture, thème du site, source = mesure initiale", () => {
  const p = parametresPipeline(copie());
  assert.equal("relecture" in p.analyse, false);
  assert.equal(p.candidat, "Gabriel Attal");
  assert.equal(p.theme, "Emploi & Chômage");
  assert.equal(p.themeRemplace, true);
  assert.equal(p.source, FICHE.relecture.mesure_initiale.trim());
});
