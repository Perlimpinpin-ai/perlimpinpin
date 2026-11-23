import Link from "next/link";
import Header from "@/components/Header";
import { getPublishedCountsByThemeSlug } from "@/lib/queries";

// ISR : servie depuis le cache du CDN, recalculée au plus tard une fois par jour.
// Rafraîchie aussitôt après chaque publication (src/lib/rafraichir-public.js).
export const revalidate = 86400;

export const metadata = {
  title: "Thèmes — Perlimpinpin",
  description:
    "Les 12 grands thèmes d'analyse de Perlimpinpin pour la présidentielle 2027.",
};

const themes = [
  {
    slug: "logement",
    name: "Logement",
    description:
      "Construction, logement social, encadrement des loyers, rénovation énergétique, crédit immobilier.",
    sources: [
      "Fondation pour le Logement (Rapport sur le mal-logement)",
      "SDES — Compte du Logement",
      "INSEE (parc locatif social)",
      "Banque de France / HCSF",
    ],
  },
  {
    slug: "economie",
    name: "Perspectives économiques, pouvoir d'achat, inflation & fiscalité",
    description:
      "Budget de l'État, déficit public, pouvoir d'achat, TVA, fiscalité des entreprises.",
    sources: [
      "PLF (Assemblée nationale)",
      "Cour des comptes",
      "INSEE (notes de conjoncture, IPC)",
      "IPP",
      "OCDE (recettes publiques)",
      "Banque de France",
    ],
  },
  {
    slug: "ia-numerique",
    name: "IA & Numérique",
    description:
      "Régulation de l'IA, protection des données, cybersécurité, souveraineté numérique.",
    sources: ["AI Act européen", "CGE", "CNIL", "ANSSI", "SGPI", "CNPEN"],
  },
  {
    slug: "education",
    name: "Éducation nationale",
    description:
      "Niveau des élèves, effectifs enseignants, pénurie de professeurs, laïcité, public/privé.",
    sources: [
      "DEPP (L'état de l'école)",
      "PLF — Mission Enseignement scolaire",
      "OCDE (PISA)",
      "Cnesco",
    ],
  },
  {
    slug: "securite-justice",
    name: "Sécurité & Justice",
    description:
      "Délinquance, effectifs policiers, places de prison, indépendance de la justice, réponse pénale.",
    sources: [
      "SSMSI",
      "SDSE (Ministère de la Justice)",
      "DAP",
      "Sénat",
      "Conseil de l'Europe (CEPEJ)",
    ],
  },
  {
    slug: "sante",
    name: "Santé & Hôpital",
    description:
      "Fermeture de lits, déserts médicaux, financement de l'hôpital, urgences, reste à charge.",
    sources: [
      "DREES (panorama des établissements de santé)",
      "PLFSS",
      "CNOM (démographie médicale)",
    ],
  },
  {
    slug: "retraites",
    name: "Retraites",
    description:
      "Équilibre financier, âge de départ, pauvreté des retraités, comparaisons européennes.",
    sources: [
      "COR (rapport annuel)",
      "Cour des comptes",
      "PLFSS",
      "DREES",
      "OCDE (Pensions at a Glance)",
    ],
  },
  {
    slug: "emploi",
    name: "Emploi & Chômage",
    description:
      "Taux de chômage, précarité, allocations chômage, réforme du plein emploi.",
    sources: [
      "INSEE (Enquête Emploi)",
      "DARES (France Travail)",
      "Banque de France",
      "Unédic",
    ],
  },
  {
    slug: "energie-climat",
    name: "Énergie & Climat",
    description:
      "Mix énergétique, nucléaire vs renouvelables, objectifs climatiques, réseau électrique européen.",
    sources: [
      "RTE (Futurs énergétiques 2050)",
      "Haut Conseil pour le Climat",
      "SNBC 3",
      "CRE",
    ],
  },
  {
    slug: "alimentation-agriculture",
    name: "Alimentation & Agriculture",
    description:
      "Prix agricoles, souveraineté alimentaire, PAC, circuits courts.",
    sources: [
      "Agreste (Ministère de l'Agriculture)",
      "OFPM",
      "Chambres d'agriculture",
      "Agence Bio",
    ],
  },
  {
    slug: "immigration",
    name: "Immigration",
    description:
      "Démographie, immigration irrégulière, droit d'asile, OQTF, flux légaux.",
    sources: [
      "DGEF (Ministère de l'Intérieur)",
      "Cour des comptes",
      "OFPRA/CNDA",
      "INSEE",
      "DARES",
    ],
  },
  {
    slug: "democratie-et-institutions",
    name: "Démocratie et institutions",
    description:
      "Mode de scrutin, statut et immunité des élus, financement de la vie politique, référendum, séparation des pouvoirs, transparence de la vie publique.",
    sources: [
      "Conseil constitutionnel",
      "CNCCFP",
      "HATVP",
      "Sénat / Assemblée nationale (rapports institutionnels)",
      "Conseil de l'Europe (Commission de Venise)",
    ],
  },
];

export default async function ThemesPage() {
  const counts = await getPublishedCountsByThemeSlug();

  return (
    <div className="flex min-h-screen flex-col bg-page-gradient font-sans">
      <Header />

      <main className="w-full px-6 py-12 sm:px-8 sm:py-16">
        <div className="mx-auto w-full max-w-[1280px]">
          {/* Centré, sans eyebrow tag au-dessus du titre : la maquette 450
              (public/maquettes) ne montre ni MonoTag ni alignement à
              gauche — juste le titre et le paragraphe, centrés. Taille du
              titre alignée sur celle des autres titres de page (accueil,
              À propos) pour la même raison mesurée sur cette maquette : le
              texte précédent (text-4xl/5xl) était environ deux fois trop
              petit. */}
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-[clamp(2.25rem,1.1rem+5.2vw,6rem)] font-extrabold tracking-tight text-zinc-900">
              Nos thèmes d&apos;analyse
            </h1>

            <p className="mt-6 text-base leading-relaxed text-zinc-600">
              Perlimpinpin structure ses analyses autour de 12 grands
              thèmes de la présidentielle 2027. Chaque thème s&apos;appuie
              sur des sources publiques de référence et des points de
              vigilance méthodologiques propres à son domaine.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {themes.map((theme) => {
              const count = counts.get(theme.slug) ?? 0;
              return (
                <Link
                  key={theme.slug}
                  href={`/themes/${theme.slug}`}
                  className="group flex flex-col rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-50/30 hover:shadow-md"
                >
                  <h2 className="text-base font-bold text-zinc-900">
                    {theme.name}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-600">
                    {theme.description}
                  </p>

                  <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Sources clés
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {theme.sources.map((source) => (
                      <span
                        key={source}
                        className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-700"
                      >
                        {source}
                      </span>
                    ))}
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-4">
                    <p className="text-xs text-zinc-500">
                      {count === 0
                        ? "Aucune déclaration analysée pour l'instant"
                        : `${count} déclaration${count > 1 ? "s" : ""} analysée${count > 1 ? "s" : ""}`}
                    </p>
                    <span
                      aria-hidden="true"
                      className="text-zinc-400 transition-colors group-hover:text-blue-600"
                    >
                      →
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>

          <p className="mx-auto mt-12 mb-4 max-w-3xl text-sm leading-relaxed text-zinc-500">
            Chaque analyse publiée sur Perlimpinpin est rattachée à
            l&apos;un de ces thèmes, et mobilise en priorité les sources
            listées ci-dessus, complétées par une recherche ciblée si
            nécessaire.
          </p>
        </div>
      </main>
    </div>
  );
}
