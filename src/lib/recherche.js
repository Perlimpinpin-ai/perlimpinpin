import MiniSearch from "minisearch";

// Moteur de recherche des propositions analysées (barre de recherche de la
// page d'accueil, en temps réel côté navigateur, et page /declarations?q=...
// côté serveur). Aucune IA, aucun appel réseau : tout tient en mémoire.
//
// Pourquoi MiniSearch et pas Fuse.js : Fuse compare la requête à chaque champ
// pris comme un seul bloc de texte, ce qui classe mal les requêtes de
// plusieurs mots (« prix carburant », « retraite 64 »). MiniSearch découpe le
// texte en mots (index inversé), tolère les fautes mot par mot, gère les
// débuts de mots pendant la frappe et classe avec BM25 (le classement des
// moteurs de recherche classiques), avec des poids par champ.
//
// Pipeline d'un mot (identique à l'indexation et à la recherche) :
// minuscules + accents retirés (normaliser) -> petits mots ignorés
// (MOTS_VIDES) -> pluriel simple retiré (racine).

// Petits mots ignorés (« prix du carburant » -> « prix », « carburant »).
const MOTS_VIDES = new Set([
  "le", "la", "les", "de", "du", "des", "un", "une", "et", "ou", "a", "au",
  "aux", "en", "pour", "par", "sur", "dans", "avec", "sans", "d", "l", "qu",
  "que", "qui", "son", "sa", "ses", "ce", "cette", "ces", "il", "elle", "est",
]);

// Quelques familles de mots courants, volontairement courtes : un document
// qui contient l'un des mots est aussi trouvé avec les autres (« essence »
// trouve une mesure sur le « carburant »). Écrire les mots sans accent, au
// singulier. Ajouter une famille seulement si une vraie recherche échoue.
const SYNONYMES = [
  ["carburant", "essence", "diesel", "gazole", "pompe"],
  ["retraite", "pension", "depart"],
  ["logement", "loyer", "immobilier", "habitation", "locataire"],
  ["salaire", "smic", "remuneration"],
  ["impot", "fiscalite", "taxe", "prelevement"],
  ["immigration", "immigre", "etranger", "migrant"],
  ["sante", "hopital", "soin", "medical"],
  ["ecole", "education", "enseignant", "professeur", "eleve"],
  ["energie", "electricite"],
  ["chomage", "emploi"],
];

// Champs indexés et leur poids dans le classement. `corps` = mots de tout le
// texte de l'analyse (voir motsDuCorps) : poids faible, pour qu'un mot présent
// seulement au fond d'une analyse (« prison ») la fasse trouver, mais toujours
// après les mesures dont c'est le sujet (titre, résumé).
const POIDS = { titre: 4, candidat: 3, theme: 2, motsLies: 1, resume: 1, texte: 0.7, corps: 0.3 };

// Nombre maximal de suggestions affichées sous la barre.
export const LIMITE_SUGGESTIONS = 4;

// « Énergie & Climat » -> « energie climat »
export function normaliser(texte) {
  return String(texte ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Pluriels simples : « carburants » -> « carburant », « impots » -> « impot ».
function racine(mot) {
  return mot.length > 4 && /[sx]$/.test(mot) ? mot.slice(0, -1) : mot;
}

// Mot normalisé -> mot indexé, ou null s'il est à ignorer.
function traiterMot(mot) {
  if (!mot || MOTS_VIDES.has(mot)) return null;
  if (mot.length < 2) return null;
  return racine(mot);
}

// Mots utiles d'un texte, dans l'ordre (sert aussi aux tests).
export function motsCles(texte) {
  return normaliser(texte).split(" ").map(traiterMot).filter(Boolean);
}

// Mots utiles d'un long texte, sans doublons ni nombres seuls, en une chaîne
// (« corps » d'un document). Dédoublonner garde l'index léger et évite qu'une
// longue analyse qui répète un mot passe devant une mesure dont c'est le sujet.
export function motsDuCorps(texte) {
  return [...new Set(motsCles(texte).filter((mot) => !/^\d+$/.test(mot)))].join(" ");
}

const FAMILLE_DU_MOT = new Map(
  SYNONYMES.flatMap((famille) => famille.map((mot) => [mot, famille])),
);

// Synonymes à ajouter à un document : les autres mots des familles dont il
// contient au moins un mot.
function motsLies(textes) {
  const presents = new Set(motsCles(textes.join(" ")));
  const lies = new Set();
  for (const mot of presents) {
    for (const autre of FAMILLE_DU_MOT.get(mot) ?? []) {
      if (!presents.has(autre)) lies.add(autre);
    }
  }
  return [...lies].join(" ");
}

const OPTIONS_RECHERCHE = {
  boost: POIDS,
  combineWith: "OR",
  // Début de mot accepté pendant la frappe (« carbu » -> « carburant »).
  prefix: (mot) => mot.length >= 3,
  // Fautes de frappe : 1 lettre d'écart jusqu'à 7 lettres, 2 au-delà.
  fuzzy: (mot) => (mot.length >= 4 ? 0.2 : false),
};

// Crée le moteur à partir de documents de la forme
// { id, titre, candidat, theme, resume, texte, corps?, ...autres champs libres }.
// `id` doit être unique (on utilise l'id de l'analyse). Les autres champs
// (score, lien...) sont rendus tels quels avec les résultats.
export function creerMoteur(documents) {
  const parId = new Map(documents.map((doc) => [doc.id, doc]));

  const index = new MiniSearch({
    fields: Object.keys(POIDS),
    idField: "id",
    tokenize: (texte) => normaliser(texte).split(" "),
    processTerm: traiterMot,
    searchOptions: OPTIONS_RECHERCHE,
  });

  index.addAll(
    documents.map((doc) => ({
      id: doc.id,
      titre: doc.titre,
      candidat: doc.candidat,
      theme: doc.theme,
      resume: doc.resume,
      texte: doc.texte,
      corps: doc.corps ?? "",
      motsLies: motsLies([doc.titre, doc.theme, doc.resume, doc.texte]),
    })),
  );

  // Petit index séparé des thèmes et des candidats, pour proposer un
  // raccourci « Thème » ou « Candidat » en tête des suggestions.
  const raccourcis = new MiniSearch({
    fields: ["libelle"],
    storeFields: ["type", "libelle"],
    idField: "cle",
    tokenize: (texte) => normaliser(texte).split(" "),
    processTerm: traiterMot,
  });
  const vus = new Set();
  for (const doc of documents) {
    for (const [type, libelle] of [["theme", doc.theme], ["candidat", doc.candidat]]) {
      const cle = `${type}:${libelle}`;
      if (!libelle || vus.has(cle)) continue;
      vus.add(cle);
      raccourcis.add({ cle, type, libelle });
    }
  }

  // Documents les plus pertinents pour `requete`, du plus au moins
  // pertinent. Le score de pertinence sert uniquement au classement.
  function rechercher(requete, limite = LIMITE_SUGGESTIONS) {
    if (motsCles(requete).length === 0) return [];
    const resultats = index.search(requete);
    if (resultats.length === 0) return [];
    // On écarte la « traîne » très peu pertinente (un seul mot proche
    // trouvé au fond d'un long texte, par exemple).
    const seuil = resultats[0].score * 0.2;
    return resultats
      .filter((resultat) => resultat.score >= seuil)
      .slice(0, limite)
      .map((resultat) => parId.get(resultat.id));
  }

  // Thème ou candidat dont le nom correspond à TOUS les mots tapés
  // (« immigration » -> thème Immigration, « melenchon » -> candidat), ou null.
  function raccourci(requete) {
    if (motsCles(requete).length === 0) return null;
    const [meilleur] = raccourcis.search(requete, {
      combineWith: "AND",
      prefix: (mot) => mot.length >= 3,
      fuzzy: (mot) => (mot.length >= 4 ? 0.2 : false),
    });
    return meilleur ? { type: meilleur.type, libelle: meilleur.libelle } : null;
  }

  return {
    rechercher,
    raccourci,
    // Suggestions de la barre : un raccourci éventuel puis les propositions,
    // `limite` lignes au total.
    suggestions(requete, limite = LIMITE_SUGGESTIONS) {
      const tete = raccourci(requete);
      return {
        raccourci: tete,
        propositions: rechercher(requete, tete ? limite - 1 : limite),
      };
    },
  };
}
