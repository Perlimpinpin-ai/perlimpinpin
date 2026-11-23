import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ORDRE_DERNIERES_PUBLICATIONS,
  comparerPublications,
  dateChiffres,
  dateEtHeure,
  dateLongue,
  datePublication,
} from "../src/lib/date-publication.js";

// Date de publication (Analyse.publieLe) : tri des « dernières publications »,
// formats affichés, et garde-fous lus dans le code des requêtes publiques.

const lire = (chemin) => readFileSync(new URL(`../${chemin}`, import.meta.url), "utf8");

test("datePublication : publieLe d'abord, createdAt en repli", () => {
  const createdAt = new Date("2026-10-01T08:00:00Z");
  const publieLe = new Date("2026-11-19T13:32:00Z");
  assert.equal(datePublication({ createdAt, publieLe }), publieLe);
  assert.equal(datePublication({ createdAt, publieLe: null }), createdAt);
});

test("tri : une fiche publiée aujourd'hui passe devant, même si son brouillon est ancien", () => {
  const fiches = [
    { id: "hier", createdAt: new Date("2026-11-18T09:00:00Z"), publieLe: new Date("2026-11-18T10:00:00Z") },
    // Brouillon généré il y a un mois, publié à l'instant.
    { id: "a-l-instant", createdAt: new Date("2026-10-15T09:00:00Z"), publieLe: new Date("2026-11-19T13:32:00Z") },
    // Ancienne fiche dont le rattrapage aurait été oublié : repli sur createdAt.
    { id: "ancienne", createdAt: new Date("2026-09-01T09:00:00Z"), publieLe: null },
  ];
  assert.deepEqual(
    [...fiches].sort(comparerPublications).map((f) => f.id),
    ["a-l-instant", "hier", "ancienne"],
  );
});

test("tri Prisma : publieLe décroissant (vides à la fin), puis createdAt", () => {
  assert.deepEqual(ORDRE_DERNIERES_PUBLICATIONS, [
    { publieLe: { sort: "desc", nulls: "last" } },
    { createdAt: "desc" },
  ]);
});

test("formats : français, heure de Paris", () => {
  const clic = new Date("2026-11-19T13:32:00Z");
  assert.equal(dateLongue(clic), "19 novembre 2026");
  assert.equal(dateChiffres(clic), "19/11/2026");
  assert.equal(dateEtHeure(clic), "19/11/2026 à 14:32");
  // 23 h 30 UTC = 0 h 30 le lendemain à Paris : c'est le jour de Paris qui compte.
  assert.equal(dateChiffres(new Date("2026-11-19T23:30:00Z")), "20/11/2026");
});

test("listes publiques : triées sur la date de publication", () => {
  const queries = lire("src/lib/queries.js");
  // Carrousel de l'accueil, /declarations (tri par défaut), index de recherche.
  for (const fonction of ["getFeaturedRotation", "getPublishedDeclarations", "getIndexRecherche", "getMoteurRechercheComplet"]) {
    const debut = queries.indexOf(`export async function ${fonction}(`);
    assert.ok(debut >= 0, fonction);
    const corps = queries.slice(debut, queries.indexOf("\nexport ", debut + 1));
    assert.match(corps, /ORDRE_DERNIERES_PUBLICATIONS/, `${fonction} doit trier sur la date de publication`);
  }
  assert.match(queries, /dateSort: datePublication\(analyse\)/);
  // Numéro ANALYSE_XXX : même ordre (les deux requêtes).
  assert.equal(queries.match(/ORDER BY COALESCE\("publieLe", "createdAt"\) ASC, id ASC/g)?.length, 2);
  assert.ok(!/ORDER BY "createdAt" ASC\) AS rang/.test(queries));
});

test("date affichée : « Analyse réalisée le » et datePublished viennent de la date de publication ; la date de la déclaration reste dateDeclaration", () => {
  const queries = lire("src/lib/queries.js");
  assert.match(queries, /generationDateLabel: analyse \? dateChiffres\(datePublication\(analyse\)\) : null/);
  // Les cartes et l'en-tête de la fiche gardent la date de la déclaration.
  assert.match(queries, /dateLabel: dateFormatter\.format\(proposition\.dateDeclaration\)/);
  const fiche = lire("src/app/declarations/[id]/page.js");
  assert.match(fiche, /datePublished: datePublication\(analyse\)\.toISOString\(\)/);
  assert.match(fiche, /datePublished: declaration\.dateDeclaration\.toISOString\(\)/);
});

test("brouillon jamais public : chaque lecture d'analyses du site public filtre sur « publie »", () => {
  const queries = lire("src/lib/queries.js");
  // Chaque prisma.analyse.findMany de queries.js porte un filtre de statut publié.
  const appels = [...queries.matchAll(/prisma\.analyse\s*\.findMany\(\{([\s\S]*?)\n\s*\}\)/g)];
  assert.ok(appels.length >= 10);
  for (const [bloc] of appels) {
    assert.match(bloc, /statut: "publie"|statut: \{ in: STATUTS_VERSION \}/, bloc.slice(0, 120));
  }
  // Les rangs SQL aussi.
  for (const [requete] of queries.matchAll(/SELECT id, ROW_NUMBER\(\)[\s\S]*?WHERE statut = 'publie'/g)) {
    assert.ok(requete);
  }
  assert.equal(queries.match(/WHERE statut = 'publie'/g)?.length, 2);
  // La fiche publique ne lit les brouillons que pour la prévisualisation /test.
  assert.match(queries, /where: inclureBrouillons \? \{ statut: \{ not: "corbeille" \} \} : \{ statut: "publie" \}/);
});

test("cache : la publication vide tout le site public (accueil, /declarations, fiche, candidat…)", () => {
  const actions = lire("src/app/test/actions.js");
  const debut = actions.indexOf("export async function publierBrouillon");
  assert.ok(debut >= 0);
  assert.match(actions.slice(debut, actions.indexOf("\nexport ", debut + 1)), /rafraichirSitePublic\(\)/);
  assert.match(lire("src/lib/rafraichir-public.js"), /revalidatePath\("\/", "layout"\)/);
});

test("migration : uniquement additive, rattrapage sur la date actuelle des fiches en ligne", () => {
  const sql = lire("prisma/migrations/20261119100000_add_analyse_publie_le/migration.sql");
  const instructions = sql
    .split("\n")
    .filter((ligne) => ligne.trim() && !ligne.trim().startsWith("--"))
    .join("\n");
  assert.match(instructions, /^ALTER TABLE "Analyse" ADD COLUMN "publieLe" TIMESTAMP\(3\);$/m);
  assert.match(
    instructions,
    /^UPDATE "Analyse" SET "publieLe" = "createdAt" WHERE "statut" IN \('publie', 'remplacee'\) AND "publieLe" IS NULL;$/m,
  );
  assert.ok(!/DROP|DELETE|scoreFaisabilite|dateDeclaration/i.test(instructions));
});
