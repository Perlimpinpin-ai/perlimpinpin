"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ID_VUE, ID_ONGLET, ID_DEBUT_CONTENU } from "@/lib/vue-analyse";

// Bascule « Résumé basique / Résumé expert » de la fiche (voir
// src/app/declarations/[slug]/page.js). Les deux vues sont rendues côté serveur
// (tout le texte reste dans le HTML) ; celle qui est masquée porte l'attribut
// hidden. Vue basique par défaut, ?vue=expert ouvre directement la vue expert.
//
// La page est mise en cache (ISR) : le serveur ne lit jamais ?vue=, il rend
// toujours la vue basique. ScriptVueInitiale (src/components/VueBasique.js)
// corrige hidden/aria-selected avant le premier affichage, d'où le
// suppressHydrationWarning sur les éléments qu'il modifie. L'URL est la source
// de la vue (useSyncExternalStore) : « basique » pendant le rendu serveur et
// l'hydratation, puis la valeur de l'URL.

const VUES = ["basique", "expert"];
const VueAnalyseContext = createContext(null);

// null hors d'un VueAnalyseProvider (fiche sans version basique).
export function useVueAnalyse() {
  return useContext(VueAnalyseContext);
}

function vueDepuisUrl() {
  return new URLSearchParams(window.location.search).get("vue") === "expert" ? "expert" : "basique";
}

// history.replaceState n'émet aucun événement : basculer() prévient lui-même
// les abonnés. popstate couvre les retours arrière vers une autre vue.
const abonnes = new Set();
function abonner(rappel) {
  abonnes.add(rappel);
  window.addEventListener("popstate", rappel);
  return () => {
    abonnes.delete(rappel);
    window.removeEventListener("popstate", rappel);
  };
}
const vueServeur = () => "basique";

export function VueAnalyseProvider({ children }) {
  const vue = useSyncExternalStore(abonner, vueDepuisUrl, vueServeur);
  // Défilement demandé par la dernière bascule, exécuté une fois la nouvelle
  // vue affichée (la cible peut se trouver dans la vue qui vient d'apparaître).
  const [defilement, setDefilement] = useState(null);

  useEffect(() => {
    if (!defilement) return;
    document.getElementById(defilement.cible)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [defilement]);

  // cible : id vers lequel défiler après la bascule (haut du contenu par défaut).
  const basculer = useCallback((nouvelleVue, { defiler = false, cible = ID_DEBUT_CONTENU } = {}) => {
    const url = new URL(window.location.href);
    if (nouvelleVue === "expert") url.searchParams.set("vue", "expert");
    else url.searchParams.delete("vue");
    window.history.replaceState(null, "", url);
    abonnes.forEach((rappel) => rappel());

    // Nouvel objet à chaque appel : deux clics sur le même lien redéfilent.
    if (defiler) setDefilement({ cible });
  }, []);

  return <VueAnalyseContext.Provider value={{ vue, basculer }}>{children}</VueAnalyseContext.Provider>;
}

const LIBELLES = { basique: "Résumé basique", expert: "Résumé expert" };

// Bouton segmenté (maquette : actif noir texte blanc, inactif gris clair).
// Onglets ARIA : flèches gauche/droite, Début et Fin déplacent la sélection.
export function BasculeVue() {
  const { vue, basculer } = useVueAnalyse();
  const refs = useRef({});

  function onKeyDown(event) {
    const index = VUES.indexOf(vue);
    const cibles = {
      ArrowRight: VUES[(index + 1) % VUES.length],
      ArrowLeft: VUES[(index - 1 + VUES.length) % VUES.length],
      Home: VUES[0],
      End: VUES[VUES.length - 1],
    };
    const cible = cibles[event.key];
    if (!cible) return;
    event.preventDefault();
    basculer(cible);
    refs.current[cible]?.focus();
  }

  return (
    <div
      id={ID_DEBUT_CONTENU}
      role="tablist"
      aria-label="Niveau de lecture de l'analyse"
      className="flex scroll-mt-24 gap-2"
      onKeyDown={onKeyDown}
    >
      {VUES.map((nom) => (
        <button
          key={nom}
          ref={(element) => {
            refs.current[nom] = element;
          }}
          id={ID_ONGLET[nom]}
          type="button"
          role="tab"
          aria-selected={vue === nom}
          aria-controls={ID_VUE[nom]}
          tabIndex={vue === nom ? 0 : -1}
          suppressHydrationWarning
          onClick={() => basculer(nom)}
          className="flex-1 rounded-xl border border-zinc-200 bg-zinc-100 px-5 py-2.5 text-sm font-semibold text-zinc-600 transition-colors hover:bg-zinc-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 aria-selected:border-zinc-900 aria-selected:bg-zinc-900 aria-selected:text-white aria-selected:hover:bg-zinc-800 sm:flex-none sm:px-8"
        >
          {LIBELLES[nom]}
        </button>
      ))}
    </div>
  );
}

// Conteneur d'une vue : masqué (hidden) quand ce n'est pas la vue courante.
// `className` : mise en page propre à une vue (la vue expert sépare ses blocs
// par des traits plutôt que par un simple espacement).
export function Vue({ nom, className = "flex flex-col gap-6", children }) {
  const { vue } = useVueAnalyse();
  return (
    <div
      id={ID_VUE[nom]}
      role="tabpanel"
      aria-labelledby={ID_ONGLET[nom]}
      hidden={vue !== nom}
      suppressHydrationWarning
      className={className}
    >
      {children}
    </div>
  );
}

// Lien qui bascule vers la vue expert (ex. « Voir toutes les sources »).
export function LienVersExpert({ cible, className, children }) {
  const { basculer } = useVueAnalyse();
  return (
    <button type="button" onClick={() => basculer("expert", { defiler: true, cible })} className={className}>
      {children}
    </button>
  );
}
