import Link from "next/link";
import Header from "@/components/Header";
import MonoTag from "@/components/MonoTag";
import { prisma } from "@/lib/prisma";
import { isEditor } from "@/lib/test-auth";
import { lireFile } from "@/lib/file-attente";
import ZoneDepot from "./ZoneDepot";
import RetirerBouton from "./RetirerBouton";

// Dépôt des fiches d'étape 1 dans la file d'attente (table FicheEtape1), puis
// traitement par `npm run file-attente` (étapes 2 et 3, brouillon sur /test).
// Réservée aux personnes qui ont déverrouillé le mode édition de /test.

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Dépôt des fiches — Perlimpinpin",
  robots: { index: false, follow: false },
};

const STATUTS = {
  en_attente: { label: "En attente", classe: "bg-zinc-100 text-zinc-700" },
  en_cours: { label: "En cours", classe: "bg-yellow-100 text-yellow-900" },
  traitee: { label: "Traitée", classe: "bg-green-100 text-green-900" },
  erreur: { label: "Erreur", classe: "bg-red-100 text-red-900" },
  ignoree: { label: "Retirée", classe: "bg-zinc-100 text-zinc-400" },
};

const SOURCES = { depot: "Page de dépôt", claude: "Claude (SQL)", import: "Import local" };

function dateFr(d) {
  return d.toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });
}

function cout(c) {
  const total = c?.coutEstimeTotal;
  return typeof total === "number" ? `~${total.toFixed(2)} $` : null;
}

export default async function DepotPage() {
  if (!(await isEditor())) {
    return (
      <div className="flex min-h-screen flex-col bg-page-gradient font-sans">
        <Header />
        <main className="mx-auto w-full max-w-3xl px-6 py-16">
          <p className="text-zinc-700">
            Page réservée à l&rsquo;équipe. Déverrouillez le mode édition sur{" "}
            <Link href="/test" className="underline">
              /test
            </Link>{" "}
            (bouton du code d&rsquo;édition), puis revenez ici.
          </p>
        </main>
      </div>
    );
  }

  let file = [];
  let tableAbsente = false;
  try {
    file = await lireFile(prisma);
  } catch (e) {
    // Migration pas encore appliquée sur cette base : la page l'explique au lieu de planter.
    if (e?.code === "P2021") tableAbsente = true;
    else throw e;
  }

  return (
    <div className="flex min-h-screen flex-col bg-page-gradient font-sans">
      <Header />
      <main className="w-full px-4 py-12 sm:px-8 sm:py-16">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
          <div>
            <MonoTag>File d&rsquo;attente</MonoTag>
            <h1 className="mt-2 text-[clamp(1.875rem,1.2rem+2.6vw,3rem)] font-extrabold tracking-tight text-zinc-900">
              Déposer une fiche d&rsquo;étape 1
            </h1>
            <p className="mt-2 max-w-2xl text-base text-zinc-600">
              Déposez ici le JSON d&rsquo;une analyse d&rsquo;étape 1 faite dans Claude, bloc « relecture » compris.
              Chaque fichier est contrôlé : s&rsquo;il est conforme, il entre dans la file d&rsquo;attente ; sinon, les
              erreurs s&rsquo;affichent et rien n&rsquo;est enregistré. Les étapes 2 et 3 sont lancées plus tard
              (commande <code>npm run file-attente</code>) ; la fiche finale arrive alors en brouillon sur{" "}
              <Link href="/test" className="underline">
                /test
              </Link>
              .
            </p>
          </div>

          {tableAbsente ? (
            <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
              La table de la file d&rsquo;attente n&rsquo;existe pas encore sur cette base (migration à appliquer).
            </p>
          ) : (
            <ZoneDepot />
          )}

          <section>
            <h2 className="text-2xl font-bold text-zinc-900">La file</h2>
            {file.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-500">Aucune fiche dans la file.</p>
            ) : (
              <ul className="mt-4 flex flex-col gap-3">
                {file.map((f) => {
                  const s = STATUTS[f.statut] ?? { label: f.statut, classe: "bg-zinc-100 text-zinc-700" };
                  return (
                    <li key={f.id} className="rounded-2xl border border-zinc-200 bg-white p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.classe}`}>{s.label}</span>
                        <code className="break-all text-sm text-zinc-800">{f.slug}</code>
                        <span className="text-xs text-zinc-400">n° {f.id}</span>
                      </div>
                      <p className="mt-2 font-semibold text-zinc-900">{f.titre ?? "(sans titre)"}</p>
                      <p className="mt-1 text-sm text-zinc-600">
                        {f.candidat ?? "candidat inconnu"} · {SOURCES[f.source] ?? f.source}
                        {f.deposePar ? ` · déposée par ${f.deposePar}` : ""} · {dateFr(f.createdAt)}
                      </p>
                      {f.statut === "traitee" && f.analyseId ? (
                        <p className="mt-1 text-sm text-zinc-700">
                          Brouillon :{" "}
                          <Link href={`/test/${f.analyseId}`} className="font-semibold underline">
                            /test/{f.analyseId}
                          </Link>
                          {cout(f.coutPipeline) ? ` · coût ${cout(f.coutPipeline)}` : ""}
                          {f.traiteeAt ? ` · traitée le ${dateFr(f.traiteeAt)}` : ""}
                        </p>
                      ) : null}
                      {f.erreurs.length ? (
                        <ul className="mt-2 list-disc rounded-lg bg-red-50 py-2 pl-7 pr-3 text-sm text-red-900">
                          {f.erreurs.map((e, i) => (
                            <li key={i} className="break-words">
                              {e}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {f.statut === "en_attente" || f.statut === "erreur" ? (
                        <div className="mt-2">
                          <RetirerBouton id={f.id} slug={f.slug} />
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
