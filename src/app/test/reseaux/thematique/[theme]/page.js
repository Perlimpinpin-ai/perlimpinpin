import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { nomCourtTheme } from "@/lib/carrousel-formats";
import { carrouselDepuisEtat, contexteThematique, decoderEtat } from "@/lib/carrousel-formats-serveur";
import { couleursTheme } from "@/lib/charte-rs";
import { Cadre, garde, Resultat, SelectionFormat } from "../../VueFormat";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export const metadata = {
  title: "Carrousel thématique — Perlimpinpin",
  robots: { index: false, follow: false },
};

// Carrousel « thématique » (« [Thème] : ce que proposent les candidats »,
// charte RS page 16) : 4 à 8 candidats, ordre alphabétique, un appel à Claude
// pour tous les textes ; notes, verdicts et classement par le code. Sans
// couleur de thème validée (COULEURS_THEMES de src/lib/charte-rs.js), pas de
// génération. /test/reseaux/thematique/demo : démonstration (hors production).
// Rien n'est écrit en base.
export default async function ThematiquePage({ params, searchParams }) {
  const { theme } = await params;
  const { e } = await searchParams;
  const { configuree, editeur } = await garde();
  const contexte = editeur ? await contexteThematique(prisma, theme) : null;
  if (editeur && !contexte) notFound();
  const etat = e ? decoderEtat(e) : null;
  const carrousel = contexte && e ? carrouselDepuisEtat("thematique", contexte, etat) : null;
  const initial = contexte?.demo ? { choix: Object.fromEntries(contexte.demo.candidats.map((c) => [c.nom, c.fiche?.id ?? null])) } : etat ? { choix: etat.choix } : {};
  const couleurValidee = contexte ? Boolean(couleursTheme(contexte.theme, contexte.couleursThemes)) : true;

  return (
    <Cadre titre={`Carrousel thématique${contexte ? ` · ${nomCourtTheme(contexte.theme)}` : ""}`} sousTitre="Une slide par candidat, ordre alphabétique ; le classement par note n’apparaît que sur le comparatif." configuree={configuree} editeur={editeur}>
      {contexte ? (
        <>
          {contexte.demo ? <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Démonstration : fiches locales et de TEST, réponse simulée, aucun appel à Claude, rien en base.</p> : null}
          {!couleurValidee ? <p className="rounded-xl border-2 border-red-400 bg-red-50 p-3 text-sm font-semibold text-red-800">Pas de couleur validée pour ce thème (COULEURS_THEMES de src/lib/charte-rs.js) : la génération est refusée.</p> : null}
          <SelectionFormat format="thematique" cle={theme} demo={Boolean(contexte.demo)} initial={initial} candidats={contexte.candidats.map((c) => ({ nom: c.nom, fiches: c.fiches.map((f) => ({ id: f.id, titre: f.titre, score: f.score })) }))} />
          {e ? <Resultat format="thematique" cle={theme} e={e} carrousel={carrousel} nomCheckList={nomCourtTheme(contexte.theme)} /> : null}
        </>
      ) : null}
    </Cadre>
  );
}
