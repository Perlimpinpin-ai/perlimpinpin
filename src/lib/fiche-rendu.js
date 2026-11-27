// Briques de rendu partagées par la fiche (src/app/declarations/[slug]/page.js)
// et sa version basique (src/components/VueBasique.js). Déplacées telles
// quelles depuis la page, sans changement de code.

export function Section({ title, id, children }) {
  return (
    <section id={id} className="scroll-mt-24 rounded-2xl border border-zinc-200 bg-white p-6">
      <h2 className="text-lg font-bold text-zinc-900">{title}</h2>
      <div className="mt-3 max-w-[68ch] text-sm leading-7 text-zinc-600">
        {children}
      </div>
    </section>
  );
}

// Convertit un marquage minimal **gras** en JSX, sans dépendance markdown
// complète — le contenu vient de fiches où seuls quelques mots-clés (chiffre,
// source, date, qualificatif) sont mis en avant, jamais des phrases entières.
export function renderRichText(text) {
  if (typeof text !== "string") return text;
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
    const match = part.match(/^\*\*([^*]+)\*\*$/);
    return match ? (
      <strong key={index} className="font-semibold text-slate-700">
        {match[1]}
      </strong>
    ) : (
      <span key={index}>{part}</span>
    );
  });
}

// sources_utilisees : chaîne simple par élément sur les fiches antérieures
// au schéma V3, objet structuré { id, titre, organisme, url, type, ... }
// depuis (voir data/prompt-methodologie.md, section SOURCES STRUCTURÉES).
// TextOrList/renderRichText ne savent afficher que des chaînes ; ce
// composant dédié gère les deux formes sans faire planter le rendu React
// sur un objet.
export const SOURCE_STRING_REGEX = /^(.*?),\s*(https?:\/\/\S+)\s*$/;
export function renderSourceString(item) {
  const match = typeof item === "string" ? item.match(SOURCE_STRING_REGEX) : null;
  if (!match) return renderRichText(item);
  return (
    <a
      href={match[2]}
      target="_blank"
      rel="noopener noreferrer"
      className="text-inherit underline underline-offset-2 decoration-zinc-400 transition-colors hover:decoration-zinc-900"
    >
      {renderRichText(match[1])}
    </a>
  );
}
