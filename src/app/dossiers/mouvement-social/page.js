import { Fragment } from "react";
import Header from "@/components/Header";
import { getScoreBadge, getScoreBands } from "@/lib/score";
import { criteresPrincipaux, OPERATIONNALITE } from "@/lib/criteresScore";
import { getFichesPubliees } from "@/lib/queries";
import { compterParCandidat, mesuresParCandidat, partsLeviers } from "@/lib/releve-securite";
import DOSSIER_MS from "../../../../data/hors-series/mouvement-social.json" with { type: "json" };
import INVENTAIRE from "../../../../data/hors-series/inventaire-prises-de-parole.json" with { type: "json" };
import OngletsPropositions from "./OngletsPropositions";
import TriangleLeviers from "./TriangleLeviers";
import { Bloc, SectionComprendre, SyntheseNiveaux } from "./BlocsComprendre";
import { COULEURS_ORIENTATION } from "./couleurs-orientation";
import { couleurStatut } from "./statuts";
import { inter, variablesCharte } from "./charte";
import { Etiquette, LienSource, OMBRE_CARTE, Pastille, Prose, TitreNumerote, TuileChiffre } from "./elements";

// Dossier n°2 « Mouvement social » (/dossiers/mouvement-social) : la crise
// d'octobre 2026 et les propositions des candidats sur la sécurité. Son JSON
// n'a pas la structure de celui du plan budgétaire RN, d'où cette route dédiée
// (prioritaire sur /dossiers/[slug]), avec sa propre charte (charte.js). Tout
// le texte vient de data/hors-series/mouvement-social.json.
// Calculé, jamais écrit en dur :
//   - le triangle, la tuile « mesures relevées » et le relevé complet, à partir
//     de inventaire-prises-de-parole.json (src/lib/releve-securite.js) ;
//   - les notes des propositions et « Toutes les analyses », lues en base
//     (lecture seule) dans la dernière analyse publiée de chaque `ficheId`
//     (getFichesPubliees) : une fiche publiée apparaît seule à la
//     régénération suivante, sans toucher au JSON.
// Inscrit dans le registre (src/lib/hors-series.js) : listé sur /dossiers,
// dans le carrousel de l'accueil et le sitemap. Avec `visible: false`, il en
// sort et la page n'est plus indexée, mais reste accessible par son adresse.

export const metadata = {
  title: `${DOSSIER_MS.titre} | Perlimpinpin`,
  description: DOSSIER_MS.chapo,
  ...(DOSSIER_MS.visible ? {} : { robots: { index: false, follow: false } }),
};

// Page régénérée toutes les heures : fiches publiées entre-temps et dates
// « à venir » passées.
export const revalidate = 3600;

// Ordre des sections si le JSON n'en donne pas.
const ORDRE_PAR_DEFAUT = [
  "entete",
  "plan",
  "essentiel",
  "chiffres",
  "triangle",
  "propositions",
  "toutesLesAnalyses",
  "comprendre",
  "reponses",
  "pourAllerPlusLoin",
  "annexes",
  "methode",
  "releve",
  "sources",
];

const SECTION = "w-full px-6 pb-16 sm:px-8 sm:pb-20";
const CONTENEUR = "mx-auto w-full max-w-[1280px]";
const LIEN_INTERNE = "font-semibold text-(--ms-noir) underline decoration-(--ms-jaune) decoration-2 underline-offset-4";

// Date ISO (« 2026-10-22 ») en toutes lettres : « 22 octobre 2026 ».
function dateEnLettres(iso) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${iso.slice(0, 10)}T00:00:00Z`),
  );
}

// Remplace les {clés} d'un texte du JSON par leurs valeurs calculées.
function remplir(texte, valeurs) {
  return (texte ?? "").replace(/\{(\w+)\}/g, (tout, cle) => (cle in valeurs ? String(valeurs[cle]) : tout));
}

// Résumé de fiche sans le gras Markdown (**…**) de l'analyse.
const sansMarkdown = (texte) => (texte ?? "").replace(/\*\*|__/g, "").trim();

// Titre principal : la partie `surligne` (titreSurligne du JSON) est
// surlignée en jaune, comme au marqueur (bande sur la moitié basse du texte).
// Absente du titre : le titre s'affiche sans surlignage.
function TitreSurligne({ titre, surligne }) {
  const position = surligne ? titre.indexOf(surligne) : -1;
  if (position === -1) return titre;
  return (
    <>
      {titre.slice(0, position)}
      <span className="bg-[linear-gradient(transparent_55%,var(--ms-jaune)_55%)] box-decoration-clone px-0.5">
        {surligne}
      </span>
      {titre.slice(position + surligne.length)}
    </>
  );
}

// « Relevé mis à jour le 22 octobre 2026 » (libellé du JSON, date du relevé).
function MiseAJour({ libelle, date, className = "" }) {
  if (!libelle || !date) return null;
  return (
    <p className={`font-mono text-xs text-(--ms-gris600) ${className}`}>
      {libelle} {dateEnLettres(date)}
    </p>
  );
}

// En-tête des grandes parties (« Comprendre », « Réponses ») : filet noir,
// surtitre en mono précédé d'un carré jaune, titre très gras, intro.
function EnTetePartie({ surtitre, num, titre, intro }) {
  return (
    <div className="flex flex-col gap-4 border-t-2 border-(--ms-noir) pt-7">
      {surtitre ? (
        <span className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-[0.1em] text-(--ms-noir)">
          <span aria-hidden="true" className="h-2.5 w-2.5 bg-(--ms-jaune)" />
          {surtitre.replace(/^\/\/\s*/, "")}
        </span>
      ) : null}
      <h2 className="flex max-w-4xl items-start gap-4 text-4xl font-black leading-[1.05] tracking-[-0.04em] text-(--ms-noir) sm:text-5xl">
        {num ? (
          <span className="mt-1 inline-flex h-10 min-w-10 flex-none items-center justify-center rounded-md bg-(--ms-jaune) px-1.5 font-mono text-lg font-bold tracking-normal text-(--ms-noir) sm:mt-2">
            {num}
          </span>
        ) : null}
        <span>{titre}</span>
      </h2>
      {intro ? <p className="max-w-3xl text-lg leading-relaxed text-(--ms-gris600) sm:text-xl">{intro}</p> : null}
    </div>
  );
}

// Une mesure du relevé : date, support, mesure, levier, source. Les mesures
// non retenues sont grisées, avec le motif de leur exclusion.
function MesureReleve({ mesure, libelleNonRetenue }) {
  const retenue = mesure.retenue;
  return (
    <li className={`flex flex-col gap-1.5 border-t border-(--ms-gris200) py-3.5 first:border-t-0 ${retenue ? "" : "text-(--ms-gris400)"}`}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <span className={`font-mono font-semibold ${retenue ? "text-(--ms-noir)" : ""}`}>{mesure.dateAffichee}</span>
        {mesure.support ? <span className={retenue ? "text-(--ms-gris600)" : ""}>· {mesure.support}</span> : null}
        {mesure.levier ? (
          <Pastille className={retenue ? "bg-(--ms-gris200) text-(--ms-gris900)" : "bg-(--ms-gris50) text-(--ms-gris400)"}>
            Levier {mesure.levier}
          </Pastille>
        ) : null}
        {!retenue ? <Pastille className="bg-(--ms-gris200) text-(--ms-gris600)">{libelleNonRetenue}</Pastille> : null}
      </div>
      <p className={`text-[15px] leading-snug ${retenue ? "text-(--ms-gris900)" : ""}`}>{mesure.mesure}</p>
      {mesure.quiParle && mesure.quiParle !== mesure.candidat ? <p className="text-xs italic">par {mesure.quiParle}</p> : null}
      {!retenue && mesure.motifNonRetenue ? <p className="text-xs">{mesure.motifNonRetenue}</p> : null}
      <LienSource source={mesure.url ? { label: "Source", url: mesure.url } : null} prefixe="" className="w-fit" />
    </li>
  );
}

// Fiche publiée -> données d'affichage (note, appréciation et ses couleurs,
// résumé, notes par critère, conclusion, lien). Les notes par critère ne sont
// affichées que pour le barème actuel (5 critères), seul utilisé par les
// fiches du dossier.
function vueFiche(fiche) {
  if (!fiche) return null;
  const badge = getScoreBadge(fiche.score);
  const notation = fiche.notation ?? {};
  const criteres =
    notation[OPERATIONNALITE.key] != null
      ? criteresPrincipaux(notation)
          .filter((c) => c.note != null)
          .map(({ label, note, max }) => ({ label, note, max }))
      : [];
  return {
    url: `/declarations/${fiche.propositionId}`,
    score: fiche.score,
    appreciation: badge.label,
    classeScore: badge.scoreClass,
    classeBadge: badge.badgeClass,
    resume: sansMarkdown(fiche.resume) || null,
    criteres,
    conclusion: fiche.conclusion,
  };
}

// Regroupe des éléments par candidat (`candidat` du JSON), dans l'ordre
// alphabétique du nom de famille (`nomTri`).
function grouperParCandidat(elements, partiDe) {
  const groupes = new Map();
  for (const element of elements) {
    if (!groupes.has(element.candidat)) {
      groupes.set(element.candidat, {
        candidat: element.candidat,
        nomTri: element.nomTri ?? element.candidat,
        parti: partiDe(element),
        elements: [],
      });
    }
    groupes.get(element.candidat).elements.push(element);
  }
  return [...groupes.values()].sort((a, b) => a.nomTri.localeCompare(b.nomTri, "fr"));
}

export default async function DossierMouvementSocialPage() {
  const {
    numero,
    etiquette,
    titre,
    titreSurligne,
    miseAJour,
    charte,
    chapo,
    boutons = [],
    photo,
    ordreSections,
    plan,
    essentiel,
    chiffres,
    triangle,
    comprendre,
    reponses,
    perimetre,
    statuts,
    onglets = [],
    messageOngletVide,
    propositions = [],
    textesEnCours,
    toutesLesAnalyses,
    pourAllerPlusLoin,
    annexes,
    releve,
    methode,
    sources = [],
  } = DOSSIER_MS;

  // Relevé des prises de parole : comptes par candidat (triangle, tuile
  // calculée) et mesures groupées par candidat (relevé complet).
  const candidatsTriangle = compterParCandidat(INVENTAIRE).map((c) => ({ ...c, parts: partsLeviers(c) }));
  const triangleVide = !candidatsTriangle.some((c) => c.parts);
  const releveParCandidat = mesuresParCandidat(INVENTAIRE);
  const mesuresRetenues = INVENTAIRE.mesures.filter((m) => m.retenue);
  const calculs = {
    mesuresRetenues: {
      valeur: mesuresRetenues.length,
      candidats: new Set(mesuresRetenues.map((m) => m.candidat)).size,
    },
  };
  const tuiles = (chiffres?.items ?? []).map((item) => {
    const calcul = calculs[item.calcul];
    if (!calcul) return item;
    return { ...item, valeur: String(calcul.valeur), legende: remplir(item.calculLegende ?? item.legende, calcul) };
  });

  // Fiches publiées des propositions (lecture seule en base). Base
  // injoignable : toutes les propositions restent « Analyse à venir ».
  const idsFiches = [...new Set(propositions.map((p) => p.ficheId).filter(Number.isInteger))];
  let fiches = {};
  try {
    fiches = await getFichesPubliees(idsFiches);
  } catch (erreur) {
    console.error("[dossier mouvement-social] lecture des fiches impossible :", erreur.message);
  }
  const statutDe = (id) => {
    const statut = statuts?.items?.find((s) => s.id === id);
    return statut ? { label: statut.label, classe: couleurStatut(id) } : null;
  };
  const propositionsVues = propositions.map((p) => ({
    id: p.id,
    candidat: p.candidat,
    nomTri: p.nomTri,
    parti: p.parti,
    onglet: p.onglet,
    intitule: p.intitule,
    description: p.description,
    statut: statutDe(p.statut),
    dateAffichee: dateEnLettres(p.date),
    source: p.source,
    fiche: vueFiche(fiches[p.ficheId]),
  }));
  const groupesParOnglet = Object.fromEntries(
    onglets.map((o) => [
      o.id,
      grouperParCandidat(
        propositionsVues.filter((p) => p.onglet === o.id),
        (p) => p.parti,
      ).map(({ candidat, parti, elements }) => ({ candidat, parti, propositions: elements })),
    ]),
  );
  const analysesParCandidat = grouperParCandidat(
    propositionsVues.filter((p) => p.fiche),
    (p) => p.parti,
  );
  const publiees = new Set(propositions.filter((p) => fiches[p.ficheId]).map((p) => p.ficheId)).size;

  // Barème du plus bas au plus haut (0-19 Irréaliste … 85-100 Exemplaire).
  const bandes = getScoreBands().slice().reverse();

  // Chaque section de la page, affichées dans l'ordre de `ordreSections` du
  // JSON. « Ce que couvre ce dossier » et « Des textes déjà en discussion »
  // sont affichés dans la partie « Réponses » : leurs entrées séparées de
  // `ordreSections` n'affichent rien, pour ne pas les répéter.
  const sections = {
    entete: (
      <section className="w-full px-6 pb-12 pt-12 sm:px-8 sm:pb-14 sm:pt-20">
        <div className={`${CONTENEUR} grid grid-cols-1 items-center gap-10 lg:grid-cols-[1.08fr_1fr] lg:gap-14`}>
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-(--ms-jaune) px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-[0.1em] text-(--ms-noir)">
                Dossier n°{numero}
              </span>
              <Etiquette>{etiquette}</Etiquette>
            </div>
            {/* Date de mise à jour (`miseAJour` du JSON), en toutes lettres,
                puis l'avertissement ; rien si le champ est absent. */}
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
            <p className="max-w-2xl text-lg leading-relaxed text-(--ms-gris600) sm:text-xl">{chapo}</p>
            {boutons.length ? (
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
            ) : null}
          </div>
          <figure className="mx-auto flex w-full max-w-md flex-col gap-2 lg:max-w-[460px]">
            {photo?.src ? (
              <>
                <div className={`relative aspect-[4/5] w-full overflow-hidden rounded-2xl ring-1 ring-(--ms-gris200) bg-(--ms-jaunePale) ${OMBRE_CARTE}`}>
                  <img src={photo.src} alt={photo.alt ?? ""} className="absolute inset-0 h-full w-full object-cover object-top" />
                </div>
                {photo.credit ? <figcaption className="text-xs text-(--ms-gris600)">{photo.credit}</figcaption> : null}
              </>
            ) : (
              <div aria-hidden="true" className="aspect-[4/5] w-full rounded-2xl border-2 border-dashed border-(--ms-jaune) bg-(--ms-jaunePale)" />
            )}
          </figure>
        </div>
      </section>
    ),

    // Plan de lecture : chaque entrée mène à sa partie (mêmes numéros que les
    // titres) ; sous certaines entrées, les sous-liens (`sousItems`), avec
    // leur numéro s'il y en a un.
    plan: plan?.items?.length ? (
      <section id="plan" className={`${SECTION} scroll-mt-20`}>
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
                {item.sousItems?.length ? (
                  <ul className="mb-1.5 mt-1 flex flex-col gap-2 sm:ml-[46px] sm:flex-row sm:flex-wrap sm:gap-x-6">
                    {item.sousItems.map((sous) => (
                      <li key={sous.ancre}>
                        <a
                          href={sous.ancre}
                          className="text-[14.5px] font-medium text-(--ms-gris900) underline decoration-(--ms-gris400) underline-offset-4 hover:text-(--ms-noir) hover:decoration-(--ms-noir)"
                        >
                          {sous.num ? <span className="mr-1.5 font-mono text-xs font-bold text-(--ms-gris600)">{sous.num}</span> : null}
                          {sous.titre}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      </section>
    ) : null,

    essentiel: essentiel ? (
      <section id={essentiel.id ?? "essentiel"} className="w-full scroll-mt-20 px-6 pb-8 sm:px-8">
        <div className={`${CONTENEUR} flex flex-col gap-5`}>
          <TitreNumerote num={essentiel.num}>{essentiel.titre}</TitreNumerote>
          <Prose paragraphes={essentiel.paragraphes} chapo className="text-(--ms-gris900)" />
        </div>
      </section>
    ) : null,

    // Les tuiles, juste sous « L'essentiel ».
    chiffres: tuiles.length ? (
      <section className={SECTION}>
        <div className={`${CONTENEUR} flex flex-col gap-4`}>
          <Etiquette>{chiffres.titre}</Etiquette>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {tuiles.map((item) => (
              <TuileChiffre key={item.legende} item={item} />
            ))}
          </div>
          {chiffres.note ? <p className="text-[13px] text-(--ms-gris600)">{chiffres.note}</p> : null}
        </div>
      </section>
    ) : null,

    // Où se situent les candidats ? : triangle des leviers, calculé à partir
    // du relevé, puis l'avertissement et l'état des analyses.
    triangle: triangle ? (
      <section id="triangle" className={`${SECTION} scroll-mt-20`}>
        <div className={`${CONTENEUR} flex flex-col gap-5`}>
          <TitreNumerote num={triangle.num}>{triangle.titre}</TitreNumerote>
          <Prose paragraphes={[triangle.texte, triangle.texteCouleur].filter(Boolean)} className="text-(--ms-gris900)" />
          <div className="rounded-2xl border border-(--ms-gris200) bg-white p-4 sm:p-8">
            {triangleVide ? (
              <p className="rounded-xl border border-dashed border-(--ms-gris400) bg-(--ms-gris50) px-5 py-4 text-[15px] leading-relaxed text-(--ms-gris600)">
                {triangle.messageVide}
              </p>
            ) : (
              <TriangleLeviers candidats={candidatsTriangle} onglets={onglets} legende={triangle.legende ?? []} />
            )}
            <div className="mt-6 flex flex-col gap-4 border-t border-(--ms-gris200) pt-5">
              <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-(--ms-gris900)">
                {triangle.legende?.map((item) => (
                  <li key={item.id} className="flex items-center gap-2">
                    <span aria-hidden="true" className={`h-3.5 w-3.5 flex-none rounded-full ${COULEURS_ORIENTATION[item.id] ?? ""}`} />
                    {item.label}
                  </li>
                ))}
              </ul>
              {triangle.avertissement ? (
                <p className="max-w-4xl rounded-r-xl border-l-4 border-(--ms-jaune) bg-(--ms-jaunePale) px-5 py-3.5 text-[15px] leading-relaxed text-(--ms-gris900)">
                  {triangle.avertissement}
                </p>
              ) : null}
              {triangle.statutAnalyses?.texte ? (
                <p className="font-mono text-xs font-semibold uppercase tracking-[0.06em] text-(--ms-noir)">
                  {remplir(triangle.statutAnalyses.texte, { publiees, enRelecture: triangle.statutAnalyses.enRelecture ?? 0 })}
                </p>
              ) : null}
              {triangle.regle ? <p className="max-w-4xl text-[14px] leading-relaxed text-(--ms-gris600)">{triangle.regle}</p> : null}
              {triangle.note ? <p className="max-w-4xl text-[14px] leading-relaxed text-(--ms-gris600)">{triangle.note}</p> : null}
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <MiseAJour libelle={releve?.libelleMaj} date={INVENTAIRE.dateReleve} />
                {triangle.lienReleve ? (
                  <a href={triangle.lienReleve.ancre} className={`text-sm ${LIEN_INTERNE}`}>
                    {triangle.lienReleve.label} <span aria-hidden="true">↓</span>
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>
    ) : null,

    // Comprendre la crise : en-tête, tableau des niveaux de preuve, sections.
    comprendre: comprendre ? (
      <section id={comprendre.id ?? "comprendre"} className={`${SECTION} scroll-mt-20`}>
        <div className={`${CONTENEUR} flex flex-col gap-14`}>
          <EnTetePartie surtitre={comprendre.surtitre} num={comprendre.num} titre={comprendre.titre} intro={comprendre.intro} />
          <SyntheseNiveaux synthese={comprendre.synthese} />
          {comprendre.sections?.map((section) => (
            <SectionComprendre key={section.id} section={section} />
          ))}
        </div>
      </section>
    ) : null,

    // Réponses : ce qu'a fait le gouvernement, les blocs de `reponses.blocs`
    // (moteur de blocs ; un bloc avec `id` sert d'ancre, ex. #casseurs-payeurs),
    // les textes en discussion. Avec `affichage: "sousSection"`, présentée
    // comme une sous-partie de « Comprendre » (titre numéroté, sans en-tête de
    // partie).
    reponses: reponses ? (
      <section id={reponses.id ?? "reponses"} className={`${SECTION} scroll-mt-24`}>
        <div className={`${CONTENEUR} flex flex-col ${reponses.affichage === "sousSection" ? "gap-6" : "gap-10"}`}>
          {reponses.affichage === "sousSection" ? (
            <TitreNumerote num={reponses.num} as="h3">
              {reponses.titre}
            </TitreNumerote>
          ) : (
            <EnTetePartie surtitre={reponses.surtitre} num={reponses.num} titre={reponses.titre} />
          )}
          {reponses.gouvernement?.items?.length ? (
            <div className="flex flex-col gap-4">
              <h3 className="text-xl font-extrabold tracking-[-0.02em] text-(--ms-noir) sm:text-2xl">{reponses.gouvernement.titre}</h3>
              <ul className="flex max-w-4xl list-disc flex-col gap-2.5 pl-5 text-[17px] leading-relaxed text-(--ms-gris900)">
                {reponses.gouvernement.items.map((item) => (
                  <li key={item.texte}>
                    {item.texte} <LienSource source={item.source} prefixe="" className="whitespace-nowrap" />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {reponses.blocs?.map((bloc, i) => (
            <div key={bloc.id ?? i} id={bloc.id} className={bloc.id ? "scroll-mt-24" : undefined}>
              <Bloc bloc={bloc} />
            </div>
          ))}
          {textesEnCours?.items?.length ? (
            <div className="flex max-w-4xl flex-col gap-4 rounded-2xl border border-(--ms-gris200) bg-white px-6 py-5 sm:px-7 sm:py-6">
              <h3 className="text-xl font-extrabold tracking-[-0.02em] text-(--ms-noir)">{textesEnCours.titre}</h3>
              <ul className="flex list-disc flex-col gap-3 pl-5 text-base leading-relaxed text-(--ms-gris900)">
                {textesEnCours.items.map((item) => (
                  <li key={item.texte}>
                    {item.texte} <LienSource source={item.source} prefixe="" className="whitespace-nowrap" />
                  </li>
                ))}
              </ul>
              {textesEnCours.note ? <p className="text-[13px] text-(--ms-gris600)">{textesEnCours.note}</p> : null}
            </div>
          ) : null}
        </div>
      </section>
    ) : null,
    // Affichés dans « Les propositions » (périmètre, juste avant les onglets) et
    // dans « Réponses » (textes en discussion) : leurs entrées séparées de
    // `ordreSections` n'affichent rien, pour ne pas les répéter.
    perimetre: null,
    textesEnCours: null,

    // Les propositions analysées : introduction, périmètre du dossier, puis un
    // onglet par levier.
    propositions: (
      <section id="propositions" className={`${SECTION} scroll-mt-20`}>
        <div className={`${CONTENEUR} flex flex-col gap-5`}>
          {reponses?.titrePropositions ? (
            <TitreNumerote num={reponses.numPropositions}>{reponses.titrePropositions}</TitreNumerote>
          ) : null}
          <Prose paragraphes={[reponses?.intro, statuts?.texte].filter(Boolean)} className="text-(--ms-gris900)" />
          {perimetre ? (
            <div className="flex max-w-4xl flex-col gap-2.5 rounded-r-2xl border-l-4 border-(--ms-jaune) bg-(--ms-jaunePale) px-6 py-5 sm:px-7 sm:py-6">
              <h3 className="text-lg font-extrabold tracking-[-0.02em] text-(--ms-noir)">{perimetre.titre}</h3>
              <p className="text-base leading-relaxed text-(--ms-gris900)">{perimetre.texte}</p>
            </div>
          ) : null}
          <OngletsPropositions onglets={onglets} groupesParOnglet={groupesParOnglet} messageOngletVide={messageOngletVide} />
        </div>
      </section>
    ),

    // Toutes les analyses du dossier : fiches publiées en base, par candidat.
    toutesLesAnalyses: toutesLesAnalyses ? (
      <section id="analyses" className={`${SECTION} scroll-mt-20`}>
        <div className={`${CONTENEUR} flex flex-col gap-5`}>
          <h2 className="text-2xl font-extrabold tracking-[-0.03em] text-(--ms-noir) sm:text-3xl">{toutesLesAnalyses.titre}</h2>
          <p className="max-w-3xl text-lg leading-relaxed text-(--ms-gris900)">{toutesLesAnalyses.texte}</p>
          {analysesParCandidat.length ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {analysesParCandidat.map((groupe) => (
                <div key={groupe.candidat} className="flex flex-col gap-3 rounded-2xl border border-(--ms-gris200) bg-white p-5 sm:p-6">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <p className="text-lg font-extrabold text-(--ms-noir)">{groupe.candidat}</p>
                    {groupe.parti ? <p className="text-sm text-(--ms-gris600)">{groupe.parti}</p> : null}
                  </div>
                  <ul className="flex flex-col divide-y divide-(--ms-gris200)">
                    {groupe.elements.map((p) => (
                      <li key={p.id}>
                        <a href={p.fiche.url} className="group flex items-center justify-between gap-4 py-2.5">
                          <span className="text-[15px] font-semibold leading-snug text-(--ms-noir) group-hover:underline">{p.intitule}</span>
                          <span className="flex flex-none items-center gap-2">
                            <span className={`font-black ${p.fiche.classeScore}`}>{p.fiche.score}/100</span>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${p.fiche.classeBadge}`}>{p.fiche.appreciation}</span>
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <p className="max-w-3xl rounded-2xl border border-dashed border-(--ms-gris400) bg-white/60 px-6 py-5 text-[15px] leading-relaxed text-(--ms-gris600)">
              {toutesLesAnalyses.messageVide}
            </p>
          )}
        </div>
      </section>
    ) : null,

    // Pour aller plus loin : un volet repliable par élément, fermé par défaut.
    pourAllerPlusLoin: pourAllerPlusLoin?.blocs?.length ? (
      <section id="plus-loin" className={`${SECTION} scroll-mt-20`}>
        <div className={`${CONTENEUR} flex flex-col gap-5`}>
          <h2 className="text-2xl font-extrabold tracking-[-0.03em] text-(--ms-noir) sm:text-3xl">{pourAllerPlusLoin.titre}</h2>
          {pourAllerPlusLoin.texte ? <p className="max-w-3xl text-lg leading-relaxed text-(--ms-gris900)">{pourAllerPlusLoin.texte}</p> : null}
          <div className="flex flex-col gap-3">
            {pourAllerPlusLoin.blocs.map((volet) => (
              <details key={volet.titre} className="group rounded-2xl border border-(--ms-gris200) bg-white">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 sm:px-6 [&::-webkit-details-marker]:hidden">
                  <span className="text-base font-extrabold text-(--ms-noir) sm:text-lg">{volet.titre}</span>
                  <span aria-hidden="true" className="flex-none text-(--ms-gris600) transition-transform group-open:rotate-180">
                    ▾
                  </span>
                </summary>
                <div className="flex flex-col gap-6 border-t border-(--ms-gris200) px-5 py-6 sm:px-6">
                  {volet.blocs?.map((bloc, i) => (
                    <Bloc key={i} bloc={bloc} />
                  ))}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>
    ) : null,

    // Partie « Méthode, sources et relevé complet » : son titre numéroté ; la
    // méthode, le relevé et les sources suivent, chacun avec son ancre.
    annexes: annexes ? (
      <section id={annexes.id ?? "annexes"} className="w-full scroll-mt-20 px-6 pb-8 sm:px-8">
        <div className={`${CONTENEUR} border-t-2 border-(--ms-noir) pt-7`}>
          <TitreNumerote num={annexes.num}>{annexes.titre}</TitreNumerote>
        </div>
      </section>
    ) : null,

    // Le relevé complet : un bloc repliable par candidat (ordre de `nomTri`),
    // mesures triées par date, règles de comptage.
    releve: releve ? (
      <section id="releve" className={`${SECTION} scroll-mt-20`}>
        <div className={`${CONTENEUR} flex flex-col gap-5`}>
          <h2 className="text-2xl font-extrabold tracking-[-0.03em] text-(--ms-noir) sm:text-3xl">{releve.titre}</h2>
          <p className="max-w-3xl text-lg leading-relaxed text-(--ms-gris900)">{releve.texte}</p>
          <MiseAJour libelle={releve.libelleMaj} date={INVENTAIRE.dateReleve} />
          {INVENTAIRE.regles?.length ? (
            <div className="flex max-w-4xl flex-col gap-3 rounded-r-2xl border-l-4 border-(--ms-jaune) bg-(--ms-jaunePale) px-6 py-5 sm:px-7 sm:py-6">
              <h3 className="text-lg font-extrabold tracking-[-0.02em] text-(--ms-noir)">Comment nous comptons</h3>
              <ul className="flex list-disc flex-col gap-2 pl-5 text-[15px] leading-relaxed text-(--ms-gris900)">
                {INVENTAIRE.regles.map((regle) => (
                  <li key={regle}>{regle}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="flex max-w-4xl flex-col gap-3">
            {releveParCandidat.map((groupe) => (
              <details key={groupe.candidat} className="group rounded-2xl border border-(--ms-gris200) bg-white">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 sm:px-6 [&::-webkit-details-marker]:hidden">
                  <span className="min-w-0">
                    <span className="block text-base font-extrabold text-(--ms-noir)">{groupe.candidat}</span>
                    <span className="block text-xs text-(--ms-gris600)">
                      {groupe.parti} ·{" "}
                      <strong className="font-semibold text-(--ms-gris900)">
                        {groupe.total} mesure{groupe.total > 1 ? "s" : ""} comptée{groupe.total > 1 ? "s" : ""}
                      </strong>
                    </span>
                  </span>
                  <span aria-hidden="true" className="flex-none text-(--ms-gris600) transition-transform group-open:rotate-180">
                    ▾
                  </span>
                </summary>
                <ul className="border-t border-(--ms-gris200) px-5 sm:px-6">
                  {groupe.mesures.map((mesure) => (
                    <MesureReleve key={mesure.id} mesure={mesure} libelleNonRetenue={releve.libelleNonRetenue} />
                  ))}
                </ul>
              </details>
            ))}
          </div>
        </div>
      </section>
    ) : null,

    // Méthode et limites, avec l'échelle des verdicts du site.
    methode: methode ? (
      <section id="methode" className={`${SECTION} scroll-mt-20`}>
        <div className={CONTENEUR}>
          <div className="flex max-w-4xl flex-col gap-3 rounded-2xl border border-(--ms-gris200) bg-white p-6 text-[15px] leading-relaxed text-(--ms-gris900) sm:p-7">
            <h2 className="text-2xl font-extrabold tracking-[-0.03em] text-(--ms-noir)">{methode.titre}</h2>
            {methode.paragraphes?.map((paragraphe) => (
              <p key={paragraphe}>{paragraphe}</p>
            ))}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {bandes.map((bande) => (
                <Pastille key={bande.label} className={bande.badge}>
                  {bande.min}-{bande.max} {bande.label}
                </Pastille>
              ))}
            </div>
          </div>
        </div>
      </section>
    ) : null,

    // Sources ; une source avec `ancre` (le relevé) est un lien interne.
    sources: sources.length ? (
      <section id="sources" className={`${SECTION} scroll-mt-20`}>
        <div className={`${CONTENEUR} flex flex-col gap-2`}>
          <Etiquette>Sources</Etiquette>
          <ul className="flex flex-col gap-1.5 text-[13px] leading-snug">
            {sources.map((source) => (
              <li key={source.url ?? source.ancre}>
                {source.url ? (
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-(--ms-gris600) underline decoration-(--ms-gris400) underline-offset-2 transition-colors hover:text-(--ms-noir)"
                  >
                    {source.label} <span aria-hidden="true">↗</span>
                  </a>
                ) : (
                  <a
                    href={source.ancre}
                    className="text-(--ms-gris600) underline decoration-(--ms-gris400) underline-offset-2 transition-colors hover:text-(--ms-noir)"
                  >
                    {source.label} <span aria-hidden="true">↑</span>
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      </section>
    ) : null,
  };

  return (
    <div className="flex min-h-screen flex-col bg-(--ms-gris50) font-sans" style={variablesCharte(charte?.couleurs)}>
      <Header />

      {/* Police Inter sur le contenu du dossier seulement (l'en-tête du site
          garde sa police). */}
      <main className={`${inter.variable} flex w-full flex-col font-(family-name:--font-inter) text-(--ms-gris900)`}>
        {(ordreSections ?? ORDRE_PAR_DEFAUT).map((nom) => (
          <Fragment key={nom}>{sections[nom] ?? null}</Fragment>
        ))}
      </main>

      {/* Bouton flottant qui ramène au plan de lecture. */}
      {plan?.items?.length ? (
        <a
          href="#plan"
          className="fixed bottom-5 right-5 z-30 inline-flex items-center gap-1.5 rounded-full bg-(--ms-noir) px-4 py-2.5 font-mono text-sm font-bold text-(--ms-jaune) shadow-lg transition-transform hover:-translate-y-0.5"
        >
          <span aria-hidden="true">↑</span> Plan
        </a>
      ) : null}
    </div>
  );
}
