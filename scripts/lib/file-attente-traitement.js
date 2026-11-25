// Traitement de la file d'attente des fiches d'étape 1 (table FicheEtape1) :
// partie sans réseau, testée avec une fausse base (scripts/file-attente.test.js).
// La commande elle-même (connexion, confirmation, lancement d'analyze.js) est
// dans scripts/traiter-file-attente.js.
//
// Une fiche à la fois, les plus anciennes d'abord :
//   1. nouveau contrôle (une fiche insérée en SQL n'a pas été contrôlée par la
//      page) ; en cas d'échec, statut "erreur" et fiche suivante ;
//   2. statut "en_cours" (pris seulement si la fiche est toujours en attente) ;
//   3. étapes 2, 3, 3 bis et 3 ter par analyze.js, sans commentaires du Club ;
//   4. statut "traitee" avec analyseId, coutPipeline et traiteeAt, ou "erreur"
//      avec le message, et on continue.
// Une fiche "en_cours" depuis plus d'une heure est signalée comme bloquée,
// jamais relancée automatiquement.

import { controlerFicheEtape1, parametresPipeline } from "../../src/lib/controle-fiche-etape1.js";
import { DbNull } from "../../src/lib/file-attente.js";

export const BLOCAGE_MS = 60 * 60 * 1000;

// Début du traitement d'une fiche "en_cours" : la table n'a pas de colonne pour
// cela, il est noté dans coutPipeline ({ enCoursDepuis }) le temps du
// traitement, puis remplacé par le coût réel (ou effacé en cas d'erreur).
export function debutEnCours(ligne) {
  const d = ligne?.coutPipeline?.enCoursDepuis;
  const t = d ? new Date(d).getTime() : NaN;
  return Number.isNaN(t) ? null : new Date(t);
}

// Fiches en cours : bloquées (plus d'une heure, ou début inconnu) ou probablement
// traitées par une autre commande lancée en parallèle.
export function classerEnCours(lignes, maintenant = new Date()) {
  return lignes.map((l) => {
    const debut = debutEnCours(l);
    const minutes = debut ? Math.round((maintenant.getTime() - debut.getTime()) / 60000) : null;
    return { id: l.id, slug: l.slug, minutes, bloquee: debut == null || maintenant.getTime() - debut.getTime() > BLOCAGE_MS };
  });
}

// Coût estimé d'une fiche : moyenne des coutEstimeTotal des 20 dernières analyses qui en ont un.
export function coutMoyen(couts) {
  const n = couts.filter((c) => typeof c === "number" && Number.isFinite(c) && c > 0).slice(0, 20);
  if (!n.length) return null;
  return n.reduce((a, b) => a + b, 0) / n.length;
}

const message = (e) => String(e?.message ?? e).slice(0, 2000);

// db : client Prisma (ou fausse base). lancerPipeline(fiche, params) → résultat
// de analyze.js --resultat ({ ecrit, analyseId, score, coutPipeline, … }), ou
// lève une erreur. Aucun appel à lancerPipeline et aucune écriture en simulation.
export async function traiterFile({
  db,
  lancerPipeline,
  simulation = false,
  fiches = null,
  max = null,
  maintenant = () => new Date(),
  log = console.log,
}) {
  const resultats = [];
  const signalements = [];

  // Fiches en cours : signalées, jamais relancées.
  const enCours = await db.ficheEtape1.findMany({
    where: { statut: "en_cours" },
    select: { id: true, slug: true, coutPipeline: true },
  });
  for (const c of classerEnCours(enCours, maintenant())) {
    signalements.push(
      c.bloquee
        ? `⚠ Fiche « ${c.slug} » (n° ${c.id}) bloquée en cours${c.minutes != null ? ` depuis ${c.minutes} min` : ""} : non relancée. Vérifiez /test, puis remettez-la en attente à la main si besoin.`
        : `… Fiche « ${c.slug} » (n° ${c.id}) en cours depuis ${c.minutes} min : sans doute traitée par une autre commande.`,
    );
  }

  // Fiches demandées par --fiches qui ne sont pas en attente.
  if (fiches?.length) {
    const trouvees = await db.ficheEtape1.findMany({ where: { slug: { in: fiches } }, select: { slug: true, statut: true } });
    for (const slug of fiches) {
      const t = trouvees.find((x) => x.slug === slug);
      if (!t) resultats.push({ slug, etat: "ignoree", detail: "absente de la file" });
      else if (t.statut !== "en_attente") resultats.push({ slug, etat: "ignoree", detail: `statut ${t.statut}, pas en attente` });
    }
  }

  const aTraiter = await db.ficheEtape1.findMany({
    where: { statut: "en_attente", ...(fiches?.length ? { slug: { in: fiches } } : {}) },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    ...(max != null ? { take: max } : {}),
    select: { id: true, slug: true, contenu: true },
  });

  for (const fiche of aTraiter) {
    const { ok, erreurs } = await controlerFicheEtape1(fiche.contenu, fiche.slug, { db, ignorerId: fiche.id });
    if (!ok) {
      log(`✗ ${fiche.slug} : contrôle refusé (${erreurs.length} erreur(s)).`);
      if (!simulation) {
        await db.ficheEtape1.updateMany({ where: { id: fiche.id, statut: "en_attente" }, data: { statut: "erreur", erreurs } });
      }
      resultats.push({ slug: fiche.slug, id: fiche.id, etat: "erreur", erreurs });
      continue;
    }

    const params = parametresPipeline(fiche.contenu);
    if (simulation) {
      log(`✓ ${fiche.slug} : conforme, serait lancée (${params.candidat}, ${params.theme}).`);
      resultats.push({ slug: fiche.slug, id: fiche.id, etat: "a_lancer", candidat: params.candidat, theme: params.theme });
      continue;
    }

    // Prise de la fiche : seulement si elle est toujours en attente.
    const pris = await db.ficheEtape1.updateMany({
      where: { id: fiche.id, statut: "en_attente" },
      data: { statut: "en_cours", erreurs: DbNull, coutPipeline: { enCoursDepuis: maintenant().toISOString() } },
    });
    if (pris.count === 0) {
      resultats.push({ slug: fiche.slug, id: fiche.id, etat: "ignoree", detail: "prise entre-temps par une autre commande ou retirée" });
      continue;
    }

    log("");
    log(`▶ ${fiche.slug} (n° ${fiche.id}) : ${params.candidat}, thème « ${params.theme} ».`);
    try {
      const r = await lancerPipeline(fiche, params);
      if (!r?.ecrit || !r.analyseId) throw new Error(`analyze.js n'a rien écrit en base (${r?.raison ?? "raison inconnue"}).`);
      const avertissements = [
        ...(r.versionBasique?.erreurs ?? []).map((e) => `Version basique non produite : ${e}`),
        ...(r.reseaux?.erreurs ?? []).map((e) => `Publications X non produites : ${e}`),
      ];
      await db.ficheEtape1.update({
        where: { id: fiche.id },
        data: {
          statut: "traitee",
          analyseId: r.analyseId,
          coutPipeline: r.coutPipeline ?? DbNull,
          traiteeAt: maintenant(),
          erreurs: avertissements.length ? avertissements : DbNull,
        },
      });
      resultats.push({
        slug: fiche.slug,
        id: fiche.id,
        etat: "ok",
        analyseId: r.analyseId,
        score: r.score ?? null,
        cout: r.coutPipeline?.coutEstimeTotal ?? null,
        avertissements,
      });
    } catch (e) {
      log(`✗ ${fiche.slug} : ${message(e)}`);
      await db.ficheEtape1.update({
        where: { id: fiche.id },
        data: { statut: "erreur", erreurs: [`Pipeline : ${message(e)}`], coutPipeline: DbNull },
      });
      resultats.push({ slug: fiche.slug, id: fiche.id, etat: "erreur", erreurs: [`Pipeline : ${message(e)}`] });
    }
  }

  return { resultats, signalements };
}

// Résumé final en français.
export function resumeTraitement({ resultats, signalements }, { simulation = false, coutEstime = null, siteUrl = "https://perlimpinpin.ai" } = {}) {
  const lignes = ["", simulation ? "=== Simulation (aucun appel payant, rien d'écrit) ===" : "=== Résumé ==="];
  if (!resultats.length) lignes.push("Aucune fiche en attente.");
  let total = 0;
  for (const r of resultats) {
    if (r.etat === "ok") {
      total += r.cout ?? 0;
      lignes.push(
        `OK      ${r.slug} : score ${r.score ?? "?"}/100, ${siteUrl}/test/${r.analyseId}, coût ~${(r.cout ?? 0).toFixed(2)} $` +
          (r.avertissements?.length ? ` (${r.avertissements.length} avertissement(s))` : ""),
      );
    } else if (r.etat === "a_lancer") {
      lignes.push(`À LANCER ${r.slug} : ${r.candidat}, ${r.theme}`);
    } else if (r.etat === "erreur") {
      lignes.push(`ERREUR  ${r.slug} :`);
      for (const e of r.erreurs ?? []) lignes.push(`          - ${e}`);
    } else {
      lignes.push(`IGNORÉE ${r.slug} : ${r.detail}`);
    }
  }
  if (signalements.length) lignes.push("", ...signalements);
  if (simulation) {
    const n = resultats.filter((r) => r.etat === "a_lancer").length;
    lignes.push(
      "",
      coutEstime != null
        ? `Coût estimé : ${n} fiche(s) × ~${coutEstime.toFixed(2)} $ = ~${(n * coutEstime).toFixed(2)} $ (moyenne des 20 dernières analyses).`
        : `Coût estimé : inconnu (aucune analyse récente avec un coût en base), ${n} fiche(s) à lancer.`,
    );
  } else {
    lignes.push("", `Coût total : ~${total.toFixed(2)} $`);
  }
  return lignes.join("\n");
}
