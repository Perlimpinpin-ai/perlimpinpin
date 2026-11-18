"use client";

import { useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { creerMoteur, LIMITE_SUGGESTIONS } from "@/lib/recherche";

// Barre de recherche façon « Spotlight » (page d'accueil).
//
// - Avec `documents` (index fourni par la page, voir getIndexRecherche) :
//   suggestions instantanées pendant la frappe, calculées dans le navigateur
//   (src/lib/recherche.js), sans aucun appel réseau. 4 lignes maximum : un
//   raccourci « Thème » ou « Candidat » éventuel, puis les propositions.
//   Si cet index léger (titres, résumés) trouve moins de 4 propositions, on
//   complète par /api/recherche, qui cherche aussi dans le texte complet des
//   analyses (un seul appel, 300 ms après la dernière frappe).
// - Sans `documents` (page /declarations) : simple champ de recherche.
// Dans les deux cas, « Entrée » sans suggestion choisie envoie vers
// /declarations?q=... (fonctionne aussi sans JavaScript).

const TYPE_LIBELLE = { theme: "Thème", candidat: "Candidat", proposition: "Proposition" };

function lienRaccourci({ type, libelle }) {
  const param = type === "theme" ? "theme" : "candidat";
  return `/declarations?${param}=${encodeURIComponent(libelle)}`;
}

function Fleche({ className = "h-5 w-5" }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      className={className}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12h15m0 0-6-6m6 6-6 6" />
    </svg>
  );
}

export default function SearchBar({
  placeholder = "Rechercher une proposition, un candidat, un thème…",
  defaultValue = "",
  exemples = [],
  exemplesTitre = "Exemples :",
  autres = {},
  documents = null,
}) {
  const router = useRouter();
  const idListe = useId();
  const [requete, setRequete] = useState(defaultValue);
  const [ouvert, setOuvert] = useState(false);
  const [actif, setActif] = useState(-1);

  // Index construit une seule fois (quelques millisecondes pour quelques
  // centaines de propositions).
  const moteur = useMemo(
    () => (documents?.length ? creerMoteur(documents) : null),
    [documents],
  );

  // Suggestions de l'index du navigateur, recalculées à chaque frappe.
  const locales = useMemo(() => {
    if (!moteur || requete.trim().length < 2) return null;
    return moteur.suggestions(requete, LIMITE_SUGGESTIONS);
  }, [moteur, requete]);

  // Compléments trouvés dans le texte complet des analyses (/api/recherche),
  // gardés avec la requête qui les a produits pour ne jamais afficher ceux
  // d'une ancienne frappe.
  const [complements, setComplements] = useState({ requete: "", propositions: [] });
  const placesLibres = locales
    ? LIMITE_SUGGESTIONS - (locales.raccourci ? 1 : 0) - locales.propositions.length
    : 0;
  const requeteServeur = placesLibres > 0 && requete.trim().length >= 3 ? requete.trim() : "";

  useEffect(() => {
    if (!requeteServeur) return undefined;
    const controleur = new AbortController();
    const minuteur = setTimeout(async () => {
      try {
        const reponse = await fetch(
          `/api/recherche?q=${encodeURIComponent(requeteServeur)}`,
          { signal: controleur.signal },
        );
        if (!reponse.ok) return;
        const { propositions } = await reponse.json();
        setComplements({ requete: requeteServeur, propositions: propositions ?? [] });
      } catch {
        // Abandon (nouvelle frappe) ou réseau indisponible : on garde
        // simplement les suggestions locales.
      }
    }, 300);
    return () => {
      clearTimeout(minuteur);
      controleur.abort();
    };
  }, [requeteServeur]);

  // Lignes affichées sous la barre (4 maximum).
  const lignes = useMemo(() => {
    if (!locales) return [];
    const { raccourci, propositions } = locales;
    const resultat = [];
    if (raccourci) {
      resultat.push({
        cle: `${raccourci.type}:${raccourci.libelle}`,
        type: raccourci.type,
        titre: raccourci.libelle,
        detail: "Voir toutes les analyses liées",
        href: lienRaccourci(raccourci),
      });
    }
    const vus = new Set(propositions.map((doc) => doc.id));
    const enPlus =
      complements.requete === requeteServeur
        ? complements.propositions.filter((doc) => !vus.has(doc.id))
        : [];
    for (const doc of [...propositions, ...enPlus]) {
      if (resultat.length >= LIMITE_SUGGESTIONS) break;
      resultat.push({
        cle: `proposition:${doc.id}`,
        type: "proposition",
        titre: doc.titre,
        detail: [doc.candidat, doc.theme].filter(Boolean).join(" · "),
        href: `/declarations/${doc.propositionId}`,
      });
    }
    return resultat;
  }, [locales, complements, requeteServeur]);

  const rechercheEnCours =
    requeteServeur !== "" && complements.requete !== requeteServeur;

  const panneauVisible = ouvert && moteur !== null && requete.trim().length >= 2;

  function changerRequete(event) {
    setRequete(event.target.value);
    setActif(-1);
    setOuvert(true);
  }

  function gererTouche(event) {
    if (!panneauVisible) return;
    if (event.key === "ArrowDown" && lignes.length > 0) {
      event.preventDefault();
      setActif((i) => (i + 1) % lignes.length);
    } else if (event.key === "ArrowUp" && lignes.length > 0) {
      event.preventDefault();
      setActif((i) => (i <= 0 ? lignes.length - 1 : i - 1));
    } else if (event.key === "Escape") {
      setOuvert(false);
      setActif(-1);
    } else if (event.key === "Enter" && actif >= 0 && lignes[actif]) {
      // Suggestion choisie au clavier : on y va directement. Sinon, Entrée
      // envoie le formulaire (tous les résultats sur /declarations?q=...).
      event.preventDefault();
      setOuvert(false);
      router.push(lignes[actif].href);
    }
  }

  return (
    <div className="w-full">
      <div className="relative">
        <form action="/declarations" method="get" role="search" className="relative z-20">
          {/* Filtres déjà actifs (page /declarations) conservés lors d'une
              nouvelle recherche. */}
          {Object.entries(autres).map(([cle, valeur]) => (
            <input key={cle} type="hidden" name={cle} value={valeur} />
          ))}
          <label htmlFor={`${idListe}-q`} className="sr-only">
            Rechercher dans les propositions analysées
          </label>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className="pointer-events-none absolute left-6 top-1/2 h-6 w-6 -translate-y-1/2 text-zinc-900"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path strokeLinecap="round" d="m20 20-3.5-3.5" />
          </svg>
          <input
            id={`${idListe}-q`}
            type="search"
            name="q"
            value={requete}
            onChange={changerRequete}
            onKeyDown={gererTouche}
            onFocus={() => setOuvert(true)}
            onBlur={() => setOuvert(false)}
            placeholder={placeholder}
            autoComplete="off"
            enterKeyHint="search"
            role={moteur ? "combobox" : undefined}
            aria-autocomplete={moteur ? "list" : undefined}
            aria-expanded={moteur ? panneauVisible : undefined}
            aria-controls={moteur ? `${idListe}-liste` : undefined}
            aria-activedescendant={
              panneauVisible && actif >= 0 ? `${idListe}-${actif}` : undefined
            }
            className="h-16 w-full rounded-full border border-zinc-200 bg-white pl-16 pr-16 sm:pr-20 text-base text-zinc-900 shadow-[0_18px_40px_-20px_rgba(30,41,82,0.35)] outline-none transition placeholder:text-slate-400 max-sm:placeholder:text-[15px] focus:border-blue-300 focus:ring-4 focus:ring-blue-100 sm:h-[72px] sm:text-lg [&::-webkit-search-cancel-button]:hidden"
          />
          <button
            type="submit"
            aria-label="Lancer la recherche"
            className="absolute right-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-gradient-to-br from-sky-100 via-violet-100 to-rose-100 text-zinc-900 transition hover:brightness-95 sm:h-14 sm:w-14"
          >
            <Fleche className="h-6 w-6" />
          </button>
        </form>

        {panneauVisible ? (
          <div
            // Empêche la perte du focus (et donc la fermeture) avant le clic.
            onMouseDown={(event) => event.preventDefault()}
            className="absolute inset-x-0 top-full z-10 -mt-1 overflow-hidden rounded-3xl bg-white/95 p-2 shadow-[0_24px_60px_-24px_rgba(30,41,82,0.35)] ring-1 ring-zinc-200/80 backdrop-blur-xl"
          >
            {lignes.length === 0 ? (
              <p className="px-4 py-3 font-mono text-xs text-slate-500">
                {rechercheEnCours
                  ? "Recherche dans le texte des analyses…"
                  : "Aucune proposition analysée ne correspond pour le moment."}
              </p>
            ) : (
              <ul id={`${idListe}-liste`} role="listbox" className="divide-y divide-zinc-100">
                {lignes.map((ligne, index) => (
                  <li
                    key={ligne.cle}
                    id={`${idListe}-${index}`}
                    role="option"
                    aria-selected={index === actif}
                  >
                    <Link
                      href={ligne.href}
                      prefetch={false}
                      onMouseEnter={() => setActif(index)}
                      onClick={() => setOuvert(false)}
                      className={`flex items-center gap-4 rounded-2xl px-4 py-2.5 transition-colors ${
                        index === actif ? "bg-zinc-100/80" : "hover:bg-zinc-50"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="flex items-baseline gap-3">
                          <span className="truncate text-base font-semibold tracking-tight text-zinc-900">
                            {ligne.titre}
                          </span>
                          <span className="shrink-0 font-mono text-[11px] uppercase tracking-widest text-slate-400">
                            {TYPE_LIBELLE[ligne.type]}
                          </span>
                        </p>
                        <p className="mt-0.5 truncate font-mono text-xs text-slate-500">
                          {ligne.detail}
                        </p>
                      </div>
                      <Fleche className="h-5 w-5 shrink-0 text-zinc-700" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </div>

      {exemples.length > 0 ? (
        <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 pl-2 font-mono text-xs text-slate-500">
          <span>{exemplesTitre}</span>
          {exemples.map((exemple, index) => (
            <span key={exemple} className="flex items-center gap-2">
              {index > 0 ? <span aria-hidden="true">·</span> : null}
              <Link
                href={`/declarations?q=${encodeURIComponent(exemple)}`}
                prefetch={false}
                className="transition-colors hover:text-zinc-900 hover:underline"
              >
                {exemple}
              </Link>
            </span>
          ))}
        </p>
      ) : null}
    </div>
  );
}
