"use client";

import { useEffect, useRef, useState } from "react";

// Annotations du Club sur la vue experte d'une fiche PUBLIÉE (/declarations/[id]).
// Réutilise l'outil de /relectures (public/club/annotations.js), chargé une
// fois la page affichée : la page reste en cache (ISR) et ne contient jamais
// d'annotation, tout passe par le navigateur.
//
//   - Adhérent connecté (session du Club, /api/relectures/moi) : surlignage,
//     bulle de marge, notes complètes (/api/relectures/comments, session
//     exigée côté serveur) et ajout de notes, toujours ouvert.
//   - Tout autre visiteur : uniquement les passages surlignés et une bulle,
//     SANS texte (/api/fiches/<id>/zones ne renvoie ni note, ni auteur, ni
//     nombre). Un clic affiche le message d'adhésion.
// Aucun compteur ni chiffre nulle part.

const SCRIPT = "/club/annotations.js";
export const MESSAGE_NON_ADHERENT = "Des adhérents ont réagi à ce passage. Rejoignez le Club pour lire et participer.";

function chargerOutil() {
  if (window.ClubAnnotations) return Promise.resolve(window.ClubAnnotations);
  return new Promise((resolve, reject) => {
    let script = document.querySelector(`script[src="${SCRIPT}"]`);
    if (!script) {
      script = document.createElement("script");
      script.src = SCRIPT;
      script.async = true;
      document.head.appendChild(script);
    }
    script.addEventListener("load", () => resolve(window.ClubAnnotations));
    script.addEventListener("error", () => reject(new Error("outil d'annotation indisponible")));
  });
}

async function lireJson(url) {
  const r = await fetch(url, { cache: "no-store", credentials: "same-origin" });
  if (!r.ok) return null;
  return r.json().catch(() => null);
}

// Un passage annoté dans un accordéon fermé : on l'ouvre (AccordionSection).
function deplierAnnotees(view) {
  view.querySelectorAll('[data-accordeon="ferme"]').forEach((acc) => {
    if (acc.querySelector("mark.anno-hl")) acc.dispatchEvent(new Event("club-deplier"));
  });
}

const CASE_CREDIT =
  '<label class="anote-credit"><input type="checkbox" name="credit"> ' +
  "J’accepte d’être crédité par mon prénom si ma note fait évoluer la fiche</label>";

export default function AnnotationsFiche({ propositionId, analyseId, retour }) {
  const slug = `fiche-${propositionId}`;
  const [message, setMessage] = useState(null); // { top, left } du message non-adhérent
  const boite = useRef(null);

  useEffect(() => {
    let annule = false;
    (async () => {
      let outil;
      try {
        const Club = await chargerOutil();
        if (annule || !Club) return;
        const vue = () => document.querySelector(`[data-view="${slug}"]`);
        if (!vue()) return;
        // Un seul outil par fiche (l'effet peut être rejoué en développement) :
        // réservé juste avant la création, après les chargements.
        const deja = (window.__clubAnnotationsFiches ??= new Set());
        const reserver = () => {
          if (annule || deja.has(slug)) return false;
          deja.add(slug);
          return true;
        };

        const moi = await lireJson("/api/relectures/moi");
        if (annule) return;

        if (moi) {
          const liste = (await lireJson(`/api/relectures/comments?fiche=${encodeURIComponent(slug)}`)) ?? [];
          if (!reserver()) return;
          outil = Club.creer({
            api: "/api/relectures/comments",
            marge: false,
            bulles: true,
            notesRepliees: true,
            vueOuverte: vue,
            placeholder: "Votre note : une source, un chiffre discutable, une question…",
            brouillonExtraHtml: CASE_CREDIT,
            champsEnvoi: (form) => ({ analyseId, creditAccord: Boolean(form.credit?.checked) }),
            erreurSession: () => new Error("Votre session a expiré. Reconnectez-vous pour envoyer votre note."),
            ouvrirAnnotees: deplierAnnotees,
          });
          outil.charger(slug, liste.filter((c) => c.quotedText != null));
        } else {
          const data = await lireJson(`/api/fiches/${propositionId}/zones`);
          if (annule || !data?.zones?.length || !reserver()) return;
          outil = Club.creer({
            lectureSeule: true,
            marge: false,
            bulles: true,
            vueOuverte: vue,
            surClicZone: (_section, el) => {
              const r = el.getBoundingClientRect();
              const largeur = Math.min(340, window.innerWidth - 32);
              setMessage({
                top: r.bottom + 8,
                left: Math.max(16, Math.min(window.innerWidth - largeur - 16, r.left)),
                largeur,
              });
            },
          });
          // Identifiants locaux (les zones n'ont pas d'identité en base) ; passage
          // absent pour un commentaire de section : bulle seule.
          outil.charger(
            slug,
            data.zones.map((z, i) => ({ ...z, id: `z${i}`, quotedText: z.quotedText ?? "" })),
          );
        }
      } catch (error) {
        // Pas d'annotation possible : la fiche reste lisible normalement.
        console.warn("[club] annotations indisponibles :", error?.message ?? error);
      }
    })();
    return () => {
      annule = true;
    };
  }, [slug, propositionId, analyseId]);

  // Fermeture du message : clic ailleurs, Échap, défilement.
  useEffect(() => {
    if (!message) return undefined;
    const fermer = () => setMessage(null);
    const surClic = (ev) => {
      if (boite.current?.contains(ev.target) || ev.target.closest?.("mark.anno-hl, [data-anno-bulle]")) return;
      fermer();
    };
    const surTouche = (ev) => ev.key === "Escape" && fermer();
    document.addEventListener("mousedown", surClic);
    document.addEventListener("keydown", surTouche);
    window.addEventListener("scroll", fermer, { passive: true });
    boite.current?.querySelector("a")?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener("mousedown", surClic);
      document.removeEventListener("keydown", surTouche);
      window.removeEventListener("scroll", fermer);
    };
  }, [message]);

  if (!message) return null;
  const lienAdhesion = `/relectures/adherer?retour=${encodeURIComponent(retour)}`;
  return (
    <div
      ref={boite}
      role="dialog"
      aria-label="Annotations réservées au Club"
      className="anno-message fixed z-50 rounded-2xl border border-yellow-200 bg-white p-4 text-sm shadow-lg"
      style={{ top: message.top, left: message.left, width: message.largeur }}
    >
      <p className="leading-6 text-zinc-800">{MESSAGE_NON_ADHERENT}</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <a
          href={lienAdhesion}
          className="inline-flex items-center rounded-full bg-yellow-300 px-4 py-2 font-semibold text-zinc-900 transition-colors hover:bg-yellow-400"
        >
          Adhérer au Club
        </a>
        <a href="/relectures/connexion" className="text-zinc-600 underline decoration-zinc-300 underline-offset-4 hover:text-zinc-900">
          Déjà adhérent ? Se connecter
        </a>
      </div>
    </div>
  );
}
