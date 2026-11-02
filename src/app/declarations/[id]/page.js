import { cache, Fragment } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import FeedbackWidget from "@/components/FeedbackWidget";
import VoteMesureWidget from "@/components/VoteMesureWidget";
import StickyScoreCard from "@/components/StickyScoreCard";
import ScoreDetail from "@/components/ScoreDetail";
import AccordionSection from "@/components/AccordionSection";
import MesureObjectifBanner from "@/components/MesureObjectifBanner";
import MonoTag from "@/components/MonoTag";
import EtapeRaisonnement from "@/components/EtapeRaisonnement";
import SupportBanner from "@/components/SupportBanner";
import Editable from "@/app/test/Editable";
import { CRITERES_ANALYSE } from "@/lib/test-edition";
import { getDeclarationDetail } from "@/lib/queries";
import { getScoreBadge, PLAFOND_DECLENCHEUR_LABELS } from "@/lib/score";
import { vignettePhoto } from "@/lib/photo-vignette";
import { renderRichText, renderSourceString } from "@/lib/fiche-rendu";
import { lireVersionBasique } from "@/lib/version-basique";
import VueBasique, { TOC_SECTIONS_BASIQUE, ID_SOURCES_EXPERT, ScriptVueInitiale } from "@/components/VueBasique";
import { VueAnalyseProvider, BasculeVue, Vue } from "@/components/VueAnalyseProvider";

// ISR : chaque fiche est calculée à sa première visite, puis servie depuis le
// cache du CDN et recalculée au plus toutes les 5 minutes (nouvelle analyse,
// compteurs de votes). generateStaticParams renvoie [] : le build ne lit pas
// Neon, et dynamicParams = true laisse générer n'importe quel id à la demande.
export const revalidate = 300;
export const dynamicParams = true;

export async function generateStaticParams() {
  return [];
}

// Mémoïsé par requête (React cache) plutôt qu'appelé deux fois : generateMetadata
// et la page elle-même ont besoin de la même fiche, et getDeclarationDetail fait
// plusieurs requêtes Prisma (pas un simple fetch, que Next.js mémoïse déjà tout seul).
const getDeclarationDetailCached = cache(getDeclarationDetail);

// Retire les marqueurs **gras** (voir renderRichText plus bas) : utile pour le HTML
// affiché, mais un <title>/<meta description> doit rester du texte brut.
function stripMarkdown(text) {
  return typeof text === "string" ? text.replace(/\*\*/g, "") : "";
}

function truncate(text, max) {
  if (typeof text !== "string" || text.length <= max) return text ?? "";
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

// titre_fiche/resume_court commencent presque toujours par le nom du candidat
// ("Raphaël Glucksmann propose de…", voir data/prompt-methodologie.md) : sans
// ça, le <title> le répéterait deux fois de suite ("Nom — Nom propose…").
function stripLeadingName(text, nom) {
  if (typeof text !== "string" || !text.toLowerCase().startsWith(nom.toLowerCase())) {
    return text;
  }
  return text.slice(nom.length).trimStart();
}

// JSON-LD ClaimReview (schema.org) : permet à Google d'afficher le verdict et
// le score directement dans les résultats de recherche pour cette fiche.
// N'utilise que des champs réellement présents sur la fiche (texte original
// de la déclaration, candidat, score, palier de verdict, dates de la
// déclaration et de publication de l'analyse) — rien n'est inventé.
function buildClaimReviewJsonLd(declaration) {
  const { analyse } = declaration;
  const badge = getScoreBadge(analyse.scoreFaisabilite);

  return {
    "@context": "https://schema.org",
    "@type": "ClaimReview",
    datePublished: analyse.createdAt.toISOString(),
    url: `https://perlimpinpin.ai/declarations/${declaration.id}`,
    claimReviewed: declaration.texteOriginal,
    itemReviewed: {
      "@type": "Claim",
      author: {
        "@type": "Person",
        name: declaration.candidat.nom,
      },
      datePublished: declaration.dateDeclaration.toISOString(),
    },
    author: {
      "@type": "Organization",
      name: "Perlimpinpin",
      url: "https://perlimpinpin.ai",
    },
    reviewRating: {
      "@type": "Rating",
      ratingValue: String(analyse.scoreFaisabilite),
      bestRating: "100",
      worstRating: "0",
      alternateName: badge.label,
    },
  };
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const propositionId = Number(id);
  if (!Number.isInteger(propositionId)) return {};

  // Métadonnées du site public uniquement (/test/[id] a les siennes) : publiées seules.
  const declaration = await getDeclarationDetailCached(propositionId, false);
  if (!declaration || !declaration.analyse) return {};

  const { analyse } = declaration;
  const contenu = analyse.contenuComplet ?? {};
  const badge = getScoreBadge(analyse.scoreFaisabilite);
  const score = analyse.scoreFaisabilite;

  const resumeBrut = stripMarkdown(contenu.resume_court) || declaration.titre;
  const resume = truncate(stripLeadingName(resumeBrut, declaration.candidat.nom), 60);
  const title = `${declaration.candidat.nom} — ${resume} : ${score}/100 | Perlimpinpin`;

  const verdictText = Array.isArray(contenu.verdict_final)
    ? contenu.verdict_final.join(" ")
    : contenu.verdict_final;
  const evaluation = truncate(stripMarkdown(verdictText), 90) || badge.description;
  const description = `${badge.label} (${score}/100) — ${evaluation.replace(/[.!?…]+$/, "")}. Analyse complète sur Perlimpinpin.`;

  return {
    title,
    description,
    openGraph: { title, description },
  };
}

// Icônes réutilisées à la fois par l'ancien et le nouveau barème (mêmes
// pictogrammes, juste réattribués différemment selon le schéma détecté).
const ICON_FACTUEL = (
  <path
    strokeLinecap="round"
    strokeLinejoin="round"
    d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z"
  />
);
const ICON_JURIDIQUE = (
  <path
    strokeLinecap="round"
    strokeLinejoin="round"
    d="M12 3v17.25m0-17.25c-1.472 0-2.882.265-4.185.75M12 3c1.472 0 2.882.265 4.185.75M18.75 21H5.25M4.5 8.25h4.5m6 0h4.5M3 8.25l2.25-4.5h3l-2.25 4.5H3Zm12 0 2.25-4.5h3l-2.25 4.5h-3Z"
  />
);
const ICON_EFFICACITE = (
  <>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 0 1 1.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.559.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 0 1-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 0 1-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.558-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 0 1 .12-1.45l.773-.773a1.125 1.125 0 0 1 1.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894Z"
    />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
  </>
);
const ICON_COUT = (
  <path
    strokeLinecap="round"
    strokeLinejoin="round"
    d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z"
  />
);
const ICON_OPERATIONNEL = (
  <path
    strokeLinecap="round"
    strokeLinejoin="round"
    d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
  />
);
// Icônes du barème 2026 (5 critères sans malus, voir data/prompt-
// methodologie.md) : ICON_FACTUEL/ICON_JURIDIQUE/ICON_EFFICACITE/ICON_COUT/
// ICON_OPERATIONNEL restent utilisées par les schémas antérieurs
// (notationLabels/notationLabelsV2) ; ces trois-ci sont propres aux
// critères qui n'existaient pas avant (Effets rebonds & Externalités,
// Degré de préparation, Alignement & Logique globale). Formes simples
// dessinées à la main plutôt qu'un tracé Heroicons recopié de mémoire.
const ICON_REBONDS = (
  <>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 15c1.5-2 3-2 4.5 0s3 2 4.5 0 3-2 4.5 0 3 2 4.5 0" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10c1.5-2 3-2 4.5 0s3 2 4.5 0 3-2 4.5 0 3 2 4.5 0" />
  </>
);
const ICON_PREPARATION = (
  <>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M8 3.75h6l1.5 1.5v13.5A1.25 1.25 0 0 1 14.25 20.5H8A1.25 1.25 0 0 1 6.75 19.25V5A1.25 1.25 0 0 1 8 3.75Z"
    />
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 8.5h4M9.5 11.5h4" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.25 15.25l1.5 1.5L14 13.5" />
  </>
);
const ICON_ALIGNEMENT = (
  <>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v16.5M8 3h8" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 8l-2.5 5a2.5 2.5 0 0 0 5 0L5 8Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 8l-2.5 5a2.5 2.5 0 0 0 5 0L19 8Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14" />
  </>
);
const ICON_SHIELD = (
  <path
    strokeLinecap="round"
    strokeLinejoin="round"
    d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z"
  />
);
const ICON_WARNING = (
  <path
    strokeLinecap="round"
    strokeLinejoin="round"
    d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
  />
);

// Ancien barème (5 critères à poids différents 20/20/25/20/15, addition
// simple) : encore utilisé par les fiches produites avant le nouveau
// barème à garde-fou juridique (voir plus bas). Les clés correspondent
// directement à contenu.notation_detaillee.
const notationLabels = [
  { key: "factuel", label: "Solidité factuelle et documentaire", max: 20, icon: ICON_FACTUEL },
  { key: "juridique", label: "Faisabilité juridique et réglementaire", max: 25, icon: ICON_JURIDIQUE },
  { key: "efficacite", label: "Efficacité attendue", max: 20, icon: ICON_EFFICACITE },
  { key: "cout", label: "Coût et soutenabilité budgétaire", max: 20, icon: ICON_COUT },
  { key: "operationnel", label: "Faisabilité opérationnelle", max: 15, icon: ICON_OPERATIONNEL },
];

// Nouveau barème (4 critères de 25 points additionnés + un critère
// juridique évalué séparément comme garde-fou, non additionné — voir
// data/prompt-methodologie.md). Détecté par la présence de
// score_juridique_garde_fou dans notation_detaillee (absent de l'ancien
// schéma), pour ne pas casser l'affichage des fiches déjà publiées.
const notationLabelsV2 = [
  { key: "factuel", label: "Solidité factuelle et documentaire", max: 25, icon: ICON_FACTUEL },
  { key: "efficacite", label: "Efficacité attendue", max: 25, icon: ICON_EFFICACITE },
  { key: "operationnel", label: "Faisabilité opérationnelle", max: 25, icon: ICON_OPERATIONNEL },
  { key: "cout", label: "Coût et soutenabilité budgétaire", max: 25, icon: ICON_COUT },
];

// Barème 2026 (5 critères SANS malus, voir data/prompt-methodologie.md) :
// détecté par operationnalite_moyens_total dans notation_detaillee, son
// "Détail du score" est rendu par le composant ScoreDetail.

// Icônes pour le tableau structuré analyse_par_criteres (étape 3) : les
// valeurs de `critere` n'utilisent pas toujours les mêmes clés que
// notation_detaillee (ex. "solidite_factuelle" au lieu de "factuel",
// schémas antérieurs). "operationnalite_moyens", "effets_rebonds_
// externalites", "degre_preparation" et "alignement_logique" sont les clés
// du barème 2026 ; "efficacite" est inchangée entre les deux.
const CRITERE_ICONS = {
  solidite_factuelle: ICON_FACTUEL,
  efficacite: ICON_EFFICACITE,
  operationnel: ICON_OPERATIONNEL,
  cout: ICON_COUT,
  juridique_garde_fou: ICON_JURIDIQUE,
  operationnalite_moyens: ICON_OPERATIONNEL,
  effets_rebonds_externalites: ICON_REBONDS,
  degre_preparation: ICON_PREPARATION,
  alignement_logique: ICON_ALIGNEMENT,
};

// "Fiabilité de l'analyse" : traitement "liquid glass", pour que ce bloc de
// méta-information ressorte visuellement — fond neutre semi-transparent +
// flou d'arrière-plan, ombre légère portée par la classe Tailwind sur
// l'élément, jamais dans ce style inline.
// backdrop-filter posé en style inline plutôt qu'en classe CSS/Tailwind :
// une fois passé par l'autoprefixer du build (Lightning CSS, voir
// postcss.config.mjs), la propriété ne survit pas de façon fiable dans une
// classe globale — même problème déjà rencontré sur le header sticky, voir
// le commentaire dans Header.js. L'inline style pose la valeur finale
// directement dans le DOM, sans passer par cette étape.
const FIABILITE_GLASS_STYLE = {
  backgroundColor: "rgba(244, 244, 245, 0.55)",
  backdropFilter: "blur(16px) saturate(140%)",
  WebkitBackdropFilter: "blur(16px) saturate(140%)",
  border: "1px solid rgba(228, 228, 231, 0.6)",
};

// Sections ciblées par le mini-sommaire de navigation de la sidebar sticky
// (voir StickyScoreCard) : chaque id doit correspondre à un ancrage posé
// plus bas dans "Le raisonnement complet".
const TOC_SECTIONS = [
  { id: "contexte", label: "Contexte" },
  { id: "analyse-criteres", label: "Analyse par critères" },
  { id: "angles-morts", label: "Angles morts" },
  { id: "verdict", label: "Verdict" },
];

// Bandeau de confiance, sous le widget FeedbackWidget : même traitement
// typographique en mono numéroté "// 0X" que le bloc à 3 colonnes de la
// homepage (voir HeroText.js) — le numéro remplace ici les anciennes icônes
// (bouclier/document/personnes), pas de pictogramme en plus.
const TRUST_ITEMS = [
  {
    title: "Analyses générées par l'IA",
    description: "Une méthodologie commune et évolutive, appliquée à chaque mesure.",
  },
  {
    title: "Méthodologie avec des experts",
    description: "Construite avec économistes, experts et journalistes.",
  },
  {
    title: "Sources publiques et documentées",
    description: "Données institutionnelles et sources de référence.",
  },
];

// Petits déterminants/articles qui ne doivent jamais se retrouver seuls en
// fin de ligne pendant que le nom qu'ils introduisent passe à la ligne
// suivante — espace insécable posée dynamiquement, aucun <br> en dur, valable
// pour tous les résumés (pas seulement une déclaration en particulier).
const PETITS_MOTS = [
  "le", "la", "les", "un", "une", "des", "du", "au", "aux",
  "ce", "cet", "cette", "ces",
];
const PETITS_MOTS_REGEX = new RegExp(
  `([\\s(«"'']|^)(${PETITS_MOTS.join("|")})[ \\t]+(?=\\S)`,
  "gi",
);
function attacherPetitsMots(text) {
  if (typeof text !== "string") return text;
  return text.replace(PETITS_MOTS_REGEX, (_match, prefix, word) => `${prefix}${word} `);
}

// Découpe un texte en paragraphes sur les lignes vides — utilisé à la fois
// pour le résumé IA (contenu.resume_court, juste en dessous) et pour le corps
// du Verdict final (contenu.verdict_final, plus bas sur la page), qui peuvent
// l'un comme l'autre contenir plusieurs paragraphes séparés par un saut de
// ligne vide lorsqu'il existe une vraie rupture logique entre deux idées
// (voir data/prompt-methodologie.md). On respecte ce découpage tel quel,
// sans jamais le forcer mécaniquement quand il est absent (fiches
// antérieures, ou tout texte resté en un seul bloc).
function splitIntoParagraphs(text) {
  if (typeof text !== "string") return [];
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function TeaserParagraphs({ text }) {
  if (typeof text !== "string" || text.trim().length === 0) {
    return <p className="text-base leading-relaxed text-zinc-700">Résumé à venir.</p>;
  }
  const paragraphs = splitIntoParagraphs(text);

  return (
    <div className="flex flex-col gap-4 text-base leading-relaxed text-zinc-700">
      {paragraphs.map((paragraph, index) => (
        <p key={index}>{renderRichText(attacherPetitsMots(paragraph))}</p>
      ))}
    </div>
  );
}

// Corps du bloc Verdict final. `verdict` est en général une chaîne pouvant
// contenir plusieurs paragraphes (voir splitIntoParagraphs) ; par
// compatibilité avec le repli générique déjà utilisé ailleurs sur cette page
// pour les champs texte/liste (TextOrList), un tableau est aussi accepté —
// chaque élément est alors rendu comme un paragraphe à part entière plutôt
// que comme une puce, plus adapté à une conclusion rédigée qu'à une liste.
// `conclusion` (contenu.verdict_conclusion) est un champ optionnel, absent
// des fiches produites avant son introduction : aucune fiche existante ne
// doit casser tant qu'elle ne le fournit pas (voir data/prompt-
// methodologie.md, section "Verdict conclusion").
//
// Étiquettes "Ce qui tient" / "Ce qui reste flou" : uniquement quand le
// verdict compte EXACTEMENT 2 paragraphes (constat positif puis réserves —
// voir la demande d'origine). Vérifié sur les 14 fiches publiées au moment
// de cette demande : 12 n'ont encore qu'un seul paragraphe (verdicts
// antérieurs à la consigne de mise en paragraphes de data/prompt-
// methodologie.md) et 1 en a 3 — dans tous les cas hors "exactement 2", le
// texte s'affiche simplement, sans étiquette forcée ni troisième label
// inventé.
const VERDICT_LABELS = [
  { text: "Ce qui tient", dotClass: "bg-emerald-500", textClass: "text-emerald-700" },
  { text: "Ce qui reste flou", dotClass: "bg-amber-500", textClass: "text-amber-700" },
];

// `editionVerdict` / `editionConclusion` : crayons de /test/[id] (null ailleurs).
function VerdictBody({ verdict, conclusion, editionVerdict = null, editionConclusion = null }) {
  const paragraphs = Array.isArray(verdict)
    ? verdict.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean)
    : splitIntoParagraphs(verdict);
  const hasConclusion = typeof conclusion === "string" && conclusion.trim().length > 0;
  const showLabels = paragraphs.length === 2;

  if (paragraphs.length === 0 && !hasConclusion) {
    return <p className="text-zinc-400">Non renseigné.</p>;
  }

  return (
    <>
      <Editable edition={editionVerdict} champ="verdict_final" valeurBrute={verdict} multiligne>
      <div className={`flex flex-col gap-4${editionVerdict ? " pr-11" : ""}`}>
        {paragraphs.map((paragraph, index) => (
          <div key={index}>
            {showLabels ? (
              <span
                className={`mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest ${VERDICT_LABELS[index].textClass}`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${VERDICT_LABELS[index].dotClass}`}
                  aria-hidden="true"
                />
                {VERDICT_LABELS[index].text}
              </span>
            ) : null}
            <p>{renderRichText(attacherPetitsMots(paragraph))}</p>
          </div>
        ))}
      </div>
      </Editable>
      {hasConclusion && editionConclusion ? (
        <div className="mt-4 border-t border-zinc-100 pt-4">
          <Editable edition={editionConclusion} champ="verdict_conclusion" valeurBrute={conclusion} multiligne>
            <p className="pr-11 font-semibold text-zinc-900">
              {renderRichText(attacherPetitsMots(conclusion.trim()))}
            </p>
          </Editable>
        </div>
      ) : hasConclusion ? (
        <p className="mt-4 border-t border-zinc-100 pt-4 font-semibold text-zinc-900">
          {renderRichText(attacherPetitsMots(conclusion.trim()))}
        </p>
      ) : null}
    </>
  );
}

function TextOrList({ value }) {
  if (!value) {
    return <p className="text-zinc-400">Non renseigné.</p>;
  }
  if (Array.isArray(value)) {
    return (
      <ul className="flex flex-col gap-2">
        {value.map((item, index) => (
          <li key={index} className="flex items-start gap-2">
            <span
              className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400"
              aria-hidden="true"
            />
            <span>{renderRichText(item)}</span>
          </li>
        ))}
      </ul>
    );
  }
  return <p>{renderRichText(value)}</p>;
}

// sources_utilisees : chaînes ou objets structurés, voir renderSourceString
// (src/lib/fiche-rendu.js).
function SourcesList({ value }) {
  if (!value || (Array.isArray(value) && value.length === 0)) {
    return <p className="text-zinc-400">Non renseigné.</p>;
  }
  if (!Array.isArray(value)) {
    return <TextOrList value={value} />;
  }
  if (typeof value[0] !== "object" || value[0] === null) {
    return (
      <ul className="flex flex-col gap-2">
        {value.map((item, index) => (
          <li key={index} className="flex items-start gap-2">
            <span
              className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400"
              aria-hidden="true"
            />
            <span>{renderSourceString(item)}</span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {value.map((source, index) => (
        <li key={source.id ?? index} className="flex items-start gap-2">
          <span
            className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400"
            aria-hidden="true"
          />
          <span>
            {source.url ? (
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-blue-600 transition-colors hover:text-blue-800"
              >
                {source.titre ?? source.url}
              </a>
            ) : (
              <span className="font-medium text-zinc-900">{source.titre ?? "Source"}</span>
            )}
            {source.organisme ? <span className="text-zinc-500"> — {source.organisme}</span> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

// Section « synthèse + texte » (AccordionSection). En mode édition (/test/[id],
// section au format { synthese, texte }), elle est affichée DÉPLIÉE avec un
// crayon sur la synthèse et un sur le texte, rendu identique au texte déplié de
// l'accordéon. Sinon : AccordionSection telle quelle.
function SectionAccordeon({ section, value, splitParagraphs = false, edition = null }) {
  const editable =
    edition && value && typeof value.synthese === "string" && typeof value.texte === "string";
  if (!editable) return <AccordionSection value={value} splitParagraphs={splitParagraphs} />;

  return (
    <div>
      <Editable edition={edition} champ={`${section}.synthese`} valeurBrute={value.synthese} multiligne>
        <p className="pr-11 font-medium text-slate-700">{renderRichText(value.synthese)}</p>
      </Editable>
      <div className="mt-3 border-t border-zinc-100 pt-3">
        <Editable edition={edition} champ={`${section}.texte`} valeurBrute={value.texte} multiligne>
          <div className="pr-11">
            <AccordionSection value={value.texte} splitParagraphs={splitParagraphs} />
          </div>
        </Editable>
      </div>
    </div>
  );
}

// Une card de critère, partagée par les formats successifs de
// analyse_par_criteres : tableau structuré (barème 2026 ou schémas
// antérieurs, un objet par critère dont éventuellement le juridique de
// garde-fou), ou objet keyé (plus ancien format à 5 clés). Icône + titre +
// note/max + texte, avec un liseré distinct (ambre) pour le critère
// juridique de garde-fou, un badge si le veto s'est déclenché (schémas
// antérieurs), et un badge si la RÈGLE DE PLAFOND du barème 2026 s'est
// déclenchée sur Opérationnalité & Moyens (plafond_applique, voir
// data/prompt-methodologie.md, section RÈGLE DE PLAFOND).
function CriteriaCard({
  icon,
  label,
  note,
  max,
  isGardeFou,
  vetoApplique,
  plafondApplique,
  plafondDeclencheur,
  texte,
  margeCrayon = false,
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        isGardeFou ? "border-amber-200 bg-amber-50/50" : "border-blue-100 bg-blue-50/40"
      }${margeCrayon ? " pr-12" : ""}`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
            isGardeFou ? "bg-amber-100 text-amber-700" : "bg-blue-50 text-blue-600"
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            className="h-4.5 w-4.5"
            aria-hidden="true"
          >
            {icon}
          </svg>
        </span>
        <p className="text-sm font-bold text-zinc-900">
          {label}
          <span className="ml-1.5 font-medium text-zinc-500">
            — {note ?? "—"}/{max}
          </span>
          {isGardeFou ? (
            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
              Garde-fou
            </span>
          ) : null}
          {vetoApplique ? (
            <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700">
              Veto appliqué
            </span>
          ) : null}
          {plafondApplique ? (
            <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700">
              Plafonné — {PLAFOND_DECLENCHEUR_LABELS[plafondDeclencheur] ?? plafondDeclencheur ?? "?"}
            </span>
          ) : null}
        </p>
      </div>
      <p className="mt-3 max-w-[68ch] text-sm leading-7 text-zinc-600">{renderRichText(texte)}</p>
    </div>
  );
}

// Bloc "Analyse par critères" : gère trois formes possibles selon la fiche —
// tableau structuré (barème 2026 ou schémas antérieurs, un objet par
// critère), objet keyé (plus ancien format à 5 clés), ou simple chaîne
// (repli générique) pour tout format non reconnu.
// `edition` (/test/[id]) : crayon sur le TEXTE de chaque critère du tableau
// structuré (jamais sur sa note). Un critère en double n'a de crayon que sur sa
// première carte (c'est celle que l'enregistrement retrouve).
function CriteresCards({ criteres, notation, edition = null }) {
  if (Array.isArray(criteres)) {
    if (criteres.length === 0) return <TextOrList value={null} />;
    return (
      <div className="flex flex-col gap-4">
        {criteres.map((item, index) => {
          const champ = `analyse_par_criteres.${item.critere}`;
          const editionCarte =
            edition &&
            Object.hasOwn(CRITERES_ANALYSE, item.critere) &&
            typeof item.texte === "string" &&
            criteres.findIndex((autre) => autre?.critere === item.critere) === index
              ? edition
              : null;
          return (
            <Editable key={item.critere ?? index} edition={editionCarte} champ={champ} valeurBrute={item.texte} multiligne>
              <CriteriaCard
                icon={CRITERE_ICONS[item.critere] ?? ICON_FACTUEL}
                label={item.titre ?? item.critere ?? "Critère"}
                note={item.note}
                max={item.note_max ?? 25}
                isGardeFou={Boolean(item.est_garde_fou)}
                vetoApplique={Boolean(item.veto_applique)}
                plafondApplique={Boolean(item.plafond_applique)}
                plafondDeclencheur={item.plafond_declencheur}
                texte={item.texte}
                margeCrayon={Boolean(editionCarte)}
              />
            </Editable>
          );
        })}
      </div>
    );
  }

  const hasObjectContent =
    criteres && typeof criteres === "object";

  if (!hasObjectContent) {
    return <TextOrList value={criteres} />;
  }

  return (
    <div className="flex flex-col gap-4">
      {notationLabels.map(({ key, label, max, icon }) => (
        <CriteriaCard
          key={key}
          icon={icon}
          label={label}
          note={notation?.[key]}
          max={max}
          isGardeFou={false}
          vetoApplique={false}
          texte={criteres[key]}
        />
      ))}
    </div>
  );
}

// Seuils calés sur la suggestion "rouge < 8/20, orange 8-14/20, vert > 14/20"
// (40 % / 70 %), exprimés en pourcentage pour rester cohérents quel que soit
// le dénominateur réel du critère (/20, /25 ou /100 pour le garde-fou).
function scoreBarColor(pct) {
  if (pct < 40) return "bg-red-500";
  if (pct < 70) return "bg-orange-400";
  return "bg-emerald-500";
}

function ScoreBar({ icon, label, note, max, isGardeFou, vetoApplique, plafondApplique, plafondDeclencheur }) {
  const pct = note != null ? Math.min(100, Math.max(0, (note / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
          isGardeFou ? "bg-amber-100 text-amber-700" : "bg-blue-50 text-blue-600"
        }`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          className="h-4.5 w-4.5"
          aria-hidden="true"
        >
          {icon}
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-zinc-600">
            {label}
            {vetoApplique ? <span className="ml-1.5 font-semibold text-red-600">· veto appliqué</span> : null}
            {plafondApplique ? (
              <span className="ml-1.5 font-semibold text-red-600">
                · plafonné ({PLAFOND_DECLENCHEUR_LABELS[plafondDeclencheur] ?? plafondDeclencheur ?? "?"})
              </span>
            ) : null}
          </p>
          <p className="shrink-0 text-sm font-bold text-zinc-900">
            {note ?? "—"}
            <span className="text-xs font-medium text-zinc-400">/{max}</span>
          </p>
        </div>
        <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-zinc-100">
          <div
            className={`h-full rounded-full transition-[width] ${scoreBarColor(pct)}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// --- Fiabilité de l'analyse (niveau de confiance + limites) ----------------

const CONFIDENCE_LEVELS = {
  faible: { filled: 1, dotClass: "bg-red-500", label: "Faible", badgeClass: "bg-red-50 text-red-700" },
  moyenne: { filled: 2, dotClass: "bg-orange-400", label: "Moyenne", badgeClass: "bg-orange-50 text-orange-700" },
  elevee: { filled: 3, dotClass: "bg-emerald-500", label: "Élevée", badgeClass: "bg-emerald-50 text-emerald-700" },
};

// Bloc B (à venir) : les prochaines analyses porteront un champ structuré
// dédié niveau_confiance_echelle ("faible"|"moyenne"|"élevée"), à préférer
// dès qu'il existe. En attendant — et pour toutes les fiches déjà publiées,
// qui ne l'auront jamais — on déduit le niveau par mots-clés dans le texte
// existant de niveau_de_confiance. C'est une ESTIMATION, pas une nouvelle
// analyse IA : aucune garantie d'exactitude parfaite sur les fiches
// historiques, volontairement acceptée (voir la demande d'origine).
function estimateConfidenceLevel(value) {
  const text = Array.isArray(value) ? value.join(" ") : value;
  if (typeof text !== "string" || text.trim().length === 0) return "moyenne";
  const normalized = text.trim().toLowerCase();

  // En pratique, le texte commence quasi systématiquement par une étiquette
  // explicite ("Faible.", "Moyen.", "Élevé(e)...") avant l'explication en
  // prose libre : on la préfère à un scan de mots-clés sur tout le texte,
  // qui produit trop de faux positifs (ex. "solidement" contient "solide"
  // et ferait basculer à tort un niveau "moyen" vers "élevée").
  const leadingWord = normalized.match(/^[a-zéèêàâîïôûù]+/)?.[0];
  if (leadingWord === "élevé" || leadingWord === "élevée" || leadingWord === "haute") return "elevee";
  if (leadingWord === "moyen" || leadingWord === "moyenne") return "moyenne";
  if (leadingWord === "faible") return "faible";

  if (/(élevé|haute|solide)/.test(normalized)) return "elevee";
  if (/(faible|insuffisant|limité)/.test(normalized)) return "faible";
  return "moyenne";
}

// Structuré (Bloc B, futur) en priorité, sinon estimation par mots-clés.
function resolveConfidenceLevel(contenu) {
  const structured = contenu.niveau_confiance_echelle;
  if (structured === "faible" || structured === "moyenne") return structured;
  if (structured === "élevée" || structured === "elevee") return "elevee";
  return estimateConfidenceLevel(contenu.niveau_de_confiance);
}

function ConfidenceGauge({ level }) {
  const config = CONFIDENCE_LEVELS[level] ?? CONFIDENCE_LEVELS.moyenne;
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-1" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={`h-2 w-2 rounded-full ${i < config.filled ? config.dotClass : "bg-zinc-200"}`}
          />
        ))}
      </div>
      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${config.badgeClass}`}>
        {config.label}
      </span>
    </div>
  );
}

// Traitement "liquid glass" distinct (FIABILITE_GLASS_STYLE, fond neutre) :
// "Niveau de confiance"/"Limites identifiées" sont une information
// secondaire/méta sur l'analyse elle-même, pas un point de contenu au même niveau que le
// raisonnement, mais doivent tout de même se détacher visuellement du reste
// de la page (voir la demande d'origine).
function FiabiliteSection({ contenu, edition = null }) {
  const level = resolveConfidenceLevel(contenu);
  const editionConfiance = typeof contenu.niveau_de_confiance === "string" ? edition : null;
  return (
    <div
      className="rounded-2xl px-5 py-4 shadow-[0_8px_30px_-8px_rgba(0,0,0,0.12)]"
      style={FIABILITE_GLASS_STYLE}
    >
      <span className="block text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
        Fiabilité de l&apos;analyse
      </span>
      {/* Icônes dans un badge circulaire (fond blanc, ombre légère) et
          titres en text-base font-bold — pas de simples icônes nues text-xs
          en ligne avec le titre : la maquette 413 montre un rond blanc
          d'environ 48px autour de chaque icône (trait plus épais, gris
          zinc-500) et un titre nettement plus grand/gras que le reste du
          texte, avec la jauge de confiance sur sa propre ligne sous le
          titre plutôt qu'à côté. */}
      <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6">
        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              className="h-5 w-5 text-zinc-500"
              aria-hidden="true"
            >
              {ICON_SHIELD}
            </svg>
          </span>
          <div className="min-w-0 pt-1">
            <span className="text-base font-bold text-zinc-900">Niveau de confiance</span>
            <div className="mt-1.5">
              <ConfidenceGauge level={level} />
            </div>
            <Editable
              edition={editionConfiance}
              champ="niveau_de_confiance"
              valeurBrute={contenu.niveau_de_confiance}
              multiligne
            >
              <div className={`mt-2 text-sm leading-relaxed text-zinc-500${editionConfiance ? " pr-11" : ""}`}>
                <TextOrList value={contenu.niveau_de_confiance} />
              </div>
            </Editable>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              className="h-5 w-5 text-zinc-500"
              aria-hidden="true"
            >
              {ICON_WARNING}
            </svg>
          </span>
          <div className="min-w-0 pt-1">
            <span className="text-base font-bold text-zinc-900">Limites identifiées</span>
            <div className="mt-2 text-sm leading-relaxed text-zinc-500">
              <SectionAccordeon section="limites" value={contenu.limites} edition={edition} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Mise en page éditoriale de la vue expert : pas de cartes, des blocs séparés
// par un trait fin (y compris au-dessus du premier, sous la bascule).
const CLASSE_VUE_EXPERT = "flex flex-col divide-y divide-zinc-200 border-t border-zinc-200 *:py-8";

// Contenu d'analyse actuel de la fiche : enveloppé dans la vue expert quand la
// fiche a une version basique, dans un simple conteneur de même style sinon.
function VueExpertSi({ actif, children }) {
  return actif ? (
    <Vue nom="expert" className={CLASSE_VUE_EXPERT}>
      {children}
    </Vue>
  ) : (
    <div className={CLASSE_VUE_EXPERT}>{children}</div>
  );
}

// `preview` : utilisé par /test/[id] pour relire un brouillon. On y masque les
// blocs qui écrivent en base (vote, feedback) et le lien de retour pointe vers
// la liste des brouillons. Sur le site public, `preview` reste faux : rien ne change.
// `edition` : { analyseId, versionAttendue, mesurePubliee } pour un éditeur (crayon
// sur le titre, le résumé, la mesure initiale…), sinon null.
export default async function DeclarationDetailPage({ params, preview = false, edition = null }) {
  const { id } = await params;
  const propositionId = Number(id);

  if (!Number.isInteger(propositionId)) {
    notFound();
  }

  // Site public : dernière analyse publiée, 404 s'il n'y en a pas (brouillon
  // seul). `preview` (/test/[id]) : dernière analyse, brouillon compris.
  const declaration = await getDeclarationDetailCached(propositionId, preview);

  if (!declaration || !declaration.analyse) {
    notFound();
  }

  const { analyse } = declaration;
  const contenu = analyse.contenuComplet ?? {};
  const badge = getScoreBadge(analyse.scoreFaisabilite);
  const notation = contenu.notation_detaillee ?? {};
  const isNouveauBareme = notation.score_juridique_garde_fou !== undefined;
  // Schéma V3 (pipeline "ajustement juridique bonus-malus", data/prompt-
  // methodologie.md) : qualification_juridique remplace score_juridique_
  // garde_fou/veto_juridique_applique. Comme V2, il utilise 4 critères /25
  // (notationLabelsV2), mais l'incidence juridique n'est plus une note
  // affichée comme un 5e score/jauge — seulement, si non nulle, une
  // explication textuelle (voir plus bas). Ne jamais afficher deux scores
  // concurrents pour une même fiche.
  const qualificationJuridique = contenu.qualification_juridique;
  const isNouveauBaremeV3 = !isNouveauBareme && qualificationJuridique !== undefined;
  // Schéma V4 (pipeline à 4 étapes, recherche bornée + rédaction éditoriale
  // séparée, voir scripts/analyze.js) : seul schéma qui porte un
  // discriminant explicite (schema_version) plutôt qu'un sniffing
  // structurel — contenuComplet n'y contient plus que le contenu déjà
  // publiable (contenuPublic + notation_detaillee + sources_utilisees),
  // jamais les notes de travail internes de l'analyste (voir
  // buildContenuCompletV4 dans scripts/analyze.js). La page affiche donc,
  // pour ces fiches, un résumé plus court que pour les versions antérieures.
  const isV4 = contenu.schema_version === "v4";
  // Barème 2026 (5 critères SANS malus, voir data/prompt-methodologie.md) :
  // détecté par operationnalite_moyens_total, absent de tous les schémas
  // antérieurs. Remplace le malus bonus/malus (isNouveauBareme/
  // isNouveauBaremeV3) par une RÈGLE DE PLAFOND interne à Opérationnalité &
  // Moyens (plafond_applique/plafond_declencheur) — affichée directement
  // par ScoreBar/CriteriaCard, pas par un bloc textuel séparé comme V3.
  const isNouveauBaremeV5 = notation.operationnalite_moyens_total !== undefined;
  const tocSections = isV4
    ? TOC_SECTIONS.filter((section) => section.id === "analyse-criteres" || section.id === "verdict")
    : TOC_SECTIONS;
  const claimReviewJsonLd = buildClaimReviewJsonLd(declaration);
  // Version basique (étape 3 bis) : si elle existe, bascule « Résumé basique /
  // Résumé expert » ; sinon la page reste exactement comme avant.
  const versionBasique = lireVersionBasique(contenu, propositionId);
  const EnveloppeVue = versionBasique ? VueAnalyseProvider : Fragment;
  const sectionsBasique = versionBasique ? TOC_SECTIONS_BASIQUE : undefined;
  // Mesure initiale (colonne de la proposition, partagée par ses analyses) :
  // pas de crayon si une version de la mesure est déjà publiée.
  const editionMesure = edition && !edition.mesurePubliee ? edition : null;
  // Fiche sans bandeau « Mesure initiale » : le crayon de la mesure passe sur la citation.
  const editionExtrait = contenu.mesure_vers_objectif ? null : editionMesure;

  // Étapes du « raisonnement complet », dans l'ordre d'affichage. Seules les
  // étapes réellement présentes sont gardées, puis numérotées sans trou au
  // rendu (EtapeRaisonnement).
  // Schéma V4 : contenuComplet ne porte plus les notes de travail internes de
  // l'analyste (mesure_reformulee, contexte_*, ce_qui_est_etabli/probable/
  // discutable/inconnu, angles_morts, analyse_longevites…) — elles restent dans
  // analyseCanonique, jamais exposée au front-end (voir scripts/analyze.js,
  // buildContenuCompletV4). Ces étapes sont donc réservées aux fiches
  // antérieures au pipeline à 4 étapes.
  // impact_environnement et impact_temporel_et_sectoriel sont nullables (voir
  // data/prompt-methodologie.md) : étape omise quand ils sont absents.
  // Section « synthèse + texte » du raisonnement, avec ses crayons en mode édition.
  const section = (cle, options = {}) => (
    <SectionAccordeon section={cle} value={contenu[cle]} edition={edition} {...options} />
  );
  // Sources : crayon seulement pour une liste de textes (pas d'objets structurés).
  const sourcesEditables =
    Array.isArray(contenu.sources_utilisees) &&
    contenu.sources_utilisees.length > 0 &&
    contenu.sources_utilisees.every((source) => typeof source === "string");
  const editionSources = sourcesEditables ? edition : null;
  const etapesRaisonnement = [
    !isV4 && { titre: "Mesure reformulée", contenu: section("mesure_reformulee") },
    !isV4 && {
      titre: "Mise en contexte dans le programme",
      contenu: section("contexte_programme"),
    },
    !isV4 && {
      id: "contexte",
      titre: "Contexte national",
      contenu: section("contexte_national", { splitParagraphs: true }),
    },
    !isV4 && {
      titre: "Contexte international",
      contenu: section("contexte_international", { splitParagraphs: true }),
    },
    !isV4 &&
      contenu.impact_environnement && {
        titre: "Impact environnemental",
        contenu: section("impact_environnement"),
      },
    {
      id: "analyse-criteres",
      titre: "Analyse par critères",
      contenu: <CriteresCards criteres={contenu.analyse_par_criteres} notation={notation} edition={edition} />,
    },
    !isV4 && { titre: "Longévité des effets", contenu: section("analyse_longevites") },
    !isV4 &&
      contenu.impact_temporel_et_sectoriel && {
        titre: "Impact temporel et sectoriel",
        contenu: section("impact_temporel_et_sectoriel"),
      },
    !isV4 && { titre: "Ce qui est établi", contenu: section("ce_qui_est_etabli") },
    !isV4 && { titre: "Ce qui est probable", contenu: section("ce_qui_est_probable") },
    !isV4 && { titre: "Ce qui est discutable", contenu: section("ce_qui_est_discutable") },
    !isV4 && { titre: "Ce qui est inconnu", contenu: section("ce_qui_est_inconnu") },
    !isV4 && {
      id: "angles-morts",
      titre: "Angles morts et effets de bord",
      contenu: section("angles_morts"),
    },
    {
      id: "verdict",
      titre: "Verdict final",
      contenu: (
        <VerdictBody
          verdict={contenu.verdict_final}
          conclusion={contenu.verdict_conclusion}
          editionVerdict={typeof contenu.verdict_final === "string" ? edition : null}
          editionConclusion={typeof contenu.verdict_conclusion === "string" ? edition : null}
        />
      ),
    },
    {
      id: versionBasique ? ID_SOURCES_EXPERT : undefined,
      titre: "Sources utilisées",
      contenu: editionSources ? (
        <Editable edition={editionSources} champ="sources_utilisees" valeurBrute={contenu.sources_utilisees} multiligne>
          <div className="pr-11">
            <SourcesList value={contenu.sources_utilisees} />
          </div>
        </Editable>
      ) : (
        <SourcesList value={contenu.sources_utilisees} />
      ),
    },
  ].filter(Boolean);

  return (
    <div className="flex min-h-screen flex-col bg-page-gradient font-sans">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(claimReviewJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <Header />

      <main className="w-full px-6 py-12 sm:px-8 sm:py-16">
        <EnveloppeVue>
        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr] lg:items-start lg:gap-x-8">
          {/* Colonne principale : tout le contenu de lecture, empilé dans
              l'ordre. La hauteur de cette colonne détermine la hauteur de
              la cellule de grille de la sidebar sticky à droite, ce qui lui
              permet de rester épinglée sur toute la longueur de la page. */}
          <div className="flex flex-col gap-6">
            {/* En-tête */}
            <div>
              <Link
                href={preview ? "/test" : "/declarations"}
                className="text-sm font-semibold text-blue-600 transition-colors hover:text-blue-800"
              >
                ← Retour
              </Link>

              {/* Bleu sur cette page uniquement (choix délibéré propre à la
                  fiche déclaration) — les labels de thème identiques
                  ailleurs sur le site (accueil, à propos) restent en rouge,
                  ne pas généraliser cette couleur. */}
              {editionMesure ? (
                <div className="mt-6">
                  <Editable edition={editionMesure} champ="proposition.theme" valeurBrute={declaration.theme} multiligne={false}>
                    <span className="block min-h-8 pr-11 pt-1.5 text-xs font-bold uppercase tracking-widest text-blue-600">
                      {declaration.theme}
                    </span>
                  </Editable>
                </div>
              ) : (
                <span className="mt-6 block text-xs font-bold uppercase tracking-widest text-blue-600">
                  {declaration.theme}
                </span>
              )}
              {/* font-sans, pas font-serif : la maquette de cette page (voir
                  public/maquettes) montre un titre en sans-serif comme
                  partout ailleurs sur le site, pas la serif éditoriale
                  Fraunces — celle-ci ne correspond à aucune maquette fournie
                  pour l'instant, à vérifier avant de la réutiliser ailleurs. */}
              <Editable
                edition={edition}
                champ="titre_fiche"
                valeurBrute={typeof contenu.titre_fiche === "string" ? contenu.titre_fiche : declaration.titre}
                multiligne={false}
              >
                <h1
                  className={`mt-2 text-[clamp(1.5rem,1.05rem+1.7vw,2.25rem)] font-sans font-bold leading-tight tracking-tight text-zinc-900${edition ? " pr-11" : ""}`}
                >
                  {declaration.titre}
                </h1>
              </Editable>

              {/* Phrase du carrousel d'accueil : absente de la fiche publique,
                  affichée seulement en mode édition (brouillon sur /test)
                  pour pouvoir la relire et la corriger avant publication. */}
              {edition ? (
                <div className="mt-3 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-3 py-2">
                  <span className="block text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
                    {"Phrase d'accueil (carrousel)"}
                  </span>
                  <Editable
                    edition={edition}
                    champ="teaser_accueil"
                    valeurBrute={typeof contenu.teaser_accueil === "string" ? contenu.teaser_accueil : ""}
                    multiligne
                  >
                    <p className="min-h-8 pr-11 pt-1 text-sm leading-snug text-zinc-600">
                      {typeof contenu.teaser_accueil === "string" && contenu.teaser_accueil.trim()
                        ? contenu.teaser_accueil
                        : "Aucune phrase d'accueil sur cette fiche."}
                    </p>
                  </Editable>
                </div>
              ) : null}

              <div className="mt-6 flex items-center gap-3">
                <img
                  src={vignettePhoto(declaration.candidat.photoUrl) || "/avatar-placeholder.svg"}
                  alt={declaration.candidat.nom}
                  className="h-11 w-11 shrink-0 rounded-lg object-cover object-top"
                />
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-zinc-900">
                    {declaration.candidat.nom}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {declaration.candidat.parti} · {declaration.dateLabel}
                  </span>
                </div>
              </div>
            </div>

            {/* Sur mobile, il n'y a pas de sidebar : la carte de score
                (StickyScoreCard, identique à celle de l'aside plus bas)
                est donc dupliquée ici, juste au-dessus du résumé, et
                masquée à partir de lg. L'aside plus bas est à l'inverse
                masqué en dessous de lg pour ne pas l'afficher deux fois. */}
            <div className="lg:hidden">
              <StickyScoreCard
                score={analyse.scoreFaisabilite}
                badge={badge}
                sections={tocSections}
                sectionsBasique={sectionsBasique}
                versionMethodologie={analyse.versionMethodologie}
                generationDateLabel={declaration.generationDateLabel}
              />
            </div>

            {/* Bascule basique/expert, commune aux deux vues, puis la vue basique.
                Tout ce qui suit jusqu'à la Fiabilité de l'analyse forme la vue
                expert (contenu inchangé, non réindenté). */}
            {versionBasique ? (
              <>
                <BasculeVue />
                <Vue nom="basique">
                  {/* Crayons seulement si la version basique est en base (pas
                      celle lue en local dans data/versions-basiques-dev). */}
                  <VueBasique
                    versionBasique={versionBasique}
                    sourcesUtilisees={contenu.sources_utilisees}
                    edition={versionBasique === contenu.version_basique ? edition : null}
                  />
                </Vue>
              </>
            ) : null}

            <VueExpertSi actif={Boolean(versionBasique)}>
            {/* Résumé : simples paragraphes, sans titre ni carte.
                Texte intégral de contenu.resume_court (pas analyse.teaser,
                qui est une version tronquée à 500 caractères + "…" dérivée
                de resume_court pour d'autres usages — voir buildTeaser dans
                scripts/analyze.js). pr-11 en mode édition : place du crayon. */}
            <Editable
              edition={typeof contenu.resume_court === "string" ? edition : null}
              champ="resume_court"
              valeurBrute={contenu.resume_court}
              multiligne
            >
              <section aria-label="Résumé de l'analyse" className={`max-w-[68ch]${edition ? " pr-11" : ""}`}>
                <TeaserParagraphs text={contenu.resume_court} />
              </section>
            </Editable>


            {/* Mesure → objectif visé : absente sur les fiches antérieures
                au barème 2026 (mesure_vers_objectif n'existait pas encore). */}
            {contenu.mesure_vers_objectif ? (
              <MesureObjectifBanner
                categorieObjectif={contenu.mesure_vers_objectif.categorie_objectif}
                titre={declaration.texteOriginal}
                objectifCourt={contenu.mesure_vers_objectif.objectif_court}
                edition={edition}
                editionMesure={editionMesure}
              />
            ) : null}

            {/* Détail du score. Barème 2026 : ScoreDetail (qualification
                par critère, échelle des paliers, RÈGLE DE PLAFOND).
                Schémas antérieurs : barres simples conservées pour ne pas
                casser les fiches déjà publiées. */}
            {isNouveauBaremeV5 ? (
              <ScoreDetail notation={notation} score={analyse.scoreFaisabilite} />
            ) : (
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                Détail du score
              </span>

              <div className="mt-4 flex flex-col divide-y divide-zinc-100">
                  <>
                    {/* score_juridique_garde_fou (V2), qualification_juridique
                        (V3) et schema_version "v4" désignent tous un barème à
                        4 critères /25 ; leur absence signale une fiche à
                        l'ancien format (5 critères additionnés), pour
                        laquelle on garde l'affichage inchangé. */}
                    {(isNouveauBareme || isNouveauBaremeV3 || isV4 ? notationLabelsV2 : notationLabels).map(
                      ({ key, label, max, icon }) => (
                        <ScoreBar
                          key={key}
                          icon={icon}
                          label={label}
                          note={notation[key]}
                          max={max}
                          isGardeFou={false}
                          vetoApplique={false}
                        />
                      ),
                    )}

                    {isNouveauBareme ? (
                      <ScoreBar
                        icon={ICON_JURIDIQUE}
                        label="Faisabilité juridique (garde-fou)"
                        note={notation.score_juridique_garde_fou}
                        max={100}
                        isGardeFou
                        vetoApplique={Boolean(notation.veto_juridique_applique)}
                      />
                    ) : null}
                  </>
              </div>

              {/* V3 : l'incidence juridique n'est plus un score séparé —
                  seulement un texte explicatif quand l'ajustement n'est pas
                  nul (voir section 31 de la spec : jamais un second score
                  ni deux jauges concurrentes). */}
              {isNouveauBaremeV3 && qualificationJuridique.ajustement_juridique !== 0 ? (
                <div
                  className={`mt-4 rounded-xl border p-4 ${
                    qualificationJuridique.ajustement_juridique > 0
                      ? "border-emerald-200 bg-emerald-50/50"
                      : "border-amber-200 bg-amber-50/50"
                  }`}
                >
                  <p
                    className={`text-xs font-semibold uppercase tracking-wide ${
                      qualificationJuridique.ajustement_juridique > 0 ? "text-emerald-700" : "text-amber-700"
                    }`}
                  >
                    Incidence juridique{" "}
                    {qualificationJuridique.ajustement_juridique > 0
                      ? `positive (+${qualificationJuridique.ajustement_juridique})`
                      : `négative (${qualificationJuridique.ajustement_juridique})`}{" "}
                    sur le score
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-zinc-700">
                    {qualificationJuridique.justification_juridique}
                  </p>
                </div>
              ) : null}

              <Link
                href="/methode"
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 transition-colors hover:text-blue-800"
              >
                Voir comment nous notons
                <span aria-hidden="true">→</span>
              </Link>
            </div>
            )}

            {/* Extrait analysé */}
            <section>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    className="h-3.5 w-3.5 text-zinc-300"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M7.5 8.25h9m-9 3.75h4.5m-8.55 5.865c.5.196 1.032.336 1.582.412a10.5 10.5 0 0 0 9.4-4.5.75.75 0 0 0-.05-.87A10.457 10.457 0 0 0 12 3.75c-5.799 0-10.5 4.701-10.5 10.5 0 1.442.291 2.816.818 4.067a.75.75 0 0 1-.06.727l-1.045 1.567a.375.375 0 0 0 .343.564 4.483 4.483 0 0 0 2.694-.914Z"
                    />
                  </svg>
                  Extrait analysé
                </h2>
                <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-600">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    className="h-3.5 w-3.5"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                    />
                  </svg>
                  Sources publiques
                </span>
              </div>

              {/* Crayon de la mesure initiale ici seulement pour les fiches sans
                  bandeau « Mesure initiale » (même texte, un seul crayon). */}
              <Editable
                edition={editionExtrait}
                champ="proposition.texteOriginal"
                valeurBrute={declaration.texteOriginal}
                multiligne
              >
                <blockquote className={`mt-3 text-sm leading-relaxed text-zinc-600${editionExtrait ? " pr-11" : ""}`}>
                  &ldquo;{declaration.texteOriginal}&rdquo;
                </blockquote>
              </Editable>
            </section>

            {/* Raisonnement complet : liste numérotée d'étapes à plat,
                séparées par un trait fin (voir etapesRaisonnement plus haut). */}
            <div id="raisonnement-complet" className="scroll-mt-24">
              {/* font-sans pour la même raison que le H1 plus haut : aucune
                  maquette fournie (voir public/maquettes) ne montre de
                  titre en serif sur cette page ni ailleurs sur le site. */}
              <h2 className="font-sans text-2xl font-bold text-zinc-900">
                Le raisonnement complet
              </h2>

              <div className="mt-3 divide-y divide-zinc-200">
                {etapesRaisonnement.map((etape, index) => (
                  <EtapeRaisonnement key={etape.titre} numero={index + 1} titre={etape.titre} id={etape.id}>
                    {etape.contenu}
                  </EtapeRaisonnement>
                ))}
              </div>
            </div>

            {/* Fiabilité de l'analyse : bloc à part de la vue expert, séparé
                du raisonnement par le même trait que les autres blocs. */}
            {!isV4 ? (
              <div>
                <FiabiliteSection contenu={contenu} edition={edition} />
              </div>
            ) : null}
            </VueExpertSi>
            {versionBasique ? <ScriptVueInitiale /> : null}

            {/* Vote sur la mesure elle-même, juste après la Fiabilité de
                l'analyse — la maquette 413 (public/maquettes) montre "Et
                vous, qu'en pensez-vous ?" immédiatement sous ce bloc, pas
                plus haut sous "Détail du score" où il était placé avant
                (avec un second exemplaire ici même supprimé comme
                "doublon" — c'est en fait cette position-ci, pas l'autre,
                qui correspond à la maquette). */}
            {!preview ? (
              <VoteMesureWidget
                propositionId={declaration.id}
                initialAccord={declaration.voteMesureCounts.accord}
                initialDesaccord={declaration.voteMesureCounts.desaccord}
              />
            ) : null}

            {/* "Je trouve cette analyse pertinente" (qualité de l'analyse),
                distinct du vote sur la mesure elle-même ci-dessus. */}
            {!preview ? (
              <FeedbackWidget
                analyseId={analyse.id}
                initialLikes={declaration.feedbackCounts.likes}
                initialDislikes={declaration.feedbackCounts.dislikes}
              />
            ) : null}

            {/* Bandeau de confiance : voir TRUST_ITEMS plus haut. */}
            <div className="grid grid-cols-1 gap-6 rounded-2xl border border-zinc-200 bg-white p-6 sm:grid-cols-3 sm:p-8">
              {TRUST_ITEMS.map((item, index) => (
                <div key={item.title}>
                  <MonoTag>{String(index + 1).padStart(2, "0")}</MonoTag>
                  <p className="mt-1.5 font-mono text-sm font-bold text-zinc-900">
                    {item.title}
                  </p>
                  <p className="mt-0.5 font-mono text-sm leading-relaxed text-zinc-500">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Sidebar sticky : score permanent + sommaire de navigation,
              visibles ensemble dès le chargement (voir StickyScoreCard).
              Masquée en dessous de lg : sur mobile, la même carte est
              affichée plus haut, juste au-dessus du résumé (voir
              l'en-tête de colonne principale). */}
          <aside className="hidden lg:sticky lg:top-24 lg:block">
            <StickyScoreCard
              score={analyse.scoreFaisabilite}
              badge={badge}
              sections={tocSections}
              sectionsBasique={sectionsBasique}
              versionMethodologie={analyse.versionMethodologie}
              generationDateLabel={declaration.generationDateLabel}
              enBrefNotation={isNouveauBaremeV5 ? notation : null}
            />
          </aside>
        </div>
        </EnveloppeVue>

        {/* Bandeau "Rejoignez-nous" en bas de chaque analyse (même bandeau
            que la page d'accueil, avec un texte propre aux analyses). */}
        {!preview ? (
          <div className="mx-auto mt-10 w-full max-w-6xl">
            <SupportBanner
              embedded
              title={"Vous n’êtes pas d’accord avec cette analyse ?"}
              text={"Vous pensez que des choses manquent ? Relisez et commentez les analyses avant publication, en adhérant à l’association pour 2 €."}
            />
          </div>
        ) : null}
      </main>
    </div>
  );
}
