import { Fragment } from "react";
import Header from "@/components/Header";
import {
  IconeBalance,
  IconeFusee,
  IconeInstitution,
  IconeLoupe,
  IconePersonnesEtincelle,
} from "@/components/IconesRejoindre";
import { enLignes } from "@/lib/textes-site";
import { lireTextes } from "@/lib/textes-site-serveur";

export const metadata = {
  title: "Nous rejoindre — Perlimpinpin",
  description:
    "De l'intelligence artificielle à l'intelligence collective : rejoignez le Club Perlimpinpin pour challenger et améliorer nos analyses.",
};

// Page mise en cache (pas de requête en base à chaque visite). Elle est
// recalculée au plus tard une fois par jour, et immédiatement après chaque
// modification de texte depuis le mode édition.
export const revalidate = 86400;

const HELLOASSO_URL = "https://www.helloasso.com/associations/perlimpinpin-ai";

// Textes : par défaut dans src/lib/textes-site.js, éventuellement remplacés
// par ceux enregistrés en base (table TexteSite).
export default async function NousRejoindrePage() {
  const t = await lireTextes("nous-rejoindre");

  // Les 4 étapes du fonctionnement du Club (cartes numérotées).
  const etapes = [1, 2, 3, 4].map((n) => ({
    titre: t[`etape${n}.titre`],
    lignes: enLignes(t[`etape${n}.texte`]),
  }));

  // « Pourquoi nous rejoindre ? » : 4 points, chacun avec son icône.
  const raisons = [IconeBalance, IconeLoupe, IconePersonnesEtincelle, IconeFusee].map(
    (Icone, index) => ({
      Icone,
      titre: t[`pourquoi${index + 1}.titre`],
      lignes: enLignes(t[`pourquoi${index + 1}.texte`]),
    }),
  );

  // « Un outil indépendant » : ce que financent les adhésions et les dons.
  const financements = [1, 2, 3].map((n) => ({
    titre: t[`independance${n}.titre`],
    lignes: enLignes(t[`independance${n}.texte`]),
  }));

  const morceauxTitre = enLignes(t.titre);

  return (
    <div className="flex min-h-screen flex-col bg-page-gradient font-sans">
      <Header />

      <main className="w-full px-6 py-12 sm:px-8 sm:py-16">
        <div className="mx-auto w-full max-w-5xl">
          {/* Titre + introduction */}
          <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight text-zinc-900 sm:text-6xl">
            {morceauxTitre.map((morceau, index) => (
              <Fragment key={index}>
                {index > 0 ? (
                  <>
                    <br className="hidden sm:block" />{" "}
                  </>
                ) : null}
                {morceau}
              </Fragment>
            ))}
          </h1>

          <div className="mt-6 flex flex-col gap-3 text-base leading-relaxed text-zinc-600">
            {enLignes(t.introduction).map((ligne, index) => (
              <p key={index}>{ligne}</p>
            ))}
          </div>

          {/* Raccourci vers le bloc d'adhésion (#adherer, en bas de page) */}
          <a
            href="#adherer"
            className="mt-6 inline-flex items-center justify-center rounded-full border border-zinc-300 bg-white px-6 py-2.5 text-sm font-semibold text-zinc-900 transition-colors hover:bg-zinc-100"
          >
            {t["intro.bouton"]}
          </a>

          <hr className="mt-6 border-zinc-200" />

          {/* Les 4 étapes */}
          <ol className="mt-6 flex flex-col gap-4">
            {etapes.map((etape, index) => (
              <li
                key={index}
                className="flex gap-5 rounded-2xl border border-zinc-200 bg-white px-6 py-6 sm:gap-6 sm:px-7"
              >
                <span className="w-8 shrink-0 pt-1 text-2xl font-medium tabular-nums text-zinc-400">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span
                  aria-hidden="true"
                  className="mt-1.5 h-7 w-px shrink-0 bg-zinc-300"
                />
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-zinc-900">
                    {etape.titre}
                  </h2>
                  <div className="mt-2 flex flex-col gap-0.5 text-sm leading-relaxed text-zinc-600 sm:text-base">
                    {etape.lignes.map((ligne, i) => (
                      <p key={i}>{ligne}</p>
                    ))}
                  </div>
                </div>
              </li>
            ))}
          </ol>

          {/* Pourquoi nous rejoindre ? */}
          <section className="mt-12 border-t border-zinc-200 pt-8">
            <h2 className="text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-4xl">
              {t["pourquoi.titre"]}
            </h2>
            <p className="mt-2 text-base leading-relaxed text-zinc-600">{t["pourquoi.chapeau"]}</p>

            <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {raisons.map(({ Icone, titre, lignes }, index) => (
                <li
                  key={index}
                  className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white px-6 py-6 sm:px-7"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-100 text-zinc-800">
                    <Icone className="h-6 w-6" />
                  </span>
                  <h3 className="text-xl font-bold tracking-tight text-zinc-900">{titre}</h3>
                  <div className="flex flex-col gap-0.5 text-sm leading-relaxed text-zinc-600 sm:text-base">
                    {lignes.map((ligne, i) => (
                      <p key={i}>{ligne}</p>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* Un outil indépendant : carte sobre, façon « rapport d'audit » */}
          <section className="mt-12 rounded-2xl border border-zinc-300 bg-zinc-50 px-6 py-8 sm:px-10 sm:py-10">
            <h2 className="text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-4xl">
              {t["independance.titre"]}
            </h2>
            <p className="mt-2 text-lg font-semibold text-zinc-700">{t["independance.soustitre"]}</p>
            <div className="mt-4 flex flex-col gap-3 text-base leading-relaxed text-zinc-600">
              {enLignes(t["independance.texte"]).map((ligne, i) => (
                <p key={i}>{ligne}</p>
              ))}
            </div>

            <p className="mt-6 text-base font-semibold text-zinc-900">{t["independance.introListe"]}</p>
            <ol className="mt-3 flex flex-col divide-y divide-zinc-200 border-y border-zinc-200">
              {financements.map((financement, index) => (
                <li key={index} className="flex gap-4 py-4 sm:gap-5">
                  <span className="w-6 shrink-0 font-mono text-sm tabular-nums text-zinc-400">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h3 className="text-base font-bold text-zinc-900">{financement.titre}</h3>
                    <div className="mt-1 flex flex-col gap-0.5 text-sm leading-relaxed text-zinc-600 sm:text-base">
                      {financement.lignes.map((ligne, i) => (
                        <p key={i}>{ligne}</p>
                      ))}
                    </div>
                  </div>
                </li>
              ))}
            </ol>

            <p className="mt-6 font-mono text-xs tracking-wide text-zinc-500">
              {t["independance.mention"]}
            </p>
          </section>
        </div>

        {/* Bloc d'adhésion (cible du bouton de l'introduction). scroll-mt :
            le titre ne doit pas passer sous l'en-tête collant. */}
        <section
          id="adherer"
          className="mx-auto mt-12 w-full max-w-[1080px] scroll-mt-28 rounded-3xl border border-zinc-200 bg-gradient-to-br from-slate-100 via-orange-50 to-indigo-100 px-6 py-10 text-center sm:py-12"
        >
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-zinc-900 shadow-sm">
            <IconeInstitution className="h-7 w-7" />
          </span>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-5xl">
            {t["adhesion.titre"]}
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-zinc-600 sm:text-base">
            {t["adhesion.soustitre"]}
          </p>

          <div className="mx-auto mt-6 max-w-2xl rounded-2xl border border-zinc-200 bg-white/80 px-6 py-6 text-left sm:px-8">
            <h3 className="text-xl font-bold tracking-tight text-zinc-900">{t["adhesion.encadreTitre"]}</h3>
            <div className="mt-2 flex flex-col gap-0.5 text-sm leading-relaxed text-zinc-600 sm:text-base">
              {enLignes(t["adhesion.encadreTexte"]).map((ligne, i) => (
                <p key={i}>{ligne}</p>
              ))}
            </div>
            <p className="mt-3 text-xs text-zinc-500 sm:text-sm">{t["adhesion.reperes"]}</p>
          </div>

          <a
            href={HELLOASSO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex items-center justify-center rounded-full bg-zinc-900 px-10 py-4 text-base font-semibold text-white transition-colors hover:bg-zinc-700 sm:px-12"
          >
            {t["adhesion.bouton"]}
          </a>
        </section>
      </main>
    </div>
  );
}
