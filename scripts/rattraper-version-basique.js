// Rattrapage de la version basique (étape 3 bis) des brouillons qui n'en ont
// pas, par exemple quand les trois essais de la révision ont échoué.
// Lancé par .github/workflows/version-basique.yml (bouton « Run workflow »),
// ou à la main :
//
//   node scripts/rattraper-version-basique.js [--id N] [--appliquer]
//       sans --id : tous les brouillons (statut « brouillon ») sans version basique
//       avec --id : ce brouillon OU cette fiche publiée (24/10/2026 : fiche
//                   Le Pen « agences et intercos », publiée sans version basique)
//       sans --appliquer : simulation, liste seulement les brouillons concernés
//                          (aucun appel payant, rien n'est écrit)
//
// Pour chaque brouillon : génère la version basique à partir du contenu en base
// (genererVersionBasique, scripts/analyze.js, avec ses trois essais et ses
// contrôles), puis écrit UNIQUEMENT contenuComplet.version_basique et, dans
// auditArbitrage, l'entrée { type: "ancrages_version_basique" }, comme
// runPipeline. Aucun score, aucun statut, aucun texte de la fiche ne change.
// Une fiche publiée n'est rattrapée que si elle est désignée par --id (jamais
// en lot) ; une fiche à la corbeille ne l'est jamais. Sauvegarde de chaque
// ligne dans logs/sauvegardes/ avant écriture, ligne ajoutée à
// logs/insertions.jsonl. Sur le site, la fiche publiée affiche sa version
// basique au plus tard 5 minutes après (revalidate de /declarations/[id]).
//
// Hors GitHub Actions, l'écriture demande en plus de taper « oui »
// (garde-fou-base.js). Dans le workflow, le clic sur « Run workflow » avec la
// case « Écrire » cochée vaut confirmation.

import "dotenv/config";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { cleanContenu } from "./lib/clean-text.js";
import { avertissementBase, confirmerEcriture, hoteDe } from "./lib/garde-fou-base.js";
import { rafraichirSite } from "./rafraichir-site.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SAUVEGARDES_PATH = join(ROOT, "logs", "sauvegardes");
const INSERTIONS_LOG_PATH = join(ROOT, "logs", "insertions.jsonl");
const DANS_GITHUB = process.env.GITHUB_ACTIONS === "true";

// Résumé affiché sur la page du run GitHub (aucune donnée personnelle).
function resume(ligne) {
  console.log(ligne);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${ligne}\n`);
}

// Fiche envoyée au modèle et servant de référence aux contrôles : le contenu
// en base sans les ajouts des étapes suivantes (comme fichePourReseaux).
export function ficheDeReference(contenu) {
  const { version_basique: _basique, reseaux: _reseaux, revision: _revision, ...fiche } = contenu ?? {};
  return cleanContenu(fiche);
}

// ciblee : fiche désignée explicitement par --id, seule façon de rattraper une
// fiche publiée.
export function aBesoinDeVersionBasique(analyse, { ciblee = false } = {}) {
  const statutOk = analyse.statut === "brouillon" || (ciblee && analyse.statut === "publie");
  return statutOk && !analyse.contenuComplet?.version_basique;
}

function lienFiche(analyse) {
  return analyse.statut === "publie" ? `/declarations/${analyse.propositionId}` : `/test/${analyse.id}`;
}

async function main() {
  const { values } = parseArgs({
    options: {
      id: { type: "string" },
      appliquer: { type: "boolean", default: false },
    },
  });
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL absent.");
  if (values.id && !/^\d+$/.test(values.id)) throw new Error(`--id doit être un nombre (reçu « ${values.id} »).`);

  const { PrismaClient } = await import("../src/generated/prisma/client.ts");
  const { PrismaNeon } = await import("@prisma/adapter-neon");
  const { neonConfig } = await import("@neondatabase/serverless");
  neonConfig.webSocketConstructor = (await import("ws")).default;
  const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }) });

  const host = hoteDe(process.env.DATABASE_URL);
  for (const ligne of avertissementBase(host)) console.log(ligne);

  try {
    const where = values.id ? { id: Number(values.id) } : { statut: "brouillon" };
    const analyses = await prisma.analyse.findMany({
      where,
      orderBy: { id: "asc" },
      select: { id: true, statut: true, propositionId: true, contenuComplet: true, auditArbitrage: true },
    });

    const ciblee = Boolean(values.id);
    if (values.id && analyses.length === 0) throw new Error(`analyse #${values.id} introuvable.`);
    if (values.id && !aBesoinDeVersionBasique(analyses[0], { ciblee })) {
      const a = analyses[0];
      resume(
        a.statut !== "brouillon" && a.statut !== "publie"
          ? `Analyse #${a.id} : statut « ${a.statut} », rien n'est modifié (seuls les brouillons et les fiches publiées sont rattrapés).`
          : `Analyse #${a.id} : elle a déjà une version basique, rien n'est modifié.`,
      );
      return;
    }

    const cibles = analyses.filter((a) => aBesoinDeVersionBasique(a, { ciblee }));
    resume(`### Version basique manquante\n`);
    if (cibles.length === 0) {
      resume("Aucun brouillon sans version basique. Rien à faire.");
      return;
    }
    resume(`${cibles.length} fiche(s) sans version basique :`);
    for (const a of cibles) resume(`- #${a.id} ${a.contenuComplet?.titre_fiche ?? "(sans titre)"} (${a.statut === "publie" ? "publiée" : "brouillon"})`);
    resume("");

    if (!values.appliquer) {
      resume("Simulation : rien n'a été généré ni écrit. Relancer avec la case « Écrire » cochée.");
      return;
    }

    if (!DANS_GITHUB) {
      const ok = await confirmerEcriture({ host, question: `Générer et écrire la version basique de ${cibles.length} fiche(s) ?` });
      if (!ok) {
        console.log("Annulé, rien n'a été modifié.");
        return;
      }
    }

    // Import tardif : analyze.js n'est chargé (et l'API appelée) qu'en écriture.
    const { genererVersionBasique } = await import("./analyze.js");
    let echecs = 0;
    let publieesModifiees = 0;
    for (const analyse of cibles) {
      const titre = analyse.contenuComplet?.titre_fiche ?? "(sans titre)";
      console.log(`\nAnalyse #${analyse.id} (${analyse.statut}) : ${titre}`);
      const { versionBasique, ancrages, errors, avertissements = [] } = await genererVersionBasique(ficheDeReference(analyse.contenuComplet));
      if (!versionBasique) {
        echecs++;
        resume(`- ✗ #${analyse.id} : échec après trois essais (${errors.join(" ; ")})`);
        continue;
      }

      // Relecture juste avant l'écriture : la fiche a pu changer (édition sur
      // /test, publication, corbeille) pendant la génération. Le statut doit
      // être resté le même qu'au départ.
      const actuelle = await prisma.analyse.findUnique({
        where: { id: analyse.id },
        select: { statut: true, propositionId: true, contenuComplet: true, auditArbitrage: true },
      });
      if (!actuelle || actuelle.statut !== analyse.statut || !aBesoinDeVersionBasique({ ...actuelle, id: analyse.id }, { ciblee })) {
        resume(`- ⚠ #${analyse.id} : la fiche a changé pendant la génération (statut modifié, corbeille ou déjà complétée), rien n'est écrit.`);
        continue;
      }

      mkdirSync(SAUVEGARDES_PATH, { recursive: true });
      const horodatage = new Date().toISOString().replace(/[:.]/g, "-");
      const sauvegarde = join(SAUVEGARDES_PATH, `analyse-${analyse.id}-avant-version-basique-${horodatage}.json`);
      writeFileSync(
        sauvegarde,
        `${JSON.stringify({ base: host, analyseId: analyse.id, statut: actuelle.statut, contenuComplet: actuelle.contenuComplet, auditArbitrage: actuelle.auditArbitrage }, null, 2)}\n`,
        "utf-8",
      );

      const audit = Array.isArray(actuelle.auditArbitrage) ? actuelle.auditArbitrage : [];
      await prisma.analyse.update({
        where: { id: analyse.id },
        data: {
          contenuComplet: { ...actuelle.contenuComplet, version_basique: versionBasique },
          auditArbitrage: [
            ...audit.filter((e) => e?.type !== "ancrages_version_basique"),
            { type: "ancrages_version_basique", ancrages, ...(avertissements.length > 0 ? { avertissements } : {}) },
          ],
        },
      });
      mkdirSync(dirname(INSERTIONS_LOG_PATH), { recursive: true });
      appendFileSync(
        INSERTIONS_LOG_PATH,
        `${JSON.stringify({ date: new Date().toISOString(), base: host, script: "rattraper-version-basique", analyseId: analyse.id, sauvegarde })}\n`,
      );
      if (actuelle.statut === "publie") publieesModifiees++;
      resume(
        `- ✓ #${analyse.id} : version basique ajoutée, visible sur ${lienFiche({ ...actuelle, id: analyse.id })}` +
          (avertissements.length > 0 ? ` (${avertissements.length} extrait(s) reformulé(s), acceptés)` : ""),
      );
    }
    // Fiche publiée complétée : les pages publiques (en cache un jour) sont recalculées.
    if (publieesModifiees > 0) await rafraichirSite();
    if (echecs > 0) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error(e.message ?? e);
    process.exitCode = 1;
  });
}
