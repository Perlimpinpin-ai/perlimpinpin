import { formatClosedAt, isRelectureClosed } from "./relecture.js";

// Logique de POST /api/relectures/comments, sans Next ni Prisma : la base est
// passée en paramètres (trouverFiche, creer) pour pouvoir tester avec
// `node --test` (scripts/relecture-comments-api.test.js).

const BODY_MAX_LENGTH = 4000;
const QUOTE_MAX_LENGTH = 20000;
const OFFSET_MAX = 1_000_000;

// Réponse commune à toutes les routes /api/relectures/* quand l'adhérent n'est
// pas (ou plus) connecté.
export const SESSION_EXPIREE = { error: "Session expirée. Reconnectez-vous.", login: "/relectures/connexion" };

// Annotation (surligneur + note) : les trois champs vont ensemble. Renvoie
// null pour un commentaire de section, { error } si les champs sont incohérents.
export function parseAnnotation(data) {
  const hasAny = data.quotedText != null || data.startOffset != null || data.endOffset != null;
  if (!hasAny) return null;
  const quotedText = typeof data.quotedText === "string" ? data.quotedText : "";
  const startOffset = data.startOffset;
  const endOffset = data.endOffset;
  if (
    !quotedText.trim() ||
    quotedText.length > QUOTE_MAX_LENGTH ||
    !Number.isInteger(startOffset) ||
    !Number.isInteger(endOffset) ||
    startOffset < 0 ||
    endOffset > OFFSET_MAX ||
    endOffset - startOffset !== quotedText.length
  ) {
    return { error: "Annotation invalide (passage ou positions incohérents)." };
  }
  return { quotedText, startOffset, endOffset };
}

// { status, body } à renvoyer. `adherent` : { id, nom } de getAdherent(), ou null.
// Le nom de l'auteur vient TOUJOURS du compte : un authorName envoyé par la page
// est ignoré.
export async function posterCommentaire({ adherent, data, trouverFiche, creer, maintenant = new Date() }) {
  if (!adherent) return { status: 401, body: SESSION_EXPIREE };
  if (!data || typeof data !== "object") return { status: 400, body: { error: "JSON invalide." } };

  const ficheSlug = String(data.ficheSlug || "").trim();
  const sectionId = String(data.sectionId || "").trim();
  const sectionLabel = String(data.sectionLabel || "").trim().slice(0, 200) || null;
  const body = String(data.body || "").trim().slice(0, BODY_MAX_LENGTH);

  if (!ficheSlug || !sectionId || !body) {
    return { status: 400, body: { error: "Champs requis manquants." } };
  }

  const annotation = parseAnnotation(data);
  if (annotation?.error) return { status: 400, body: { error: annotation.error } };

  // Relecture terminée (échéance du chrono passée) : la fiche reste lisible,
  // mais on n'accepte plus de commentaire, quoi que fasse la page.
  const fiche = await trouverFiche(ficheSlug);
  if (isRelectureClosed(fiche, maintenant)) {
    return {
      status: 403,
      body: {
        error: `Relecture terminée le ${formatClosedAt(fiche.reviewDeadline)} : les commentaires sont fermés.`,
        closed: true,
      },
    };
  }

  const comment = await creer({
    ficheSlug,
    sectionId,
    sectionLabel,
    authorName: adherent.nom,
    adherentId: adherent.id,
    body,
    ...annotation,
  });
  // En base, authorName garde le nom du compte ; à l'écran, le pseudo s'il
  // existe (même règle que GET, qui le relit depuis le compte).
  return { status: 201, body: { ...comment, authorName: adherent.pseudo || adherent.nom } };
}
