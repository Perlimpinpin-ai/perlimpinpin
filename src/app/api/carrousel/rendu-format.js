import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { isEditor } from "@/lib/test-auth";
import { policesCharteRS } from "@/lib/og-ressources";
import { mesureurCarrousel } from "@/lib/metriques-polices";
import { miseEnPageFormat } from "@/lib/mise-en-page-formats";
import { candidatsChoisis, carrouselDepuisEtat, contexteProgramme, contexteThematique, decoderEtat, imagesFormat } from "@/lib/carrousel-formats-serveur";
import { CarrouselProgramme } from "@/components/carrousels/CarrouselProgramme";
import { CarrouselThematique } from "@/components/carrousels/CarrouselThematique";

// Slides 1080 × 1350 des carrousels « analyse de programme »
// (/api/carrousel/programme/<slug-candidat>) et « thématique »
// (/api/carrousel/thematique/<thème>) : ?e=<état> (sélection et réponse du
// modèle, src/lib/carrousel-formats-serveur.js) & slide=<n>. Réservées aux
// personnes déverrouillées sur /test ; fiches publiées seulement, lues sans
// rien écrire ; jamais en cache partagé. Aucun appel à l'IA ici.

function introuvable() {
  return new Response("Slide introuvable.", { status: 404, headers: { "Cache-Control": "no-store" } });
}

export async function rendreFormat(format, cle, request) {
  if (!(await isEditor())) return introuvable();
  const recherche = new URL(request.url).searchParams;
  const numero = Number(recherche.get("slide") ?? "1");
  const etat = decoderEtat(recherche.get("e"));
  if (!Number.isInteger(numero) || !etat) return introuvable();
  const contexte = format === "programme" ? await contexteProgramme(prisma, cle) : await contexteThematique(prisma, cle);
  if (!contexte) return introuvable();
  const carrousel = carrouselDepuisEtat(format, contexte, etat);
  const slide = carrousel?.slides.find((s) => s.numero === numero);
  if (!slide) return introuvable();
  const images = await imagesFormat(slide, format === "programme" ? { candidat: contexte.candidat } : { candidats: candidatsChoisis(contexte, etat.choix) });
  const mise = miseEnPageFormat(slide, mesureurCarrousel());
  const Composant = format === "programme" ? CarrouselProgramme : CarrouselThematique;
  return new ImageResponse(<Composant slide={slide} mise={mise} couleur={carrousel.couleur} images={images} />, {
    width: 1080,
    height: 1350,
    fonts: await policesCharteRS(),
    headers: { "Cache-Control": "no-store" },
  });
}
