import { motCleNormalise, THEMES_ILLUSTRATIONS } from "../../src/lib/illustrations.js";

// Fonctions PURES du remplissage de la bibliothèque d'illustrations
// (scripts/chercher-illustrations.js, page /test/illustrations). Testées par
// scripts/illustrations.test.js.

export const CANDIDATES_PAR_THEME = 20;
export const REPERE_DEBUT = "// DEBUT LISTE ILLUSTRATIONS";
export const REPERE_FIN = "// FIN LISTE ILLUSTRATIONS";

// Nombre de résultats demandés par requête pour arriver à ~20 candidates.
export function parRequete(theme) {
  const n = THEMES_ILLUSTRATIONS[theme]?.requetes.length ?? 1;
  return Math.ceil(CANDIDATES_PAR_THEME / n);
}

// Candidates d'un thème à partir des réponses de l'API Pexels (une par
// requête, dans l'ordre des requêtes du thème). Doublons retirés, 20 au plus,
// alternées entre requêtes pour garder de la variété.
// Réponse Pexels : { photos: [{ id, url, photographer, photographer_url, alt, src: { medium, large2x, original } }] }
export function candidatesDepuisPexels(theme, reponses) {
  const requetes = THEMES_ILLUSTRATIONS[theme]?.requetes ?? [];
  const listes = requetes.map(([requete, motCle], i) =>
    (reponses[i]?.photos ?? []).map((photo) => ({
      id: `pexels-${photo.id}`,
      requete,
      motCle,
      apercu: photo.src?.medium ?? photo.src?.large ?? "",
      telechargement: photo.src?.large2x ?? photo.src?.original ?? "",
      description: photo.alt ?? "",
      auteur: photo.photographer ?? "",
      lienAuteur: photo.photographer_url ?? "",
      lien: photo.url ?? "",
      source: "Pexels",
      licence: "Licence Pexels",
    })),
  );
  const vues = new Set();
  const resultat = [];
  for (let rang = 0; resultat.length < CANDIDATES_PAR_THEME && listes.some((l) => l.length > rang); rang++) {
    for (const liste of listes) {
      const c = liste[rang];
      if (!c || vues.has(c.id) || resultat.length >= CANDIDATES_PAR_THEME) continue;
      vues.add(c.id);
      resultat.push(c);
    }
  }
  return resultat;
}

// Candidates factices (recherche simulée, sans appel) : aperçus dessinés en
// SVG, clairement marqués « simulation ». Jamais téléchargées.
export function candidatesSimulees(theme) {
  const requetes = THEMES_ILLUSTRATIONS[theme]?.requetes ?? [];
  return Array.from({ length: CANDIDATES_PAR_THEME }, (_, i) => {
    const [requete, motCle] = requetes[i % requetes.length] ?? ["(simulation)", "simulation"];
    const teinte = (i * 47) % 360;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="220"><rect width="320" height="220" fill="hsl(${teinte},35%,72%)"/><circle cx="${80 + (i % 5) * 40}" cy="110" r="${30 + (i % 3) * 14}" fill="hsl(${teinte},40%,45%)"/><text x="12" y="204" font-family="sans-serif" font-size="15" fill="#222">simulation · ${requete}</text></svg>`;
    return {
      id: `simulation-${theme}-${i + 1}`,
      requete,
      motCle,
      apercu: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`,
      telechargement: "",
      description: `Candidate simulée ${i + 1}`,
      auteur: "(simulation)",
      lienAuteur: "",
      lien: "",
      source: "Simulation",
      licence: "Licence Pexels",
      simulation: true,
    };
  });
}

// Entrées de la bibliothèque à partir des candidates retenues : un fichier
// public/illustrations/<thème>/<mot-clé>.jpg par image, suffixé -2, -3… si
// le mot-clé est déjà pris (dans la liste existante ou la sélection).
export function entreesBibliotheque(theme, retenues, existantes = []) {
  const pris = new Set(existantes.map((e) => e.fichier));
  const entrees = [];
  for (const c of retenues) {
    if (c.simulation || !c.telechargement) continue;
    if (existantes.some((e) => e.lien && e.lien === c.lien)) continue;
    const mot = motCleNormalise(c.motCle) || "image";
    let fichier = `illustrations/${theme}/${mot}.jpg`;
    for (let n = 2; pris.has(fichier); n++) fichier = `illustrations/${theme}/${mot}-${n}.jpg`;
    pris.add(fichier);
    const motsCles = [...new Set([mot, ...(c.motsClesEnPlus ?? []).map(motCleNormalise)].filter(Boolean))];
    entrees.push({
      fichier,
      theme,
      motsCles,
      source: c.source,
      auteur: c.auteur,
      licence: c.licence,
      lien: c.lien,
      ...(c.description ? { description: String(c.description).slice(0, 200) } : {}),
      telechargement: c.telechargement,
    });
  }
  return entrees;
}

// Réécrit le tableau ILLUSTRATIONS de src/lib/illustrations.js entre les deux
// repères (le reste du fichier est gardé tel quel).
export function reecrireListe(source, entrees) {
  const debut = source.indexOf(REPERE_DEBUT);
  const fin = source.indexOf(REPERE_FIN);
  if (debut < 0 || fin < debut) throw new Error("Repères de la liste introuvables dans src/lib/illustrations.js.");
  const propres = entrees.map(({ fichier, theme, motsCles, source: src, auteur, licence, lien, description }) => ({ fichier, theme, motsCles, source: src, auteur, licence, lien, ...(description ? { description } : {}) }));
  const tableau = propres.length ? `[\n${propres.map((e) => `  ${JSON.stringify(e)},`).join("\n")}\n]` : "[]";
  return `${source.slice(0, debut)}${REPERE_DEBUT}\nexport const ILLUSTRATIONS = ${tableau};\n${source.slice(fin)}`;
}
