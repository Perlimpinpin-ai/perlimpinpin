// Catégorie Wikimedia Commons de chaque candidat (slug de src/lib/carte.js),
// notée une fois pour toutes : scripts/chercher-photos-candidats.js y cherche
// les photos proposées sur /test/photos-candidats. Catégories vérifiées sur
// commons.wikimedia.org le 22/11/2026 (toutes existent).
export const CATEGORIES_COMMONS = {
  "bruno-retailleau": "Category:Bruno Retailleau",
  "david-lisnard": "Category:David Lisnard",
  "dominique-de-villepin": "Category:Dominique de Villepin",
  "edouard-philippe": "Category:Édouard Philippe",
  "eric-zemmour": "Category:Éric Zemmour",
  "fabien-roussel": "Category:Fabien Roussel",
  "gabriel-attal": "Category:Gabriel Attal",
  "jean-luc-melenchon": "Category:Jean-Luc Mélenchon",
  "marine-le-pen": "Category:Marine Le Pen",
  "marine-tondelier": "Category:Marine Tondelier",
  "raphael-glucksmann": "Category:Raphaël Glucksmann",
  "teddy-riner": "Category:Teddy Riner",
};

// Nom affiché du candidat d'après son slug (titre de la catégorie).
export function nomDepuisSlug(slug) {
  return CATEGORIES_COMMONS[slug]?.replace(/^Category:/, "") ?? slug;
}
