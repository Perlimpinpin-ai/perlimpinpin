// Automatise les deux moments du traitement d'une relecture qui demandent un
// terminal sur l'ordinateur (à lancer depuis la copie « main » du projet).
//
//   node scripts/publier-relecture.js <slug> --commentaires
//       → AVANT le traitement : lit les commentaires de la fiche en base
//         (lecture seule) et les écrit dans tmp/commentaires-<slug>.json, en UTF-8.
//         Ce fichier contient les noms des adhérents : le supprimer après.
//
//   node scripts/publier-relecture.js <slug>
//       → APRÈS le traitement, simulation (par défaut) : vérifie que la fiche
//         est archivée, reconstruit public/relectures/index.html, vérifie que la
//         fiche est bien classée dans les archives et affiche les fichiers qui
//         seraient envoyés. N'envoie RIEN.
//
//   node scripts/publier-relecture.js <slug> --publier
//       → mêmes vérifications, puis demande de taper « oui » et fait
//         git add + git commit + git push sur ces seuls fichiers :
//           data/relectures/<slug>.json
//           la version suivante (relecture.archive.version_suivante)
//         Les autres fichiers modifiés ne sont jamais inclus.
//         public/relectures/index.html n'est plus commitée : Vercel la génère
//         à chaque déploiement (npm run build), voir .gitignore.
//
// Garde-fous : branche main uniquement, copie à jour avec origin/main,
// bloc archive présent, version suivante présente, JSON valide et au format
// Étape 1 du pipeline (sections en accordéon) ou sortie de l'étape 3 (robot de
// révision), score cohérent, y compris en simulation.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { erreursVersionSuivante } from "./relecture.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const USAGE = "Usage : node scripts/publier-relecture.js <slug> [--commentaires | --publier]";

function fail(message) {
  console.error(`Erreur : ${message}`);
  process.exit(1);
}

function run(cmd, args, { allowFail = false } = {}) {
  const r = spawnSync(cmd, args, { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.error) fail(`impossible de lancer « ${cmd} » (${r.error.message}).`);
  if (r.status !== 0 && !allowFail) {
    fail(`« ${cmd} ${args.join(" ")} » a échoué :\n${(r.stderr || r.stdout || "").trim()}`);
  }
  return r;
}

const git = (...args) => run("git", args).stdout.trim();

const { values, positionals } = parseArgs({
  options: {
    commentaires: { type: "boolean", default: false },
    publier: { type: "boolean", default: false },
  },
  allowPositionals: true,
  strict: true,
});

if (positionals.length !== 1) fail(`un seul slug attendu.\n${USAGE}`);
if (values.commentaires && values.publier) fail("choisissez --commentaires OU --publier, pas les deux.");
const slug = positionals[0];
if (!/^[a-z0-9-]+$/.test(slug)) fail(`slug invalide « ${slug} » (minuscules, chiffres et tirets).\n${USAGE}`);

// ---------- 1. Commentaires (lecture seule) ----------
if (values.commentaires) {
  const r = run(process.execPath, ["scripts/relecture-comments.js", slug, "--json"]);
  let list;
  try {
    list = JSON.parse(r.stdout);
  } catch {
    fail(`la sortie de relecture-comments.js n'est pas du JSON :\n${r.stdout.slice(0, 500)}`);
  }
  const out = join(ROOT, "tmp", `commentaires-${slug}.json`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(list, null, 2)}\n`, "utf8");
  console.log(`✓ ${list.length} commentaire(s) pour « ${slug} » → tmp/commentaires-${slug}.json`);
  if (list.length === 0) console.log("  Aucun commentaire : vérifiez le slug si ce n'est pas attendu.");
  console.log("  Ce fichier contient les noms des adhérents : supprimez-le une fois la relecture traitée.");
  process.exit(0);
}

// ---------- 2. Vérifications ----------
const branche = git("rev-parse", "--abbrev-ref", "HEAD");
if (branche !== "main") fail(`vous êtes sur la branche « ${branche} ». Lancez ce script depuis la copie « main » du projet.`);

console.log("Vérification que la copie est à jour avec GitHub…");
run("git", ["fetch", "--quiet", "origin", "main"]);
const enRetard = Number(git("rev-list", "--count", "HEAD..origin/main"));
if (enRetard > 0) fail(`la copie a ${enRetard} commit(s) de retard sur origin/main. Faites d'abord « git pull ».`);

const source = `data/relectures/${slug}.json`;
let fiche;
try {
  fiche = JSON.parse(readFileSync(join(ROOT, source), "utf8"));
} catch (error) {
  fail(`lecture de ${source} impossible (${error.code ?? error.message}).`);
}
const archive = fiche.relecture?.archive;
if (!archive) fail(`${source} : pas de bloc relecture.archive. La relecture n'a pas encore été traitée.`);
if (!/^\d{4}-\d{2}-\d{2}$/.test(archive.date ?? "")) fail(`${source} : archive.date manquante ou pas au format AAAA-MM-JJ.`);

const fichiers = [source];
const suivante = archive.version_suivante;
if (suivante) {
  if (!existsSync(join(ROOT, suivante))) fail(`version suivante introuvable : ${suivante}`);
  let ficheSuivante;
  try {
    ficheSuivante = JSON.parse(readFileSync(join(ROOT, suivante), "utf8"));
  } catch {
    fail(`version suivante illisible (JSON invalide) : ${suivante}`);
  }
  const erreursSuivante = erreursVersionSuivante(ficheSuivante);
  if (erreursSuivante.length) {
    fail(
      `version suivante non conforme : ${suivante}\n- ${erreursSuivante.join("\n- ")}\n` +
        "La version suivante doit être au format Étape 1 du pipeline (sections en accordéon { synthese, texte }) ou être la sortie de l'étape 3 (fiche_complete).",
    );
  }
  fichiers.push(suivante);
} else {
  console.log("⚠ Pas de version_suivante dans le bloc archive : seule la page sera publiée.");
}

// ---------- 3. Reconstruction de la page ----------
console.log("Reconstruction de la page /relectures…");
const build = run(process.execPath, ["scripts/build-relectures.js"]);
const ligne = build.stdout.trim().split("\n").pop();
console.log(`  ${ligne}`);
const archivees = /archivée\(s\) \(([^)]*)\)/.exec(ligne)?.[1] ?? "";
if (!archivees.split(", ").includes(slug)) fail(`la page ne classe pas « ${slug} » dans les archives.`);
if (build.stderr.trim()) console.log(build.stderr.trim());

// ---------- 4. Ce qui sera envoyé ----------
// git status --porcelain -z : un enregistrement « XY chemin » par fichier, chemins non échappés.
function statut(...chemins) {
  const out = run("git", ["status", "--porcelain", "-z", "--untracked-files=all", "--", ...chemins]).stdout;
  return out
    .split("\0")
    .filter((e) => e.length > 3)
    .map((e) => ({ code: e.slice(0, 2), chemin: e.slice(3) }));
}
const afficher = (liste) => liste.map((x) => `  ${x.code} ${x.chemin}`).join("\n");

const aEnvoyer = statut(...fichiers);
if (aEnvoyer.length === 0) {
  console.log("\nRien à publier : ces fichiers sont déjà à jour sur GitHub.");
  process.exit(0);
}
console.log("\nFichiers qui seront envoyés :");
console.log(afficher(aEnvoyer));

const autres = statut().filter((x) => !fichiers.includes(x.chemin));
if (autres.length) {
  console.log("\nAutres modifications présentes, qui NE seront PAS envoyées :");
  console.log(afficher(autres));
}

if (!values.publier) {
  console.log("\nSimulation : rien n'a été envoyé. Vérifiez la page en ouvrant public/relectures/index.html,");
  console.log(`puis relancez avec --publier : node scripts/publier-relecture.js ${slug} --publier`);
  process.exit(0);
}

// ---------- 5. Publication (après « oui ») ----------
const rl = createInterface({ input: process.stdin, output: process.stdout });
const reponse = (await rl.question("\nEnvoyer ces fichiers sur GitHub (mise en ligne par Vercel) ? Tapez « oui » : ")).trim().toLowerCase();
rl.close();
if (reponse !== "oui") {
  console.log("Annulé : rien n'a été envoyé.");
  process.exit(0);
}

git("add", "--", ...fichiers);
// « commit -- fichiers » n'enregistre que ces fichiers, même si d'autres sont déjà indexés.
git("commit", "-m", `Relecture ${slug} : archivage et version suivante`, "--", ...fichiers);
console.log("Envoi sur GitHub…");
git("push", "origin", "main");
console.log(`\n✓ Publié. Dans une à deux minutes, rechargez https://perlimpinpin.ai/relectures (Ctrl+F5).`);
console.log("  Si rien ne change, vérifiez le déploiement dans le tableau de bord Vercel.");
