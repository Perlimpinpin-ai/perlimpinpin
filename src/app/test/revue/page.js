import Link from "next/link";
import Header from "@/components/Header";
import MonoTag from "@/components/MonoTag";
import { prisma } from "@/lib/prisma";
import { isEditor } from "@/lib/test-auth";
import { CATEGORIES, dernierTri, enTexte } from "@/lib/revue-core";
import { PREFIXE_FICHE, propositionDuSlug } from "@/lib/fiche-annotations-core";
import { Publier, Reclasser, Rejeter, TraiterMaintenant, ValiderReponses } from "./Formulaires";
import { estTraitee } from "@/lib/versions-core";

// Page admin de la revue du dimanche (Club ouvert, lot 4) : avancement des
// passages de revue, annotations triées (reclassement), révisions proposées
// à valider en tapant « oui », et « Traiter maintenant » sur une fiche.
// Réservée aux éditeurs de /test (même code d'accès).

export const dynamic = "force-dynamic";
export const metadata = { title: "Revue du dimanche — Perlimpinpin", robots: { index: false, follow: false } };

const IGNORER = new Set(["notation_detaillee", "version_basique", "reseaux", "revision"]);
const dateFr = (d) =>
  new Date(d).toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "short", timeStyle: "short" });

// Sections dont le contenu change entre deux versions : [{ cle, avant, apres }].
function sectionsChangees(avant = {}, apres = {}) {
  const cles = new Set([...Object.keys(avant ?? {}), ...Object.keys(apres ?? {})]);
  return [...cles]
    .filter((cle) => !IGNORER.has(cle) && JSON.stringify(avant?.[cle] ?? null) !== JSON.stringify(apres?.[cle] ?? null))
    .map((cle) => ({ cle, avant: enTexte(avant?.[cle]) || JSON.stringify(avant?.[cle] ?? null), apres: enTexte(apres?.[cle]) || JSON.stringify(apres?.[cle] ?? null) }));
}

async function donnees() {
  const [lots, revisions, reglees, annotations] = await Promise.all([
    prisma.revueLot.findMany({ orderBy: { createdAt: "desc" }, take: 5, include: { etapes: { orderBy: { createdAt: "asc" } } } }),
    prisma.revisionProposee.findMany({
      where: { decisions: { none: {} } },
      orderBy: { createdAt: "desc" },
      include: {
        analyseSource: {
          select: { id: true, statut: true, contenuComplet: true, proposition: { select: { titre: true, candidat: { select: { nom: true } } } } },
        },
      },
    }),
    prisma.revisionProposee.findMany({ where: { decisions: { some: {} } }, select: { commentIds: true } }),
    prisma.relectureComment.findMany({
      where: { ficheSlug: { startsWith: PREFIXE_FICHE } },
      orderBy: { createdAt: "desc" },
      take: 300,
      select: {
        id: true,
        ficheSlug: true,
        sectionLabel: true,
        sectionId: true,
        quotedText: true,
        body: true,
        authorName: true,
        createdAt: true,
        tris: { select: { id: true, categorie: true, justification: true, reponse: true, source: true, createdAt: true } },
        traitements: { select: { id: true, etat: true, createdAt: true } },
      },
    }),
  ]);
  // Une seule révision en attente par fiche : la plus récente (les autres sont dépassées).
  const parFiche = new Map();
  for (const r of revisions) if (!parFiche.has(r.propositionId)) parFiche.set(r.propositionId, r);
  const dejaReglees = new Set(reglees.flatMap((r) => (Array.isArray(r.commentIds) ? r.commentIds : [])));
  // Lot 5 : une annotation close (TraitementAnnotation « traitee ») n'est plus en attente.
  const enAttente = annotations.filter((a) => !dejaReglees.has(a.id) && !estTraitee(a));
  const annotationsParFiche = new Map();
  for (const a of enAttente) {
    const id = propositionDuSlug(a.ficheSlug);
    if (!annotationsParFiche.has(id)) annotationsParFiche.set(id, []);
    annotationsParFiche.get(id).push(a);
  }
  return { lots, revisions: [...parFiche.values()], annotationsParFiche };
}

export default async function RevuePage() {
  if (!(await isEditor())) {
    return (
      <div className="flex min-h-screen flex-col bg-page-gradient font-sans">
        <Header />
        <main className="mx-auto w-full max-w-3xl px-6 py-16">
          <p className="text-zinc-700">
            Page réservée à l&rsquo;équipe. Déverrouillez le mode édition sur{" "}
            <Link href="/test" className="underline">
              /test
            </Link>
            .
          </p>
        </main>
      </div>
    );
  }

  const { lots, revisions, annotationsParFiche } = await donnees();

  return (
    <div className="flex min-h-screen flex-col bg-page-gradient font-sans">
      <Header />
      <main className="w-full px-6 py-12 sm:px-8 sm:py-16">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
          <div>
            <MonoTag>Club</MonoTag>
            <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-zinc-900">Revue du dimanche</h1>
            <p className="mt-2 max-w-2xl text-zinc-600">
              Clôture automatique le dimanche à 8 h (heure de Paris). Rien n&rsquo;est publié sans que vous tapiez
              « oui ». Le score de chaque version proposée est calculé par le code.
            </p>
            <div className="mt-4 rounded-2xl border border-yellow-200 bg-yellow-50/60 p-4">
              <p className="mb-2 text-sm font-semibold text-zinc-800">Traiter une fiche maintenant (urgence)</p>
              <TraiterMaintenant />
            </div>
          </div>

          <section>
            <h2 className="text-2xl font-bold text-zinc-900">Versions proposées à valider</h2>
            {revisions.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-500">Aucune révision en attente.</p>
            ) : (
              <ul className="mt-4 flex flex-col gap-6">
                {revisions.map((r) => {
                  const resume = r.resume ?? {};
                  const source = r.analyseSource;
                  const perimee = source.statut !== "publie";
                  const changements = sectionsChangees(source.contenuComplet, r.contenuPropose);
                  return (
                    <li key={r.id} className="rounded-2xl border border-zinc-200 bg-white p-5">
                      <p className="text-sm text-zinc-500">
                        {source.proposition?.candidat?.nom} · révision n° {r.id} du {dateFr(r.createdAt)}
                        {r.etapes23 ? " · étapes 2 et 3 relancées" : " · textes seulement"}
                      </p>
                      <p className="mt-1 text-lg font-semibold text-zinc-900">
                        <Link href={`/declarations/${r.propositionId}`} className="underline decoration-zinc-300 underline-offset-4">
                          {source.proposition?.titre ?? `Fiche ${r.propositionId}`}
                        </Link>
                      </p>
                      <p className="mt-2 text-zinc-800">
                        Score : <b>{resume.scoreAvant ?? "?"}</b> → <b>{resume.scoreApres ?? "?"}</b> (calculé par le code)
                      </p>
                      {resume.raison ? <p className="mt-1 text-zinc-700">{resume.raison}</p> : null}
                      {Array.isArray(resume.criteresModifies) && resume.criteresModifies.length > 0 ? (
                        <table className="mt-3 w-full text-left text-sm">
                          <thead className="text-zinc-500">
                            <tr>
                              <th className="py-1 pr-3 font-medium">Critère</th>
                              <th className="py-1 pr-3 font-medium">Avant</th>
                              <th className="py-1 pr-3 font-medium">Après</th>
                              <th className="py-1 font-medium">Raison</th>
                            </tr>
                          </thead>
                          <tbody>
                            {resume.criteresModifies.map((c) => (
                              <tr key={c.critere} className="border-t border-zinc-100">
                                <td className="py-1 pr-3">{c.critere}</td>
                                <td className="py-1 pr-3">{c.ancienneNote}</td>
                                <td className="py-1 pr-3">{c.nouvelleNote}</td>
                                <td className="py-1">{c.raison ?? ""}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p className="mt-2 text-sm text-zinc-500">Aucune note ne change.</p>
                      )}
                      {Array.isArray(resume.reponses) && resume.reponses.length > 0 ? (
                        <details className="mt-3">
                          <summary className="cursor-pointer text-sm font-semibold text-zinc-700">
                            Réponses aux annotations prises en compte
                          </summary>
                          <ul className="mt-2 flex flex-col gap-2 text-sm">
                            {resume.reponses.map((rep) => (
                              <li key={rep.commentaire_id} className="rounded-lg bg-zinc-50 p-2">
                                <span className="text-xs text-zinc-500">
                                  {rep.commentaire_id} · {rep.retenu ? "retenue" : "non retenue"}
                                </span>
                                <p className="text-zinc-800">{rep.reponse}</p>
                              </li>
                            ))}
                          </ul>
                        </details>
                      ) : null}
                      <details className="mt-3">
                        <summary className="cursor-pointer text-sm font-semibold text-zinc-700">
                          Voir la version proposée ({changements.length} section{changements.length > 1 ? "s" : ""} modifiée
                          {changements.length > 1 ? "s" : ""})
                        </summary>
                        <div className="mt-2 flex flex-col gap-3">
                          {changements.map((c) => (
                            <div key={c.cle} className="rounded-lg border border-zinc-200 p-3 text-sm">
                              <p className="font-mono text-xs text-zinc-500">{c.cle}</p>
                              <div className="mt-2 grid gap-3 md:grid-cols-2">
                                <div>
                                  <p className="text-xs font-semibold text-zinc-500">Avant</p>
                                  <p className="whitespace-pre-wrap text-zinc-600">{c.avant}</p>
                                </div>
                                <div>
                                  <p className="text-xs font-semibold text-zinc-500">Après</p>
                                  <p className="whitespace-pre-wrap rounded bg-yellow-50 text-zinc-900">{c.apres}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </details>
                      <div className="mt-4 flex flex-col gap-3 border-t border-zinc-100 pt-4">
                        {perimee ? (
                          <p className="text-sm text-red-700">
                            Une autre version a été publiée depuis : cette révision ne peut plus être publiée. Relancez la
                            fiche avec « Traiter maintenant ».
                          </p>
                        ) : (
                          <Publier revisionId={r.id} />
                        )}
                        <Rejeter revisionId={r.id} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section>
            <h2 className="text-2xl font-bold text-zinc-900">Annotations en attente</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Seule la catégorie « {CATEGORIES.argument_ou_source} » déclenche une révision. Après un reclassement,
              « Traiter maintenant » relance la fiche.
            </p>
            {annotationsParFiche.size === 0 ? (
              <p className="mt-3 text-sm text-zinc-500">Aucune annotation en attente.</p>
            ) : (
              <div className="mt-4 flex flex-col gap-6">
                {[...annotationsParFiche.entries()].map(([fiche, liste]) => (
                  <div key={fiche} className="rounded-2xl border border-zinc-200 bg-white p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <Link href={`/declarations/${fiche}?vue=expert`} className="font-semibold text-zinc-900 underline decoration-zinc-300 underline-offset-4">
                        Fiche {fiche}
                      </Link>
                      <div className="flex flex-col gap-2">
                        <TraiterMaintenant propositionId={String(fiche)} />
                        <ValiderReponses propositionId={fiche} />
                      </div>
                    </div>
                    <ul className="mt-3 flex flex-col gap-4">
                      {liste.map((a) => {
                        const tri = dernierTri(a.tris);
                        return (
                          <li key={a.id} className="border-t border-zinc-100 pt-3 text-sm">
                            <p className="text-xs text-zinc-500">
                              {a.authorName ?? "Membre"} · {dateFr(a.createdAt)} · {a.sectionLabel ?? a.sectionId}
                            </p>
                            {a.quotedText ? <p className="mt-1 italic text-zinc-500">« {a.quotedText} »</p> : null}
                            <p className="mt-1 whitespace-pre-wrap text-zinc-900">{a.body}</p>
                            <p className="mt-2 text-xs text-zinc-600">
                              {tri
                                ? `Tri : ${CATEGORIES[tri.categorie] ?? tri.categorie} (${tri.source === "arno" ? "équipe" : "automatique"})${tri.justification ? ` — ${tri.justification}` : ""}`
                                : "Pas encore triée (prochaine revue)."}
                            </p>
                            <Reclasser commentId={a.id} categorie={tri?.categorie} reponse={tri?.reponse} categories={CATEGORIES} />
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="text-2xl font-bold text-zinc-900">Derniers passages de revue</h2>
            {lots.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-500">Aucun passage pour le moment.</p>
            ) : (
              <ul className="mt-4 flex flex-col gap-3">
                {lots.map((lot) => (
                  <li key={lot.id} className="rounded-xl border border-zinc-200 bg-white p-4 text-sm">
                    <p className="font-semibold text-zinc-900">
                      N° {lot.id} · {lot.type === "urgence" ? `fiche ${lot.propositionId} (traiter maintenant)` : "revue hebdomadaire"} ·
                      clôture {dateFr(lot.clotureAt)}
                    </p>
                    <ul className="mt-2 flex flex-col gap-1 text-zinc-600">
                      {lot.etapes.map((e) => (
                        <li key={e.id} className={e.etape === "echec" ? "text-red-700" : ""}>
                          {dateFr(e.createdAt)} · {e.etape}
                          {e.detail ? ` · ${JSON.stringify(e.detail)}` : ""}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
