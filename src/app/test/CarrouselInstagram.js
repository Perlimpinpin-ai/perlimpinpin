import { slugCandidat } from "@/lib/carte";
import { cheminSlide, nomArchiveCarrousel } from "@/lib/carrousel";
import { carrouselDe } from "@/lib/carrousel-serveur";
import CarrouselPartage from "./CarrouselPartage";
import EncadreARelire from "./EncadreARelire";

// « Carrousel Instagram » de la page de partage (/test/reseaux/[id]) :
// slides 1080 × 1350 (route /api/carrousel/[id]) et légende, assemblées par
// le code à partir des textes de la fiche (src/lib/carrousel.js), sans IA.
// Rien n'est écrit en base : la légende modifiée ne vit que dans la page.
export default function CarrouselInstagram({ proposition, analyse, brouillon = false, numero = 4 }) {
  const { slides, legende, avertissements, version } = carrouselDe(proposition, analyse);
  const slug = slugCandidat(proposition.candidat);
  const vignettes = slides.map((slide) => ({
    numero: slide.numero,
    total: slide.total,
    libelle: slide.libelle,
    fichier: slide.fichier,
    url: cheminSlide({ propositionId: proposition.id, numero: slide.numero, version, brouillon }),
  }));

  return (
    <section className="flex flex-col gap-4 border-t border-zinc-200 pt-8">
      <h3 className="text-base font-semibold text-zinc-900">
        {numero}. Carrousel Instagram <span className="font-normal text-zinc-500">(jour J, avec la carte)</span>
      </h3>
      <EncadreARelire avertissements={avertissements} />
      <CarrouselPartage
        vignettes={vignettes}
        legendeInitiale={legende}
        archive={nomArchiveCarrousel({ propositionId: proposition.id, candidatNom: proposition.candidat.nom, photoUrl: proposition.candidat.photoUrl })}
        prefixeFichier={`carrousel-${proposition.id}-${slug}`}
      />
    </section>
  );
}
