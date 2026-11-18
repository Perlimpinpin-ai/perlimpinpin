"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { isEditor } from "@/lib/test-auth";
import { deposerFicheCore, retirerFicheCore } from "@/lib/file-attente";

// Actions de /test/depot. Comme pour /test, ce sont ELLES qui contrôlent l'accès
// (isEditor), pas l'affichage des boutons. Un appel par fichier : chaque envoi
// reste sous la limite de 1 Mo des actions serveur.

export async function deposerFiche(entree) {
  const resultat = await deposerFicheCore(entree ?? {}, {
    isEditor,
    prisma,
    dryRun: process.env.TEST_DRY_RUN === "1",
  });
  if (resultat.ok && !resultat.simulation) {
    // Ni contenu ni nom de la personne dans les journaux : le slug suffit.
    console.log(`[test/depot] fiche « ${resultat.slug} » mise en file (n° ${resultat.id}) le ${new Date().toISOString()}`);
    revalidatePath("/test/depot");
  }
  return resultat;
}

export async function retirerFiche(id) {
  const resultat = await retirerFicheCore(id, {
    isEditor,
    prisma,
    dryRun: process.env.TEST_DRY_RUN === "1",
  });
  if (resultat.ok && !resultat.simulation) {
    console.log(`[test/depot] fiche n° ${id} retirée de la file le ${new Date().toISOString()}`);
    revalidatePath("/test/depot");
  }
  return resultat;
}
