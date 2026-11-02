import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { validateRevisionRelecture, validateAvisCommentairesEtape2 } from "./lib/scoring.js";
import { erreursVersionSuivante } from "./relecture.js";
import {
  RevisionError, cheminsSorties, construireArchive, criteresModifies, dossierCandidat, ligneCacheEtape3, premierePhrase,
  rapportMarkdown, sourceDepuisRelecture, themeDuSite, trouverDoublon, verifierCandidat,
} from "./lib/revision-relecture.js";
import { reviser } from "./reviser-relecture.js";
import {
  addUsage, bilanCache, blocCommentaires, buildCoutPipeline, construireChampRevision, construireMessageEtape2,
  construireRequeteEtape3, retirerBloc, reunirTexteFinal,
} from "./analyze.js";

// Robot de révision (phase B) : aucun appel réseau, aucune base (dossiers
// temporaires, analyze.js et la base simulés).

const ROOT = path.resolve(import.meta.dirname, "..");
const lireJson = (p) => JSON.parse(readFileSync(path.join(ROOT, p), "utf8"));
const ETAPE3_REEL = "data/analyses finales/Zemmour/zemmour_rsa_trois_ans_etape3.json";
const V2_REEL = "data/analyses finales/Zemmour/zemmour_rsa_trois_ans_etape1_v2.json";

const COMMENTAIRES = [
  { id: "c1", sectionLabel: "Contexte national", body: "Le chiffre de 4,8 Md€ me paraît daté.", quotedText: "4,8 milliards", authorName: "Alexis D.", email: "alexis@example.org", adherentId: 3 },
  { id: "c2", sectionLabel: "Titre", body: "Titre un peu long.", quotedText: null, authorName: null },
];
const REVISION = {
  synthese: "Le chiffre est précisé, aucune note ne change.",
  reponses: [
    { commentaire_id: "c2", reponse: "Bien vu. Le titre est raccourci.\n\nMerci !", retenu: false },
    { commentaire_id: "c1", reponse: "Tu as raison : la source date de 2024. La fiche cite désormais le chiffre CNAF 2025.", retenu: true },
  ],
  notes_pour_arno: "Vérifier la source CNAF 2025.",
};

// ---------- bloc archive ----------

test("construireArchive : ids, auteur et texte copiés depuis la base, ordre des commentaires, aucun e-mail", () => {
  const archive = construireArchive({ date: "2026-10-09", versionSuivante: "data/x_etape3.json", revision: REVISION, commentaires: COMMENTAIRES });
  assert.deepEqual(Object.keys(archive), ["date", "version_suivante", "synthese", "reponses"]);
  assert.deepEqual(archive.reponses.map((r) => r.commentaire_id), ["c1", "c2"]);
  assert.deepEqual(archive.reponses[0], {
    commentaire_id: "c1",
    auteur: "Alexis D.",
    section: "Contexte national",
    commentaire: "Le chiffre de 4,8 Md€ me paraît daté.",
    reponse: REVISION.reponses[1].reponse,
    retenu: true,
  });
  assert.equal(archive.reponses[1].auteur, null);
  const texte = JSON.stringify(archive);
  assert.ok(!texte.includes("@") && !texte.includes("email") && !texte.includes("adherentId"));
});

test("construireArchive : sans commentaire, reponses vide et pas de synthèse ; réponse manquante refusée", () => {
  assert.deepEqual(construireArchive({ date: "2026-10-09", versionSuivante: "v.json", revision: null, commentaires: [] }), {
    date: "2026-10-09", version_suivante: "v.json", reponses: [],
  });
  assert.throws(
    () => construireArchive({ date: "2026-10-09", versionSuivante: "v.json", revision: { ...REVISION, reponses: [REVISION.reponses[0]] }, commentaires: COMMENTAIRES }),
    /Aucune réponse pour le commentaire c1/,
  );
});

// ---------- validation de revision_relecture et de l'avis Mistral ----------

test("validateRevisionRelecture : une réponse par commentaire, mêmes ids, retenu booléen", () => {
  assert.equal(validateRevisionRelecture(REVISION, ["c1", "c2"]).valid, true);
  const sans = (r) => validateRevisionRelecture(r, ["c1", "c2"]).errors.join("\n");
  assert.match(sans({ ...REVISION, reponses: [REVISION.reponses[0]] }), /aucune réponse pour c1/);
  assert.match(sans({ ...REVISION, reponses: [...REVISION.reponses, { commentaire_id: "zz", reponse: "x", retenu: false }] }), /inconnu\(s\) zz/);
  assert.match(sans({ ...REVISION, reponses: [...REVISION.reponses, REVISION.reponses[0]] }), /plusieurs réponses pour c2/);
  assert.match(sans({ ...REVISION, reponses: [{ ...REVISION.reponses[0], retenu: "oui" }, REVISION.reponses[1]] }), /retenu/);
  assert.match(sans({ ...REVISION, reponses: [{ ...REVISION.reponses[0], reponse: " " }, REVISION.reponses[1]] }), /reponse/);
  assert.match(sans(undefined), /\(racine\)/);
});

test("validateAvisCommentairesEtape2 : types et valeurs contrôlés", () => {
  const avis = { commentaire_id: "c1", type: "fait_a_verifier", fonde: "a_verifier", correction_proposee: null, projet_reponse: null, a_verifier: "Chiffre CNAF 2025" };
  assert.equal(validateAvisCommentairesEtape2([avis]).valid, true);
  assert.equal(validateAvisCommentairesEtape2([{ ...avis, type: "autre" }]).valid, false);
  assert.equal(validateAvisCommentairesEtape2(undefined).valid, false);
});

// ---------- version suivante au format de l'étape 3 ----------

test("erreursVersionSuivante : sortie de l'étape 3 acceptée, score incohérent refusé, ancienne v2 toujours acceptée", () => {
  const e3 = lireJson(ETAPE3_REEL);
  assert.deepEqual(erreursVersionSuivante(e3), []);
  assert.deepEqual(erreursVersionSuivante(lireJson(V2_REEL)), []);

  const faux = structuredClone(e3);
  faux.fiche_complete.notation_detaillee.score_total += 1;
  assert.match(erreursVersionSuivante(faux).join("\n"), /score : score_total incohérent/);

  const incomplet = structuredClone(e3);
  delete incomplet.fiche_complete.analyse_par_criteres;
  assert.match(erreursVersionSuivante(incomplet).join("\n"), /format étape 3 : analyse_par_criteres/);
  assert.deepEqual(erreursVersionSuivante({ fiche_complete: null }), ["fiche_complete : objet attendu."]);
});

// ---------- analyze.js : sans commentaires, rien ne change ----------

const ETAPE1 = lireJson(V2_REEL);
const MISTRAL = { parsed: { remarques: [], avis_general: "solide" } };

test("analyze.js sans commentaires : même requête qu'avant (aucun outil, message texte unique, sans les blocs)", () => {
  const body = construireRequeteEtape3(ETAPE1, MISTRAL, null);
  assert.deepEqual(Object.keys(body), ["model", "max_tokens", "thinking", "messages", "stream"]);
  assert.deepEqual(
    { model: body.model, max_tokens: body.max_tokens, thinking: body.thinking, stream: body.stream },
    { model: "claude-sonnet-5", max_tokens: 32000, thinking: { type: "disabled" }, stream: true },
  );
  assert.equal(body.messages.length, 1);
  assert.equal(typeof body.messages[0].content, "string");
  for (const texte of [body.messages[0].content, construireMessageEtape2(ETAPE1, null)]) {
    assert.ok(!texte.includes("Commentaires des relecteurs"));
    assert.ok(!texte.includes("COMMENTAIRES DU CLUB"));
    assert.ok(!texte.includes("revision_relecture"));
  }
  assert.equal(construireMessageEtape2(ETAPE1), construireMessageEtape2(ETAPE1, null));
});

// Gabarits d'avant l'ajout des blocs (commit cf0ffcb, main du 8 octobre 2026),
// découpés comme dans analyze.js.
function gabaritsAvant() {
  let texte;
  try {
    texte = execFileSync("git", ["show", "cf0ffcb:data/prompt-methodologie.md"], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return null; // historique absent (clone superficiel)
  }
  texte = texte.replace(/\r\n/g, "\n");
  const BAR = "=".repeat(80);
  const section = (h, fin) => {
    const debut = texte.indexOf(BAR, texte.indexOf(h) + h.length) + BAR.length;
    return texte.slice(debut, texte.indexOf(fin, debut)).trim();
  };
  return { etape2: section("ÉTAPE 2 :", `\n\n${BAR}\nÉTAPE 3 :`), etape3: section("ÉTAPE 3 :", "\n\n---\n\n# POINTS TECHNIQUES") };
}

test("analyze.js sans commentaires : prompts identiques, à l'octet près, à ceux d'avant les blocs", (t) => {
  const avant = gabaritsAvant();
  if (!avant) return t.skip("commit cf0ffcb indisponible");
  const remplir = (g, vars) => g.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
  const e1 = JSON.stringify(ETAPE1, null, 2);
  assert.equal(construireMessageEtape2(ETAPE1, null), remplir(avant.etape2, { reponse_etape_1: e1 }));
  assert.equal(
    construireRequeteEtape3(ETAPE1, MISTRAL, null).messages[0].content,
    remplir(avant.etape3, { reponse_etape_1: e1, reponse_etape_2_ou_null: JSON.stringify(MISTRAL.parsed, null, 2) }),
  );
});

test("analyze.js avec commentaires : blocs 6 et 9, bloc COMMENTAIRES DU CLUB à part, recherche web limitée à 3", () => {
  const commentaires = COMMENTAIRES.map(({ id, sectionLabel, body, quotedText }) => ({ id, sectionLabel, body, quotedText }));
  const body = construireRequeteEtape3(ETAPE1, MISTRAL, commentaires);
  assert.deepEqual(body.tools, [{ type: "web_search_20260209", name: "web_search", max_uses: 3 }]);
  const [gabarit, bloc] = body.messages[0].content;
  assert.match(gabarit.text, /9\. \*\*Commentaires des relecteurs/);
  assert.ok(!gabarit.text.includes("COMMENTAIRES DU CLUB ("));
  assert.equal(bloc.text, blocCommentaires(commentaires));
  // Sans les blocs, le gabarit redevient celui d'une fiche sans commentaires.
  assert.equal(
    retirerBloc(gabarit.text, "\n\n9. **Commentaires des relecteurs", "\n\n## MISE EN TEXTE FINALE"),
    construireRequeteEtape3(ETAPE1, MISTRAL, null).messages[0].content,
  );
  const m2 = construireMessageEtape2(ETAPE1, commentaires);
  assert.match(m2, /6\. \*\*Commentaires des relecteurs/);
  assert.ok(m2.endsWith(blocCommentaires(commentaires)));
  // Ni nom ni e-mail envoyés au modèle.
  assert.ok(!bloc.text.includes("Alexis") && !bloc.text.includes("@"));
  // Cache : point explicite sur la fin du message, cache automatique pour la suite.
  assert.deepEqual(body.cache_control, { type: "ephemeral" });
  assert.deepEqual(bloc.cache_control, { type: "ephemeral" });
  assert.ok(!("cache_control" in gabarit));
});

test("addUsage : nombres additionnés, objets imbriqués sommés, iterations mises bout à bout", () => {
  const a = { input_tokens: 10, cache_read_input_tokens: 5, server_tool_use: { web_search_requests: 1 }, iterations: [{ type: "message" }], service_tier: "standard" };
  const b = { input_tokens: 3, server_tool_use: { web_search_requests: 2 }, iterations: [{ type: "message" }, { type: "message" }], cache_creation: null };
  assert.deepEqual(addUsage(addUsage({}, a), b), {
    input_tokens: 13, cache_read_input_tokens: 5, server_tool_use: { web_search_requests: 3 },
    iterations: [{ type: "message" }, { type: "message" }, { type: "message" }], service_tier: "standard",
  });
});

test("cache de l'étape 3 : bilan dans coutPipeline et ligne du rapport", () => {
  assert.equal(bilanCache({ input_tokens: 100 }), null);
  const sans = buildCoutPipeline({ usage2: null, usage3: { input_tokens: 100 }, usage3bis: {} });
  assert.ok(!("cacheEtape3" in sans));
  // 1 M relus : 2 − 0,2 = 1,8 $ gagnés ; 100 000 écrits : 0,05 $ de surcoût.
  const usage3 = { input_tokens: 20_000, cache_read_input_tokens: 1_000_000, cache_creation_input_tokens: 100_000, output_tokens: 0, iterations: [{}, {}] };
  const { cacheEtape3 } = buildCoutPipeline({ usage2: null, usage3, usage3bis: {} });
  assert.deepEqual(cacheEtape3, { lus: 1_000_000, ecrits: 100_000, nonCaches: 20_000, iterations: 2, economieEstimee: 1.75 });
  assert.match(ligneCacheEtape3(cacheEtape3)[0], /1\s000\s000 tokens relus en cache, 100\s000 écrits, 20\s000 non cachés, 2 itération\(s\) côté serveur ; économie estimée ~1\.75 \$/);
  assert.match(ligneCacheEtape3(undefined)[0], /aucun token relu ni écrit en cache/);
});

test("reunirTexteFinal : texte écrit après la dernière recherche, réuni en un bloc", () => {
  const content = [
    { type: "text", text: "Je vérifie." },
    { type: "server_tool_use", name: "web_search", input: { query: "q" } },
    { type: "web_search_tool_result", content: [] },
    { type: "text", text: '{"a": ' },
    { type: "text", text: "1}", citations: [] },
  ];
  const sortie = reunirTexteFinal(content);
  assert.deepEqual(sortie.at(-1), { type: "text", text: '{"a": 1}' });
  assert.equal(sortie.filter((b) => b.type === "text").length, 1);
});

test("buildCoutPipeline : recherches web comptées seulement avec des commentaires", () => {
  const usage3 = { input_tokens: 1_000_000, output_tokens: 0 };
  const sans = buildCoutPipeline({ usage2: null, usage3, usage3bis: {} });
  assert.ok(!("recherchesWeb" in sans) && !("recherchesWeb" in sans.coutEstimeParEtape));
  const avec = buildCoutPipeline({ usage2: null, usage3, usage3bis: {}, recherchesWeb: 3 });
  assert.equal(avec.recherchesWeb, 3);
  assert.equal(avec.coutEstimeParEtape.recherchesWeb, 0.03);
  assert.equal(avec.coutEstimeTotal, Number((sans.coutEstimeTotal + 0.03).toFixed(4)));
});

// ---------- paramètres, dossier, anti-doublon ----------

test("thème : thème du site gardé, sinon table explicite signalée, sinon arrêt", () => {
  assert.deepEqual(themeDuSite("Retraites"), { theme: "Retraites", remplace: false });
  assert.deepEqual(themeDuSite("Dette et finances publiques"), {
    theme: "Perspectives économiques, pouvoir d'achat, inflation & fiscalité", remplace: true,
  });
  assert.equal(themeDuSite("Emploi et chômage").theme, "Emploi & Chômage");
  assert.throws(() => themeDuSite("Culture"), RevisionError);
});

test("source : mesure initiale seule, sans la citation", () => {
  const { relecture } = lireJson("data/relectures/lepen-budget-immigration.json");
  const s = sourceDepuisRelecture(relecture);
  assert.equal(s, relecture.mesure_initiale.trim());
  assert.ok(!s.includes("Citation :"));
  assert.equal(sourceDepuisRelecture({ mesure_initiale: " M. ", extrait: { citation: "« c »", source: "s" } }), "M.");
  assert.throws(() => sourceDepuisRelecture({ mesure_initiale: " " }), /mesure_initiale vide/);
});

test("candidat : nom exact exigé", () => {
  assert.doesNotThrow(() => verifierCandidat("Marine Le Pen", ["Marine Le Pen"]));
  assert.throws(() => verifierCandidat("Marine le Pen", ["Marine Le Pen"]), /le plus proche : « Marine Le Pen »/);
});

test("dossier : table des dossiers existants, sinon déduit du nom", () => {
  assert.deepEqual(dossierCandidat("Dominique de Villepin"), { dossier: "DeVillepin", deduit: false });
  assert.deepEqual(dossierCandidat("Édouard Philippe"), { dossier: "Philippe", deduit: true });
  assert.deepEqual(dossierCandidat("Nathalie Arthaud"), { dossier: "Arthaud", deduit: true });
  assert.deepEqual(cheminsSorties("lepen-budget-immigration", "Marine Le Pen"), {
    dossier: "LePen", deduit: false,
    etape3: "data/analyses finales/LePen/lepen_budget_immigration_etape3.json",
    mistral: "data/analyses finales/LePen/lepen_budget_immigration_etape2_mistral.json",
  });
});

test("anti-doublon : même texte, ou même titre / objectif depuis la mise en relecture", () => {
  const base = { source: "Mesure. Citation : c (s)", titre: "Titre relu", objectifCourt: "Objectif", depuis: "2026-10-07" };
  const a = (id, createdAt, objectif = "autre") => ({ id, createdAt, contenuComplet: { mesure_vers_objectif: { objectif_court: objectif } } });
  assert.equal(trouverDoublon({ ...base, propositions: [] }), null);
  assert.equal(trouverDoublon({ ...base, propositions: [{ id: 1, texteOriginal: "mesure. citation : c (s) ", analyses: [a(9, "2026-01-01")] }] }).analyseId, 9);
  assert.match(trouverDoublon({ ...base, propositions: [{ id: 2, titre: "Titre relu", texteOriginal: "x", analyses: [a(10, "2026-10-08")] }] }).critere, /même titre/);
  assert.match(trouverDoublon({ ...base, propositions: [{ id: 3, titre: "y", texteOriginal: "x", analyses: [a(11, "2026-10-08", "Objectif")] }] }).critere, /même objectif/);
  // Analyse antérieure à la mise en relecture : pas un doublon.
  assert.equal(trouverDoublon({ ...base, propositions: [{ id: 4, titre: "Titre relu", texteOriginal: "x", analyses: [a(12, "2026-10-05", "Objectif")] }] }), null);
  // Analyse mise à la corbeille depuis /test : pas un doublon (même titre ou même objectif)…
  const corbeille = (id) => ({ ...a(id, "2026-10-08", "Objectif"), statut: "corbeille" });
  assert.equal(trouverDoublon({ ...base, propositions: [{ id: 5, titre: "Titre relu", texteOriginal: "x", analyses: [corbeille(13)] }] }), null);
  // … mais une analyse vivante à côté reste un doublon,
  assert.equal(trouverDoublon({ ...base, propositions: [{ id: 6, titre: "y", texteOriginal: "x", analyses: [corbeille(14), { ...a(15, "2026-10-09", "Objectif"), statut: "brouillon" }] }] }).analyseId, 15);
  // et le même texte reste bloquant (analyze.js le refuserait).
  assert.equal(trouverDoublon({ ...base, propositions: [{ id: 7, texteOriginal: "mesure. citation : c (s)", analyses: [corbeille(16)] }] }).analyseId, 16);
});

// ---------- rapport (PR et résumé) ----------

test("rapport : score, critères modifiés, tableau des commentaires sans nom, notes, lien /test, coût", () => {
  const { relecture, ...fiche } = lireJson("data/relectures/zemmour-rsa-trois-ans.json");
  const e3 = lireJson(ETAPE3_REEL);
  e3.fiche_complete.notation_detaillee = { ...e3.fiche_complete.notation_detaillee, efficacite: 99 };
  const md = rapportMarkdown({
    slug: "zemmour-rsa-trois-ans",
    relecture,
    notationAvant: fiche.notation_detaillee,
    resultat: {
      analyseId: 57, score: 39, versionBasique: { ok: false, erreurs: ["Le nombre « 12 » n'apparaît pas"] },
      coutPipeline: { coutEstimeTotal: 0.5123, recherchesWeb: 2, coutEstimeParEtape: { etape2: 0.01, etape3: 0.45, recherchesWeb: 0.02, etape3bis: 0.03 } },
      etape2: { contreAvisMistral: { commentaires: [{ commentaire_id: "c1", type: "fait_a_verifier" }] } },
      etape3: e3,
      revisionRelecture: REVISION,
    },
    commentaires: COMMENTAIRES,
    theme: "Emploi & Chômage",
    avertissements: ["Thème remplacé."],
  });
  assert.match(md, /Brouillon : https:\/\/perlimpinpin\.ai\/test\/57/);
  assert.match(md, /Score : \d+ → \*\*39\/100\*\*/);
  assert.match(md, /Efficacité : \d+ → 99\/30/);
  assert.match(md, /\| Contexte national \| fait_a_verifier \| oui \| Tu as raison : la source date de 2024\. \|/);
  assert.match(md, /\| Titre \| \? \| non \| Bien vu\. \|/);
  assert.match(md, /Vérifier la source CNAF 2025/);
  assert.match(md, /2 recherche\(s\) web ~0\.02 \$/);
  assert.match(md, /Version basique \(étape 3 bis\) : ✗ Le nombre « 12 »/);
  assert.ok(!md.includes("Alexis") && !md.includes("@"));
});

test("premierePhrase et criteresModifies", () => {
  assert.equal(premierePhrase("Oui. Et ensuite."), "Oui.");
  assert.equal(premierePhrase("Ligne | avec barre"), "Ligne \\| avec barre");
  assert.deepEqual(criteresModifies({ efficacite: 10 }, { efficacite: 10 }), []);
});

// ---------- reviser() de bout en bout (analyze.js et base simulés) ----------

function depot(slug, modifier) {
  const root = mkdtempSync(path.join(tmpdir(), "revision-test-"));
  mkdirSync(path.join(root, "data/relectures"), { recursive: true });
  const fiche = lireJson("data/relectures/zemmour-rsa-trois-ans.json");
  delete fiche.relecture.archive;
  modifier?.(fiche);
  writeFileSync(path.join(root, "data/relectures", `${slug}.json`), JSON.stringify(fiche));
  return root;
}

function fauxAnalyze(resultatPartiel) {
  const appels = [];
  const lancerAnalyze = (args) => {
    appels.push(args);
    const sortie = args[args.indexOf("--resultat") + 1];
    writeFileSync(sortie, JSON.stringify({
      ecrit: true, analyseId: 61, score: 39, versionBasique: { ok: true, erreurs: [] },
      coutPipeline: { coutEstimeTotal: 0.4, coutEstimeParEtape: {} },
      etape2: { contreAvisMistral: { remarques: [] }, usage: {} },
      etape3: lireJson(ETAPE3_REEL),
      revisionRelecture: REVISION,
      ...resultatPartiel,
    }));
  };
  return { appels, lancerAnalyze };
}

const lireFaux = (commentaires = COMMENTAIRES, propositions = []) => async () => ({ commentaires, noms: ["Éric Zemmour"], propositions });

test("reviser : analyze.js lancé avec les bons paramètres, sorties écrites, archive construite, page reconstruite", async () => {
  const root = depot("ma-fiche");
  const sortie = path.join(root, "tmp");
  const { appels, lancerAnalyze } = fauxAnalyze();
  let builds = 0;
  const { archive, fichiers } = await reviser("ma-fiche", {
    root, sortie, lire: lireFaux(), lancerAnalyze, build: () => builds++, maintenant: new Date("2026-10-09T10:00:00Z"), log: () => {},
  });
  const args = appels[0];
  const val = (opt) => args[args.indexOf(opt) + 1];
  assert.equal(val("--candidat"), "Éric Zemmour");
  assert.equal(val("--theme"), "Emploi & Chômage");
  assert.doesNotMatch(val("--source"), /Citation :/);
  assert.ok(args.includes("--auto") && val("--seuil-score") === "0");
  // Lien brouillon ↔ PR de révision (bouton Publier de /test, phase C).
  assert.equal(val("--revision"), "ma-fiche");
  // Fichier --commentaires : ni nom ni e-mail ; étape 1 sans le bloc relecture.
  const envoyes = JSON.parse(readFileSync(val("--commentaires"), "utf8"));
  assert.deepEqual(Object.keys(envoyes[0]), ["id", "sectionLabel", "body", "quotedText"]);
  assert.ok(!("relecture" in JSON.parse(readFileSync(args[1], "utf8"))));

  assert.equal(builds, 1);
  assert.equal(archive.date, "2026-10-09");
  assert.equal(archive.version_suivante, "data/analyses finales/Zemmour/ma_fiche_etape3.json");
  const ecrite = JSON.parse(readFileSync(path.join(root, "data/relectures/ma-fiche.json"), "utf8"));
  assert.deepEqual(ecrite.relecture.archive, archive);
  assert.ok(existsSync(path.join(root, "data/analyses finales/Zemmour/ma_fiche_etape3.json")));
  assert.ok(existsSync(path.join(root, "data/analyses finales/Zemmour/ma_fiche_etape2_mistral.json")));
  assert.deepEqual(fichiers, [
    "data/relectures/ma-fiche.json", "public/relectures/index.html",
    "data/analyses finales/Zemmour/ma_fiche_etape3.json", "data/analyses finales/Zemmour/ma_fiche_etape2_mistral.json",
  ]);
  assert.match(readFileSync(path.join(sortie, "rapport.md"), "utf8"), /\/test\/61/);
  rmSync(root, { recursive: true });
});

test("reviser : relie la fiche au dossier qui la cite et ajoute le JSON du dossier à la PR", async () => {
  const root = depot("ma-fiche");
  mkdirSync(path.join(root, "data/hors-series"), { recursive: true });
  const dossier = { slug: "mouvement-social", propositions: [{ id: "p1", fiche: "ma-fiche" }, { id: "p2", fiche: "autre" }] };
  writeFileSync(path.join(root, "data/hors-series/mouvement-social.json"), `${JSON.stringify(dossier, null, 2)}\n`);
  const { lancerAnalyze } = fauxAnalyze({ propositionId: 72 });
  const { fichiers } = await reviser("ma-fiche", { root, sortie: path.join(root, "tmp"), lire: lireFaux(), lancerAnalyze, build: () => {}, log: () => {} });
  const ecrit = JSON.parse(readFileSync(path.join(root, "data/hors-series/mouvement-social.json"), "utf8"));
  assert.equal(ecrit.propositions[0].ficheId, 72);
  assert.equal(ecrit.propositions[1].ficheId, undefined);
  assert.equal(fichiers.at(-1), "data/hors-series/mouvement-social.json");
  rmSync(root, { recursive: true });
});

test("reviser : sans commentaire, pas d'option --commentaires et reponses vide", async () => {
  const root = depot("ma-fiche");
  const { appels, lancerAnalyze } = fauxAnalyze({ revisionRelecture: null });
  const { archive } = await reviser("ma-fiche", { root, sortie: path.join(root, "tmp"), lire: lireFaux([]), lancerAnalyze, build: () => {}, log: () => {} });
  assert.ok(!appels[0].includes("--commentaires"));
  assert.deepEqual(archive.reponses, []);
  rmSync(root, { recursive: true });
});

test("reviser : arrêts avant tout appel (déjà archivée, candidat inconnu, doublon)", async () => {
  const jamais = () => assert.fail("analyze.js ne doit pas être lancé");
  const opts = (root, lire) => ({ root, sortie: path.join(root, "tmp"), lire, lancerAnalyze: jamais, build: jamais, log: () => {} });

  const archivee = depot("ma-fiche", (f) => (f.relecture.archive = { date: "2026-10-01", reponses: [] }));
  await assert.rejects(reviser("ma-fiche", opts(archivee, lireFaux())), /déjà archivée/);

  const inconnu = depot("ma-fiche", (f) => (f.relecture.candidat = "Eric Zemmour"));
  await assert.rejects(reviser("ma-fiche", opts(inconnu, lireFaux())), /Candidat inconnu/);

  const doublon = depot("ma-fiche");
  const props = [{ id: 5, titre: "x", texteOriginal: "y", analyses: [{ id: 49, createdAt: "2026-10-08T10:00:00Z", contenuComplet: { mesure_vers_objectif: { objectif_court: lireJson("data/relectures/zemmour-rsa-trois-ans.json").mesure_vers_objectif.objectif_court } } }] }];
  await assert.rejects(reviser("ma-fiche", opts(doublon, lireFaux(COMMENTAIRES, props))), /Déjà analysée : analyse #49/);

  for (const root of [archivee, inconnu, doublon]) rmSync(root, { recursive: true });
});

// ---------- champ revision de contenuComplet (phase C) ----------

test("construireChampRevision : slug, réponses dans l'ordre des commentaires, ni nom ni e-mail", () => {
  const commentaires = COMMENTAIRES.map(({ id, sectionLabel, body, quotedText }) => ({ id, sectionLabel, body, quotedText }));
  const champ = construireChampRevision("ma-fiche", commentaires, REVISION);
  assert.deepEqual(champ, {
    slug: "ma-fiche",
    reponses: [
      { section: "Contexte national", commentaire: COMMENTAIRES[0].body, reponse: REVISION.reponses[1].reponse, retenu: true },
      { section: "Titre", commentaire: COMMENTAIRES[1].body, reponse: REVISION.reponses[0].reponse, retenu: false },
    ],
    synthese: REVISION.synthese,
  });
  const texte = JSON.stringify(champ);
  assert.ok(!texte.includes("Alexis") && !texte.includes("@"));
  // Révision sans commentaire : le lien vers la PR existe quand même.
  assert.deepEqual(construireChampRevision("ma-fiche", [], null), { slug: "ma-fiche", reponses: [], synthese: null });
});
