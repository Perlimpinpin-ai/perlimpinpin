// Harmonisation des thèmes des propositions (octobre 2026).
//
// Remplace, dans Proposition.theme, chaque ancienne saisie libre
// ("emploi", "Emploi et chômage", "economie"...) par le slug officiel du
// thème (src/lib/themes.js : "emploi", "economie"...).
//
// PAS une migration Prisma : aucun schéma touché, aucun besoin de
// SHADOW_DATABASE_URL — juste des updateMany() dans une transaction.
//
// Usage :
//   node scripts/harmoniser-themes.js              -> lecture seule : affiche
//                                                     ce qui serait changé
//   node scripts/harmoniser-themes.js --appliquer  -> écrit en base
//
// Sécurités :
//   - par défaut rien n'est écrit ;
//   - si une seule valeur n'est pas reconnue, rien n'est écrit (même avec
//     --appliquer) : ajouter d'abord la correspondance dans ALIAS_THEMES
//     (src/lib/themes.js) ;
//   - toutes les écritures sont faites dans une seule transaction (tout ou
//     rien) ;
//   - créer une branche de sauvegarde Neon avant --appliquer.
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { THEMES, getThemeBySlug, normaliserTheme, resolveTheme } from "../src/lib/themes.js";
import { rafraichirSite } from "./rafraichir-site.js";

neonConfig.webSocketConstructor = ws;

const appliquer = process.argv.includes("--appliquer");

// Écritures "officielles" d'un thème (slug, nom, nom court). Une valeur
// reconnue autrement l'a été via ALIAS_THEMES : choix éditorial à vérifier.
const ecrituresOfficielles = new Set(
  THEMES.flatMap((t) => [t.slug, t.name, t.shortName].filter(Boolean).map(normaliserTheme)),
);

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log(`Base : ${new URL(process.env.DATABASE_URL).host}`);
  console.log(appliquer ? "Mode : APPLICATION (écriture en base)\n" : "Mode : lecture seule (rien n'est écrit)\n");

  const groupes = await prisma.proposition.groupBy({
    by: ["theme"],
    _count: { _all: true },
    orderBy: { theme: "asc" },
  });

  const aCorriger = [];
  const inconnues = [];

  for (const groupe of groupes) {
    const valeur = groupe.theme;
    const nb = groupe._count._all;
    const slug = resolveTheme(valeur);
    const colonne = `${JSON.stringify(valeur)} (${nb} fiche${nb > 1 ? "s" : ""})`.padEnd(58);

    if (!slug) {
      inconnues.push(valeur);
      console.log(`  ✗ ${colonne} -> INCONNU`);
      continue;
    }

    const libelle = getThemeBySlug(slug).name;
    if (valeur === slug) {
      console.log(`  ✓ ${colonne} déjà propre`);
      continue;
    }

    const alias = !ecrituresOfficielles.has(normaliserTheme(valeur));
    console.log(
      `  → ${colonne} -> "${slug}" (${libelle})${alias ? "   ⚠ choix éditorial (ALIAS_THEMES)" : ""}`,
    );
    aCorriger.push({ valeur, slug, nb });
  }

  const totalFiches = aCorriger.reduce((somme, c) => somme + c.nb, 0);
  console.log(`\n${aCorriger.length} écriture(s) à corriger, ${totalFiches} fiche(s) concernée(s).`);

  if (inconnues.length > 0) {
    console.log(
      `\n${inconnues.length} valeur(s) non reconnue(s) : ${inconnues.map((v) => JSON.stringify(v)).join(", ")}.` +
        "\nAjouter leur correspondance dans ALIAS_THEMES (src/lib/themes.js), puis relancer." +
        "\nRien n'a été écrit.",
    );
    process.exitCode = 1;
    return;
  }

  if (!appliquer) {
    console.log("\nLecture seule : rien n'a été écrit. Relancer avec --appliquer pour corriger.");
    return;
  }

  if (aCorriger.length === 0) {
    console.log("Rien à faire.");
    return;
  }

  const resultats = await prisma.$transaction(
    aCorriger.map(({ valeur, slug }) =>
      prisma.proposition.updateMany({ where: { theme: valeur }, data: { theme: slug } }),
    ),
  );
  const total = resultats.reduce((somme, r) => somme + r.count, 0);
  console.log(`\nFait : ${total} fiche(s) mise(s) à jour.`);
  // Thèmes des fiches publiées modifiés : les pages publiques (en cache un jour) sont recalculées.
  await rafraichirSite();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
