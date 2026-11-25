import Link from "next/link";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { editionConfiguree, isEditor } from "@/lib/test-auth";
import { ILLUSTRATIONS, REGLES_SELECTION, THEMES_ILLUSTRATIONS } from "@/lib/illustrations";
import EditorBar from "../EditorBar";
import SelectionIllustrations from "./SelectionIllustrations";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Illustrations des carrousels — Perlimpinpin",
  robots: { index: false, follow: false },
};

// Validation de la bibliothèque d'images de thème des carrousels Instagram
// (src/lib/illustrations.js). Les candidates viennent de
// scripts/chercher-illustrations.js (API Pexels, ou recherche simulée) ; on
// coche ici celles à garder ; le script télécharge ensuite les retenues.
// Réservée aux personnes déverrouillées sur /test. Aucune écriture en base.

async function lireJson(chemin) {
  try {
    return JSON.parse(await readFile(chemin, "utf-8"));
  } catch {
    return null;
  }
}

export default async function IllustrationsPage({ searchParams }) {
  const configuree = editionConfiguree();
  const editeur = configuree && (await isEditor());
  const { theme: demande } = await searchParams;
  const themes = Object.entries(THEMES_ILLUSTRATIONS);
  const theme = Object.hasOwn(THEMES_ILLUSTRATIONS, demande ?? "") ? demande : themes[0][0];
  const dossier = join(process.cwd(), "data", "illustrations");
  const candidats = editeur ? await lireJson(join(dossier, "candidates", `${theme}.json`)) : null;
  const selection = editeur ? await lireJson(join(dossier, "selection", `${theme}.json`)) : null;
  const dansBibliotheque = (slug) => ILLUSTRATIONS.filter((i) => i.theme === slug).length;

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
          <h1 className="text-2xl font-bold tracking-tight">Illustrations des carrousels</h1>
          <p className="max-w-3xl text-sm text-zinc-600">
            Images de thème posées sur la couverture des carrousels, en bichromie avec une trame de points. Cochez les candidates à
            garder : rien n’entre dans la bibliothèque sans cette validation. Pas d’image générée par IA, pas de recherche au
            moment de la génération.
          </p>
        </header>

        {!editeur ? (
          <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            {configuree ? "Page réservée aux personnes déverrouillées : saisissez le code d’édition ci-dessus." : "Le mode édition n’est pas configuré sur ce site."}
          </p>
        ) : (
          <>
            <section className="rounded-xl border border-zinc-200 bg-white p-4 text-sm">
              <h2 className="mb-2 font-semibold">Règles de sélection</h2>
              <ul className="list-disc space-y-1 pl-5 text-zinc-700">
                {REGLES_SELECTION.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </section>

            <nav className="flex flex-wrap gap-2 text-xs">
              {themes.map(([slug, { libelle }]) => (
                <Link
                  key={slug}
                  href={`/test/illustrations?theme=${slug}`}
                  className={`rounded-full border px-3 py-1 font-semibold ${slug === theme ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white hover:bg-zinc-100"}`}
                >
                  {libelle} <span className={slug === theme ? "text-zinc-300" : "text-zinc-400"}>· {dansBibliotheque(slug)}</span>
                </Link>
              ))}
            </nav>

            <section className="flex flex-col gap-1 text-sm">
              <h2 className="font-semibold">
                {THEMES_ILLUSTRATIONS[theme].libelle}{" "}
                <span className="font-normal text-zinc-500">· {dansBibliotheque(theme)} image(s) dans la bibliothèque (objectif : 5 à 8)</span>
              </h2>
              <p className="text-xs text-zinc-500">Requêtes : {THEMES_ILLUSTRATIONS[theme].requetes.map(([r, m]) => `« ${r} » → ${m}`).join(" · ")}</p>
            </section>

            <SelectionIllustrations
              key={`${theme}-${candidats?.chercheLe ?? "vide"}`}
              theme={theme}
              candidates={candidats?.candidates ?? []}
              simulation={Boolean(candidats?.simulation)}
              dejaRetenues={(selection?.retenues ?? []).map(({ id, motCle }) => ({ id, motCle }))}
            />
          </>
        )}
      </div>
    </main>
  );
}
