"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { isEditor } from "@/lib/test-auth";
import { publierRevisionCore, reclasserCore, rejeterRevisionCore } from "@/lib/revue-admin-core";
import { declencherRevue } from "@/lib/github";

// Actions serveur de la revue du dimanche (/test/revue). Un fichier
// "use server" exporte des fonctions appelables par n'importe quel client :
// chacune vérifie elle-même l'accès (isEditor), jamais le bouton.

function rafraichir(propositionId = null) {
  revalidatePath("/test/revue");
  if (propositionId) {
    revalidatePath(`/declarations/${propositionId}`);
    revalidatePath("/");
    revalidatePath("/declarations");
    revalidatePath("/candidats");
    revalidatePath("/themes");
  }
}

export async function reclasserAnnotation(_etat, formData) {
  const r = await reclasserCore({
    commentId: formData.get("commentId"),
    categorie: formData.get("categorie"),
    reponse: formData.get("reponse"),
    isEditor: await isEditor(),
    prisma,
  });
  if (r.ok) rafraichir();
  return r.ok ? { ok: true, message: "Reclassée." } : r;
}

export async function publierRevision(_etat, formData) {
  const revisionId = Number(formData.get("revisionId"));
  const r = await publierRevisionCore({
    revisionId,
    confirmation: formData.get("confirmation"),
    isEditor: await isEditor(),
    prisma,
  });
  if (r.ok) rafraichir(r.propositionId);
  return r.ok ? { ok: true, message: `Publiée : /declarations/${r.propositionId}` } : r;
}

export async function rejeterRevision(_etat, formData) {
  const r = await rejeterRevisionCore({ revisionId: Number(formData.get("revisionId")), isEditor: await isEditor(), prisma });
  if (r.ok) rafraichir();
  return r.ok ? { ok: true, message: "Révision rejetée." } : r;
}

// « Traiter maintenant » : lance le workflow « Revue du dimanche » sur une
// seule fiche. Rien n'est publié : la révision proposée revient ici.
export async function traiterMaintenant(_etat, formData) {
  if (!(await isEditor())) return { ok: false, message: "Accès réservé à l'équipe." };
  const brut = String(formData.get("propositionId") ?? "").trim();
  if (!/^[1-9]\d{0,9}$/.test(brut)) return { ok: false, message: "Identifiant de fiche invalide." };
  const propositionId = Number(brut);
  const publiee = await prisma.analyse.findFirst({ where: { propositionId, statut: "publie" }, select: { id: true } });
  if (!publiee) return { ok: false, message: "Aucune version publiée pour cette fiche." };
  try {
    const { lien, dejaLance } = await declencherRevue({ propositionId, token: process.env.GITHUB_DISPATCH_TOKEN });
    return { ok: true, message: dejaLance ? "Une revue de cette fiche est déjà en cours." : "Revue lancée (quelques minutes à quelques heures).", lien };
  } catch (error) {
    return { ok: false, message: error.message };
  }
}
