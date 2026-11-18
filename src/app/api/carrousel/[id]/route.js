import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { isEditor } from "@/lib/test-auth";
import { cacheControlCarte } from "@/lib/carte";
import { HAUTEUR_SLIDE, LARGEUR_SLIDE } from "@/lib/carrousel";
import { carrouselDe } from "@/lib/carrousel-serveur";
import { polices, portraitBleu } from "@/lib/og-ressources";
import { elementSlide } from "./slides";

// Slides 1080 × 1350 du carrousel Instagram : ?slide=1..6 (position dans le
// carrousel, qui passe à 5 slides quand une slide est sautée). Aucune IA :
// tout vient des textes de la fiche (src/lib/carrousel.js).
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

  const { slides, version } = carrouselDe(proposition, analyse);
  const slide = slides.find((s) => s.numero === numero);
  if (!slide) return introuvable();

  return new ImageResponse(
    elementSlide({ slide, candidatNom: proposition.candidat.nom, photo: slide.type === "couverture" ? await portraitBleu(proposition.candidat) : null }),
    {
      width: LARGEUR_SLIDE,
      height: HAUTEUR_SLIDE,
      fonts: await polices(),
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
