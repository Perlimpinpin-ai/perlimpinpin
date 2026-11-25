import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const value = argv[i + 1];
      args[key] = value;
      i++;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const analyseId = Number(args.id ?? process.argv[2]);

  if (!Number.isInteger(analyseId)) {
    console.error(
      "Usage: node scripts/publish.js --id <analyseId>",
    );
    process.exitCode = 1;
    return;
  }

  const analyse = await prisma.analyse.findUnique({
    where: { id: analyseId },
    include: { proposition: true },
  });

  if (!analyse) {
    console.error(`Aucune analyse trouvée avec l'id ${analyseId}.`);
    process.exitCode = 1;
    return;
  }

  if (analyse.statut !== "brouillon") {
    console.error(
      `L'analyse ${analyseId} n'est pas un brouillon (statut : ${analyse.statut}) : publication refusée.`,
    );
    process.exitCode = 1;
    return;
  }

  const candidatId = analyse.proposition.candidatId;

  await prisma.analyse.update({
    where: { id: analyseId },
    // publieLe : date de publication (moment du lancement), comme le bouton
    // « Publier » de /test (src/lib/test-publier.js).
    data: { statut: "publie", publieLe: new Date() },
  });

  const { _avg } = await prisma.analyse.aggregate({
    where: {
      statut: "publie",
      proposition: { candidatId },
    },
    _avg: { scoreFaisabilite: true },
  });

  const candidat = await prisma.candidat.update({
    where: { id: candidatId },
    data: { scoreMoyen: _avg.scoreFaisabilite ?? null },
  });

  console.log("");
  console.log(`Analyse #${analyseId} publiée.`);
  console.log(
    `Candidat : ${candidat.nom} — nouveau scoreMoyen : ${candidat.scoreMoyen}`,
  );
  console.log("");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
