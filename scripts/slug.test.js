// Adresses des fiches reprenant le titre : src/lib/slug.js et src/lib/slug-db.js.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  cheminFiche,
  choisirSlug,
  estSlugValide,
  planSlugs,
  redirectionAncienneAdresse,
  resoudreParametreFiche,
  slugify,
  urlFiche,
} from "../src/lib/slug.js";
import { attribuerSlug, slugPrevu } from "../src/lib/slug-db.js";
import { retourValide } from "../src/lib/club-retour-core.js";
import { retourCourant } from "../src/lib/brouillon-club.js";
import { dossiersDeLaFiche } from "../src/lib/test-corriger.js";
import { lienAnalyse, valeursReseaux } from "../src/lib/reseaux.js";

test("slugify : accents, apostrophes, ligatures, ponctuation", () => {
  assert.equal(slugify("L'État"), "l-etat");
  assert.equal(slugify("L’État rembourse l’œuvre"), "l-etat-rembourse-l-oeuvre");
  assert.equal(slugify("Île-de-France"), "ile-de-france");
  assert.equal(slugify("Œuvre, cœur et ça !"), "oeuvre-coeur-et-ca");
  assert.equal(slugify("Supprimer les ZFE dans toutes les villes"), "supprimer-les-zfe-dans-toutes-les-villes");
  assert.equal(slugify("  --Déjà   vu ?!-- "), "deja-vu");
  assert.equal(slugify("Le Smic à 1 700 € net"), "le-smic-a-1700-euros-net");
  assert.equal(slugify("Le Smic à 1 700 €"), "le-smic-a-1700-euros");
  assert.equal(slugify("20 % de salaire en plus"), "20-pour-cent-de-salaire-en-plus");
  assert.equal(slugify(""), "");
  assert.equal(slugify(null), "");
});

test("slugify : titre très long coupé à 80 caractères sur un mot entier", () => {
  const titre =
    "Suspendre les trois pour cent de déficit pour tous les États membres de l'Union européenne pendant dix ans au moins";
  const s = slugify(titre);
  assert.ok(s.length <= 80, `${s.length} caractères`);
  assert.ok(!s.endsWith("-"));
  // Coupé sur un mot entier : le slug est un préfixe du slug complet, suivi d'un tiret.
  assert.ok(slugify(titre, 500).startsWith(`${s}-`));
  // Un seul mot trop long : coupé net.
  assert.equal(slugify("a".repeat(100)).length, 80);
});

test("choisirSlug : unique, nom du candidat puis -2, -3", () => {
  const pris = new Set();
  const estPris = (s) => pris.has(s);
  const a = choisirSlug({ titre: "Abroger la loi SRU", candidat: "Marine Le Pen", propositionId: 1 }, estPris);
  pris.add(a);
  const b = choisirSlug({ titre: "Abroger la loi SRU", candidat: "Éric Zemmour", propositionId: 2 }, estPris);
  pris.add(b);
  const c = choisirSlug({ titre: "Abroger la loi SRU", candidat: "Éric Zemmour", propositionId: 3 }, estPris);
  pris.add(c);
  const d = choisirSlug({ titre: "Abroger la loi SRU", candidat: "Éric Zemmour", propositionId: 4 }, estPris);
  assert.equal(a, "abroger-la-loi-sru");
  assert.equal(b, "abroger-la-loi-sru-eric-zemmour");
  assert.equal(c, "abroger-la-loi-sru-eric-zemmour-2");
  assert.equal(d, "abroger-la-loi-sru-eric-zemmour-3");
});

test("choisirSlug : titre vide → fiche-<id> ; titre fait de chiffres → jamais un slug numérique", () => {
  assert.equal(choisirSlug({ titre: "", candidat: "X", propositionId: 12 }, () => false), "fiche-12");
  assert.equal(choisirSlug({ titre: "2027", candidat: "Marine Le Pen", propositionId: 5 }, () => false), "2027-marine-le-pen");
  assert.equal(choisirSlug({ titre: "2027", candidat: "", propositionId: 5 }, () => false), "2027-fiche");
});

test("planSlugs : par numéro croissant, slugs existants conservés, doublons signalés", () => {
  const plan = planSlugs([
    { id: 30, titre: "Taxer les héritages", candidat: "B", slug: null },
    { id: 10, titre: "Taxer les héritages", candidat: "A", slug: null },
    { id: 20, titre: "Abolir Parcoursup", candidat: "C", slug: "abolir-parcoursup" },
    { id: 40, titre: "Abolir Parcoursup", candidat: "D", slug: null },
    { id: 50, titre: null, candidat: "E", slug: null },
  ]);
  assert.deepEqual(
    plan.map((p) => [p.id, p.slug, p.note]),
    [
      [10, "taxer-les-heritages", ""],
      [30, "taxer-les-heritages-b", "doublon : nom du candidat ajouté"],
      [40, "abolir-parcoursup-d", "doublon : nom du candidat ajouté"],
      [50, "fiche-50", "titre vide"],
    ],
  );
  assert.equal(new Set(plan.map((p) => p.slug)).size, plan.length);
});

test("cheminFiche / urlFiche : slug sinon numéro", () => {
  assert.equal(cheminFiche({ id: 103, slug: "diviser-par-deux-l-immigration-legale" }), "/declarations/diviser-par-deux-l-immigration-legale");
  assert.equal(cheminFiche({ propositionId: 103, slug: null }), "/declarations/103");
  assert.equal(urlFiche({ id: 7 }), "https://perlimpinpin.ai/declarations/7");
  assert.equal(lienAnalyse(56, "abolir-parcoursup"), "https://perlimpinpin.ai/declarations/abolir-parcoursup");
  assert.equal(lienAnalyse(56), "https://perlimpinpin.ai/declarations/56");
  assert.equal(valeursReseaux({ candidatNom: "X", score: 40, propositionId: 9, slug: "s-9" }).LIEN, "https://perlimpinpin.ai/declarations/s-9");
});

// Faux client Prisma : une table Proposition en mémoire, avec journal des écritures.
function fauxClient(lignes) {
  const ecritures = [];
  const table = lignes.map((l) => ({ ...l }));
  return {
    ecritures,
    table,
    proposition: {
      async findUnique({ where }) {
        const l = table.find((p) => p.id === where.id);
        return l ? { id: l.id, slug: l.slug, titre: l.titre, candidat: { nom: l.candidat } } : null;
      },
      async findMany({ where }) {
        return table.filter((p) => p.slug != null && p.id !== where.id.not).map((p) => ({ slug: p.slug }));
      },
      async updateMany({ where, data }) {
        ecritures.push({ where, data });
        const l = table.find((p) => p.id === where.id && p.slug === where.slug);
        if (!l) return { count: 0 };
        l.slug = data.slug;
        return { count: 1 };
      },
    },
  };
}

test("attribuerSlug : enregistré à la première publication, unique", async () => {
  const client = fauxClient([
    { id: 1, titre: "Abroger la loi SRU", candidat: "Marine Le Pen", slug: "abroger-la-loi-sru" },
    { id: 2, titre: "Abroger la loi SRU", candidat: "Éric Zemmour", slug: null },
  ]);
  assert.deepEqual(await attribuerSlug(client, 2), { slug: "abroger-la-loi-sru-eric-zemmour", nouveau: true });
  assert.equal(client.table[1].slug, "abroger-la-loi-sru-eric-zemmour");
});

test("attribuerSlug : slug inchangé après correction du titre (jamais écrasé)", async () => {
  const client = fauxClient([{ id: 3, titre: "Abolir Parcoursup", candidat: "X", slug: null }]);
  const premier = await attribuerSlug(client, 3);
  assert.equal(premier.slug, "abolir-parcoursup");
  // Coquille corrigée dans « Fiches publiées » : le titre change…
  client.table[0].titre = "Abolir Parcoursup dès 2027";
  // …puis nouvelle publication (nouvelle version) : l'adresse ne bouge pas.
  const ecrituresAvant = client.ecritures.length;
  assert.deepEqual(await attribuerSlug(client, 3), { slug: "abolir-parcoursup", nouveau: false });
  assert.equal(client.ecritures.length, ecrituresAvant, "aucune écriture");
  assert.deepEqual(await slugPrevu(client, 3), { slug: "abolir-parcoursup", existant: true });
});

test("slugPrevu (TEST_DRY_RUN) : calcule sans écrire", async () => {
  const client = fauxClient([{ id: 4, titre: "Le RSA limité à trois ans", candidat: "X", slug: null }]);
  assert.deepEqual(await slugPrevu(client, 4), { slug: "le-rsa-limite-a-trois-ans", existant: false });
  assert.equal(client.ecritures.length, 0);
  assert.equal(client.table[0].slug, null);
  assert.equal(await slugPrevu(client, 999), null);
});

const parId = async (id) => ({ 103: { id: 103, slug: "diviser-par-deux-l-immigration-legale" }, 7: { id: 7, slug: null } })[id] ?? null;
const parSlug = async (slug) => (slug === "diviser-par-deux-l-immigration-legale" ? { id: 103 } : null);

test("page : /declarations/103 redirige vers le slug, slug connu affiché", async () => {
  assert.deepEqual(await resoudreParametreFiche("103", { parId, parSlug }), {
    type: "redirection",
    chemin: "/declarations/diviser-par-deux-l-immigration-legale",
  });
  assert.deepEqual(await resoudreParametreFiche("diviser-par-deux-l-immigration-legale", { parId, parSlug }), {
    type: "fiche",
    propositionId: 103,
  });
  // Fiche pas encore dotée d'un slug : affichée à son adresse numérique.
  assert.deepEqual(await resoudreParametreFiche("7", { parId, parSlug }), { type: "fiche", propositionId: 7 });
});

test("page : 404 sur slug inconnu, numéro inconnu ou adresse mal formée", async () => {
  for (const p of ["supprimer-les-zfe-dans-toutes-les-villes", "999", "0", "Abolir", "a--b", "a_b", "%E0%A4%A", "../admin", "123"]) {
    const r = await resoudreParametreFiche(p, { parId, parSlug });
    assert.equal(r.type, "introuvable", p);
  }
});

test("proxy : /declarations/103 → 301 vers le slug, paramètres conservés", async () => {
  const lireSlug = async (id) => (id === 103 ? "diviser-par-deux-l-immigration-legale" : null);
  const r = await redirectionAncienneAdresse(new URL("https://perlimpinpin.ai/declarations/103?vue=expert"), { lireSlug });
  assert.equal(r.statut, 301);
  assert.equal(r.url.toString(), "https://perlimpinpin.ai/declarations/diviser-par-deux-l-immigration-legale?vue=expert");
  // Pas de redirection : fiche sans slug, inconnue, requête interne (RSC), adresse déjà en slug.
  assert.equal(await redirectionAncienneAdresse(new URL("https://perlimpinpin.ai/declarations/7"), { lireSlug }), null);
  assert.equal(await redirectionAncienneAdresse(new URL("https://perlimpinpin.ai/declarations/103"), { lireSlug, rsc: true }), null);
  assert.equal(await redirectionAncienneAdresse(new URL("https://perlimpinpin.ai/declarations/abolir-parcoursup"), { lireSlug }), null);
});

test("proxy : branché sur les adresses numériques, en 301", () => {
  const proxy = readFileSync(new URL("../src/proxy.js", import.meta.url), "utf8");
  assert.match(proxy, /"\/declarations\/:numero\(\\\\d\+\)"/);
  assert.match(proxy, /redirectionAncienneAdresse/);
});

test("estSlugValide", () => {
  assert.ok(estSlugValide("abolir-parcoursup"));
  assert.ok(estSlugValide("19-eleves-par-classe"));
  assert.ok(!estSlugValide("2027"));
  assert.ok(!estSlugValide("Abolir"));
  assert.ok(!estSlugValide("-abolir"));
  assert.ok(!estSlugValide("x".repeat(161)));
});

test("Club : les adresses en slug sont acceptées comme retour", () => {
  assert.equal(retourValide("/declarations/abolir-parcoursup"), "/declarations/abolir-parcoursup");
  assert.equal(retourValide("/declarations/abolir-parcoursup?vue=expert"), "/declarations/abolir-parcoursup?vue=expert");
  assert.equal(retourValide("/declarations/Abolir"), null);
  assert.equal(retourValide("/declarations/abolir/../../admin"), null);
  assert.equal(retourValide("/declarations/2027"), "/declarations/2027"); // ancienne adresse numérique
  assert.equal(retourValide("//evil.example/declarations/abolir"), null);
  const lieu = { pathname: "/declarations/abolir-parcoursup", search: "?vue=expert" };
  assert.equal(retourCourant(null, lieu), "/declarations/abolir-parcoursup?vue=expert");
});

test("dossiersDeLaFiche : reconnaît aussi un lien en slug", () => {
  const dossiers = [
    { slug: "a", texte: "voir /declarations/abolir-parcoursup" },
    { slug: "b", texte: "voir /declarations/abolir-parcoursup-bis" },
  ];
  assert.deepEqual(dossiersDeLaFiche(dossiers, 59, "abolir-parcoursup"), ["a"]);
  assert.deepEqual(dossiersDeLaFiche(dossiers, 59), []);
});

test("fiche : getDeclarationDetail renvoie le slug (canonical, og:url, partage, PDF)", () => {
  const queries = readFileSync(new URL("../src/lib/queries.js", import.meta.url), "utf8");
  const detail = queries.slice(queries.indexOf("export async function getDeclarationDetail"));
  assert.match(detail.slice(0, detail.indexOf("\n}\n")), /slug: proposition\.slug \?\? null/);
  const page = readFileSync(new URL("../src/app/declarations/[slug]/page.js", import.meta.url), "utf8");
  assert.match(page, /alternates: \{ canonical: url \}/);
  assert.match(page, /openGraph: \{ title, description, url \}/);
});
