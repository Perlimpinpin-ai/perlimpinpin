import Header from "@/components/Header";
import EncartDon from "@/components/EncartDon";
import ShareButton from "@/components/ShareButton";
import SectionHeading from "@/components/SectionHeading";
import TexteRiche from "@/components/TexteRiche";
import { enLignes } from "@/lib/textes-site";
import { lireTextes } from "@/lib/textes-site-serveur";

export const metadata = {
  title: "À propos — Perlimpinpin",
  description: "Qui est derrière Perlimpinpin et pourquoi ce projet existe.",
};

// Page en cache, recalculée au plus tard toutes les heures et immédiatement
// après une modification depuis /test/textes/a-propos.
export const revalidate = 3600;

const CLASSE_LIEN = "text-blue-600 transition-colors hover:text-blue-800";
const CLASSE_LIEN_AUTEURS =
  "font-semibold text-zinc-600 underline decoration-zinc-300 underline-offset-2 transition-colors hover:text-blue-700";

// Chaque section de l'essai : séparateur fin au-dessus pour la distinguer
// du paragraphe précédent, puis SectionHeading (accent vertical bleu/indigo,
// composant partagé — voir Étape 0.3 de la demande d'audit).
function Section({ title, children }) {
  return (
    <div className="pt-6">
      <hr className="border-zinc-200" />
      <div className="mt-6 flex flex-col gap-4">
        <SectionHeading>{title}</SectionHeading>
        {children}
      </div>
    </div>
  );
}

// Un paragraphe par ligne du texte. Mise en forme : *gras* et [lien](/adresse)
// (voir src/components/TexteRiche.js).
function Paragraphes({ texte }) {
  return enLignes(texte).map((ligne, index) => (
    <p key={index} className="text-base leading-relaxed text-zinc-600">
      <TexteRiche texte={ligne} classeLien={CLASSE_LIEN} />
    </p>
  ));
}

// Textes : par défaut dans src/lib/textes/a-propos.js, éventuellement
// remplacés par ceux enregistrés en base (modifiables depuis /test/textes).
export default async function AProposPage() {
  const t = await lireTextes("a-propos");

  return (
    <div className="flex min-h-screen flex-col bg-page-gradient font-sans">
      <Header />

      {/* Bandeau plein cadre propre à cet édito (pas un template réutilisé
          par d'autres articles — /a-propos est une page dédiée) : bord à
          bord horizontalement, aucune bordure/coin arrondi/carte visible,
          contrairement à la première tentative. Les rubans diagonaux
          (indigo à gauche, corail à droite) sont dessinés en SVG plutôt
          qu'en radial-gradient CSS pour l'aspect "vagues qui se croisent"
          de la maquette — un radial-gradient ne peut produire que des
          taches, jamais des rubans obliques. Le fond se dilue vers le blanc
          en bas via mask-image (dégradé noir→transparent), jamais une
          simple coupure nette de couleur. */}
      <div className="relative w-full overflow-hidden">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 hidden h-[300px] md:block"
          aria-hidden="true"
          style={{
            maskImage: "linear-gradient(to bottom, black, transparent)",
            WebkitMaskImage: "linear-gradient(to bottom, black, transparent)",
          }}
        >
          <svg
            viewBox="0 0 1600 320"
            preserveAspectRatio="none"
            className="h-full w-full"
            aria-hidden="true"
          >
            <defs>
              <filter id="apropos-banner-blur" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="28" />
              </filter>
            </defs>
            <g filter="url(#apropos-banner-blur)">
              <ellipse cx="260" cy="150" rx="430" ry="95" fill="#818cf8" opacity="0.55" transform="rotate(-18 260 150)" />
              <ellipse cx="410" cy="55" rx="380" ry="70" fill="#a5b4fc" opacity="0.45" transform="rotate(12 410 55)" />
              <ellipse cx="1340" cy="160" rx="430" ry="95" fill="#fb923c" opacity="0.5" transform="rotate(18 1340 160)" />
              <ellipse cx="1220" cy="60" rx="380" ry="70" fill="#fda4af" opacity="0.4" transform="rotate(-12 1220 60)" />
            </g>
          </svg>
        </div>

        <div className="relative mx-auto w-full max-w-3xl px-6 pb-4 pt-10 text-center sm:px-8 md:pt-20">
          {/* Calé à l'origine sur la maquette 440 (~90-100px de corps,
              comme HeroText/Thèmes), puis réduit de 30% à la demande
              explicite pour ce titre précis — les trois valeurs du clamp()
              sont donc chacune 70% de leur valeur mesurée sur la maquette,
              pas une nouvelle mesure. */}
          <h1 className="font-sans text-[clamp(1.575rem,0.77rem+3.64vw,4.2rem)] font-bold leading-tight tracking-tight text-zinc-900">
            {t["entete.titre"]}
            <span className="text-indigo-400">.</span>
          </h1>

          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-zinc-500">
            {t["entete.soustitre"]}
          </p>
        </div>
      </div>

      <main className="w-full px-6 py-12 sm:px-8 sm:py-16">
        <article className="mx-auto w-full max-w-3xl">
          <div className="flex flex-col items-center text-center">
            <div className="h-px w-10 bg-zinc-300" aria-hidden="true" />

            <p className="mt-6 text-sm font-medium text-zinc-500">
              <TexteRiche texte={t["entete.auteurs"]} classeLien={CLASSE_LIEN_AUTEURS} />
            </p>

            <div className="mt-6 flex justify-center">
              <ShareButton />
            </div>
          </div>

          <hr className="mt-6 border-zinc-200" />

          <div className="mx-auto mt-10 mb-16 flex max-w-[68ch] flex-col gap-4">
            <Paragraphes texte={t.introduction} />

            {[1, 2, 3, 4, 5].map((n) => (
              <Section key={n} title={t[`section${n}.titre`]}>
                <Paragraphes texte={t[`section${n}.texte`]} />
              </Section>
            ))}

            <EncartDon
              titre="Pas de pub, pas de parti, pas d’actionnaire."
              texte="Juste des citoyens qui financent la vérification."
              emplacement="a-propos"
              format="bandeau"
              apparition
              className="mt-8"
            />
          </div>
        </article>
      </main>
    </div>
  );
}
