import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { isEditor } from "@/lib/test-auth";
import { cacheControlCarte } from "@/lib/carte";
import { HAUTEUR_SLIDE, LARGEUR_SLIDE } from "@/lib/carrousel";
import { carrouselDe, recitDe } from "@/lib/carrousel-serveur";
import { lireDemo } from "@/lib/carrousel-demo";
import { illustrationCandidat, policesCarrousel, policesCharteRS, portraitBleu, portraitCadre, portraitNoirBlanc, stickerTheme } from "@/lib/og-ressources";
import { illustrationTraitee, teinteIllustration } from "@/lib/traitement-illustration";
import { elementSlide } from "./slides";
import { elementSlideDetaille, PICTOS } from "./slides-detaille";
import { miseEnPageSlide } from "@/lib/mise-en-page-carrousel";
import { mesureurCarrousel } from "@/lib/metriques-polices";
import { CHEMIN_GRAIN, CHEMIN_PAPIER, cheminIllustrationTraitee, cheminVignetteNb, imageCandidatPrete, imagePrete } from "@/lib/images-carrousel";
import { dataUriPicto } from "@/lib/pictos-charte";
import { piedCarrousel } from "@/lib/carrousel-recit";

// Images d'une slide du carrousel détaillé (data URI), toutes déjà prêtes
// (scripts/preparer-images-carrousel.js, scripts/detourer-candidats.py) :
// aucun traitement d'image ici. Grain du papier, pictogramme ; couverture :
// papier jaune déchiré, illustration déjà teintée et tramée, photo du
// candidat déjà détourée (noir et blanc, liseré blanc ; le grain est posé au
// rendu), sinon la silhouette grise de la charte (aucune photo préparée non écartée).
async function imagesDetaille(slide, candidat, couleur) {
  const couverture = slide.type === "couverture";
  const surCouleur = slide.type === "fin";
  const [grain, papier, portrait, illustration] = await Promise.all([
    imagePrete(CHEMIN_GRAIN),
    couverture ? imagePrete(CHEMIN_PAPIER) : null,
    couverture ? (slide.photo ? imageCandidatPrete({ detoure: slide.photo.fichier, vignette: cheminVignetteNb(candidat) }) : { silhouette: true }) : null,
    couverture && slide.illustration ? imagePrete(cheminIllustrationTraitee(slide.illustration.fichier)) : null,
  ]);
  return { grain, papier, candidat: portrait, illustration, picto: PICTOS[slide.type] ? dataUriPicto(PICTOS[slide.type], { taille: 6, fondSombre: surCouleur && !couleur.clair, couleur: surCouleur ? couleur.accent : couleur.accentCreme }) : null };
}

// Slides 1080 × 1350 des carrousels Instagram :
//  - ?slide=1..6 : carrousel 6 slides (position dans le carrousel, qui passe
//    à 5 slides quand une slide est sautée), sans IA, à partir des textes de
//    la fiche (src/lib/carrousel.js) ;
//  - ?version=recit&slide=1..8 : carrousel détaillé (7 sans précédent
//    étranger), à partir de contenuComplet.reseaux_recit
//    (src/lib/carrousel-recit.js) ; 404 tant qu'il n'a pas été généré ;
//  - ?version=recit-precedent : sa version précédente (comparaison) ;
//  - ?photo=<n> : photo du candidat sur la couverture du carrousel détaillé
//    (src/lib/photos-candidats.js, bouton « Changer de photo »).
// Rendu du carrousel détaillé : ./slides-detaille.js, lignes mesurées par
// src/lib/mise-en-page-carrousel.js.
// Aucun appel à l'IA ici. Comme /api/carte : fiche publiée ouverte à tous,
// image mise en cache longtemps (URL versionnée, ?v=) ; brouillon
// (?brouillon=1) réservé aux personnes déverrouillées sur /test, jamais en
// cache partagé. /api/carrousel/demo : démonstration locale
// (src/lib/carrousel-demo.js), hors production, réservée au mode édition.

function introuvable() {
  return new Response("Slide introuvable.", { status: 404, headers: { "Cache-Control": "no-store" } });
}

async function lireFiche(propositionId, brouillon) {
  const proposition = await prisma.proposition.findUnique({
    where: { id: propositionId },
    select: {
      id: true,
      titre: true,
      texteOriginal: true,
      theme: true,
      candidat: { select: { nom: true, photoUrl: true } },
      analyses: {
        ...(brouillon ? {} : { where: { statut: "publie" } }),
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, statut: true, scoreFaisabilite: true, contenuComplet: true },
      },
    },
  });
  const analyse = proposition?.analyses[0];
  return analyse ? { proposition, analyse } : null;
}

export async function GET(request, { params }) {
  const { id } = await params;
  const demo = id === "demo";
  const propositionId = Number(id);
  const recherche = new URL(request.url).searchParams;
  const numero = Number(recherche.get("slide") ?? "1");
  if ((!demo && !Number.isInteger(propositionId)) || !Number.isInteger(numero) || numero < 1) return introuvable();

  const brouillon = demo || recherche.get("brouillon") === "1";
  if (brouillon && !(await isEditor())) return introuvable();

  const fiche = demo ? await lireDemo() : await lireFiche(propositionId, brouillon);
  if (!fiche) return introuvable();
  const { proposition, analyse } = fiche;

  const version = recherche.get("version");
  const detaille = version === "recit" || version === "recit-precedent";
  const photoDemandee = detaille ? recherche.get("photo") : null;
  const imageDemandee = detaille ? recherche.get("image") : null;
  const carrousel = detaille ? recitDe(proposition, analyse, { precedent: version === "recit-precedent", photo: photoDemandee, image: imageDemandee }) : carrouselDe(proposition, analyse);
  if (!carrousel) return introuvable();
  const { slides, couleur, sujet } = carrousel;
  const slide = slides.find((s) => s.numero === numero);
  if (!slide) return introuvable();

  if (detaille) {
    const images = await imagesDetaille(slide, proposition.candidat, couleur);
    return new ImageResponse(
      elementSlideDetaille({ slide, mise: miseEnPageSlide(slide, mesureurCarrousel()), couleur, images, candidatNom: proposition.candidat.nom, sujet, pied: piedCarrousel(proposition.candidat.nom, proposition.theme) }),
      {
        width: LARGEUR_SLIDE,
        height: HAUTEUR_SLIDE,
        fonts: await policesCharteRS(),
        headers: {
          "Cache-Control":
            demo
              ? "no-store"
              : cacheControlCarte({ publie: analyse.statut === "publie", versionDemandee: recherche.get("v"), versionCourante: carrousel.version }),
        },
      },
    );
  }

  // Couverture en collage : portrait détouré noir et blanc, image de thème de
  // la bibliothèque (bichromie et trame, src/lib/traitement-illustration.js),
  // sticker du thème. Replis du portrait : la vignette du site, puis le portrait bleu.
  const couverture = slide.type === "couverture";
  const portrait = couverture ? await portraitNoirBlanc(proposition.candidat) : null;
  const fondCouverture = couleur?.couleur ?? null;
  const [fondTheme, sticker] = couverture
    ? await Promise.all([
        slide.illustration ? illustrationTraitee(slide.illustration.fichier, { teinte: teinteIllustration(fondCouverture), couleurCandidat: fondCouverture ?? "#1b2a4a" }) : null,
        stickerTheme(slide.theme),
      ])
    : [null, null];
  const cadre = couverture && !portrait ? await portraitCadre(proposition.candidat) : null;
  const illustration = couverture && !portrait && !cadre ? await illustrationCandidat(proposition.candidat) : null;
  const photo = couverture && !portrait && !illustration ? await portraitBleu(proposition.candidat) : null;

  return new ImageResponse(
    elementSlide({ slide, candidatNom: proposition.candidat.nom, sujet, photo, illustration, portrait, cadre, imageTheme: fondTheme, sticker, couleur }),
    {
      width: LARGEUR_SLIDE,
      height: HAUTEUR_SLIDE,
      fonts: await policesCarrousel(),
      headers: {
        "Cache-Control": demo
          ? "no-store"
          : cacheControlCarte({
              publie: analyse.statut === "publie",
              versionDemandee: recherche.get("v"),
              versionCourante: carrousel.version,
            }),
      },
    },
  );
}
