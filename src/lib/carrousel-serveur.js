import { existsSync } from "node:fs";
import { join } from "node:path";
import { slugCandidat, titreCarte } from "./carte.js";
import { controlerCarrousel } from "./carrousel.js";
import { carrouselRecit } from "./carrousel-recit.js";
import { cheminIllustration, cheminPortraitCadre, cheminPortraitNoirBlanc } from "./og-ressources.js";
import { lireVersionBasique } from "./version-basique.js";

// Carrousels Instagram d'une proposition et de son analyse, tels que les
// voient la route des images (src/app/api/carrousel/[id]) et la page de
// partage (/test/reseaux/[id]) : mêmes données des deux côtés, donc même
// version dans l'URL. Côté serveur seulement (version basique lue en base,
// ou en développement dans data/versions-basiques-dev/ ; présence des images
// vérifiée sur disque).
//
// `proposition` : { id, titre, texteOriginal, theme, candidat: { nom, photoUrl } }
// `analyse` : { id, scoreFaisabilite, contenuComplet }
function donnees(proposition, analyse) {
  const contenu = analyse.contenuComplet ?? {};
  return {
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
  };
}

// Avertissements sur les images de la couverture en collage : portrait
// détouré noir et blanc (sinon vignette du site, puis portrait bleu),
// préparé par scripts/images-couverture.js, et image de thème.
function avertissementsImages(candidat, illustration) {
  const existe = (chemin) => existsSync(join(process.cwd(), "public", chemin));
  const affiche = (chemin) => `public/${chemin.replace(/\\/g, "/")}`;
  const avertissements = [];
  if (!existe(cheminPortraitNoirBlanc(candidat))) {
    const repli = existe(cheminPortraitCadre(candidat))
      ? "illustration entière en noir et blanc, posée en tirage (fournir un portrait détouré dans public/portraits-bleus/ pour le collage complet)"
      : existe(cheminIllustration(candidat))
      ? "vignette du site à la place"
      : existe(join("portraits-bleus", `${slugCandidat(candidat)}.png`))
        ? "portrait bleu à la place"
        : "couverture sans portrait";
    avertissements.push({ cle: "image", message: `Pas de portrait noir et blanc pour ${candidat.nom} (${affiche(cheminPortraitNoirBlanc(candidat))}) : ${repli}.` });
  }
  // Image de thème de la bibliothèque (src/lib/illustrations.js) listée mais
  // absente du disque (fichier supprimé ou pas encore téléchargé).
  if (illustration && !existe(illustration.fichier)) {
    avertissements.push({ cle: "image de thème", message: `Image de thème listée mais absente : ${affiche(illustration.fichier)} (couverture sans illustration).` });
  }
  return avertissements;
}

// Carrousel 6 slides.
export function carrouselDe(proposition, analyse) {
  const carrousel = controlerCarrousel(donnees(proposition, analyse));
  carrousel.avertissements.push(...avertissementsImages(proposition.candidat, carrousel.slides[0]?.illustration));
  return carrousel;
}

// Carrousel détaillé (8 slides) et tweet long, ou null sans
// contenuComplet.reseaux_recit ; `precedent` : sa version précédente.
export function recitDe(proposition, analyse, { precedent = false } = {}) {
  const recit = carrouselRecit({ ...donnees(proposition, analyse), precedent });
  recit?.avertissements.push(...avertissementsImages(proposition.candidat, recit.illustration));
  return recit;
}
