import { titreCarte } from "./carte.js";
import { controlerCarrousel } from "./carrousel.js";
import { lireVersionBasique } from "./version-basique.js";

// Carrousel Instagram d'une proposition et de son analyse, tel que le voient
// la route des images (src/app/api/carrousel/[id]) et la page de partage
// (/test/reseaux/[id]) : mêmes données des deux côtés, donc même version
// dans l'URL. Côté serveur seulement (version basique lue en base, ou en
// développement dans data/versions-basiques-dev/).
//
// `proposition` : { id, titre, texteOriginal, theme, candidat: { nom, photoUrl } }
// `analyse` : { id, scoreFaisabilite, contenuComplet }
export function carrouselDe(proposition, analyse) {
  const contenu = analyse.contenuComplet ?? {};
  return controlerCarrousel({
    propositionId: proposition.id,
    analyseId: analyse.id,
    titre: titreCarte(proposition),
    candidatNom: proposition.candidat.nom,
    photoUrl: proposition.candidat.photoUrl,
    theme: proposition.theme,
    score: analyse.scoreFaisabilite,
    contenu,
    resumeBasique: lireVersionBasique(contenu, proposition.id)?.resume ?? null,
    mesureInitiale: proposition.texteOriginal,
  });
}
