import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

// Journal des écritures en base (garde-fou : logs/insertions.jsonl, comme les
// scripts). Une ligne JSON par écriture, sans nom ni e-mail d'adhérent.
//
// Limite à connaître : sur Vercel, le disque de l'application est en lecture
// seule et éphémère ; le fichier ne peut pas y être écrit. La même ligne est
// donc TOUJOURS aussi écrite dans les journaux du serveur (Vercel → Logs,
// préfixe « [insertions] »), et la trace durable en base reste la ligne
// DecisionRevision / TriAnnotation créée par l'action. En local (npm run dev),
// le fichier est bien complété.
// `ecrire` est remplaçable en test.
export const CHEMIN_JOURNAL = join(process.cwd(), "logs", "insertions.jsonl");

export function journaliser(entree, { ecrire = ecrireFichier, log = console, maintenant = new Date() } = {}) {
  const ligne = JSON.stringify({ timestamp: maintenant.toISOString(), ...entree });
  log.log(`[insertions] ${ligne}`);
  try {
    ecrire(ligne);
    return true;
  } catch {
    return false;
  }
}

function ecrireFichier(ligne) {
  mkdirSync(dirname(CHEMIN_JOURNAL), { recursive: true });
  appendFileSync(CHEMIN_JOURNAL, `${ligne}\n`);
}
