// Adhérent connecté, vu du navigateur : UN seul appel à /api/relectures/moi
// par chargement de page, partagé par l'en-tête (bouton CLUB), l'encadré de la
// fiche, les annotations et la remarque générale.
//   → objet du compte si connecté ;
//   → null si pas connecté (401) ;
//   → null aussi en cas de panne (la page reste utilisable en visiteur), mais
//     la panne est signalée dans la console pour ne pas passer inaperçue.
//
// Jamais d'état « visiteur » gardé à tort :
//   - la réponse n'est jamais mise en cache (no-store, ici et côté serveur) ;
//   - la valeur gardée en mémoire ne vit que le temps de la page : une
//     connexion se termine toujours par un vrai chargement de page ;
//   - une page restaurée par le bouton « Retour » du navigateur (cache
//     « bfcache », état figé d'avant la connexion) revérifie la session et se
//     recharge si elle a changé.

let promesse = null;
let membreConnu = null; // true / false une fois la session lue

function lire() {
  return fetch("/api/relectures/moi", { cache: "no-store", credentials: "same-origin" })
    .then(async (r) => {
      if (r.ok) return r.json().catch(() => null);
      if (r.status !== 401) console.warn(`[club] session illisible (/api/relectures/moi : ${r.status})`);
      return null;
    })
    .catch(() => null);
}

export function moiClub() {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (!promesse) {
    promesse = lire().then((moi) => {
      membreConnu = Boolean(moi);
      return moi;
    });
  }
  return promesse;
}

if (typeof window !== "undefined") {
  window.addEventListener("pageshow", (event) => {
    if (!event.persisted || membreConnu === null) return;
    const avant = membreConnu;
    lire().then((moi) => {
      if (Boolean(moi) !== avant) window.location.reload();
    });
  });
}

// Libellé du bouton de l'en-tête : le pseudo, sinon le premier mot du nom
// (« Test A. » → « Test »).
export function libelleCompte(moi) {
  if (!moi) return null;
  const pseudo = typeof moi.pseudo === "string" ? moi.pseudo.trim() : "";
  if (pseudo) return pseudo;
  const nom = typeof moi.nomParDefaut === "string" ? moi.nomParDefaut : typeof moi.nom === "string" ? moi.nom : "";
  return nom.trim().split(/\s+/)[0] || null;
}
