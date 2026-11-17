"use client";

import { useState } from "react";
import { creerZip } from "@/lib/zip-simple";

// Contenu interactif de /test/reels/[id] : boutons « Copier », interrupteur
// sombre / clair des images, téléchargement de chaque image. Rien n'est écrit
// en base. Les données arrivent prêtes de la page (composant serveur).

function BoutonCopier({ texte, libelle = "Copier" }) {
  const [etat, setEtat] = useState("repos");
  async function copier() {
    try {
      await navigator.clipboard.writeText(texte);
      setEtat("copie");
    } catch {
      setEtat("erreur");
    }
    setTimeout(() => setEtat("repos"), 2000);
  }
  return (
    <button
      type="button"
      onClick={copier}
      className="rounded-full border border-zinc-900 bg-zinc-900 px-4 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-80"
    >
      {etat === "copie" ? "Copié ✓" : etat === "erreur" ? "Copie impossible" : libelle}
    </button>
  );
}

function Interrupteur({ theme, setTheme }) {
  return (
    <div role="group" aria-label="Thème des images" className="inline-flex rounded-full border border-zinc-300 bg-white p-0.5 text-xs font-semibold">
      {[
        ["sombre", "Sombre"],
        ["clair", "Clair"],
      ].map(([valeur, libelle]) => (
        <button
          key={valeur}
          type="button"
          aria-pressed={theme === valeur}
          onClick={() => setTheme(valeur)}
          className={`rounded-full px-3 py-1 transition-colors ${theme === valeur ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"}`}
        >
          {libelle}
        </button>
      ))}
    </div>
  );
}

function Vignette({ src, alt, fichier }) {
  return (
    <figure className="flex flex-col gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element -- image générée à la demande, pas d'optimisation voulue. */}
      <img src={src} alt={alt} width={1080} height={1920} loading="lazy" className="aspect-[9/16] w-full rounded-lg border border-zinc-200 bg-zinc-100 object-cover" />
      <a
        href={src}
        download={fichier}
        className="self-start rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs font-semibold text-zinc-800 transition-colors hover:bg-zinc-100"
      >
        Télécharger
      </a>
    </figure>
  );
}

// « Tout télécharger (.zip) » : l'archive est assemblée ici, dans le
// navigateur (src/lib/zip-simple.js), avec les 9 images du thème choisi et
// les 4 fichiers texte préparés par la page. Côté serveur, une archive
// d'environ 14 Mo dépasserait la taille de réponse permise par Vercel.
function ToutTelecharger({ paquet, urls, theme }) {
  const [etat, setEtat] = useState("repos"); // repos | preparation | erreur
  const [erreur, setErreur] = useState("");

  async function telecharger() {
    if (etat === "preparation") return;
    setEtat("preparation");
    setErreur("");
    try {
      const images = await Promise.all(
        urls.map(async (url, i) => {
          const reponse = await fetch(url);
          if (!reponse.ok) throw new Error(`image ${i + 1} indisponible (${reponse.status})`);
          return { nom: paquet.nomsImages[i], donnees: new Uint8Array(await reponse.arrayBuffer()) };
        }),
      );
      const archive = creerZip([...images, ...paquet.fichiersTexte]);
      const lien = document.createElement("a");
      lien.href = URL.createObjectURL(new Blob([archive], { type: "application/zip" }));
      lien.download = paquet.archive[theme];
      document.body.appendChild(lien);
      lien.click();
      lien.remove();
      setTimeout(() => URL.revokeObjectURL(lien.href), 10_000);
      setEtat("repos");
    } catch (error) {
      setErreur(`Archive impossible : ${error.message}`);
      setEtat("erreur");
    }
  }

  return (
    <span className="flex flex-col gap-1">
      <button
        type="button"
        onClick={telecharger}
        disabled={etat === "preparation"}
        className="rounded-full border border-zinc-900 bg-zinc-900 px-4 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-80 disabled:cursor-wait disabled:opacity-60"
      >
        {etat === "preparation" ? "Préparation de l’archive…" : "Tout télécharger (.zip)"}
      </button>
      {erreur ? <span role="status" className="text-xs text-red-700">{erreur}</span> : null}
    </span>
  );
}

// Props : { texteVoix, texteSousTitres, nbMots, duree, scenes: [{ numero, nom,
// voix, sousTitres }], images: { sombre: [url…], clair: [url…] },
// prefixeFichier, paquet (zip, voir la page), script (false : images seules,
// pour l'aperçu du style) }.
export default function ReelPartage({ texteVoix, texteSousTitres, nbMots, duree, scenes, images, prefixeFichier, paquet, script = true }) {
  const [theme, setTheme] = useState("sombre");
  const urls = images[theme];
  const fichier = (numero) => `${prefixeFichier}-scene-${numero}-${theme}.png`;

  return (
    <div className="flex flex-col gap-10">
      {paquet ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3">
          <ToutTelecharger paquet={paquet} urls={urls} theme={theme} />
          <Interrupteur theme={theme} setTheme={setTheme} />
          <span className="text-xs text-zinc-500">
            9 images ({theme}), script, sous-titres, plan de montage et infos, dans {paquet.archive[theme]}.
          </span>
        </div>
      ) : null}
      {script ? (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-extrabold tracking-tight">1. Script pour ElevenLabs</h2>
            <BoutonCopier texte={texteVoix} libelle="Copier le script" />
          </div>
          <p className="text-sm text-zinc-600">
            {nbMots} mots · durée estimée {duree} (150 mots par minute) · un paragraphe par scène, nombres en toutes lettres.
          </p>
          <pre className="whitespace-pre-wrap rounded-xl border border-zinc-200 bg-white p-4 font-sans text-sm leading-relaxed text-zinc-900">
            {texteVoix}
          </pre>
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-extrabold tracking-tight">{script ? "2. Les 9 images" : "Les 9 images"}</h2>
          <Interrupteur theme={theme} setTheme={setTheme} />
        </div>
        <p className="text-sm text-zinc-600">1080 × 1920, une par scène. Clic droit ou « Télécharger » pour les enregistrer.</p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {urls.map((src, i) => (
            <div key={src} className="flex flex-col gap-1">
              <p className="text-xs font-semibold text-zinc-500">
                {scenes[i].numero}. {scenes[i].nom}
              </p>
              <Vignette src={src} alt={`Scène ${scenes[i].numero}, ${scenes[i].nom}`} fichier={fichier(scenes[i].numero)} />
            </div>
          ))}
        </div>
      </section>

      {script ? (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-extrabold tracking-tight">3. Plan de montage</h2>
            <ol className="flex flex-col gap-3">
              {scenes.map((scene, i) => (
                <li key={scene.numero} className="flex gap-4 rounded-xl border border-zinc-200 bg-white p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element -- vignette de l'image générée. */}
                  <img src={urls[i]} alt="" width={1080} height={1920} loading="lazy" className="aspect-[9/16] w-20 shrink-0 rounded-md border border-zinc-200 object-cover sm:w-24" />
                  <div className="flex min-w-0 flex-col gap-2 text-sm">
                    <p className="font-semibold text-zinc-900">
                      Scène {scene.numero} · {scene.nom}
                    </p>
                    <p className="text-zinc-800">
                      <span className="mr-1 font-mono text-xs uppercase text-zinc-400">Voix</span>
                      {scene.voix}
                    </p>
                    <p className="text-zinc-600">
                      <span className="mr-1 font-mono text-xs uppercase text-zinc-400">Sous-titres</span>
                      {scene.sousTitres}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-extrabold tracking-tight">4. Sous-titres</h2>
              <BoutonCopier texte={texteSousTitres} libelle="Copier les sous-titres" />
            </div>
            <pre className="whitespace-pre-wrap rounded-xl border border-zinc-200 bg-white p-4 font-sans text-sm leading-relaxed text-zinc-900">
              {texteSousTitres}
            </pre>
          </section>
        </>
      ) : null}
    </div>
  );
}
