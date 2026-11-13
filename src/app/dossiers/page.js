import Link from "next/link";
import Header from "@/components/Header";
import AvancementDossier from "@/components/AvancementDossier";
import TitreAvecItalique from "@/components/TitreAvecItalique";
import { avancementHorsSerie, getHorsSeries } from "@/lib/hors-series";
import { DOSSIER } from "@/lib/couleurs-dossier";

// Liste des dossiers : un plan d'ensemble d'un candidat,
// analysé poste par poste dans plusieurs fiches notées. Le contenu vient des
// JSON de data/hors-series/ (src/lib/hors-series.js) ; l'avancement de
// certains dossiers est lu en base (lecture seule), d'où la régénération
// toutes les heures.
export const revalidate = 3600;

export const metadata = {
  title: "Dossiers | Perlimpinpin",
  description:
    "Les dossiers de Perlimpinpin : les plans d'ensemble des candidats, analysés poste par poste.",
};

export default async function DossiersPage() {
  const dossiers = getHorsSeries();
  const avancements = await Promise.all(dossiers.map(avancementHorsSerie));

  return (
    <div className="flex min-h-screen flex-col bg-page-gradient font-sans">
      <Header />

      <main className="w-full px-6 py-12 sm:px-8 sm:py-16">
        <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-10">
          <div className="flex max-w-3xl flex-col gap-5">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-400">
              {"// Dossiers"}
            </span>
            <h1 className="text-4xl font-extrabold leading-[1.04] tracking-[-0.035em] text-zinc-950 sm:text-5xl">
              Les <span className="mr-[0.15em] italic text-zinc-400">dossiers</span> Perlimpinpin
            </h1>
            <p className="text-lg leading-relaxed text-slate-500 sm:text-xl">
              Quand un candidat présente un plan d&apos;ensemble, nous l&apos;analysons poste par poste : une
              fiche notée sur 100 pour chaque grande mesure, puis une note globale pour le plan.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {dossiers.map((dossier, i) => {
              const avancement = avancements[i];
              return (
                <Link
                  key={dossier.slug}
                  href={`/dossiers/${dossier.slug}`}
                  className={`group flex flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_-30px_rgba(30,41,82,0.35)] ring-1 ring-zinc-100 transition-shadow hover:ring-2 ${DOSSIER.anneauSurvol} sm:flex-row`}
                >
                  {/* Image jamais recadrée : 4:5 sur téléphone, version
                      verticale 1:2 à gauche dès sm (voir FeaturedCard). */}
                  {dossier.photo?.src ? (
                  <div
                    className={`w-full shrink-0 sm:w-1/2 ${DOSSIER.fond}`}
                    style={dossier.photo?.fondVertical ? { backgroundColor: dossier.photo.fondVertical } : undefined}
                  >
                    {dossier.photo?.src ? (
                      <img
                        src={dossier.photo.src}
                        alt={dossier.photo.alt ?? dossier.candidat.nom}
                        className={`block h-auto w-full ${dossier.photo.srcVertical ? "sm:hidden" : ""}`}
                      />
                    ) : null}
                    {dossier.photo?.srcVertical ? (
                      <img
                        src={dossier.photo.srcVertical}
                        alt={dossier.photo.alt ?? dossier.candidat.nom}
                        className="hidden h-auto w-full sm:block"
                      />
                    ) : null}
                  </div>
                  ) : null}

                  <div className="flex flex-1 flex-col gap-3 p-6 sm:p-8">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <span className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-zinc-950 ${DOSSIER.fond}`}>
                        Dossier n°{dossier.numero}
                      </span>
                      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-400">
                        {`// ${dossier.etiquette}`}
                      </span>
                    </div>
                    <h2 className="text-2xl font-extrabold leading-tight tracking-tight text-zinc-950 sm:text-[1.7rem]">
                      <TitreAvecItalique titre={dossier.titre} motItalique={dossier.motItalique} />
                    </h2>
                    <p className="text-base leading-snug text-slate-500">
                      {dossier.accueil?.accroche ?? dossier.description}
                    </p>
                    <AvancementDossier
                      avancement={avancement}
                      texte={avancement.texte}
                      className="mt-auto border-t border-zinc-200 pt-4"
                    />
                    <span className={`mt-1 text-sm font-semibold text-zinc-950 underline decoration-2 underline-offset-4 ${DOSSIER.soulignement}`}>
                      Lire le dossier <span aria-hidden="true">→</span>
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
