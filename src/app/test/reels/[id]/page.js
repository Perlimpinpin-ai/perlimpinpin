import { cheminFiche } from "@/lib/slug";
import { existsSync } from "node:fs";
import { join } from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatScore } from "@/lib/score";
import { slugCandidat } from "@/lib/carte";
import { assemblerDepuisReel, cheminImageReel, formatDuree, versionReel } from "@/lib/reel";
import { donneesPartageReel } from "@/lib/reel-paquet";
import { photoReel } from "@/lib/photo-reel";
import { estStoryboard, verdictDuScore } from "@/lib/reel-storyboard";
import { dossierDemo } from "@/lib/reel-storyboard-serveur";
import { chargerFiche, etatStoryboard, versionStoryboard } from "@/lib/reel-storyboard-base";
import { donneesPageStoryboard } from "@/lib/reel-storyboard-paquet";
import { editionConfiguree, isEditor } from "@/lib/test-auth";
import EditorBar from "../../EditorBar";
import ReelPartage from "../ReelPartage";
import ReelStoryboard from "../ReelStoryboard";
import BoutonGenererReel from "../BoutonGenererReel";
import DepotEquipe from "../DepotEquipe";

// Toujours recalculée à chaque visite (comme les autres pages /test).
export const dynamic = "force-dynamic";

// Les actions (mode A, mode B) appellent Claude (30 s à 2 min, deux essais au
// plus) : durée maximale portée à 300 s.
export const maxDuration = 300;

export const metadata = {
  title: "Reel — Perlimpinpin",
  robots: { index: false, follow: false },
};

// Page du Reel d'une fiche (storyboard v4, docs/prompt-reel.md) : le message
// court (scènes, durée, écarts, points à valider), la check-list, les deux
// façons de produire le storyboard, puis la couverture, les planches, les
// images clés, le script, les sous-titres et le zip. Réservée aux personnes
// déverrouillées sur /test. Lecture seule (les écritures passent par les
// actions, jamais en simulation).
//   ?simulation=A|B : storyboard simulé (data/reel-demo/fiche-<id>/), sans appel ni écriture ;
//   ?brouillon=1 : le dernier brouillon.
// Un Reel v3 (9 scènes fixes) déjà rangé reste affiché tel quel en bas de page.

const ETATS = {
  ok: { signe: "✓", classe: "bg-emerald-100 text-emerald-800" },
  ko: { signe: "✗", classe: "bg-red-100 text-red-800" },
  manuel: { signe: "?", classe: "bg-amber-100 text-amber-900" },
};

export default async function ReelPage({ params, searchParams }) {
  const { id } = await params;
  const propositionId = Number(id);
  if (!Number.isInteger(propositionId)) notFound();
  const configuree = editionConfiguree();
  const editeur = configuree && (await isEditor());
  const { brouillon, simulation: simParam } = await searchParams;
  const simulation = ["A", "B"].includes(simParam) ? simParam : null;

  const fiche = editeur ? await chargerFiche(propositionId, { brouillon: brouillon === "1" }) : null;
  if (editeur && !fiche) notFound();
  const proposition = fiche?.proposition;
  const analyse = fiche?.analyse;
  const estBrouillon = analyse?.statut === "brouillon";
  const reel = analyse?.contenuComplet?.reel ?? null;

  // Storyboard v4 (base ou simulation).
  const etat = editeur ? etatStoryboard({ ...fiche, simulation }) : null;
  const version = editeur ? versionStoryboard({ analyse, simulation }) : null;
  const url = (image) => {
    const p = new URLSearchParams({ image, v: version ?? "" });
    if (simulation) p.set("simulation", simulation);
    if (estBrouillon) p.set("brouillon", "1");
    return `/test/reels/${propositionId}/storyboard?${p}`;
  };
  const donnees =
    etat?.storyboard
      ? donneesPageStoryboard(etat, {
          url,
          infos: { titre: proposition.titre ?? `Fiche ${propositionId}`, propositionId, slug: proposition.slug ?? null, brouillon: estBrouillon, palier: verdictDuScore(analyse.scoreFaisabilite), simulation },
        })
      : null;
  const simulations = editeur ? ["A", "B"].filter((m) => existsSync(join(dossierDemo(propositionId), `reponse-${m}.json`))) : [];

  // Ancien Reel v3 (9 scènes fixes), affiché tant qu'aucun storyboard ne le remplace.
  let v3 = null;
  let photoV3 = null;
  if (editeur && reel && !estStoryboard(reel) && !simulation) {
    // Photo de la bibliothèque des carrousels (src/lib/photo-reel.js), sinon portrait bleu.
    photoV3 = photoReel(proposition.candidat, `reel-${propositionId}-${reel.genereLe ?? ""}`);
    const portrait = Boolean(photoV3) || existsSync(join(process.cwd(), "public", "portraits-bleus", `${slugCandidat(proposition.candidat)}.png`));
    const assemble = assemblerDepuisReel(reel, { candidatNom: proposition.candidat.nom, score: analyse.scoreFaisabilite, portrait });
    if (assemble) {
      const versionV3 = versionReel({ analyseId: analyse.id, candidatNom: proposition.candidat.nom, score: analyse.scoreFaisabilite, reel });
      v3 = donneesPartageReel({
        assemble,
        portrait,
        duree: formatDuree(assemble.dureeEstimee),
        prefixeFichier: `reel-${propositionId}`,
        slug: proposition.candidat.nom,
        propositionId,
        url: ({ scene, theme, calque }) => cheminImageReel({ propositionId, scene, theme, calque, brouillon: estBrouillon, version: versionV3 }),
        infos: {
          candidatNom: proposition.candidat.nom,
          titre: proposition.titre ?? `Fiche ${propositionId}`,
          score: formatScore(analyse.scoreFaisabilite),
          palier: assemble.palier.label,
          propositionId,
          slug: proposition.slug ?? null,
          brouillon: estBrouillon,
          genereLe: reel.genereLe,
        },
      });
    }
  }

  const lienSimulation = (m) => `/test/reels/${propositionId}?simulation=${m}${estBrouillon ? "&brouillon=1" : ""}`;

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
            {configuree ? "Page réservée aux personnes déverrouillées : saisissez le code d’édition ci-dessus." : "Le mode édition n’est pas configuré sur ce site."}
          </p>
        ) : (
          <>
            <header className="flex flex-col gap-2">
              <h1 className="text-2xl font-bold tracking-tight">Reel vidéo · storyboard</h1>
              <p className="text-sm text-zinc-600">
                <Link href={estBrouillon ? `/test/${proposition.id}` : cheminFiche(proposition)} className="underline underline-offset-2">
                  {proposition.titre ?? `Fiche ${proposition.id}`}
                </Link>{" "}
                · {proposition.candidat.nom} · {formatScore(analyse.scoreFaisabilite)}/100
                {estBrouillon ? <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">Brouillon, non publié</span> : null}
              </p>
            </header>

            {etat?.storyboard ? (
              <section className="flex flex-col gap-2 rounded-xl border-2 border-zinc-900 bg-white p-4">
                <p className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Storyboard · mode {etat.mode === "A" ? "A, script Claude" : "B, script et voix off de l’équipe"}
                  {simulation ? <span className="rounded-full bg-violet-100 px-2 py-0.5 normal-case text-violet-800">simulation : aucun appel, rien en base</span> : null}
                  {etat.genereLe ? (
                    <span className="normal-case text-zinc-400">
                      généré le {new Date(etat.genereLe).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Paris" })}
                    </span>
                  ) : null}
                </p>
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

            {donnees ? (
              <section className="grid gap-4 lg:grid-cols-2">
                <div className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-4 text-sm">
                  <p className="font-semibold">Avant de livrer, vérifie</p>
                  <ul className="flex flex-col gap-2">
                    {donnees.checkList.map((item) => (
                      <li key={item.texte} className="flex gap-2">
                        <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded text-xs font-bold ${ETATS[item.etat].classe}`}>{ETATS[item.etat].signe}</span>
                        <span>
                          {item.texte} <span className="text-zinc-500">{item.detail}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-zinc-400">✓ vérifié par le code · ✗ à corriger · ? à vérifier à l’œil</p>
                </div>
                <div className="flex flex-col gap-2 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                  <p className="font-semibold">Points à valider ({donnees.avertissements.length + donnees.zones.length})</p>
                  {donnees.avertissements.length + donnees.zones.length === 0 ? (
                    <p>Aucun : contrôles passés, rien ne déborde des zones sûres.</p>
                  ) : (
                    <ul className="list-disc pl-5">
                      {[...donnees.avertissements, ...donnees.zones].map((a) => (
                        <li key={a}>{a}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            ) : null}

            <section className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4">
                <p className="font-semibold">A · Script Claude</p>
                <p className="text-sm text-zinc-600">Claude écrit le script (ton parlé, phrases fixes, note du code) et le storyboard. L’équipe enregistre ensuite la voix off et repasse en mode B.</p>
                <BoutonGenererReel
                  propositionId={proposition.id}
                  brouillon={estBrouillon}
                  aDejaUnReel={Boolean(reel)}
                  libelleRepos={reel ? "Script Claude : générer à nouveau" : "Script Claude : générer"}
                />
              </div>
              <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4">
                <p className="font-semibold">B · Script et voix off de l’équipe</p>
                <p className="text-sm text-zinc-600">
                  Claude découpe le texte sans le réécrire (contrôle mot pour mot bloquant). minutage.json vient de{" "}
                  <code className="font-mono text-xs">python scripts/caler-voix.py voix-off.mp3 script.txt</code>.
                </p>
                <DepotEquipe propositionId={proposition.id} brouillon={estBrouillon} />
              </div>
            </section>

            {simulations.length ? (
              <p className="text-sm text-zinc-600">
                Simulations (aucun appel, rien en base) :{" "}
                {simulations.map((m, i) => (
                  <span key={m}>
                    {i ? " · " : ""}
                    <Link href={lienSimulation(m)} className={`underline underline-offset-2 ${simulation === m ? "font-bold" : ""}`}>
                      mode {m}
                    </Link>
                  </span>
                ))}
                {simulation ? (
                  <>
                    {" · "}
                    <Link href={`/test/reels/${propositionId}${estBrouillon ? "?brouillon=1" : ""}`} className="underline underline-offset-2">
                      revenir au Reel en base
                    </Link>
                  </>
                ) : null}
              </p>
            ) : null}

            {donnees ? <ReelStoryboard {...donnees} /> : null}

            {!donnees && !v3 ? (
              <p className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600">Cette fiche n’a pas encore de storyboard : mode A ou mode B ci-dessus.</p>
            ) : null}

            {v3 ? (
              <section className="flex flex-col gap-4 border-t border-zinc-200 pt-6">
                <p className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600">
                  Reel v3 (9 scènes fixes) généré avant le storyboard, affiché tel quel. « Script Claude » ou le dépôt de l’équipe le remplacent (il reste gardé sous reelPrecedent).
                </p>
                {photoV3 ? (
                  <p className="rounded-xl border border-orange-300 bg-orange-50 p-3 text-sm text-orange-900">
                    Photo du candidat : à créditer dans la légende du Reel. {photoV3.credit?.complet ?? "CRÉDIT MANQUANT : ne pas publier."}
                  </p>
                ) : null}
                <ReelPartage {...v3} />
              </section>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}
