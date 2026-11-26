import { ImageResponse } from "next/og";
import { HAUTEUR, LARGEUR } from "@/lib/reel-disposition";
import { policesStoryboard, ressourcesRendu } from "@/lib/reel-storyboard-base";
import { HAUTEUR_PLANCHE, LARGEUR_PLANCHE, elementCouverture, elementImageCle, elementPlanche } from "./rendu";

// Images d’un storyboard (les trois formats), partagées par les routes
// /test/reels/<id>/storyboard, /test/reseaux/programme/<slug>/reel et
// /test/reseaux/thematique/<thème>/reel.
// Image demandée d'un storyboard (les trois formats).
export async function imageStoryboard({ etat, image, cacheControl, introuvable }) {
  const n = etat.storyboard.scenes.length;
  const ressources = ressourcesRendu(etat);
  let element;
  let taille = { width: LARGEUR, height: HAUTEUR };
  let m;
  if (image === "couverture") element = elementCouverture({ etat, ressources });
  else if (image === "fond") element = elementImageCle({ etat, i: 0, k: 1, ressources, calque: "fond" });
  else if ((m = image.match(/^scene-(\d{2})-([123])$/))) {
    const i = Number(m[1]) - 1;
    if (i < 0 || i >= n) return introuvable();
    element = elementImageCle({ etat, i, k: Number(m[2]), ressources });
  } else if ((m = image.match(/^calque-(\d{2})-(visuel|texte)$/))) {
    const i = Number(m[1]) - 1;
    if (i < 0 || i >= n) return introuvable();
    element = elementImageCle({ etat, i, k: 3, ressources, calque: m[2] });
  } else if ((m = image.match(/^planche-(\d{2})$/))) {
    const i = Number(m[1]) - 1;
    if (i < 0 || i >= n) return introuvable();
    element = elementPlanche({ etat, i, ressources });
    taille = { width: LARGEUR_PLANCHE, height: HAUTEUR_PLANCHE };
  } else return introuvable();
  return new ImageResponse(element, { ...taille, fonts: await policesStoryboard(), headers: { "Cache-Control": cacheControl } });
}
