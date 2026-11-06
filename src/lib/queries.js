import { prisma } from "@/lib/prisma";
import { creerMoteur } from "@/lib/recherche";
import { resolveTheme, themeLabel } from "@/lib/themes";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

// Date courte (ex. 5/10/2026) pour la ligne « Analyse réalisée le … » de la fiche.
const dateChiffresFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
  timeZone: "Europe/Paris",
});

// Date courte (« 28 sept. 2026 ») pour la colonne « Dernières déclarations »
// de la page d'accueil.
const dateCourteFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

// Titre court pour l'affichage sur les cartes. Si `titre` n'a pas été
// généré (anciennes propositions), on retombe sur texteOriginal tronqué.
function displayTitle(proposition) {
  if (proposition.titre) return proposition.titre;
  const text = proposition.texteOriginal;
  return text.length > 80 ? `${text.slice(0, 79).trimEnd()}…` : text;
}

// Document indexé par le moteur de recherche (src/lib/recherche.js) pour une
// analyse publiée (avec sa proposition et son candidat). id = id de
// l'analyse (unique), propositionId = lien vers /declarations/[id].
function documentRecherche(analyse) {
  return {
    id: analyse.id,
    propositionId: analyse.proposition.id,
    titre: displayTitle(analyse.proposition),
    candidat: analyse.proposition.candidat.nom,
    theme: themeLabel(analyse.proposition.theme),
    resume: analyse.resumeAccueil ?? analyse.verdict?.slice(0, 400) ?? "",
    texte: analyse.proposition.texteOriginal.slice(0, 600),
  };
}

// Données de la barre de recherche de la page d'accueil : une ligne courte
// par analyse publiée, envoyée au navigateur avec la page (déjà en cache
// ISR), puis la recherche se fait entièrement côté navigateur, sans appel
// réseau à chaque frappe.
export async function getIndexRecherche() {
  const analyses = await prisma.analyse.findMany({
    where: { statut: "publie" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      resumeAccueil: true,
      verdict: true,
      proposition: {
        select: {
          id: true,
          titre: true,
          texteOriginal: true,
          theme: true,
          candidat: { select: { nom: true } },
        },
      },
    },
  });
  return analyses.map(documentRecherche);
}

// Le champ `theme` des propositions contient le slug d'un des 12 thèmes de
// src/lib/themes.js (harmonisation d'octobre 2026, voir
// scripts/harmoniser-themes.js). cleTheme() ramène aussi une ancienne
// écriture libre ("Emploi et chômage"...) au même identifiant ; les libellés
// affichés passent par themeLabel().
function cleTheme(valeur) {
  return resolveTheme(valeur) ?? valeur;
}

// Réordonne une liste déjà triée par récence décroissante (plus récent en
// premier) de façon à ne jamais enchaîner deux cartes du même candidat,
// tout en respectant la récence en priorité — contrairement à l'ancien
// tirage aléatoire (retiré ici avec le passage de la page d'accueil en
// force-dynamic à un cache ISR, voir getFeaturedRotation : un ordre
// déterministe et significatif se cache bien, un ordre aléatoire recalculé
// à chaque visite ne le pouvait pas).
//
// Glouton : à chaque position, on prend la carte la plus récente parmi les
// candidats différents du dernier placé (façon "task scheduler" à
// cooldown 1, mais priorisé par date plutôt que par quantité restante).
// Si tous les candidats restants sont le même que le dernier placé — un
// seul candidat concentre plus de la moitié des cartes restantes — la
// répétition devient mathématiquement inévitable ; on place la carte la
// plus récente quand même plutôt que de bloquer (même limite déjà admise
// par l'ancien algorithme aléatoire).
function reorderRecentNoAdjacentSameCandidat(items) {
  const groups = new Map();
  for (const item of items) {
    if (!groups.has(item.personName)) groups.set(item.personName, []);
    groups.get(item.personName).push(item);
  }

  const result = [];
  let lastCandidat = null;

  while (result.length < items.length) {
    let bestKey = null;
    for (const key of groups.keys()) {
      if (key === lastCandidat) continue;
      if (bestKey === null || groups.get(key)[0].dateSort > groups.get(bestKey)[0].dateSort) {
        bestKey = key;
      }
    }
    if (bestKey === null) bestKey = lastCandidat; // adjacence inévitable, voir ci-dessus

    const group = groups.get(bestKey);
    const { dateSort, ...item } = group.shift(); // dateSort est interne, pas exposé au composant
    result.push(item);
    if (group.length === 0) groups.delete(bestKey);
    lastCandidat = bestKey;
  }

  return result;
}

// Plus grande date représentable en JavaScript (an 275760).
const DATE_MAX = 8.64e15;

// Toutes les analyses publiées, les plus récemment publiées en premier,
// sans jamais enchaîner deux cartes du même candidat quand c'est évitable.
// Alimente le carrousel "Prix Perlimpinpin de la semaine" + la carte Score
// associée. Ordre désormais déterministe (dépend seulement du contenu
// publié, jamais du visiteur ni du moment de la visite) : voir le cache
// ISR posé sur la page d'accueil, qui exige un rendu reproductible pour
// pouvoir être partagé entre visiteurs.
// `dossiers` (getHorsSeriesAccueil, src/lib/hors-series.js) : les dossiers
// sont des cartes comme les autres, rangées à leur date de mise en ligne
// (`datePublication`) et rattachées à leur candidat pour la règle « pas
// deux cartes du même candidat à la suite ».
export async function getFeaturedRotation(dossiers = []) {
  const analyses = await prisma.analyse.findMany({
    where: { statut: "publie" },
    orderBy: { createdAt: "desc" },
    include: {
      proposition: { include: { candidat: true } },
    },
  });

  const items = analyses.map((analyse) => ({
    propositionId: analyse.proposition.id,
    quoteText: displayTitle(analyse.proposition),
    personName: analyse.proposition.candidat.nom,
    personPhotoUrl: analyse.proposition.candidat.photoUrl,
    personRole: `Déclaration • ${themeLabel(analyse.proposition.theme)}`,
    dateLabel: dateFormatter.format(analyse.proposition.dateDeclaration),
    score: analyse.scoreFaisabilite,
    verdictDescription: analyse.resumeAccueil ?? analyse.verdict,
    dateSort: analyse.createdAt,
  }));

  for (const dossier of dossiers) {
    items.push({
      dossier,
      personName: dossier.candidat?.nom ?? `dossier-${dossier.slug}`,
      // Dossier « en tête » : date maximale, il passe donc devant tout le
      // reste ; la carte suivante reste d'un autre candidat (voir ci-dessus).
      dateSort: dossier.enTete ? new Date(DATE_MAX) : new Date(dossier.datePublication ?? 0),
    });
  }
  // Le regroupement par candidat suppose chaque groupe trié du plus récent
  // au plus ancien : les dossiers ajoutés en fin de liste y sont replacés.
  items.sort((a, b) => b.dateSort - a.dateSort);

  return reorderRecentNoAdjacentSameCandidat(items);
}

export async function getTopDeclarations(limit = 3) {
  const analyses = await prisma.analyse.findMany({
    where: { statut: "publie" },
    orderBy: { proposition: { dateDeclaration: "desc" } },
    take: limit,
    include: {
      proposition: { include: { candidat: true } },
    },
  });

  return analyses.map((analyse) => ({
    propositionId: analyse.proposition.id,
    name: analyse.proposition.candidat.nom,
    photoUrl: analyse.proposition.candidat.photoUrl,
    quote: displayTitle(analyse.proposition),
    date: dateCourteFormatter.format(analyse.proposition.dateDeclaration),
    theme: themeLabel(analyse.proposition.theme),
    score: analyse.scoreFaisabilite,
  }));
}

export async function getCandidateRanking(limit) {
  const candidats = await prisma.candidat.findMany({
    // Sans limite : tous les candidats sont affichés, y compris ceux pas
    // encore analysés (scoreMoyen null, tri "nulls last" -> en bas de liste).
    ...(limit ? { take: limit } : {}),
    orderBy: [{ scoreMoyen: { sort: "desc", nulls: "last" } }, { nom: "asc" }],
    include: {
      propositions: {
        include: { analyses: { where: { statut: "publie" } } },
      },
    },
  });

  return candidats.map((candidat) => ({
    name: candidat.nom,
    photoUrl: candidat.photoUrl,
    avgScore: candidat.scoreMoyen,
    declarations: candidat.propositions.reduce(
      (total, proposition) => total + proposition.analyses.length,
      0,
    ),
  }));
}

// Liste des déclarations publiées pour la page /declarations, avec filtres
// (candidat, thème) et tri (date ou score). Retourne aussi les listes de
// candidats/thèmes disponibles pour construire les filtres.
// `q` = mots-clés tapés dans la barre de recherche (moteur tolérant aux
// fautes et aux accents, voir src/lib/recherche.js). sort = "pertinence"
// classe les résultats de la recherche du plus au moins pertinent.
export async function getPublishedDeclarations({ candidat, theme, sort, q } = {}) {
  const themeCible = theme ? cleTheme(theme) : null;
  const orderBy =
    sort === "score_asc"
      ? [{ scoreFaisabilite: "asc" }]
      : sort === "score_desc"
        ? [{ scoreFaisabilite: "desc" }]
        : [{ createdAt: "desc" }];

  const [analysesCandidat, allPublished, rankRows, allCandidats] = await Promise.all([
    // Filtre thème appliqué après coup (voir cleTheme), pour accepter aussi
    // un libellé ou une ancienne écriture dans l'URL.
    prisma.analyse.findMany({
      where: {
        statut: "publie",
        ...(candidat ? { proposition: { candidat: { nom: candidat } } } : {}),
      },
      orderBy,
      include: {
        proposition: { include: { candidat: true } },
      },
    }),
    prisma.analyse.findMany({
      where: { statut: "publie" },
      include: { proposition: { include: { candidat: true } } },
    }),
    // Rang chronologique global (1 = analyse publiée la plus ancienne),
    // pour l'étiquette "ANALYSE_XXX" des cartes — l'id brut ne peut plus
    // servir de numéro depuis la suppression des 20 premières analyses
    // (la série recommençait à 021 au lieu de 001). Calculé par Postgres via
    // ROW_NUMBER(), jamais en chargeant toutes les lignes pour les compter
    // côté JS, et indépendant du filtre/tri courant de la page (le rang
    // d'une analyse ne doit pas changer selon la vue affichée) — sur
    // createdAt, pas sur dateDeclaration (date de la déclaration du
    // candidat, sans rapport avec l'ordre de publication de nos analyses).
    prisma.$queryRaw`
      SELECT id, ROW_NUMBER() OVER (ORDER BY "createdAt" ASC) AS rang
      FROM "Analyse"
      WHERE statut = 'publie'
    `,
    // Tous les candidats existants, pas seulement ceux ayant déjà une
    // déclaration publiée : un candidat sans déclaration doit rester
    // sélectionnable dans le filtre (il affichera juste "aucune déclaration
    // ne correspond"), sinon le pill actif disparaît silencieusement quand
    // on arrive sur /declarations?candidat=... depuis sa fiche.
    prisma.candidat.findMany({ select: { nom: true, parti: true } }),
  ]);

  const analyses = themeCible
    ? analysesCandidat.filter((a) => cleTheme(a.proposition.theme) === themeCible)
    : analysesCandidat;

  const rankById = new Map(rankRows.map((row) => [Number(row.id), Number(row.rang)]));

  const candidats = [...allCandidats].sort((a, b) => a.nom.localeCompare(b.nom, "fr"));

  const themes = themeOptions(allPublished);

  // Recherche (même moteur que la barre de la page d'accueil, sans limite
  // de nombre) : on garde les analyses trouvées, dans l'ordre de pertinence
  // si le tri « pertinence » est demandé.
  let analysesTrouvees = analyses;
  if (q) {
    const trouvees = creerMoteur(analyses.map(documentRecherche)).rechercher(q, Infinity);
    const rang = new Map(trouvees.map((doc, index) => [doc.id, index]));
    analysesTrouvees = analyses.filter((analyse) => rang.has(analyse.id));
    if (sort === "pertinence") {
      analysesTrouvees.sort((a, b) => rang.get(a.id) - rang.get(b.id));
    }
  }

  const declarations = analysesTrouvees.map((analyse) => ({
    id: analyse.proposition.id,
    analyseId: analyse.id,
    rang: rankById.get(analyse.id),
    titre: displayTitle(analyse.proposition),
    candidatNom: analyse.proposition.candidat.nom,
    candidatParti: analyse.proposition.candidat.parti,
    candidatPhotoUrl: analyse.proposition.candidat.photoUrl,
    theme: themeLabel(analyse.proposition.theme),
    dateLabel: dateFormatter.format(analyse.proposition.dateDeclaration),
    score: analyse.scoreFaisabilite,
  }));

  return { declarations, candidats, themes };
}

// Thèmes distincts d'une liste d'analyses, dédoublonnés :
// [{ value: slug, label, nombre }], triés par libellé.
function themeOptions(analyses) {
  const parCle = new Map();
  for (const analyse of analyses) {
    const cle = cleTheme(analyse.proposition.theme);
    const option = parCle.get(cle) ?? {
      value: cle,
      label: themeLabel(analyse.proposition.theme),
      nombre: 0,
    };
    option.nombre += 1;
    parCle.set(cle, option);
  }
  return [...parCle.values()].sort((a, b) => a.label.localeCompare(b.label, "fr"));
}

// Thèmes des analyses publiées, pour les pastilles « Thèmes populaires » de
// la page d'accueil : du plus au moins fourni (une seule ligne est affichée,
// les premiers doivent être les plus utiles), puis par libellé.
export async function getPublishedThemes() {
  const analyses = await prisma.analyse.findMany({
    where: { statut: "publie" },
    select: { proposition: { select: { theme: true } } },
  });

  return themeOptions(analyses).sort((a, b) => b.nombre - a.nombre);
}

// Propositions publiées pour un thème éditorial donné (page /themes/[slug]),
// une ligne par candidat, triées par score décroissant.
export async function getPublishedPropositionsByThemeSlug(slug) {
  const analyses = await prisma.analyse.findMany({
    where: { statut: "publie" },
    include: { proposition: { include: { candidat: true } } },
  });

  return analyses
    .filter((analyse) => resolveTheme(analyse.proposition.theme) === slug)
    .map((analyse) => ({
      propositionId: analyse.proposition.id,
      candidatNom: analyse.proposition.candidat.nom,
      candidatParti: analyse.proposition.candidat.parti,
      candidatPhotoUrl: analyse.proposition.candidat.photoUrl,
      titre: displayTitle(analyse.proposition),
      excerpt: analyse.resumeAccueil ?? analyse.teaser ?? null,
      score: analyse.scoreFaisabilite,
    }))
    .sort((a, b) => b.score - a.score);
}

// Nombre de déclarations publiées par thème (slug), pour l'affichage "X
// déclarations analysées" sur chaque carte de /themes — une seule requête
// agrégée plutôt qu'un appel à getPublishedPropositionsByThemeSlug par
// thème (11 thèmes, éviterait sinon 11 allers-retours en base).
export async function getPublishedCountsByThemeSlug() {
  const analyses = await prisma.analyse.findMany({
    where: { statut: "publie" },
    select: { proposition: { select: { theme: true } } },
  });

  const counts = new Map();
  for (const analyse of analyses) {
    const slug = resolveTheme(analyse.proposition.theme);
    if (!slug) continue;
    counts.set(slug, (counts.get(slug) ?? 0) + 1);
  }
  return counts;
}

// IDs des propositions ayant au moins une analyse publiée, avec la date de
// dernière modification de l'analyse publiée la plus récente — pour
// app/sitemap.js (lecture seule, aucun write). Une proposition peut avoir
// plusieurs analyses ; seule la plus récemment modifiée parmi les publiées
// compte pour lastModified (une proposition sans aucune analyse publiée n'a
// pas d'URL publique et n'apparaît donc pas ici).
export async function getPublishedPropositionsForSitemap() {
  const analyses = await prisma.analyse.findMany({
    where: { statut: "publie" },
    select: { propositionId: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });

  const lastModifiedByPropositionId = new Map();
  for (const analyse of analyses) {
    if (!lastModifiedByPropositionId.has(analyse.propositionId)) {
      lastModifiedByPropositionId.set(analyse.propositionId, analyse.updatedAt);
    }
  }

  return [...lastModifiedByPropositionId.entries()].map(([id, lastModified]) => ({
    id,
    lastModified,
  }));
}

// Liste de tous les candidats pour la page /candidats, avec leur nombre de
// déclarations publiées et leur score moyen.
export async function getAllCandidats() {
  const candidats = await prisma.candidat.findMany({
    orderBy: [{ scoreMoyen: { sort: "desc", nulls: "last" } }, { nom: "asc" }],
    include: {
      propositions: {
        include: { analyses: { where: { statut: "publie" } } },
      },
    },
  });

  return candidats.map((candidat) => ({
    id: candidat.id,
    nom: candidat.nom,
    parti: candidat.parti,
    photoUrl: candidat.photoUrl,
    scoreMoyen: candidat.scoreMoyen,
    declarationsPubliees: candidat.propositions.reduce(
      (total, proposition) => total + proposition.analyses.length,
      0,
    ),
  }));
}

// Moyenne des scores des fiches publiées d'un candidat, arrondie à l'entier
// (null sans fiche). Partagée par la grille /candidats et la page
// /candidats/[id] : le score affiché doit être identique aux deux endroits.
function moyenneArrondie(scores) {
  return scores.length
    ? Math.round(scores.reduce((total, score) => total + score, 0) / scores.length)
    : null;
}

// Scores des candidats pour les cartes /candidats, indexés par nom complet
// ("Marine Tondelier") : moyenne des scores de leurs fiches publiées,
// arrondie à l'entier (null sans fiche publiée), et nombre de fiches.
export async function getScoresCandidats() {
  const candidats = await prisma.candidat.findMany({
    include: {
      propositions: {
        include: {
          analyses: { where: { statut: "publie" }, select: { scoreFaisabilite: true } },
        },
      },
    },
  });

  return new Map(
    candidats.map((candidat) => {
      const scores = candidat.propositions.flatMap((proposition) =>
        proposition.analyses.map((analyse) => analyse.scoreFaisabilite),
      );
      return [
        candidat.nom,
        {
          id: candidat.id,
          photoUrl: candidat.photoUrl,
          nombreFiches: scores.length,
          scoreMoyen: moyenneArrondie(scores),
        },
      ];
    }),
  );
}

// Page /candidats/[id] : le candidat, son score moyen (même calcul que la
// grille) et ses déclarations publiées au format des cartes de /declarations,
// triées par score décroissant. Deux requêtes en parallèle : le candidat avec
// ses analyses publiées, et le rang chronologique global "ANALYSE_XXX" (même
// calcul que getPublishedDeclarations). null si le candidat n'existe pas.
export async function getCandidatAvecDeclarations(id) {
  const [candidat, rankRows] = await Promise.all([
    prisma.candidat.findUnique({
      where: { id },
      include: {
        propositions: { include: { analyses: { where: { statut: "publie" } } } },
      },
    }),
    prisma.$queryRaw`
      SELECT id, ROW_NUMBER() OVER (ORDER BY "createdAt" ASC) AS rang
      FROM "Analyse"
      WHERE statut = 'publie'
    `,
  ]);

  if (!candidat) return null;

  const rankById = new Map(rankRows.map((row) => [Number(row.id), Number(row.rang)]));

  const declarations = candidat.propositions
    .flatMap((proposition) =>
      proposition.analyses.map((analyse) => ({
        id: proposition.id,
        analyseId: analyse.id,
        rang: rankById.get(analyse.id),
        titre: displayTitle(proposition),
        candidatNom: candidat.nom,
        candidatParti: candidat.parti,
        candidatPhotoUrl: candidat.photoUrl,
        theme: themeLabel(proposition.theme),
        dateLabel: dateFormatter.format(proposition.dateDeclaration),
        score: analyse.scoreFaisabilite,
      })),
    )
    .sort((a, b) => b.score - a.score);

  return {
    id: candidat.id,
    nom: candidat.nom,
    parti: candidat.parti,
    photoUrl: candidat.photoUrl,
    scoreMoyen: moyenneArrondie(declarations.map((d) => d.score)),
    declarations,
  };
}

// Compte les votes like/dislike par Analyse, filtré depuis `sinceDate`
// (ou sur toute la période si `sinceDate` est omis).
async function getVoteCountsByAnalyse(sinceDate) {
  const rows = await prisma.feedback.groupBy({
    by: ["analyseId", "type"],
    where: sinceDate ? { createdAt: { gte: sinceDate } } : undefined,
    _count: { _all: true },
  });

  const counts = new Map();
  for (const row of rows) {
    const entry = counts.get(row.analyseId) ?? { likes: 0, dislikes: 0 };
    if (row.type === "like") entry.likes = row._count._all;
    if (row.type === "dislike") entry.dislikes = row._count._all;
    counts.set(row.analyseId, entry);
  }
  return counts;
}

// Renvoie l'analyseId ayant le plus de votes pour `key` ("likes"/"dislikes"),
// ou null si aucune analyse n'a de vote sur cette période.
function pickTopVoted(counts, key) {
  let bestId = null;
  let bestCount = 0;
  for (const [analyseId, entry] of counts) {
    if (entry[key] > bestCount) {
      bestCount = entry[key];
      bestId = analyseId;
    }
  }
  return bestId;
}

// Carte commune (candidat, titre, extrait, score) partagée par le
// classement par votes et le classement par score de /prix-perlimpinpin.
function buildAnalyseCard(analyse) {
  const contenu = analyse.contenuComplet ?? {};
  const excerptSource = contenu.verdict_final ?? contenu.resume_court ?? analyse.verdict;
  const excerptText = Array.isArray(excerptSource)
    ? excerptSource.join(" ")
    : (excerptSource ?? "");
  const excerpt =
    excerptText.length > 150 ? `${excerptText.slice(0, 149).trimEnd()}…` : excerptText;

  return {
    propositionId: analyse.proposition.id,
    titre: displayTitle(analyse.proposition),
    candidatNom: analyse.proposition.candidat.nom,
    candidatPhotoUrl: analyse.proposition.candidat.photoUrl,
    excerpt,
    score: analyse.scoreFaisabilite,
  };
}

async function buildLeaderboardCard(analyseId, counts) {
  if (!analyseId) return null;

  const analyse = await prisma.analyse.findUnique({
    where: { id: analyseId },
    include: { proposition: { include: { candidat: true } } },
  });
  if (!analyse) return null;

  const { likes, dislikes } = counts.get(analyseId) ?? { likes: 0, dislikes: 0 };

  return { ...buildAnalyseCard(analyse), likes, dislikes };
}

async function buildLeaderboardSection(counts) {
  const [topLiked, topDisliked] = await Promise.all([
    buildLeaderboardCard(pickTopVoted(counts, "likes"), counts),
    buildLeaderboardCard(pickTopVoted(counts, "dislikes"), counts),
  ]);
  return { topLiked, topDisliked };
}

// Classement des déclarations par votes pour la page /prix-perlimpinpin :
// général (toutes périodes), 30 derniers jours, 10 derniers jours.
export async function getFeedbackLeaderboard() {
  const now = Date.now();
  const since30 = new Date(now - 30 * 24 * 60 * 60 * 1000);
  const since10 = new Date(now - 10 * 24 * 60 * 60 * 1000);

  const [allCounts, counts30, counts10] = await Promise.all([
    getVoteCountsByAnalyse(),
    getVoteCountsByAnalyse(since30),
    getVoteCountsByAnalyse(since10),
  ]);

  const [general, last30, last10] = await Promise.all([
    buildLeaderboardSection(allCounts),
    buildLeaderboardSection(counts30),
    buildLeaderboardSection(counts10),
  ]);

  return { general, last30, last10 };
}

// Déclarations avec le score Perlimpinpin le plus haut et le plus bas parmi
// toutes les analyses publiées, pour le podium en haut de /prix-perlimpinpin.
export async function getScoreExtremes() {
  const [highest, lowest] = await Promise.all([
    prisma.analyse.findFirst({
      where: { statut: "publie" },
      orderBy: [{ scoreFaisabilite: "desc" }, { createdAt: "asc" }],
      include: { proposition: { include: { candidat: true } } },
    }),
    prisma.analyse.findFirst({
      where: { statut: "publie" },
      orderBy: [{ scoreFaisabilite: "asc" }, { createdAt: "asc" }],
      include: { proposition: { include: { candidat: true } } },
    }),
  ]);

  return {
    highest: highest ? buildAnalyseCard(highest) : null,
    // Si une seule analyse publiée existe, highest et lowest seraient la
    // même déclaration affichée deux fois — on n'affiche alors qu'une carte.
    lowest:
      lowest && lowest.id !== highest?.id ? buildAnalyseCard(lowest) : null,
  };
}

async function getVoteMesureCountsByProposition() {
  const rows = await prisma.voteMesure.groupBy({
    by: ["propositionId", "type"],
    _count: { _all: true },
  });

  const counts = new Map();
  for (const row of rows) {
    const entry = counts.get(row.propositionId) ?? { accord: 0, desaccord: 0 };
    if (row.type === "accord") entry.accord = row._count._all;
    if (row.type === "desaccord") entry.desaccord = row._count._all;
    counts.set(row.propositionId, entry);
  }
  return counts;
}

// Classe les propositionId par nombre de votes décroissant pour `key`
// ("accord"/"desaccord"), propositions sans aucun vote de ce type exclues.
function rankVotedPropositions(counts, key, limit) {
  return [...counts.entries()]
    .filter(([, entry]) => entry[key] > 0)
    .sort((a, b) => b[1][key] - a[1][key])
    .slice(0, limit)
    .map(([propositionId]) => propositionId);
}

async function buildVoteMesureCard(propositionId, counts) {
  if (!propositionId) return null;

  const proposition = await prisma.proposition.findUnique({
    where: { id: propositionId },
    include: {
      candidat: true,
      analyses: { where: { statut: "publie" }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!proposition || proposition.analyses.length === 0) return null;

  const { accord, desaccord } = counts.get(propositionId) ?? { accord: 0, desaccord: 0 };
  const total = accord + desaccord;

  return {
    propositionId: proposition.id,
    titre: displayTitle(proposition),
    candidatNom: proposition.candidat.nom,
    candidatPhotoUrl: proposition.candidat.photoUrl,
    score: proposition.analyses[0].scoreFaisabilite,
    accord,
    desaccord,
    accordPct: total > 0 ? Math.round((accord / total) * 100) : 0,
    desaccordPct: total > 0 ? Math.round((desaccord / total) * 100) : 0,
  };
}

// Classement des déclarations par vote public sur la mesure elle-même
// (d'accord / pas d'accord, voir prisma/schema.prisma VoteMesure) — distinct
// du score Perlimpinpin et du feedback sur la qualité de l'analyse. Pour la
// section "Le choix des visiteurs" de /prix-perlimpinpin (top 2 par
// colonne : une même déclaration peut apparaître dans les deux classements,
// si elle cumule beaucoup d'accord ET de désaccord).
export async function getVoteMesureLeaderboard() {
  const counts = await getVoteMesureCountsByProposition();
  const topAccordIds = rankVotedPropositions(counts, "accord", 2);
  const topDesaccordIds = rankVotedPropositions(counts, "desaccord", 2);

  const [topAccord, topDesaccord] = await Promise.all([
    Promise.all(topAccordIds.map((id) => buildVoteMesureCard(id, counts))),
    Promise.all(topDesaccordIds.map((id) => buildVoteMesureCard(id, counts))),
  ]);

  return {
    topAccord: topAccord.filter(Boolean),
    topDesaccord: topDesaccord.filter(Boolean),
  };
}

// Score publié de plusieurs propositions (cartes des fiches des pages
// /hors-serie). Lecture seule. Renvoie un objet { [propositionId]: score }
// tiré de la dernière analyse PUBLIÉE de chaque proposition ; une
// proposition sans analyse publiée est absente du résultat.
export async function getScoresPublies(propositionIds) {
  if (propositionIds.length === 0) return {};
  const analyses = await prisma.analyse.findMany({
    where: { statut: "publie", propositionId: { in: propositionIds } },
    orderBy: { createdAt: "desc" },
    select: { propositionId: true, scoreFaisabilite: true },
  });
  const scores = {};
  for (const analyse of analyses) {
    scores[analyse.propositionId] ??= analyse.scoreFaisabilite;
  }
  return scores;
}

// Fiches publiées de plusieurs propositions (propositions du dossier
// « Mouvement social », champ `ficheId` du JSON). Lecture seule. Renvoie un
// objet { [propositionId]: fiche } tiré de la dernière analyse PUBLIÉE de
// chaque proposition : note, résumé, notation détaillée, conclusion, date de
// dernière mise à jour (le schéma n'a pas de date de publication). Une
// proposition sans analyse publiée est absente du résultat.
export async function getFichesPubliees(propositionIds) {
  if (propositionIds.length === 0) return {};
  const analyses = await prisma.analyse.findMany({
    where: { statut: "publie", propositionId: { in: propositionIds } },
    orderBy: { createdAt: "desc" },
    select: {
      propositionId: true,
      scoreFaisabilite: true,
      teaser: true,
      contenuComplet: true,
      updatedAt: true,
      proposition: { select: { titre: true, candidat: { select: { nom: true, parti: true } } } },
    },
  });
  const fiches = {};
  for (const analyse of analyses) {
    if (fiches[analyse.propositionId]) continue;
    const contenu = analyse.contenuComplet ?? {};
    fiches[analyse.propositionId] = {
      propositionId: analyse.propositionId,
      titre: analyse.proposition.titre,
      candidat: analyse.proposition.candidat.nom,
      parti: analyse.proposition.candidat.parti,
      score: analyse.scoreFaisabilite,
      resume: contenu.resume_court ?? analyse.teaser ?? null,
      notation: contenu.notation_detaillee ?? null,
      conclusion: typeof contenu.verdict_conclusion === "string" ? contenu.verdict_conclusion : null,
      miseAJour: analyse.updatedAt.toISOString(),
    };
  }
  return fiches;
}

// Détail d'une déclaration : la Proposition, son Candidat, et sa dernière
// Analyse PUBLIÉE (avec le contenuComplet JSON pour les 17 sections). Un
// brouillon n'est jamais renvoyé au site public : pas d'analyse publiée =>
// analyse null => 404 sur /declarations/[id]. Seule la prévisualisation
// /test/[id] (rendu dynamique, jamais mis en cache) passe inclureBrouillons
// pour relire la dernière analyse, brouillon compris (mais jamais une analyse à
// la corbeille : même règle que l'en-tête de /test/[id]).
export async function getDeclarationDetail(propositionId, inclureBrouillons = false) {
  const proposition = await prisma.proposition.findUnique({
    where: { id: propositionId },
    include: {
      candidat: true,
      analyses: {
        where: inclureBrouillons ? { statut: { not: "corbeille" } } : { statut: "publie" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!proposition) return null;

  const analyse = proposition.analyses[0] ?? null;

  const feedbackCounts = analyse
    ? await (async () => {
        const [likes, dislikes] = await Promise.all([
          prisma.feedback.count({
            where: { analyseId: analyse.id, type: "like" },
          }),
          prisma.feedback.count({
            where: { analyseId: analyse.id, type: "dislike" },
          }),
        ]);
        return { likes, dislikes };
      })()
    : { likes: 0, dislikes: 0 };

  // Vote sur la mesure elle-même (d'accord / pas d'accord), distinct du
  // feedback sur la qualité de l'analyse ci-dessus — rattaché à la
  // Proposition, pas à l'Analyse (voir prisma/schema.prisma, VoteMesure).
  const [accord, desaccord] = await Promise.all([
    prisma.voteMesure.count({ where: { propositionId: proposition.id, type: "accord" } }),
    prisma.voteMesure.count({ where: { propositionId: proposition.id, type: "desaccord" } }),
  ]);
  const voteMesureCounts = { accord, desaccord };

  return {
    id: proposition.id,
    titre: displayTitle(proposition),
    texteOriginal: proposition.texteOriginal,
    theme: themeLabel(proposition.theme),
    dateLabel: dateFormatter.format(proposition.dateDeclaration),
    // Date brute (ISO via Date), pour le JSON-LD ClaimReview de la fiche —
    // dateLabel ci-dessus est déjà formatée pour l'affichage, pas exploitable
    // telle quelle en donnée structurée.
    dateDeclaration: proposition.dateDeclaration,
    candidat: proposition.candidat,
    analyse,
    // Date de génération affichée en haut de la fiche ("Perlimpinpin
    // {version} · généré le ..."), à partir de analyse.createdAt — distincte
    // de dateLabel ci-dessus, qui est la date de la déclaration elle-même.
    generationDateLabel: analyse ? dateChiffresFormatter.format(analyse.createdAt) : null,
    feedbackCounts,
    voteMesureCounts,
  };
}
