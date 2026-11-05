"use client";

import { useActionState, useState } from "react";
import { publierRevision, reclasserAnnotation, rejeterRevision, traiterMaintenant } from "./actions";

// Formulaires de la page admin de la revue du dimanche (/test/revue). Les
// contrôles d'accès et la vérification du « oui » sont faits côté serveur.

const bouton =
  "rounded-full px-4 py-1.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40";

function Etat({ etat }) {
  if (!etat?.message) return null;
  return (
    <p role="status" className={`text-sm ${etat.ok ? "text-emerald-700" : "text-red-700"}`}>
      {etat.message}{" "}
      {etat.lien ? (
        <a href={etat.lien} target="_blank" rel="noreferrer" className="underline">
          Voir sur GitHub
        </a>
      ) : null}
    </p>
  );
}

export function Reclasser({ commentId, categorie, reponse, categories }) {
  const [etat, action, enCours] = useActionState(reclasserAnnotation, null);
  return (
    <form action={action} className="mt-2 flex flex-col gap-2">
      <input type="hidden" name="commentId" value={commentId} />
      <div className="flex flex-wrap items-center gap-2">
        <select name="categorie" defaultValue={categorie ?? ""} className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-sm">
          {categorie ? null : <option value="">(pas encore triée)</option>}
          {Object.entries(categories).map(([cle, libelle]) => (
            <option key={cle} value={cle}>
              {libelle}
            </option>
          ))}
        </select>
        <button type="submit" disabled={enCours} className={`${bouton} border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-100`}>
          {enCours ? "…" : "Reclasser"}
        </button>
      </div>
      <textarea
        name="reponse"
        defaultValue={reponse ?? ""}
        rows={2}
        maxLength={2000}
        placeholder="Réponse de l'équipe (facultatif : sinon, la réponse proposée est gardée)"
        className="w-full rounded-lg border border-zinc-300 bg-white px-2 py-1 text-sm"
      />
      <Etat etat={etat} />
    </form>
  );
}

export function Publier({ revisionId }) {
  const [etat, action, enCours] = useActionState(publierRevision, null);
  const [saisie, setSaisie] = useState("");
  const pret = saisie.trim().toLowerCase() === "oui";
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="revisionId" value={revisionId} />
      <label className="text-sm text-zinc-700">
        Pour publier cette version, tapez <b>oui</b> :
        <input
          name="confirmation"
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          autoComplete="off"
          className="ml-2 w-20 rounded-lg border border-zinc-300 bg-white px-2 py-1 text-sm"
        />
      </label>
      <div>
        <button type="submit" disabled={!pret || enCours || etat?.ok} className={`${bouton} bg-zinc-900 text-white hover:bg-zinc-700`}>
          {enCours ? "Publication…" : "Publier la nouvelle version"}
        </button>
      </div>
      <Etat etat={etat} />
    </form>
  );
}

export function Rejeter({ revisionId }) {
  const [etat, action, enCours] = useActionState(rejeterRevision, null);
  return (
    <form action={action} className="flex flex-col gap-1">
      <input type="hidden" name="revisionId" value={revisionId} />
      <div>
        <button type="submit" disabled={enCours || etat?.ok} className={`${bouton} border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100`}>
          Rejeter cette révision
        </button>
      </div>
      <Etat etat={etat} />
    </form>
  );
}

export function TraiterMaintenant({ propositionId = "" }) {
  const [etat, action, enCours] = useActionState(traiterMaintenant, null);
  return (
    <form action={action} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {propositionId ? (
          <input type="hidden" name="propositionId" value={propositionId} />
        ) : (
          <input
            name="propositionId"
            inputMode="numeric"
            placeholder="id de la fiche"
            className="w-32 rounded-lg border border-zinc-300 bg-white px-2 py-1 text-sm"
          />
        )}
        <button type="submit" disabled={enCours || etat?.ok} className={`${bouton} bg-yellow-300 text-zinc-900 hover:bg-yellow-400`}>
          {enCours ? "Lancement…" : "Traiter maintenant"}
        </button>
      </div>
      <Etat etat={etat} />
    </form>
  );
}
