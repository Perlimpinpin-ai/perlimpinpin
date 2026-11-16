"use client";

import { useRef, useState, useTransition } from "react";
import { deposerFiche } from "./actions";

const TAILLE_MAX = 900 * 1024;

// Zone de glisser-déposer : un ou plusieurs fichiers .json. Chaque fichier est
// envoyé et contrôlé séparément ; le résultat de chacun s'affiche en clair.
export default function ZoneDepot() {
  const inputRef = useRef(null);
  const [deposePar, setDeposePar] = useState("");
  const [survol, setSurvol] = useState(false);
  const [resultats, setResultats] = useState([]);
  const [enCours, startTransition] = useTransition();

  function traiter(fichiers) {
    const liste = [...fichiers];
    if (!liste.length || enCours) return;
    if (!deposePar.trim()) {
      setResultats([{ nom: "", ok: false, erreurs: ["Indiquez d'abord votre nom dans « Déposé par »."] }]);
      return;
    }
    setResultats([]);
    startTransition(async () => {
      const sortie = [];
      for (const f of liste) {
        if (!/\.json$/i.test(f.name)) {
          sortie.push({ nom: f.name, ok: false, erreurs: ["Seuls les fichiers .json sont acceptés."] });
        } else if (f.size > TAILLE_MAX) {
          sortie.push({ nom: f.name, ok: false, erreurs: ["Fichier trop gros pour une fiche d'étape 1 (900 ko au plus)."] });
        } else {
          try {
            const texte = await f.text();
            const r = await deposerFiche({ nom: f.name, texte, deposePar });
            sortie.push({ nom: f.name, ...r });
          } catch {
            sortie.push({ nom: f.name, ok: false, erreurs: ["Envoi impossible (connexion ou serveur). Réessayez."] });
          }
        }
        setResultats([...sortie]);
      }
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex max-w-sm flex-col gap-1 text-sm font-medium text-zinc-800">
        Déposé par
        <input
          type="text"
          value={deposePar}
          onChange={(e) => setDeposePar(e.target.value)}
          maxLength={80}
          placeholder="Votre prénom et nom"
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base font-normal"
        />
      </label>

      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setSurvol(true);
        }}
        onDragLeave={() => setSurvol(false)}
        onDrop={(e) => {
          e.preventDefault();
          setSurvol(false);
          traiter(e.dataTransfer.files);
        }}
        className={`flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${
          survol ? "border-yellow-400 bg-yellow-50" : "border-zinc-300 bg-white/70 hover:bg-white"
        }`}
      >
        <p className="text-base font-semibold text-zinc-800">
          {enCours ? "Contrôle en cours…" : "Glissez ici une ou plusieurs fiches .json"}
        </p>
        <p className="text-sm text-zinc-500">ou cliquez pour choisir les fichiers. Le nom du fichier devient le nom de la fiche.</p>
        <input
          ref={inputRef}
          type="file"
          accept=".json,application/json"
          multiple
          className="hidden"
          onChange={(e) => traiter(e.target.files)}
        />
      </div>

      {resultats.length ? (
        <ul className="flex flex-col gap-2" aria-live="polite">
          {resultats.map((r, i) => (
            <li
              key={`${r.nom}-${i}`}
              className={`rounded-xl border p-3 text-sm ${r.ok ? "border-green-200 bg-green-50 text-green-900" : "border-red-200 bg-red-50 text-red-900"}`}
            >
              <p className="font-semibold">
                {r.nom ? `${r.nom} : ` : ""}
                {r.ok ? (r.simulation ? "conforme (mode simulation : rien n'a été enregistré)." : r.remplace ? "conforme, remise dans la file d'attente (remplace la version en erreur ou retirée)." : "conforme, ajoutée à la file d'attente.") : "refusée, rien n'a été enregistré."}
              </p>
              {r.erreurs?.length ? (
                <ul className="mt-1 list-disc pl-5">
                  {r.erreurs.map((e, j) => (
                    <li key={j} className="break-words">{e}</li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
