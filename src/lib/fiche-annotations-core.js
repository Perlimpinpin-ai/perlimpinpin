// Annotations du Club sur les fiches PUBLIÉES (vue experte de /declarations/[id]).
// Fonctions pures, testées par scripts/fiche-annotations.test.js.
//
// Stockage : table RelectureComment, comme les relectures, avec
//   - ficheSlug = « fiche-<id de la Proposition> » : clé stable d'une version
//     de la fiche à l'autre (l'adresse /declarations/<id> ne change pas) ;
//   - sectionId = clé du contenu annoté (« contexte_national »,
//     « analyse_par_criteres.efficacite »…), posée dans la page par data-anno-cle ;
//   - analyseId = version précise affichée au moment de l'annotation ;
//   - creditAccord = accord pour être crédité par son prénom (historique).
//
// Règles propres aux fiches publiées :
//   - les annotations sont ouvertes EN PERMANENCE (le chrono ne concerne que
//     les archives /relectures) ;
//   - lecture du texte des annotations réservée aux adhérents : les visiteurs
//     ne reçoivent que des zones surlignées (zonesPubliques), sans texte de
//     note, sans auteur, sans date, sans nombre.

export const PREFIXE_FICHE = "fiche-";
// Remarque sur l'ensemble de l'analyse (champ en bas de la vue experte,
// src/components/RemarqueGenerale.js) : sans passage cité.
export const SECTION_GENERALE = "analyse_generale";
export const LABEL_SECTION_GENERALE = "Commentaire sur l'ensemble de l'analyse";
const SLUG_FICHE = /^fiche-([1-9]\d{0,9})$/;
const SECTION_ID = /^[a-z][a-z0-9_]{0,59}(?:\.[a-z0-9_]{1,40})?$/;

export function slugFiche(propositionId) {
  return `${PREFIXE_FICHE}${propositionId}`;
}

// « fiche-12 » → 12 ; sinon null.
export function propositionDuSlug(slug) {
  const m = typeof slug === "string" ? SLUG_FICHE.exec(slug) : null;
  return m ? Number(m[1]) : null;
}

export function estSlugFiche(slug) {
  return typeof slug === "string" && slug.startsWith(PREFIXE_FICHE);
}

export function sectionIdValide(sectionId) {
  return typeof sectionId === "string" && SECTION_ID.test(sectionId);
}

// Attributs HTML d'un bloc annotable de la vue experte (lus par
// public/club/annotations.js) : la zone de texte annotable est son enfant
// .body. Rien si le bloc n'est pas annotable ou si la clé est invalide.
export function attributsZone(actif, cle, label) {
  if (!actif || !sectionIdValide(cle)) return {};
  return {
    "data-comment-target": "",
    "data-anno-cle": cle,
    "data-anno-label": typeof label === "string" ? label.slice(0, 200) : "",
  };
}

// Zones surlignées à montrer à un visiteur non adhérent. Entrée : annotations
// en base { sectionId, quotedText, startOffset, endOffset }. Sortie : par
// section, les passages fusionnés quand ils se chevauchent ou se touchent,
// pour ne pas laisser deviner combien de notes portent sur un même passage.
// Seul le texte DE LA FICHE (passage cité) est renvoyé, jamais la note.
// Les commentaires de section (sans passage) donnent une zone sans passage.
export function zonesPubliques(annotations) {
  const parSection = new Map();
  for (const a of Array.isArray(annotations) ? annotations : []) {
    if (!a || !sectionIdValide(a.sectionId)) continue;
    const liste = parSection.get(a.sectionId) ?? [];
    parSection.set(a.sectionId, liste);
    const passageValide =
      typeof a.quotedText === "string" &&
      a.quotedText.length > 0 &&
      Number.isInteger(a.startOffset) &&
      Number.isInteger(a.endOffset) &&
      a.endOffset - a.startOffset === a.quotedText.length;
    if (passageValide) liste.push({ start: a.startOffset, end: a.endOffset, texte: a.quotedText });
  }

  const zones = [];
  for (const [sectionId, passages] of [...parSection.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (passages.length === 0) {
      zones.push({ sectionId });
      continue;
    }
    passages.sort((a, b) => a.start - b.start || b.end - a.end);
    let courant = { ...passages[0] };
    const fusion = [];
    for (const p of passages.slice(1)) {
      if (p.start <= courant.end) {
        if (p.end > courant.end) {
          courant.texte += p.texte.slice(courant.end - p.start);
          courant.end = p.end;
        }
      } else {
        fusion.push(courant);
        courant = { ...p };
      }
    }
    fusion.push(courant);
    for (const z of fusion) {
      zones.push({ sectionId, quotedText: z.texte, startOffset: z.start, endOffset: z.end });
    }
  }
  return zones;
}
