"use client";

import { useEffect, useState } from "react";
import { avertissementsFil } from "@/lib/couleurs-carrousel";

// Couleur du candidat et check-list « À relire avant de publier » du
// carrousel détaillé (section 6 de docs/prompt-carrousel.md), sur
// /test/reseaux/<id>.
//  - « Couleurs des 2 derniers carrousels publiés » : on choisit les
//    candidats des deux derniers carrousels (leur couleur s'affiche), mémorisés
//    dans ce navigateur (localStorage), jamais en base. Si la couleur du
//    candidat est la même, ou presque, qu'une des deux : avertissement bien visible.
//  - Check-list : les points vérifiables sont cochés par le code (`auto`
//    true/false, non modifiables) ; les autres se cochent à la main (rien
//    n'est enregistré).
// `couleur` : { fond, bloc } ; `candidats` : [{ nom, fond }] ; `items` :
// listeARelire (src/lib/carrousel-recit.js).

const CLE_STOCKAGE = "perlimpinpin.carrousel.candidatsDerniers";

function lire() {
  try {
    const valeur = JSON.parse(window.localStorage.getItem(CLE_STOCKAGE) ?? "[]");
    return Array.isArray(valeur) ? [valeur[0] ?? "", valeur[1] ?? ""] : ["", ""];
  } catch {
    return ["", ""];
  }
}

function Pastille({ fond }) {
  return <span aria-hidden className="inline-block h-3 w-3 rounded-sm align-middle" style={{ backgroundColor: fond ?? "transparent" }} />;
}

export default function ListeARelireCarrousel({ candidatNom, couleur, couleurAttribuee, candidats, items }) {
  const [derniers, setDerniers] = useState(["", ""]);
  const [coches, setCoches] = useState({});

  useEffect(() => {
    // Lecture après le premier rendu : le serveur ne connaît pas le navigateur.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- valeur mémorisée dans le navigateur
    setDerniers(lire());
  }, []);

  function choisir(index, valeur) {
    const suivants = derniers.map((d, i) => (i === index ? valeur : d));
    setDerniers(suivants);
    try {
      window.localStorage.setItem(CLE_STOCKAGE, JSON.stringify(suivants));
    } catch {
      // Stockage indisponible (navigation privée) : le choix vaut pour cette page.
    }
  }

  const fondDe = (nom) => candidats.find((c) => c.nom === nom)?.fond ?? null;
  // Charte RS : même couleur qu'un des 2 derniers posts (bloquant), deux posts
  // chauds (ou froids) de suite (avertissement simple).
  const fil = avertissementsFil(couleur?.fond, derniers.map(fondDe));
  const meme = fil.some((a) => a.cle === "meme");
  const temperature = fil.find((a) => a.cle === "temperature");
  const renseignes = derniers.every(Boolean);
  const couleurOk = couleurAttribuee && renseignes && !meme;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3 text-sm">
        <span>
          Couleur de {candidatNom} : <Pastille fond={couleur?.fond} /> <code className="text-xs">{couleur?.fond}</code>
          {couleurAttribuee ? null : <span className="ml-1 font-semibold text-red-700">(pas encore attribuée)</span>}
        </span>
        <label className="flex flex-wrap items-center gap-2">
          <span className="text-zinc-600">Couleurs des 2 derniers posts publiés :</span>
          {[0, 1].map((i) => (
            <span key={i} className="flex items-center gap-1">
              <Pastille fond={fondDe(derniers[i])} />
              <select value={derniers[i]} onChange={(e) => choisir(i, e.target.value)} aria-label={`Candidat du carrousel publié n° ${i + 1}`} className="rounded border border-zinc-300 px-2 py-1 text-sm">
                <option value="">—</option>
                {candidats.map((c) => (
                  <option key={c.nom} value={c.nom}>
                    {c.nom}
                  </option>
                ))}
              </select>
            </span>
          ))}
        </label>
        <span className="text-xs text-zinc-500">mémorisé dans ce navigateur</span>
      </div>
      {meme ? (
        <p role="alert" className="rounded-xl border-2 border-red-500 bg-red-50 p-3 text-sm font-bold text-red-800">
          Même couleur qu’un des 2 derniers carrousels : attendez avant de publier, ou publiez d’abord un autre candidat.
        </p>
      ) : null}
      {temperature ? <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{temperature.message}</p> : null}

      <div className="rounded-xl border border-orange-300 bg-orange-50 p-4 text-sm text-orange-950">
        <p className="font-semibold">Vérifications avant publication (charte RS, page 20)</p>
        <ul className="mt-2 flex flex-col gap-1.5">
          {items.map((item) => {
            const automatique = item.auto !== null;
            const coche = item.auto === "couleur" ? couleurOk : automatique ? item.auto : Boolean(coches[item.cle]);
            return (
              <li key={item.cle}>
                <label className="flex items-start gap-2">
                  <input type="checkbox" checked={coche} disabled={automatique} onChange={(e) => setCoches({ ...coches, [item.cle]: e.target.checked })} className="mt-0.5" />
                  <span className={automatique && !coche ? "font-semibold text-red-700" : undefined}>
                    {item.libelle}{" "}
                    <span className="text-xs text-orange-700">
                      {item.auto === "couleur"
                        ? renseignes
                          ? "(vérifié d’après les 2 derniers carrousels)"
                          : "(renseignez les 2 derniers carrousels ci-dessus)"
                        : automatique
                          ? "(vérifié par le code)"
                          : "(à cocher à la main)"}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
