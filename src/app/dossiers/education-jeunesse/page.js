import Header from "@/components/Header";
import { getScoreBadge } from "@/lib/score";
import { getFichesPubliees } from "@/lib/queries";
import DOSSIER from "../../../../data/hors-series/education-jeunesse.json" with { type: "json" };
import { inter, variablesCharte } from "../mouvement-social/charte";
import { Etiquette, ListeSources, OMBRE_CARTE, TitreNumerote, TuileChiffre } from "../mouvement-social/elements";
import { FaceAFace, Parcours } from "./Interactif";

// Dossier n°3 « Éducation et jeunesse » (/dossiers/education-jeunesse).
// Route dédiée (prioritaire sur /dossiers/[slug]), qui reprend la charte et
// les briques du dossier « Mouvement social ». Tout le texte vient de
// data/hors-series/education-jeunesse.json.
// Inscrit au registre (src/lib/hors-series.js) : listé sur /dossiers et dans
// le sitemap ; dans le carrousel de l'accueil seulement si
// `accueil.afficher` vaut true. Avec `visible: false`, il sort du registre et
// la page n'est plus indexée, mais reste accessible par son adresse.
// Les notes ne sont jamais écrites dans le JSON : chaque `ficheId` et chaque
// jeton {note:<ficheId>} du texte est lu en base (lecture seule, dernière
// analyse publiée) ; sans fiche publiée, la mesure affiche « Analyse à venir ».

export const metadata = {
  title: `${DOSSIER.titre} | Perlimpinpin`,
  description: DOSSIER.description,
  ...(DOSSIER.visible ? {} : { robots: { index: false, follow: false } }),
};

export const revalidate = 3600;

const SECTION = "w-full scroll-mt-20 px-6 pb-16 sm:px-8 sm:pb-20";
const CONTENEUR = "mx-auto w-full max-w-[1280px]";

function dateEnLettres(iso) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${iso.slice(0, 10)}T00:00:00Z`),
  );
}

function TitreSurligne({ titre, surligne }) {
  const position = surligne ? titre.indexOf(surligne) : -1;
  if (position === -1) return titre;
  return (
    <>
      {titre.slice(0, position)}
      <span className="bg-[linear-gradient(transparent_55%,var(--ms-jaune)_55%)] box-decoration-clone px-0.5">{surligne}</span>
      {titre.slice(position + surligne.length)}
    </>
  );
}

// Fiche publiée -> ce qu'affichent les composants (note, appréciation,
// couleurs du barème, lien vers la fiche). Valeurs simples, transmissibles
// aux composants client.
function vueFiche(fiche) {
  if (!fiche) return null;
  const badge = getScoreBadge(fiche.score);
  return {
    url: `/declarations/${fiche.propositionId}`,
    score: fiche.score,
    appreciation: badge.label,
    classeScore: badge.scoreClass,
    classeBadge: badge.badgeClass,
  };
}

// Remplace les {clés} d'un texte du JSON par leurs valeurs calculées.
function remplir(texte, valeurs) {
  return String(texte ?? "").replace(/\{(\w+)\}/g, (tout, cle) => (cle in valeurs ? String(valeurs[cle]) : tout));
}

// Jeton {note:<ficheId>} dans le texte d'analyse : la note de la dernière
// analyse publiée de cette fiche (lue en base à chaque régénération), en lien
// vers la fiche et dans la couleur du barème. Fiche non publiée ou base
// injoignable : « à venir », sans note provisoire.
const JETON_NOTE = /\{note:(\d+)\}/g;

function avecNotes(texte, fiches) {
  const morceaux = [];
  let dernier = 0;
  for (const correspondance of texte.matchAll(JETON_NOTE)) {
    morceaux.push(texte.slice(dernier, correspondance.index));
    const fiche = vueFiche(fiches[Number(correspondance[1])]);
    morceaux.push(
      fiche ? (
        <a
          key={correspondance.index}
          href={fiche.url}
          className={`whitespace-nowrap font-bold underline decoration-(--ms-jaune) decoration-2 underline-offset-4 ${fiche.classeScore}`}
        >
          {fiche.score}/100
        </a>
      ) : (
        <span key={correspondance.index} className="italic">
          à venir
        </span>
      ),
    );
    dernier = correspondance.index + correspondance[0].length;
  }
  morceaux.push(texte.slice(dernier));
  return morceaux;
}

// Pastille d'une case de la grille, selon la réponse du candidat.
function Pastille({ reponse, taille = "h-[18px] w-[18px]" }) {
  if (reponse === "traite") return <span className={`${taille} rounded-full border-[1.5px] border-(--ms-jauneFonce) bg-(--ms-jaune)`} />;
  if (reponse === "partiel")
    return (
      <span
        className={`${taille} rounded-full border-[1.5px] border-(--ms-jauneFonce) bg-[linear-gradient(90deg,var(--ms-jaune)_50%,#fff_50%)]`}
      />
    );
  if (reponse === "inverse") return <span className={`${taille} rounded-full bg-(--ms-noir)`} />;
  return <span className="h-1.5 w-1.5 rounded-full bg-(--ms-gris400)/60" />;
}

const COLONNES_GRILLE = "grid grid-cols-[minmax(240px,1fr)_repeat(11,48px)_64px]";

export default async function DossierEducationJeunessePage() {
  const { numero, etiquette, titre, titreSurligne, miseAJour, bandeauRelecture, chapo, boutons = [], charte, plan, essentiel, chiffres, grille, faceAFace, parcours, toutesLesAnalyses, methode } =
    DOSSIER;

  // Fiches publiées (lecture seule). Base injoignable : tout reste « à venir ».
  const ids = new Set();
  const noter = (m) => Number.isInteger(m.ficheId) && ids.add(m.ficheId);
  faceAFace.items.forEach((it) => it.mesures.forEach(noter));
  parcours.etapes.forEach((e) => e.phares.forEach(noter));
  toutesLesAnalyses.candidats.forEach((c) => c.mesures.forEach(noter));
  // Notes citées dans le texte d'analyse : jetons {note:<ficheId>}.
  const textesAnalyse = [...(essentiel.paragraphes ?? []), ...(essentiel.analyse ?? []).flatMap((b) => b.paragraphes)];
  for (const texte of textesAnalyse) {
    for (const [, id] of texte.matchAll(JETON_NOTE)) ids.add(Number(id));
  }
  let fiches = {};
  try {
    fiches = await getFichesPubliees([...ids]);
  } catch (erreur) {
    console.error("[dossier education-jeunesse] lecture des fiches impossible :", erreur.message);
  }
  const avecFiche = (m) => ({ ...m, fiche: vueFiche(fiches[m.ficheId]) });

  const faces = faceAFace.items.map((it) => ({
    titre: it.titre,
    chapo: it.chapo,
    qui: it.mesures.map((m) => m.candidat.split(" ").slice(1).join(" ")).join(", "),
    mesures: it.mesures.map(avecFiche),
  }));
  const etapes = parcours.etapes.map((e) => ({ ...e, phares: e.phares.map(avecFiche) }));
  const analyses = toutesLesAnalyses.candidats.map((c) => ({ ...c, mesures: c.mesures.map(avecFiche) }));

  // Grille : total par demande et par candidat, calculés depuis les réponses.
  const totalCandidat = Object.fromEntries(grille.candidats.map((n) => [n, 0]));
  const demandes = grille.demandes.map((d, i) => {
    const reponses = d.reponses ?? {};
    Object.keys(reponses).forEach((n) => (totalCandidat[n] += 1));
    return { ...d, num: String(i + 1).padStart(2, "0"), total: Object.keys(reponses).length };
  });

  // Chiffres calculés, jamais écrits en dur : remplacent les {clés} des
  // tuiles et de l'intro du parcours.
  const phares = new Set(analyses.flatMap((c) => c.mesures.map((m) => m.mesure + c.candidat))).size;
  const valeurs = {
    recensees: DOSSIER.recensees,
    retenues: parcours.etapes.reduce((somme, e) => somme + e.total, 0),
    phares,
    publiees: [...ids].filter((id) => fiches[id]).length,
    demandesTotal: grille.demandes.length,
    demandesTraitees: grille.demandes.filter((d) => !d.horsPerimetre && Object.keys(d.reponses ?? {}).length).length,
  };
  const tuiles = chiffres.items.map((item) => ({ ...item, valeur: remplir(item.valeur, valeurs), legende: remplir(item.legende, valeurs) }));
  const paragrapheAnalyse = (texte, i) => (
    <p key={i} className={i === "chapo" ? "border-l-4 border-(--ms-jaune) pl-4 font-medium text-zinc-900" : undefined}>
      {avecNotes(texte, fiches)}
    </p>
  );

  return (
    <div className="flex min-h-screen flex-col bg-(--ms-gris50) font-sans" style={variablesCharte(charte?.couleurs)}>
      <Header />

      <main className={`${inter.variable} flex w-full flex-col font-(family-name:--font-inter) text-(--ms-gris900)`}>
        {bandeauRelecture ? (
          <div className="w-full bg-(--ms-noir) px-6 py-2.5 text-center font-mono text-xs font-semibold text-(--ms-jaune) sm:px-8">
            {bandeauRelecture}
          </div>
        ) : null}

        {/* En-tête */}
        <section className="w-full px-6 pb-12 pt-12 sm:px-8 sm:pb-14 sm:pt-20">
          <div className={`${CONTENEUR} grid grid-cols-1 items-center gap-10 ${DOSSIER.photo?.src ? "lg:grid-cols-[1.08fr_1fr] lg:gap-14" : ""}`}>
            <div className="flex flex-col gap-6">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-(--ms-jaune) px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-[0.1em] text-(--ms-noir)">
                  Dossier n°{numero}
                </span>
                <Etiquette>{etiquette}</Etiquette>
              </div>
              {miseAJour?.date ? (
                <p className="w-fit max-w-full rounded-3xl border border-(--ms-jaune) bg-(--ms-jaunePale) px-3.5 py-1.5 text-[13px] leading-snug text-(--ms-gris900)">
                  <strong className="font-bold text-(--ms-noir)">
                    {miseAJour.libelle} {dateEnLettres(miseAJour.date)}
                  </strong>
                  {miseAJour.avertissement ? <> · {miseAJour.avertissement}</> : null}
                </p>
              ) : null}
              <h1 className="text-4xl font-black leading-[1.02] tracking-[-0.04em] text-(--ms-noir) sm:text-5xl xl:text-6xl">
                <TitreSurligne titre={titre} surligne={titreSurligne} />
              </h1>
              <p className="max-w-2xl text-lg leading-relaxed text-(--ms-gris600) sm:text-xl">{remplir(chapo, valeurs)}</p>
              <div className="mt-2 flex flex-wrap gap-3">
                {boutons.map((bouton, i) => (
                  <a
                    key={bouton.ancre}
                    href={bouton.ancre}
                    className={
                      i === 0
                        ? "inline-flex min-h-12 items-center gap-3 rounded-full bg-(--ms-noir) px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-(--ms-gris900)"
                        : "inline-flex min-h-12 items-center rounded-full border-2 border-(--ms-noir) bg-white px-6 py-3 text-base font-semibold text-(--ms-noir) transition-colors hover:bg-(--ms-gris50)"
                    }
                  >
                    {bouton.label}
                    {i === 0 ? (
                      <span aria-hidden="true" className="text-(--ms-jaune)">
                        →
                      </span>
                    ) : null}
                  </a>
                ))}
              </div>
            </div>
            {/* Illustration du dossier (`photo` du JSON) ; sans image, l'en-tête
                tient sur une colonne. */}
            {DOSSIER.photo?.src ? (
              <figure className="mx-auto flex w-full max-w-md flex-col gap-2 lg:max-w-[460px]">
                <div className={`relative aspect-[4/5] w-full overflow-hidden rounded-2xl bg-(--ms-jaunePale) ring-1 ring-(--ms-gris200) ${OMBRE_CARTE}`}>
                  <img src={DOSSIER.photo.src} alt={DOSSIER.photo.alt ?? ""} className="absolute inset-0 h-full w-full object-cover object-top" />
                </div>
                {DOSSIER.photo.credit ? <figcaption className="text-xs text-(--ms-gris600)">{DOSSIER.photo.credit}</figcaption> : null}
              </figure>
            ) : null}
          </div>
        </section>

        {/* Plan */}
        <section id="plan" className={SECTION}>
          <div className={`${CONTENEUR} flex flex-col gap-5 rounded-3xl bg-(--ms-grisPlan) p-6 sm:p-10`}>
            <p className="font-mono text-sm font-bold uppercase tracking-[0.1em] text-(--ms-noir)">{plan.titre}</p>
            <ol className="flex flex-col">
              {plan.items.map((item) => (
                <li key={item.ancre} className="border-b border-(--ms-gris400)/40 pb-2">
                  <a href={item.ancre} className="group flex items-center gap-3.5 pb-1 pt-3">
                    <span className="inline-flex h-8 min-w-8 flex-none items-center justify-center rounded-md bg-(--ms-jaune) px-1 font-mono text-sm font-bold text-(--ms-noir) transition-colors group-hover:bg-(--ms-noir) group-hover:text-(--ms-jaune)">
                      {item.num}
                    </span>
                    <span className="text-base font-bold leading-snug text-(--ms-noir) group-hover:underline sm:text-lg">{item.titre}</span>
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* 1. L'essentiel + chiffres */}
        <section id="essentiel" className="w-full scroll-mt-20 px-6 pb-8 sm:px-8">
          <div className={`${CONTENEUR} flex flex-col gap-5`}>
            <TitreNumerote num={essentiel.num}>{essentiel.titre}</TitreNumerote>
            <div className="flex max-w-3xl flex-col gap-5 text-lg leading-relaxed text-(--ms-gris900)">
              {(essentiel.paragraphes ?? []).map((texte, i) => paragrapheAnalyse(texte, i === 0 ? "chapo" : i))}
            </div>
            {/* Analyse par grand sujet : intertitre puis paragraphes (`essentiel.analyse` du JSON). */}
            {(essentiel.analyse ?? []).map((bloc) => (
              <div key={bloc.intertitre} className="flex max-w-3xl flex-col gap-3 pt-2">
                <h3 className="flex items-center gap-2.5 text-xl font-extrabold leading-snug tracking-[-0.02em] text-(--ms-noir) sm:text-2xl">
                  <span aria-hidden="true" className="h-2.5 w-2.5 flex-none bg-(--ms-jaune)" />
                  {bloc.intertitre}
                </h3>
                <div className="flex flex-col gap-5 text-lg leading-relaxed text-zinc-700">
                  {bloc.paragraphes.map((texte, i) => paragrapheAnalyse(texte, i))}
                </div>
              </div>
            ))}
            {essentiel.conclusion ? (
              <p className="max-w-3xl rounded-2xl bg-(--ms-jaunePale) px-5 py-4 text-base leading-relaxed text-(--ms-gris900)">
                {essentiel.conclusion}
              </p>
            ) : null}
            <ListeSources sources={DOSSIER.sources} className="max-w-3xl" />
          </div>
        </section>
        <section className={SECTION}>
          <div className={`${CONTENEUR} flex flex-col gap-4`}>
            <Etiquette>{chiffres.titre}</Etiquette>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {tuiles.map((item) => (
                <TuileChiffre key={item.legende} item={item} />
              ))}
            </div>
          </div>
        </section>

        {/* 2. La grille des demandes */}
        <section id="grille" className={SECTION}>
          <div className={`${CONTENEUR} flex flex-col gap-5`}>
            <TitreNumerote num={grille.num}>{grille.titre}</TitreNumerote>
            <p className="max-w-3xl text-lg leading-relaxed text-zinc-700">{grille.intro}</p>
            <div className="flex min-w-0 flex-col gap-5 rounded-3xl border border-(--ms-gris200) bg-white p-5 sm:p-7">
              <div className="relative w-full min-w-0 overflow-x-auto">
                <table className="w-full min-w-[880px] border-collapse">
                  <caption className="sr-only">Demandes des lycéens et des étudiants du 5 octobre, par candidat</caption>
                  <thead>
                    <tr className={`${COLONNES_GRILLE} items-end border-b-2 border-(--ms-noir) pb-2.5`}>
                      <th scope="col" className="text-left font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-(--ms-gris600)">
                        Demande du 5 octobre
                      </th>
                      {grille.candidats.map((nom) => (
                        <th key={nom} scope="col" className="flex h-24 items-end justify-center">
                          <span className="whitespace-nowrap text-[13px] font-semibold text-(--ms-gris900) [transform:rotate(180deg)] [writing-mode:vertical-rl]">
                            {nom}
                          </span>
                        </th>
                      ))}
                      <th scope="col" className="text-center font-mono text-[11px] font-semibold uppercase text-(--ms-gris600)">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {demandes.map((d) => (
                      <tr key={d.num} className={`${COLONNES_GRILLE} min-h-12 items-center border-b border-(--ms-grisPlan)`}>
                        <th scope="row" className="flex items-baseline gap-2.5 py-2 pr-3 text-left font-normal">
                          <span className="font-mono text-xs font-bold text-(--ms-jauneFonce)">{d.num}</span>
                          <span className="flex flex-col gap-0.5">
                            <span className="text-sm font-semibold leading-snug text-(--ms-gris900)">{d.label}</span>
                            {d.note ? <span className="text-xs leading-snug text-(--ms-gris600)">{d.note}</span> : null}
                          </span>
                        </th>
                        {d.horsPerimetre ? (
                          <>
                            <td className="col-span-11 rounded-lg border border-dashed border-(--ms-gris400) bg-(--ms-gris50) px-3 py-2 text-center text-[13px] text-(--ms-gris600)">
                              {d.horsPerimetre.texte}{" "}
                              <a href={d.horsPerimetre.lien.url} className="font-semibold text-(--ms-noir) underline decoration-(--ms-jaune) decoration-2 underline-offset-2">
                                {d.horsPerimetre.lien.label}
                              </a>
                            </td>
                            <td className="text-center text-sm text-(--ms-gris400)">–</td>
                          </>
                        ) : (
                          <>
                            {grille.candidats.map((nom) => {
                              const reponse = d.reponses?.[nom];
                              return (
                                <td key={nom} className="flex h-10 items-center justify-center">
                                  <Pastille reponse={reponse} />
                                  <span className="sr-only">{`${nom} : ${grille.legende[reponse ?? "rien"]}`}</span>
                                </td>
                              );
                            })}
                            <td className={`text-center text-sm font-bold ${d.total ? "text-(--ms-noir)" : "text-orange-700"}`}>
                              {d.total || "Aucun"}
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className={`${COLONNES_GRILLE} items-center pt-2.5`}>
                      <th scope="row" className="text-left font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-(--ms-gris600)">
                        Demandes traitées
                      </th>
                      {grille.candidats.map((nom) => (
                        <td key={nom} className="text-center text-[15px] font-extrabold text-(--ms-noir)">
                          {totalCandidat[nom]}
                        </td>
                      ))}
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
              <ul className="flex flex-wrap gap-x-6 gap-y-2 border-t border-(--ms-grisPlan) pt-4 text-[13px] text-(--ms-gris900)">
                {["traite", "partiel", "inverse", "rien"].map((cle) => (
                  <li key={cle} className="flex items-center gap-2">
                    <span className="inline-flex w-[18px] justify-center">
                      <Pastille reponse={cle} taille="h-3.5 w-3.5" />
                    </span>
                    {grille.legende[cle]}
                  </li>
                ))}
              </ul>
              <p className="rounded-xl bg-(--ms-jaunePale) px-4 py-3.5 text-sm leading-relaxed text-(--ms-gris900)">{grille.encadre}</p>
            </div>
          </div>
        </section>

        {/* 3. Face-à-face */}
        <section id="face-a-face" className={SECTION}>
          <div className={`${CONTENEUR} flex flex-col gap-5`}>
            <TitreNumerote num={faceAFace.num}>{faceAFace.titre}</TitreNumerote>
            <p className="max-w-3xl text-lg leading-relaxed text-zinc-700">{faceAFace.intro}</p>
            <FaceAFace items={faces} />
          </div>
        </section>

        {/* 4. Le parcours */}
        <section id="parcours" className={SECTION}>
          <div className={`${CONTENEUR} flex flex-col gap-5`}>
            <TitreNumerote num={parcours.num}>{parcours.titre}</TitreNumerote>
            <p className="max-w-3xl text-lg leading-relaxed text-zinc-700">{remplir(parcours.intro, valeurs)}</p>
            <Parcours etapes={etapes} etapeParDefaut={parcours.etapeParDefaut} libelleNonAnalysee={parcours.libelleNonAnalysee} />
          </div>
        </section>

        {/* Toutes les analyses */}
        <section id="analyses" className={SECTION}>
          <div className={`${CONTENEUR} flex flex-col gap-5`}>
            <h2 className="text-2xl font-extrabold tracking-[-0.03em] text-(--ms-noir) sm:text-3xl">{toutesLesAnalyses.titre}</h2>
            <p className="max-w-3xl text-lg leading-relaxed text-zinc-700">{toutesLesAnalyses.texte}</p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {analyses.map((c) => (
                <article key={c.candidat} className="flex flex-col gap-3 rounded-2xl border border-(--ms-gris200) bg-white p-5">
                  <div className="flex items-baseline gap-2">
                    <span className="text-lg font-extrabold text-(--ms-noir)">{c.candidat}</span>
                    <span className="text-xs text-(--ms-gris600)">{c.parti}</span>
                  </div>
                  {c.mesures.map((m) => (
                    <div key={m.mesure} className="flex items-center justify-between gap-3">
                      {m.fiche ? (
                        <a href={m.fiche.url} className="text-sm font-semibold leading-snug text-(--ms-gris900) underline decoration-(--ms-jaune) decoration-2 underline-offset-4">
                          {m.mesure}
                        </a>
                      ) : (
                        <span className="text-sm font-semibold leading-snug text-(--ms-gris900)">{m.mesure}</span>
                      )}
                      {m.fiche ? (
                        <span className="flex flex-none items-center gap-1.5">
                          <span className={`text-[15px] font-extrabold ${m.fiche.classeScore}`}>{m.fiche.score}/100</span>
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${m.fiche.classeBadge}`}>{m.fiche.appreciation}</span>
                        </span>
                      ) : (
                        <span className="flex-none rounded-full border border-dashed border-(--ms-gris400) px-2.5 py-0.5 text-[11px] font-semibold text-(--ms-gris600)">
                          À venir
                        </span>
                      )}
                    </div>
                  ))}
                  {c.vide ? <p className="text-sm leading-relaxed text-(--ms-gris600)">{c.vide}</p> : null}
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* 5. Méthode */}
        <section id="methode" className={SECTION}>
          <div className={`${CONTENEUR} flex flex-col gap-5`}>
            <TitreNumerote num={methode.num}>{methode.titre}</TitreNumerote>
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <div className="flex flex-col gap-4 rounded-3xl border border-(--ms-gris200) bg-white p-6">
                <h3 className="text-lg font-extrabold text-(--ms-noir)">{methode.criteresTitre}</h3>
                <ol className="flex flex-col gap-2">
                  {methode.entonnoir.map((etage, i) => (
                    <li
                      key={etage.texte}
                      style={{ marginLeft: `${i * 8}%` }}
                      className={`rounded-lg px-3.5 py-2.5 text-sm ${
                        i === 0 ? "bg-(--ms-grisPlan)" : i === 1 ? "border border-(--ms-jaune) bg-(--ms-jaunePale)" : "bg-(--ms-jaune)"
                      }`}
                    >
                      <strong className="text-lg">{etage.valeur}</strong> {etage.texte}
                    </li>
                  ))}
                </ol>
                <ol className="ml-5 flex list-decimal flex-col gap-1.5 text-sm leading-relaxed text-zinc-700">
                  {methode.criteres.map((critere) => (
                    <li key={critere}>{critere}</li>
                  ))}
                </ol>
              </div>
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-2.5 rounded-3xl bg-(--ms-jaunePale) p-6">
                  <h3 className="text-lg font-extrabold text-(--ms-noir)">{methode.absencesTitre}</h3>
                  {methode.absences.map((a) => (
                    <p key={a.candidat} className="text-sm leading-relaxed text-zinc-700">
                      <strong className="text-(--ms-noir)">{a.candidat}</strong> {a.texte}
                    </p>
                  ))}
                </div>
                <div className="flex flex-col gap-2.5 rounded-3xl border border-(--ms-gris200) bg-white p-6">
                  <h3 className="text-lg font-extrabold text-(--ms-noir)">{methode.limitesTitre}</h3>
                  <p className="text-sm leading-relaxed text-zinc-700">{methode.limites}</p>
                  <a href={methode.lienMethode.url} className="w-fit text-sm font-semibold text-(--ms-noir) underline decoration-(--ms-jaune) decoration-2 underline-offset-4">
                    {methode.lienMethode.label} <span aria-hidden="true">→</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <a
        href="#plan"
        className="fixed bottom-5 right-5 z-30 inline-flex items-center gap-1.5 rounded-full bg-(--ms-noir) px-4 py-2.5 font-mono text-sm font-bold text-(--ms-jaune) shadow-lg transition-transform hover:-translate-y-0.5"
      >
        <span aria-hidden="true">↑</span> Plan
      </a>
    </div>
  );
}
