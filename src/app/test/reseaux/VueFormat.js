import Link from "next/link";
import { editionConfiguree, isEditor } from "@/lib/test-auth";
import { listeVerifications } from "@/lib/verifications-charte";
import { COULEURS_CARROUSEL_CANDIDATS } from "@/lib/couleurs-carrousel";
import EditorBar from "../EditorBar";
import EncadreARelire from "../EncadreARelire";
import CarrouselPartage from "../CarrouselPartage";
import ListeARelireCarrousel from "./ListeARelireCarrousel";
import SelectionFormat from "./SelectionFormat";

// Mise en page commune des pages /test/reseaux/programme/<slug> et
// /test/reseaux/thematique/<thème> : sélection, génération, slides,
// avertissements, check-list de la page 20 de la charte RS, archive.
export async function garde() {
  const configuree = editionConfiguree();
  return { configuree, editeur: configuree && (await isEditor()) };
}

export function Cadre({ titre, sousTitre, configuree, editeur, children }) {
  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-8 text-zinc-900 sm:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <Link href="/test/reseaux" className="font-semibold underline underline-offset-2 hover:opacity-70">
            ← Réseaux sociaux
          </Link>
          {configuree ? <EditorBar editeur={editeur} /> : null}
        </div>
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">{titre}</h1>
          <p className="text-sm text-zinc-600">{sousTitre}</p>
        </header>
        {!editeur ? (
          <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            {configuree ? "Page réservée aux personnes déverrouillées : saisissez le code d’édition ci-dessus." : "Le mode édition n’est pas configuré sur ce poste."}
          </p>
        ) : (
          children
        )}
      </div>
    </main>
  );
}

// Slides, avertissements, check-list et archive d'un carrousel assemblé.
export function Resultat({ format, cle, e, carrousel, nomCheckList }) {
  if (!carrousel) return <p className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800">État illisible dans l’adresse : générez à nouveau.</p>;
  if (carrousel.erreurs?.length) {
    return (
      <div className="rounded-xl border-2 border-red-400 bg-red-50 p-3 text-sm text-red-800">
        <p className="font-semibold">Carrousel refusé :</p>
        <ul className="mt-1 list-disc pl-5">
          {carrousel.erreurs.map((err) => (
            <li key={err}>{err}</li>
          ))}
        </ul>
      </div>
    );
  }
  const vignettes = carrousel.slides.map((s) => ({ numero: s.numero, total: s.total, libelle: s.type, fichier: s.fichier, url: `/api/carrousel/${format}/${encodeURIComponent(cle)}?e=${e}&slide=${s.numero}` }));
  const candidats = Object.entries(COULEURS_CARROUSEL_CANDIDATS).map(([nom, c]) => ({ nom, fond: c.fond }));
  return (
    <section className="flex flex-col gap-4">
      <ListeARelireCarrousel candidatNom={nomCheckList} couleur={carrousel.couleur} couleurAttribuee candidats={candidats} items={listeVerifications({ controles: carrousel.controles, debordements: carrousel.debordements, format })} />
      <EncadreARelire avertissements={carrousel.avertissements} />
      <CarrouselPartage vignettes={vignettes} legendeInitiale={carrousel.legende} archive={carrousel.archive} prefixeFichier={carrousel.archive.replace(/\.zip$/, "")} blocage={carrousel.blocage} fichiersSupplementaires={[{ nom: "credits.txt", donnees: carrousel.credits }]} />
    </section>
  );
}

export { SelectionFormat };
