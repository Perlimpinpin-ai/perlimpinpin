import EditableBlock from "@/app/test/EditableBlock";
import { champCorrigeable } from "@/lib/test-corriger";

// Ajoute le crayon de modification autour d'un bloc, seulement en mode édition
// (/test/[id] pour un éditeur). Sans `edition` (site public, amis, non-éditeur),
// renvoie le bloc tel quel : aucun composant client, aucune donnée en plus.
// Partagé par la fiche (src/app/declarations/[id]/page.js) et sa vue basique
// (src/components/VueBasique.js).
// `edition.correction` (/test/publiees/[id]) : correction de coquille d'une fiche
// publiée ; les champs exclus (notation, mesure initiale…) n'ont pas de crayon.
export default function Editable({ edition, champ, valeurBrute, multiligne, children }) {
  if (!edition) return children;
  if (edition.correction && !champCorrigeable(champ)) return children;
  return (
    <EditableBlock
      champ={champ}
      valeurBrute={valeurBrute}
      analyseId={edition.analyseId}
      versionAttendue={edition.versionAttendue}
      multiligne={multiligne}
      correction={Boolean(edition.correction)}
    >
      {children}
    </EditableBlock>
  );
}
