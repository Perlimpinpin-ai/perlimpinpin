import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { nomCourtTheme } from "@/lib/carrousel-formats";
import { carrouselDepuisEtat, contexteProgramme, decoderEtat } from "@/lib/carrousel-formats-serveur";
import { Cadre, garde, Resultat, SelectionFormat } from "../../VueFormat";

export const dynamic = "force-dynamic";
// Le bouton « Générer » appelle Claude (un appel, deux essais au plus).
export const maxDuration = 300;

export const metadata = {
  title: "Carrousel « analyse de programme » — Perlimpinpin",
  robots: { index: false, follow: false },
};

// Carrousel « analyse de programme » (10 slides, charte RS page 15) d'un
// candidat : 6 fiches PUBLIÉES sur 6 thèmes, rangées à la main, un appel à
// Claude pour tous les textes ; notes, moyenne et verdicts calculés par le
// code. /test/reseaux/programme/demo : démonstration (fiches de test, réponse
// simulée, hors production). Rien n'est écrit en base.
export default async function ProgrammePage({ params, searchParams }) {
  const { slug } = await params;
  const { e } = await searchParams;
  const { configuree, editeur } = await garde();
  const contexte = editeur ? await contexteProgramme(prisma, slug) : null;
  if (editeur && !contexte) notFound();
  const etat = e ? decoderEtat(e) : null;
  const carrousel = contexte && e ? carrouselDepuisEtat("programme", contexte, etat) : null;
  const initial = contexte?.demo ? { ordres: contexte.demo.ordres } : etat ? { ordres: etat.ordres } : {};

  return (
    <Cadre titre={`Analyse de programme${contexte ? ` · ${contexte.candidat.nom}` : ""}`} sousTitre="On a noté 6 mesures de [Nom]. 10 slides, un seul appel à Claude ; notes, moyenne et verdicts écrits par le code." configuree={configuree} editeur={editeur}>
      {contexte ? (
        <>
          {contexte.demo ? <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Démonstration : fiches de TEST et réponse simulée, aucun appel à Claude, rien en base.</p> : null}
          <SelectionFormat format="programme" cle={slug} demo={Boolean(contexte.demo)} initial={initial} fiches={contexte.fiches.map((f) => ({ id: f.id, titre: f.titre, themeNom: nomCourtTheme(f.theme), score: f.score }))} />
          {e ? <Resultat format="programme" cle={slug} e={e} carrousel={carrousel} nomCheckList={contexte.candidat.nom} /> : null}
        </>
      ) : null}
    </Cadre>
  );
}
