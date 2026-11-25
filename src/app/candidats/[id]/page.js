import { notFound } from "next/navigation";
import Header from "@/components/Header";
import DeclarationCarte from "@/components/DeclarationCarte";
import { getCandidatAvecDeclarations } from "@/lib/queries";
import { getScoreBadge } from "@/lib/score";
import { getContenuCandidat } from "@/lib/contenus-candidats";

// Blocs éditoriaux « Parcours », « Positions clés » et « Citation marquante »
// (src/lib/contenus-candidats.js). Rien n'est affiché pour un candidat sans
// contenu.
function BlocContenu({ titre, children }) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-6">
      <h2 className="text-lg font-bold text-zinc-900">{titre}</h2>
      {children}
    </section>
  );
}

function ContenusCandidat({ contenu }) {
  const { parcours, positions, citation } = contenu;

  return (
    <>
      {parcours?.length ? (
        <BlocContenu titre="Parcours">
          <div className="flex flex-col gap-3 text-base leading-relaxed text-zinc-700">
            {parcours.map((paragraphe) => (
              <p key={paragraphe}>{paragraphe}</p>
            ))}
          </div>
        </BlocContenu>
      ) : null}

      {positions ? (
        <BlocContenu titre="Positions clés">
          <div className="flex flex-col gap-3 text-base leading-relaxed text-zinc-700">
            {positions.intro ? <p>{positions.intro}</p> : null}
            {positions.items?.length ? (
              <ul className="flex list-disc flex-col gap-2 pl-5 marker:text-yellow-400">
                {positions.items.map(({ titre, texte }) => (
                  <li key={titre}>
                    <strong className="font-semibold text-zinc-900">{titre}</strong> : {texte}
                  </li>
                ))}
              </ul>
            ) : null}
            {positions.conclusion ? <p>{positions.conclusion}</p> : null}
          </div>
        </BlocContenu>
      ) : null}

      {citation ? (
        <BlocContenu titre="Citation marquante">
          <figure className="flex flex-col gap-3">
            <blockquote className="border-l-4 border-yellow-400 bg-yellow-50/60 px-5 py-4 font-serif text-xl leading-relaxed text-zinc-900">
              {citation.texte}
            </blockquote>
            <figcaption className="text-sm text-zinc-700">
              {citation.auteur}
              {citation.contexte ? `, ${citation.contexte}` : null}
            </figcaption>
          </figure>
        </BlocContenu>
      ) : null}
    </>
  );
}

function LienHatvp({ url }) {
  if (!url) return "Pas de fiche HATVP en ligne";
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="underline underline-offset-2 hover:text-zinc-700"
    >
      Fiche HATVP ↗
    </a>
  );
}

// Encadré « Indemnités et revenus déclarés » (data/candidats-parcours.json).
// Plus affiché sur la page détail (consigne éditoriale) : ces infos ne
// figurent que sur les cartes de /candidats. Conservé pour un usage futur.
// Indemnités brutes et revenus nets déclarés restent dans deux colonnes
// distinctes : ils ne sont pas comparables.
function IndemnitesRevenus({ parcours }) {
  const { indemnites_elu: indemnites, revenus_declares_hatvp: revenus } = parcours;

  return (
    <section className="flex flex-col gap-5 rounded-2xl border border-zinc-200 bg-white p-6">
      <h2 className="text-lg font-bold text-zinc-900">Indemnités et revenus déclarés</h2>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        {indemnites ? (
          <div className="flex flex-col gap-3">
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
              Indemnités d&rsquo;élu
            </p>
            <p className="text-base font-bold text-zinc-900">{indemnites.affichage}</p>
            {indemnites.detail?.length ? (
              <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-zinc-700 marker:text-zinc-300">
                {indemnites.detail.map((ligne) => (
                  <li key={ligne}>{ligne}</li>
                ))}
              </ul>
            ) : null}
            {indemnites.note ? (
              <p className="text-xs leading-relaxed text-zinc-600">{indemnites.note}</p>
            ) : null}
            {indemnites.sources?.length ? (
              <ul className="flex flex-col gap-1 text-xs text-zinc-500">
                {indemnites.sources.map((source) => (
                  <li key={source.url}>
                    Source :{" "}
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-2 hover:text-zinc-700"
                    >
                      {source.label}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="text-xs leading-relaxed text-zinc-400">
              Montants bruts mensuels au 1er janvier 2026, d&rsquo;après les barèmes
              officiels. Pour les mandats locaux, il s&rsquo;agit des plafonds fixés par la loi.
            </p>
          </div>
        ) : null}

        {revenus ? (
          <div className="flex flex-col gap-3">
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
              Revenus déclarés à la HATVP
            </p>
            <p
              className={`text-base font-bold ${
                revenus.disponible ? "text-zinc-900" : "text-zinc-400"
              }`}
            >
              {revenus.affichage}
            </p>
            {revenus.disponible ? (
              <>
                {revenus.detail?.length ? (
                  <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-zinc-700 marker:text-zinc-300">
                    {revenus.detail.map((ligne) => (
                      <li key={ligne}>{ligne}</li>
                    ))}
                  </ul>
                ) : null}
                {revenus.regle ? (
                  <p className="text-xs leading-relaxed text-zinc-600">{revenus.regle}</p>
                ) : null}
                {revenus.declaration?.url ? (
                  <a
                    href={revenus.declaration.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-fit text-sm font-semibold text-zinc-900 underline underline-offset-2 hover:opacity-70"
                  >
                    Voir la déclaration du {revenus.declaration.date_depot} ↗
                  </a>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-zinc-600">
                Aucune déclaration d&rsquo;intérêts publiée par la HATVP pour ce candidat.
              </p>
            )}
            <p className="text-xs leading-relaxed text-zinc-400">
              Montants nets, tels que déclarés par l&rsquo;élu. Ils ne sont pas comparables
              aux indemnités brutes ci-contre.
            </p>
          </div>
        ) : null}
      </div>

      <p className="border-t border-zinc-100 pt-4 text-xs text-zinc-500">
        <LienHatvp url={parcours.hatvp_url} />
      </p>
    </section>
  );
}

// ISR : chaque page est calculée à sa première visite, puis servie depuis le
// cache du CDN et recalculée au plus toutes les 5 minutes. generateStaticParams
// renvoie [] : le build ne lit pas Neon, et dynamicParams = true laisse
// générer n'importe quelle adresse à la demande.
export const revalidate = 300;
export const dynamicParams = true;

export async function generateStaticParams() {
  return [];
}

export default async function CandidatDetailPage({ params }) {
  const { id } = await params;
  const candidatId = Number(id);

  if (!Number.isInteger(candidatId)) {
    notFound();
  }

  // Candidat, score moyen et déclarations publiées, chargés en une fois côté
  // serveur : aucune requête supplémentaire au clic ou au défilement.
  const candidat = await getCandidatAvecDeclarations(candidatId);

  if (!candidat) {
    notFound();
  }

  const { declarations } = candidat;
  const contenu = getContenuCandidat(candidat.nom);
  const badge =
    candidat.scoreMoyen == null ? null : getScoreBadge(candidat.scoreMoyen);

  return (
    <div className="flex min-h-screen flex-col bg-page-gradient font-sans">
      <Header />

      <main className="w-full px-6 py-12 sm:px-8 sm:py-16">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
          <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
            <img
              src={candidat.photoUrl || "/avatar-placeholder.svg"}
              alt={candidat.nom}
              className="aspect-square w-full max-w-[300px] shrink-0 rounded-2xl object-cover object-top"
            />

            <div className="flex flex-col justify-center gap-3">
              <h1 className="font-serif text-4xl font-bold leading-tight tracking-tight text-zinc-900">
                {candidat.nom}
              </h1>
              <p className="text-base text-zinc-500">{candidat.parti}</p>

              <div className="mt-2">
                <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
                  Score Perlimpinpin moyen
                </span>
                {badge ? (
                  <>
                    <div className="mt-2 flex items-baseline gap-1.5">
                      <span
                        className={`text-5xl font-extrabold tracking-tight ${badge.scoreClass}`}
                      >
                        {candidat.scoreMoyen}
                      </span>
                      <span className="text-lg font-semibold text-zinc-400">
                        /100
                      </span>
                    </div>
                    <div
                      className={`mt-3 inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-semibold ${badge.badgeClass}`}
                    >
                      {badge.label}
                    </div>
                    <p className="mt-2 text-sm text-zinc-500">
                      sur {declarations.length} proposition
                      {declarations.length > 1 ? "s" : ""} analysée
                      {declarations.length > 1 ? "s" : ""}
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-zinc-500">Analyse en cours</p>
                )}
              </div>
            </div>
          </div>

          {contenu ? <ContenusCandidat contenu={contenu} /> : null}

          <section className="flex flex-col gap-4">
            <h2 className="text-lg font-bold text-zinc-900">
              Ses propositions analysées
            </h2>
            {declarations.length ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {declarations.map((d) => (
                  <DeclarationCarte key={d.analyseId} d={d} />
                ))}
              </div>
            ) : (
              <p className="rounded-2xl border border-zinc-200 bg-white px-6 py-10 text-center text-sm text-zinc-500">
                Les propositions de ce candidat sont en cours d&rsquo;analyse.
              </p>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
