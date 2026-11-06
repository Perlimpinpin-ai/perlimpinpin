// Une étape du « raisonnement complet » de la vue expert : numéro sur deux
// chiffres à gauche, titre et contenu à droite, sans carte. Les traits entre
// étapes sont posés par la liste qui les contient (voir la fiche déclaration).
// Distinct de Section (src/lib/fiche-rendu.js), partagé avec la vue basique.
export default function EtapeRaisonnement({ numero, titre, id, children }) {
  return (
    <section id={id} className={`grid grid-cols-[3rem_minmax(0,1fr)] py-5${id ? " scroll-mt-24" : ""}`}>
      <span className="text-xl font-medium leading-6 text-zinc-300" aria-hidden="true">
        {String(numero).padStart(2, "0")}
      </span>
      <div className="min-w-0">
        <h3 className="text-base font-semibold leading-6 text-zinc-900">{titre}</h3>
        <div className="mt-1 max-w-[68ch] text-sm leading-6 text-zinc-600">{children}</div>
      </div>
    </section>
  );
}
