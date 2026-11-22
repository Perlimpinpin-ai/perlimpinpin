"use client";

import { useState } from "react";
import { creerZip } from "@/lib/zip-simple";

// Storyboard d'un Reel (v4) sur /test/reels/<id> : zip, couverture, planches
// (une par scène), images clés, script et sous-titres à copier. Rien n'est
// écrit en base. Données préparées par la page (donneesPageStoryboard,
// src/lib/reel-storyboard-paquet.js).

function BoutonCopier({ texte, libelle }) {
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
    <button type="button" onClick={copier} className="rounded-full border border-zinc-900 bg-zinc-900 px-4 py-1.5 text-xs font-semibold text-white hover:opacity-80">
      {etat === "copie" ? "Copié ✓" : etat === "erreur" ? "Copie impossible" : libelle}
    </button>
  );
}

function Lien({ href, fichier, children = "Télécharger" }) {
  return (
    <a href={href} download={fichier} className="rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs font-semibold text-zinc-800 hover:bg-zinc-100">
      {children}
    </a>
  );
}

async function enLots(elements, taille, fonction) {
  const resultats = [];
  for (let i = 0; i < elements.length; i += taille) resultats.push(...(await Promise.all(elements.slice(i, i + taille).map(fonction))));
  return resultats;
}

function ToutTelecharger({ paquet }) {
  const [etat, setEtat] = useState("repos");
  const [progression, setProgression] = useState("");
  const [erreur, setErreur] = useState("");
  async function telecharger() {
    if (etat === "preparation") return;
    setEtat("preparation");
    setErreur("");
    let faits = 0;
    try {
      const fichiers = await enLots(paquet.medias, 4, async ({ nom, url }) => {
        const reponse = await fetch(url);
        if (!reponse.ok) throw new Error(`${nom} indisponible (${reponse.status})`);
        const donnees = new Uint8Array(await reponse.arrayBuffer());
        faits++;
        setProgression(`${faits}/${paquet.medias.length}`);
        return { nom, donnees };
      });
      const archive = creerZip([...fichiers, ...paquet.fichiersTexte]);
      const lien = document.createElement("a");
      lien.href = URL.createObjectURL(new Blob([archive], { type: "application/zip" }));
      lien.download = paquet.archive;
      document.body.appendChild(lien);
      lien.click();
      lien.remove();
      setTimeout(() => URL.revokeObjectURL(lien.href), 10_000);
      setEtat("repos");
    } catch (e) {
      setErreur(`Archive impossible : ${e.message}`);
      setEtat("erreur");
    }
    setProgression("");
  }
  return (
    <span className="flex flex-col gap-1">
      <button
        type="button"
        onClick={telecharger}
        disabled={etat === "preparation"}
        className="rounded-full border border-zinc-900 bg-zinc-900 px-4 py-1.5 text-xs font-semibold text-white hover:opacity-80 disabled:cursor-wait disabled:opacity-60"
      >
        {etat === "preparation" ? `Préparation de l’archive… ${progression}` : "Tout télécharger (.zip)"}
      </button>
      {erreur ? <span role="status" className="text-xs text-red-700">{erreur}</span> : null}
    </span>
  );
}

function Morceau({ texte }) {
  return (
    <>
      {texte.split(/(\*\*.+?\*\*)/).map((partie, i) =>
        i % 2 ? (
          <mark key={i} className="bg-yellow-300 px-0.5 font-semibold text-zinc-900">
            {partie.slice(2, -2)}
          </mark>
        ) : (
          <span key={i}>{partie}</span>
        ),
      )}
    </>
  );
}

export default function ReelStoryboard({ couverture, scenes, script, srt, paquet, duree, estime, mode }) {
  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3">
        <ToutTelecharger paquet={paquet} />
        <span className="text-xs text-zinc-500">
          Couverture, {scenes.length} planches, {scenes.length * 3} images clés, calques, sons, sous-titres, minutage, écarts, storyboard.json et infos, dans {paquet.archive}.
        </span>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-extrabold tracking-tight">Couverture</h2>
        <p className="text-sm text-zinc-600">Photo du Reel sur Instagram : tout tient dans la bande centrale 1080 × 1350. Pas de score.</p>
        <div className="flex flex-wrap items-start gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- image générée à la demande. */}
          <img src={couverture.url} alt={`Couverture : ${couverture.titre}`} width={1080} height={1920} className="aspect-[9/16] w-44 rounded-lg border border-zinc-200 bg-zinc-900 sm:w-52" />
          <dl className="flex flex-col gap-1 text-sm">
            <dt className="font-mono text-xs uppercase text-zinc-400">Titre</dt>
            <dd className="font-semibold">{couverture.titre}</dd>
            <dt className="mt-2 font-mono text-xs uppercase text-zinc-400">Question</dt>
            <dd className="font-semibold">{couverture.question}</dd>
            <dd className="mt-2">
              <Lien href={couverture.url} fichier="00-couverture.png" />
            </dd>
          </dl>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-extrabold tracking-tight">Planches ({scenes.length} scènes, {duree}{estime ? ", durées estimées" : ""})</h2>
        <ol className="flex flex-col gap-8">
          {scenes.map((s) => (
            <li key={s.numero} className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-bold">
                  {s.numero}. {s.nom}
                </span>
                <span className="rounded bg-yellow-300 px-1.5 py-0.5 font-mono text-xs text-zinc-900">{s.type}</span>
                <span className="text-zinc-500">
                  {s.debut} – {s.fin} · {s.duree} s
                </span>
                <span className="ml-auto flex flex-wrap gap-2">
                  <Lien href={s.planche} fichier={`planche-${String(s.numero).padStart(2, "0")}.png`}>Planche</Lien>
                  {s.images.map((src, k) => (
                    <Lien key={src} href={src} fichier={`scene-${String(s.numero).padStart(2, "0")}-${k + 1}.png`}>
                      Image {k + 1}
                    </Lien>
                  ))}
                </span>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element -- planche générée à la demande. */}
              <img src={s.planche} alt={`Planche de la scène ${s.numero}`} loading="lazy" className="w-full rounded-lg border border-zinc-200" />
              <details className="text-sm">
                <summary className="cursor-pointer text-zinc-500">Voix et mouvements en texte</summary>
                <ol className="mt-2 flex flex-col gap-1">
                  {s.voix.map((v, k) => (
                    <li key={k}>
                      <span className="font-mono text-xs text-zinc-400">{k + 1}</span> <Morceau texte={v} />{" "}
                      <span className="text-zinc-500">— {s.mouvement[k]}</span>
                    </li>
                  ))}
                </ol>
              </details>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-extrabold tracking-tight">{mode === "A" ? "Script à enregistrer" : "Script de l’équipe"}</h2>
          <BoutonCopier texte={script} libelle="Copier le script" />
        </div>
        <pre className="whitespace-pre-wrap rounded-xl border border-zinc-200 bg-white p-4 font-sans text-sm leading-relaxed">{script}</pre>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-extrabold tracking-tight">Sous-titres (.srt)</h2>
          <BoutonCopier texte={srt} libelle="Copier les sous-titres" />
        </div>
        <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-xl border border-zinc-200 bg-white p-4 font-mono text-xs leading-relaxed">{srt}</pre>
      </section>
    </div>
  );
}
