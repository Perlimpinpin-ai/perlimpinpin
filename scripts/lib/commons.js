// Recherche de photos de candidats sur Wikimedia Commons : lecture des
// réponses de l'API, filtres de licence et de taille, tri, et réécriture de
// la bibliothèque src/lib/photos-candidats.js. Fonctions PURES (les appels
// réseau sont faits par scripts/chercher-photos-candidats.js), testées par
// scripts/carrousel-detaille.test.js.

export const API_COMMONS = "https://commons.wikimedia.org/w/api.php";
export const LARGEUR_MIN = 800;
export const CANDIDATES_MAX = 20;
export const CANDIDATES_MIN = 15;
export const REPERE_DEBUT = "// DEBUT LISTE PHOTOS";
export const REPERE_FIN = "// FIN LISTE PHOTOS";

// User-Agent demandé par Wikimedia : nom du projet et un contact. Le contact
// par défaut est le site ; WIKIMEDIA_CONTACT (une adresse e-mail) le remplace.
export function userAgent(contact = process.env.WIKIMEDIA_CONTACT) {
  return `Perlimpinpin-carrousels/1.0 (${contact || "https://perlimpinpin.ai"}) Node.js`;
}

// Texte brut d'une valeur extmetadata (souvent du HTML : liens, balises).
export function texteBrut(valeur) {
  return String(valeur ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Licence libre acceptée : CC0, domaine public, CC BY, CC BY-SA (toutes
// versions). Renvoie le nom court normalisé, ou null (refusée).
export function licenceAcceptee(nomCourt) {
  const n = texteBrut(nomCourt);
  if (/^cc0\b/i.test(n)) return "CC0";
  if (/^(public domain|domaine public|pd\b)/i.test(n)) return "Domaine public";
  const m = n.match(/^cc[ -]by(-sa)?[ -](\d(?:\.\d)?)/i);
  if (m) return `CC BY${m[1] ? "-SA" : ""} ${m[2]}`;
  if (/^cc[ -]by(-sa)?$/i.test(n)) return n.toUpperCase().replace(/-/g, " ").replace("BY SA", "BY-SA");
  return null;
}

// Pages de l'API (generator + prop=imageinfo&iiprop=url|size|mime|extmetadata)
// → photos candidates : licence libre, ≥ 800 px de large, auteur et licence
// clairs, JPEG ou PNG. Renvoie { candidates, ecartees: [{ titre, raison }] }.
export function candidatesDepuisPages(pages, { slug, nom }) {
  const candidates = [];
  const ecartees = [];
  for (const page of pages ?? []) {
    const info = page?.imageinfo?.[0];
    const titre = String(page?.title ?? "");
    if (!info) continue;
    const meta = info.extmetadata ?? {};
    const licence = licenceAcceptee(meta.LicenseShortName?.value);
    const auteur = texteBrut(meta.Artist?.value);
    const ecarter = (raison) => ecartees.push({ titre, raison });
    if (!/^image\/(jpeg|png)$/.test(info.mime ?? "")) ecarter(`format ${info.mime ?? "inconnu"}`);
    else if (!licence) ecarter(`licence « ${texteBrut(meta.LicenseShortName?.value) || "absente"} »`);
    else if (!auteur || /^unknown|inconnu/i.test(auteur)) ecarter("auteur absent");
    else if ((info.width ?? 0) < LARGEUR_MIN) ecarter(`${info.width} px de large`);
    else {
      candidates.push({
        id: `commons-${page.pageid}`,
        slug,
        titre: titre.replace(/^File:/, ""),
        lien: info.descriptionurl,
        original: info.url,
        apercu: info.thumburl ?? info.url,
        largeur: info.width,
        hauteur: info.height,
        auteur,
        licence,
        lienLicence: texteBrut(meta.LicenseUrl?.value) || null,
        creditCommons: texteBrut(meta.Credit?.value) || null,
        date: texteBrut(meta.DateTimeOriginal?.value) || null,
        score: scorePhoto({ titre, largeur: info.width, hauteur: info.height, nom }),
      });
    }
  }
  return { candidates, ecartees };
}

function sansAccents(t) {
  return String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// Priorité d'une photo : le nom du candidat dans le titre (portrait probable),
// cadrage vertical ou carré (portrait plutôt que scène), pas un titre de
// groupe, d'événement sportif, de bâtiment ou de statue.
export function scorePhoto({ titre, largeur, hauteur, nom }) {
  const t = sansAccents(titre).replace(/^file:/, "");
  const nomFamille = sansAccents(String(nom ?? "").split(/\s+/).at(-1));
  let score = 0;
  const complet = sansAccents(nom);
  if (nomFamille && t.includes(nomFamille)) score += 3;
  if (complet && t.startsWith(complet)) score += 3;
  if (hauteur >= largeur * 0.95) score += 2;
  if (largeur > hauteur * 2) score -= 2;
  if (/portrait|interview|meeting|conference|debat|speech|discours/.test(t)) score += 1;
  if (/\b(podium|statue|siege|pole|ceremony|ceremonie|parade|champions|vs|final|team|equipe|stade|arena|dojo|perde|defeating|leva|rue|plaque|avenue|gymnase|ecole|college)\b/.test(t)) score -= 4;
  return score;
}

// Série de photos d'un même reportage : le titre sans ses nombres.
export function serieDe(titre, nom = "") {
  return sansAccents(titre).replace(/^file:/, "").replace(sansAccents(nom), "").replace(/\.(jpe?g|png)$/, "").replace(/[\d()_-]+/g, " ").replace(/\s+/g, " ").trim();
}

// Les 15 à 20 meilleures, sans doublon, 2 au plus par série (pour varier).
export function meilleuresCandidates(candidates, max = CANDIDATES_MAX, parSerie = 2, nom = "") {
  const vues = new Set();
  const series = new Map();
  return [...candidates]
    .filter((c) => !vues.has(c.id) && vues.add(c.id))
    .sort((a, b) => b.score - a.score || b.largeur - a.largeur)
    .filter((c) => {
      const serie = serieDe(c.titre, nom);
      // Titre réduit au nom du candidat et à des numéros : photos distinctes.
      if (serie.length < 6) return true;
      series.set(serie, (series.get(serie) ?? 0) + 1);
      return series.get(serie) <= parSerie;
    })
    .slice(0, max);
}

// Entrées de la bibliothèque pour les photos retenues d'un candidat,
// numérotées à la suite de celles déjà présentes.
export function entreesPhotos(slug, retenues, existantes = []) {
  const deja = existantes.filter((p) => p.slug === slug);
  const ids = new Set(deja.map((p) => p.id));
  let n = deja.reduce((max, p) => Math.max(max, p.n), 0);
  return retenues
    .filter((c) => !ids.has(c.id))
    .map((c) => {
      n += 1;
      return {
        id: c.id,
        slug,
        n,
        fichier: `carrousel/candidats/${slug}/${n}.png`,
        source: "Wikimedia Commons",
        titre: c.titre,
        auteur: c.auteur,
        licence: c.licence,
        lienLicence: c.lienLicence,
        lien: c.lien,
        modification: "photo modifiée : détourage, noir et blanc",
      };
    });
}

// Source de src/lib/photos-candidats.js avec la liste réécrite entre les repères.
export function reecrireListePhotos(source, photos) {
  const debut = source.indexOf(REPERE_DEBUT);
  const fin = source.indexOf(REPERE_FIN);
  if (debut < 0 || fin < 0) throw new Error("Repères de la liste introuvables dans src/lib/photos-candidats.js.");
  const corps = photos.length ? `export const PHOTOS_CANDIDATS = [\n${photos.map((p) => `  ${JSON.stringify(p)},`).join("\n")}\n];` : "export const PHOTOS_CANDIDATS = [];";
  return `${source.slice(0, debut)}${REPERE_DEBUT}\n${corps}\n${source.slice(fin)}`;
}
