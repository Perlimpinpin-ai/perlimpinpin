import { cheminFiche } from "@/lib/slug";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { editionConfiguree, isEditor } from "@/lib/test-auth";
import EditorBar from "../../EditorBar";
import CarrouselInstagram from "../../CarrouselInstagram";
import PublicationsX from "../../PublicationsX";

// Toujours recalculée à chaque visite (comme les autres pages /test).
export const dynamic = "force-dynamic";

// Le bouton « Générer le récit » appelle Claude (30 s à 2 min, deux essais au
// plus) : durée maximale portée à 300 s, comme /test/reels.
export const maxDuration = 300;

// Page de travail, pas une page du site public.
export const metadata = {
  title: "Publications X — Perlimpinpin",
  robots: { index: false, follow: false },
};

// Page de partage d'une fiche : les trois publications X et le carrousel
// Instagram, prêts à poster à la main (rien n'est publié automatiquement). Réservée aux personnes
// déverrouillées sur /test (même code d'édition). Lecture seule.
// Analyse affichée : la dernière publiée, sinon le dernier brouillon ; avec
// ?brouillon=1, toujours le dernier brouillon (fiche en cours de révision).
export default async function PartageReseauxPage({ params, searchParams }) {
  const { id } = await params;
  const propositionId = Number(id);
  if (!Number.isInteger(propositionId)) notFound();

  const configuree = editionConfiguree();
  const editeur = configuree && (await isEditor());
  const { publiee, brouillon, photo, image } = await searchParams;

  const proposition = editeur
    ? await prisma.proposition.findUnique({
        where: { id: propositionId },
        select: {
          id: true,
          titre: true,
          slug: true,
          texteOriginal: true,
          theme: true,
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

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-8 text-zinc-900 sm:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <Link href="/test/reseaux" className="font-semibold underline underline-offset-2 hover:opacity-70">
            ← Toutes les publications
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
            {publiee === "1" ? (
              <p role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
                Analyse publiée.{" "}
                <Link href={cheminFiche(proposition)} className="underline underline-offset-2">
                  Voir la fiche publique
                </Link>
              </p>
            ) : null}

            <header className="flex flex-col gap-2">
              <h1 className="text-2xl font-bold tracking-tight">Publications X</h1>
              <p className="text-sm text-zinc-600">
                <Link
                  href={estBrouillon ? `/test/${proposition.id}` : cheminFiche(proposition)}
                  className="underline underline-offset-2"
                >
                  {proposition.titre ?? `Fiche ${proposition.id}`}
                </Link>{" "}
                · {proposition.candidat.nom}
                {estBrouillon ? (
                  <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
                    Brouillon, non publié
                  </span>
                ) : null}
              </p>
              <p className="rounded-xl border border-zinc-200 bg-white p-3 text-sm">
                Calendrier conseillé : carte, carrousel et tweet long le jour J, chiffre à J+2, tient / tient pas à J+4.
              </p>
            </header>

            <PublicationsX proposition={proposition} analyse={analyse} brouillon={estBrouillon} partage />

            {/* Numéroté après les formats X affichés (la carte seule sans textes réseaux). */}
            <CarrouselInstagram
              proposition={proposition}
              analyse={analyse}
              brouillon={estBrouillon}
              numero={analyse.contenuComplet?.reseaux ? 4 : 2}
              photo={typeof photo === "string" ? photo : null}
              image={typeof image === "string" ? image : null}
            />
          </>
        )}
      </div>
    </main>
  );
}
