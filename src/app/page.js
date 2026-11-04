import { Fragment } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import HeroText from "@/components/HeroText";
import HeroAtouts from "@/components/HeroAtouts";
import FeaturedCarousel from "@/components/FeaturedCarousel";
import ThemeTags from "@/components/ThemeTags";
import BottomColumns from "@/components/BottomColumns";
import SupportBanner from "@/components/SupportBanner";
import EncartDonCompteARebours from "@/components/EncartDonCompteARebours";
import { enLignes } from "@/lib/textes-site";
import { lireTextes } from "@/lib/textes-site-serveur";
import {
  getFeaturedRotation,
  getTopDeclarations,
  getCandidateRanking,
  getIndexRecherche,
} from "@/lib/queries";
import { getHorsSeriesAccueil } from "@/lib/hors-series";

// La page dépend de données Neon qui changent (analyses publiées, scores) :
// ISR, recalculée au plus toutes les 5 minutes et servie depuis le cache du
// CDN entre-temps (rendu reproductible, voir getFeaturedRotation).
export const revalidate = 300;

export default async function Home() {
  const [featuredRotation, topDeclarations, classement, t, indexRecherche] =
    await Promise.all([
      // Analyses publiées et dossiers, dans un seul ordre chronologique.
      getHorsSeriesAccueil().then(getFeaturedRotation),
      getTopDeclarations(4),
      // Classement complet (même requête, sans limite) : le bloc en affiche
      // 5 et déroule les suivants au clic, sans nouvel appel réseau.
      getCandidateRanking(),
      // Textes modifiables depuis /test/textes/accueil
      lireTextes("accueil"),
      // Données de la barre de recherche (recherche faite dans le navigateur)
      getIndexRecherche(),
    ]);

  // Seuls les candidats classés (au moins une déclaration analysée).
  const rankedCandidates = classement.filter(
    (candidat) => candidat.declarations > 0,
  );

  // Titre du bandeau « Rejoignez-nous » : une ligne = un retour à la ligne
  // (sur grand écran seulement, comme avant).
  const titreBandeau = enLignes(t["bandeau.titre"]).map((morceau, index) => (
    <Fragment key={index}>
      {index > 0 ? (
        <>
          <br className="hidden sm:block" />{" "}
        </>
      ) : null}
      {morceau}
    </Fragment>
  ));

  return (
    <div className="flex min-h-screen flex-col bg-page-gradient font-sans">
      <Header />

      {/* Bandeau principal (maquette oct. 2026) : titre + recherche à
          gauche, analyse à la une à droite, puis les 3 atouts dessous. */}
      <section className="w-full px-6 pb-10 pt-12 sm:px-8 sm:pb-14 sm:pt-20">
        <div className="mx-auto grid w-full max-w-[1280px] grid-cols-1 items-center gap-10 lg:grid-cols-[1.08fr_1fr] lg:gap-14">
          <HeroText textes={t} documents={indexRecherche} />
          <FeaturedCarousel items={featuredRotation} />
        </div>
      </section>

      <section className="w-full px-6 pb-14 sm:px-8 sm:pb-20">
        <div className="mx-auto w-full max-w-[1280px]">
          <HeroAtouts textes={t} />
        </div>
      </section>

      <section className="w-full px-6 pb-10 sm:px-8">
        <div className="mx-auto w-full max-w-[1280px]">
          <ThemeTags />
        </div>
      </section>

      <section className="w-full px-6 pb-10 sm:px-8">
        <div className="mx-auto w-full max-w-[1280px]">
          <BottomColumns
            topDeclarations={topDeclarations}
            rankedCandidates={rankedCandidates}
            textes={t}
          />
        </div>
      </section>

      {/* Bandeau « Rejoignez-nous » rétréci, avec l'encart de don (compte à
          rebours jusqu'au premier tour) juste à côté sur grand écran. */}
      <section className="w-full px-6 pb-6 sm:px-8">
        <div className="mx-auto grid w-full max-w-[1280px] grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
          <SupportBanner
            embedded
            compact
            title={titreBandeau}
            text={t["bandeau.texte"]}
            buttonLabel={t["bandeau.bouton"]}
          />
          <EncartDonCompteARebours />
        </div>
      </section>

      <section className="w-full px-6 pb-16 sm:px-8 sm:pb-20">
        <div className="mx-auto flex w-full max-w-[1280px] flex-col items-start justify-between gap-4 rounded-2xl border border-zinc-200 bg-white p-6 sm:flex-row sm:items-center sm:p-8">
          <div className="flex items-start gap-3">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              className="mt-0.5 h-6 w-6 shrink-0 text-zinc-400"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z"
              />
            </svg>
            <div>
              <p className="text-sm font-bold text-zinc-900">
                {t["transparence.titre"]}
              </p>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-zinc-500">
                {t["transparence.texte"]}
              </p>
            </div>
          </div>

          <Link
            href="/a-propos"
            className="shrink-0 whitespace-nowrap text-sm font-semibold text-zinc-500 transition-colors hover:text-zinc-900"
          >
            {t["transparence.lien"]}
          </Link>
        </div>
      </section>
    </div>
  );
}
