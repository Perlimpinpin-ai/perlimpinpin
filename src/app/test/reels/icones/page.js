/* eslint-disable @next/next/no-img-element -- petites icônes SVG en data URI. */
import Link from "next/link";
import { NOMS_ICONES, dataUriIcone } from "@/lib/icones-pixel";
import { assemblerReel, cheminImageReel, formatDuree } from "@/lib/reel";
import { CANDIDAT_EXEMPLE, COUVERTURE_EXEMPLE, SCORE_EXEMPLE, VARIABLES_EXEMPLE, VARIANTES_EXEMPLE } from "@/lib/reel-exemple";
import { donneesPartageReel } from "@/lib/reel-paquet";
import { editionConfiguree, isEditor } from "@/lib/test-auth";
import EditorBar from "../../EditorBar";
import ReelPartage from "../ReelPartage";

// Toujours recalculée à chaque visite (comme les autres pages /test).
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Icônes des Reels — Perlimpinpin",
  robots: { index: false, follow: false },
};

// Planche de validation : les icônes pixel art de la liste fermée
// (src/lib/icones-pixel.js), sur fond sombre et sur fond clair, puis l'aperçu
// des 9 images avec un Reel FICTIF (src/lib/reel-exemple.js). Aucune base,
// aucun appel payant. Réservée aux personnes déverrouillées sur /test.

function Planche({ theme }) {
  const sombre = theme === "sombre";
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-extrabold tracking-tight">{sombre ? "Sur fond sombre" : "Sur fond clair"}</h2>
      <ul
        className="grid grid-cols-3 gap-3 rounded-2xl p-4 sm:grid-cols-5 lg:grid-cols-8"
        style={{
          backgroundImage: `url(/reel/fond-${theme}.png)`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {NOMS_ICONES.map((nom) => (
          <li key={nom} className="flex flex-col items-center gap-2 py-2">
            <img src={dataUriIcone(nom, { theme, taille: 96 })} alt={nom} width={96} height={96} style={{ imageRendering: "pixelated" }} />
            <span className={`font-mono text-xs ${sombre ? "text-white/85" : "text-zinc-700"}`}>{nom}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function IconesReelPage() {
  const configuree = editionConfiguree();
  const editeur = configuree && (await isEditor());
  const assemble = assemblerReel(VARIABLES_EXEMPLE, {
    candidatNom: CANDIDAT_EXEMPLE,
    score: SCORE_EXEMPLE,
    variantes: VARIANTES_EXEMPLE,
    couverture: COUVERTURE_EXEMPLE,
  });
  // Même page et même zip qu'une vraie fiche (contenu fictif).
  const donnees = donneesPartageReel({
    assemble,
    duree: formatDuree(assemble.dureeEstimee),
    prefixeFichier: "reel-exemple",
    slug: "exemple-fictif",
    propositionId: 0,
    url: ({ scene, theme, calque }) => `${cheminImageReel({ propositionId: 0, scene, theme, calque })}&exemple=1`,
    infos: {
      candidatNom: `${CANDIDAT_EXEMPLE} (FICTIF)`,
      titre: "Exemple fictif, ne jamais publier",
      score: SCORE_EXEMPLE,
      palier: assemble.palier.label,
      propositionId: 0,
      brouillon: true,
      genereLe: null,
    },
  });

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-8 text-zinc-900 sm:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <Link href="/test/reels" className="font-semibold underline underline-offset-2 hover:opacity-70">
            ← Tous les Reels
          </Link>
          {configuree ? <EditorBar editeur={editeur} /> : null}
        </div>

        {!editeur ? (
          <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            {configuree
              ? "Page réservée aux personnes déverrouillées : saisissez le code d’édition ci-dessus."
              : "Le mode édition n’est pas configuré sur ce site."}
          </p>
        ) : (
          <>
            <header className="flex flex-col gap-2">
              <h1 className="text-2xl font-bold tracking-tight">Icônes des Reels</h1>
              <p className="max-w-2xl text-sm text-zinc-600">
                Les {NOMS_ICONES.length} icônes de la liste fermée : le modèle ne peut choisir que celles-ci. Pour en
                corriger une, modifiez sa grille de 16 × 16 caractères dans <code className="font-mono">src/lib/icones-pixel.js</code>.
              </p>
            </header>
            <Planche theme="sombre" />
            <Planche theme="clair" />

            <section className="flex flex-col gap-3">
              <h2 className="text-xl font-extrabold tracking-tight">Aperçu du style</h2>
              <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                Reel <strong>fictif</strong> (mesure, chiffres et candidat inventés), pour juger la mise en page. Ne jamais publier
                ces images.
              </p>
              <ReelPartage {...donnees} script={false} />
            </section>
          </>
        )}
      </div>
    </main>
  );
}
