"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LABEL_SECTION_GENERALE, SECTION_GENERALE } from "@/lib/fiche-annotations-core";

// Bouton « Commenter cette analyse » d'une fiche publiée (/declarations/[id]).
// Trois parcours, avec retour sur la même fiche (#commenter rouvre ce panneau) :
//   - adhérent connecté : commentaire sur l'ensemble de l'analyse (même table
//     et même API que les annotations, sans passage cité), ou annotation d'un
//     passage précis dans la vue experte ;
//   - adhérent pas connecté : /relectures/connexion?retour=… ;
//   - pas encore adhérent : /relectures/adherer?retour=… (HelloAsso, puis mail
//     de bienvenue et retour sur la fiche à l'activation du compte).
// L'adhésion est vérifiée par le serveur à l'envoi (session du Club) : ce
// composant ne fait qu'orienter.

const ANCRE = "#commenter";
const CASE = "rounded-2xl border border-yellow-200 bg-yellow-50/60 p-5";

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

export default function CommenterAnalyse({ propositionId, analyseId, retour }) {
  const slug = `fiche-${propositionId}`;
  const [etat, setEtat] = useState("ferme"); // ferme | chargement | visiteur | membre | envoye
  const [commentaires, setCommentaires] = useState([]);
  const [envoi, setEnvoi] = useState({ enCours: false, erreur: null });
  const bloc = useRef(null);
  const retourCommenter = `${retour}${ANCRE}`;
  const suite = `?retour=${encodeURIComponent(retourCommenter)}`;

  const ouvrir = useCallback(async () => {
    setEtat("chargement");
    const moi = await lireJson("/api/relectures/moi").catch(() => null);
    if (!moi) {
      setEtat("visiteur");
      return;
    }
    const liste = (await lireJson(`/api/relectures/comments?fiche=${encodeURIComponent(slug)}`).catch(() => null)) ?? [];
    // Lot 5 : les commentaires clos sont dans l'historique des versions.
    setCommentaires(liste.filter((c) => c.sectionId === SECTION_GENERALE && c.quotedText == null && c.etat !== "traitee"));
    setEtat("membre");
  }, [slug]);

  // Retour de connexion / d'adhésion : …#commenter rouvre le panneau.
  useEffect(() => {
    if (window.location.hash !== ANCRE) return undefined;
    const minuteur = setTimeout(() => {
      ouvrir().then(() => bloc.current?.scrollIntoView({ block: "start", behavior: "smooth" }));
    }, 0);
    return () => clearTimeout(minuteur);
  }, [ouvrir]);

  async function envoyer(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = form.body.value.trim();
    if (!body) return;
    setEnvoi({ enCours: true, erreur: null });
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
          creditAccord: form.credit.checked,
        }),
      });
      const res = await r.json().catch(() => ({}));
      if (r.status === 401) {
        setEnvoi({ enCours: false, erreur: null });
        setEtat("visiteur");
        return;
      }
      if (!r.ok) throw new Error(res.error || "Envoi impossible, réessayez.");
      setCommentaires((liste) => [...liste, res]);
      setEnvoi({ enCours: false, erreur: null });
      setEtat("envoye");
    } catch (error) {
      setEnvoi({ enCours: false, erreur: error.message });
    }
  }

  return (
    <div id="commenter" ref={bloc} className="scroll-mt-24 print:hidden">
      {etat === "ferme" || etat === "chargement" ? (
        <div className="flex flex-col items-start gap-1.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <button
              type="button"
              onClick={ouvrir}
              disabled={etat === "chargement"}
              aria-expanded={false}
              className="inline-flex items-center gap-2 rounded-xl bg-yellow-300 px-5 py-2.5 text-sm font-semibold text-zinc-900 transition-colors hover:bg-yellow-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:opacity-60"
            >
              Commenter cette analyse
            </button>
            <span className="text-xs text-zinc-500">réservé au Club, dès 2 €</span>
          </div>
          <p className="text-xs text-zinc-500">Réponse de l’équipe sous 7 jours</p>
        </div>
      ) : null}

      {etat === "visiteur" ? (
        <div className={CASE} role="region" aria-label="Commenter cette analyse">
          <p className="text-base font-semibold text-zinc-900">Commenter cette analyse</p>
          <p className="mt-2 text-sm leading-6 text-zinc-700">
            Commenter et annoter les analyses est réservé aux membres du Club Perlimpinpin. L’adhésion est à
            prix libre, dès 2 €. L’équipe répond à chaque commentaire sous 7 jours, et si votre remarque change
            l’analyse, la fiche est révisée.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            <a
              href={`/relectures/adherer${suite}`}
              className="inline-flex items-center rounded-full bg-yellow-300 px-4 py-2 text-sm font-semibold text-zinc-900 transition-colors hover:bg-yellow-400"
            >
              Adhérer au Club
            </a>
            <a
              href={`/relectures/connexion${suite}`}
              className="text-sm text-zinc-700 underline decoration-zinc-300 underline-offset-4 hover:text-zinc-900"
            >
              Déjà adhérent ? Se connecter
            </a>
          </div>
        </div>
      ) : null}

      {etat === "membre" || etat === "envoye" ? (
        <div className={CASE} role="region" aria-label="Commenter cette analyse">
          <p className="text-base font-semibold text-zinc-900">Commenter cette analyse</p>
          <p className="mt-1 text-sm leading-6 text-zinc-600">
            Pour réagir à un passage précis, sélectionnez-le dans l’analyse détaillée (vue experte) puis cliquez sur
            « ✎ Annoter ». Ici, un commentaire sur l’ensemble de l’analyse.
          </p>

          {commentaires.length > 0 ? (
            <ul className="mt-4 flex flex-col gap-2">
              {commentaires.map((c) => (
                <li key={c.id} className="rounded-xl border border-yellow-200 bg-white/80 px-3 py-2 text-sm">
                  <p className="flex justify-between gap-3 text-xs text-zinc-500">
                    <span className="font-semibold text-zinc-800">{c.authorName || "Membre du Club"}</span>
                    <span>{dateCourte(c.createdAt)}</span>
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-zinc-700">{c.body}</p>
                </li>
              ))}
            </ul>
          ) : null}

          {etat === "envoye" ? (
            <p className="mt-4 text-sm font-medium text-zinc-800" role="status">
              Merci ! Votre commentaire est enregistré. L’équipe vous répond sous 7 jours.
            </p>
          ) : (
            <form onSubmit={envoyer} className="mt-4 flex flex-col gap-3">
              <label htmlFor="commenter-texte" className="sr-only">
                Votre commentaire
              </label>
              <textarea
                id="commenter-texte"
                name="body"
                required
                maxLength={4000}
                rows={4}
                placeholder="Une source à ajouter, un chiffre discutable, un argument oublié, une question…"
                className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-4 focus:ring-zinc-900/5"
              />
              <label className="flex items-start gap-2 text-xs leading-5 text-zinc-600">
                <input type="checkbox" name="credit" className="mt-0.5" />
                J’accepte d’être crédité par mon prénom si mon commentaire fait évoluer la fiche
              </label>
              {envoi.erreur ? (
                <p role="alert" className="text-sm text-red-700">
                  {envoi.erreur}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={envoi.enCours}
                  className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50"
                >
                  {envoi.enCours ? "Envoi…" : "Envoyer"}
                </button>
                <span className="text-xs text-zinc-500">Réponse de l’équipe sous 7 jours</span>
              </div>
            </form>
          )}
        </div>
      ) : null}
    </div>
  );
}
