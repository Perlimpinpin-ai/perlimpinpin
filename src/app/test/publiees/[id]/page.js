import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { editionConfiguree, isEditor } from "@/lib/test-auth";
import DeclarationDetailPage from "@/app/declarations/[id]/page";
import EditorBar from "../../EditorBar";

// Toujours recalculée à chaque visite (même choix que la liste /test).
export const dynamic = "force-dynamic";

// Page de travail, pas une page du site public : masquée des moteurs de recherche.
export const metadata = {
  title: "Fiche publiée — Perlimpinpin",
  robots: { index: false, follow: false },
};

// Correction des coquilles d'une fiche EN LIGNE, sans nouvelle version. On
// réutilise la fiche publique (mode `preview` + `publiee` : la version en ligne,
// sans les blocs de vote ni de feedback) avec le crayon d'édition des brouillons,
// limité aux champs corrigeables (voir src/lib/test-corriger.js). Le vrai contrôle
// d'accès est dans l'action serveur corrigerCoquille.
export default async function FichePublieePage({ params }) {
  const { id } = await params;
  const propositionId = Number(id);
  if (!Number.isInteger(propositionId)) notFound();

  // La version en ligne : la plus récente des analyses publiées (comme
  // /declarations/[id]).
  const enLigne = await prisma.analyse.findFirst({
    where: { propositionId, statut: "publie" },
    orderBy: { createdAt: "desc" },
    select: { id: true, updatedAt: true },
  });
  if (!enLigne) notFound();

  const configuree = editionConfiguree();
  const editeur = configuree && (await isEditor());

  return (
    <>
      <div className="border-b border-red-300 bg-red-50 px-6 py-3 text-sm text-red-900 sm:px-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <p className="font-semibold">
              Fiche en ligne : chaque correction est visible immédiatement. Réservé aux coquilles.
            </p>
            <div className="flex shrink-0 gap-4">
              <Link
                href={`/declarations/${propositionId}`}
                className="font-semibold underline underline-offset-2 transition-opacity hover:opacity-70"
              >
                Voir sur le site
              </Link>
              <Link
                href="/test/publiees"
                className="font-semibold underline underline-offset-2 transition-opacity hover:opacity-70"
              >
                ← Fiches publiées
              </Link>
            </div>
          </div>
          <p className="text-red-800">
            Mesure initiale, thématique, notes, score et niveau de confiance ne sont pas modifiables ici.
            Pour changer le fond, il faut une nouvelle version.
            {process.env.TEST_DRY_RUN === "1" ? " Mode simulation : rien n’est enregistré." : ""}
          </p>
          {configuree ? <EditorBar editeur={editeur} /> : null}
        </div>
      </div>

      {/* mesurePubliee : jamais de crayon sur la mesure initiale ni la thématique. */}
      <DeclarationDetailPage
        params={params}
        preview
        publiee
        edition={
          editeur
            ? {
                analyseId: enLigne.id,
                versionAttendue: enLigne.updatedAt.toISOString(),
                mesurePubliee: true,
                correction: true,
              }
            : null
        }
      />
    </>
  );
}
