import { prisma } from "@/lib/prisma";
import { getAdherent } from "@/lib/relecture-auth";
import { SESSION_EXPIREE } from "@/lib/relecture-comments-core";
import { bilanAdherent } from "@/lib/club-points-core";
import { modifierPseudo, nomAffiche } from "@/lib/club-pseudo-core";
import { commentairesPourPoints } from "@/lib/versions-core";

// Adhérent connecté (bandeau et panneau « Mon compte » de la page /relectures),
// ou 401. Les PerlimpinPOINTS sont recalculés à chaque appel depuis ses
// commentaires ; ils ne sont renvoyés qu'à l'adhérent lui-même.
export async function GET() {
  const adherent = await getAdherent();
  if (!adherent) return Response.json(SESSION_EXPIREE, { status: 401 });

  // Une panne du calcul des points ne doit jamais faire passer l'adhérent pour
  // un visiteur (l'en-tête, la fiche et les annotations lisent cette route pour
  // savoir s'il est connecté) : l'identité est renvoyée quoi qu'il arrive.
  let commentaires = [];
  let pointsIndisponibles = false;
  try {
    commentaires = await prisma.relectureComment.findMany({
      where: { adherentId: adherent.id },
      // Lot 5 : « retenu » vient aussi des annotations closes (TraitementAnnotation).
      select: { ficheSlug: true, retenu: true, traitements: { select: { id: true, etat: true, retenu: true, createdAt: true } } },
    });
  } catch (error) {
    pointsIndisponibles = true;
    console.error(`[club] PerlimpinPOINTS indisponibles (adhérent n°${adherent.id}) :`, error?.code ?? error?.message);
  }

  return Response.json({
    pointsIndisponibles,
    // Nom affiché (pseudo s'il existe), pseudo seul, et nom par défaut.
    nom: nomAffiche(adherent),
    pseudo: adherent.pseudo,
    nomParDefaut: adherent.nom,
    email: adherent.email,
    // Date de création du mot de passe (activation du compte).
    membreDepuis: adherent.activatedAt,
    ...bilanAdherent(commentairesPourPoints(commentaires)),
  });
}

// Modifie le pseudo de l'adhérent CONNECTÉ (identifié par sa session, jamais
// par un id envoyé par le navigateur). Corps : { pseudo: "…" } ; une chaîne
// vide ou null revient au nom par défaut. Validation : src/lib/club-pseudo-core.js.
export async function PATCH(request) {
  const adherent = await getAdherent();
  const data = adherent ? await request.json().catch(() => null) : null;
  const { status, body } = await modifierPseudo({
    adherent,
    data,
    pseudoPris: async (pseudo, adherentId) =>
      Boolean(
        await prisma.adherent.findFirst({
          where: { pseudo: { equals: pseudo, mode: "insensitive" }, NOT: { id: adherentId } },
          select: { id: true },
        })
      ),
    enregistrer: (adherentId, pseudo) =>
      prisma.adherent.update({ where: { id: adherentId }, data: { pseudo } }),
  });
  return Response.json(body, { status });
}
