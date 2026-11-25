import { prisma } from "@/lib/prisma";
import { getAdherent } from "@/lib/relecture-auth";
import { SESSION_EXPIREE } from "@/lib/relecture-comments-core";
import { nomAffiche } from "@/lib/club-pseudo-core";
import {
  MAX_PROPOSITIONS_PAR_JOUR,
  propositionPourAdherent,
  validerProposition,
} from "@/lib/espace-club-core";
import { envoyerMailProposition } from "@/lib/proposition-club-mail";

// « Proposer une mesure » (espace du Club, /relectures). Réservé aux adhérents
// connectés : l'auteur vient TOUJOURS de la session, jamais du navigateur.
//   GET  → { candidats, propositions } : liste des candidats suivis et
//          propositions de l'adhérent connecté (les siennes seulement) ;
//   POST → enregistre (create uniquement) et prévient club@perlimpinpin.ai.
// Table absente (migration pas encore appliquée, code Prisma P2021) : la page
// affiche « bientôt disponible » au lieu d'une erreur.
const SANS_CACHE = { "Cache-Control": "private, no-store, max-age=0" };
const tableAbsente = (error) => error?.code === "P2021";

async function candidatsSuivis() {
  try {
    const liste = await prisma.candidat.findMany({ select: { nom: true }, orderBy: { nom: "asc" } });
    return liste.map((c) => c.nom);
  } catch (error) {
    console.error("[club] liste des candidats indisponible :", error?.code ?? error?.message);
    return [];
  }
}

export async function GET() {
  const adherent = await getAdherent();
  if (!adherent) return Response.json(SESSION_EXPIREE, { status: 401, headers: SANS_CACHE });

  const candidats = await candidatsSuivis();
  try {
    const lignes = await prisma.propositionClub.findMany({
      where: { adherentId: adherent.id },
      orderBy: { createdAt: "desc" },
    });
    return Response.json({ disponible: true, candidats, propositions: lignes.map(propositionPourAdherent) }, { headers: SANS_CACHE });
  } catch (error) {
    if (!tableAbsente(error)) throw error;
    return Response.json({ disponible: false, candidats, propositions: [] }, { headers: SANS_CACHE });
  }
}

export async function POST(request) {
  const adherent = await getAdherent();
  if (!adherent) return Response.json(SESSION_EXPIREE, { status: 401 });

  const { valeurs, error } = validerProposition(await request.json().catch(() => null));
  if (error) return Response.json({ error }, { status: 400 });

  try {
    const depuis = new Date(Date.now() - 24 * 3600 * 1000);
    const recentes = await prisma.propositionClub.count({ where: { adherentId: adherent.id, createdAt: { gte: depuis } } });
    if (recentes >= MAX_PROPOSITIONS_PAR_JOUR) {
      return Response.json(
        { error: `Tu as déjà proposé ${MAX_PROPOSITIONS_PAR_JOUR} mesures en 24 heures. Merci ! Réessaie demain.` },
        { status: 429 },
      );
    }
    // Écriture : create uniquement (jamais d'upsert ni de mise à jour).
    const cree = await prisma.propositionClub.create({ data: { ...valeurs, adherentId: adherent.id } });
    // Le mail ne bloque jamais l'enregistrement (il ne lève pas d'exception).
    await envoyerMailProposition({
      proposition: cree,
      auteur: { id: adherent.id, nom: nomAffiche(adherent), email: adherent.email },
    });
    return Response.json(propositionPourAdherent(cree), { status: 201 });
  } catch (e) {
    if (tableAbsente(e)) {
      return Response.json({ error: "Cette fonction arrive très bientôt. Merci de ta patience !" }, { status: 503 });
    }
    throw e;
  }
}
