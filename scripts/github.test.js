import test from "node:test";
import assert from "node:assert/strict";
import { fusionnerRevision, lienRecherchePR, verifierRevisionFusionnable } from "../src/lib/github.js";

// src/lib/github.js : PR de révision (bouton « Publier » de /test). API GitHub
// simulée, aucun appel réseau.

const PR_OUVERTE = { number: 12, html_url: "https://github.com/Perlimpinpin-ai/perlimpinpin/pull/12" };

// Réponses par URL (la dernière d'une liste se répète) ; `appels` garde tout.
function fauxGitHub(routes) {
  const appels = [];
  const compteurs = {};
  const fetchImpl = async (url, options = {}) => {
    appels.push({ url, options });
    const cle = Object.keys(routes).find((motif) => url.includes(motif));
    const liste = [].concat(routes[cle]);
    const i = Math.min(compteurs[cle] ?? 0, liste.length - 1);
    compteurs[cle] = (compteurs[cle] ?? 0) + 1;
    const { status = 200, body = {} } = liste[i];
    return { ok: status < 300, status, json: async () => body };
  };
  return { appels, fetchImpl };
}

const opts = (gh) => ({ token: "t", fetchImpl: gh.fetchImpl, attente: 0 });

test("verifierRevisionFusionnable : PR ouverte de revision/<slug>, fusionnable", async () => {
  const gh = fauxGitHub({ "pulls?state=open": { body: [PR_OUVERTE] }, "pulls/12": { body: { mergeable: true } } });
  assert.deepEqual(await verifierRevisionFusionnable("ma-fiche", opts(gh)), { ok: true, pr: { numero: 12, lien: PR_OUVERTE.html_url } });
  assert.match(gh.appels[0].url, /\/repos\/Perlimpinpin-ai\/perlimpinpin\/pulls\?state=open&head=Perlimpinpin-ai%3Arevision%2Fma-fiche$/);
  assert.equal(gh.appels[0].options.headers.Authorization, "Bearer t");
  assert.ok(gh.appels.every((a) => !a.options.method || a.options.method === "GET"), "lecture seule");
});

test("verifierRevisionFusionnable : pas de PR, conflits, calcul en cours, jeton refusé", async () => {
  const sansPR = fauxGitHub({ "pulls?state=open": { body: [] }, "pulls?state=closed": { body: [] } });
  assert.match((await verifierRevisionFusionnable("ma-fiche", opts(sansPR))).raison, /aucune pull request pour la branche revision\/ma-fiche/);
  const fermeeSansFusion = fauxGitHub({ "pulls?state=open": { body: [] }, "pulls?state=closed": { body: [{ ...PR_OUVERTE, merged_at: null }] } });
  assert.match((await verifierRevisionFusionnable("ma-fiche", opts(fermeeSansFusion))).raison, /fermée sans être fusionnée/);

  const conflits = fauxGitHub({ "pulls?state=open": { body: [PR_OUVERTE] }, "pulls/12": { body: { mergeable: false, mergeable_state: "dirty" } } });
  const r = await verifierRevisionFusionnable("ma-fiche", opts(conflits));
  assert.deepEqual(r, { ok: false, raison: "la pull request #12 a des conflits avec main (dirty)", lien: PR_OUVERTE.html_url });

  // mergeable vaut null tant que GitHub calcule : on redemande.
  const calcul = fauxGitHub({ "pulls?state=open": { body: [PR_OUVERTE] }, "pulls/12": [{ body: { mergeable: null } }, { body: { mergeable: true } }] });
  assert.equal((await verifierRevisionFusionnable("ma-fiche", opts(calcul))).ok, true);
  const toujoursNull = fauxGitHub({ "pulls?state=open": { body: [PR_OUVERTE] }, "pulls/12": { body: { mergeable: null } } });
  assert.match((await verifierRevisionFusionnable("ma-fiche", opts(toujoursNull))).raison, /calcule encore/);

  const refuse = fauxGitHub({ "pulls?state=open": { status: 403 } });
  assert.match((await verifierRevisionFusionnable("ma-fiche", opts(refuse))).raison, /Pull requests en « Read and write »/);

  assert.match((await verifierRevisionFusionnable("ma-fiche", { token: "", fetchImpl: () => assert.fail() })).raison, /GITHUB_DISPATCH_TOKEN absent/);
  assert.match((await verifierRevisionFusionnable("../x", { token: "t", fetchImpl: () => assert.fail() })).raison, /slug de révision invalide/);
});

test("fusionnerRevision : PUT merge, méthode squash, titre « Révision <slug> »", async () => {
  const gh = fauxGitHub({ "pulls/12/merge": { body: { merged: true } } });
  assert.deepEqual(await fusionnerRevision({ slug: "ma-fiche", numero: 12 }, opts(gh)), { ok: true });
  const [appel] = gh.appels;
  assert.match(appel.url, /\/pulls\/12\/merge$/);
  assert.equal(appel.options.method, "PUT");
  assert.deepEqual(JSON.parse(appel.options.body), { merge_method: "squash", commit_title: "Révision ma-fiche" });
});

test("fusionnerRevision : refus de GitHub expliqué", async () => {
  const conflit = fauxGitHub({ "pulls/12/merge": { status: 405, body: { message: "Pull Request is not mergeable" } } });
  assert.deepEqual(await fusionnerRevision({ slug: "ma-fiche", numero: 12 }, opts(conflit)), {
    ok: false,
    raison: "GitHub refuse la fusion (405) : Pull Request is not mergeable",
  });
  const droits = fauxGitHub({ "pulls/12/merge": { status: 403 } });
  assert.match((await fusionnerRevision({ slug: "ma-fiche", numero: 12 }, opts(droits))).raison, /Contents et Pull requests/);
});

test("lienRecherchePR : recherche des PR de la branche, sans appel à l'API", () => {
  assert.equal(
    lienRecherchePR("ma-fiche"),
    "https://github.com/Perlimpinpin-ai/perlimpinpin/pulls?q=is%3Apr%20head%3Arevision%2Fma-fiche",
  );
});

test("verifierRevisionFusionnable : PR déjà fusionnée à la main, publication autorisée sans fusion", async () => {
  const gh = fauxGitHub({ "pulls?state=open": { body: [] }, "pulls?state=closed": { body: [{ ...PR_OUVERTE, merged_at: "2026-10-25T14:41:31Z" }] } });
  assert.deepEqual(await verifierRevisionFusionnable("ma-fiche", opts(gh)), { ok: true, dejaFusionnee: true, pr: { numero: 12, lien: PR_OUVERTE.html_url } });
  assert.match(gh.appels[1].url, /pulls\?state=closed&head=Perlimpinpin-ai%3Arevision%2Fma-fiche$/);
  assert.ok(gh.appels.every((a) => !a.options.method || a.options.method === "GET"), "lecture seule");
});
