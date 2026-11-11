// Adhérent connecté, vu du navigateur : UN seul appel à /api/relectures/moi
// par page, partagé par l'en-tête (bouton CLUB), l'encadré de la fiche, les
// annotations et la remarque générale.
//   → objet du compte si connecté ;
//   → null si pas connecté (401) ;
//   → null aussi en cas de panne (la page reste utilisable en visiteur), mais
//     la panne est signalée dans la console pour ne pas passer inaperçue.

let promesse = null;

export function moiClub() {
  if (typeof window === "undefined") return Promise.resolve(null);
  promesse ??= fetch("/api/relectures/moi", { cache: "no-store", credentials: "same-origin" })
    .then(async (r) => {
      if (r.ok) return r.json().catch(() => null);
      if (r.status !== 401) console.warn(`[club] session illisible (/api/relectures/moi : ${r.status})`);
      return null;
    })
    .catch(() => null);
  return promesse;
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
