import Link from "next/link";

// Image du bandeau : public/bannière/Rejoindre.jpeg
// (le dossier contient un accent, on encode l'URL pour être sûr qu'elle
// fonctionne partout, en local comme sur Vercel).
const BANNER_IMAGE = encodeURI("/bannière/Rejoindre.jpeg");

// Textes par défaut (page d'accueil). Les pages d'analyse passent leurs
// propres textes via les props `title` et `text`.
const DEFAULT_TITLE = (
  <>
    L’objectivité ne se décrète pas.
    <br className="hidden sm:block" /> Elle se construit.
  </>
);
const DEFAULT_TEXT =
  "Relisez, commentez et challengez les analyses avant leur publication en adhérant à l'association pour 2€.";

// `buttonLabel` : texte du bouton (modifiable pour la page d'accueil).
// `embedded` : le bandeau est posé dans une page qui gère déjà ses marges
// (ex. page d'analyse) — on retire alors la <section> à marges propres.
// `compact` : version rétrécie (page d'accueil, où l'encart de don est posé
// juste à côté) — titre plus petit, texte et bouton l'un sous l'autre.
export default function SupportBanner({
  title = DEFAULT_TITLE,
  text = DEFAULT_TEXT,
  buttonLabel = "Rejoignez-nous →",
  embedded = false,
  compact = false,
}) {
  const card = (
    <div className="relative mx-auto h-full w-full max-w-[1280px] overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      {/* Image : en haut sur mobile, à gauche (≈ 60 %) sur grand écran */}
      <div className="relative h-40 w-full sm:h-52 lg:absolute lg:inset-y-0 lg:left-0 lg:h-auto lg:w-[65%]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={BANNER_IMAGE}
          alt=""
          aria-hidden="true"
          className="h-full w-full object-cover"
        />
        {/* Fondu vers le blanc : vers le bas sur mobile, vers la droite sur grand écran */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white lg:bg-gradient-to-r lg:via-transparent lg:to-white"
        />
      </div>

      {/* Texte + bouton */}
      <div
        className={
          compact
            ? "relative flex flex-col gap-4 px-6 pb-6 pt-2 lg:ml-auto lg:min-h-[220px] lg:w-[52%] lg:justify-center lg:py-8 lg:pl-0 lg:pr-8"
            : "relative flex flex-col gap-5 px-6 pb-6 pt-2 lg:ml-auto lg:min-h-[250px] lg:w-[46%] lg:justify-center lg:py-10 lg:pl-0 lg:pr-8"
        }
      >
        <h2
          className={
            compact
              ? "text-2xl font-extrabold leading-[1.05] tracking-tight text-zinc-900 sm:text-3xl"
              : "text-3xl font-extrabold leading-[1.05] tracking-tight text-zinc-900 sm:text-4xl"
          }
        >
          {title}
        </h2>

        <div
          className={
            compact
              ? "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between lg:flex-col lg:items-start"
              : "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
          }
        >
          <p className="text-sm leading-relaxed text-zinc-700 sm:text-base">
            {text}
          </p>
          <Link
            href="/nous-rejoindre"
            className="inline-flex shrink-0 items-center justify-center gap-2 self-start whitespace-nowrap rounded-full bg-zinc-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-700 sm:self-auto"
          >
            {buttonLabel}
          </Link>
        </div>
      </div>
    </div>
  );

  if (embedded) return card;

  return <section className="w-full px-6 pb-6 sm:px-8">{card}</section>;
}
