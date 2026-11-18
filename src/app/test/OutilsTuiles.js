import Link from "next/link";

// Les outils de /test (mode édition), rangés en trois familles : Produire,
// Diffuser, Consulter. Purement visuel : mêmes destinations que les anciens
// boutons en pilule. La page ne l'affiche qu'aux personnes déverrouillées.

// Icônes : petits SVG à trait, dessinés ici (le projet n'a pas de bibliothèque
// d'icônes). 20 px, couleur héritée du texte.
function Icone({ children }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

const ICONES = {
  // Document avec un « + »
  depot: (
    <Icone>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <path d="M12 12v6M9 15h6" />
    </Icone>
  ),
  // Trois points reliés (partage)
  reseaux: (
    <Icone>
      <circle cx="18" cy="5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="19" r="2.5" />
      <path d="M8.2 10.8l7.6-4.6M8.2 13.2l7.6 4.6" />
    </Icone>
  ),
  // Écran avec bouton lecture
  reels: (
    <Icone>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M10 9.5v5l4.5-2.5z" />
    </Icone>
  ),
  // Calendrier
  revue: (
    <Icone>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </Icone>
  ),
  // Boîte d'archive
  publiees: (
    <Icone>
      <rect x="3" y="4" width="18" height="5" rx="1" />
      <path d="M5 9v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9" />
      <path d="M10 13h4" />
    </Icone>
  ),
};

// « Revue du dimanche » était toujours jaune, sans condition : elle devient une
// tuile blanche comme les autres, avec le sous-titre « Hebdomadaire ».
function Tuile({ href, icone, titre, sousTitre, vertical = false }) {
  return (
    <Link
      href={href}
      className={`flex h-full rounded-xl border border-zinc-200 bg-white transition-colors hover:border-zinc-400 ${
        // Tuiles côte à côte : marges réduites sur téléphone pour que les
        // sous-titres tiennent dans la largeur.
        vertical ? "flex-col items-start gap-3 p-2.5 sm:p-4" : "items-center gap-3 p-4"
      }`}
    >
      <span className="text-zinc-400">{ICONES[icone]}</span>
      <span className="min-w-0 max-w-full break-words">
        <span className="block text-sm font-bold leading-tight text-zinc-900">
          {titre}
        </span>
        <span className="mt-0.5 block text-xs text-zinc-500">{sousTitre}</span>
      </span>
    </Link>
  );
}

function Famille({ libelle, className = "", children }) {
  return (
    <section className={`flex flex-col gap-2 ${className}`}>
      <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-zinc-400">
        {libelle}
      </h2>
      <div className="flex-1">{children}</div>
    </section>
  );
}

export default function OutilsTuiles() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
      <Famille libelle="Produire">
        {/* File d'attente des fiches d'étape 1 (dépôt des JSON). */}
        <Tuile href="/test/depot" icone="depot" titre="Déposer une fiche" sousTitre="Étape 1" />
      </Famille>

      <Famille libelle="Diffuser" className="md:col-span-2">
        <div className="grid h-full grid-cols-3 gap-2 sm:gap-3">
          {/* Publications X des fiches. */}
          <Tuile
            href="/test/reseaux"
            icone="reseaux"
            titre="Réseaux sociaux"
            sousTitre="Posts X, LinkedIn"
            vertical
          />
          {/* Script et images des Reels vidéo (étape 3 quater). */}
          <Tuile
            href="/test/reels"
            icone="reels"
            titre="Reels vidéo"
            sousTitre="Formats courts"
            vertical
          />
          {/* Revue du dimanche du Club (annotations, révisions à valider). */}
          <Tuile
            href="/test/revue"
            icone="revue"
            titre="Revue du dimanche"
            sousTitre="Hebdomadaire"
            vertical
          />
        </div>
      </Famille>

      <Famille libelle="Consulter">
        {/* Correction des coquilles d'une fiche déjà en ligne. */}
        <Tuile
          href="/test/publiees"
          icone="publiees"
          titre="Fiches publiées"
          sousTitre="Archive en ligne"
        />
      </Famille>
    </div>
  );
}
