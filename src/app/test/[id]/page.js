import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { editionConfiguree, isEditor } from "@/lib/test-auth";
import DeclarationDetailPage from "@/app/declarations/[slug]/page";
import EditorBar from "../EditorBar";
import PublishBox from "../PublishBox";
import ReponsesRevision from "../ReponsesRevision";
import PublicationsX from "../PublicationsX";
import { lireChangementVersion } from "@/lib/nouvelle-version-core";

// Toujours recalculée à chaque visite (même choix que la liste /test).
export const dynamic = "force-dynamic";

// Page de relecture, pas une page du site public : masquée des moteurs de recherche.
export const metadata = {
  title: "Brouillon — Perlimpinpin",
  robots: { index: false, follow: false },
};

// Prévisualisation d'un brouillon : on réutilise la fiche publique telle quelle
// (mode `preview`, sans les blocs de vote ni de feedback), précédée d'un bandeau.
// La lecture reste ouverte à tous ; seule la publication demande le code d'édition.
export default async function TestDetailPage({ params }) {
  const { id } = await params;
  const propositionId = Number(id);

  if (!Number.isInteger(propositionId)) {
    notFound();
  }

  // On ne regarde que l'analyse la plus récente de la mesure, comme la fiche
  // publique. Pas d'analyse, ou analyse déjà publiée : 404 (les fiches
  // publiées se voient sur /declarations/[slug]). Les analyses à la corbeille
  // sont ignorées : c'est alors l'analyse précédente qui compte.
  const derniere = await prisma.analyse.findFirst({
    where: { propositionId, statut: { not: "corbeille" } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      statut: true,
      updatedAt: true,
      scoreFaisabilite: true,
      contenuComplet: true,
      proposition: {
        select: { id: true, titre: true, slug: true, texteOriginal: true, candidat: { select: { nom: true, photoUrl: true } } },
      },
    },
  });

  if (!derniere || derniere.statut !== "brouillon") {
    notFound();
  }

  const configuree = editionConfiguree();
  const editeur = configuree && (await isEditor());
  // Fiche issue d'une révision (robot de révision) : réponses aux commentaires
  // du Club, montrées aux seules personnes déverrouillées.
  const revision = derniere.contenuComplet?.revision?.slug ? derniere.contenuComplet.revision : null;
  // Une version déjà publiée de la mesure : la mesure initiale (colonne de la
  // proposition, partagée) n'est alors pas modifiable (voir test-enregistrer.js).
  const mesurePubliee =
    editeur && (await prisma.analyse.count({ where: { propositionId, statut: "publie" } })) > 0;
  // Nouvelle version d'une mesure modifiée par le candidat : titre et mesure de
  // cette version (la Proposition n'est mise à jour qu'au clic « Publier »).
  const changement = lireChangementVersion(derniere.contenuComplet);
  const propositionAffichee = changement
    ? { ...derniere.proposition, titre: changement.titre, texteOriginal: changement.mesure_initiale }
    : derniere.proposition;

  return (
    <>
      <div className="border-b border-amber-300 bg-amber-100 px-6 py-3 text-sm text-amber-900 sm:px-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <p className="font-semibold">
              Brouillon : analyse non publiée. Elle n&rsquo;est visible que par les
              personnes qui ont ce lien.
            </p>
            <Link
              href="/test"
              className="shrink-0 font-semibold underline underline-offset-2 transition-opacity hover:opacity-70"
            >
              ← Tous les brouillons
            </Link>
          </div>

          {changement ? (
            <p>
              Nouvelle version (mesure modifiée par le candidat) : au clic « Publier », elle remplacera
              l&rsquo;analyse n° {changement.analyse_precedente_id} ({changement.score_avant}/100), qui reste en ligne
              d&rsquo;ici là et passera ensuite dans l&rsquo;historique.
            </p>
          ) : null}

          {/* Mode édition : n'apparaît que si le code d'édition est configuré. */}
          {configuree ? (
            <div className="flex flex-col gap-3">
              <EditorBar editeur={editeur} />
              {editeur ? (
                <PublishBox
                  analyseId={derniere.id}
                  candidatNom={derniere.proposition.candidat.nom}
                  simulation={process.env.TEST_DRY_RUN === "1"}
                  revision={Boolean(revision)}
                  sansVersionBasique={!derniere.contenuComplet?.version_basique}
                />
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {editeur && revision ? <ReponsesRevision revision={revision} /> : null}

      {/* Publications X préparées par l'étape 3 ter (images et tweets), lecture seule. */}
      {editeur ? (
        <details className="border-b border-amber-300 bg-amber-50 px-6 py-4 text-zinc-900 sm:px-8">
          <summary className="mx-auto w-full max-w-6xl cursor-pointer text-lg font-semibold">Publications X</summary>
          <div className="mx-auto mt-4 w-full max-w-6xl">
            <PublicationsX proposition={propositionAffichee} analyse={derniere} brouillon />
          </div>
        </details>
      ) : null}

      {/* Pour un éditeur seulement : le crayon de modification (titre, résumé, mesure
          initiale…). La version sert à détecter une modification faite entre-temps par
          quelqu'un d'autre. */}
      <DeclarationDetailPage
        params={params}
        preview
        edition={
          editeur
            ? { analyseId: derniere.id, versionAttendue: derniere.updatedAt.toISOString(), mesurePubliee }
            : null
        }
      />
    </>
  );
}
