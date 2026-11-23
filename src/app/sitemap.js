import { getHorsSeries } from "@/lib/hors-series";
import { getPublishedPropositionsForSitemap } from "@/lib/queries";

// Recalculé au plus tard une fois par jour, et aussitôt après chaque
// publication (src/lib/rafraichir-public.js) : un passage de robot ne lit plus
// la base à chaque fois.
export const revalidate = 86400;

const BASE_URL = "https://perlimpinpin.ai";

// Pages statiques importantes du site public (hors fiches déclarations,
// ajoutées dynamiquement ci-dessous). /declarations, /prix-perlimpinpin,
// /objectifs et /sources ne sont pas dans la liste explicite de la demande
// d'origine ; on s'en tient à ce qui a été demandé.
const STATIC_ROUTES = [
  "",
  "/candidats",
  "/themes",
  "/dossiers",
  "/methode",
  "/a-propos",
  // Pages des dossiers du registre (les dossiers non visibles en sont absents).
  ...getHorsSeries().map((hs) => `/dossiers/${hs.slug}`),
];

export default async function sitemap() {
  const staticEntries = STATIC_ROUTES.map((route) => ({
    url: `${BASE_URL}${route}`,
  }));

  const propositions = await getPublishedPropositionsForSitemap();
  const declarationEntries = propositions.map(({ id, lastModified }) => ({
    url: `${BASE_URL}/declarations/${id}`,
    ...(lastModified ? { lastModified } : {}),
  }));

  return [...staticEntries, ...declarationEntries];
}
