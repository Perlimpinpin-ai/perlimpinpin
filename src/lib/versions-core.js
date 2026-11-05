// Versions des fiches et suite donnée aux annotations (Club ouvert, lot 5).
// Logique PURE, sans base : testée par scripts/versions.test.js.
//
//   - numéro de version (V1, V2…) visible de tous, calculé à partir des
//     versions publiées de la fiche (statut « publie » ou « remplacee ») ;
//   - clôture des annotations traitées (archivées avec leur version) et
//     réaccrochage des autres sur la nouvelle version : TraitementAnnotation,
//     écrite par ajout, la ligne la plus récente fait foi ;
//   - historique détaillé, réservé aux adhérents : crédit par PRÉNOM et
//     seulement avec l'accord de l'auteur (creditAccord).

import { CATEGORIE_REVISION, dernierTri } from "./revue-core.js";

export const STATUTS_VERSION = ["publie", "remplacee"];

// Numéro de la version `analyseId` parmi les versions publiées de sa fiche
// (ordre de création). analyses : [{ id, statut, createdAt }]. 1 par défaut.
export function numeroVersion(analyses, analyseId) {
  const versions = (analyses ?? [])
    .filter((a) => STATUTS_VERSION.includes(a.statut))
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt) || a.id - b.id);
  const i = versions.findIndex((a) => a.id === analyseId);
  return i >= 0 ? i + 1 : 1;
}

// Traitement qui fait foi pour une annotation (le plus récent), ou null.
export function dernierTraitement(traitements) {
  return dernierTri(traitements);
}

export function estTraitee(annotation) {
  return dernierTraitement(annotation?.traitements)?.etat === "traitee";
}

// --- Le passage cité existe-t-il encore dans la nouvelle version ? ----------

function texteDe(valeur) {
  if (valeur == null) return "";
  if (typeof valeur === "string") return valeur;
  if (Array.isArray(valeur)) return valeur.map(texteDe).join(" ");
  if (typeof valeur === "object") return [valeur.synthese, valeur.texte].map(texteDe).join(" ");
  return "";
}

// Comparaison tolérante : sans gras Markdown (**), blancs normalisés.
const normaliser = (s) => String(s ?? "").replace(/\*\*/g, "").replace(/\s+/g, " ").trim();

// Texte d'un bloc annotable de la fiche (même découpage que la vue experte).
export function texteSection(contenu, sectionId) {
  const [cle, sousCle] = String(sectionId ?? "").split(".");
  if (cle === "analyse_par_criteres" && sousCle) {
    const criteres = contenu?.analyse_par_criteres;
    if (Array.isArray(criteres)) return texteDe(criteres.find((c) => c?.critere === sousCle)?.texte);
    return texteDe(criteres?.[sousCle]);
  }
  if (cle === "verdict_final") return `${texteDe(contenu?.verdict_final)} ${texteDe(contenu?.verdict_conclusion)}`;
  return texteDe(contenu?.[cle]);
}

export function passageExiste(contenu, sectionId, passage) {
  const cherche = normaliser(passage);
  return cherche.length > 0 && normaliser(texteSection(contenu, sectionId)).includes(cherche);
}

// --- Clôture et réaccrochage ----------------------------------------------------

// Lignes TraitementAnnotation à créer quand Arno décide sur une fiche.
//   annotations : annotations de la fiche, avec { id, sectionId, quotedText,
//                 tris, traitements }
//   decision    : { id, type: "publiee" | "rejetee" | "reponses" }
//   revision    : { commentIds, resume: { reponses } } ou null
//   versionArchive  : id de la version en ligne au moment de la décision
//   nouvelleVersion : { id, contenu } si une version vient d'être publiée
// Règles :
//   - déjà traitée : rien ;
//   - prise en compte par la révision : close, réponse et « retenu » de la révision ;
//   - triée, autre que « argument_ou_source » : close avec la réponse du tri ;
//   - « argument_ou_source » hors révision, ou pas encore triée : reste
//     ouverte ; si une nouvelle version est publiée, elle y est réaccrochée
//     (au passage s'il existe encore, sinon au bloc).
export function planTraitements({ annotations, decision, revision = null, versionArchive, nouvelleVersion = null }) {
  const prises = new Set(Array.isArray(revision?.commentIds) ? revision.commentIds : []);
  const reponses = new Map((revision?.resume?.reponses ?? []).map((r) => [r.commentaire_id, r]));
  const lignes = [];
  for (const a of annotations ?? []) {
    if (estTraitee(a)) continue;
    const tri = dernierTri(a.tris);
    const decisionId = decision?.type === "reponses" ? null : decision?.id ?? null;
    if (prises.has(a.id)) {
      const r = reponses.get(a.id);
      lignes.push({
        commentId: a.id,
        etat: "traitee",
        analyseId: versionArchive,
        decisionId,
        categorie: tri?.categorie ?? CATEGORIE_REVISION,
        reponse: r?.reponse ?? tri?.reponse ?? null,
        retenu: decision?.type === "publiee" && r?.retenu === true,
      });
    } else if (tri && tri.categorie !== CATEGORIE_REVISION) {
      lignes.push({
        commentId: a.id,
        etat: "traitee",
        analyseId: versionArchive,
        decisionId,
        categorie: tri.categorie,
        reponse: tri.reponse ?? null,
        retenu: false,
      });
    } else if (nouvelleVersion) {
      const auPassage = a.quotedText ? passageExiste(nouvelleVersion.contenu, a.sectionId, a.quotedText) : false;
      lignes.push({
        commentId: a.id,
        etat: "reaccrochee",
        analyseId: nouvelleVersion.id,
        decisionId,
        rattachement: auPassage ? "passage" : "section",
        retenu: false,
      });
    }
  }
  return lignes;
}

// --- PerlimpinPOINTS ------------------------------------------------------------

// Entrée de calculerPoints (club-points-core.js) : « retenu » vient de
// l'ancienne colonne (archives /relectures) OU du traitement qui fait foi.
export function commentairesPourPoints(commentaires) {
  return (commentaires ?? []).map((c) => {
    const t = dernierTraitement(c.traitements);
    return { ficheSlug: c.ficheSlug, retenu: c.retenu === true || (t?.etat === "traitee" && t.retenu === true) };
  });
}

// --- Historique (adhérents) ---------------------------------------------------

// « Camille D. » → « Camille » (même règle que le mail de bienvenue).
export function prenomSeul(nom) {
  if (typeof nom !== "string") return null;
  const prenom = nom.replace(/\s+\p{L}\.$/u, "").replace(/\s+/g, " ").trim();
  return /\p{L}/u.test(prenom) ? prenom : null;
}

// versions   : [{ id, statut, createdAt }] (publie / remplacee) de la fiche
// decisions  : [{ id, createdAt, analysePublieeId, revision: { resume, commentIds } }] (« publiee »)
// annotations: [{ id, creditAccord, adherent: { nom } | null, authorName, sectionLabel,
//                 quotedText, body, traitements }]
// libelles   : { cle de note → libellé lisible }
// → [{ numero, analyseId, date, scoreAvant, scoreApres, raison, criteresModifies, credits, annotations }]
export function construireHistorique({ versions, decisions, annotations, libelles = {}, nomAffiche = (a) => a.authorName }) {
  const ordonnees = (versions ?? [])
    .filter((v) => STATUTS_VERSION.includes(v.statut))
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt) || a.id - b.id);
  const decisionDe = new Map((decisions ?? []).map((d) => [d.analysePublieeId, d]));
  const parId = new Map((annotations ?? []).map((a) => [a.id, a]));
  return ordonnees.map((v, i) => {
    const d = decisionDe.get(v.id);
    const resume = d?.revision?.resume ?? null;
    const retenues = new Set((resume?.reponses ?? []).filter((r) => r.retenu === true).map((r) => r.commentaire_id));
    const credits = [];
    for (const id of retenues) {
      const a = parId.get(id);
      const prenom = a?.creditAccord === true ? prenomSeul(a.adherent?.nom ?? a.authorName) : null;
      if (prenom && !credits.includes(prenom)) credits.push(prenom);
    }
    // Annotations archivées avec cette version (traitées pendant qu'elle était en ligne)
    const archivees = (annotations ?? [])
      .filter((a) => {
        const t = dernierTraitement(a.traitements);
        return t?.etat === "traitee" && t.analyseId === v.id;
      })
      .map((a) => {
        const t = dernierTraitement(a.traitements);
        return {
          id: a.id,
          auteur: nomAffiche(a) ?? "Membre du Club",
          section: a.sectionLabel ?? null,
          passage: a.quotedText ?? null,
          annotation: a.body,
          reponse: t.reponse ?? null,
          retenu: t.retenu === true,
        };
      });
    return {
      numero: i + 1,
      analyseId: v.id,
      date: d?.createdAt ?? v.createdAt,
      scoreAvant: resume?.scoreAvant ?? null,
      scoreApres: resume?.scoreApres ?? null,
      raison: resume?.raison ?? (i === 0 ? "Première publication." : null),
      criteresModifies: (resume?.criteresModifies ?? []).map((c) => ({
        critere: libelles[c.critere] ?? c.critere,
        ancienneNote: c.ancienneNote,
        nouvelleNote: c.nouvelleNote,
      })),
      credits,
      annotations: archivees,
    };
  });
}
