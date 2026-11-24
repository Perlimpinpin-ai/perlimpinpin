// Sauvegarde AVANT la migration 20261124100000_add_proposition_slug (colonne
// Proposition.slug + index unique) et avant scripts/remplir-slugs.js.
// LECTURE SEULE : ce script n'écrit rien en base.
//
// Il enregistre dans logs/sauvegardes/ l'id, le titre, le candidat et la date
// de création de TOUTES les mesures (Proposition), plus le statut de leurs
// analyses : de quoi vérifier après coup que seule la colonne slug a changé,
// et revenir en arrière (voir l'en-tête de la migration) si besoin.
//
// Usage (la base visée est celle de $env:DATABASE_URL, affichée avant lecture) :
//   node scripts/sauvegarder-avant-slug.js
//
// Puis, seulement après accord d'Arno :
//   npx prisma migrate deploy
//   node scripts/remplir-slugs.js            (simulation : n'écrit rien)
//   node scripts/remplir-slugs.js --ecrire   (écriture, après un « oui » tapé)

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
    // SQL brut : le client Prisma connaît déjà la colonne slug, absente de la
    // base tant que la migration n'est pas appliquée.
    const propositions = await prisma.$queryRaw`
      SELECT p.id, p.titre, p."candidatId", c.nom AS candidat, p."createdAt",
             COALESCE(json_agg(json_build_object('id', a.id, 'statut', a.statut) ORDER BY a.id)
                      FILTER (WHERE a.id IS NOT NULL), '[]') AS analyses
      FROM "Proposition" p
      JOIN "Candidat" c ON c.id = p."candidatId"
      LEFT JOIN "Analyse" a ON a."propositionId" = p.id
      GROUP BY p.id, c.nom
      ORDER BY p.id
    `;
    const publiees = propositions.filter((p) => p.analyses.some((a) => a.statut === "publie")).length;

    mkdirSync(SAUVEGARDES_PATH, { recursive: true });
    const horodatage = new Date().toISOString().replace(/[:.]/g, "-");
    const fichier = join(SAUVEGARDES_PATH, `propositions-avant-slug-${horodatage}.json`);
    writeFileSync(
      fichier,
      `${JSON.stringify({ date: new Date().toISOString(), base: host, total: propositions.length, publiees, propositions }, null, 2)}\n`,
    );

    console.log(`${propositions.length} mesures sauvegardées (dont ${publiees} avec une analyse publiée).`);
    console.log(`Fichier : ${fichier}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
