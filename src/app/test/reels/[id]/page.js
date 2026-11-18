import { existsSync } from "node:fs";
import { join } from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatScore } from "@/lib/score";
import { slugCandidat } from "@/lib/carte";
import { assemblerDepuisReel, cheminImageReel, formatDuree, versionReel } from "@/lib/reel";
import { donneesPartageReel } from "@/lib/reel-paquet";
import { editionConfiguree, isEditor } from "@/lib/test-auth";
import EditorBar from "../../EditorBar";
import ReelPartage from "../ReelPartage";
import BoutonGenererReel from "../BoutonGenererReel";

// Toujours recalculée à chaque visite (comme les autres pages /test).
export const dynamic = "force-dynamic";

// Les actions du bouton « Générer le Reel » / « Générer à nouveau » appellent Claude
// (30 s à 2 min, deux essais au plus) : durée maximale portée à 300 s.
export const maxDuration = 300;

// Page de travail, pas une page du site public.
export const metadata = {
  title: "Reel — Perlimpinpin",
  robots: { index: false, follow: false },
};

// Page du Reel d'une fiche : le script pour ElevenLabs, les 9 images, le plan
// de montage et les sous-titres, à récupérer pour le montage (rien n'est
// publié automatiquement). Réservée aux personnes déverrouillées sur /test.
// Lecture seule. Analyse affichée : la dernière publiée, sinon le dernier
// brouillon ; avec ?brouillon=1, toujours le dernier brouillon.
// Le script est réassemblé avec le score et le nom actuels : si le score a
// changé depuis la génération, le verdict suit, et un avertissement le dit.
export default async function ReelPage({ params, searchParams }) {
  const { id } = await params;
  const propositionId = Number(id);
  if (!Number.isInteger(propositionId)) notFound();

  const configuree = editionConfiguree();
  const editeur = configuree && (await isEditor());
  const { brouillon } = await searchParams;

  const proposition = editeur
    ? await prisma.proposition.findUnique({
        where: { id: propositionId },
        select: {
          id: true,
          titre: true,
          candidat: { select: { nom: true, photoUrl: true } },
          analyses: {
            ...(brouillon === "1" ? { where: { statut: "brouillon" } } : {}),
            orderBy: { createdAt: "desc" },
            select: { id: true, statut: true, scoreFaisabilite: true, contenuComplet: true },
          },
        },
      })
    : null;
  const analyses = proposition?.analyses ?? [];
  const analyse = analyses.find((a) => a.statut === "publie") ?? analyses.find((a) => a.statut === "brouillon");
  if (editeur && !analyse) notFound();
  const estBrouillon = analyse?.statut === "brouillon";

  const reel = analyse?.contenuComplet?.reel ?? null;
  let donnees = null;
  let avertissements = [];
  const portrait = editeur && proposition
    ? existsSync(join(process.cwd(), "public", "portraits-bleus", `${slugCandidat(proposition.candidat)}.png`))
    : false;
  const assemble = editeur && reel
    ? assemblerDepuisReel(reel, { candidatNom: proposition.candidat.nom, score: analyse.scoreFaisabilite, portrait })
    : null;
  if (assemble) {
    const candidatNom = proposition.candidat.nom;
    const score = analyse.scoreFaisabilite;
    const version = versionReel({ analyseId: analyse.id, candidatNom, score, reel });
    donnees = donneesPartageReel({
      assemble,
      portrait,
      duree: formatDuree(assemble.dureeEstimee),
      prefixeFichier: `reel-${propositionId}`,
      slug: candidatNom,
      propositionId,
      url: ({ scene, theme, calque }) => cheminImageReel({ propositionId, scene, theme, calque, brouillon: estBrouillon, version }),
      infos: {
        candidatNom,
        titre: proposition.titre ?? `Fiche ${propositionId}`,
        score: formatScore(score),
        palier: assemble.palier.label,
        propositionId,
        brouillon: estBrouillon,
        genereLe: reel.genereLe,
      },
    });
    avertissements = [
      ...(Number(reel.score) !== Number(score)
        ? [`Le score a changé depuis la génération (${formatScore(Number(reel.score))} → ${formatScore(score)}) : le verdict ci-dessous suit le score actuel, relisez la phrase de chute.`]
        : []),
      ...(!portrait ? ["Portrait bleu manquant : la scène 2 et la couverture affichent le nom sans portrait."] : []),
      ...(reel.avertissements ?? []),
    ];
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-8 text-zinc-900 sm:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <Link href="/test/reels" className="font-semibold underline underline-offset-2 hover:opacity-70">
            ← Tous les Reels
          </Link>
          {configuree ? <EditorBar editeur={editeur} /> : null}
        </div>

        {!editeur ? (
          <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            {configuree
              ? "Page réservée aux personnes déverrouillées : saisissez le code d’édition ci-dessus."
              : "Le mode édition n’est pas configuré sur ce site."}
          </p>
        ) : (
          <>
            <header className="flex flex-col gap-2">
              <h1 className="text-2xl font-bold tracking-tight">Reel vidéo</h1>
              <p className="text-sm text-zinc-600">
                <Link href={estBrouillon ? `/test/${proposition.id}` : `/declarations/${proposition.id}`} className="underline underline-offset-2">
                  {proposition.titre ?? `Fiche ${proposition.id}`}
                </Link>{" "}
                · {proposition.candidat.nom} · {formatScore(analyse.scoreFaisabilite)}/100
                {estBrouillon ? (
                  <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">Brouillon, non publié</span>
                ) : null}
              </p>
              {reel?.genereLe ? (
                <p className="text-xs text-zinc-400">
                  Script généré le{" "}
                  {new Date(reel.genereLe).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Paris" })}
                </p>
              ) : null}
            </header>

            <div className="flex flex-wrap items-start gap-3">
              <BoutonGenererReel propositionId={proposition.id} brouillon={estBrouillon} aDejaUnReel={Boolean(donnees)} discret={Boolean(donnees)} />
            </div>

            {!donnees ? (
              <div className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-4 text-sm">
                <p className="font-semibold">Cette fiche n’a pas encore de Reel.</p>
                <p className="text-zinc-600">
                  Cliquez sur « Générer le Reel » ci-dessus. En ligne de commande :{" "}
                  <code className="font-mono text-zinc-800">
                    node scripts/reel.js {proposition.id}
                    {estBrouillon ? " --brouillon" : ""}
                  </code>
                </p>
              </div>
            ) : (
              <>
                {avertissements.length > 0 ? (
                  <section className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                    <p className="font-semibold">À relire avant le montage ({avertissements.length})</p>
                    <ul className="mt-2 list-disc pl-5">
                      {avertissements.map((a) => (
                        <li key={a}>{a}</li>
                      ))}
                    </ul>
                  </section>
                ) : null}
                <ReelPartage {...donnees} />
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}
