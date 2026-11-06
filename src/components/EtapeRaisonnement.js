import { attributsZone } from "@/lib/fiche-annotations-core";

// Une étape du « raisonnement complet » de la vue expert : numéro sur deux
// chiffres à gauche, titre et contenu à droite, sans carte. Les traits entre
// étapes sont posés par la liste qui les contient (voir la fiche déclaration).
// Distinct de Section (src/lib/fiche-rendu.js), partagé avec la vue basique.
// `annotation` ({ cle, label }) : contenu annotable par le Club (vue experte
// d'une fiche publiée, voir src/components/AnnotationsFiche.js).
export default function EtapeRaisonnement({ numero, titre, id, annotation = null, children }) {
  const classeContenu = "mt-1 max-w-[68ch] text-sm leading-6 text-zinc-600";
  return (
    <section id={id} className={`grid grid-cols-[3rem_minmax(0,1fr)] py-5${id ? " scroll-mt-24" : ""}`}>
      <span className="text-xl font-medium leading-6 text-zinc-300" aria-hidden="true">
        {String(numero).padStart(2, "0")}
      </span>
      <div className="min-w-0">
        <h3 className="text-base font-semibold leading-6 text-zinc-900">{titre}</h3>
        {annotation ? (
          <div {...attributsZone(true, annotation.cle, annotation.label ?? titre)} className={`anno-zone ${classeContenu}`}>
            <div className="body">{children}</div>
          </div>
        ) : (
          <div className={classeContenu}>{children}</div>
        )}
      </div>
    </section>
  );
}
