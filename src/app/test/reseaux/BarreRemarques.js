"use client";

/* eslint-disable @next/next/no-img-element -- slides générées par /api/carrousel, déjà au bon format. */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { estimerRecitAction, regenererAvecRemarquesAction, revenirAuPrecedentAction } from "./actions";

// Barre « Ce qui ne va pas ? » sous le carrousel détaillé de
// /test/reseaux/<id> : une remarque libre, la slide visée (facultatif), le
// coût estimé affiché avant le clic, puis « Régénérer avec ces remarques ».
// Une slide visée est la seule réécrite ; les règles du prompt et les mêmes
// contrôles passent toujours avant les remarques. « Revenir à la version
// précédente » échange les deux versions (sans appel) ; « Comparer » affiche
// la version précédente à côté. Chaque remarque est gardée au journal
// (contenuComplet.reseaux_recit.retours, page /test/reseaux/retours).

function dollars(montant) {
  return montant.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 3 });
}

function dateCourte(iso) {
  try {
    return new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });
  } catch {
    return iso;
  }
}

export default function BarreRemarques({ propositionId, brouillon = false, cibles, vignettesPrecedentes = null, retours = [], demo = false }) {
  const router = useRouter();
  const verrou = useRef(false);
  const [remarque, setRemarque] = useState("");
  const [cible, setCible] = useState("toutes");
  const [estimation, setEstimation] = useState(null);
  const [etat, setEtat] = useState("repos"); // repos | generation | retour
  const [retour, setRetour] = useState(null);
  const [comparer, setComparer] = useState(false);

  // Coût estimé, recalculé quand la cible change ou que la remarque se stabilise.
  useEffect(() => {
    let annule = false;
    const minuteur = setTimeout(async () => {
      const r = await estimerRecitAction(propositionId, brouillon, remarque || "…", cible);
      if (!annule) setEstimation(r.ok ? r : null);
    }, 400);
    return () => {
      annule = true;
      clearTimeout(minuteur);
    };
  }, [propositionId, brouillon, remarque, cible]);

  async function regenerer() {
    if (verrou.current || !remarque.trim()) return;
    const libelle = cibles.find((c) => c.valeur === cible)?.libelle ?? cible;
    const cout = estimation ? `\nCoût estimé ≈ ${dollars(estimation.min)} à ${dollars(estimation.max)} $${demo ? " (simulé : aucun appel réel)" : ""}.` : "";
    if (!window.confirm(`Régénérer avec ces remarques ?\nCible : ${libelle}.${cout}\nLa version actuelle sera gardée comme version précédente.`)) return;
    verrou.current = true;
    setEtat("generation");
    setRetour(null);
    try {
      const r = await regenererAvecRemarquesAction(propositionId, brouillon, remarque, cible);
      if (r.ok) {
        const details = [r.cout !== undefined ? `coût : ${dollars(r.cout)} $${demo ? " simulé" : ""}` : null, r.avertissements?.length ? `${r.avertissements.length} avertissement(s) à relire` : null].filter(Boolean);
        setRetour({ ok: true, texte: `${r.message}${details.length ? ` (${details.join(", ")})` : ""}` });
        setRemarque("");
        router.refresh();
      } else {
        setRetour({ ok: false, texte: `${r.erreur}${r.cout ? ` (coût de l’appel : ${dollars(r.cout)} $)` : ""}` });
        router.refresh();
      }
    } catch (error) {
      setRetour({ ok: false, texte: `Erreur : ${error.message}` });
    } finally {
      setEtat("repos");
      verrou.current = false;
    }
  }

  async function revenir() {
    if (verrou.current) return;
    if (!window.confirm("Revenir à la version précédente ?\nLa version actuelle devient la version précédente : vous pourrez y revenir.")) return;
    verrou.current = true;
    setEtat("retour");
    const r = await revenirAuPrecedentAction(propositionId, brouillon);
    setRetour({ ok: r.ok, texte: r.ok ? r.message : r.erreur });
    setEtat("repos");
    verrou.current = false;
    if (r.ok) router.refresh();
  }

  const occupe = etat !== "repos";
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4">
      <h5 className="text-sm font-semibold text-zinc-900">Ce qui ne va pas ?</h5>
      <textarea
        value={remarque}
        onChange={(e) => setRemarque(e.target.value)}
        rows={3}
        maxLength={600}
        placeholder="Par ex. « la slide 2 est trop chargée », « le titre de couverture est trop long », « la slide court terme oublie les ménages »"
        className="w-full rounded-lg border border-zinc-300 p-2 text-sm"
      />
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-zinc-600">
          Slide visée
          <select value={cible} onChange={(e) => setCible(e.target.value)} className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs">
            {cibles.map((c) => (
              <option key={c.valeur} value={c.valeur}>
                {c.libelle}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={regenerer}
          disabled={occupe || !remarque.trim()}
          aria-busy={etat === "generation"}
          className="rounded-full border border-zinc-900 bg-zinc-900 px-4 py-1.5 text-xs font-semibold text-white hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {etat === "generation" ? "Régénération en cours…" : "Régénérer avec ces remarques"}
        </button>
        <span className="text-xs text-zinc-500">
          {estimation ? `Coût estimé ≈ ${dollars(estimation.min)} à ${dollars(estimation.max)} $${demo ? " (simulé)" : ""}` : "Coût estimé…"}
        </span>
      </div>
      <p className="text-xs text-zinc-500">
        Les remarques passent après les règles : la note et le niveau restent écrits par le code, aucun chiffre absent de la fiche n’est accepté. Une slide visée est
        la seule réécrite, les autres restent identiques.
      </p>
      {etat === "generation" ? <span className="text-xs text-zinc-500">30 s à 2 min, ne fermez pas la page.</span> : null}
      {retour ? (
        <p role="status" className={`text-xs ${retour.ok ? "text-emerald-700" : "text-red-700"}`}>
          {retour.texte}
        </p>
      ) : null}

      {vignettesPrecedentes ? (
        <div className="flex flex-col gap-2 border-t border-zinc-200 pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setComparer((v) => !v)} className="rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs font-semibold hover:bg-zinc-100">
              {comparer ? "Masquer la version précédente" : "Comparer avec la version précédente"}
            </button>
            <button type="button" onClick={revenir} disabled={occupe} className="rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs font-semibold hover:bg-zinc-100 disabled:opacity-50">
              Revenir à la version précédente
            </button>
          </div>
          {comparer ? (
            <ul className="flex gap-2 overflow-x-auto pb-2">
              {vignettesPrecedentes.map((v) => (
                <li key={v.numero} className="flex w-40 shrink-0 flex-col gap-1">
                  <img src={v.url} alt={`Version précédente, slide ${v.numero}`} className="w-40 rounded-lg border border-zinc-200" loading="lazy" />
                  <span className="text-[11px] text-zinc-500">
                    {v.numero}/{v.total} · {v.libelle}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {retours.length ? (
        <details className="border-t border-zinc-200 pt-3 text-xs text-zinc-600">
          <summary className="cursor-pointer font-semibold">Remarques déjà faites sur cette fiche ({retours.length})</summary>
          <ul className="mt-2 flex flex-col gap-1">
            {retours
              .slice()
              .reverse()
              .map((r, i) => (
                <li key={i}>
                  {dateCourte(r.date)} · {r.slide ? `slide ${r.slide.numero} (${r.slide.libelle})` : r.cible === "tweet" ? "tweet long" : "toutes"} ·{" "}
                  <span className={r.resultat === "acceptée" ? "text-emerald-700" : r.resultat === "refusée" ? "text-red-700" : "text-zinc-700"}>{r.resultat}</span>
                  {r.remarque ? ` · « ${r.remarque} »` : ""}
                </li>
              ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
