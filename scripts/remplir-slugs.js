// Remplit Proposition.slug (adresse /declarations/<slug>) des fiches DÉJÀ
// publiées, une seule fois. Règles : src/lib/slug.js (planSlugs).
//
// Par défaut : SIMULATION. Affiche la liste « id → slug » (avec les doublons
// signalés) et n'écrit RIEN. L'écriture n'a lieu qu'avec --ecrire, après
// affichage de la base visée et un « oui » tapé (scripts/lib/garde-fou-base.js).
//
// Ne touche qu'à la colonne slug, et seulement là où elle est vide : un slug
// déjà enregistré n'est jamais modifié. Aucun score, aucun texte n'est touché.
//
// Prérequis : migration 20261124100000_add_proposition_slug appliquée, et
// sauvegarde faite (node scripts/sauvegarder-avant-slug.js).
//
// Usage (base = $env:DATABASE_URL, affichée avant toute lecture) :
//   node scripts/remplir-slugs.js            (simulation)
//   node scripts/remplir-slugs.js --ecrire   (écriture)
// Puis vider le cache du site : node scripts/rafraichir-site.js

import "dotenv/config";
import { avertissementBase, confirmerEcriture, hoteDe } from "./lib/garde-fou-base.js";
import { planSlugs } from "../src/lib/slug.js";

async function main() {
  const ecrire = process.argv.includes("--ecrire");
  const host = hoteDe(process.env.DATABASE_URL);
  for (const ligne of avertissementBase(host)) console.log(ligne);
  console.log(ecrire ? "Mode ÉCRITURE (confirmation demandée avant d'écrire).\n" : "SIMULATION : rien n'est écrit en base.\n");

  const { PrismaClient } = await import("../src/generated/prisma/client.ts");
  const { PrismaNeon } = await import("@prisma/adapter-neon");
  const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }) });

  try {
    // La simulation marche aussi AVANT la migration (colonne absente : aucun
    // slug existant) ; l'écriture, non.
    const [{ existe }] = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Proposition' AND column_name = 'slug'
      ) AS existe`;
    if (!existe) {
      console.log("Colonne Proposition.slug absente : migration pas encore appliquée (simulation seulement).\n");
      if (ecrire) {
        console.log("Écriture impossible avant `npx prisma migrate deploy`. Rien n'a été écrit.");
        return;
      }
    }

    // Toutes les mesures ayant (ou ayant eu) une version en ligne, plus celles
    // qui ont déjà un slug (pour l'unicité).
    const lignes = existe
      ? await prisma.$queryRaw`
          SELECT p.id, p.titre, p.slug, c.nom AS candidat
          FROM "Proposition" p JOIN "Candidat" c ON c.id = p."candidatId"
          WHERE p.slug IS NOT NULL
             OR EXISTS (SELECT 1 FROM "Analyse" a WHERE a."propositionId" = p.id AND a.statut IN ('publie', 'remplacee'))
          ORDER BY p.id`
      : await prisma.$queryRaw`
          SELECT p.id, p.titre, NULL AS slug, c.nom AS candidat
          FROM "Proposition" p JOIN "Candidat" c ON c.id = p."candidatId"
          WHERE EXISTS (SELECT 1 FROM "Analyse" a WHERE a."propositionId" = p.id AND a.statut IN ('publie', 'remplacee'))
          ORDER BY p.id`;
    const fiches = lignes.map((l) => ({ id: Number(l.id), titre: l.titre, slug: l.slug, candidat: l.candidat }));
    const plan = planSlugs(fiches);
    const dejaFaites = fiches.length - plan.length;

    for (const p of plan) {
      console.log(`${String(p.id).padStart(4)} → ${p.slug}${p.note ? `   ⚠ ${p.note}` : ""}`);
    }
    console.log(`\n${plan.length} slug(s) à enregistrer ; ${dejaFaites} fiche(s) en ont déjà un (inchangé).`);
    const signales = plan.filter((p) => p.note);
    console.log(signales.length ? `${signales.length} cas signalé(s) ci-dessus (⚠).` : "Aucun doublon, aucun titre vide.");

    if (!ecrire || plan.length === 0) return;
    const ok = await confirmerEcriture({ host, question: `Enregistrer ces ${plan.length} slugs ?` });
    if (!ok) {
      console.log("Annulé : rien n'a été écrit.");
      return;
    }

    // Une seule transaction : tout ou rien. `slug: null` dans le filtre : un
    // slug apparu entre-temps n'est jamais écrasé.
    const ecrits = await prisma.$transaction(
      plan.map((p) => prisma.proposition.updateMany({ where: { id: p.id, slug: null }, data: { slug: p.slug } })),
    );
    const total = ecrits.reduce((n, r) => n + r.count, 0);
    console.log(`${total} slug(s) enregistré(s).`);
    if (total !== plan.length) console.log(`⚠ ${plan.length - total} fiche(s) avaient déjà un slug au moment d'écrire : laissées telles quelles.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
