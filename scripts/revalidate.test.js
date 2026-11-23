import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { autorisationValide } from "../src/lib/revalidate-core.js";
import { rafraichirSite } from "./rafraichir-site.js";

const lire = (chemin) => readFileSync(new URL(`../${chemin}`, import.meta.url), "utf8");

test("autorisationValide : Bearer + bon secret seulement (fail closed)", () => {
  assert.equal(autorisationValide("Bearer s3cret", "s3cret"), true);
  assert.equal(autorisationValide("bearer   s3cret", "s3cret"), true);
  assert.equal(autorisationValide("Bearer mauvais", "s3cret"), false);
  assert.equal(autorisationValide("s3cret", "s3cret"), false);
  assert.equal(autorisationValide(null, "s3cret"), false);
  assert.equal(autorisationValide("Bearer ", "s3cret"), false);
  // Secret absent côté serveur : personne n'entre, même avec un en-tête vide.
  assert.equal(autorisationValide("Bearer undefined", undefined), false);
  assert.equal(autorisationValide("Bearer ", ""), false);
});

test("/api/revalidate : POST seul, 401 sans le secret, vide tout le site public", () => {
  const route = lire("src/app/api/revalidate/route.js");
  assert.match(route, /export async function POST/);
  assert.ok(!/export async function GET/.test(route));
  assert.match(route, /status: 401/);
  assert.ok(!/console\.\w+\([^)]*REVALIDATE_SECRET/.test(route), "le secret n'est jamais journalisé");
  const lib = lire("src/lib/rafraichir-public.js");
  assert.match(lib, /revalidatePath\("\/", "layout"\)/);
  assert.match(lib, /revalidateTag\(TAG_DECLARATIONS, \{ expire: 0 \}\)/);
});

function journal() {
  const lignes = { log: [], warn: [] };
  return { lignes, log: { log: (m) => lignes.log.push(m), warn: (m) => lignes.warn.push(m) } };
}

test("rafraichirSite : appelle la route avec le secret, sans l'afficher", async () => {
  const { lignes, log } = journal();
  let appel;
  const ok = await rafraichirSite({
    env: { REVALIDATE_SECRET: "abc123", SITE_URL: "http://localhost:3000/" },
    fetchImpl: async (url, options) => {
      appel = { url, options };
      return { ok: true, status: 200 };
    },
    log,
  });
  assert.equal(ok, true);
  assert.equal(appel.url, "http://localhost:3000/api/revalidate");
  assert.equal(appel.options.method, "POST");
  assert.equal(appel.options.headers.Authorization, "Bearer abc123");
  assert.ok(![...lignes.log, ...lignes.warn].some((l) => l.includes("abc123")));
});

test("rafraichirSite : secret absent, refus ou erreur réseau → avertissement, jamais d'exception", async () => {
  const sansSecret = journal();
  assert.equal(await rafraichirSite({ env: {}, fetchImpl: () => assert.fail("aucun appel"), log: sansSecret.log }), false);
  assert.match(sansSecret.lignes.warn[0], /REVALIDATE_SECRET absent.*https:\/\/perlimpinpin\.ai/);

  const refus = journal();
  assert.equal(await rafraichirSite({ env: { REVALIDATE_SECRET: "x" }, fetchImpl: async () => ({ ok: false, status: 401 }), log: refus.log }), false);
  assert.match(refus.lignes.warn[0], /HTTP 401/);

  const panne = journal();
  const echec = async () => {
    throw new Error("ECONNREFUSED");
  };
  assert.equal(await rafraichirSite({ env: { REVALIDATE_SECRET: "x" }, fetchImpl: echec, log: panne.log }), false);
  assert.match(panne.lignes.warn[0], /ECONNREFUSED/);
});

test("scripts de publication : rafraîchissent le site après écriture", () => {
  for (const script of ["publish", "raccourcir-titres", "rattraper-version-basique", "harmoniser-themes", "update-photo-urls"]) {
    const code = lire(`scripts/${script}.js`);
    assert.match(code, /import \{ rafraichirSite \} from "\.\/rafraichir-site\.js"/, script);
    assert.match(code, /await rafraichirSite\(\)/, script);
  }
  assert.match(lire(".github/workflows/version-basique.yml"), /REVALIDATE_SECRET: \$\{\{ secrets\.REVALIDATE_SECRET \}\}/);
});

test("pages publiques : cache d'un jour, /declarations lit la base via unstable_cache", () => {
  for (const page of [
    "src/app/page.js",
    "src/app/candidats/page.js",
    "src/app/candidats/[id]/page.js",
    "src/app/declarations/[id]/page.js",
    "src/app/themes/page.js",
    "src/app/themes/[slug]/page.js",
    "src/app/prix-perlimpinpin/page.js",
    "src/app/dossiers/[slug]/page.js",
    "src/app/sitemap.js",
  ]) {
    assert.match(lire(page), /export const revalidate = 86400;/, page);
  }
  assert.ok(!/force-dynamic/.test(lire("src/app/sitemap.js")));
  const queries = lire("src/lib/queries.js");
  assert.match(queries, /unstable_cache\(/);
  assert.match(queries, /tags: \[TAG_DECLARATIONS\]/);
});
