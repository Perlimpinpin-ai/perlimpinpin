import { cheminFiche } from "@/lib/slug";
import Link from "next/link";
import Header from "@/components/Header";
import MonoTag from "@/components/MonoTag";
import { prisma } from "@/lib/prisma";
import { formatScore, getScoreBadge } from "@/lib/score";
import { editionConfiguree, isEditor } from "@/lib/test-auth";
import EditorBar from "../EditorBar";

// Toujours recalculée à chaque visite (comme les autres pages /test).
export const dynamic = "force-dynamic";

// Page de travail, pas une page du site public.
export const metadata = {
  title: "Publications réseaux sociaux — Perlimpinpin",
  robots: { index: false, follow: false },
};

// Index des publications X : analyses publiées puis brouillons, avec un lien
// vers la page de partage de chaque fiche quand ses textes existent, sinon la
// commande pour les générer. Réservée aux personnes déverrouillées (même code
// d'édition que /test). Lecture seule : aucune écriture en base.

const FILTRES = [
  { valeur: "toutes", libelle: "Toutes" },
  { valeur: "avec", libelle: "Avec tweets" },
  { valeur: "sans", libelle: "Sans tweets" },
];

// Même règle que sur le site public (voir displayTitle dans src/lib/queries.js).
function displayTitle(proposition) {
  if (proposition.titre) return proposition.titre;
  const text = proposition.texteOriginal;
  return text.length > 80 ? `${text.slice(0, 79).trimEnd()}…` : text;
}

function formatDate(date) {
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Paris" });
}

const CHAMPS = {
  id: true,
  statut: true,
  scoreFaisabilite: true,
  createdAt: true,
  proposition: { select: { id: true, titre: true, slug: true, texteOriginal: true, candidat: { select: { nom: true } } } },
};

// Analyses publiées : la dernière de chaque mesure. Brouillons : tous, comme
// sur /test. Sans le gros JSON, de la plus récente à la plus ancienne.
async function getAnalyses() {
  const [publiees, brouillons] = await Promise.all([
    prisma.analyse.findMany({ where: { statut: "publie" }, orderBy: { createdAt: "desc" }, select: CHAMPS }),
    prisma.analyse.findMany({ where: { statut: "brouillon" }, orderBy: { createdAt: "desc" }, select: CHAMPS }),
  ]);
  const vues = new Set();
  return {
    publiees: publiees.filter(({ proposition }) => !vues.has(proposition.id) && vues.add(proposition.id)),
    brouillons,
  };
}

// Analyses qui ont des publications X (clé reseaux de contenuComplet),
// calculé par Postgres sans charger le JSON.
async function getAnalysesAvecReseaux() {
  const lignes = await prisma.$queryRaw`
    SELECT id FROM "Analyse"
    WHERE jsonb_exists("contenuComplet", 'reseaux')
  `;
  return new Set(lignes.map((ligne) => Number(ligne.id)));
}

function Ligne({ analyse, aDesTweets }) {
  const { proposition } = analyse;
  const brouillon = analyse.statut === "brouillon";
  const badge = getScoreBadge(analyse.scoreFaisabilite);
  return (
    <li className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white/70 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <p className="text-xs text-zinc-400">
          {proposition.candidat.nom} · analyse du {formatDate(analyse.createdAt)} · Mesure #{proposition.id}
        </p>
        <Link
          href={brouillon ? `/test/${proposition.id}` : cheminFiche(proposition)}
          className="mt-0.5 block text-sm font-semibold text-zinc-900 hover:underline"
        >
          {displayTitle(proposition)}
        </Link>
      </div>
      <div className="flex shrink-0 items-center gap-4 sm:text-right">
        <span className={`text-lg font-extrabold ${badge.scoreClass}`}>
          {formatScore(analyse.scoreFaisabilite)}
          <span className="text-xs font-semibold text-zinc-400">/100</span>
        </span>
        {aDesTweets ? (
          <Link
            href={`/test/reseaux/${proposition.id}${brouillon ? "?brouillon=1" : ""}`}
            className="text-sm font-semibold text-zinc-800 underline underline-offset-2 hover:opacity-70"
          >
            Voir les publications →
          </Link>
        ) : (
          <span className="flex flex-col text-xs text-zinc-400 sm:items-end">
            Pas encore de tweets
            <code className="font-mono text-zinc-500">
              node scripts/reseaux.js {proposition.id}
              {brouillon ? " --brouillon" : ""}
            </code>
          </span>
        )}
      </div>
    </li>
  );
}

function Rubrique({ titre, analyses, avecReseaux, vide }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-extrabold tracking-tight text-zinc-900">
        {titre} <span className="text-sm font-semibold text-zinc-400">({analyses.length})</span>
      </h2>
      {analyses.length === 0 ? (
        <p className="rounded-xl border border-zinc-200 bg-white/60 p-4 text-sm text-zinc-500">{vide}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {analyses.map((analyse) => (
            <Ligne key={analyse.id} analyse={analyse} aDesTweets={avecReseaux.has(analyse.id)} />
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function PublicationsReseauxPage({ searchParams }) {
  const configuree = editionConfiguree();
  const editeur = configuree && (await isEditor());
  const { filtre: filtreDemande } = await searchParams;
  const filtre = FILTRES.some((f) => f.valeur === filtreDemande) ? filtreDemande : "toutes";

  let publiees = [];
  let brouillons = [];
  let avecReseaux = new Set();
  if (editeur) {
    const [analyses, ids] = await Promise.all([getAnalyses(), getAnalysesAvecReseaux()]);
    avecReseaux = ids;
    const garder = (analyse) =>
      filtre === "toutes" || (filtre === "avec") === avecReseaux.has(analyse.id);
    publiees = analyses.publiees.filter(garder);
    brouillons = analyses.brouillons.filter(garder);
  }

  return (
    <div className="flex min-h-screen flex-col bg-page-gradient font-sans">
      <Header />

      <main className="w-full px-6 py-12 sm:px-8 sm:py-16">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
          <div>
            <Link href="/test" className="text-sm font-semibold underline underline-offset-2 hover:opacity-70">
              ← Tous les brouillons
            </Link>
            <div className="mt-4">
              <MonoTag>Publications X</MonoTag>
            </div>
            <h1 className="mt-2 text-[clamp(1.875rem,1.2rem+2.6vw,3.75rem)] font-extrabold tracking-tight text-zinc-900">
              Publications réseaux sociaux
            </h1>
            <p className="mt-2 max-w-xl text-base text-zinc-500">
              Les tweets préparés pour chaque fiche, à relire et à poster à la main. Rien n&rsquo;est publié
              automatiquement.
            </p>
            {configuree ? (
              <div className="mt-4 text-zinc-700">
                <EditorBar editeur={editeur} />
              </div>
            ) : null}
          </div>

          {!editeur ? (
            <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              {configuree
                ? "Page réservée aux personnes déverrouillées : saisissez le code d’édition ci-dessus."
                : "Le mode édition n’est pas configuré sur ce site."}
            </p>
          ) : (
            <>
              <nav aria-label="Filtrer les fiches" className="flex flex-wrap gap-2">
                {FILTRES.map(({ valeur, libelle }) => (
                  <Link
                    key={valeur}
                    href={valeur === "toutes" ? "/test/reseaux" : `/test/reseaux?filtre=${valeur}`}
                    aria-current={filtre === valeur ? "page" : undefined}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                      filtre === valeur
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-100"
                    }`}
                  >
                    {libelle}
                  </Link>
                ))}
              </nav>

              <Rubrique titre="Analyses publiées" analyses={publiees} avecReseaux={avecReseaux} vide="Aucune analyse publiée pour ce filtre." />
              <Rubrique titre="Brouillons" analyses={brouillons} avecReseaux={avecReseaux} vide="Aucun brouillon pour ce filtre." />
            </>
          )}
        </div>
      </main>
    </div>
  );
}
