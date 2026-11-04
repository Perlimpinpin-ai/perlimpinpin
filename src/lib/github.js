// Tous les appels à l'API GitHub du site (dépôt Perlimpinpin-ai/perlimpinpin),
// avec le jeton GITHUB_DISPATCH_TOKEN (variable Vercel). Permissions du jeton
// (fine-grained, propriétaire Perlimpinpin-ai, ce seul dépôt) : Actions, Contents et Pull requests en
// « Read and write ».
//
// - declencherRevision : bouton « Envoyer en révision » (/relectures), lance
//   le workflow revision-relecture.yml ;
// - verifierRevisionFusionnable / fusionnerRevision : bouton « Publier » de
//   /test/[id] pour une fiche issue d'une révision, qui fusionne la PR
//   « Révision <slug> » (branche revision/<slug>).
//
// Logique sans Next.js : fetch est injectable (tests : scripts/github.test.js,
// scripts/relecture-revision.test.js).

export const DEPOT = "Perlimpinpin-ai/perlimpinpin";
export const WORKFLOW = "revision-relecture.yml";
export const SLUG_PATTERN = /^[a-z0-9-]{1,120}$/;
const PROPRIETAIRE = DEPOT.split("/")[0];
const API_DEPOT = `https://api.github.com/repos/${DEPOT}`;
const API_WORKFLOW = `${API_DEPOT}/actions/workflows/${WORKFLOW}`;
const LIEN_WORKFLOW = `https://github.com/${DEPOT}/actions/workflows/${WORKFLOW}`;

const jetonParDefaut = () => process.env.GITHUB_DISPATCH_TOKEN;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function entetes(token) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "perlimpinpin-relectures",
  };
}

// Message clair quand le jeton n'a pas la bonne permission.
function erreurGitHub(action, status) {
  if (status === 401) return `GitHub a refusé le jeton (${action}, 401) : GITHUB_DISPATCH_TOKEN invalide ou expiré.`;
  if (status === 403 || status === 404) {
    return `GitHub a refusé ${action} (${status}) : vérifie les permissions du jeton GITHUB_DISPATCH_TOKEN (Actions, Contents et Pull requests en « Read and write »).`;
  }
  return `GitHub a répondu ${status} (${action}).`;
}

// ---------- « Envoyer en révision » ----------

// Un run pour cette fiche est-il déjà en attente ou en cours ? Le workflow
// s'intitule « Révision <slug> » (run-name), ce qui permet de le reconnaître :
// protège d'un second envoi depuis un autre onglet ou après rechargement.
async function runEnCours({ slug, token, fetchImpl }) {
  for (const status of ["queued", "in_progress"]) {
    const r = await fetchImpl(`${API_WORKFLOW}/runs?status=${status}&per_page=50`, { headers: entetes(token) });
    if (!r.ok) throw new Error(`GitHub a répondu ${r.status} à la liste des runs.`);
    const { workflow_runs: runs = [] } = await r.json();
    const run = runs.find((x) => x.display_title === `Révision ${slug}`);
    if (run) return run;
  }
  return null;
}

// Renvoie { lien, dejaLance } : lien vers le run (ou la page du workflow).
export async function declencherRevision({ slug, token, fetchImpl = fetch }) {
  if (!token) throw new Error("GITHUB_DISPATCH_TOKEN absent : envoi impossible.");
  const existant = await runEnCours({ slug, token, fetchImpl });
  if (existant) return { lien: existant.html_url || LIEN_WORKFLOW, dejaLance: true };

  const r = await fetchImpl(`${API_WORKFLOW}/dispatches`, {
    method: "POST",
    headers: { ...entetes(token), "Content-Type": "application/json" },
    body: JSON.stringify({ ref: "main", inputs: { slug }, return_run_details: true }),
  });
  if (!r.ok) throw new Error(`GitHub a refusé le déclenchement (${r.status}).`);
  const res = r.status === 200 ? await r.json().catch(() => ({})) : {};
  return { lien: res.html_url || LIEN_WORKFLOW, dejaLance: false };
}

// ---------- PR de révision (bouton « Publier » de /test) ----------

// Lien de recherche des PR de la branche, sans appel à l'API (« Voir la PR »).
export function lienRecherchePR(slug) {
  return `https://github.com/${DEPOT}/pulls?q=${encodeURIComponent(`is:pr head:revision/${slug}`)}`;
}

// PR ouverte de la branche revision/<slug> et sa fusionnabilité. Lecture seule.
// Renvoie { ok: true, pr: { numero, lien } } ou { ok: false, raison, lien }.
// GitHub calcule `mergeable` en arrière-plan : tant qu'il vaut null, on
// redemande quelques fois.
//
// PR déjà fusionnée (fusion faite à la main sur GitHub avant le clic sur
// « Publier » : règle d'or le 16/10/2026, Sécurité sociale le 25/10/2026) :
// rien n'est plus à fusionner, la publication peut se faire. Renvoie alors
// { ok: true, dejaFusionnee: true, pr: { numero, lien } }. Une PR fermée SANS
// fusion reste un refus : la révision a été abandonnée.
export async function verifierRevisionFusionnable(slug, { token = jetonParDefaut(), fetchImpl = fetch, attente = 1500, essais = 3 } = {}) {
  const lien = lienRecherchePR(slug);
  if (!SLUG_PATTERN.test(String(slug))) return { ok: false, raison: "slug de révision invalide", lien };
  if (!token) return { ok: false, raison: "GITHUB_DISPATCH_TOKEN absent", lien };

  const branche = `${PROPRIETAIRE}:revision/${slug}`;
  const r = await fetchImpl(`${API_DEPOT}/pulls?state=open&head=${encodeURIComponent(branche)}`, { headers: entetes(token) });
  if (!r.ok) return { ok: false, raison: erreurGitHub("la lecture des pull requests", r.status), lien };
  const prs = await r.json();
  if (!Array.isArray(prs) || prs.length === 0) {
    const f = await fetchImpl(`${API_DEPOT}/pulls?state=closed&head=${encodeURIComponent(branche)}`, { headers: entetes(token) });
    if (!f.ok) return { ok: false, raison: erreurGitHub("la lecture des pull requests fermées", f.status), lien };
    const fermees = await f.json();
    const fusionnee = Array.isArray(fermees) ? fermees.find((pr) => pr.merged_at) : null;
    if (fusionnee) {
      return { ok: true, dejaFusionnee: true, pr: { numero: fusionnee.number, lien: fusionnee.html_url || lien } };
    }
    const raison = Array.isArray(fermees) && fermees.length > 0
      ? `la pull request de la branche revision/${slug} a été fermée sans être fusionnée`
      : `aucune pull request pour la branche revision/${slug}`;
    return { ok: false, raison, lien };
  }

  const numero = prs[0].number;
  const lienPR = prs[0].html_url || lien;
  for (let essai = 1; essai <= essais; essai++) {
    const d = await fetchImpl(`${API_DEPOT}/pulls/${numero}`, { headers: entetes(token) });
    if (!d.ok) return { ok: false, raison: erreurGitHub("la lecture de la pull request", d.status), lien: lienPR };
    const pr = await d.json();
    if (pr.mergeable === true) return { ok: true, pr: { numero, lien: lienPR } };
    if (pr.mergeable === false) {
      return { ok: false, raison: `la pull request #${numero} a des conflits avec main (${pr.mergeable_state ?? "état inconnu"})`, lien: lienPR };
    }
    if (essai < essais) await pause(attente);
  }
  return { ok: false, raison: `GitHub calcule encore si la pull request #${numero} est fusionnable, réessaie dans un instant`, lien: lienPR };
}

// Fusion « squash » de la PR, message « Révision <slug> ».
// Renvoie { ok: true } ou { ok: false, raison }.
export async function fusionnerRevision({ slug, numero }, { token = jetonParDefaut(), fetchImpl = fetch } = {}) {
  if (!token) return { ok: false, raison: "GITHUB_DISPATCH_TOKEN absent" };
  const r = await fetchImpl(`${API_DEPOT}/pulls/${numero}/merge`, {
    method: "PUT",
    headers: { ...entetes(token), "Content-Type": "application/json" },
    body: JSON.stringify({ merge_method: "squash", commit_title: `Révision ${slug}` }),
  });
  if (r.ok) return { ok: true };
  const corps = await r.json().catch(() => ({}));
  if (r.status === 405 || r.status === 409) {
    return { ok: false, raison: `GitHub refuse la fusion (${r.status}) : ${corps.message ?? "pull request non fusionnable"}` };
  }
  return { ok: false, raison: erreurGitHub("la fusion", r.status) };
}
