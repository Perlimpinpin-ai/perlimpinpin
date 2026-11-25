import Link from "next/link";
import Header from "@/components/Header";
import EncartDon from "@/components/EncartDon";
import { getScoreBands } from "@/lib/score";
import MethodeAnalysisSteps from "@/components/MethodeAnalysisSteps";
import TexteRiche from "@/components/TexteRiche";
import { enLignes } from "@/lib/textes-site";
import { lireTextes } from "@/lib/textes-site-serveur";

export const metadata = {
  title: "Méthode — Perlimpinpin",
  description:
    "Comment Perlimpinpin analyse et note les promesses politiques.",
};

// Page en cache, recalculée au plus tard toutes les heures et immédiatement
// après une modification depuis /test/textes/methode.
export const revalidate = 3600;

// Icônes dessinées à la main (formes simples), voir la même remarque dans
// MethodeAnalysisSteps.js : plus sûr qu'un tracé Heroicons recopié de
// mémoire pour une icône purement décorative.
const ICON_FLAG = (
  <path
    strokeLinecap="round"
    strokeLinejoin="round"
    d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5"
  />
);
const ICON_SHIELD_CHECK = (
  <path
    strokeLinecap="round"
    strokeLinejoin="round"
    d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z"
  />
);
const ICON_DOCUMENT_CHECK = (
  <>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M7 3.75h6l4 4V19a1.25 1.25 0 0 1-1.25 1.25H7A1.25 1.25 0 0 1 5.75 19V5A1.25 1.25 0 0 1 7 3.75Z"
    />
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 3.75V8h4.25" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 13.25 11 15.25 15 11" />
  </>
);
const ICON_CHAT_BUBBLES = (
  <>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M4 5.5h11a2 2 0 0 1 2 2V13a2 2 0 0 1-2 2H9l-3.5 3V15H4a2 2 0 0 1-2-2V7.5a2 2 0 0 1 2-2Z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M20 9.5a2 2 0 0 1 2 2V16a2 2 0 0 1-2 2h-.5v2.5L17 18h-1"
    />
  </>
);
const ICON_CALCULATOR = (
  <>
    <rect x="5" y="3.75" width="14" height="16.5" rx="1.5" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7.5h8" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.008M12 12h.008M16 12h.008M8 15.5h.008M12 15.5h.008M16 15.5h.008" />
  </>
);

// Icônes des 5 critères : mêmes tracés qu'ICON_OPERATIONNEL/EFFICACITE/
// REBONDS/PREPARATION/ALIGNEMENT sur la fiche déclaration (voir
// src/app/declarations/[id]/page.js) — repris tels quels, même langage
// visuel que le reste du site pour ces 5 mêmes concepts.
const ICON_CRITERE_OPERATIONNEL = (
  <path
    strokeLinecap="round"
    strokeLinejoin="round"
    d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
  />
);
const ICON_CRITERE_EFFICACITE = (
  <>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 0 1 1.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.559.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 0 1-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 0 1-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.558-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 0 1 .12-1.45l.773-.773a1.125 1.125 0 0 1 1.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894Z"
    />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
  </>
);
const ICON_CRITERE_REBONDS = (
  <>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 15c1.5-2 3-2 4.5 0s3 2 4.5 0 3-2 4.5 0 3 2 4.5 0" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10c1.5-2 3-2 4.5 0s3 2 4.5 0 3-2 4.5 0 3 2 4.5 0" />
  </>
);
const ICON_CRITERE_PREPARATION = (
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
const ICON_CRITERE_ALIGNEMENT = (
  <>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v16.5M8 3h8" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 8l-2.5 5a2.5 2.5 0 0 0 5 0L5 8Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 8l-2.5 5a2.5 2.5 0 0 0 5 0L19 8Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14" />
  </>
);

// Icônes des 5 critères et des 4 garde-fous. Les textes viennent de
// src/lib/textes/methode.js (modifiables depuis /test/textes/methode).
const criteria = [
  {
    id: "01",
    icon: ICON_CRITERE_OPERATIONNEL,
  },
  {
    id: "02",
    icon: ICON_CRITERE_EFFICACITE,
  },
  {
    id: "03",
    icon: ICON_CRITERE_REBONDS,
  },
  {
    id: "04",
    icon: ICON_CRITERE_PREPARATION,
  },
  {
    id: "05",
    icon: ICON_CRITERE_ALIGNEMENT,
  },
];

const guardrails = [
  {
    id: "01",
    icon: ICON_SHIELD_CHECK,
  },
  {
    id: "02",
    icon: ICON_DOCUMENT_CHECK,
  },
  {
    id: "03",
    icon: ICON_CHAT_BUBBLES,
  },
  {
    id: "04",
    icon: ICON_CALCULATOR,
  },
];

// Bloc B : ordre croissant (0-19 → 90-100) pour la barre dégradée et les 6
// colonnes, à l'inverse de getScoreBands() qui renvoie du plus haut score
// au plus bas (voir son commentaire dans src/lib/score.js).
const scoreBandsAsc = getScoreBands().slice().reverse();

function Tag({ children }) {
  return (
    <span className="font-mono text-xs font-semibold uppercase tracking-widest text-zinc-400">
      {children}
    </span>
  );
}

// Un paragraphe par ligne, avec *gras* et [liens](/adresse) possibles.
function Paragraphes({ texte, className }) {
  return enLignes(texte).map((ligne, index) => (
    <p key={index} className={className}>
      <TexteRiche texte={ligne} />
    </p>
  ));
}

export default async function MethodePage() {
  const t = await lireTextes("methode");

  return (
    <div className="flex min-h-screen flex-col bg-page-gradient font-sans">
      <Header />

      <main className="w-full px-6 py-12 sm:px-8 sm:py-16 lg:px-[78px]">
        <div className="mx-auto w-full max-w-[1600px]">
          {/* Hero unique (Bloc C) : la page avait jusqu'ici deux hero
              consécutifs ("Notre méthode" puis "Comment fonctionne une
              analyse") — un doublon éditorial incorrect (voir la demande
              d'origine). Un seul hero directement au-dessus du pipeline. */}
          <Tag>{t["entete.etiquette"]}</Tag>
          <h1 className="mt-[25px] max-w-[520px] text-5xl font-extrabold leading-[1.08] tracking-tight text-zinc-900">
            {t["entete.titre"]}
          </h1>
          <p className="mt-5 max-w-[390px] text-lg leading-relaxed text-zinc-500">
            {t["entete.texte"]}
          </p>

          <div className="mt-12">
            <MethodeAnalysisSteps textes={t} />
          </div>

          {/* Les cinq critères */}
          <div className="mt-16 rounded-2xl border border-zinc-200 bg-white p-6 sm:p-8">
            <h2 className="text-2xl font-bold text-zinc-900">
              {t["criteres.titre"]}
            </h2>

            <div className="mt-6 grid grid-cols-1 gap-8 sm:grid-cols-3">
              {criteria.map((item, index) => (
                <div
                  key={item.id}
                  className={
                    index % 3 !== 0
                      ? "flex flex-col gap-3 sm:border-l sm:border-zinc-200 sm:pl-6"
                      : "flex flex-col gap-3"
                  }
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.5}
                      className="h-6 w-6"
                      aria-hidden="true"
                    >
                      {item.icon}
                    </svg>
                  </span>

                  <div>
                    <span className="font-mono text-xs font-semibold text-zinc-400">
                      {`// ${item.id}`}
                    </span>
                    <p className="mt-1 text-sm font-bold leading-snug text-zinc-900">
                      {t[`critere${index + 1}.titre`]}
                    </p>
                    <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">
                      {t[`critere${index + 1}.texte`]}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* La note finale (Bloc B) */}
          <div className="mt-16">
            <Tag>{t["note.etiquette"]}</Tag>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-4xl">
              {t["note.titre"]}
            </h2>
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-zinc-500">
              {t["note.texte"]}
            </p>

            {/* Un seul dégradé continu (7 stops) en fond, sans les bordures
                verticales blanches qui séparaient auparavant les 6 tranches
                (voir la demande d'origine : plus de rupture nette entre les
                couleurs). Les libellés restent 6 colonnes flex-1 égales —
                mêmes positions qu'avant — mais ne portent plus ni fond ni
                bordure, seulement le texte, posées par-dessus. */}
            <div className="relative mt-8 h-24 w-full overflow-hidden rounded-2xl sm:h-32">
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "radial-gradient(120% 140% at 52% 35%, rgba(255,255,255,0.28), transparent 60%), linear-gradient(to right, #6b1414, #dc2626 18%, #f97316 34%, #fde047 50%, #a3e635 62%, #22c55e 78%, #14532d 100%)",
                }}
              />

              {/* Grain/bruit subtil (aspect "papier" plutôt que plat) :
                  feTurbulence génère un bruit RGBA, feColorMatrix ne garde
                  que l'alpha (dérivé du canal bleu) pour obtenir un voile
                  noir à opacité variable, posé en mix-blend-overlay à faible
                  opacité — jamais un aplat, juste une texture. seed fixe
                  pour un rendu stable (pas de re-tirage aléatoire au
                  re-render). */}
              <svg
                className="pointer-events-none absolute inset-0 h-full w-full opacity-25 mix-blend-overlay"
                aria-hidden="true"
              >
                <filter id="score-bar-grain">
                  <feTurbulence
                    type="fractalNoise"
                    baseFrequency="0.85"
                    numOctaves={2}
                    seed={7}
                    stitchTiles="stitch"
                  />
                  <feColorMatrix
                    type="matrix"
                    values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.6 0"
                  />
                </filter>
                <rect width="100%" height="100%" filter="url(#score-bar-grain)" />
              </svg>

              <div className="relative flex h-full w-full">
                {scoreBandsAsc.map((band) => (
                  <div
                    key={band.label}
                    className="flex flex-1 items-center justify-center"
                  >
                    <span className="px-1 text-center text-sm font-bold text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.35)] sm:text-lg">
                      {band.min}–{band.max}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 lg:grid-cols-6">
              {scoreBandsAsc.map((band) => (
                <div key={band.label}>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    className={`h-5 w-5 ${band.flag}`}
                    aria-hidden="true"
                  >
                    {ICON_FLAG}
                  </svg>
                  <p className="mt-2 text-sm font-semibold text-zinc-900">
                    {band.min} – {band.max}
                  </p>
                  <p className={`text-sm font-bold ${band.score}`}>{band.label}</p>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                    {band.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* D'où vient notre grille — contenu existant, non couvert par
              les blocs de la refonte, conservé tel quel. */}
          <div className="mt-16 max-w-2xl">
            <h2 className="text-2xl font-bold text-zinc-900">
              {t["grille.titre"]}
            </h2>

            <Paragraphes
              texte={t["grille.texte"]}
              className="mt-4 text-sm leading-relaxed text-zinc-600"
            />
          </div>

          {/* Notre processus de vérification (Bloc E) */}
          <div className="mt-16 max-w-2xl">
            <h2 className="text-2xl font-bold text-zinc-900">
              {t["verification.titre"]}
            </h2>

            <Paragraphes
              texte={t["verification.texte"]}
              className="mt-4 text-sm leading-relaxed text-zinc-600"
            />
          </div>

          {/* Le Club Perlimpinpin : la relecture des analyses par les
              membres, avec un lien vers le bloc d'adhésion de /nous-rejoindre. */}
          <div className="mt-16 max-w-3xl rounded-3xl border border-zinc-200 bg-gradient-to-br from-slate-100 via-orange-50 to-indigo-100 p-6 sm:p-8">
            <Tag>{t["club.etiquette"]}</Tag>
            <h2 className="mt-3 text-2xl font-bold text-zinc-900">
              {t["club.titre"]}
            </h2>
            <Paragraphes
              texte={t["club.texte"]}
              className="mt-4 text-sm leading-relaxed text-zinc-700"
            />
            <Link
              href="/nous-rejoindre#adherer"
              className="mt-6 inline-flex items-center justify-center rounded-full bg-zinc-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-700"
            >
              {t["club.bouton"]}
            </Link>
          </div>

          {/* Nos garde-fous (Bloc D) */}
          <div className="mt-16 rounded-2xl border border-zinc-200 bg-white p-6 sm:p-8">
            <h2 className="text-2xl font-bold text-zinc-900">
              {t["gardefous.titre"]}
            </h2>

            <div className="mt-6 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {guardrails.map((item, index) => (
                <div
                  key={item.id}
                  // Séparateur vertical sauf sur la 1re carte de chaque ligne :
                  // 2 colonnes (sm) → cartes 2 et 4 ; 4 colonnes (lg) → cartes 2, 3 et 4.
                  className={[
                    "flex flex-col gap-3",
                    index % 2 === 1 && "sm:border-l sm:border-zinc-200 sm:pl-6",
                    index % 4 === 2 && "lg:border-l lg:border-zinc-200 lg:pl-6",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.5}
                      className="h-6 w-6"
                      aria-hidden="true"
                    >
                      {item.icon}
                    </svg>
                  </span>

                  <div>
                    <span className="font-mono text-xs font-semibold text-zinc-400">
                      {`// ${item.id}`}
                    </span>
                    <p className="mt-1 text-sm font-bold leading-snug text-zinc-900">
                      {t[`gardefou${index + 1}.titre`]}
                    </p>
                    {t[`gardefou${index + 1}.texte`] ? (
                      <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">
                        {t[`gardefou${index + 1}.texte`]}
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Ce que Perlimpinpin n'est pas (Bloc F) */}
          {/* À côté (grand écran) ou en dessous (mobile) : l'encart de don,
              au moment où le lecteur vient de lire nos garde-fous et ce que
              nous ne sommes pas. */}
          <div className="mt-16 mb-16 flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-bold text-zinc-900">
                {t["nonpas.titre"]}
              </h2>
              <Paragraphes
                texte={t["nonpas.texte"]}
                className="mt-4 text-sm leading-relaxed text-zinc-600"
              />
            </div>
            <EncartDon
              titre="Notre méthode est publique."
              texte="Notre indépendance dépend de vous."
              emplacement="methode"
              apparition
              className="lg:mt-1 lg:w-[320px] lg:shrink-0"
            />
          </div>
        </div>
      </main>
    </div>
  );
}
