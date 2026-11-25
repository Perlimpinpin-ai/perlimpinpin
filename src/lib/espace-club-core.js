import { propositionDuSlug } from "./fiche-annotations-core.js";

// Espace adhérent du Club (page /relectures, nov. 2026) : « Mes commentaires »
// et « Proposer une mesure ». Fonctions pures, sans Next ni Prisma, testées par
// scripts/espace-club.test.js.

// ---------------------------------------------------------------------------
// Mes commentaires
// ---------------------------------------------------------------------------

// Statut affiché d'un commentaire :
//   - « retenu »     : réponse de l'équipe ET pris en compte dans une nouvelle version ;
//   - « repondu »    : réponse de l'équipe ;
//   - « reporte »    : pas encore traité, reporté sur la nouvelle version de la fiche ;
//   - « clos »       : relecture d'avant le Club ouvert, close sans réponse individuelle ;
//   - « en_attente » : en attente de la revue du dimanche.
export function statutCommentaire({ reponse, retenu, etat, archiveSansReponse }) {
  if (reponse) return retenu ? "retenu" : "repondu";
  if (retenu) return "retenu";
  if (etat === "reaccrochee") return "reporte";
  if (archiveSansReponse || etat === "traitee") return "clos";
  return "en_attente";
}

// Liste renvoyée par GET /api/relectures/mes-commentaires.
//   commentaires : RelectureComment de l'adhérent, avec `traitements` ;
//   fichesPubliees : Map propositionId → { titre, candidat } (fiches « fiche-<id> ») ;
//   archives : Map ficheSlug → { titre, candidat, reponses: Map id → { reponse, retenu } }
//              (anciennes relectures de brouillons, data/relectures/*.json) ;
//   dernierTraitement : versions-core.js (la ligne la plus récente fait foi).
// Le plus récent d'abord. Jamais l'adresse e-mail ni creditAccord d'un autre :
// la route ne lit que les commentaires de l'adhérent connecté.
export function mesCommentaires({ commentaires, fichesPubliees, archives, dernierTraitement }) {
  return [...commentaires]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((c) => {
      const t = dernierTraitement(c.traitements ?? []);
      const propositionId = propositionDuSlug(c.ficheSlug);
      let fiche;
      let reponse = null;
      let retenu = c.retenu === true;
      let archiveSansReponse = false;

      if (propositionId != null) {
        const p = fichesPubliees.get(propositionId);
        fiche = {
          type: "publiee",
          titre: p?.titre ?? "Fiche publiée",
          candidat: p?.candidat ?? null,
          lien: `/declarations/${propositionId}`,
        };
        if (t?.etat === "traitee") {
          reponse = t.reponse ?? null;
          retenu = retenu || t.retenu === true;
        }
      } else {
        const a = archives.get(c.ficheSlug);
        fiche = {
          type: "relecture",
          titre: a?.titre ?? c.ficheSlug,
          candidat: a?.candidat ?? null,
          // Les anciennes fiches relues restent consultables, en lecture seule, sur cette page.
          lien: a ? `#/${c.ficheSlug}` : null,
        };
        const r = a?.reponses.get(c.id);
        if (r) {
          reponse = r.reponse;
          retenu = retenu || r.retenu === true;
        } else if (a?.archivee) {
          archiveSansReponse = true;
        }
      }

      return {
        id: c.id,
        fiche,
        section: c.sectionLabel || null,
        passage: c.quotedText ?? null,
        texte: c.body,
        date: c.createdAt,
        reponse,
        retenu,
        statut: statutCommentaire({ reponse, retenu, etat: t?.etat ?? null, archiveSansReponse }),
      };
    });
}

// Archives de relecture (data/relectures/<slug>.json) → entrée de la Map `archives`.
export function archiveDepuisFiche(fiche) {
  const r = fiche?.relecture ?? {};
  const reponses = new Map(
    (r.archive?.reponses ?? []).map((x) => [x.commentaire_id, { reponse: x.reponse, retenu: x.retenu === true }]),
  );
  return { titre: r.titre ?? null, candidat: r.candidat ?? null, archivee: Boolean(r.archive), reponses };
}

// ---------------------------------------------------------------------------
// Proposer une mesure à analyser
// ---------------------------------------------------------------------------

export const LIMITES_PROPOSITION = { candidat: 120, mesure: 2000, source: 500, pourquoi: 1500 };
// Au plus N propositions par adhérent sur 24 h (garde-fou contre les doublons et les abus).
export const MAX_PROPOSITIONS_PAR_JOUR = 5;

export const STATUTS_PROPOSITION = {
  recue: "Reçue",
  retenue: "Retenue : analyse prévue",
  analysee: "Analysée",
  non_retenue: "Non retenue",
};

// Valide le corps de POST /api/relectures/propositions.
// → { valeurs } prêt à enregistrer, ou { error } (message affichable tel quel).
export function validerProposition(data) {
  if (!data || typeof data !== "object") return { error: "Requête invalide." };
  const champ = (k) => (typeof data[k] === "string" ? data[k].trim() : "");
  const candidat = champ("candidat");
  const mesure = champ("mesure");
  const source = champ("source");
  const pourquoi = champ("pourquoi");

  if (!candidat) return { error: "Indique le candidat ou la candidate." };
  if (mesure.length < 15) return { error: "Décris la mesure en une ou deux phrases (15 caractères minimum)." };
  for (const [k, v] of Object.entries({ candidat, mesure, source, pourquoi })) {
    if (v.length > LIMITES_PROPOSITION[k]) {
      return { error: `Le champ « ${k} » ne doit pas dépasser ${LIMITES_PROPOSITION[k]} caractères.` };
    }
  }
  if (source) {
    let url;
    try {
      url = new URL(source);
    } catch {
      return { error: "Le lien vers la source doit être une adresse web complète (https://…)." };
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return { error: "Le lien vers la source doit commencer par https://." };
    }
  }
  return { valeurs: { candidat, mesure, source: source || null, pourquoi: pourquoi || null } };
}

// Ligne de la table → objet renvoyé à l'adhérent (ses propres propositions).
export function propositionPourAdherent(p) {
  return {
    id: p.id,
    candidat: p.candidat,
    mesure: p.mesure,
    source: p.source,
    pourquoi: p.pourquoi,
    date: p.createdAt,
    statut: p.statut,
    statutLibelle: STATUTS_PROPOSITION[p.statut] ?? STATUTS_PROPOSITION.recue,
    reponse: p.reponse ?? null,
    lien: p.propositionId ? `/declarations/${p.propositionId}` : null,
  };
}

// Mail de notification à la boîte du Club (club@perlimpinpin.ai).
export function composerMailProposition({ proposition, auteur }) {
  const lignes = [
    `Nouvelle proposition de mesure à analyser, envoyée depuis l'espace du Club.`,
    "",
    `Adhérent : ${auteur.nom} (n° ${auteur.id})`,
    `Candidat : ${proposition.candidat}`,
    "",
    "Mesure :",
    proposition.mesure,
    "",
    `Source : ${proposition.source ?? "non indiquée"}`,
  ];
  if (proposition.pourquoi) lignes.push("", "Pourquoi l'analyser :", proposition.pourquoi);
  lignes.push(
    "",
    `Proposition n° ${proposition.id ?? "?"}. Pour changer son statut (retenue, analysee, non_retenue) et répondre à l'adhérent : table PropositionClub (npx prisma studio).`,
    "",
  );
  return {
    objet: `[Club] Mesure proposée : ${proposition.candidat}`.slice(0, 150),
    texte: lignes.join("\n"),
  };
}
