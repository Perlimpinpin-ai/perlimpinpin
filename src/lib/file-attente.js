// File d'attente des fiches d'étape 1 (table FicheEtape1) : règles du dépôt et
// du retrait depuis la page /test/depot. Sans import de Next ni de Prisma :
// l'accès (isEditor) et la base (prisma) sont passés par l'appelant, ce qui
// permet de tester ces règles avec une fausse base (scripts/file-attente.test.js).

import { DbNull } from "@prisma/client/runtime/client";
import { controlerFicheEtape1 } from "./controle-fiche-etape1.js";

// Prisma refuse null pour vider une colonne Json : il faut DbNull (NULL en base).
export { DbNull };

// Une fiche d'étape 1 pèse quelques dizaines de ko. Au-delà, c'est une erreur de
// fichier (et les actions serveur refusent les envois de plus de 1 Mo).
export const TAILLE_MAX = 900 * 1024;
export const DEPOSE_PAR_MAX = 80;

// Nom du fichier → slug (sans .json ; aucune transformation : un nom invalide
// est signalé par le contrôle, pas corrigé en silence).
export function slugDuFichier(nom) {
  return String(nom ?? "").replace(/^.*[\\/]/, "").replace(/\.json$/i, "");
}

// Erreur d'unicité Prisma (deux dépôts simultanés du même slug).
const estDoublon = (e) => e?.code === "P2002";

// Dépôt d'UN fichier. Résultat : { ok, slug, erreurs, id? , simulation? }.
// Rien n'est écrit si la fiche n'est pas conforme.
export async function deposerFicheCore({ nom, texte, deposePar }, { isEditor, prisma, dryRun = false, source = "depot" }) {
  if (!(await isEditor())) return { ok: false, slug: null, erreurs: ["Non autorisé."] };

  const slug = slugDuFichier(nom);
  const qui = String(deposePar ?? "").trim();
  if (!qui) return { ok: false, slug, erreurs: ["Indiquez votre nom dans « Déposé par »."] };
  if (qui.length > DEPOSE_PAR_MAX) return { ok: false, slug, erreurs: [`« Déposé par » : ${DEPOSE_PAR_MAX} caractères au plus.`] };
  if (typeof texte !== "string" || !texte.trim()) return { ok: false, slug, erreurs: ["Fichier vide."] };
  if (texte.length > TAILLE_MAX) return { ok: false, slug, erreurs: ["Fichier trop gros pour une fiche d'étape 1 (900 ko au plus)."] };

  let json;
  try {
    json = JSON.parse(texte);
  } catch (e) {
    return { ok: false, slug, erreurs: [`Ce n'est pas un JSON valide : ${e.message}`] };
  }

  return mettreEnFile({ json, slug, source, deposePar: qui }, { prisma, dryRun });
}

// Contrôle puis écriture dans la file : page de dépôt et import d'un dossier
// (scripts/traiter-file-attente.js --import). Une fiche du même nom en erreur
// ou retirée est remise en attente avec le nouveau contenu (rien n'est supprimé).
export async function mettreEnFile({ json, slug, source, deposePar = null }, { prisma, dryRun = false }) {
  const { ok, erreurs, remplaceId } = await controlerFicheEtape1(json, slug, { db: prisma });
  if (!ok) return { ok: false, slug, erreurs };
  if (dryRun) return { ok: true, slug, erreurs: [], simulation: true, remplace: remplaceId != null };

  const data = { contenu: json, source, deposePar, statut: "en_attente", erreurs: DbNull, analyseId: null, coutPipeline: DbNull, traiteeAt: null };
  try {
    if (remplaceId != null) {
      // Le statut est dans le filtre : une ligne remise en attente entre-temps n'est pas réécrite.
      const { count } = await prisma.ficheEtape1.updateMany({
        where: { id: remplaceId, statut: { in: ["erreur", "ignoree"] } },
        data,
      });
      if (count === 0) return { ok: false, slug, erreurs: [`Le nom « ${slug} » vient d'être remis dans la file par quelqu'un d'autre.`] };
      return { ok: true, slug, erreurs: [], id: remplaceId, remplace: true };
    }
    const ligne = await prisma.ficheEtape1.create({ data: { slug, ...data }, select: { id: true } });
    return { ok: true, slug, erreurs: [], id: ligne.id, remplace: false };
  } catch (e) {
    if (estDoublon(e)) return { ok: false, slug, erreurs: [`Le nom « ${slug} » est déjà dans la file d'attente.`] };
    throw e;
  }
}

// « Retirer » : seulement une fiche en attente ou en erreur, qui passe en
// "ignoree" (rien n'est supprimé). updateMany avec le statut dans le filtre :
// une fiche passée en_cours entre-temps n'est pas touchée.
export async function retirerFicheCore(id, { isEditor, prisma, dryRun = false }) {
  if (!(await isEditor())) return { ok: false, message: "Non autorisé." };
  const n = Number(id);
  if (!Number.isInteger(n) || n < 1) return { ok: false, message: "Fiche introuvable." };
  if (dryRun) return { ok: true, simulation: true, message: "Mode simulation : rien n'a été écrit en base." };
  const { count } = await prisma.ficheEtape1.updateMany({
    where: { id: n, statut: { in: ["en_attente", "erreur"] } },
    data: { statut: "ignoree" },
  });
  if (count === 0) return { ok: false, message: "Seule une fiche en attente ou en erreur peut être retirée." };
  return { ok: true, message: "" };
}

// Liste de la file pour la page : candidat et titre lus dans le bloc relecture.
export async function lireFile(prisma) {
  const lignes = await prisma.ficheEtape1.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true, slug: true, contenu: true, statut: true, source: true, deposePar: true,
      erreurs: true, analyseId: true, coutPipeline: true, createdAt: true, traiteeAt: true,
    },
  });
  return lignes.map(({ contenu, ...l }) => ({
    ...l,
    candidat: typeof contenu?.relecture?.candidat === "string" ? contenu.relecture.candidat : null,
    titre: typeof contenu?.relecture?.titre === "string" ? contenu.relecture.titre : null,
    erreurs: Array.isArray(l.erreurs) ? l.erreurs.map(String) : l.erreurs ? [String(l.erreurs)] : [],
  }));
}
