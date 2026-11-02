import MOUVEMENT_SOCIAL from "../../data/hors-series/mouvement-social.json" with { type: "json" };
import RN_PLAN_BUDGETAIRE from "../../data/hors-series/rn-plan-budgetaire.json" with { type: "json" };
import { getFichesPubliees } from "./queries";

// Registre des dossiers (pages /dossiers/[slug], listées sur /dossiers
// et mises en avant dans le carrousel de l'accueil). Chaque JSON de
// data/hors-series/ est importé statiquement, et non lu avec fs à la
// requête : le bundler l'embarque ainsi dans la fonction déployée sur
// Vercel. Pour ajouter un hors-série : importer son JSON ci-dessus et
// l'ajouter à la liste (le plus récent en premier). Un dossier dont le JSON
// porte `visible: false` reste hors du registre (page accessible par son
// adresse seulement).
const HORS_SERIES = [MOUVEMENT_SOCIAL, RN_PLAN_BUDGETAIRE].filter((hs) => hs.visible !== false);

// Dossiers servis par leur propre route (src/app/dossiers/<slug>/), leur JSON
// n'ayant pas la structure lue par le gabarit /dossiers/[slug].
const ROUTES_DEDIEES = new Set(["mouvement-social"]);

const PAR_SLUG = new Map(HORS_SERIES.map((hs) => [hs.slug, hs]));

export function getHorsSerie(slug) {
  return PAR_SLUG.get(slug) ?? null;
}

// Slugs servis par le gabarit /dossiers/[slug] (hors routes dédiées).
export function getHorsSerieSlugs() {
  return HORS_SERIES.map((hs) => hs.slug).filter((slug) => !ROUTES_DEDIEES.has(slug));
}

// Tous les hors-séries, le plus récent en premier (page /dossiers).
export function getHorsSeries() {
  return HORS_SERIES;
}

// Avancement d'un hors-série : nombre de fiches par statut, dans l'ordre
// des fiches (pour la barre d'avancement des cartes), et phrase lisible.
// Dossier à fiches (`fiches`, plan budgétaire RN) : statuts écrits dans le
// JSON. Dossier à propositions (`propositions[].ficheId`, mouvement social) :
// une fiche compte comme publiée dès que son analyse l'est en base (lecture
// seule, getFichesPubliees), sans toucher au JSON ; si `accueil.fichesPrevues`
// dépasse le nombre de fiches déjà rattachées, le reste compte « à venir ».
// Tant qu'aucune n'est publiée, la phrase est `accueil.messageSansFiche`.
export async function avancementHorsSerie(hs) {
  let statuts;
  if (hs.fiches) {
    statuts = hs.fiches.map((fiche) => fiche.statut);
  } else {
    const ids = [...new Set((hs.propositions ?? []).map((p) => p.ficheId).filter(Number.isInteger))];
    let fiches = {};
    try {
      fiches = await getFichesPubliees(ids);
    } catch (erreur) {
      console.error(`[dossier ${hs.slug}] lecture des fiches impossible :`, erreur.message);
    }
    statuts = ids.map((id) => (fiches[id] ? "publiee" : "a_venir"));
    const prevues = hs.accueil?.fichesPrevues;
    if (Number.isInteger(prevues) && prevues > statuts.length) {
      statuts = statuts.concat(Array(prevues - statuts.length).fill("a_venir"));
    }
  }
  const avancement = {
    statuts,
    total: statuts.length,
    publiees: statuts.filter((s) => s === "publiee").length,
    enRelecture: statuts.filter((s) => s === "relecture").length,
    aVenir: statuts.filter((s) => s === "a_venir").length,
  };
  const texte =
    avancement.publiees === 0 && hs.accueil?.messageSansFiche
      ? hs.accueil.messageSansFiche
      : texteAvancement(avancement);
  return { ...avancement, texte };
}

// Phrase d'avancement lisible, ex. « 1 fiche en relecture · 4 à venir ».
function texteAvancement({ publiees, enRelecture, aVenir }) {
  const morceaux = [];
  if (publiees) morceaux.push(`${publiees} fiche${publiees > 1 ? "s" : ""} publiée${publiees > 1 ? "s" : ""}`);
  if (enRelecture) morceaux.push(`${enRelecture} en relecture`);
  if (aVenir) morceaux.push(`${aVenir} à venir`);
  return morceaux.join(" · ");
}

// Dossiers à afficher dans le carrousel de l'accueil (bloc `accueil` du
// JSON, avec `afficher: true`), réduits aux seules données utiles à la
// carte, qui est un composant client (le JSON complet n'est ainsi pas
// envoyé au navigateur). Ils y sont rangés à leur date de mise en ligne
// (`datePublication`) parmi les analyses, voir getFeaturedRotation ; avec
// `accueil.enTete: true`, le dossier passe en première carte.
export async function getHorsSeriesAccueil() {
  return Promise.all(
    HORS_SERIES.filter((hs) => hs.accueil?.afficher).map(async (hs) => {
      const avancement = await avancementHorsSerie(hs);
      return {
        slug: hs.slug,
        numero: hs.numero,
        etiquette: hs.etiquette,
        // Titre court pour la carte (limitée à 3 lignes comme les autres),
        // sinon le titre complet.
        titre: hs.accueil.titre ?? hs.titre,
        motItalique: hs.motItalique,
        accroche: hs.accueil.accroche,
        datePublication: hs.datePublication,
        enTete: hs.accueil.enTete === true,
        photo: hs.photo,
        candidat: hs.candidat,
        avancement,
        texteAvancement: avancement.texte,
      };
    }),
  );
}
