// Adresse publique d'une fiche : /declarations/<slug>, où le slug reprend le
// titre de la fiche (ex. /declarations/diviser-par-deux-l-immigration-legale).
//
// Règles (voir aussi src/lib/slug-db.js pour l'écriture en base) :
//   - minuscules, accents retirés (é → e, ç → c, œ → oe…), tout ce qui n'est
//     ni lettre ni chiffre devient un tiret, jamais de tiret double ni en
//     début/fin ; les petits mots (de, la, l…) sont gardés pour la lisibilité ;
//   - 80 caractères au plus, coupés sur un mot entier ;
//   - unicité : si le slug est déjà pris, on ajoute le nom du candidat, puis
//     -2, -3… ;
//   - stabilité : le slug est enregistré une fois (au clic « Publier », ou par
//     scripts/remplir-slugs.js pour les fiches déjà en ligne) et n'est JAMAIS
//     recalculé ensuite, même si le titre est corrigé.
//
// À ne pas confondre avec slugFiche() (src/lib/fiche-annotations-core.js), qui
// produit la clé interne « fiche-<id> » des annotations du Club et ne change pas.
//
// Fichier sans dépendance (ni Prisma ni Next) : importable par les scripts et
// par les tests node --test.

export const LONGUEUR_MAX_SLUG = 80;
export const URL_SITE = "https://perlimpinpin.ai";

// Lettres que la décomposition Unicode (NFD) ne sépare pas de leur « accent ».
const LIGATURES = [
  [/œ/g, "oe"],
  [/Œ/g, "OE"],
  [/æ/g, "ae"],
  [/Æ/g, "AE"],
  [/ß/g, "ss"],
];

export function slugify(texte, max = LONGUEUR_MAX_SLUG) {
  let s = String(texte ?? "");
  for (const [motif, remplacement] of LIGATURES) s = s.replace(motif, remplacement);
  s = s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    // Séparateur de milliers (espace, espace insécable, point) : 1 700 € → 1700.
    .replace(/(\d)[\s  .](?=\d{3}(?!\d))/g, "$1")
    .replace(/%/g, " pour cent ")
    .replace(/€/g, " euros ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (s.length > max) {
    // Coupe sur le dernier tiret avant la limite (mot entier) ; un seul mot
    // plus long que la limite est coupé net.
    const debut = s.slice(0, max + 1);
    const tiret = debut.lastIndexOf("-");
    s = (tiret > 0 ? debut.slice(0, tiret) : s.slice(0, max)).replace(/-+$/, "");
  }
  return s;
}

// Choisit le slug d'une fiche. `estPris(slug)` dit si une AUTRE fiche l'a déjà.
// Titre vide : « fiche-<id> » (garde une adresse lisible et unique).
// Un slug fait uniquement de chiffres (titre « 2027 ») est refusé : il se
// confondrait avec une ancienne adresse numérique (/declarations/103).
export function choisirSlug({ titre, candidat, propositionId }, estPris) {
  const base = slugify(titre) || (propositionId ? `fiche-${propositionId}` : "fiche");
  if (!estPris(base) && !/^\d+$/.test(base)) return base;

  const suffixeCandidat = slugify(candidat, 60) || "fiche";
  const avecCandidat = `${base}-${suffixeCandidat}`;
  if (!estPris(avecCandidat)) return avecCandidat;

  for (let n = 2; ; n++) {
    const essai = `${avecCandidat}-${n}`;
    if (!estPris(essai)) return essai;
  }
}

// Plan de remplissage (scripts/remplir-slugs.js) : attribue un slug à chaque
// fiche SANS slug, par numéro croissant (la plus ancienne garde le slug le plus
// court en cas de titres identiques). Les slugs déjà en base ne bougent pas.
// fiches : [{ id, titre, candidat, slug }] → [{ id, titre, candidat, slug, note }]
export function planSlugs(fiches) {
  const pris = new Set(fiches.map((f) => f.slug).filter(Boolean));
  const plan = [];
  for (const fiche of [...fiches].sort((a, b) => a.id - b.id)) {
    if (fiche.slug) continue;
    const base = slugify(fiche.titre) || `fiche-${fiche.id}`;
    const slug = choisirSlug({ titre: fiche.titre, candidat: fiche.candidat, propositionId: fiche.id }, (s) => pris.has(s));
    pris.add(slug);
    let note = "";
    if (!fiche.titre) note = "titre vide";
    else if (slug !== base) note = /-\d+$/.test(slug.slice(base.length)) ? "doublon : candidat + numéro" : "doublon : nom du candidat ajouté";
    plan.push({ id: fiche.id, titre: fiche.titre, candidat: fiche.candidat, slug, note });
  }
  return plan;
}

// Paramètre d'adresse uniquement numérique : ancienne adresse /declarations/103.
const ID_NUMERIQUE = /^[1-9]\d{0,9}$/;
// Forme d'un slug valide (sert aussi de liste blanche pour les adresses de retour).
export const MOTIF_SLUG = "[a-z0-9]+(?:-[a-z0-9]+)*";
const SLUG_VALIDE = new RegExp(`^${MOTIF_SLUG}$`);

export function estIdNumerique(parametre) {
  return typeof parametre === "string" && ID_NUMERIQUE.test(parametre);
}

export function estSlugValide(parametre) {
  return typeof parametre === "string" && parametre.length <= 160 && SLUG_VALIDE.test(parametre) && /[a-z]/.test(parametre);
}

// Chemin public d'une fiche : son slug s'il existe, sinon son numéro (fiche
// pas encore dotée d'un slug : l'ancienne adresse marche toujours).
export function cheminFiche({ id, propositionId, slug } = {}) {
  const numero = propositionId ?? id;
  return `/declarations/${slug || numero}`;
}

export function urlFiche(fiche) {
  return `${URL_SITE}${cheminFiche(fiche)}`;
}

// Décide quoi faire d'un paramètre /declarations/<parametre> :
//   { type: "fiche", propositionId }  → afficher la fiche ;
//   { type: "redirection", chemin }   → redirection permanente (ancienne adresse) ;
//   { type: "introuvable" }           → 404.
// `parId(id)` renvoie { id, slug } ou null ; `parSlug(slug)` renvoie { id } ou null.
export async function resoudreParametreFiche(parametre, { parId, parSlug }) {
  let valeur = parametre;
  try {
    valeur = decodeURIComponent(parametre);
  } catch {
    return { type: "introuvable" };
  }

  if (estIdNumerique(valeur)) {
    const fiche = await parId(Number(valeur));
    if (!fiche) return { type: "introuvable" };
    // Fiche pas encore dotée d'un slug : affichée à son ancienne adresse.
    if (!fiche.slug) return { type: "fiche", propositionId: fiche.id };
    return { type: "redirection", chemin: cheminFiche(fiche) };
  }

  if (!estSlugValide(valeur)) return { type: "introuvable" };
  const fiche = await parSlug(valeur);
  return fiche ? { type: "fiche", propositionId: fiche.id } : { type: "introuvable" };
}

// Ancienne adresse /declarations/<numéro> reçue par le proxy (src/proxy.js) :
// renvoie { statut: 301, url } vers /declarations/<slug> (paramètres et ancre
// conservés), ou null pour laisser passer (pas une adresse numérique, requête
// interne de Next, fiche inconnue ou sans slug : la page s'en charge).
// `lireSlug(id)` renvoie le slug de la mesure, ou null.
export async function redirectionAncienneAdresse(url, { lireSlug, rsc = false }) {
  const numero = /^\/declarations\/([1-9]\d{0,9})\/?$/.exec(url.pathname)?.[1];
  if (!numero || rsc) return null;
  const slug = await lireSlug(Number(numero));
  if (!slug || !estSlugValide(slug)) return null;
  const cible = new URL(url);
  cible.pathname = `/declarations/${slug}`;
  return { statut: 301, url: cible };
}
