import Link from "next/link";
import Header from "@/components/Header";
import MonoTag from "@/components/MonoTag";
import { prisma } from "@/lib/prisma";
import { formatScore, getScoreBadge } from "@/lib/score";
import { themeLabel } from "@/lib/themes";
import { ORDRE_DERNIERES_PUBLICATIONS, datePublication } from "@/lib/date-publication";
import { editionConfiguree, isEditor } from "@/lib/test-auth";
import EditorBar from "../EditorBar";

// Toujours recalculée à chaque visite (même choix que la liste /test).
export const dynamic = "force-dynamic";

// Page de travail, pas une page du site public : masquée des moteurs de recherche.
export const metadata = {
  title: "Fiches publiées — Perlimpinpin",
  robots: { index: false, follow: false },
};

// Même règle que sur le site public (voir displayTitle dans src/lib/queries.js).
function displayTitle(proposition) {
  if (proposition.titre) return proposition.titre;
  const text = proposition.texteOriginal;
  return text.length > 80 ? `${text.slice(0, 79).trimEnd()}…` : text;
}

function formatDate(date) {
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Paris",
  });
}

// Recherche tolérante : sans accents ni majuscules.
const sansAccents = (texte) =>
  String(texte ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

// Les fiches en ligne (statut "publie"), les plus récemment publiées d'abord
// (même ordre que le site public). Champs utiles à la liste seulement (pas le
// gros JSON complet).
async function getPubliees() {
  return prisma.analyse.findMany({
    where: { statut: "publie" },
    orderBy: ORDRE_DERNIERES_PUBLICATIONS,
    select: {
      id: true,
      scoreFaisabilite: true,
      createdAt: true,
      publieLe: true,
      proposition: {
        select: {
          id: true,
          titre: true,
          texteOriginal: true,
          theme: true,
          candidat: { select: { nom: true } },
        },
      },
    },
  });
}

export default async function FichesPublieesPage({ searchParams }) {
  const configuree = editionConfiguree();
  const editeur = configuree && (await isEditor());
  const { q } = await searchParams;
  const recherche = typeof q === "string" ? q.trim().slice(0, 100) : "";

  // Réservée à l'éditeur : sans code, seulement le déverrouillage.
  const publiees = editeur ? await getPubliees() : [];
  const cherche = sansAccents(recherche);
  const resultats = cherche
    ? publiees.filter(
        (a) =>
          sansAccents(displayTitle(a.proposition)).includes(cherche) ||
          sansAccents(a.proposition.candidat.nom).includes(cherche),
      )
    : publiees;

  return (
    <div className="flex min-h-screen flex-col bg-page-gradient font-sans">
      <Header />

      <main className="w-full px-6 py-12 sm:px-8 sm:py-16">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
          <div>
            <Link
              href="/test"
              className="text-sm font-semibold text-zinc-600 underline underline-offset-2 transition-opacity hover:opacity-70"
            >
              ← Brouillons
            </Link>
            <div className="mt-4">
              <MonoTag>Fiches publiées</MonoTag>
            </div>
            <h1 className="mt-2 text-[clamp(1.875rem,1.2rem+2.6vw,3.75rem)] font-extrabold tracking-tight text-zinc-900">
              Corriger une coquille
            </h1>
            <p className="mt-2 max-w-xl text-base text-zinc-500">
              Les fiches en ligne. Une correction y est visible immédiatement, sans
              nouvelle version : réservé aux fautes de frappe, d&rsquo;orthographe et
              de ponctuation.
            </p>
            {configuree ? (
              <div className="mt-4 flex flex-wrap items-center gap-3 text-zinc-700">
                <EditorBar editeur={editeur} />
              </div>
            ) : null}
          </div>

          {!editeur ? (
            <p className="rounded-xl border border-zinc-200 bg-white/60 p-6 text-sm text-zinc-500">
              Page réservée à l&rsquo;éditeur{configuree ? " : déverrouillez avec le code d’édition." : "."}
            </p>
          ) : (
            <>
              <form method="get" role="search" className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <label htmlFor="recherche-publiees" className="sr-only">
                  Rechercher par titre ou candidat
                </label>
                <input
                  id="recherche-publiees"
                  type="search"
                  name="q"
                  defaultValue={recherche}
                  placeholder="Titre ou candidat…"
                  className="w-full rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-200 sm:max-w-sm"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-800"
                  >
                    Rechercher
                  </button>
                  {recherche ? (
                    <Link
                      href="/test/publiees"
                      className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-100"
                    >
                      Effacer
                    </Link>
                  ) : null}
                </div>
              </form>

              <p className="text-sm font-semibold text-zinc-700">
                {recherche
                  ? `${resultats.length} fiche${resultats.length > 1 ? "s" : ""} sur ${publiees.length}`
                  : `${publiees.length} fiche${publiees.length > 1 ? "s" : ""} publiée${publiees.length > 1 ? "s" : ""}`}
              </p>

              {resultats.length === 0 ? (
                <p className="rounded-xl border border-zinc-200 bg-white/60 p-6 text-sm text-zinc-500">
                  {recherche ? "Aucune fiche ne correspond à cette recherche." : "Aucune fiche publiée."}
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {resultats.map((analyse) => {
                    const { proposition } = analyse;
                    const badge = getScoreBadge(analyse.scoreFaisabilite);
                    return (
                      <li key={analyse.id}>
                        {/* L'identifiant du lien est celui de la PROPOSITION,
                            comme pour /declarations/[slug]. */}
                        <Link
                          href={`/test/publiees/${proposition.id}`}
                          className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white/70 p-5 transition-opacity hover:opacity-70 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-zinc-400">
                              {proposition.candidat.nom} · {themeLabel(proposition.theme)}
                            </p>
                            <p className="mt-1 text-base font-semibold text-zinc-900">{displayTitle(proposition)}</p>
                            <p className="mt-1 font-mono text-xs text-zinc-400">
                              Analyse #{analyse.id} · Mesure #{proposition.id} · {formatDate(datePublication(analyse))}
                            </p>
                          </div>
                          <div className="shrink-0 sm:text-right">
                            <p className={`text-3xl font-extrabold tracking-tight ${badge.scoreClass}`}>
                              {formatScore(analyse.scoreFaisabilite)}
                              <span className="text-sm font-semibold text-zinc-400">/100</span>
                            </p>
                            <p className={`text-sm font-semibold ${badge.scoreClass}`}>{badge.label}</p>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
