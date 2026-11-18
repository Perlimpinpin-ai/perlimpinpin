import Link from "next/link";
import Header from "@/components/Header";
import MonoTag from "@/components/MonoTag";
import { prisma } from "@/lib/prisma";
import { formatScore, getScoreBadge } from "@/lib/score";
import { editionConfiguree, isEditor } from "@/lib/test-auth";
import EditorBar from "../EditorBar";
import BoutonGenererReel from "./BoutonGenererReel";

// Toujours recalculée à chaque visite (comme les autres pages /test).
export const dynamic = "force-dynamic";

// Les actions du bouton « Générer le Reel » appellent Claude (30 s à 2 min,
// deux essais au plus) : durée maximale portée à 300 s, comme /api/live/analyze.
export const maxDuration = 300;

// Page de travail, pas une page du site public.
export const metadata = {
  title: "Reels vidéo — Perlimpinpin",
  robots: { index: false, follow: false },
};

// Index des Reels : analyses publiées puis brouillons, avec un lien vers la
// page du Reel de chaque fiche quand son script existe, sinon la commande pour
// le générer. Réservée aux personnes déverrouillées (même code d'édition que
// /test). Lecture seule : aucune écriture en base.

const FILTRES = [
  { valeur: "toutes", libelle: "Toutes" },
  { valeur: "avec", libelle: "Avec Reel" },
  { valeur: "sans", libelle: "Sans Reel" },
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
  proposition: { select: { id: true, titre: true, texteOriginal: true, candidat: { select: { nom: true } } } },
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

// Analyses qui ont un Reel (clé reel de contenuComplet), calculé par Postgres
// sans charger le JSON.
async function getAnalysesAvecReel() {
  const lignes = await prisma.$queryRaw`
    SELECT id FROM "Analyse"
    WHERE jsonb_exists("contenuComplet", 'reel')
  `;
  return new Set(lignes.map((ligne) => Number(ligne.id)));
}

function Ligne({ analyse, aUnReel }) {
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
          href={brouillon ? `/test/${proposition.id}` : `/declarations/${proposition.id}`}
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
        {aUnReel ? (
          <>
            <Link
              href={`/test/reels/${proposition.id}${brouillon ? "?brouillon=1" : ""}`}
              className="text-sm font-semibold text-zinc-800 underline underline-offset-2 hover:opacity-70"
            >
              Voir le Reel →
            </Link>
            <BoutonGenererReel propositionId={proposition.id} brouillon={brouillon} aDejaUnReel discret />
          </>
        ) : (
          <BoutonGenererReel propositionId={proposition.id} brouillon={brouillon} />
        )}
      </div>
    </li>
  );
}

function Rubrique({ titre, analyses, avecReel, vide }) {
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
            <Ligne key={analyse.id} analyse={analyse} aUnReel={avecReel.has(analyse.id)} />
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function ReelsPage({ searchParams }) {
  const configuree = editionConfiguree();
  const editeur = configuree && (await isEditor());
  const { filtre: filtreDemande } = await searchParams;
  const filtre = FILTRES.some((f) => f.valeur === filtreDemande) ? filtreDemande : "toutes";

  let publiees = [];
  let brouillons = [];
  let avecReel = new Set();
  if (editeur) {
    const [analyses, ids] = await Promise.all([getAnalyses(), getAnalysesAvecReel()]);
    avecReel = ids;
    const garder = (analyse) => filtre === "toutes" || (filtre === "avec") === avecReel.has(analyse.id);
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
              <MonoTag>Reels vidéo</MonoTag>
            </div>
            <h1 className="mt-2 text-[clamp(1.875rem,1.2rem+2.6vw,3.75rem)] font-extrabold tracking-tight text-zinc-900">
              Reels vidéo
            </h1>
            <p className="mt-2 max-w-xl text-base text-zinc-500">
              Le script de la voix off et les 9 images de chaque fiche, à récupérer pour le montage. Rien n&rsquo;est publié
              automatiquement.
            </p>
            {configuree ? (
              <div className="mt-4 flex flex-wrap items-center gap-3 text-zinc-700">
                <EditorBar editeur={editeur} />
                {editeur ? (
                  <Link
                    href="/test/reels/icones"
                    className="rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs font-semibold text-zinc-800 transition-colors hover:bg-zinc-100"
                  >
                    Icônes et aperçu du style →
                  </Link>
                ) : null}
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
                    href={valeur === "toutes" ? "/test/reels" : `/test/reels?filtre=${valeur}`}
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

              <Rubrique titre="Analyses publiées" analyses={publiees} avecReel={avecReel} vide="Aucune analyse publiée pour ce filtre." />
              <Rubrique titre="Brouillons" analyses={brouillons} avecReel={avecReel} vide="Aucun brouillon pour ce filtre." />
            </>
          )}
        </div>
      </main>
    </div>
  );
}
