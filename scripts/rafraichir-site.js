// Rafraîchit le cache du site public après une écriture faite hors du site
// (scripts de publication, GitHub Actions), en appelant la route
// POST /api/revalidate (src/app/api/revalidate/route.js).
//
// Les pages publiques gardent leur cache un jour : sans cet appel, une fiche
// publiée par un script n'apparaîtrait qu'au bout de 24 h au plus.
//
// Lit SITE_URL (défaut https://perlimpinpin.ai) et REVALIDATE_SECRET. Si le
// secret manque ou si l'appel échoue, affiche un avertissement sans faire
// échouer le script : l'écriture en base est déjà faite. Le secret n'est
// jamais affiché.

import { fileURLToPath } from "node:url";

const SITE_PAR_DEFAUT = "https://perlimpinpin.ai";

export async function rafraichirSite({ env = process.env, fetchImpl = globalThis.fetch, log = console } = {}) {
  const site = (env.SITE_URL || SITE_PAR_DEFAUT).replace(/\/+$/, "");
  const secret = env.REVALIDATE_SECRET;
  if (!secret) {
    log.warn(
      `⚠ REVALIDATE_SECRET absent : le cache de ${site} n'a pas été vidé. ` +
        "Les pages publiques se mettront à jour d'elles-mêmes sous 24 h au plus.",
    );
    return false;
  }
  try {
    const reponse = await fetchImpl(`${site}/api/revalidate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!reponse.ok) {
      log.warn(
        `⚠ Rafraîchissement de ${site} refusé (HTTP ${reponse.status}). ` +
          "Les pages publiques se mettront à jour d'elles-mêmes sous 24 h au plus.",
      );
      return false;
    }
    log.log(`Cache du site public vidé (${site}).`);
    return true;
  } catch (error) {
    log.warn(
      `⚠ Rafraîchissement de ${site} impossible (${error?.name === "TimeoutError" ? "délai dépassé" : (error?.message ?? error)}). ` +
        "Les pages publiques se mettront à jour d'elles-mêmes sous 24 h au plus.",
    );
    return false;
  }
}

// Usage direct : node scripts/rafraichir-site.js
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await import("dotenv/config");
  await rafraichirSite();
}
