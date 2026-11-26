import { existsSync } from "node:fs";
import { join } from "node:path";
import { slugCandidat } from "./carte.js";
import { choisirPhoto, creditsPhoto, fichierPhoto, photosDuCandidat } from "./photos-candidats.js";
import { photosTirage } from "./photos-candidats-serveur.js";

// Photo du candidat dans la fenêtre des Reels (scène de présentation et
// couverture) : la même bibliothèque que le carrousel détaillé
// (src/lib/photos-candidats.js), parmi les photos déjà détourées, tirée de
// façon stable pour un Reel (`graine` : fiche + date de génération). Sans
// photo détourée : null (le Reel garde le portrait bleu). Côté serveur seulement.
// `liste` : par défaut, les photos préparées non écartées (tirage au rendu,
// src/lib/photos-candidats-serveur.js), version tramée.
export function photoReel(candidat, graine, liste = photosTirage("reel")) {
  const slug = slugCandidat(candidat);
  // Photo déposée : la version tramée en pixels charbon et crème (reel-trame.png).
  const pretes = photosDuCandidat(slug, liste)
    .map((p) => ({ ...p, fichier: fichierPhoto(p, "reel") }))
    .filter((p) => existsSync(join(process.cwd(), "public", p.fichier)));
  const photo = choisirPhoto({ slug, graine, liste: pretes });
  return photo ? { ...photo, credit: creditsPhoto(photo) } : null;
}
