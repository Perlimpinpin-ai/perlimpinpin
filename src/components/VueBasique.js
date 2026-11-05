import { Section, renderRichText, SOURCE_STRING_REGEX } from "@/lib/fiche-rendu";
import { LienVersExpert } from "@/components/VueAnalyseProvider";
import { ID_VUE, ID_ONGLET } from "@/lib/vue-analyse";
import Editable from "@/app/test/Editable";

// Vue « Résumé basique » de la fiche : contenuComplet.version_basique, texte
// simplifié pour le grand public (étape 3 bis, voir scripts/analyze.js).
// Composant serveur : tout le texte est dans le HTML, même vue masquée.
// `edition` : { analyseId, versionAttendue } pour un éditeur (/test/[id]) :
// crayon sur les textes et les listes de points (pas sur les sources). Sans
// `edition` (site public), le rendu est exactement le même qu'avant.

// Sommaire « Sur cette page » de la vue basique (voir StickyScoreCard).
export const TOC_SECTIONS_BASIQUE = [
  { id: "basique-resume", label: "En résumé" },
  { id: "basique-contexte", label: "Contexte" },
  { id: "basique-analyse", label: "Analyse" },
  { id: "basique-points", label: "Points forts et limites" },
  { id: "basique-faisabilite", label: "Faisabilité" },
  { id: "basique-sources", label: "Sources" },
];

// Id de la section « Sources utilisées » de la vue expert, cible du lien
// « Voir toutes les sources ».
export const ID_SOURCES_EXPERT = "sources";

// Avant le premier affichage, si l'URL demande ?vue=expert : échange les
// attributs hidden des deux vues et l'onglet sélectionné, pour éviter de
// montrer la vue basique un instant (la page, en cache ISR, est toujours
// rendue en vue basique côté serveur). Placé après les deux vues dans le HTML.
const SCRIPT_VUE_INITIALE = `(function(){try{
if(new URLSearchParams(location.search).get("vue")!=="expert")return;
var b=document.getElementById(${JSON.stringify(ID_VUE.basique)}),e=document.getElementById(${JSON.stringify(ID_VUE.expert)});
if(!b||!e)return;b.hidden=true;e.hidden=false;
var tb=document.getElementById(${JSON.stringify(ID_ONGLET.basique)}),te=document.getElementById(${JSON.stringify(ID_ONGLET.expert)});
if(tb&&te){tb.setAttribute("aria-selected","false");tb.tabIndex=-1;te.setAttribute("aria-selected","true");te.tabIndex=0;}
}catch(_){}})();`;

export function ScriptVueInitiale() {
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT_VUE_INITIALE }} />;
}

// Source au format chaîne « Organisme, titre (date), https://… » ou objet
// structuré { titre, organisme, url }. L'organisme est le texte avant la
// première virgule, l'année le dernier nombre à 4 chiffres (19xx/20xx).
function decrireSource(source) {
  if (source && typeof source === "object") {
    const texte = `${source.titre ?? ""} ${source.date ?? ""}`;
    return {
      titre: source.titre ?? source.url ?? "Source",
      organisme: source.organisme ?? null,
      annee: source.annee ?? texte.match(/\b(?:19|20)\d{2}\b/g)?.pop() ?? null,
      url: source.url ?? null,
    };
  }
  if (typeof source !== "string") return null;

  const match = source.match(SOURCE_STRING_REGEX);
  const libelle = (match ? match[1] : source).trim();
  const annee = libelle.match(/\b(?:19|20)\d{2}\b/g)?.pop() ?? null;
  const virgule = libelle.indexOf(",");
  const organisme = virgule > 0 ? libelle.slice(0, virgule).trim() : null;
  // Titre sans l'organisme ni la date finale entre parenthèses, déjà affichés dessous.
  const titre = (virgule > 0 ? libelle.slice(virgule + 1) : libelle).replace(/\s*\([^()]*\)\s*$/, "").trim();
  return { titre: titre || libelle, organisme, annee, url: match ? match[2] : null };
}

function IconeCoche() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 10.5 3.5 3.5 7.5-8" />
    </svg>
  );
}

function IconeCroix() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="m5.5 5.5 9 9m0-9-9 9" />
    </svg>
  );
}

function ListePoints({ titre, points, fondClass, Icone }) {
  return (
    <div className={`min-w-0 rounded-xl border p-4 sm:p-5 ${fondClass}`}>
      <h3 className="text-sm font-bold text-zinc-900">{titre}</h3>
      <ul className="mt-3 flex flex-col gap-2.5">
        {points.map((point, index) => (
          <li key={index} className="flex items-start gap-2.5 text-zinc-700">
            <Icone />
            <span>{renderRichText(point)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CarteSource({ source }) {
  const meta = [source.organisme, source.annee].filter(Boolean).join(" · ");
  const contenu = (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-4.5 w-4.5" aria-hidden="true">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
          />
        </svg>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold leading-snug text-zinc-900 [overflow-wrap:anywhere]">
          {renderRichText(source.titre)}
        </span>
        {meta ? <span className="mt-0.5 block text-xs text-zinc-500">{meta}</span> : null}
      </span>
      {source.url ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden="true">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
          />
        </svg>
      ) : null}
    </>
  );

  const classes = "flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3";
  return source.url ? (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`${classes} transition-colors hover:border-zinc-300 hover:bg-zinc-50`}
    >
      {contenu}
      <span className="sr-only"> (nouvel onglet)</span>
    </a>
  ) : (
    <div className={classes}>{contenu}</div>
  );
}

export default function VueBasique({ versionBasique, sourcesUtilisees, edition = null }) {
  const sources = Array.isArray(sourcesUtilisees) ? sourcesUtilisees : [];
  const principales = (versionBasique.sources_principales ?? [])
    .filter((index) => Number.isInteger(index) && index >= 0 && index < sources.length)
    .map((index) => decrireSource(sources[index]))
    .filter(Boolean);

  // Marge à droite pour que le texte ne passe pas sous le crayon.
  const margeCrayon = edition ? " pr-11" : "";

  return (
    <>
      <section id="basique-resume" className="scroll-mt-24 rounded-2xl border border-zinc-200 bg-white p-4 sm:p-6">
        <h2 className="sr-only">En résumé</h2>
        <Editable edition={edition} champ="version_basique.resume" valeurBrute={versionBasique.resume} multiligne>
          <p className={`rounded-xl bg-zinc-50 p-5 text-base leading-relaxed text-zinc-700 sm:p-6 sm:text-lg${margeCrayon}`}>
            {renderRichText(versionBasique.resume)}
          </p>
        </Editable>
      </section>
      {/* Repère de StickyScoreCard : le sommaire « Sur cette page » apparaît une
          fois ce point dépassé. Posé UNIQUEMENT dans la vue basique : masqué,
          il renvoie top = 0 et la vue expert reste comme avant. */}
      <div id="resume-sentinel" aria-hidden="true" />

      <Section id="basique-contexte" title="Contexte">
        <Editable edition={edition} champ="version_basique.contexte" valeurBrute={versionBasique.contexte} multiligne>
          <p className={edition ? "pr-11" : undefined}>{renderRichText(versionBasique.contexte)}</p>
        </Editable>
      </Section>

      <Section id="basique-analyse" title="Analyse de la proposition">
        <Editable edition={edition} champ="version_basique.analyse" valeurBrute={versionBasique.analyse} multiligne>
          <p className={edition ? "pr-11" : undefined}>{renderRichText(versionBasique.analyse)}</p>
        </Editable>
      </Section>

      <Section id="basique-points" title="Points forts et limites">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Editable edition={edition} champ="version_basique.points_forts" valeurBrute={versionBasique.points_forts} multiligne>
            <ListePoints
              titre="Points forts"
              points={versionBasique.points_forts}
              fondClass="border-emerald-100 bg-emerald-50/60"
              Icone={IconeCoche}
            />
          </Editable>
          <Editable edition={edition} champ="version_basique.points_faibles" valeurBrute={versionBasique.points_faibles} multiligne>
            <ListePoints
              titre="Points faibles"
              points={versionBasique.points_faibles}
              fondClass="border-red-100 bg-red-50/60"
              Icone={IconeCroix}
            />
          </Editable>
        </div>
      </Section>

      <Section id="basique-faisabilite" title="Faisabilité et mise en œuvre">
        <Editable edition={edition} champ="version_basique.faisabilite" valeurBrute={versionBasique.faisabilite} multiligne>
          <p className={edition ? "pr-11" : undefined}>{renderRichText(versionBasique.faisabilite)}</p>
        </Editable>
      </Section>

      <Section id="basique-sources" title="Sources principales">
        {principales.length > 0 ? (
          <ul className="flex flex-col gap-2.5">
            {principales.map((source, index) => (
              <li key={index}>
                <CarteSource source={source} />
              </li>
            ))}
          </ul>
        ) : null}
        {sources.length > 0 ? (
          <LienVersExpert
            cible={ID_SOURCES_EXPERT}
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-900 transition-colors hover:text-zinc-600 print:hidden"
          >
            Voir toutes les sources ({sources.length})
            <span aria-hidden="true">→</span>
          </LienVersExpert>
        ) : null}
      </Section>
    </>
  );
}
