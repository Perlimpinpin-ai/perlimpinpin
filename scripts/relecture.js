// Outil de relecture des fiches en brouillon (/relectures).
//
//   node scripts/relecture.js ajouter <chemin/fiche.json>
//     Vérifie la fiche (JSON, clés, cohérence du score, format Étape 1 avec
//     sections en accordéon { synthese, texte }), la copie dans
//     data/relectures/<slug>.json puis régénère public/relectures/index.html.
//
//   node scripts/relecture.js lancer <slug> [durée | --fin HH:MM] [--dry-run]
//     Vérifie que la fiche est en ligne, lance le chrono de relecture
//     (POST /api/relectures/chrono, action "start") et affiche un mail prêt à
//     copier. Durée : « 10h » (défaut), « 90min », « 2j », ou --fin 20:00 (heure
//     de Paris, aujourd'hui ou demain). Avertit si la clôture tombe entre 22h et
//     8h et propose une heure de fin en journée. Le code comité est
//     lu dans .env (RELECTURE_ADMIN_CODE) et n'est jamais affiché.
//     --dry-run : aucune requête réseau, affiche seulement ce qui serait fait.
//
// Aucune écriture directe en base : le chrono passe par l'API du site.

import { readFileSync, writeFileSync, existsSync, unlinkSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import dotenv from "dotenv";
import { checkNotationCoherence, validateEtape1Structure, validateFicheCompleteStructure } from "./lib/scoring.js";
import { formatClosedAt } from "../src/lib/relecture.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const DATA_DIR = path.join(ROOT, "data/relectures");
export const SITE_URL = "https://perlimpinpin.ai";
export const SLUG_PATTERN = /^[a-z0-9-]{1,120}$/; // même règle que /api/relectures/chrono
export const DUREE_DEFAUT = "10h";

// Clés attendues, identiques à celles des fiches de data/relectures/ (vérifié
// par scripts/relecture.test.js).
export const CLES = [
  "mesure_reformulee", "mesure_vers_objectif", "nature_et_existant", "contexte_programme",
  "contexte_national", "contexte_international", "impact_environnement", "analyse_par_criteres",
  "analyse_longevites", "impact_temporel_et_sectoriel", "ce_qui_est_etabli", "ce_qui_est_probable",
  "ce_qui_est_discutable", "ce_qui_est_inconnu", "angles_morts", "notation_detaillee",
  "verdict_final", "sources_utilisees", "niveau_de_confiance", "limites", "resume_court",
  "phrase_teasing", "relecture",
];
export const CLES_OBJECTIF = ["objectif_court", "categorie_objectif", "objectif_vise", "mecanisme_propose", "lien_causal"];
export const CLES_NOTATION = [
  "operationnalite_juridique", "qualification_juridique", "operationnalite_budgetaire",
  "qualification_budgetaire", "operationnalite_moyens_humains", "qualification_moyens_humains",
  "operationnalite_moyens_total", "plafond_applique", "plafond_declencheur", "efficacite",
  "qualification_efficacite", "effets_rebonds_externalites", "qualification_effets_rebonds",
  "degre_preparation", "qualification_preparation", "alignement_logique", "qualification_alignement",
  "score_total", "appreciation",
];
export const CLES_RELECTURE = [
  "titre", "candidat", "parti", "theme", "date", "version", "mesure_initiale", "extrait",
  "verdict_tient", "verdict_flou", "niveau_confiance", "questions",
];
// Clé ajoutée seulement quand la relecture est traitée (fiche archivée, voir
// scripts/build-relectures.js) : acceptée, jamais exigée.
export const CLES_RELECTURE_FACULTATIVES = ["archive"];

export class RelectureError extends Error {}

// ---------- ajouter ----------

function comparerCles(obj, attendues, prefixe, facultatives = []) {
  const erreurs = [];
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return [`${prefixe || "(racine)"} : objet attendu.`];
  const manquantes = attendues.filter((k) => !(k in obj));
  const enTrop = Object.keys(obj).filter((k) => !attendues.includes(k) && !facultatives.includes(k));
  const p = prefixe ? prefixe + "." : "";
  if (manquantes.length) erreurs.push(`clés manquantes : ${manquantes.map((k) => p + k).join(", ")}`);
  if (enTrop.length) erreurs.push(`clés inattendues : ${enTrop.map((k) => p + k).join(", ")}`);
  return erreurs;
}

// Liste des problèmes d'une fiche déjà parsée (tableau vide si elle est valide).
export function verifierFiche(fiche) {
  const erreurs = comparerCles(fiche, CLES, "");
  if (erreurs.length && (!fiche || typeof fiche !== "object")) return erreurs;
  erreurs.push(...comparerCles(fiche.mesure_vers_objectif, CLES_OBJECTIF, "mesure_vers_objectif"));
  erreurs.push(...comparerCles(fiche.relecture, CLES_RELECTURE, "relecture", CLES_RELECTURE_FACULTATIVES));
  const notationErr = comparerCles(fiche.notation_detaillee, CLES_NOTATION, "notation_detaillee");
  erreurs.push(...notationErr);
  if (!notationErr.length) {
    erreurs.push(...checkNotationCoherence(fiche.notation_detaillee).map((e) => `score : ${e}`));
  }
  const r = fiche.relecture;
  if (r && typeof r === "object") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(r.date))) erreurs.push("relecture.date : format AAAA-MM-JJ attendu.");
    if (!Number.isInteger(r.version) || r.version < 1) erreurs.push("relecture.version : entier ≥ 1 attendu.");
    for (const k of ["titre", "candidat", "theme"]) {
      if (typeof r[k] !== "string" || !r[k].trim()) erreurs.push(`relecture.${k} : texte non vide attendu.`);
    }
  }
  return erreurs;
}

// Format Étape 1 du pipeline (sections en accordéon { synthese, texte }, voir
// validateEtape1Structure dans scripts/lib/scoring.js), sans le bloc
// `relecture` propre à la page. Contrôlé à l'ajout d'une fiche et, dans
// scripts/publier-relecture.js, sur la version suivante. Les fiches déjà
// présentes dans data/relectures/ (texte simple) ne sont pas revalidées.
export function erreursFormatEtape1(fiche) {
  if (!fiche || typeof fiche !== "object" || Array.isArray(fiche)) return ["(racine) : objet attendu."];
  const { relecture, ...analyse } = fiche;
  return validateEtape1Structure(analyse).errors;
}

// Version suivante (data/analyses finales/…) avant publication : format
// Étape 1 (…_v2.json, rédigée à la main) ou sortie de l'étape 3 (…_etape3.json,
// robot de révision : objet à fiche_complete), et cohérence du score
// (scripts/publier-relecture.js).
export function erreursVersionSuivante(fiche) {
  if (fiche && typeof fiche === "object" && !Array.isArray(fiche) && "fiche_complete" in fiche) {
    return erreursSortieEtape3(fiche);
  }
  const erreurs = erreursFormatEtape1(fiche);
  const notation = fiche?.notation_detaillee;
  if (notation && typeof notation === "object" && !erreurs.some((e) => e.startsWith("notation_detaillee"))) {
    erreurs.push(...checkNotationCoherence(notation).map((e) => `score : ${e}`));
  }
  return erreurs;
}

// Sortie de l'étape 3 : fiche finale assemblée comme dans runPipeline
// (scripts/analyze.js) et scripts/import-etape3.js, les champs de rédaction
// à la racine primant sur ceux de fiche_complete.
function erreursSortieEtape3(sortie) {
  const fc = sortie.fiche_complete;
  if (!fc || typeof fc !== "object" || Array.isArray(fc)) return ["fiche_complete : objet attendu."];
  const finale = {
    ...fc,
    titre_fiche: sortie.titre_fiche,
    resume_court: sortie.resume_court,
    teaser_accueil: sortie.teaser_accueil,
    verdict_final: sortie.verdict_final ?? fc.verdict_final,
    verdict_conclusion: sortie.verdict_conclusion,
  };
  const { valid, errors } = validateFicheCompleteStructure(finale);
  if (!valid) return errors.map((e) => `format étape 3 : ${e}`);
  return checkNotationCoherence(finale.notation_detaillee).map((e) => `score : ${e}`);
}

export function slugDepuisChemin(chemin) {
  const slug = path.win32.basename(chemin).replace(/\.json$/i, ""); // win32 : accepte / et \
  if (!SLUG_PATTERN.test(slug)) {
    throw new RelectureError(
      `Nom de fichier invalide : « ${slug} ». Le slug (nom sans .json) doit respecter ${SLUG_PATTERN} (minuscules, chiffres, tirets).`,
    );
  }
  return slug;
}

function lancerBuild() {
  execFileSync(process.execPath, [path.join(ROOT, "scripts/build-relectures.js")], { stdio: "inherit" });
}

export function ajouter(chemin, { dataDir = DATA_DIR, build = lancerBuild, log = console.log } = {}) {
  if (!chemin) throw new RelectureError("Usage : node scripts/relecture.js ajouter <chemin/fiche.json>");
  if (!existsSync(chemin)) throw new RelectureError(`Fichier introuvable : ${chemin}`);
  const slug = slugDepuisChemin(chemin);
  const cible = path.join(dataDir, `${slug}.json`);
  if (existsSync(cible)) throw new RelectureError(`La fiche « ${slug} » existe déjà dans ${path.relative(ROOT, cible)}.`);

  const brut = readFileSync(chemin, "utf8");
  let fiche;
  try {
    fiche = JSON.parse(brut);
  } catch (e) {
    throw new RelectureError(`JSON invalide : ${e.message}`);
  }
  const erreurs = verifierFiche(fiche);
  if (fiche && typeof fiche === "object") erreurs.push(...erreursFormatEtape1(fiche).map((e) => `format Étape 1 : ${e}`));
  if (erreurs.length) throw new RelectureError(`Fiche refusée :\n- ${erreurs.join("\n- ")}`);

  writeFileSync(cible, brut.endsWith("\n") ? brut : brut + "\n");
  try {
    build();
  } catch (e) {
    unlinkSync(cible); // pas de fiche à moitié ajoutée
    throw new RelectureError(`La génération de la page a échoué, fiche retirée : ${e.message}`);
  }
  log(`✓ Fiche « ${slug} » ajoutée (${path.relative(ROOT, cible)}).`);
  log("Vérifie localhost:3000/relectures, puis commite et push.");
  return slug;
}

// ---------- lancer ----------

// « 10h », « 90min », « 2j », « 1.5h » ou un nombre seul (heures) -> { duration, unit } pour l'API.
export function parseDuree(texte = DUREE_DEFAUT) {
  const m = String(texte).trim().toLowerCase().match(/^(\d+(?:[.,]\d+)?)\s*(h|min|j)?$/);
  if (!m) throw new RelectureError(`Durée invalide : « ${texte} » (exemples : 10h, 90min, 2j).`);
  const n = Number(m[1].replace(",", "."));
  const unite = m[2] ?? "h";
  if (!(n > 0)) throw new RelectureError(`Durée invalide : « ${texte} ».`);
  const res = unite === "j" ? { duration: n * 24, unit: "h" } : { duration: n, unit: unite };
  const ms = res.duration * (res.unit === "min" ? 60e3 : 3600e3);
  if (ms < 60e3 || ms > 30 * 24 * 3600e3) throw new RelectureError("Durée invalide : entre 1 minute et 30 jours.");
  return { ...res, ms };
}

// ---------- heures de Paris ----------

// Date/heure affichées à Paris pour un instant donné.
export function partiesParis(date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    })
      .formatToParts(date)
      .filter((x) => x.type !== "literal")
      .map((x) => [x.type, Number(x.value)]),
  );
  return { y: p.year, m: p.month, d: p.day, h: p.hour, mi: p.minute };
}

// Instant correspondant à une heure locale de Paris (gère le changement d'heure).
export function instantParis(y, m, d, h, mi) {
  const voulu = Date.UTC(y, m - 1, d, h, mi);
  let t = voulu;
  for (let i = 0; i < 2; i++) {
    const p = partiesParis(new Date(t));
    t += voulu - Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi);
  }
  return new Date(t);
}

function lendemainParis(p) {
  return partiesParis(new Date(Date.UTC(p.y, p.m - 1, p.d + 1, 12)));
}

// « 20:00 » -> durée jusqu'à cette heure de Paris, aujourd'hui si elle est encore à venir, sinon demain.
export function finVersDuree(fin, now = new Date()) {
  const m = String(fin ?? "").trim().match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (!m) throw new RelectureError(`Heure de fin invalide : « ${fin} » (format HH:MM, heure de Paris, ex. 20:00).`);
  const auj = partiesParis(now);
  let cible = instantParis(auj.y, auj.m, auj.d, Number(m[1]), Number(m[2]));
  if (cible.getTime() - now.getTime() < 60e3) {
    const dem = lendemainParis(auj);
    cible = instantParis(dem.y, dem.m, dem.d, Number(m[1]), Number(m[2]));
  }
  const minutes = Math.round((cible.getTime() - now.getTime()) / 60e3);
  return { duration: minutes, unit: "min", ms: minutes * 60e3 };
}

// Clôture entre 22h et 8h, heure de Paris.
export function estNuit(date) {
  const { h } = partiesParis(date);
  return h >= 22 || h < 8;
}

// Heure de fin en journée proposée à la place d'une clôture de nuit :
// 20:00 le soir même si la clôture tombe après 22h, 09:00 le matin si elle tombe avant 8h
// (09:00 le lendemain si ce créneau est déjà passé).
export function proposerFinJournee(echeance, now = new Date()) {
  const p = partiesParis(echeance);
  let cible = instantParis(p.y, p.m, p.d, p.h >= 22 ? 20 : 9, 0);
  if (cible.getTime() - now.getTime() < 60e3) {
    const dem = lendemainParis(p);
    cible = instantParis(dem.y, dem.m, dem.d, 9, 0);
  }
  const c = partiesParis(cible);
  const hhmm = `${String(c.h).padStart(2, "0")}:${String(c.mi).padStart(2, "0")}`;
  // --fin ne vise qu'aujourd'hui ou demain : au-delà, on propose une durée.
  const ecart = cible.getTime() - now.getTime();
  const option = Math.abs(finVersDuree(hhmm, now).ms - ecart) < 60e3 ? `--fin ${hhmm}` : `${Math.round(ecart / 3600e3)}h`;
  return { cible, option };
}

export function ficheEnLigne(html, slug) {
  return String(html).includes(`data-fiche="${slug}"`);
}

export function lireFicheLocale(slug, dataDir = DATA_DIR) {
  const f = path.join(dataDir, `${slug}.json`);
  if (!existsSync(f)) throw new RelectureError(`Fiche inconnue : ${slug} (absente de ${path.relative(ROOT, dataDir)}).`);
  return JSON.parse(readFileSync(f, "utf8"));
}

export function redigerMail({ fiche, echeance, siteUrl = SITE_URL }) {
  const r = fiche.relecture;
  const cloture = formatClosedAt(new Date(echeance));
  const objet = `Relecture : ${r.titre} (${r.candidat}), jusqu'au ${cloture}`;
  const texte = [
    "Bonjour,",
    "",
    `Une nouvelle fiche est ouverte à la relecture : « ${r.titre} » (${r.candidat}).`,
    "",
    `Lien : ${siteUrl}/relectures`,
    `Clôture des commentaires : ${cloture} (heure de Paris).`,
    "",
    "Merci de commenter les sources et la méthode (chiffres, raisonnement, notation), pas l'opinion sur la mesure elle-même.",
    "",
    "Merci !",
  ].join("\n");
  return { objet, texte };
}

export function lireCodeAdmin(envPath = path.join(ROOT, ".env")) {
  if (process.env.RELECTURE_ADMIN_CODE) return process.env.RELECTURE_ADMIN_CODE;
  if (!existsSync(envPath)) return "";
  return dotenv.parse(readFileSync(envPath)).RELECTURE_ADMIN_CODE ?? "";
}

export async function lancer(
  slug,
  dureeTexte,
  { dryRun = false, fin, fetchFn = globalThis.fetch, code = lireCodeAdmin(), dataDir = DATA_DIR, siteUrl = SITE_URL, log = console.log, now = () => new Date() } = {},
) {
  if (!slug || !SLUG_PATTERN.test(slug)) {
    throw new RelectureError("Usage : node scripts/relecture.js lancer <slug> [durée, défaut 10h | --fin HH:MM] [--dry-run]");
  }
  if (fin !== undefined && dureeTexte !== undefined) {
    throw new RelectureError("Choisis soit une durée, soit --fin HH:MM, pas les deux.");
  }
  const debut = now();
  const duree = fin !== undefined ? finVersDuree(fin, debut) : parseDuree(dureeTexte ?? DUREE_DEFAUT);
  const fiche = lireFicheLocale(slug, dataDir);
  if (!code || code.length < 12) {
    throw new RelectureError("RELECTURE_ADMIN_CODE absent ou trop court dans .env (12 caractères minimum).");
  }
  const pageUrl = `${siteUrl}/relectures/`;
  const apiUrl = `${siteUrl}/api/relectures/chrono`;
  const corps = { ficheSlug: slug, action: "start", duration: duree.duration, unit: duree.unit };

  const estimee = new Date(debut.getTime() + duree.ms);
  if (estNuit(estimee)) {
    const { cible, option } = proposerFinJournee(estimee, debut);
    log(`⚠ La clôture tomberait la nuit (${formatClosedAt(estimee)}, heure de Paris).`);
    log(`  Proposition en journée : ${formatClosedAt(cible)} → node scripts/relecture.js lancer ${slug} ${option}${dryRun ? " --dry-run" : ""}`);
  }

  let echeance;
  if (dryRun) {
    log("[dry-run] Aucune requête envoyée. Ce qui serait fait :");
    log(`  1. GET ${pageUrl} et vérifier qu'elle contient data-fiche="${slug}"`);
    log(`     en-tête x-relecture-admin-code : lu dans .env (masqué) — la page est réservée aux adhérents`);
    log(`  2. POST ${apiUrl}`);
    log(`     en-tête x-relecture-admin-code : lu dans .env (masqué)`);
    log(`     corps : ${JSON.stringify(corps)}`);
    echeance = estimee;
    log(`  Échéance estimée : ${formatClosedAt(echeance)} (heure de Paris)`);
  } else {
    // La page est réservée aux adhérents du Club : le code comité en ouvre la
    // lecture seule (voir lectureComiteAutorisee dans src/lib/relecture-auth-core.js).
    const page = await fetchFn(pageUrl, { headers: { "cache-control": "no-cache", "x-relecture-admin-code": code } });
    // Code refusé : le site renvoie vers la page de connexion (redirection suivie par fetch).
    if (page.redirected && /\/relectures\/connexion/.test(page.url ?? "")) {
      throw new RelectureError(`Lecture de ${pageUrl} refusée : code comité (RELECTURE_ADMIN_CODE) non reconnu par le site.`);
    }
    if (!page.ok) throw new RelectureError(`Impossible de lire ${pageUrl} (HTTP ${page.status}).`);
    if (!ficheEnLigne(await page.text(), slug)) {
      throw new RelectureError(`La fiche « ${slug} » n'est pas encore déployée sur ${pageUrl} : attends la fin du déploiement Vercel.`);
    }
    const res = await fetchFn(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-relecture-admin-code": code },
      body: JSON.stringify(corps),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) throw new RelectureError("Code comité refusé par le site (RELECTURE_ADMIN_CODE).");
    if (!res.ok) throw new RelectureError(`Chrono non lancé (HTTP ${res.status}) : ${data.error ?? "erreur inconnue"}`);
    echeance = new Date(data.fiche.reviewDeadline);
    log(`✓ Chrono lancé pour « ${slug} » : clôture le ${formatClosedAt(echeance)} (heure de Paris).`);
  }

  const mail = redigerMail({ fiche, echeance, siteUrl });
  log("\n----- Mail à copier -----");
  log(`Objet : ${mail.objet}\n`);
  log(mail.texte);
  log("-------------------------");
  return { echeance, mail, corps };
}

// ---------- CLI ----------

async function main(argv) {
  const dryRun = argv.includes("--dry-run");
  let reste = argv.filter((a) => a !== "--dry-run");
  let fin;
  const iFin = reste.indexOf("--fin");
  if (iFin >= 0) {
    fin = reste[iFin + 1];
    if (!fin || fin.startsWith("--")) throw new RelectureError("--fin attend une heure HH:MM (heure de Paris), ex. --fin 20:00.");
    reste = reste.filter((_, i) => i !== iFin && i !== iFin + 1);
  }
  const [commande, ...args] = reste;
  if (commande === "ajouter") return ajouter(args[0]);
  if (commande === "lancer") return lancer(args[0], args[1], { dryRun, fin });
  throw new RelectureError(
    "Usage :\n  node scripts/relecture.js ajouter <chemin/fiche.json>\n  node scripts/relecture.js lancer <slug> [durée, défaut 10h | --fin HH:MM] [--dry-run]",
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((e) => {
    console.error(e instanceof RelectureError ? `✗ ${e.message}` : e);
    process.exit(1);
  });
}

// Utilisé par les tests pour comparer CLES aux fiches existantes.
export function fichesExistantes(dataDir = DATA_DIR) {
  return readdirSync(dataDir).filter((f) => f.endsWith(".json"));
}
