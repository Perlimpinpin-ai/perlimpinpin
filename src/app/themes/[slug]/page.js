import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import { getPublishedPropositionsByThemeSlug } from "@/lib/queries";
import { getThemeBySlug } from "@/lib/themes";
import { getScoreBadge } from "@/lib/score";
import { vignettePhoto } from "@/lib/photo-vignette";

// ISR : chaque page est calculée à sa première visite, puis servie depuis le
// cache du CDN et recalculée au plus tard une fois par jour (et aussitôt après
// chaque publication, src/lib/rafraichir-public.js). generateStaticParams
// renvoie [] : le build ne lit pas Neon, et dynamicParams = true laisse
// générer n'importe quelle adresse à la demande.
export const revalidate = 86400;
export const dynamicParams = true;

export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const theme = getThemeBySlug(slug);
  if (!theme) return {};
  return {
    title: `${theme.name} — Perlimpinpin`,
    description: theme.description,
  };
}

export default async function ThemeDetailPage({ params }) {
  const { slug } = await params;
  const theme = getThemeBySlug(slug);

  if (!theme) {
    notFound();
  }

  const propositions = await getPublishedPropositionsByThemeSlug(slug);

  return (
    <div className="flex min-h-screen flex-col bg-page-gradient font-sans">
      <Header />

      <main className="w-full px-6 py-12 sm:px-8 sm:py-16">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-red-600">
              Thèmes
            </span>
            <h1 className="mt-2 font-serif text-3xl font-bold leading-tight tracking-tight text-zinc-900 sm:text-4xl">
              {theme.name}
            </h1>
            <p className="mt-3 text-base leading-relaxed text-zinc-600">
              {theme.description}
            </p>
          </div>

          {propositions.length === 0 ? (
            <p className="text-sm text-zinc-500">
              Aucune proposition analysée sur ce thème pour le moment.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {propositions.map((proposition) => {
                const badge = getScoreBadge(proposition.score);
                return (
                  <Link
                    key={proposition.propositionId}
                    href={`/declarations/${proposition.propositionId}`}
                    className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-6 transition-colors hover:border-zinc-300 hover:bg-zinc-50 sm:flex-row sm:items-center"
                  >
                    <img
                      src={vignettePhoto(proposition.candidatPhotoUrl) || "/avatar-placeholder.svg"}
                      alt={proposition.candidatNom}
                      className="h-11 w-11 shrink-0 rounded-lg object-cover object-top"
                    />

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-zinc-900">
                        {proposition.candidatNom}
                        <span className="ml-1.5 font-normal text-zinc-400">
                          {proposition.candidatParti}
                        </span>
                      </p>
                      <p className="mt-1 text-base font-semibold text-zinc-900">
                        {proposition.titre}
                      </p>
                      {proposition.excerpt ? (
                        <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-zinc-500">
                          {proposition.excerpt}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end sm:gap-1">
                      <span className={`text-lg font-bold ${badge.scoreClass}`}>
                        {proposition.score}
                        <span className="text-xs font-medium text-zinc-400">/100</span>
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badge.badgeClass}`}
                      >
                        {badge.label}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
