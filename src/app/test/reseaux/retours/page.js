import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { editionConfiguree, isEditor } from "@/lib/test-auth";
import { libelleCible, listeRetours, remarquesFrequentes } from "@/lib/retours-recit";
import { lireDemo } from "@/lib/carrousel-demo";
import EditorBar from "../../EditorBar";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Remarques sur les carrousels — Perlimpinpin",
  robots: { index: false, follow: false },
};

// Toutes les remarques faites sur les carrousels détaillés (barre « Ce qui ne
// va pas ? » de /test/reseaux/<id>), toutes fiches confondues, avec la fiche
// et la slide visée : sert à corriger data/prompt-recit.md quand une même
// remarque revient souvent. Lues dans contenuComplet.reseaux_recit.retours
// (Postgres extrait le journal sans charger les fiches). Lecture seule.
// Hors production, la démonstration locale (data/demo-carrousel/) est ajoutée.

async function lignesDepuisBase() {
  const lignes = await prisma.$queryRaw`
    SELECT a."propositionId" AS "propositionId", a.statut, p.titre, c.nom AS candidat,
           a."contenuComplet"->'reseaux_recit'->'retours' AS retours
    FROM "Analyse" a
    JOIN "Proposition" p ON p.id = a."propositionId"
    JOIN "Candidat" c ON c.id = p."candidatId"
    WHERE jsonb_exists(a."contenuComplet"->'reseaux_recit', 'retours')
  `;
  return lignes.map((l) => ({ ...l, propositionId: Number(l.propositionId) }));
}

function dateCourte(iso) {
  return new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });
}

export default async function RetoursPage({ searchParams }) {
  const configuree = editionConfiguree();
  const editeur = configuree && (await isEditor());
  const { demo: seulementDemo } = await searchParams;

  let lignes = [];
  let erreurBase = null;
  if (editeur) {
    const demo = await lireDemo();
    if (demo?.analyse?.contenuComplet?.reseaux_recit?.retours) {
      lignes.push({ propositionId: demo.proposition.id, titre: `${demo.proposition.titre} (démonstration locale)`, candidat: demo.proposition.candidat.nom, statut: "demo", retours: demo.analyse.contenuComplet.reseaux_recit.retours });
    }
    if (seulementDemo !== "1") {
      try {
        lignes = [...lignes, ...(await lignesDepuisBase())];
      } catch (error) {
        erreurBase = error.message;
      }
    }
  }
  const retours = listeRetours(lignes);
  const frequentes = remarquesFrequentes(retours);

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-8 text-zinc-900 sm:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <Link href="/test/reseaux" className="font-semibold underline underline-offset-2 hover:opacity-70">
            ← Publications réseaux
          </Link>
          {configuree ? <EditorBar editeur={editeur} /> : null}
        </div>
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Remarques sur les carrousels détaillés</h1>
          <p className="max-w-3xl text-sm text-zinc-600">
            Toutes les remarques « Ce qui ne va pas ? », toutes fiches confondues. Quand une même remarque revient souvent, corrigez <code>data/prompt-recit.md</code>.
          </p>
        </header>

        {!editeur ? (
          <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            {configuree ? "Page réservée aux personnes déverrouillées : saisissez le code d’édition ci-dessus." : "Le mode édition n’est pas configuré sur ce site."}
          </p>
        ) : (
          <>
            {erreurBase ? <p className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800">Lecture de la base impossible : {erreurBase}</p> : null}
            {frequentes.length ? (
              <section className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">
                <h2 className="mb-2 font-semibold text-amber-900">Remarques qui reviennent</h2>
                <ul className="list-disc space-y-1 pl-5">
                  {frequentes.map((g) => (
                    <li key={`${g.cible}-${g.remarque}`}>
                      {g.nombre} fois · {g.cible} · « {g.remarque} » ({g.fiches.length} fiche(s))
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {retours.length === 0 ? (
              <p className="text-sm text-zinc-600">Aucune remarque pour l’instant.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="bg-zinc-100 text-xs uppercase text-zinc-500">
                    <tr>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Fiche</th>
                      <th className="px-3 py-2">Slide</th>
                      <th className="px-3 py-2">Remarque</th>
                      <th className="px-3 py-2">Résultat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {retours.map((r, i) => (
                      <tr key={i} className="border-t border-zinc-100 align-top">
                        <td className="whitespace-nowrap px-3 py-2 text-xs text-zinc-500">{dateCourte(r.date)}</td>
                        <td className="px-3 py-2">
                          <Link href={r.statut === "demo" ? "/test/reseaux/demo" : `/test/reseaux/${r.propositionId}`} className="underline underline-offset-2">
                            #{r.propositionId}
                          </Link>{" "}
                          <span className="text-xs text-zinc-500">
                            {r.candidat} · {r.titre}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-xs">{libelleCible(r)}</td>
                        <td className="px-3 py-2">« {r.remarque} »</td>
                        <td className="px-3 py-2 text-xs">
                          <span className={r.resultat === "acceptée" ? "font-semibold text-emerald-700" : "font-semibold text-red-700"}>{r.resultat}</span>
                          {r.details?.length ? <div className="mt-1 text-zinc-500">{r.details.join(" ; ")}</div> : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
