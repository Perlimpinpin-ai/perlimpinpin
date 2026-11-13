import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { getAdherent } from "@/lib/relecture-auth";
import { SESSION_EXPIREE } from "@/lib/relecture-comments-core";
import { dernierTraitement } from "@/lib/versions-core";
import { propositionDuSlug } from "@/lib/fiche-annotations-core";
import { archiveDepuisFiche, mesCommentaires } from "@/lib/espace-club-core";

// « Mes commentaires » (espace du Club, /relectures) : tous les commentaires et
// annotations de l'adhérent CONNECTÉ, avec la fiche concernée, la réponse de
// l'équipe et leur statut. Jamais ceux d'un autre adhérent. Jamais mis en cache.
const SANS_CACHE = { "Cache-Control": "private, no-store, max-age=0" };
const DOSSIER_RELECTURES = path.join(process.cwd(), "data", "relectures");

// Anciennes relectures de brouillons (titre, candidat, réponses archivées).
// Lues une fois par instance : ces fichiers ne changent qu'au déploiement.
let archivesEnCache = null;
function archivesRelectures() {
  if (archivesEnCache) return archivesEnCache;
  const archives = new Map();
  try {
    for (const f of readdirSync(DOSSIER_RELECTURES)) {
      if (!f.endsWith(".json")) continue;
      try {
        const fiche = JSON.parse(readFileSync(path.join(DOSSIER_RELECTURES, f), "utf8"));
        archives.set(f.replace(/\.json$/, ""), archiveDepuisFiche(fiche));
      } catch (error) {
        console.error(`[club] fiche de relecture illisible (${f}) :`, error?.message);
      }
    }
  } catch (error) {
    console.error("[club] dossier data/relectures illisible :", error?.code ?? error?.message);
  }
  archivesEnCache = archives;
  return archives;
}

export async function GET() {
  const adherent = await getAdherent();
  if (!adherent) return Response.json(SESSION_EXPIREE, { status: 401, headers: SANS_CACHE });

  const commentaires = await prisma.relectureComment.findMany({
    where: { adherentId: adherent.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      ficheSlug: true,
      sectionLabel: true,
      quotedText: true,
      body: true,
      createdAt: true,
      retenu: true,
      traitements: { select: { id: true, etat: true, reponse: true, retenu: true, createdAt: true } },
    },
  });

  const ids = [...new Set(commentaires.map((c) => propositionDuSlug(c.ficheSlug)).filter((id) => id != null))];
  const propositions = ids.length
    ? await prisma.proposition.findMany({
        where: { id: { in: ids } },
        select: { id: true, titre: true, texteOriginal: true, candidat: { select: { nom: true } } },
      })
    : [];
  const fichesPubliees = new Map(
    propositions.map((p) => [p.id, { titre: p.titre || p.texteOriginal.slice(0, 120), candidat: p.candidat?.nom ?? null }]),
  );

  return Response.json(
    mesCommentaires({ commentaires, fichesPubliees, archives: archivesRelectures(), dernierTraitement }),
    { headers: SANS_CACHE },
  );
}
