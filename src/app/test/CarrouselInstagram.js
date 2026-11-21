import { slugCandidat } from "@/lib/carte";
import { cheminSlide, nomArchiveCarrousel } from "@/lib/carrousel";
import { nomArchiveRecit } from "@/lib/carrousel-recit";
import { carrouselDe, recitDe } from "@/lib/carrousel-serveur";
import CarrouselPartage from "./CarrouselPartage";
import EncadreARelire from "./EncadreARelire";
import BoutonGenererRecit from "./reseaux/BoutonGenererRecit";
import TweetLong from "./reseaux/TweetLong";

// Sections Instagram et tweet long de la page de partage (/test/reseaux/[id]) :
//  - « Carrousel Instagram » : le carrousel 6 slides, assemblé par le code
//    sans IA (src/lib/carrousel.js), et à côté le carrousel « récit » en 10
//    slides (src/lib/carrousel-recit.js), écrit par Claude à la demande
//    (bouton « Générer le récit ») ;
//  - « Tweet long (récit) », issu du même appel.
// Images : route /api/carrousel/[id]. La légende et le tweet modifiés ne
// vivent que dans la page ; seul le bouton écrit en base (reseaux_recit).
export default function CarrouselInstagram({ proposition, analyse, brouillon = false, numero = 4 }) {
  const slug = slugCandidat(proposition.candidat);
  const archive = { propositionId: proposition.id, candidatNom: proposition.candidat.nom, photoUrl: proposition.candidat.photoUrl };
  const vignettes = (slides, version, recit = false) =>
    slides.map((slide) => ({
      numero: slide.numero,
      total: slide.total,
      libelle: slide.libelle,
      fichier: slide.fichier,
      url: cheminSlide({ propositionId: proposition.id, numero: slide.numero, version, brouillon, recit }),
    }));

  const six = carrouselDe(proposition, analyse);
  const recit = recitDe(proposition, analyse);

  return (
    <>
      <section className="flex flex-col gap-4 border-t border-zinc-200 pt-8">
        <h3 className="text-base font-semibold text-zinc-900">
          {numero}. Carrousel Instagram <span className="font-normal text-zinc-500">(jour J, avec la carte)</span>
        </h3>
        <EncadreARelire avertissements={six.avertissements} />
        <CarrouselPartage
          vignettes={vignettes(six.slides, six.version)}
          legendeInitiale={six.legende}
          archive={nomArchiveCarrousel(archive)}
          prefixeFichier={`carrousel-${proposition.id}-${slug}`}
        />

        <div className="mt-4 flex flex-col gap-4 rounded-xl border border-zinc-200 bg-zinc-100/60 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h4 className="text-sm font-semibold text-zinc-900">Carrousel « récit » (8 slides)</h4>
              <p className="max-w-2xl text-xs text-zinc-600">
                La mesure racontée comme une petite histoire. Écrit par Claude à la demande, avec le tweet long, en un
                seul appel (environ 0,05 $). Le verdict, la note et le lien restent écrits par le code.
              </p>
            </div>
            <BoutonGenererRecit propositionId={proposition.id} brouillon={brouillon} aDejaUnRecit={Boolean(recit)} />
          </div>
          {recit ? (
            <>
              <EncadreARelire avertissements={recit.avertissements} />
              <CarrouselPartage
                vignettes={vignettes(recit.slides, recit.version, true)}
                legendeInitiale={recit.legende}
                archive={nomArchiveRecit(archive)}
                prefixeFichier={`carrousel-recit-${proposition.id}-${slug}`}
              />
            </>
          ) : (
            <p className="text-sm text-zinc-600">
              Pas encore de récit pour cette fiche. En ligne de commande :{" "}
              <code>
                node scripts/recit.js {proposition.id}
                {brouillon ? " --brouillon" : ""} --simulation
              </code>{" "}
              (coût estimé, sans appel).
            </p>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-4 border-t border-zinc-200 pt-8">
        <h3 className="text-base font-semibold text-zinc-900">
          {numero + 1}. Tweet long (récit) <span className="font-normal text-zinc-500">(jour J, image conseillée : la carte score)</span>
        </h3>
        {recit?.tweet ? (
          <TweetLong texteInitial={recit.tweet} />
        ) : (
          <p className="text-sm text-zinc-600">Généré avec le carrousel récit : utilisez le bouton « Générer le récit » ci-dessus.</p>
        )}
      </section>
    </>
  );
}
