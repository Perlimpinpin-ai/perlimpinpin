// Lecture / écriture du slug d'une fiche en base (règles : src/lib/slug.js).
// `client` est le client Prisma ou une transaction (tx) : sans import de
// src/lib/prisma.js, pour rester testable avec un faux client.
import { choisirSlug } from "./slug.js";

async function lireFiche(client, propositionId) {
  return client.proposition.findUnique({
    where: { id: propositionId },
    select: { id: true, slug: true, titre: true, candidat: { select: { nom: true } } },
  });
}

async function calculer(client, fiche) {
  const existants = await client.proposition.findMany({
    where: { slug: { not: null }, id: { not: fiche.id } },
    select: { slug: true },
  });
  const pris = new Set(existants.map((p) => p.slug));
  return choisirSlug({ titre: fiche.titre, candidat: fiche.candidat?.nom, propositionId: fiche.id }, (s) => pris.has(s));
}

// Slug qu'aurait la fiche, SANS rien écrire (mode TEST_DRY_RUN=1).
// → { slug, existant } (existant : déjà enregistré, ne changera pas)
export async function slugPrevu(client, propositionId) {
  const fiche = await lireFiche(client, propositionId);
  if (!fiche) return null;
  if (fiche.slug) return { slug: fiche.slug, existant: true };
  return { slug: await calculer(client, fiche), existant: false };
}

// Enregistre le slug de la fiche s'il n'existe pas encore ; ne l'écrase JAMAIS.
// → { slug, nouveau }
export async function attribuerSlug(client, propositionId) {
  const fiche = await lireFiche(client, propositionId);
  if (!fiche) throw new Error(`Mesure ${propositionId} introuvable.`);
  if (fiche.slug) return { slug: fiche.slug, nouveau: false };

  const slug = await calculer(client, fiche);
  // `slug: null` dans le filtre : si quelqu'un l'a rempli entre-temps, on ne
  // l'écrase pas (count = 0) et on relit la valeur enregistrée.
  const { count } = await client.proposition.updateMany({ where: { id: fiche.id, slug: null }, data: { slug } });
  if (count === 1) return { slug, nouveau: true };
  const relu = await lireFiche(client, propositionId);
  return { slug: relu?.slug ?? null, nouveau: false };
}
