import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import sharp from "sharp";
import { cheminIllustrationTraitee } from "../../src/lib/images-carrousel.js";
import { entreesBibliotheque, reecrireListe } from "./illustrations-pexels.js";
import { userAgent } from "./commons.js";
import { illustrationJaune } from "./traitement-images.js";

// Téléchargement des images de thème retenues sur /test/illustrations, par le
// bouton « Garder » de la page (serveur local) ou par
// `node scripts/chercher-illustrations.js <thème> --telecharger`.
// Écrit sur le disque : ne marche qu'en local (npm run dev), jamais sur Vercel.

// Format des fichiers de la bibliothèque : JPEG qualité 82, moins de 400 Ko,
// 1600 px de large au plus. L'image de thème est posée en paysage (500 × 330)
// sur la couverture 1080 × 1350 : on la garde en paysage, sans la recadrer au
// format portrait de la slide, qui couperait l'essentiel de la photo.
export const QUALITE_JPEG = 82;
export const POIDS_MAX = 400 * 1024;
export const LARGEUR_FICHIER = 1600;

// Octets d'une image → JPEG de la bibliothèque (qualité 82, puis plus basse
// et plus petit si besoin pour passer sous 400 Ko). Renvoie { octets, largeur,
// hauteur, qualite }.
export async function jpegBibliotheque(octets) {
  let largeur = LARGEUR_FICHIER;
  let qualite = QUALITE_JPEG;
  for (;;) {
    const { data, info } = await sharp(octets)
      .rotate()
      .resize({ width: largeur, withoutEnlargement: true })
      .jpeg({ quality: qualite, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });
    if (data.length <= POIDS_MAX || (qualite <= 60 && largeur <= 1080)) return { octets: data, largeur: info.width, hauteur: info.height, qualite };
    if (qualite > 60) qualite -= 6;
    else largeur = Math.max(1080, largeur - 200);
  }
}

// Télécharge les images retenues d'un thème, les écrit dans
// public/illustrations/<thème>/ (avec leur version traitée pour la
// couverture) et les ajoute à src/lib/illustrations.js.
// `racine` : dossier du projet ; `existantes` : liste ILLUSTRATIONS actuelle.
// Renvoie { faites: [entrées], erreurs: [messages] }.
export async function garderIllustrations({ racine, theme, retenues, existantes, journal = () => {} }) {
  const entrees = entreesBibliotheque(theme, retenues, existantes);
  const faites = [];
  const erreurs = [];
  for (const entree of entrees) {
    try {
      if (!entree.auteur || !entree.licence || !entree.lien) throw new Error("crédit incomplet (auteur, licence ou page source)");
      const reponse = await fetch(entree.telechargement, { headers: { "User-Agent": userAgent() } });
      if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
      const { octets, largeur, hauteur, qualite } = await jpegBibliotheque(Buffer.from(await reponse.arrayBuffer()));
      const cible = join(racine, "public", entree.fichier);
      mkdirSync(dirname(cible), { recursive: true });
      writeFileSync(cible, octets);
      const traitee = join(racine, "public", cheminIllustrationTraitee(entree.fichier));
      mkdirSync(dirname(traitee), { recursive: true });
      writeFileSync(traitee, await illustrationJaune(octets));
      faites.push(entree);
      journal(`✓ ${entree.fichier} (${largeur} × ${hauteur}, ${Math.round(octets.length / 1024)} Ko, qualité ${qualite}) : ${entree.auteur}, ${entree.licence}, ${entree.lien}`);
    } catch (error) {
      erreurs.push(`${entree.lien || entree.telechargement} : ${error.message}`);
      journal(`✗ ${entree.lien || entree.telechargement} : ${error.message}`);
    }
  }
  if (faites.length) {
    const liste = join(racine, "src", "lib", "illustrations.js");
    writeFileSync(liste, reecrireListe(readFileSync(liste, "utf-8"), [...existantes, ...faites]), "utf-8");
  }
  return { faites, erreurs };
}
