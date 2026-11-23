import { existsSync } from "node:fs";
import { join } from "node:path";
import { slugCandidat } from "./carte.js";
import { choisirPhoto, creditsPhoto, PHOTOS_CANDIDATS, photosDuCandidat } from "./photos-candidats.js";

// Photo du candidat dans la fenêtre des Reels (scène de présentation et
// couverture) : la même bibliothèque que le carrousel détaillé
// (src/lib/photos-candidats.js), parmi les photos déjà détourées, tirée de
// façon stable pour un Reel (`graine` : fiche + date de génération). Sans
// photo détourée : null (le Reel garde le portrait bleu). Côté serveur seulement.
export function photoReel(candidat, graine, liste = PHOTOS_CANDIDATS) {
  const slug = slugCandidat(candidat);
  const pretes = photosDuCandidat(slug, liste).filter((p) => existsSync(join(process.cwd(), "public", p.fichier)));
  const photo = choisirPhoto({ slug, graine, liste: pretes });
  return photo ? { ...photo, credit: creditsPhoto(photo) } : null;
}
