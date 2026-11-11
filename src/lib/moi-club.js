import { useEffect, useState } from "react";
import { creerSessionClub, lireApresConnexion, retirerMarqueurConnexion } from "./session-club-core.js";

// Adhérent connecté, vu du navigateur, partagé par l'en-tête (bouton CLUB),
// l'encadré de la fiche, les annotations et la remarque générale.
//   → objet du compte si connecté ; null si visiteur (401) ou en cas de panne
//     (la page reste utilisable en visiteur ; la panne est signalée en console).
//
// Jamais d'état « visiteur » gardé à tort (voir session-club-core.js) :
//   - réponse jamais mise en cache (no-store, ici et côté serveur) ;
//   - retour de connexion (« club=connecte » dans l'adresse) : lecture répétée
//     tant que la réponse est « visiteur », puis marqueur retiré de l'adresse ;
//   - relecture quand la page est restaurée (« Retour » du navigateur), activée
//     après préchargement, ou quand l'onglet redevient visible : les
//     composants abonnés se mettent à jour sans recharger la page.

function lireReseau() {
  return fetch("/api/relectures/moi", { cache: "no-store", credentials: "same-origin" })
    .then(async (r) => {
      if (r.ok) return r.json().catch(() => null);
      if (r.status !== 401) console.warn(`[club] session illisible (/api/relectures/moi : ${r.status})`);
      return null;
    })
    .catch(() => null);
}

let lireUneFois = lireReseau;
if (typeof window !== "undefined") {
  const propre = retirerMarqueurConnexion(window.location.href);
  if (propre !== null) {
    // Retour de connexion : on insiste si la première réponse est « visiteur ».
    window.history.replaceState(window.history.state, "", propre);
    let premiere = true;
    lireUneFois = () => {
      if (!premiere) return lireReseau();
      premiere = false;
      return lireApresConnexion(lireReseau);
    };
  }
}

const session = creerSessionClub({ lire: () => lireUneFois() });

if (typeof window !== "undefined") {
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) session.relire();
  });
  document.addEventListener("prerenderingchange", () => session.relire());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && session.valeur() !== undefined) session.relire();
  });
}

export function moiClub() {
  if (typeof window === "undefined") return Promise.resolve(null);
  return session.obtenir();
}

// S'abonne aux changements (connexion détectée après coup, etc.).
export function surSessionClub(f) {
  if (typeof window === "undefined") return () => {};
  moiClub();
  return session.abonner(f);
}

// Hook : undefined tant que la session n'est pas lue, puis le compte ou null,
// mis à jour en direct.
export function useMoiClub() {
  const [moi, setMoi] = useState(undefined);
  useEffect(() => surSessionClub(setMoi), []);
  return moi;
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
