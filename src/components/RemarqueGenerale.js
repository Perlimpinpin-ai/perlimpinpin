"use client";

import { useEffect, useState } from "react";
import { LABEL_SECTION_GENERALE, SECTION_GENERALE } from "@/lib/fiche-annotations-core";
import { garderBrouillon, liensAdhesion, lireBrouillon, oublierBrouillon } from "@/lib/brouillon-club";
import { surSessionClub } from "@/lib/moi-club";

// « Une remarque sur l'ensemble de l'analyse ? », en bas de la vue experte
// d'une fiche publiée (remplace l'encadré « Commenter cette analyse »).
// Même logique que l'annotation d'un passage (AnnotationsFiche) :
//   - adhérent connecté : la remarque est envoyée (même table et même API que
//     les annotations, sans passage cité) ;
//   - visiteur : il l'écrit ; à l'envoi, elle est gardée dans son navigateur
//     (src/lib/brouillon-club.js) et un petit encart propose « Adhérer au
//     Club » ou « Déjà adhérent ? Se connecter ». De retour connecté, la
//     remarque est rouverte, prête à envoyer. Rien n'est enregistré en base
//     avant l'envoi par un adhérent connecté.
// « Réponse de l'équipe sous 7 jours » n'apparaît que dans la zone ouverte.

async function lireJson(url) {
  const r = await fetch(url, { cache: "no-store", credentials: "same-origin" });
  if (!r.ok) return null;
  return r.json().catch(() => null);
}

function dateCourte(iso) {
  try {
    return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Paris" });
  } catch {
    return "";
  }
}

export default function RemarqueGenerale({ propositionId, analyseId, retour }) {
  const slug = `fiche-${propositionId}`;
  const liens = liensAdhesion(retour);
  const [membre, setMembre] = useState(false);
  const [ouvert, setOuvert] = useState(false);
  const [texte, setTexte] = useState("");
  const [credit, setCredit] = useState(false);
  const [remarques, setRemarques] = useState([]);
  const [etat, setEtat] = useState("saisie"); // saisie | envoi | gardee | envoyee
  const [erreur, setErreur] = useState(null);

  // Adhérent ? (et remarques ouvertes des autres membres). Retour d'adhésion
  // ou de connexion : la remarque gardée est rouverte, prête à envoyer.
  useEffect(() => {
    let annule = false;
    let charge = false;
    const charger = async (moi) => {
      if (annule || !moi || charge) return;
      charge = true;
      const liste = (await lireJson(`/api/relectures/comments?fiche=${encodeURIComponent(slug)}`).catch(() => null)) ?? [];
      if (annule) return;
      setMembre(true);
      setRemarques(liste.filter((c) => c.sectionId === SECTION_GENERALE && c.quotedText == null && c.etat !== "traitee"));
      const brouillon = lireBrouillon(propositionId, "remarque");
      if (brouillon) {
        setTexte(brouillon.body);
        setCredit(brouillon.creditAccord === true);
        setOuvert(true);
      }
    };
    // Mis à jour en direct si la connexion est détectée après l'affichage.
    const desabonner = surSessionClub(charger);
    return () => {
      annule = true;
      desabonner();
    };
  }, [slug, propositionId]);

  function garder(corps = texte, accord = credit) {
    garderBrouillon(propositionId, "remarque", { body: corps, creditAccord: accord });
  }

  async function envoyer(event) {
    event.preventDefault();
    const body = texte.trim();
    if (!body) return;
    setErreur(null);
    if (!membre) {
      garder();
      setEtat("gardee");
      return;
    }
    setEtat("envoi");
    try {
      const r = await fetch("/api/relectures/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ficheSlug: slug,
          sectionId: SECTION_GENERALE,
          sectionLabel: LABEL_SECTION_GENERALE,
          body,
          analyseId,
          creditAccord: credit,
        }),
      });
      const res = await r.json().catch(() => ({}));
      if (r.status === 401) {
        // Session expirée : on garde la remarque et on propose de se reconnecter.
        setMembre(false);
        garder();
        setEtat("gardee");
        return;
      }
      if (!r.ok) throw new Error(res.error || "Envoi impossible, réessayez.");
      oublierBrouillon(propositionId, "remarque");
      setRemarques((liste) => [...liste, res]);
      setTexte("");
      setEtat("envoyee");
    } catch (error) {
      setErreur(error.message);
      setEtat("saisie");
    }
  }

  function annuler() {
    oublierBrouillon(propositionId, "remarque");
    setTexte("");
    setCredit(false);
    setEtat("saisie");
    setOuvert(false);
  }

  return (
    <div id="remarque" className="scroll-mt-24 print:hidden">
      {membre && remarques.length > 0 ? (
        <ul className="mb-4 flex flex-col gap-2">
          {remarques.map((c) => (
            <li key={c.id} className="rounded-xl border border-yellow-200 bg-yellow-50/60 px-3 py-2 text-sm">
              <p className="flex justify-between gap-3 text-xs text-zinc-500">
                <span className="font-semibold text-zinc-800">{c.authorName || "Membre du Club"}</span>
                <span>{dateCourte(c.createdAt)}</span>
              </p>
              <p className="mt-1 whitespace-pre-wrap text-zinc-700">{c.body}</p>
            </li>
          ))}
        </ul>
      ) : null}

      {etat === "envoyee" ? (
        <p role="status" className="text-sm text-zinc-700">
          Merci ! Votre remarque est enregistrée.{" "}
          <button type="button" onClick={() => setEtat("saisie")} className="underline underline-offset-4">
            Ajouter une autre remarque
          </button>
        </p>
      ) : !ouvert ? (
        <button
          type="button"
          onClick={() => setOuvert(true)}
          className="text-sm font-medium text-zinc-600 underline decoration-zinc-300 underline-offset-4 hover:text-zinc-900"
        >
          Une remarque sur l’ensemble de l’analyse ?
        </button>
      ) : (
        <form onSubmit={envoyer} className="flex flex-col gap-3 rounded-2xl border border-yellow-200 bg-yellow-50/50 p-4">
          <label htmlFor="remarque-texte" className="text-sm font-medium text-zinc-800">
            Une remarque sur l’ensemble de l’analyse ?
          </label>
          <textarea
            id="remarque-texte"
            value={texte}
            onChange={(e) => {
              setTexte(e.target.value);
              if (etat === "gardee") garder(e.target.value, credit);
            }}
            required
            autoFocus
            maxLength={4000}
            rows={4}
            placeholder="Une source à ajouter, un chiffre discutable, un argument oublié, une question…"
            className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-4 focus:ring-zinc-900/5"
          />
          <label className="flex items-start gap-2 text-xs leading-5 text-zinc-600">
            <input
              type="checkbox"
              checked={credit}
              onChange={(e) => {
                setCredit(e.target.checked);
                if (etat === "gardee") garder(texte, e.target.checked);
              }}
              className="mt-0.5"
            />
            J’accepte d’être crédité par mon prénom si ma remarque fait évoluer la fiche
          </label>
          <p className="text-xs text-zinc-500">Réponse de l’équipe sous 7 jours</p>
          {erreur ? (
            <p role="alert" className="text-sm text-red-700">
              {erreur}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={etat === "envoi"}
              className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50"
            >
              {etat === "envoi" ? "Envoi…" : "Envoyer"}
            </button>
            <button type="button" onClick={annuler} className="text-sm text-zinc-600 underline underline-offset-4">
              Annuler
            </button>
          </div>
          {etat === "gardee" ? (
            <div className="rounded-xl border border-yellow-300 bg-white p-3 text-sm text-zinc-700" role="status">
              <p>Votre remarque est gardée sur cet appareil. Pour l’envoyer :</p>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
                <a
                  href={liens.adherer}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex rounded-full bg-yellow-300 px-4 py-1.5 font-semibold text-zinc-900 hover:bg-yellow-400"
                >
                  Rejoindre le Club
                </a>
                <a href={liens.connexion} className="underline decoration-zinc-300 underline-offset-4 hover:text-zinc-900">
                  Déjà adhérent ? Se connecter
                </a>
              </div>
            </div>
          ) : null}
        </form>
      )}
    </div>
  );
}
