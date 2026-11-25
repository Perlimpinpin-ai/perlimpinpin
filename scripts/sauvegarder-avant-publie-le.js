// Sauvegarde AVANT la migration 20261119100000_add_analyse_publie_le
// (colonne Analyse.publieLe + rattrapage publieLe = createdAt des fiches en
// ligne). LECTURE SEULE : ce script n'écrit rien en base.
//
// Il enregistre dans logs/sauvegardes/ l'id, la mesure, le statut et les dates
// (createdAt, updatedAt) de TOUTES les analyses, plus la date de la déclaration
// de chaque mesure : de quoi vérifier après coup que le rattrapage n'a rien
// changé d'autre, et revenir en arrière (DROP COLUMN "publieLe") si besoin.
//
// Usage (la base visée est celle de $env:DATABASE_URL, affichée avant lecture) :
//   node scripts/sauvegarder-avant-publie-le.js
//
// Puis, seulement après accord d'Arno, la migration elle-même :
//   npx prisma migrate deploy

import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { avertissementBase, hoteDe } from "./lib/garde-fou-base.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SAUVEGARDES_PATH = join(ROOT, "logs", "sauvegardes");

async function main() {
  const host = hoteDe(process.env.DATABASE_URL);
  for (const ligne of avertissementBase(host)) console.log(ligne);
  console.log("Lecture seule : aucune écriture en base.\n");

  const { PrismaClient } = await import("../src/generated/prisma/client.ts");
  const { PrismaNeon } = await import("@prisma/adapter-neon");
  const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }) });

  try {
    // SQL brut : le client Prisma connaît déjà publieLe, absent de la base
    // tant que la migration n'est pas appliquée.
    const analyses = await prisma.$queryRaw`
      SELECT a.id, a."propositionId", a.statut, a."createdAt", a."updatedAt",
             p."dateDeclaration"
      FROM "Analyse" a
      JOIN "Proposition" p ON p.id = a."propositionId"
      ORDER BY a.id
    `;
    const parStatut = {};
    for (const a of analyses) parStatut[a.statut] = (parStatut[a.statut] ?? 0) + 1;

    mkdirSync(SAUVEGARDES_PATH, { recursive: true });
    const horodatage = new Date().toISOString().replace(/[:.]/g, "-");
    const fichier = join(SAUVEGARDES_PATH, `analyses-avant-publie-le-${horodatage}.json`);
    writeFileSync(
      fichier,
      `${JSON.stringify({ date: new Date().toISOString(), base: host, parStatut, analyses }, null, 2)}\n`,
    );

    console.log(`${analyses.length} analyses sauvegardées :`, parStatut);
    console.log(`Fichier : ${fichier}`);
    const aRattraper = (parStatut.publie ?? 0) + (parStatut.remplacee ?? 0);
    console.log(`Le rattrapage remplira publieLe pour ${aRattraper} analyses (publiées ou remplacées).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
