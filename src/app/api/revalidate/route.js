import { autorisationValide } from "@/lib/revalidate-core";
import { rafraichirSitePublic } from "@/lib/rafraichir-public";

// Rafraîchissement à la demande du site public, appelé après une publication
// faite hors du site (scripts/publish.js et autres scripts, GitHub Actions) :
// voir scripts/rafraichir-site.js.
//
// POST uniquement, protégé par « Authorization: Bearer <REVALIDATE_SECRET> »
// (401 sinon). Le secret n'est jamais journalisé.
export async function POST(request) {
  if (!autorisationValide(request.headers.get("authorization"), process.env.REVALIDATE_SECRET)) {
    return Response.json({ ok: false, message: "Non autorisé." }, { status: 401 });
  }
  rafraichirSitePublic();
  console.log(`[revalidate] cache du site public vidé le ${new Date().toISOString()}`);
  return Response.json({ ok: true });
}
