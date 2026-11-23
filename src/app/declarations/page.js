import Link from "next/link";
import Header from "@/components/Header";
import FilterPillGroup from "@/components/FilterPillGroup";
import MonoTag from "@/components/MonoTag";
import DeclarationCarte from "@/components/DeclarationCarte";
import SearchBar from "@/components/SearchBar";
import { getPublishedDeclarations } from "@/lib/queries";
import { resolveTheme, themeLabel } from "@/lib/themes";

// Page dynamique (elle lit ?candidat=, ?theme=, ?q=), mais sans lecture en
// base à chaque visite : les déclarations publiées sont en cache (un jour au
// plus, vidé à chaque publication), voir getPublishedDeclarations.
export const dynamic = "force-dynamic";

// Mots-clés de la barre de recherche (?q=...) : texte nettoyé, 100
// caractères max, undefined si vide ou mal formé (ex. ?q=a&q=b).
function lireRecherche(valeur) {
  if (typeof valeur !== "string") return undefined;
  return valeur.trim().slice(0, 100) || undefined;
}

export async function generateMetadata({ searchParams }) {
  const resolvedParams = await searchParams;
  const candidat = resolvedParams?.candidat || undefined;
  const theme = resolvedParams?.theme ? themeLabel(resolvedParams.theme) : undefined;
  const q = lireRecherche(resolvedParams?.q);

  let title = "Déclarations analysées | Perlimpinpin";
  let description =
    "Toutes les déclarations et propositions des candidats à la présidentielle 2027, notées sur leur réalisme et leur faisabilité par Perlimpinpin.";

  if (candidat && theme) {
    title = `${candidat} — ${theme} | Déclarations | Perlimpinpin`;
    description = `Déclarations de ${candidat} sur le thème ${theme}, notées sur leur réalisme et leur faisabilité par Perlimpinpin.`;
  } else if (candidat) {
    title = `${candidat} — Déclarations analysées | Perlimpinpin`;
    description = `Toutes les déclarations de ${candidat} notées sur leur réalisme et leur faisabilité par Perlimpinpin.`;
  } else if (theme) {
    title = `${theme} — Déclarations analysées | Perlimpinpin`;
    description = `Déclarations sur le thème ${theme}, notées sur leur réalisme et leur faisabilité par Perlimpinpin.`;
  }

  if (q) {
    title = `« ${q} » — Recherche | Perlimpinpin`;
    description = `Propositions des candidats à la présidentielle 2027 correspondant à « ${q} », notées par Perlimpinpin.`;
  }

  return {
    title,
    description,
    openGraph: { title, description },
  };
}

const sortOptions = [
  { value: "date", label: "Date ↓" },
  { value: "score_desc", label: "Score ↓" },
  { value: "score_asc", label: "Score ↑" },
];

function buildSortHref(currentParams, value) {
  const params = new URLSearchParams(currentParams);
  params.set("sort", value);
  return `/declarations?${params.toString()}`;
}

function buildHrefSansRecherche(currentParams) {
  const params = new URLSearchParams(currentParams);
  params.delete("q");
  const query = params.toString();
  return query ? `/declarations?${query}` : "/declarations";
}

export default async function DeclarationsPage({ searchParams }) {
  const resolvedParams = await searchParams;
  const candidat = resolvedParams?.candidat || undefined;
  // Slug du thème ; une ancienne URL (?theme=Emploi%20et%20chômage) ou un
  // raccourci de recherche (libellé) est ramené au slug pour que la bonne
  // pastille reste active.
  const theme = resolvedParams?.theme
    ? (resolveTheme(resolvedParams.theme) ?? resolvedParams.theme)
    : undefined;
  // Mots-clés de la barre de recherche (page d'accueil ou ci-dessous).
  const q = lireRecherche(resolvedParams?.q);
  // Avec une recherche, les résultats sont classés par pertinence par défaut.
  const sort = resolvedParams?.sort || (q ? "pertinence" : "date");

  const { declarations, candidats, themes } = await getPublishedDeclarations({
    candidat,
    theme,
    sort,
    q,
  });

  const currentParams = {};
  if (q) currentParams.q = q;
  if (candidat) currentParams.candidat = candidat;
  if (theme) currentParams.theme = theme;
  if (sort) currentParams.sort = sort;

  return (
    <div className="flex min-h-screen flex-col bg-page-gradient font-sans">
      <Header />

      <main className="w-full px-6 py-12 sm:px-8 sm:py-16">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
          <div>
            <MonoTag>Déclarations</MonoTag>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-4xl">
              Déclarations analysées
            </h1>
            <p className="mt-2 text-sm text-zinc-500">
              {declarations.length} déclaration
              {declarations.length > 1 ? "s" : ""} publiée
              {declarations.length > 1 ? "s" : ""}
              {q ? (
                <>
                  {" "}pour «&nbsp;<span className="font-semibold text-zinc-900">{q}</span>&nbsp;» ·{" "}
                  <Link
                    href={buildHrefSansRecherche(currentParams)}
                    prefetch={false}
                    className="font-semibold text-blue-600 hover:text-blue-800"
                  >
                    effacer la recherche
                  </Link>
                </>
              ) : null}
            </p>
          </div>

          <div className="max-w-2xl">
            <SearchBar
              defaultValue={q ?? ""}
              autres={Object.fromEntries(
                Object.entries(currentParams).filter(([cle]) => cle !== "q"),
              )}
            />
          </div>

          <div className="flex flex-col gap-4">
            <FilterPillGroup
              label="Candidat"
              options={candidats.map((c) => ({ value: c.nom, label: c.nom }))}
              activeValue={candidat}
              paramKey="candidat"
              currentParams={currentParams}
            />

            <FilterPillGroup
              label="Thème"
              options={themes}
              activeValue={theme}
              paramKey="theme"
              currentParams={currentParams}
            />

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-500">
                Trier
              </p>
              <div className="flex flex-wrap gap-2">
                {(q
                  ? [{ value: "pertinence", label: "Pertinence" }, ...sortOptions]
                  : sortOptions
                ).map((option) => (
                  <Link
                    key={option.value}
                    href={buildSortHref(currentParams, option.value)}
                    prefetch={false}
                    className={`rounded-full px-3 py-1 text-sm font-semibold transition-colors ${
                      sort === option.value
                        ? "bg-zinc-900 text-white"
                        : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                    }`}
                  >
                    {option.label}
                  </Link>
                ))}
              </div>
            </div>

            <hr className="border-zinc-200" />
          </div>

          {declarations.length === 0 ? (
            <p className="text-sm text-zinc-500">
              {q
                ? "Aucune proposition analysée ne correspond à cette recherche pour le moment. Essayez un autre mot-clé, ou retirez un filtre."
                : "Aucune déclaration ne correspond à ces filtres."}
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {declarations.map((d) => (
                <DeclarationCarte key={d.id} d={d} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
