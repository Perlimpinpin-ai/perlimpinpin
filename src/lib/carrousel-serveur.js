import { existsSync } from "node:fs";
import { join } from "node:path";
import { slugCandidat, titreCarte } from "./carte.js";
import { controlerCarrousel } from "./carrousel.js";
import { carrouselRecit } from "./carrousel-recit.js";
import { cheminIllustration, cheminPortraitCadre, cheminPortraitNoirBlanc } from "./og-ressources.js";
import { lireVersionBasique } from "./version-basique.js";
import { debordementsCarrousel, messageDebordement } from "./mise-en-page-carrousel.js";
import { mesureurCarrousel } from "./metriques-polices.js";
import { CHEMIN_GRAIN, CHEMIN_PAPIER, cheminIllustrationTraitee } from "./images-carrousel.js";
import { photosTirage } from "./photos-candidats-serveur.js";

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

// Photo de la couverture du carrousel détaillé : photo Commons détourée
// (public/carrousel/candidats/<slug>/<n>.png, scripts/detourer-candidats.py
// --photos) ; sans elle, la vignette actuelle du site posée en tirage.
function avertissementsImagesRecit(candidat, illustration, photo) {
  const existe = (chemin) => existsSync(join(process.cwd(), "public", chemin));
  const avertissements = [];
  if (photo && !existe(photo.fichier)) {
    avertissements.push({
      cle: "photo",
      message: photo.deposee
        ? `Photo ${photo.n} de ${candidat.nom} pas encore préparée (public/${photo.fichier}). La préparer : .venv-photos/Scripts/python scripts/preparer-photos-candidats.py ${slugCandidat(candidat)}.`
        : `Photo ${photo.n} de ${candidat.nom} pas encore détourée (public/${photo.fichier}) : vignette actuelle à la place. La préparer : python scripts/detourer-candidats.py --photos ${slugCandidat(candidat)}.`,
    });
  }
  if (illustration && !existe(cheminIllustrationTraitee(illustration.fichier))) {
    avertissements.push({ cle: "image de thème", message: `Image de thème pas encore traitée : public/${cheminIllustrationTraitee(illustration.fichier).replace(/\\/g, "/")} (papier jaune seul). La préparer : node scripts/preparer-images-carrousel.js` });
  }
  for (const [chemin, nom] of [
    [CHEMIN_PAPIER, "papier jaune déchiré"],
    [CHEMIN_GRAIN, "grain"],
  ]) {
    if (!existe(chemin)) avertissements.push({ cle: "image", fort: true, message: `${nom} absent (public/${chemin.replace(/\\/g, "/")}) : node scripts/preparer-images-carrousel.js` });
  }
  return avertissements;
}

// Carrousel détaillé (8 slides) et tweet long, ou null sans
// contenuComplet.reseaux_recit ; `precedent` : sa version précédente ;
// `photo` : numéro de la photo du candidat demandée (« Changer de photo ») ;
// `image` : fichier de l'image de thème demandée (« Changer d'image »).
// Chaque slide est mesurée (src/lib/mise-en-page-carrousel.js) : un texte
// qui déborde ou un titre mal coupé devient un avertissement fort.
export function recitDe(proposition, analyse, { precedent = false, photo = null, image = null } = {}) {
  const recit = carrouselRecit({ ...donnees(proposition, analyse), precedent, photoDemandee: photo, illustrationDemandee: image, photos: photosTirage("mesure") });
  if (!recit) return recit;
  recit.avertissements.push(...avertissementsImagesRecit(proposition.candidat, recit.illustration, recit.photo));
  // Grain obligatoire sur tous les fonds (charte RS, page 10).
  if (recit.controles) recit.controles.grain = existsSync(join(process.cwd(), "public", CHEMIN_GRAIN));
  recit.debordements = debordementsCarrousel(recit.slides, mesureurCarrousel());
  for (const d of recit.debordements) recit.avertissements.push({ cle: `slide ${d.numero}`, fort: true, message: messageDebordement(d) });
  // Un texte qui entre dans une zone réservée (pied de page, bande, collage)
  // bloque l'archive : on ne publie pas une slide où le texte chevauche.
  if (recit.debordements.length && !recit.blocageArchive) {
    const slides = [...new Set(recit.debordements.map((d) => d.numero))].join(", ");
    recit.blocageArchive = `Texte trop long sur la slide ${slides} : pas d’archive. Régénérez ces slides (ou toutes) pour que le modèle raccourcisse les textes.`;
  }
  return recit;
}

// Débordements d'un récit tout juste généré (avant écriture), pour la relance
// « raccourcir » de genererRecitCore.
export function debordementsDuRecit(recit, { proposition, contenu, score }) {
  const essai = carrouselRecit({
    ...donnees(proposition, { id: 0, scoreFaisabilite: score, contenuComplet: { ...contenu, reseaux_recit: recit } }),
  });
  return essai?.slides.length ? debordementsCarrousel(essai.slides, mesureurCarrousel()) : [];
}
