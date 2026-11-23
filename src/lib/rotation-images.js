// Rotation des images de la couverture des carrousels (image de thème et
// photo du candidat) : ne pas reprendre une image des derniers carrousels.
// Fonction PURE, testée par scripts/banque-images.test.js.

// Nombre de carrousels récents dont les images sont écartées.
export const CARROUSELS_EXCLUS = 2;

// Choisit un élément de `elements` :
//  - parmi ceux qui n'ont pas servi dans les `exclus` derniers carrousels
//    (`recentes` : clés des images utilisées, la plus récente d'abord, une
//    entrée par carrousel), au hasard avec `alea` (0 ≤ x < 1) ;
//  - s'il n'y en a aucun, le moins récemment utilisé.
// `cle(element)` donne la clé comparée à `recentes`. Renvoie null si
// `elements` est vide.
export function choisirEnRotation(elements, { cle = (e) => e, recentes = [], alea = 0, exclus = CARROUSELS_EXCLUS } = {}) {
  const liste = Array.isArray(elements) ? elements : [];
  if (liste.length === 0) return null;
  const historique = (Array.isArray(recentes) ? recentes : []).filter((r) => r !== null && r !== undefined).map(String);
  const bloquees = new Set(historique.slice(0, exclus));
  const libres = liste.filter((e) => !bloquees.has(String(cle(e))));
  if (libres.length) {
    const x = Math.max(0, Math.min(Number(alea) || 0, 0.999999));
    return libres[Math.floor(x * libres.length)];
  }
  // Toutes ont servi récemment : la moins récemment utilisée (rang le plus
  // grand dans l'historique ; jamais utilisée = la meilleure).
  const rang = (e) => {
    const i = historique.indexOf(String(cle(e)));
    return i < 0 ? Infinity : i;
  };
  return liste.reduce((meilleur, e) => (rang(e) > rang(meilleur) ? e : meilleur), liste[0]);
}

// Élément suivant pour les boutons « Changer d'image » / « Changer de photo » :
// celui qui suit `actuelle` dans `cles`, en sautant ceux de `eviter` quand
// c'est possible. Renvoie la clé, ou null si `cles` est vide.
export function cleSuivante(cles, actuelle, eviter = []) {
  const liste = (cles ?? []).map(String);
  if (liste.length === 0) return null;
  const evitees = new Set((eviter ?? []).filter((e) => e !== null && e !== undefined).map(String));
  const depart = Math.max(0, liste.indexOf(String(actuelle)));
  for (let k = 1; k <= liste.length; k++) {
    const candidate = liste[(depart + k) % liste.length];
    if (!evitees.has(candidate) && candidate !== String(actuelle)) return candidate;
  }
  return liste[(depart + 1) % liste.length];
}
