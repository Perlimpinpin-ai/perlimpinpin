import { slugCandidat } from "@/lib/carte";
import { cheminSlide, nomArchiveCarrousel } from "@/lib/carrousel";
import { ciblesRemarques, listeARelire, nomArchiveRecit } from "@/lib/carrousel-recit";
import { carrouselDe, recitDe } from "@/lib/carrousel-serveur";
import CarrouselPartage from "./CarrouselPartage";
import EncadreARelire from "./EncadreARelire";
import BarreRemarques from "./reseaux/BarreRemarques";
import BoutonGenererRecit from "./reseaux/BoutonGenererRecit";
import ListeARelireCarrousel from "./reseaux/ListeARelireCarrousel";
import ChoixPhotoCandidat from "./reseaux/ChoixPhotoCandidat";
import { CLE_DERNIERE_PHOTO } from "@/lib/photos-candidats";
import { COULEURS_CARROUSEL_CANDIDATS } from "@/lib/couleurs-carrousel";
import TweetLong from "./reseaux/TweetLong";

// Sections Instagram et tweet long de la page de partage (/test/reseaux/[id]) :
//  - « Carrousel Instagram » : le carrousel 6 slides, assemblé par le code
//    sans IA (src/lib/carrousel.js), et à côté le « Carrousel détaillé
//    (8 slides) » (src/lib/carrousel-recit.js), écrit par Claude à la demande
//    (bouton « Générer le carrousel détaillé »), avec sa barre de remarques ;
//  - « Tweet long », issu du même appel.
// Images : route /api/carrousel/[id]. La légende et le tweet modifiés ne
// vivent que dans la page ; seuls les boutons écrivent en base
// (contenuComplet.reseaux_recit). `demo` : démonstration locale
// (/test/reseaux/demo, fichier local, modèle simulé).
// `photo` : numéro de la photo du candidat demandée (?photo=, « Changer de photo »).
export default function CarrouselInstagram({ proposition, analyse, brouillon = false, numero = 4, demo = false, photo = null }) {
  const slug = slugCandidat(proposition.candidat);
  const idSlides = demo ? "demo" : proposition.id;
  const archive = { propositionId: proposition.id, candidatNom: proposition.candidat.nom, photoUrl: proposition.candidat.photoUrl };
  const vignettes = (slides, version, recit = false, precedent = false, numeroPhoto = null) =>
    slides.map((slide) => ({
      numero: slide.numero,
      total: slide.total,
      libelle: slide.libelle,
      fichier: slide.fichier,
      url: cheminSlide({ propositionId: idSlides, numero: slide.numero, version, brouillon: brouillon && !demo, recit, precedent, photo: numeroPhoto }),
    }));

  const six = carrouselDe(proposition, analyse);
  const recit = recitDe(proposition, analyse, { photo });
  const precedent = recit ? recitDe(proposition, analyse, { precedent: true, photo }) : null;
  const candidatsCouleurs = Object.entries(COULEURS_CARROUSEL_CANDIDATS).map(([nom, c]) => ({ nom, fond: c.fond }));
  const stocke = analyse.contenuComplet?.reseaux_recit;

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
              <h4 className="text-sm font-semibold text-zinc-900">Carrousel détaillé (8 slides)</h4>
              <p className="max-w-2xl text-xs text-zinc-600">
                Selon docs/prompt-carrousel.md : le constat puis la proposition, la note, court et long terme, ailleurs ou avant, notre avis. Écrit par
                Claude à la demande, avec le tweet long, en un seul appel (environ 0,05 $). La note, le verdict, la couleur, les crédits et la fin restent
                écrits par le code.
              </p>
            </div>
            <BoutonGenererRecit propositionId={demo ? "demo" : proposition.id} brouillon={brouillon} aDejaUnRecit={Boolean(recit)} demo={demo} />
          </div>
          {recit ? (
            <>
              {recit.slides.length ? (
                <ListeARelireCarrousel
                  candidatNom={proposition.candidat.nom}
                  couleur={recit.couleur}
                  couleurAttribuee={recit.couleurAttribuee}
                  candidats={candidatsCouleurs}
                  items={listeARelire({ controles: recit.controles, debordements: recit.debordements })}
                />
              ) : null}
              {recit.slides.length ? (
                <ChoixPhotoCandidat cle={slug} numeros={recit.photos} actuelle={recit.photo?.n ?? null} credit={recit.slides[0]?.credits?.[0] ?? null} />
              ) : null}
              <EncadreARelire avertissements={recit.avertissements} />
              <CarrouselPartage
                vignettes={vignettes(recit.slides, recit.version, true, false, recit.photo?.n ?? null)}
                legendeInitiale={recit.legende}
                blocage={recit.blocageArchive}
                memoire={recit.photo ? { cle: `${CLE_DERNIERE_PHOTO}${slug}`, valeur: String(recit.photo.n) } : null}
                archive={nomArchiveRecit({ ...archive, theme: proposition.theme })}
                prefixeFichier={`carrousel-${slug}`}
                fichiersSupplementaires={[{ nom: "credits.txt", donnees: recit.credits }]}
              />
              <BarreRemarques
                propositionId={demo ? "demo" : proposition.id}
                brouillon={brouillon}
                cibles={ciblesRemarques(stocke)}
                vignettesPrecedentes={precedent?.slides.length ? vignettes(precedent.slides, precedent.version, true, true, precedent.photo?.n ?? null) : null}
                retours={stocke?.retours ?? []}
                demo={demo}
              />
            </>
          ) : (
            <p className="text-sm text-zinc-600">
              Pas encore de carrousel détaillé pour cette fiche. En ligne de commande :{" "}
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
          {numero + 1}. Tweet long <span className="font-normal text-zinc-500">(jour J, image conseillée : la carte score)</span>
        </h3>
        {recit?.tweet ? (
          <TweetLong texteInitial={recit.tweet} />
        ) : (
          <p className="text-sm text-zinc-600">Généré avec le carrousel détaillé : utilisez le bouton « Générer le carrousel détaillé » ci-dessus.</p>
        )}
      </section>
    </>
  );
}
