"use client";

/* eslint-disable @next/next/no-img-element -- slides générées par /api/carrousel, déjà au bon format. */
import { useState } from "react";
import { LEGENDE_MAX } from "@/lib/carrousel";
import { creerZip } from "@/lib/zip-simple";

// Partie interactive du carrousel Instagram (/test/reseaux/[id]) : vignettes
// (défilement horizontal sur mobile) avec « Télécharger », « Tout
// télécharger » (zip assemblé dans le navigateur, src/lib/zip-simple.js, comme
// pour les Reels : les slides + legende.txt), et légende modifiable avec
// compteur et « Copier la légende ». Rien n'est enregistré en base.
// `vignettes` : [{ numero, total, libelle, fichier, url }].

function telechargerBlob(blob, nom) {
  const lien = document.createElement("a");
  lien.href = URL.createObjectURL(blob);
  lien.download = nom;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(lien.href), 10_000);
}

export default function CarrouselPartage({ vignettes, legendeInitiale, archive, prefixeFichier }) {
  const [legende, setLegende] = useState(legendeInitiale);
  const [copie, setCopie] = useState(null);
  const [etat, setEtat] = useState("repos"); // repos | preparation | erreur
  const [progression, setProgression] = useState("");
  const [erreur, setErreur] = useState("");
  const longueur = legende.length;
  const tropLongue = longueur > LEGENDE_MAX;
  const modifiee = legende !== legendeInitiale;

  async function copier() {
    try {
      await navigator.clipboard.writeText(legende);
      setCopie("Copiée");
    } catch {
      setCopie("Copie impossible : sélectionnez le texte à la main");
    }
    setTimeout(() => setCopie(null), 2500);
  }

  async function toutTelecharger() {
    if (etat === "preparation") return;
    setEtat("preparation");
    setErreur("");
    let faites = 0;
    try {
      const fichiers = await Promise.all(
        vignettes.map(async ({ fichier, url }) => {
          const reponse = await fetch(url);
          if (!reponse.ok) throw new Error(`${fichier} indisponible (${reponse.status})`);
          const donnees = new Uint8Array(await reponse.arrayBuffer());
          faites++;
          setProgression(`${faites}/${vignettes.length}`);
          return { nom: fichier, donnees };
        }),
      );
      // La légende telle qu'elle est dans la zone de texte (modifications comprises).
      const zip = creerZip([...fichiers, { nom: "legende.txt", donnees: legende }]);
      telechargerBlob(new Blob([zip], { type: "application/zip" }), archive);
      setEtat("repos");
    } catch (error) {
      setErreur(`Archive impossible : ${error.message}`);
      setEtat("erreur");
    }
    setProgression("");
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={toutTelecharger}
          disabled={etat === "preparation"}
          className="rounded-full border border-zinc-900 bg-zinc-900 px-4 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-80 disabled:cursor-wait disabled:opacity-60"
        >
          {etat === "preparation" ? `Préparation de l’archive… ${progression}` : "Tout télécharger (.zip)"}
        </button>
        <span className="text-xs text-zinc-500">
          {vignettes.length} slides + legende.txt, dans {archive}
        </span>
        {erreur ? (
          <span role="status" className="text-xs text-red-700">
            {erreur}
          </span>
        ) : null}
      </div>

      <ol className="-mx-6 flex snap-x gap-4 overflow-x-auto px-6 pb-2 sm:mx-0 sm:px-0">
        {vignettes.map(({ numero, total, libelle, fichier, url }) => (
          <li key={numero} className="flex w-44 shrink-0 snap-start flex-col gap-2 sm:w-[calc((100%-5*1rem)/6)] sm:min-w-36">
            <a href={url} target="_blank" rel="noopener noreferrer">
              <img
                src={url}
                alt={`Slide ${numero}/${total} : ${libelle}`}
                width={1080}
                height={1350}
                loading="lazy"
                className="aspect-[4/5] w-full rounded-lg border border-zinc-200 bg-white"
              />
            </a>
            <span className="text-xs text-zinc-600">
              <span className="font-semibold text-zinc-900">
                {numero}/{total}
              </span>{" "}
              {libelle}
            </span>
            <a
              href={url}
              download={`${prefixeFichier}-${fichier}`}
              className="self-start rounded-full bg-zinc-900 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-zinc-800"
            >
              Télécharger
            </a>
          </li>
        ))}
      </ol>

      <div className={`flex flex-col gap-2 rounded-xl border bg-white p-4 ${tropLongue ? "border-red-300" : "border-zinc-200"}`}>
        <div className="flex items-center justify-between gap-2 text-xs text-zinc-500">
          <span className="font-semibold uppercase tracking-wide">
            Légende
            {modifiee ? <span className="ml-2 normal-case text-amber-700">modifiée</span> : null}
          </span>
          <span aria-live="polite" className={tropLongue ? "font-semibold text-red-700" : ""}>
            {longueur.toLocaleString("fr-FR")} / {LEGENDE_MAX.toLocaleString("fr-FR")}
            {tropLongue ? " · À raccourcir avant de publier" : ""}
          </span>
        </div>
        <textarea
          value={legende}
          onChange={(event) => setLegende(event.target.value)}
          rows={Math.max(8, legende.split("\n").length + 1)}
          aria-label="Légende Instagram"
          className="w-full resize-y rounded-lg border border-zinc-200 p-2 text-sm leading-relaxed text-zinc-900 focus:border-zinc-400 focus:outline-none"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={copier}
            className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-zinc-800"
          >
            Copier la légende
          </button>
          {modifiee ? (
            <button
              type="button"
              onClick={() => setLegende(legendeInitiale)}
              className="text-xs font-semibold text-zinc-600 underline underline-offset-2 hover:text-zinc-900"
            >
              Revenir au texte proposé
            </button>
          ) : null}
          {copie ? (
            <span role="status" className="text-xs text-zinc-600">
              {copie}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
