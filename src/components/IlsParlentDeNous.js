import presse from "@/lib/presse";

// Encart « Ils parlent de nous » de l'accueil, à droite de l'encart
// « Transparence et indépendance » (en dessous sur mobile).
// Liste des médias : src/lib/presse.js.
// Logos en gris et un peu transparents, couleurs d'origine au survol.
export default function IlsParlentDeNous({ titre }) {
  const medias = presse.filter((media) => media.logo);
  if (medias.length === 0) return null;

  return (
    <aside
      aria-labelledby="ils-parlent-de-nous"
      className="flex flex-col justify-center rounded-2xl border border-zinc-200 bg-white p-6"
    >
      <p
        id="ils-parlent-de-nous"
        className="text-center text-xs font-medium uppercase tracking-[0.2em] text-zinc-500"
      >
        {titre}
      </p>
      <ul className="mt-4 flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
        {medias.map((media) => {
          const hauteur = media.hauteur ?? 36;
          // SVG ou petit PNG servis tels quels : pas besoin de next/image.
          const logo = (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={media.logo}
              alt={media.nom}
              style={{ height: hauteur }}
              className="w-auto max-w-[120px] object-contain opacity-60 grayscale transition duration-200 group-hover:opacity-100 group-hover:grayscale-0 group-focus-visible:opacity-100 group-focus-visible:grayscale-0"
              loading="lazy"
              decoding="async"
            />
          );
          return (
            <li key={media.nom} className="flex items-center">
              {media.url ? (
                <a
                  href={media.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${media.ariaLabel ?? `Article de ${media.nom} sur Perlimpinpin`} (nouvel onglet)`}
                  className="group block rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-400"
                >
                  {logo}
                </a>
              ) : (
                <span className="group block">{logo}</span>
              )}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
