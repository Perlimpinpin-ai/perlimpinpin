// Rapport en LECTURE SEULE : pour chaque fiche publiée, compare le score_total
// donné par le modèle (contenuComplet.notation_detaillee) et le score
// recalculé par le code (calculerScore, scripts/lib/scoring.js). Aucune fiche
// n'est modifiée : aucune écriture en base, seulement un fichier local.
//
//   $env:DATABASE_URL = "<branche Neon de test>" ; node scripts/rapport-scores.js
//   node scripts/rapport-scores.js --sortie tmp/rapport-scores.md
//
// Les fiches publiées avant le barème 2026 (sans les 7 notes de critères)
// sont listées à part : le code ne peut pas les recalculer.
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { avertissementBase, hoteDe } from "./lib/garde-fou-base.js";
import { comparerScores, rapportMarkdown } from "./lib/rapport-scores-core.js";

neonConfig.webSocketConstructor = ws;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const { values } = parseArgs({ options: { sortie: { type: "string", default: "tmp/rapport-scores.md" } } });

const host = hoteDe(process.env.DATABASE_URL);
if (!host) {
  console.error("Erreur : DATABASE_URL illisible.");
  process.exit(1);
}
for (const ligne of avertissementBase(host)) console.log(ligne);
console.log("Lecture seule : aucune écriture en base.\n");

const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }) });
try {
  const analyses = await prisma.analyse.findMany({
    where: { statut: "publie" },
    orderBy: { id: "asc" },
    select: {
      id: true,
      propositionId: true,
      scoreFaisabilite: true,
      contenuComplet: true,
      proposition: { select: { titre: true, candidat: { select: { nom: true } } } },
    },
  });
  const lignes = comparerScores(analyses);
  const chemin = join(ROOT, values.sortie);
  mkdirSync(dirname(chemin), { recursive: true });
  writeFileSync(chemin, rapportMarkdown(lignes, new Date()));
  const ecarts = lignes.filter((l) => l.statut === "ecart").length;
  const anciens = lignes.filter((l) => l.statut === "ancien_bareme").length;
  console.log(`${lignes.length} fiche(s) publiée(s) : ${ecarts} écart(s), ${anciens} ancien(s) barème(s).`);
  console.log(`Rapport : ${chemin}`);
} finally {
  await prisma.$disconnect();
}
