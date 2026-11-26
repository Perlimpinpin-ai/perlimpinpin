import Link from "next/link";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { editionConfiguree, isEditor } from "@/lib/test-auth";
import { CATEGORIES_COMMONS, nomDepuisSlug } from "@/lib/candidats-commons";
import { fichierPhoto, PHOTOS_CONSEILLEES, PHOTOS_DEPOSEES, PHOTOS_MIN, photosDuCandidat } from "@/lib/photos-candidats";
import EditorBar from "../EditorBar";
import SelectionPhotos from "./SelectionPhotos";
import PhotosDeposees from "./PhotosDeposees";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Photos des candidats — Perlimpinpin",
  robots: { index: false, follow: false },
};

// Validation des photos des candidats (couverture du carrousel détaillé,
// fenêtre du candidat des Reels) : propositions Wikimedia Commons de
// scripts/chercher-photos-candidats.js, à cocher ici. Rien n'est ajouté à la
// bibliothèque (src/lib/photos-candidats.js) sans cette validation.
// Réservée aux personnes déverrouillées sur /test. Aucune écriture en base.

const REGLES = [
  "Au moins 4 photos par candidat, toutes du même type : portrait de face ou de trois quarts, expression neutre.",
  "Neutralité : pas de grimace, pas d’yeux fermés, pas de bouche ouverte en pleine phrase.",
  "Pas de logo de parti ni de slogan bien visible, pas de pancarte.",
  "Le candidat seul, net, assez grand dans l’image pour être détouré (épaules visibles).",
  "Licences déjà filtrées : CC0, domaine public, CC BY, CC BY-SA ; auteur et licence connus ; 800 px de large au moins.",
];

async function lireJson(chemin) {
  try {
    return JSON.parse(await readFile(chemin, "utf-8"));
  } catch {
    return null;
  }
}

export default async function PhotosCandidatsPage({ searchParams }) {
  const configuree = editionConfiguree();
  const editeur = configuree && (await isEditor());
  const { candidat: demande, onglet: ongletDemande } = await searchParams;
  const onglet = ongletDemande === "commons" ? "commons" : "deposees";
  const slugs = Object.keys(CATEGORIES_COMMONS);
  const slug = slugs.includes(demande ?? "") ? demande : "teddy-riner";
  const dossier = join(process.cwd(), "data", "photos-candidats");
  const propositions = editeur ? await lireJson(join(dossier, "candidates", `${slug}.json`)) : null;
  const selection = editeur ? await lireJson(join(dossier, "selection", `${slug}.json`)) : null;
  const bibliotheque = photosDuCandidat(slug);
  const detourees = bibliotheque.filter((p) => existsSync(join(process.cwd(), "public", p.fichier))).length;
  // Photos déposées à la main (scripts/preparer-photos-candidats.py) : aperçus des fichiers préparés.
  const deposees = PHOTOS_DEPOSEES.filter((p) => p.slug === slug)
    .sort((a, b) => a.n - b.n)
    .map((p) => ({
      ...p,
      lisere: encodeURI(`/${fichierPhoto({ ...p, deposee: true }, "mesure")}`),
      medaillon: encodeURI(`/${fichierPhoto({ ...p, deposee: true }, "thematique")}`),
    }));
  const gardeesDe = (s) => PHOTOS_DEPOSEES.filter((p) => p.slug === s && !p.ecarter).length;

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
          <h1 className="text-2xl font-bold tracking-tight">Photos des candidats</h1>
          <p className="max-w-3xl text-sm text-zinc-600">
            Photos des candidats pour les couvertures des carrousels (« une mesure », « programme », « thématique ») et la fenêtre des Reels. Une
            photo est tirée au hasard, côté serveur, à chaque carrousel. Onglet « Photos déposées » : les photos de photos-sources/, préparées par
            scripts/preparer-photos-candidats.py ; toutes entrent dans le tirage, sauf celles cochées « Écarter ».
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
                {REGLES.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </section>

            <nav className="flex gap-1 border-b border-zinc-200 text-sm">
              {[
                ["deposees", "Photos déposées"],
                ["commons", "Wikimedia Commons"],
              ].map(([cle, libelle]) => (
                <Link
                  key={cle}
                  href={`/test/photos-candidats?candidat=${slug}&onglet=${cle}`}
                  className={`-mb-px rounded-t-lg border px-4 py-2 font-semibold ${onglet === cle ? "border-zinc-200 border-b-zinc-50 bg-zinc-50" : "border-transparent text-zinc-500 hover:text-zinc-900"}`}
                >
                  {libelle}
                </Link>
              ))}
            </nav>

            <nav className="flex flex-wrap gap-2 text-xs">
              {slugs.map((s) => {
                const nombre = onglet === "deposees" ? gardeesDe(s) : photosDuCandidat(s).length;
                const seuil = onglet === "deposees" ? PHOTOS_CONSEILLEES : PHOTOS_MIN;
                return (
                  <Link
                    key={s}
                    href={`/test/photos-candidats?candidat=${s}&onglet=${onglet}`}
                    className={`rounded-full border px-3 py-1 font-semibold ${s === slug ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white hover:bg-zinc-100"}`}
                  >
                    {nomDepuisSlug(s)} <span className={s === slug ? "text-zinc-300" : nombre < seuil ? "text-amber-600" : "text-zinc-400"}>· {nombre}</span>
                  </Link>
                );
              })}
            </nav>

            {onglet === "deposees" ? (
              <>
                <section className="flex flex-col gap-1 text-sm">
                  <h2 className="font-semibold">
                    {nomDepuisSlug(slug)}{" "}
                    <span className="font-normal text-zinc-500">
                      · {deposees.length} photo(s) préparée(s), {gardeesDe(slug)} dans le tirage, {deposees.length - gardeesDe(slug)} écartée(s)
                    </span>
                  </h2>
                  <p className="text-xs text-zinc-500">
                    Neutralité (charte RS) : pas de grimace, pas d’yeux fermés, pas de bouche ouverte en pleine phrase, pas de logo de parti, personne d’autre dans le détourage.
                    Les compteurs des candidats ci-dessus comptent les photos du tirage (avertissement sous {PHOTOS_CONSEILLEES}).
                  </p>
                </section>
                <PhotosDeposees key={`${slug}-${deposees.map((p) => `${p.n}${p.ecarter ? "e" : ""}`).join("-")}`} slug={slug} photos={deposees} />
              </>
            ) : (
              <>
                <section className="flex flex-col gap-1 text-sm">
                  <h2 className="font-semibold">
                    {nomDepuisSlug(slug)}{" "}
                    <span className="font-normal text-zinc-500">
                      · {bibliotheque.length} photo(s) dans la bibliothèque, {detourees} détourée(s) (au moins {PHOTOS_MIN})
                    </span>
                  </h2>
                  <p className="text-xs text-zinc-500">
                    Catégorie {CATEGORIES_COMMONS[slug]}
                    {propositions
                      ? ` · recherche du ${new Date(propositions.chercheLe).toLocaleString("fr-FR")} : ${propositions.fichiersVus} fichiers vus, ${propositions.ecartees} écartés par les filtres`
                      : ""}
                  </p>
                </section>

                <SelectionPhotos
                  key={`${slug}-${propositions?.chercheLe ?? "vide"}`}
                  slug={slug}
                  candidates={propositions?.candidates ?? []}
                  dejaRetenues={(selection?.retenues ?? []).map((r) => r.id)}
                />
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}
