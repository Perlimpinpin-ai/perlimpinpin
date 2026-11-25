import Link from "next/link";
import { notFound } from "next/navigation";
import { editionConfiguree, isEditor } from "@/lib/test-auth";
import { DEMO_ACTIVE, lireDemo } from "@/lib/carrousel-demo";
import EditorBar from "../../EditorBar";
import CarrouselInstagram from "../../CarrouselInstagram";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Démonstration carrousel — Perlimpinpin",
  robots: { index: false, follow: false },
};

// Démonstration locale des carrousels sur une fiche locale (hors production) :
// data/demo-carrousel/demo.json, préparé par
//   node scripts/recit.js --demo --fichier <fiche.json> --candidat "Nom" --id <n>
// Aucune base, aucun appel payant : les boutons passent par la même logique
// que la vraie page, avec un modèle simulé et ce fichier à la place de la base.
export default async function DemoCarrouselPage() {
  if (!DEMO_ACTIVE) notFound();
  const configuree = editionConfiguree();
  const editeur = configuree && (await isEditor());
  const demo = editeur ? await lireDemo() : null;

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-8 text-zinc-900 sm:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <Link href="/test/reseaux/retours?demo=1" className="font-semibold underline underline-offset-2 hover:opacity-70">
            Remarques (démonstration) →
          </Link>
          {configuree ? <EditorBar editeur={editeur} /> : null}
        </div>
        {!editeur ? (
          <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            {configuree ? "Page réservée aux personnes déverrouillées : saisissez le code d’édition ci-dessus." : "Le mode édition n’est pas configuré sur ce poste."}
          </p>
        ) : !demo ? (
          <p className="rounded-xl border border-zinc-200 bg-white p-4 text-sm">
            Pas de démonstration préparée. En ligne de commande : <code>node scripts/recit.js --demo --fichier &lt;fiche.json&gt; --candidat &quot;Nom&quot;</code>
          </p>
        ) : (
          <>
            <header className="flex flex-col gap-2">
              <h1 className="text-2xl font-bold tracking-tight">Démonstration locale</h1>
              <p className="text-sm text-zinc-600">
                {demo.proposition.titre} · {demo.proposition.candidat.nom} · fiche locale <code>{demo.source}</code>
              </p>
              <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                Démonstration : rien n’est lu ni écrit en base, aucun appel à Claude. Le modèle est simulé (réponse préparée dans
                data/demo-carrousel/demo.json), les contrôles et le journal des remarques sont les vrais.
              </p>
            </header>
            <CarrouselInstagram proposition={demo.proposition} analyse={demo.analyse} brouillon numero={1} demo />
          </>
        )}
      </div>
    </main>
  );
}
