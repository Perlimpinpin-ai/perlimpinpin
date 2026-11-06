import Link from "next/link";
import Header from "@/components/Header";
import MonoTag from "@/components/MonoTag";
import { prisma } from "@/lib/prisma";
import { formatScore, getScoreBadge } from "@/lib/score";
import { themeLabel } from "@/lib/themes";
import { editionConfiguree, isEditor } from "@/lib/test-auth";
import CorbeilleBouton from "./CorbeilleBouton";
import EditorBar from "./EditorBar";
import RestaurerBouton from "./RestaurerBouton";

// Toujours recalculée à chaque visite : on veut voir les brouillons du moment,
// pas une copie mise en cache (même choix que les autres pages du site).
export const dynamic = "force-dynamic";

// Page de travail, pas une page du site public : on demande aux moteurs de
// recherche de ne pas l'indexer et de ne pas suivre ses liens.
export const metadata = {
  title: "Brouillons — Perlimpinpin",
  robots: { index: false, follow: false },
};

// Même règle que sur le site public (voir displayTitle dans src/lib/queries.js) :
// le titre court s'il existe, sinon le début du texte d'origine.
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

// Les analyses en statut "brouillon" : celles que scripts/analyze.js enregistre
// à chaque nouvelle analyse, et que le site public ne montre jamais. On ne
// sélectionne que les champs utiles à la liste (pas le gros JSON complet).
async function getBrouillons() {
  return prisma.analyse.findMany({
    where: { statut: "brouillon" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      scoreFaisabilite: true,
      verdict: true,
      versionMethodologie: true,
      createdAt: true,
      proposition: {
        select: {
          id: true,
          titre: true,
          texteOriginal: true,
          theme: true,
          candidat: { select: { nom: true, parti: true } },
        },
      },
    },
  });
}

// Les analyses mises à la corbeille depuis cette page (statut "corbeille" : rien
// n'est supprimé), les plus récemment créées d'abord.
async function getCorbeille() {
  return prisma.analyse.findMany({
    where: { statut: "corbeille" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      proposition: {
        select: {
          id: true,
          titre: true,
          texteOriginal: true,
          candidat: { select: { nom: true } },
        },
      },
    },
  });
}

export default async function TestPage() {
  const brouillons = await getBrouillons();
  const configuree = editionConfiguree();
  const editeur = configuree && (await isEditor());
  // La corbeille n'est lue qu'en mode édition.
  const corbeille = editeur ? await getCorbeille() : [];

  return (
    <div className="flex min-h-screen flex-col bg-page-gradient font-sans">
      <Header />

      <main className="w-full px-6 py-12 sm:px-8 sm:py-16">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
          <div>
            <MonoTag>Brouillons</MonoTag>
            <h1 className="mt-2 text-[clamp(1.875rem,1.2rem+2.6vw,3.75rem)] font-extrabold tracking-tight text-zinc-900">
              Analyses en brouillon
            </h1>
            <p className="mt-2 max-w-xl text-base text-zinc-500">
              Ces analyses ne sont pas publiées : elles n&rsquo;apparaissent
              nulle part sur le site public. Cette page sert à les relire avant
              publication.
            </p>
            {/* Mode édition : n'apparaît que si le code d'édition est configuré
                sur ce serveur. */}
            {configuree ? (
              <div className="mt-4 flex flex-wrap items-center gap-3 text-zinc-700">
                <EditorBar editeur={editeur} />
                {/* Publications X des fiches : pour les personnes déverrouillées. */}
                {editeur ? (
                  <Link
                    href="/test/reseaux"
                    className="rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs font-semibold text-zinc-800 transition-colors hover:bg-zinc-100"
                  >
                    Publications réseaux sociaux →
                  </Link>
                ) : null}
              </div>
            ) : null}
          </div>

          {brouillons.length === 0 ? (
            <p className="rounded-xl border border-zinc-200 bg-white/60 p-6 text-sm text-zinc-500">
              Aucun brouillon pour le moment.
            </p>
          ) : (
            <>
              <p className="text-sm font-semibold text-zinc-700">
                {brouillons.length} brouillon{brouillons.length > 1 ? "s" : ""}
              </p>

              <ul className="flex flex-col gap-3">
                {brouillons.map((analyse) => {
                  const { proposition } = analyse;
                  const badge = getScoreBadge(analyse.scoreFaisabilite);

                  return (
                    <li key={analyse.id} className="relative">
                      {/* L'identifiant du lien est celui de la PROPOSITION,
                          comme pour /declarations/[id]. */}
                      <Link
                        href={`/test/${proposition.id}`}
                        className={`flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white/70 p-5 transition-opacity hover:opacity-70 sm:flex-row sm:items-center sm:justify-between ${editeur ? "pb-10" : ""}`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-zinc-400">
                            {proposition.candidat.nom} · {themeLabel(proposition.theme)}
                          </p>
                          <p className="mt-1 text-base font-semibold text-zinc-900">
                            {displayTitle(proposition)}
                          </p>
                          <p className="mt-1 font-mono text-xs text-zinc-400">
                            Analyse #{analyse.id} · Mesure #{proposition.id} ·{" "}
                            {formatDate(analyse.createdAt)} · méthodologie v
                            {analyse.versionMethodologie}
                          </p>
                        </div>

                        <div className="shrink-0 sm:text-right">
                          <p
                            className={`text-3xl font-extrabold tracking-tight ${badge.scoreClass}`}
                          >
                            {formatScore(analyse.scoreFaisabilite)}
                            <span className="text-sm font-semibold text-zinc-400">
                              /100
                            </span>
                          </p>
                          <p
                            className={`text-sm font-semibold ${badge.scoreClass}`}
                          >
                            {badge.label}
                          </p>
                        </div>
                      </Link>
                      {/* Hors du lien (un bouton ne peut pas être dans un <a>) :
                          posé dans le bas de la carte, en mode édition seulement. */}
                      {editeur ? (
                        <div className="absolute bottom-3 right-5">
                          <CorbeilleBouton
                            analyseId={analyse.id}
                            titre={displayTitle(proposition)}
                          />
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {/* Corbeille : en mode édition seulement, repliée par défaut. Le
              navigateur garde la section ouverte quand la page est recalculée
              après une restauration. */}
          {editeur ? (
            <details className="rounded-xl border border-zinc-200 bg-white/50 p-5">
              <summary className="cursor-pointer text-sm font-semibold text-zinc-700">
                Corbeille ({corbeille.length})
              </summary>
              {corbeille.length === 0 ? (
                <p className="mt-3 text-sm text-zinc-500">La corbeille est vide.</p>
              ) : (
                <ul className="mt-3 flex flex-col divide-y divide-zinc-200">
                  {corbeille.map((analyse) => (
                    <li
                      key={analyse.id}
                      className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-zinc-400">
                          {analyse.proposition.candidat.nom}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-zinc-700">
                          {displayTitle(analyse.proposition)}
                        </p>
                        <p className="mt-1 font-mono text-xs text-zinc-400">
                          Analyse #{analyse.id} · Mesure #{analyse.proposition.id}
                        </p>
                      </div>
                      <div className="shrink-0">
                        <RestaurerBouton analyseId={analyse.id} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </details>
          ) : null}
        </div>
      </main>
    </div>
  );
}
