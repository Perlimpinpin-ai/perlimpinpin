import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { rafraichirSite } from "./rafraichir-site.js";

neonConfig.webSocketConstructor = ws;

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Met à jour photoUrl pour les candidats dont l'illustration vient d'être
// ajoutée dans public/photos. Ne touche à aucun autre champ (scores,
// propositions, analyses...). Éric Zemmour n'a pas besoin de mise à jour :
// son photoUrl pointait déjà vers /photos/eric-zemmour.jpg, seul le fichier
// image a changé.
const updates = [
  { nom: "David Lisnard", photoUrl: "/photos/david-lisnard.jpg" },
  { nom: "Fabien Roussel", photoUrl: "/photos/fabien-roussel.jpg" },
];

async function main() {
  for (const { nom, photoUrl } of updates) {
    const candidat = await prisma.candidat.update({
      where: { nom },
      data: { photoUrl },
    });
    console.log(`✓ ${candidat.nom} → photoUrl = ${candidat.photoUrl}`);
  }
  console.log("Mise à jour terminée.");
  // Photos affichées sur le site public (en cache un jour) : pages recalculées.
  await rafraichirSite();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
