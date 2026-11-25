import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import SectionHeading from "@/components/SectionHeading";
import EncartDon from "@/components/EncartDon";
import { MESSAGE_DON_DOSSIER } from "@/lib/message-don-dossier";
import { getHorsSerie, getHorsSerieSlugs } from "@/lib/hors-series";
import { getScoresPublies } from "@/lib/queries";
import { getScoreBadge, getScoreBands, VERDICT_BG_CLASSES } from "@/lib/score";
import { DOSSIER, NUANCES_JAUNE } from "@/lib/couleurs-dossier";

// Pages dossier (/dossiers/[slug]) : un plan d'ensemble d'un candidat (ex.
// son plan budgétaire) découpé en plusieurs fiches notées, lu comme un
// article. Tout le contenu vient du JSON du dossier (data/hors-series/, voir
// src/lib/hors-series.js : noms de fichiers internes inchangés) ; seule la
// couleur jaune (src/lib/couleurs-dossier.js) est propre aux dossiers. Une seule police sur la page : Geist (font-sans).
// Les slugs sont connus au build : tout autre slug renvoie une 404.
export const dynamicParams = false;

// Les scores des fiches publiées sont lus en base : même délai que les
// autres pages.
export const revalidate = 300;

export function generateStaticParams() {
  return getHorsSerieSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const hs = getHorsSerie(slug);
  if (!hs) return {};
  return {
    title: `${hs.titre} | Perlimpinpin`,
    description: hs.description,
  };
}

const SECTION = "w-full px-6 pb-14 sm:px-8 sm:pb-16";
const CONTENEUR = "mx-auto w-full max-w-[1280px]";
const TITRE_SECTION = "font-sans text-3xl font-extrabold tracking-tight text-zinc-950 sm:text-[2.125rem]";
const OMBRE_CARTE = "shadow-[0_24px_60px_-30px_rgba(30,41,82,0.35)]";

// Blocs de la barre de décomposition dont la fiche n'est pas encore publiée :
// nuances du jaune des dossiers, dans l'ordre des postes (de la plus
// soutenue à la plus claire). Une fiche publiée prend la couleur de son
// verdict.
// Poste sans fiche (« Autres ») : hachures grises.
const HACHURES =
  "bg-[repeating-linear-gradient(45deg,var(--color-zinc-200)_0_8px,var(--color-zinc-100)_8px_16px)]";

// Étiquette « // … » de cette page, en Geist comme le reste de la page (et
// non en police mono comme MonoTag, utilisé ailleurs sur le site).
function Etiquette({ children, couleur = "text-zinc-400", className = "" }) {
  return (
    <span className={`text-xs font-semibold uppercase tracking-[0.12em] ${couleur} ${className}`}>
      {`// ${children}`}
    </span>
  );
}

// Titre avec le mot `motItalique` en gris clair et en italique, comme
// « vraiment » dans HeroText. Seule la première occurrence est concernée
// (ex. « budgétaire »). mr-[0.15em] : correction d'italique.
function TitreAvecItalique({ titre, motItalique }) {
  const position = motItalique ? titre.indexOf(motItalique) : -1;
  if (position === -1) return titre;
  const fin = position + motItalique.length;
  return (
    <>
      {titre.slice(0, position)}
      <span className="mr-[0.15em] italic text-zinc-400">{motItalique}</span>
      {titre.slice(fin)}
    </>
  );
}

// Lien vers une source externe (`{ label, url }` du JSON), ouvert dans un
// nouvel onglet. Rien n'est affiché si la source est absente.
function LienSource({ source, prefixe = "Source : ", className = "" }) {
  if (!source?.url) return null;
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`text-xs text-zinc-400 underline decoration-zinc-300 underline-offset-2 transition-colors hover:text-zinc-700 ${className}`}
    >
      {prefixe}
      {source.label} <span aria-hidden="true">↗</span>
    </a>
  );
}

// Texte courant « article », hors carte, en colonne de lecture.
// `chapo` : le premier paragraphe est mis en avant avec une fine barre jaune.
function Prose({ paragraphes, chapo = false, className = "" }) {
  if (!paragraphes?.length) return null;
  return (
    <div className={`flex max-w-3xl flex-col gap-5 text-lg leading-relaxed text-zinc-700 ${className}`}>
      {paragraphes.map((paragraphe, i) => (
        <p
          key={paragraphe}
          className={chapo && i === 0 ? `border-l-4 ${DOSSIER.bordure} pl-4 font-medium text-zinc-900` : undefined}
        >
          {paragraphe}
        </p>
      ))}
    </div>
  );
}

function Pastille({ className, children }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${className}`}>
      {children}
    </span>
  );
}

// Score affiché tant qu'aucune note n'est disponible (« ··/100 » grisé).
// `attenue` : plus pâle encore, pour les fiches à venir.
function ScoreAttente({ attenue = false }) {
  return (
    <span className={`text-2xl font-extrabold tracking-tight ${attenue ? "text-zinc-200" : "text-zinc-300"}`}>
      ··
      <span className={`text-sm font-semibold ${attenue ? "text-zinc-300" : "text-zinc-400"}`}>/100</span>
    </span>
  );
}

// Carte d'une fiche du dossier, selon son statut. Une fiche marquée
// « publiee » dans le JSON mais sans score publié en base (propositionId
// absent, analyse encore en brouillon) s'affiche comme « à venir » plutôt
// que de pointer vers une page /declarations en 404.
function CarteFiche({ fiche, candidat, score }) {
  const id = `fiche-${fiche.numero}`;
  const enTete = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-zinc-900">{candidat.nom}</p>
        <p className="text-xs text-zinc-400">{candidat.parti}</p>
      </div>
      <Etiquette className="shrink-0">
        {`FICHE_${String(fiche.numero).padStart(2, "0")}`}
      </Etiquette>
    </div>
  );

  if (fiche.statut === "publiee" && score != null) {
    const badge = getScoreBadge(score);
    return (
      <Link
        id={id}
        href={`/declarations/${fiche.propositionId}`}
        prefetch={false}
        className={`flex scroll-mt-24 flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-6 transition-colors hover:border-zinc-300 hover:bg-zinc-50 ${OMBRE_CARTE}`}
      >
        {enTete}
        <p className="text-[17px] font-semibold leading-snug text-zinc-900">{fiche.titre}</p>
        <div className="flex items-center gap-2">
          <span className={`text-2xl font-extrabold tracking-tight ${badge.scoreClass}`}>
            {score}
            <span className="text-sm font-semibold text-zinc-400">/100</span>
          </span>
          <Pastille className={badge.badgeClass}>{badge.label}</Pastille>
        </div>
        <div className="mt-auto flex items-center justify-between text-xs text-zinc-400">
          <span>{fiche.theme}</span>
          <span aria-hidden="true">→</span>
        </div>
      </Link>
    );
  }

  if (fiche.statut === "relecture") {
    return (
      <div
        id={id}
        className={`flex scroll-mt-24 flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-6 ${OMBRE_CARTE}`}
      >
        {enTete}
        <p className="text-[17px] font-semibold leading-snug text-zinc-900">{fiche.titre}</p>
        <div className="flex flex-wrap items-center gap-2">
          <ScoreAttente />
          <Pastille className="bg-violet-50 text-violet-700">En relecture au Club</Pastille>
        </div>
        <p className="text-xs text-zinc-400">{fiche.theme}</p>
        {/* /relectures est une page statique servie par réécriture
            (next.config.mjs) : lien <a> classique, sans navigation client. */}
        <div className="mt-auto flex flex-wrap gap-x-5 gap-y-2 border-t border-zinc-100 pt-3 text-sm font-semibold">
          <a href="/relectures" className="text-blue-950 hover:underline">
            Commenter (adhérents) <span aria-hidden="true">→</span>
          </a>
          <Link href="/nous-rejoindre" className={`text-zinc-950 underline decoration-2 underline-offset-4 ${DOSSIER.soulignement}`}>
            Rejoindre le Club
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      id={id}
      className="flex scroll-mt-24 flex-col gap-3 rounded-2xl border border-dashed border-zinc-300 bg-white/60 p-6"
    >
      {enTete}
      <p className="text-[17px] font-semibold leading-snug text-zinc-700">{fiche.titre}</p>
      <div className="flex items-center gap-2">
        <ScoreAttente attenue />
        <Pastille className="bg-zinc-100 text-zinc-500">À venir</Pastille>
      </div>
      <p className="mt-auto text-xs text-zinc-400">{fiche.theme}</p>
    </div>
  );
}

// Cellule « Fiche » du tableau des postes.
function CelluleFiche({ fiche, score }) {
  if (!fiche) return <span className="text-zinc-400">-</span>;
  if (fiche.statut === "publiee" && score != null) {
    const badge = getScoreBadge(score);
    return (
      <Link
        href={`/declarations/${fiche.propositionId}`}
        prefetch={false}
        className={`whitespace-nowrap font-semibold hover:underline ${badge.scoreClass}`}
      >
        {score}/100
      </Link>
    );
  }
  if (fiche.statut === "relecture") {
    return (
      <a href={`#fiche-${fiche.numero}`} className="whitespace-nowrap font-semibold text-blue-950 hover:underline">
        En relecture
      </a>
    );
  }
  return <span className="whitespace-nowrap text-zinc-400">À venir</span>;
}

export default async function HorsSeriePage({ params }) {
  const { slug } = await params;
  const hs = getHorsSerie(slug);
  if (!hs) notFound();

  const {
    photo,
    introduction,
    chiffresCles,
    documents,
    encadre,
    decomposition,
    tableau,
    selection,
    analyses,
    fiches,
    noteGlobale,
  } = hs;

  // Scores publiés lus en base, pour les fiches marquées « publiee ».
  const scores = await getScoresPublies(
    fiches
      .filter((f) => f.statut === "publiee" && f.propositionId != null)
      .map((f) => f.propositionId),
  );
  const ficheParNumero = new Map(fiches.map((f) => [f.numero, f]));
  const scoreDe = (fiche) =>
    fiche?.statut === "publiee" && fiche.propositionId != null
      ? scores[fiche.propositionId]
      : undefined;

  // Couleur de chaque bloc de la barre de décomposition : verdict de la
  // fiche une fois publiée, sinon jaune (dans l'ordre des postes), et
  // hachures grises pour le poste sans fiche.
  let rangJaune = 0;
  const postes = decomposition.postes.map((poste) => {
    if (poste.fiche == null) {
      return { ...poste, fond: HACHURES, puce: "bg-zinc-200", estime: true };
    }
    const score = scoreDe(ficheParNumero.get(poste.fiche));
    const fond =
      score != null
        ? VERDICT_BG_CLASSES[getScoreBadge(score).color]
        : NUANCES_JAUNE[Math.min(rangJaune++, NUANCES_JAUNE.length - 1)];
    return { ...poste, fond, puce: fond, estime: false };
  });

  // Barème du plus bas au plus haut, pour la légende de la note globale.
  const bandes = getScoreBands().slice().reverse();
  const badgeGlobal = noteGlobale.score != null ? getScoreBadge(noteGlobale.score) : null;

  return (
    <div className="flex min-h-screen flex-col bg-page-gradient font-sans">
      <Header />

      <main className="flex w-full flex-col">
        {/* En-tête : texte à gauche, portrait à droite (sous le texte sur
            téléphone), même grille que le bandeau de l'accueil. */}
        <section className="w-full px-6 pb-14 pt-12 sm:px-8 sm:pb-16 sm:pt-20">
          <div className={`${CONTENEUR} grid grid-cols-1 items-center gap-10 lg:grid-cols-[1.08fr_1fr] lg:gap-14`}>
            <div className="flex flex-col gap-6">
              <div className="flex flex-wrap items-center gap-3">
                <span className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-zinc-950 ${DOSSIER.fond}`}>
                  Dossier n°{hs.numero}
                </span>
                <Etiquette>{hs.etiquette}</Etiquette>
              </div>

              <h1 className="font-sans text-4xl font-extrabold leading-[1.04] tracking-[-0.035em] text-zinc-950 sm:text-5xl xl:text-6xl">
                <TitreAvecItalique titre={hs.titre} motItalique={hs.motItalique} />
              </h1>

              <p className="max-w-2xl text-lg leading-relaxed text-slate-500 sm:text-xl">
                {hs.description}
              </p>

              <div className="mt-2 flex flex-wrap gap-3">
                <a
                  href="#analyses"
                  className="inline-flex min-h-12 items-center gap-3 rounded-xl bg-blue-950 px-6 py-3.5 text-base font-medium text-white transition-colors hover:bg-blue-900"
                >
                  Voir les {fiches.length} analyses
                  <span aria-hidden="true">→</span>
                </a>
                <a
                  href="#methode"
                  className="inline-flex min-h-12 items-center rounded-xl border border-zinc-200 bg-white px-6 py-3.5 text-base font-medium text-zinc-900 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
                >
                  Notre méthode
                </a>
              </div>
            </div>

            {photo?.src ? (
              <figure className="mx-auto flex w-full max-w-md flex-col gap-2 lg:max-w-[460px]">
                <div className={`relative aspect-[4/5] w-full overflow-hidden rounded-2xl ring-1 ring-zinc-100 ${DOSSIER.fondClair} ${OMBRE_CARTE}`}>
                  <img
                    src={photo.src}
                    alt={photo.alt ?? hs.candidat.nom}
                    className="absolute inset-0 h-full w-full object-cover object-top"
                  />
                </div>
                {photo.credit ? (
                  <figcaption className="text-xs text-zinc-400">{photo.credit}</figcaption>
                ) : null}
              </figure>
            ) : null}
          </div>
        </section>

        {/* L'essentiel : texte d'introduction, ton article */}
        {introduction ? (
          <section className={SECTION}>
            <div className={`${CONTENEUR} flex flex-col gap-5`}>
              <h2 className="max-w-3xl text-[1.75rem] font-extrabold tracking-tight text-zinc-950">
                {introduction.titre}
              </h2>
              <Prose paragraphes={introduction.paragraphes} chapo />
            </div>
          </section>
        ) : null}

        {/* Chiffres clés */}
        <section className={SECTION}>
          <div className={`${CONTENEUR} flex flex-col gap-5`}>
            <Etiquette>{chiffresCles.titre}</Etiquette>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {chiffresCles.items.map((item) => (
                <div
                  key={item.valeur}
                  className="flex flex-col gap-2 rounded-2xl border border-zinc-200 bg-white p-6"
                >
                  <p className="whitespace-nowrap text-4xl font-extrabold leading-none tracking-tight text-blue-950 xl:text-[2.75rem]">
                    {item.valeur}
                  </p>
                  <p className="text-[15px] leading-normal text-slate-500">
                    {item.legende}
                  </p>
                  <LienSource source={item.source} className="mt-auto pt-1" />
                </div>
              ))}
            </div>
            <p className="text-[13px] text-zinc-400">{chiffresCles.note}</p>
          </div>
        </section>

        {/* Deux documents, deux horizons */}
        <section className={SECTION}>
          <div className={`${CONTENEUR} flex flex-col gap-6`}>
            <h2 className={TITRE_SECTION}>{documents.titre}</h2>
            <Prose paragraphes={documents.paragraphes} />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {documents.items.map((doc) => (
                <div
                  key={doc.titre}
                  className="flex flex-col gap-3.5 rounded-2xl border border-zinc-200 bg-white p-6 sm:p-7"
                >
                  <Etiquette>{doc.etiquette}</Etiquette>
                  <h3 className="text-[22px] font-bold tracking-tight text-zinc-900">
                    {doc.titre}
                  </h3>
                  <ul className="flex list-disc flex-col gap-2 pl-5 text-base leading-normal text-zinc-700">
                    {doc.points.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                  <LienSource source={doc.source} className="mt-auto pt-1" />
                </div>
              ))}
            </div>
            {documents.aNoter && (
              <div className={`max-w-4xl rounded-2xl px-5 py-4 text-[15px] leading-relaxed text-zinc-700 ${DOSSIER.fondClair}`}>
                <strong className="text-zinc-900">À noter :</strong>{" "}
                {documents.aNoter}
              </div>
            )}
          </div>
        </section>

        {/* Encadré : économiser, ça veut dire quoi ? */}
        <section className={SECTION}>
          <div className={`${CONTENEUR} flex flex-col gap-6`}>
            <Prose paragraphes={encadre.paragraphesAvant} />
            <div className="flex flex-col gap-6 rounded-2xl bg-blue-950 p-6 text-indigo-100 sm:p-10">
              <Etiquette couleur="text-indigo-300">{encadre.etiquette}</Etiquette>
              <h2 className="font-sans text-3xl font-extrabold tracking-tight text-white sm:text-[2rem]">
                {encadre.titre}
              </h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {encadre.cas.map((cas) => (
                  <div
                    key={cas.titre}
                    className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-6"
                  >
                    {/* Mini-graphique : hauteur de chaque barre en % de la
                        zone, d'après `barres` du JSON. */}
                    <div aria-hidden="true" className="flex h-24 items-end gap-2.5">
                      {cas.barres.map((hauteur, i) => (
                        <div
                          key={i}
                          className="w-10 rounded-t-md bg-indigo-300"
                          style={{ height: `${hauteur}%` }}
                        />
                      ))}
                    </div>
                    <h3 className="text-lg font-bold text-white">{cas.titre}</h3>
                    <p className="text-[15px] leading-normal">{cas.texte}</p>
                  </div>
                ))}
              </div>
              <p className="max-w-4xl text-base leading-relaxed">{encadre.conclusion}</p>
            </div>
          </div>
        </section>

        {/* Décomposition des économies */}
        <section className={SECTION}>
          <div className={`${CONTENEUR} flex flex-col gap-5`}>
            <Etiquette>Décomposition</Etiquette>
            <h2 className={TITRE_SECTION}>{decomposition.titre}</h2>
            <p className="max-w-4xl text-base leading-relaxed text-slate-500">
              {decomposition.intro}
            </p>

            {/* Barre : chaque bloc est large en proportion de son montant.
                Purement visuelle : la légende dessous porte l'information. */}
            <div
              aria-hidden="true"
              className="flex h-14 overflow-hidden rounded-xl border border-zinc-200 bg-white"
            >
              {postes.map((poste) => (
                <div
                  key={poste.libelle}
                  className={poste.fond}
                  style={{ flex: `${poste.montant} 1 0` }}
                />
              ))}
            </div>

            <ul className="grid grid-cols-1 gap-3 text-sm leading-snug text-zinc-700 sm:grid-cols-2 lg:grid-cols-5">
              {postes.map((poste) => (
                <li key={poste.libelle} className="flex items-start gap-2.5">
                  <span
                    aria-hidden="true"
                    className={`mt-1 h-3 w-3 flex-none rounded-[3px] ${poste.puce}`}
                  />
                  <span>
                    <strong className="text-zinc-900">
                      {poste.estime ? "≈ " : ""}
                      {poste.montant} Md€
                    </strong>{" "}
                    {poste.libelle}
                  </span>
                </li>
              ))}
            </ul>

            <Prose paragraphes={decomposition.paragraphes} className="mt-3" />

            {/* Tableau des postes : défilement horizontal sur téléphone. */}
            <div className="mt-2 overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
              <table className="w-full min-w-[780px] border-collapse text-left text-[15px] leading-snug text-zinc-700">
                <thead>
                  <tr>
                    {tableau.colonnes.map((colonne) => (
                      <th
                        key={colonne}
                        scope="col"
                        className="border-b border-zinc-200 px-5 py-3.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500"
                      >
                        {colonne}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableau.lignes.map((ligne) => {
                    const fiche = ficheParNumero.get(ligne.fiche);
                    return (
                      <tr key={ligne.poste} className="border-t border-zinc-100 first:border-t-0">
                        <th scope="row" className="px-5 py-3.5 font-semibold text-zinc-900">
                          {ligne.poste}
                        </th>
                        <td className="px-5 py-3.5">{ligne.contreBudget}</td>
                        <td className="px-5 py-3.5">{ligne.trajectoire}</td>
                        <td className={`px-5 py-3.5 ${ligne.repere == null ? "text-zinc-400" : ""}`}>
                          {ligne.repere ?? "À documenter"}
                          {ligne.repereSource ? (
                            <>
                              {" "}
                              <LienSource source={ligne.repereSource} prefixe="" />
                            </>
                          ) : null}
                        </td>
                        <td className="px-5 py-3.5">
                          <CelluleFiche fiche={fiche} score={scoreDe(fiche)} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Pourquoi ces propositions : critères de sélection, ton article */}
        {selection ? (
          <section className={SECTION}>
            <div className={`${CONTENEUR} flex flex-col gap-6`}>
              <h2 className={TITRE_SECTION}>{selection.titre}</h2>
              <Prose paragraphes={selection.paragraphes} />
              <ol className="grid grid-cols-1 gap-8 md:grid-cols-3">
                {selection.criteres.map((critere, i) => (
                  <li key={critere.titre} className="flex flex-col gap-2">
                    <span aria-hidden="true" className={`text-4xl font-extrabold leading-none ${DOSSIER.texte}`}>
                      {i + 1}
                    </span>
                    <h3 className="text-lg font-bold text-zinc-900">{critere.titre}</h3>
                    <p className="text-base leading-relaxed text-zinc-700">{critere.texte}</p>
                  </li>
                ))}
              </ol>
              {selection.horsChamp ? (
                <div className={`max-w-4xl rounded-2xl px-5 py-4 text-[15px] leading-relaxed text-zinc-700 ${DOSSIER.fondClair}`}>
                  {selection.horsChamp}
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {/* Les fiches */}
        <section id="analyses" className={`${SECTION} scroll-mt-20`}>
          <div className={`${CONTENEUR} flex flex-col gap-6`}>
            <Etiquette>Les analyses</Etiquette>
            <h2 className={TITRE_SECTION}>
              {fiches.length} fiches, {fiches.length} postes du plan
            </h2>
            <Prose paragraphes={analyses?.paragraphes} />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {fiches.map((fiche) => (
                <CarteFiche
                  key={fiche.numero}
                  fiche={fiche}
                  candidat={hs.candidat}
                  score={scoreDe(fiche)}
                />
              ))}
            </div>
          </div>
        </section>

        {/* Note globale */}
        <section className={SECTION}>
          <div
            className={`${CONTENEUR} grid grid-cols-1 gap-10 rounded-2xl border border-zinc-200 bg-white p-6 sm:p-10 md:grid-cols-2 ${OMBRE_CARTE}`}
          >
            <div className="flex flex-col gap-2.5">
              <Etiquette>Score Perlimpinpin · Plan complet</Etiquette>
              <div className="flex items-baseline gap-1.5">
                <span
                  className={`text-7xl font-extrabold leading-none tracking-tighter sm:text-[5rem] ${badgeGlobal ? badgeGlobal.scoreClass : "text-zinc-300"}`}
                >
                  {badgeGlobal ? noteGlobale.score : "··"}
                </span>
                <span className="text-[22px] font-semibold text-zinc-400">/100</span>
              </div>
              {badgeGlobal ? (
                <div
                  className={`mt-1 inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-semibold ${badgeGlobal.badgeClass}`}
                >
                  {badgeGlobal.label}
                </div>
              ) : (
                <>
                  <p className="text-[15px] text-slate-500">{noteGlobale.attente}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {bandes.map((bande) => (
                      <Pastille key={bande.label} className={bande.badge}>
                        {bande.min}-{bande.max} {bande.label}
                      </Pastille>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className="flex flex-col gap-3 text-base leading-relaxed text-zinc-700">
              <h3 className="font-sans text-2xl font-extrabold tracking-tight text-zinc-950">{noteGlobale.titre}</h3>
              {noteGlobale.paragraphes.map((paragraphe) => (
                <p key={paragraphe}>{paragraphe}</p>
              ))}
            </div>
          </div>
        </section>

        {/* Méthode et sources */}
        <section id="methode" className={`${SECTION} scroll-mt-20`}>
          <div className={`${CONTENEUR} flex flex-col gap-4`}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {hs.methode.map((bloc) => (
                <div
                  key={bloc.titre}
                  className="flex flex-col gap-2.5 rounded-2xl border border-zinc-200 bg-white p-6 text-[15px] leading-relaxed text-slate-500 sm:p-7"
                >
                  <SectionHeading>{bloc.titre}</SectionHeading>
                  {bloc.paragraphes.map((paragraphe) => (
                    <p key={paragraphe}>{paragraphe}</p>
                  ))}
                </div>
              ))}
            </div>
            {hs.sources?.length ? (
              <div className="mt-2 flex flex-col gap-2">
                <Etiquette>Sources</Etiquette>
                <ul className="flex flex-col gap-1.5 text-[13px] leading-snug">
                  {hs.sources.map((source) => (
                    <li key={source.url}>
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-zinc-600 underline decoration-zinc-300 underline-offset-2 transition-colors hover:text-zinc-950"
                      >
                        {source.label} <span aria-hidden="true">↗</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </section>

        {/* Encart de don en bas du dossier. */}
        <section className={SECTION}>
          <div className={CONTENEUR}>
            <EncartDon
              titre={MESSAGE_DON_DOSSIER.titre}
              texte={MESSAGE_DON_DOSSIER.texte}
              emplacement={`dossier-${slug}`}
              format="bandeau"
              apparition
            />
          </div>
        </section>
      </main>
    </div>
  );
}
