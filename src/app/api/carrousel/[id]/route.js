import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { isEditor } from "@/lib/test-auth";
import { cacheControlCarte } from "@/lib/carte";
import { HAUTEUR_SLIDE, LARGEUR_SLIDE } from "@/lib/carrousel";
import { carrouselDe, recitDe } from "@/lib/carrousel-serveur";
import { illustrationCandidat, imageTheme, policesCarrousel, portraitBleu, portraitCadre, portraitNoirBlanc, stickerTheme } from "@/lib/og-ressources";
import { elementSlide } from "./slides";

// Slides 1080 × 1350 des carrousels Instagram :
//  - ?slide=1..6 : carrousel 6 slides (position dans le carrousel, qui passe
//    à 5 slides quand une slide est sautée), sans IA, à partir des textes de
//    la fiche (src/lib/carrousel.js) ;
//  - ?version=recit&slide=1..8 : carrousel récit (7 sans précédent étranger), à partir de
//    contenuComplet.reseaux_recit (src/lib/carrousel-recit.js) ; 404 tant
//    que le récit n'a pas été généré. Aucun appel à l'IA ici.
// Comme /api/carte : fiche publiée ouverte à tous, image mise en cache
// longtemps (URL versionnée, ?v=) ; brouillon (?brouillon=1) réservé aux
// personnes déverrouillées sur /test, jamais en cache partagé.

function introuvable() {
  return new Response("Slide introuvable.", { status: 404, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request, { params }) {
  const { id } = await params;
  const propositionId = Number(id);
  const recherche = new URL(request.url).searchParams;
  const numero = Number(recherche.get("slide") ?? "1");
  if (!Number.isInteger(propositionId) || !Number.isInteger(numero) || numero < 1) return introuvable();

  const brouillon = recherche.get("brouillon") === "1";
  if (brouillon && !(await isEditor())) return introuvable();

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
  if (!analyse) return introuvable();

  const carrousel = recherche.get("version") === "recit" ? recitDe(proposition, analyse) : carrouselDe(proposition, analyse);
  if (!carrousel) return introuvable();
  const { slides, version, couleur, sujet } = carrousel;
  const slide = slides.find((s) => s.numero === numero);
  if (!slide) return introuvable();

  // Couverture en collage : portrait détouré noir et blanc, photo et sticker
  // du thème (scripts/images-couverture.js). Replis du portrait : la vignette
  // du site, puis le portrait bleu.
  const couverture = slide.type === "couverture";
  const portrait = couverture ? await portraitNoirBlanc(proposition.candidat) : null;
  const [fondTheme, sticker] = couverture ? await Promise.all([imageTheme(slide.theme), stickerTheme(slide.theme)]) : [null, null];
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
        "Cache-Control": cacheControlCarte({
          publie: analyse.statut === "publie",
          versionDemandee: recherche.get("v"),
          versionCourante: version,
        }),
      },
    },
  );
}
