// État « connecté au Club ou visiteur » vu du navigateur : logique PURE,
// testée par scripts/session-club.test.js (la lecture réseau est injectée).
//
// Pourquoi un petit magasin et pas une simple promesse gardée en mémoire :
// une page peut être affichée avec un état d'AVANT la connexion (page
// restaurée par « Retour », page préchargée par le navigateur, onglet resté
// ouvert pendant qu'on se connectait ailleurs). L'état doit donc pouvoir être
// RELU à ces moments-là, et les composants (en-tête, encadré…) prévenus en
// direct, sans recharger la page.
//
//   obtenir()  → la valeur connue, ou une lecture si aucune n'a encore eu lieu ;
//   relire()   → nouvelle lecture (une seule à la fois), abonnés prévenus ;
//   abonner(f) → f(valeur) à chaque valeur lue (et tout de suite si connue).
// Valeur : l'objet du compte (connecté) ou null (visiteur).

export function creerSessionClub({ lire }) {
  let valeur; // undefined = jamais lue
  let enCours = null;
  const abonnes = new Set();

  function relire() {
    if (enCours) return enCours;
    enCours = Promise.resolve()
      .then(lire)
      .catch(() => null)
      .then((moi) => {
        valeur = moi ?? null;
        enCours = null;
        for (const f of abonnes) f(valeur);
        return valeur;
      });
    return enCours;
  }

  return {
    obtenir: () => (valeur !== undefined ? Promise.resolve(valeur) : relire()),
    relire,
    abonner(f) {
      abonnes.add(f);
      if (valeur !== undefined) f(valeur);
      return () => abonnes.delete(f);
    },
    valeur: () => valeur,
  };
}

// Juste après une connexion, l'adresse de retour porte « club=connecte »
// (voir ajouterMarqueurConnexion). Si la première lecture répond « visiteur »
// malgré tout (cookie pas encore pris en compte), on relit une fois de plus.
export const MARQUEUR_CONNEXION = "club";
export const VALEUR_MARQUEUR = "connecte";

export function ajouterMarqueurConnexion(chemin) {
  if (typeof chemin !== "string" || !chemin.startsWith("/")) return chemin;
  const [avantAncre, ancre] = chemin.split("#");
  const sep = avantAncre.includes("?") ? "&" : "?";
  return `${avantAncre}${sep}${MARQUEUR_CONNEXION}=${VALEUR_MARQUEUR}${ancre !== undefined ? `#${ancre}` : ""}`;
}

// Adresse sans le marqueur (pour la nettoyer dans la barre d'adresse), ou null
// si elle n'en avait pas.
export function retirerMarqueurConnexion(href) {
  const url = new URL(href);
  if (url.searchParams.get(MARQUEUR_CONNEXION) !== VALEUR_MARQUEUR) return null;
  url.searchParams.delete(MARQUEUR_CONNEXION);
  return url.pathname + url.search + url.hash;
}

// Lecture « après connexion » : jusqu'à `essais` lectures espacées tant que la
// réponse est « visiteur ».
export async function lireApresConnexion(lire, { essais = 3, pauseMs = 400, attendre } = {}) {
  const pause = attendre ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  let moi = null;
  for (let i = 0; i < essais; i++) {
    if (i > 0) await pause(pauseMs);
    moi = await lire();
    if (moi) return moi;
  }
  return moi;
}
