import { existsSync } from "node:fs";
import { join } from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatScore } from "@/lib/score";
import { nomDeFamille } from "@/lib/charte-rs";
import { chargerDonneesFormat, etatStoryboardFormat } from "@/lib/reel-storyboard-base";
import { dossierDemoFormat } from "@/lib/reel-storyboard-serveur";
import { donneesPageStoryboard } from "@/lib/reel-storyboard-paquet";
import { editionConfiguree, isEditor } from "@/lib/test-auth";
import EditorBar from "../EditorBar";
import ReelStoryboard from "../reels/ReelStoryboard";
import VerificationsReel from "../reels/VerificationsReel";

// Page commune des Reels « programme » et « thématique » (charte RS p. 19) :
// le choix des fiches (le même que pour les carrousels de ces formats), puis
// le storyboard. Pour l'instant, le storyboard se voit en simulation
// (?simulation=A|B, data/reel-demo/<format>-<cible>/) : aucun appel, rien
// n'est lu ni écrit en base. Réservée aux personnes déverrouillées sur /test.

export default async function FormatReel({ format, cible, searchParams }) {
  const configuree = editionConfiguree();
  const editeur = configuree && (await isEditor());
  const { simulation: simParam, fiches: fichesParam, avec: avecParam } = (await searchParams) ?? {};
  const simulation = ["A", "B"].includes(simParam) ? simParam : null;
  const donnees = editeur ? await chargerDonneesFormat(format, cible, { simulation }) : null;
  if (editeur && !donnees) notFound();
  const choix = fichesParam ? String(fichesParam).split(",").map(Number).filter(Number.isInteger) : null;
  const avec = avecParam ? String(avecParam).split(",").map((n) => n.trim()).filter(Boolean) : (donnees?.avec ?? []);
  const { selection, etat } = editeur ? etatStoryboardFormat({ format, cible, donnees, simulation, choix, avec }) : { selection: null, etat: null };
  const simulations = editeur ? ["A", "B"].filter((m) => existsSync(join(dossierDemoFormat(format, cible), `reponse-${m}.json`))) : [];
  const base = `/test/reseaux/${format}/${cible}`;
  const url = (image) => {
    const p = new URLSearchParams({ image });
    if (simulation) p.set("simulation", simulation);
    if (choix) p.set("fiches", choix.join(","));
    if (avecParam) p.set("avec", avec.join(","));
    return `${base}/reel?${p}`;
  };
  const titre = format === "programme" ? `Programme de ${donnees?.fiches?.[0]?.candidat?.nom ?? cible}` : `${selection?.themeLibelle ?? cible} : ce que proposent les candidats`;
  const donneesPage = etat?.storyboard ? donneesPageStoryboard(etat, { url, infos: { titre, propositionId: null, brouillon: false, palier: "", simulation } }) : null;

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-8 text-zinc-900 sm:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <Link href="/test/reseaux" className="font-semibold underline underline-offset-2 hover:opacity-70">
            ← Réseaux sociaux
          </Link>
          {configuree ? <EditorBar editeur={editeur} /> : null}
        </div>
        {!editeur ? (
          <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            {configuree ? "Page réservée aux personnes déverrouillées : saisissez le code d’édition ci-dessus." : "Le mode édition n’est pas configuré sur ce site."}
          </p>
        ) : (
          <>
            <header className="flex flex-col gap-1">
              <h1 className="text-2xl font-bold tracking-tight">Reel {format === "programme" ? "« programme »" : "« thématique »"} · {titre}</h1>
              <p className="text-sm text-zinc-600">
                {format === "programme"
                  ? "6 mesures de 6 thèmes différents, dans l’ordre où le candidat les a mises en avant (date de déclaration). ?fiches=28,29,… pour imposer un autre choix."
                  : "Une fiche par candidat (la première déclarée sur le thème), ordre alphabétique, 4 à 8 candidats. ?avec=Nom,Nom pour montrer des candidats sans proposition."}
              </p>
            </header>

            <section className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-4 text-sm">
              <p className="font-semibold">{format === "programme" ? "Les 6 mesures retenues" : "Les candidats"}</p>
              {selection?.erreur ? <p className="rounded-lg bg-red-50 p-2 text-red-900">{selection.erreur}</p> : null}
              <ol className="flex flex-col gap-1">
                {(format === "programme" ? selection.mesures : selection.candidats).map((x) => (
                  <li key={x.numero} className="flex flex-wrap gap-2">
                    <span className="w-6 text-zinc-400">{x.numero}.</span>
                    <span className="font-medium">{format === "programme" ? x.themeCourt : nomDeFamille(x.nom)}</span>
                    {x.propositionId ? (
                      <Link href={`/declarations/${x.propositionId}`} className="underline underline-offset-2">
                        {x.titre}
                      </Link>
                    ) : (
                      <span className="text-zinc-500">Pas de proposition publiée sur ce thème à ce jour</span>
                    )}
                    {x.score !== null && x.score !== undefined ? <span className="text-zinc-500">· {formatScore(x.score)}/100</span> : null}
                  </li>
                ))}
              </ol>
            </section>

            <section className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600">
              <p className="font-semibold text-zinc-900">Production du storyboard</p>
              <p>
                Mode A (script Claude, un seul appel à partir des fiches) et mode B (script et voix off de l’équipe) sont prêts côté code
                (src/lib/reel-storyboard-generation.js). Ils ne sont pas encore branchés à un bouton : un storyboard de programme ou de thème n’a pas
                encore de place en base (il ne dépend pas d’une seule fiche). À décider avant de les brancher.
              </p>
              {simulations.length ? (
                <p className="mt-2">
                  Simulations (aucun appel, rien en base) :{" "}
                  {simulations.map((m, i) => (
                    <span key={m}>
                      {i ? " · " : ""}
                      <Link href={`${base}?simulation=${m}`} className={`underline underline-offset-2 ${simulation === m ? "font-bold" : ""}`}>
                        mode {m}
                      </Link>
                    </span>
                  ))}
                </p>
              ) : null}
            </section>

            {etat?.storyboard ? (
              <section className="flex flex-col gap-2 rounded-xl border-2 border-zinc-900 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Storyboard · mode {etat.mode} · simulation : aucun appel, rien en base</p>
                <p className="text-lg font-semibold">{etat.message}</p>
              </section>
            ) : null}

            {etat?.erreur || (etat && !etat.storyboard) || etat?.erreurs?.length ? (
              <section className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900">
                <p className="font-semibold">Storyboard refusé par le contrôle</p>
                <ul className="mt-2 list-disc pl-5">
                  {(etat.erreur ? [etat.erreur] : etat.erreurs).map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            {donneesPage ? <VerificationsReel checkList={donneesPage.checkList} avertissements={donneesPage.avertissements} zones={donneesPage.zones} couleurs={donneesPage.couleurs} /> : null}
            {donneesPage ? <ReelStoryboard {...donneesPage} /> : null}
          </>
        )}
      </div>
    </main>
  );
}
