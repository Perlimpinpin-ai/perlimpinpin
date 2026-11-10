// Note d'un visiteur gardée dans SON navigateur (localStorage) en attendant
// qu'il adhère ou se connecte : rien n'est envoyé au serveur avant. Une fois
// connecté, la note est rouverte, prête à envoyer, puis effacée à l'envoi.
// Fonctions sans dépendance (testées par scripts/brouillon-club.test.js) ; le
// stockage est passé en paramètre, et toute erreur (navigation privée,
// stockage bloqué) est ignorée : la fiche fonctionne sans.

export const DUREE_BROUILLON_MS = 14 * 24 * 60 * 60 * 1000;
const TEXTE_MAX = 4000;
const TYPES = new Set(["annotation", "remarque"]);

export function cleBrouillon(propositionId, type) {
  return `club-brouillon-fiche-${propositionId}-${type}`;
}

function stockageParDefaut() {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

// Garde la note ; renvoie vrai si elle a pu être gardée.
export function garderBrouillon(propositionId, type, donnees, { stockage = stockageParDefaut(), maintenant = Date.now() } = {}) {
  if (!stockage || !TYPES.has(type) || typeof donnees?.body !== "string" || !donnees.body.trim()) return false;
  const brouillon = {
    body: donnees.body.slice(0, TEXTE_MAX),
    creditAccord: donnees.creditAccord === true,
    sectionId: typeof donnees.sectionId === "string" ? donnees.sectionId : null,
    quotedText: typeof donnees.quotedText === "string" ? donnees.quotedText : null,
    startOffset: Number.isInteger(donnees.startOffset) ? donnees.startOffset : 0,
    gardeLe: maintenant,
  };
  try {
    stockage.setItem(cleBrouillon(propositionId, type), JSON.stringify(brouillon));
    return true;
  } catch {
    return false;
  }
}

// Note gardée pour cette fiche, ou null (absente, illisible ou trop ancienne).
export function lireBrouillon(propositionId, type, { stockage = stockageParDefaut(), maintenant = Date.now() } = {}) {
  if (!stockage || !TYPES.has(type)) return null;
  try {
    const brut = JSON.parse(stockage.getItem(cleBrouillon(propositionId, type)) ?? "null");
    if (!brut || typeof brut.body !== "string" || !brut.body.trim()) return null;
    if (!Number.isFinite(brut.gardeLe) || maintenant - brut.gardeLe > DUREE_BROUILLON_MS) {
      stockage.removeItem(cleBrouillon(propositionId, type));
      return null;
    }
    return brut;
  } catch {
    return null;
  }
}

export function oublierBrouillon(propositionId, type, { stockage = stockageParDefaut() } = {}) {
  try {
    stockage?.removeItem(cleBrouillon(propositionId, type));
  } catch {
    // stockage indisponible : rien à effacer
  }
}

// Liens de l'encart « Adhérer au Club » / « Déjà adhérent ? Se connecter »,
// avec retour sur la fiche (chemins vérifiés côté serveur par retourValide).
export function liensAdhesion(retour) {
  const suite = `?retour=${encodeURIComponent(retour)}`;
  return { adherer: `/relectures/adherer${suite}`, connexion: `/relectures/connexion${suite}` };
}
