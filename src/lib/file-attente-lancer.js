// Boutons « Lancer les étapes 2 et 3 » et « Traiter toute la file » de
// /test/depot : contrôles, puis déclenchement du workflow GitHub
// traiter-file-attente.yml (qui lance npm run file-attente). Le pipeline ne
// tourne jamais sur Vercel.
//
// Sans import de Next ni de Prisma : l'accès (isEditor), la base (prisma) et
// GitHub (enCoursGitHub, declencher) sont passés par l'appelant, ce qui permet
// de tester ces règles sans réseau (scripts/file-attente-lancer.test.js).

import { DbNull } from "./file-attente.js";
import { coutMoyen } from "../../scripts/lib/file-attente-traitement.js";

// Garde-fou de coût : « Traiter toute la file » traite au plus ce nombre de
// fiches (les plus anciennes d'abord) ; entrée `max` du workflow.
export const MAX_PAR_LANCEMENT = 5;

const SLUG = /^[a-z0-9-]{1,120}$/;
const LIBELLES = { en_attente: "en attente", en_cours: "en cours", traitee: "traitée", erreur: "en erreur", ignoree: "retirée" };

// entree : { slug } pour une fiche, ou { toute: true } pour la file.
// Résultat : { ok: true, lien, nombre, simulation? } ou { ok: false, message, lien? }.
// Seule écriture possible : une fiche « erreur » relancée repasse « en_attente »
// juste avant le déclenchement (rien en mode simulation).
export async function lancerFileAttenteCore(entree, { isEditor, prisma, enCoursGitHub, declencher, dryRun = false }) {
  if (!(await isEditor())) return { ok: false, message: "Accès réservé à l'équipe (mode édition de /test)." };

  const toute = entree?.toute === true;
  const slug = toute ? null : String(entree?.slug ?? "").trim();
  if (!toute && !SLUG.test(slug)) return { ok: false, message: "Fiche introuvable dans la file." };

  const enCours = await prisma.ficheEtape1.findFirst({ where: { statut: "en_cours" }, select: { slug: true } });
  if (enCours) return { ok: false, message: `Un traitement est déjà en cours (fiche « ${enCours.slug} »).` };

  let fiche = null;
  let nombre;
  if (toute) {
    const enAttente = await prisma.ficheEtape1.findMany({ where: { statut: "en_attente" }, select: { id: true } });
    if (!enAttente.length) return { ok: false, message: "Aucune fiche en attente dans la file." };
    nombre = Math.min(enAttente.length, MAX_PAR_LANCEMENT);
  } else {
    fiche = await prisma.ficheEtape1.findFirst({ where: { slug }, select: { id: true, statut: true } });
    if (!fiche) return { ok: false, message: "Fiche introuvable dans la file." };
    if (fiche.statut !== "en_attente" && fiche.statut !== "erreur") {
      return { ok: false, message: `La fiche « ${slug} » n'est pas en attente (elle est ${LIBELLES[fiche.statut] ?? fiche.statut}).` };
    }
    nombre = 1;
  }

  // Entre le clic et le passage de la première fiche en « en_cours » (installation
  // du runner, ~1 min), seul GitHub sait qu'un traitement est lancé.
  let run;
  try {
    run = await enCoursGitHub();
  } catch (e) {
    return { ok: false, message: e.message };
  }
  if (run) return { ok: false, message: "Un traitement est déjà en cours.", lien: run.lien };

  if (dryRun) return { ok: true, simulation: true, nombre, lien: null, message: "Mode simulation : rien n'a été écrit ni lancé." };

  // Relance d'une fiche en erreur : elle repasse en attente (statut dans le
  // filtre : une fiche modifiée entre-temps n'est pas touchée).
  const relance = fiche?.statut === "erreur";
  if (relance) {
    const { count } = await prisma.ficheEtape1.updateMany({
      where: { id: fiche.id, statut: "erreur" },
      data: { statut: "en_attente", erreurs: DbNull, coutPipeline: DbNull },
    });
    if (count === 0) return { ok: false, message: "La fiche vient de changer de statut : rechargez la page." };
  }

  try {
    const { lien } = await declencher({ fiches: toute ? [] : [slug], max: toute ? MAX_PAR_LANCEMENT : 1 });
    return { ok: true, nombre, lien };
  } catch (e) {
    return {
      ok: false,
      message: `${e.message}${relance ?" La fiche est repassée en attente : vous pouvez réessayer." : ""}`,
    };
  }
}

// Coût estimé d'une fiche pour la confirmation (même calcul que --simulation :
// moyenne des 20 dernières analyses qui ont un coût). Lecture seule.
export async function coutEstimeParFiche(prisma) {
  const analyses = await prisma.analyse.findMany({ orderBy: { createdAt: "desc" }, take: 50, select: { coutPipeline: true } });
  return coutMoyen(analyses.map((a) => a.coutPipeline?.coutEstimeTotal));
}
