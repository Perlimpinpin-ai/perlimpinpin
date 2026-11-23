import test from "node:test";
import assert from "node:assert/strict";
import { choisirEnRotation, cleSuivante } from "../src/lib/rotation-images.js";
import { bilanBanque, choisirImageTheme, choisirPhotoCandidat, historiqueImages, licenceAutorisee, problemesCredit } from "../src/lib/banque-images.js";
import { choisirIllustration, creditLegende, creditVisible, illustrationsPourFiche } from "../src/lib/illustrations.js";
import { creditsPhoto } from "../src/lib/photos-candidats.js";
import { entreesDepot, estPhotoDeTheme, meilleuresPropositions, propositionsThemeDepuisPages } from "./lib/commons.js";

// Banque d'images des couvertures : rotation (exclusion des 2 derniers
// carrousels, sinon la moins récemment utilisée), dossier de secours,
// historique lu en base, crédits, propositions Commons et dépôt manuel.

const ill = (theme, nom, licence = "CC BY-SA 4.0") => ({
  fichier: `illustrations/${theme}/${nom}.jpg`,
  theme,
  motsCles: [nom],
  source: "Wikimedia Commons",
  auteur: `Auteur ${nom}`,
  licence,
  lien: `https://commons.wikimedia.org/wiki/File:${nom}.jpg`,
});
const BIBLIO = [ill("sante", "a"), ill("sante", "b"), ill("sante", "c"), ill("sante", "d"), ill("general", "secours", "CC0"), ill("retraites", "banc"), ill("retraites", "mains")];
const photo = (n) => ({ id: `p${n}`, slug: "marine-le-pen", n, fichier: `carrousel/candidats/marine-le-pen/${n}.png`, auteur: `A${n}`, licence: "CC BY 2.0", lien: `https://commons.wikimedia.org/wiki/File:${n}` });
const PHOTOS = [photo(1), photo(2), photo(3)];
const f = (nom, theme = "sante") => `illustrations/${theme}/${nom}.jpg`;

test("rotation : les images des 2 derniers carrousels sont écartées, quel que soit le tirage", () => {
  for (const alea of [0, 0.3, 0.6, 0.99]) {
    const choisie = choisirImageTheme("sante", [f("a"), f("b")], { alea, liste: BIBLIO });
    assert.ok([f("c"), f("d")].includes(choisie.fichier), `alea ${alea} : ${choisie.fichier}`);
  }
  // Le 3e carrousel en arrière ne compte plus : « c » redevient possible.
  const possibles = new Set([0, 0.5, 0.99].map((alea) => choisirImageTheme("sante", [f("a"), f("b"), f("c")], { alea, liste: BIBLIO }).fichier));
  assert.ok(possibles.has(f("c")));
  assert.ok(!possibles.has(f("a")) && !possibles.has(f("b")));
});

test("rotation : toutes utilisées récemment → la moins récemment utilisée", () => {
  const deux = BIBLIO.filter((i) => i.theme === "retraites");
  assert.equal(choisirImageTheme("retraites", [f("mains", "retraites"), f("banc", "retraites")], { liste: deux }).fichier, f("banc", "retraites"));
  assert.equal(choisirImageTheme("retraites", [f("banc", "retraites"), f("mains", "retraites")], { liste: deux }).fichier, f("mains", "retraites"));
  // Une seule image : toujours elle.
  assert.equal(choisirEnRotation(["x"], { recentes: ["x", "x"] }), "x");
  assert.equal(choisirEnRotation([], { recentes: [] }), null);
});

test("rotation : sur une suite de carrousels, jamais une image des 2 précédents", () => {
  const historique = [];
  for (let i = 0; i < 12; i++) {
    const choisie = choisirImageTheme("sante", historique, { alea: (i * 0.37) % 1, liste: BIBLIO }).fichier;
    assert.ok(!historique.slice(0, 2).includes(choisie), `carrousel ${i} : ${choisie} déjà dans ${historique.slice(0, 2)}`);
    historique.unshift(choisie);
  }
  assert.ok(new Set(historique).size >= 3, "les images tournent");
});

test("dossier de secours : thème sans image ou inconnu → images de « general », avec avertissement", () => {
  const r = choisirIllustration({ theme: "logement", liste: BIBLIO });
  assert.equal(r.illustration.fichier, f("secours", "general"));
  assert.match(r.avertissement, /secours/);
  assert.equal(choisirIllustration({ theme: "theme-inconnu", liste: BIBLIO }).illustration.fichier, f("secours", "general"));
  assert.deepEqual(illustrationsPourFiche("Santé & Hôpital", BIBLIO).length, 4);
  // Bibliothèque vide, secours compris : pas d'image, un avertissement.
  const vide = choisirIllustration({ theme: "sante", liste: [] });
  assert.equal(vide.illustration, null);
  assert.match(vide.avertissement, /npm run banque-images:themes/);
});

test("mots-clés du modèle : préférés tant qu'une de leurs images est libre", () => {
  assert.equal(choisirIllustration({ theme: "sante", motsCles: ["c"], liste: BIBLIO }).illustration.fichier, f("c"));
  const r = choisirIllustration({ theme: "sante", motsCles: ["c"], recentes: [f("c")], liste: BIBLIO });
  assert.notEqual(r.illustration.fichier, f("c"));
});

test("« Changer d'image » : le fichier demandé est pris s'il fait partie des images de la fiche", () => {
  assert.equal(choisirIllustration({ theme: "sante", demandee: f("d"), recentes: [f("d")], liste: BIBLIO }).illustration.fichier, f("d"));
  assert.notEqual(choisirIllustration({ theme: "sante", demandee: f("banc", "retraites"), liste: BIBLIO }).illustration.theme, "retraites");
  assert.equal(cleSuivante(["a", "b", "c"], "a"), "b");
  assert.equal(cleSuivante(["a", "b", "c"], "c"), "a");
  assert.equal(cleSuivante(["a", "b", "c"], "a", ["b"]), "c");
  assert.equal(cleSuivante([], "a"), null);
});

test("photos du candidat : hors des 2 derniers carrousels, la retenue et la demandée passent avant", () => {
  for (const graine of ["x", "y", "z", "w"]) {
    assert.equal(choisirPhotoCandidat("marine-le-pen", [1, 2], { graine, liste: PHOTOS }).n, 3);
  }
  assert.equal(choisirPhotoCandidat("marine-le-pen", [3, 1, 2], { liste: PHOTOS }).n, 2);
  assert.equal(choisirPhotoCandidat("inconnu", [], { liste: PHOTOS }), null);
});

test("historique : lu depuis contenuComplet.reseaux_recit, le plus récent d'abord, par thème et par candidat", () => {
  const lignes = [
    { theme: "Santé & Hôpital", candidatNom: "Marine Le Pen", photoUrl: "/photos/marine-le-pen.jpg", illustration: f("a"), photo: "1", genereLe: "2026-11-01T10:00:00Z" },
    { theme: "sante", candidatNom: "Fabien Roussel", photoUrl: "/photos/fabien-roussel.jpg", illustration: f("b"), photo: "2", genereLe: "2026-11-03T10:00:00Z" },
    { theme: "Retraites", candidatNom: "Marine Le Pen", photoUrl: "/photos/marine-le-pen.jpg", illustration: f("banc", "retraites"), photo: "3", genereLe: "2026-11-02T10:00:00Z" },
    { theme: "sante", candidatNom: "Marine Le Pen", photoUrl: "/photos/marine-le-pen.jpg", illustration: null, photo: null, updatedAt: "2026-11-04T10:00:00Z" },
  ];
  assert.deepEqual(historiqueImages(lignes, { theme: "sante", slug: "marine-le-pen" }), { illustrations: [f("b"), f("a")], photos: [3, 1] });
  assert.deepEqual(historiqueImages([], { theme: "sante", slug: "x" }), { illustrations: [], photos: [] });
});

test("crédits : « Photo : auteur, licence, Wikimedia Commons » en légende ; visible seulement pour CC BY / CC BY-SA", () => {
  assert.equal(creditVisible(ill("sante", "a")), "Photo : Auteur a, CC BY-SA 4.0, Wikimedia Commons");
  assert.equal(creditVisible(ill("sante", "a", "CC0")), null);
  assert.equal(creditVisible({ ...ill("sante", "a", "Licence Pexels"), source: "Pexels" }), null);
  assert.equal(creditLegende(ill("sante", "a")), "Photo : Auteur a, CC BY-SA 4.0, Wikimedia Commons https://commons.wikimedia.org/wiki/File:a.jpg");
  assert.equal(creditsPhoto(photo(1)).court, "Photo : A1, CC BY 2.0, Wikimedia Commons");
});

test("contrôle de la banque : manques, crédits incomplets, licence refusée, fichier absent", () => {
  assert.ok(licenceAutorisee("CC BY-SA 3.0") && licenceAutorisee("CC0") && licenceAutorisee("Domaine public"));
  assert.ok(!licenceAutorisee("CC BY-NC 4.0") && !licenceAutorisee("Tous droits réservés"));
  assert.deepEqual(problemesCredit({ auteur: "", licence: "CC BY-NC 4.0", lien: "" }), ["auteur manquant", "licence « CC BY-NC 4.0 » non autorisée", "page source (lien) manquante"]);
  const bilan = bilanBanque({
    illustrations: [...BIBLIO, { ...ill("retraites", "sans-auteur"), auteur: "" }],
    photos: PHOTOS,
    themes: ["sante", "retraites", "logement"],
    slugs: ["marine-le-pen", "fabien-roussel"],
    existe: (chemin) => !chemin.includes("/d."),
  });
  const parSlug = Object.fromEntries([...bilan.themes, ...bilan.candidats].map((l) => [l.slug, l]));
  assert.equal(parSlug.sante.manque, 0);
  assert.match(parSlug.sante.problemes.join(), /fichier absent/);
  assert.match(parSlug.retraites.problemes.join(), /auteur manquant/);
  assert.equal(parSlug.logement.manque, 3);
  assert.equal(parSlug["marine-le-pen"].manque, 0);
  assert.equal(parSlug["fabien-roussel"].manque, 3);
  assert.equal(bilan.ok, false);
});

test("propositions Commons : photo JPEG, licence libre, ≥ 1600 px, auteur, ni logo, ni carte, ni personnalité politique", () => {
  const page = (id, titre, { mime = "image/jpeg", width = 2000, licence = "CC BY-SA 4.0", auteur = "Jean Photo" } = {}) => ({
    pageid: id,
    title: `File:${titre}`,
    imageinfo: [{ mime, width, height: 1300, url: `https://upload/${id}.jpg`, thumburl: `https://upload/640/${id}.jpg`, descriptionurl: `https://commons.wikimedia.org/wiki/File:${id}`, extmetadata: { LicenseShortName: { value: licence }, Artist: { value: `<a href="x">${auteur}</a>` } } }],
  });
  const pages = [
    page(1, "Couloir hôpital.jpg"),
    page(2, "Couloir petit.jpg", { width: 1200 }),
    page(3, "Logo hôpital.jpg"),
    page(4, "Carte des hôpitaux.jpg"),
    page(5, "Couloir NC.jpg", { licence: "CC BY-NC 4.0" }),
    page(6, "Schema.png", { mime: "image/png" }),
    page(7, "Marine Le Pen à l'hôpital.jpg"),
    page(8, "Visite du ministre.jpg"),
    page(9, "Couloir anonyme.jpg", { auteur: "" }),
  ];
  const { propositions, ecartees } = propositionsThemeDepuisPages(pages, { theme: "sante", requete: "couloir", motCle: "hopital", nomsCandidats: ["Marine Le Pen"] });
  assert.deepEqual(propositions.map((p) => p.id), ["commons-1"]);
  assert.equal(ecartees.length, 8);
  assert.deepEqual({ auteur: propositions[0].auteur, licence: propositions[0].licence, source: propositions[0].source }, { auteur: "Jean Photo", licence: "CC BY-SA 4.0", source: "Wikimedia Commons" });
  assert.ok(estPhotoDeTheme("File:Wheat field.jpg") && !estPhotoDeTheme("File:Flag of France.jpg"));
  assert.deepEqual(meilleuresPropositions([[{ id: 1 }, { id: 2 }], [{ id: 2 }, { id: 3 }]], 3).map((p) => p.id), [1, 2, 3]);
});

test("dépôt manuel des photos d'un candidat : crédits complets exigés, numérotation à la suite", () => {
  const credits = {
    photos: [
      { fichier: "1.jpg", auteur: "Anne Photo", licence: "CC BY-SA 4.0", source: "https://commons.wikimedia.org/wiki/File:MLP_2024.jpg", description: "Portrait" },
      { fichier: "2.jpg", auteur: "", licence: "CC BY 2.0", source: "https://commons.wikimedia.org/wiki/File:B.jpg" },
      { fichier: "3.jpg", auteur: "X", licence: "CC BY-NC 2.0", source: "https://commons.wikimedia.org/wiki/File:C.jpg" },
      { fichier: "4.jpg", auteur: "X", licence: "CC0", source: "https://exemple.fr/photo" },
      { fichier: "absente.jpg", auteur: "X", licence: "CC0", source: "https://commons.wikimedia.org/wiki/File:D.jpg" },
      { fichier: "1.jpg", auteur: "", licence: "", source: "", description: "" },
    ],
  };
  const { nouvelles, refusees } = entreesDepot("marine-le-pen", credits, ["1.jpg", "2.jpg", "3.jpg", "4.jpg"], [photo(1), photo(2)]);
  assert.equal(nouvelles.length, 1);
  assert.equal(nouvelles[0].n, 3);
  assert.equal(nouvelles[0].fichier, "carrousel/candidats/marine-le-pen/3.png");
  assert.equal(nouvelles[0].depot, "1.jpg");
  assert.deepEqual(refusees.map((r) => r.fichier), ["2.jpg", "3.jpg", "4.jpg", "absente.jpg"]);
});
