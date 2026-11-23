import { revalidatePath, revalidateTag } from "next/cache";

// Étiquette du cache des déclarations publiées (unstable_cache de
// getPublishedDeclarations, src/lib/queries.js), lu par /declarations.
export const TAG_DECLARATIONS = "declarations-publiees";

// Vide le cache de TOUT le site public (accueil, /declarations, fiches, pages
// candidat, thèmes, dossiers, prix…) : à appeler après chaque écriture qui
// change le contenu public (publication, correction, révision). Les pages ne
// sont recalculées qu'à leur prochaine visite : rien ne réveille la base ici.
//
// Les pages publiques gardent leur cache un jour (revalidate = 86400) : c'est
// cet appel, et non plus un recalcul toutes les 5 minutes, qui les tient à
// jour. Cela laisse la base Neon s'endormir entre deux visites non mises en
// cache. Appelé par les Server Actions de /test et par /api/revalidate (scripts
// de publication, GitHub Actions : scripts/rafraichir-site.js).
export function rafraichirSitePublic() {
  revalidatePath("/", "layout");
  // revalidatePath vide aussi les données de unstable_cache lues pendant le
  // rendu des pages ; l'étiquette est une sécurité. { expire: 0 } : expiration
  // immédiate (la prochaine visite lit la base), pas de version périmée servie.
  revalidateTag(TAG_DECLARATIONS, { expire: 0 });
}
