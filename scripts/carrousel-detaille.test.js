// Carrousel détaillé v6 (docs/prompt-carrousel.md) : contrôles ajoutés au
// texte du modèle, couleurs, légende, mise en page mesurée, check-list.
import { test } from "node:test";
import assert from "node:assert/strict";
import { contientConditionnel, controlerRecit, nommeCandidat, phrasesTropLongues, tournuresIA, TOURNURES_IA } from "../src/lib/recit.js";
import { carrouselRecit, controleHashtags, hashtagsDe, legendeRecit, listeARelire } from "../src/lib/carrousel-recit.js";
import { COULEURS_CARROUSEL_CANDIDATS, couleurCarrousel, memeCouleurQueDerniers } from "../src/lib/couleurs-carrousel.js";
import { couleurDominante, couleursCarrousel, couleursPresqueIdentiques, JAUNE_SURLIGNAGE } from "../src/lib/couleur-dominante.js";
import { contraste, distanceCouleurs } from "../src/lib/couleurs-candidats.js";
import { choisirPhoto, creditsPhoto, photosDuCandidat, photoSuivante } from "../src/lib/photos-candidats.js";
import { candidatesDepuisPages, entreesPhotos, licenceAcceptee, meilleuresCandidates, reecrireListePhotos, REPERE_DEBUT, REPERE_FIN, scorePhoto, texteBrut, userAgent } from "./lib/commons.js";
import { CATEGORIES_COMMONS } from "../src/lib/candidats-commons.js";
import { handleInstagram, handleInstagramVerifie } from "../src/lib/handles-instagram.js";
import { bloc, couperEquilibre, debordementsCarrousel, LARGEUR_UTILE, miseEnPageSlide, STYLES } from "../src/lib/mise-en-page-carrousel.js";
import { mesureurCarrousel } from "../src/lib/metriques-polices.js";
import { CONTEXTE, FICHE, reponse } from "./lib/recit-fixture.js";

const erreurs = (r) => controlerRecit(r, CONTEXTE).erreurs.join("\n");
const avertissements = (r) => controlerRecit(r, CONTEXTE).avertissements.join("\n");

// --- Contrôles du texte -------------------------------------------------------------

test("phrase de plus de 25 mots : avertissement", () => {
  const longue = Array.from({ length: 30 }, (_, i) => (i ? "mot" : "Un")).join(" ") + ".";
  assert.deepEqual(phrasesTropLongues(`Courte. ${longue}`).map((p) => p.mots), [30]);
  const r = reponse();
  r.constat.explication = `Le Smic brut est de 1 830 euros. ${longue}`;
  assert.match(avertissements(r), /slide 2 \(explication\) : phrase de 30 mots \(25 au plus\)/);
});

test("tournures « IA » : avertissement, liste enrichissable, mots entiers", () => {
  assert.deepEqual(tournuresIA("En somme, c'est crucial."), ["en somme", "crucial"]);
  assert.deepEqual(tournuresIA("Il est important de noter que…"), ["il est important de noter"]);
  assert.deepEqual(tournuresIA("Une partie de la somme."), []);
  assert.deepEqual(tournuresIA("Un vrai souci.", ["vrai souci"]), ["vrai souci"]);
  assert.ok(TOURNURES_IA.includes("force est de constater") && TOURNURES_IA.includes("par ailleurs"));
  const r = reponse();
  r.avis.avis = "Par ailleurs, le gain est réel.";
  assert.match(avertissements(r), /notre avis : tournure « par ailleurs »/);
});

test("couverture : note ou verdict → refus ; surlignage 1 à 3, candidat nommé → avertissements", () => {
  for (const question of ["{NOM} veut-il un ==Smic== noté 51 ?", "{NOM} veut-il un ==Smic== à 51 euros ?", "{NOM}, quel ==verdict== pour le Smic ?", "{NOM} : un Smic ==plausible sous condition== ?"]) {
    assert.ok(/couverture|niveau/.test(erreurs(reponse({ couverture: { question } }))), question);
  }
  assert.match(avertissements(reponse({ couverture: { question: "{NOM} veut-il un Smic plus haut ?" } })), /0 mot\(s\) clé\(s\) surligné\(s\)/);
  assert.match(avertissements(reponse({ couverture: { question: "Un ==a== ==b== ==c== ==d== pour {NOM} ?" } })), /4 mot\(s\) clé\(s\)/);
  assert.match(avertissements(reponse({ couverture: { question: "Faut-il un ==Smic à 2 200 euros== ?" } })), /ne nomme pas le candidat/);
});

test("slide 2 : proposition avant le constat ou nom du candidat absent → refus", () => {
  const avant = reponse();
  avant.constat.titre = "{NOM} veut augmenter le Smic.";
  assert.match(erreurs(avant), /slide 2 \(titre\) : la proposition du candidat apparaît avant le constat/);
  const sa = reponse();
  sa.constat.explication = "Sa proposition vise les bas salaires. Le Smic brut est de 1 830 euros.";
  assert.match(erreurs(sa), /slide 2 \(explication\)/);
  const sansNom = reponse();
  sansNom.constat.proposition = "La proposition : porter le Smic à 2 200 euros brut.";
  assert.match(erreurs(sansNom), /slide 2 \(proposition\) : le nom du candidat manque/);
  // « Le Pen » ne se confond pas avec « pension » ; le nom complet suffit.
  assert.equal(nommeCandidat("Les pensions baissent.", "Marine Le Pen"), false);
  assert.equal(nommeCandidat("Le plan de Marine Le Pen.", "Marine Le Pen"), true);
  assert.equal(nommeCandidat("Le plan de Villepin.", "Dominique de Villepin"), true);
});

test("slides 4 et 5 : effet sans conditionnel → avertissement ; slide 3 sans le nom → avertissement", () => {
  assert.ok(contientConditionnel("Le salaire augmenterait."));
  assert.ok(contientConditionnel("Ils pourraient partir."));
  assert.ok(!contientConditionnel("Le salaire augmente, mais jamais vraiment."));
  const r = reponse();
  r.long_terme.effets[1].texte = "Ils sont tirés vers le haut.";
  assert.match(avertissements(r), /slide 5, effet 2 \(Les salaires moyens\) : pas de verbe au conditionnel/);
  const t = reponse();
  t.note.titre = "Facile à décider, plus dur à financer.";
  assert.match(avertissements(t), /slide 3 \(titre\) : le titre d’avis ne nomme pas le candidat/);
});

// --- Couleurs -------------------------------------------------------------------------

test("couleurs : table du candidat { fond, bloc }, 2 derniers carrousels comparés par la couleur", () => {
  assert.ok(Object.values(COULEURS_CARROUSEL_CANDIDATS).every((c) => /^#[0-9A-F]{6}$/i.test(c.fond) && /^#[0-9A-F]{6}$/i.test(c.bloc)));
  assert.deepEqual(couleurCarrousel("teddy riner", { table: { "Teddy Riner": { fond: "#2a62b5", bloc: "#1c2a5e" } } }), { fond: "#2A62B5", bloc: "#1C2A5E" });
  assert.equal(couleurCarrousel("Inconnu"), null);
  assert.equal(couleurCarrousel("A", { table: { A: { fond: "bleu", bloc: "#000000" } } }), null);
  assert.ok(memeCouleurQueDerniers("#2A62B5", ["#2B63B4", "#123456"]));
  assert.ok(!memeCouleurQueDerniers("#2A62B5", ["#B33A2B", "#2F6B35", "#2A62B5"]));
  assert.ok(!memeCouleurQueDerniers(null, ["#2A62B5"]));
});

test("couleur tirée de l'illustration : dominante du fond sans visage ni gris, titre blanc lisible, jamais proche du jaune", () => {
  // Image 40 × 50 : fond rouge, ovale central gris (le visage), coin blanc.
  const L = 40;
  const H = 50;
  const pixels = Buffer.alloc(L * H * 3);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < L; x++) {
      const i = (y * L + x) * 3;
      const dx = (x / L - 0.5) / 0.3;
      const dy = (y / H - 0.48) / 0.42;
      const coin = x < 4 && y < 4;
      const [r, g, b] = coin ? [255, 255, 255] : dx * dx + dy * dy < 1 ? [128, 128, 128] : [190, 60, 45];
      pixels[i] = r;
      pixels[i + 1] = g;
      pixels[i + 2] = b;
    }
  }
  const { couleur } = couleurDominante(pixels, L, H, 3);
  assert.ok(distanceCouleurs(couleur, "#BE3C2D") < 10, couleur);
  assert.equal(couleurDominante(Buffer.alloc(L * H * 3, 128), L, H, 3), null);
  // Fond clair : foncé jusqu'au contraste 4,5:1 avec le blanc ; bloc plus foncé.
  const clair = couleursCarrousel("#EABCB2");
  assert.ok(clair.foncee && clair.contraste >= 4.5);
  assert.ok(contraste(clair.bloc, "#ffffff") > contraste(clair.fond, "#ffffff"));
  // Jaune : jamais gardé tel quel.
  const jaune = couleursCarrousel("#F5D04A");
  assert.ok(distanceCouleurs(jaune.fond, JAUNE_SURLIGNAGE) >= 200 && !jaune.procheJaune);
  assert.deepEqual(
    couleursPresqueIdentiques({ a: { fond: "#1B3756" }, b: { fond: "#183450" }, c: { fond: "#B33A2B" } }).map(([x, y]) => `${x}-${y}`),
    ["a-b"],
  );
});

// --- Photos des candidats (Wikimedia Commons) ---------------------------------------

function page(id, { licence = "CC BY-SA 4.0", auteur = "<a href='x'>Jean Photo</a>", largeur = 2000, hauteur = 2400, mime = "image/jpeg" } = {}) {
  return {
    pageid: id,
    title: `File:Teddy Riner ${id}.jpg`,
    imageinfo: [
      {
        mime,
        width: largeur,
        height: hauteur,
        url: `https://upload.wikimedia.org/o/${id}.jpg`,
        thumburl: `https://upload.wikimedia.org/t/1600px-${id}.jpg`,
        descriptionurl: `https://commons.wikimedia.org/wiki/File:${id}`,
        extmetadata: { LicenseShortName: { value: licence }, Artist: { value: auteur }, LicenseUrl: { value: "https://creativecommons.org/licenses/by-sa/4.0" } },
      },
    ],
  };
}

test("Commons : licences libres seulement, 800 px au moins, auteur et licence clairs, User-Agent", () => {
  assert.equal(licenceAcceptee("CC BY-SA 4.0"), "CC BY-SA 4.0");
  assert.equal(licenceAcceptee("CC BY 2.0"), "CC BY 2.0");
  assert.equal(licenceAcceptee("CC0"), "CC0");
  assert.equal(licenceAcceptee("Public domain"), "Domaine public");
  assert.equal(licenceAcceptee("CC BY-NC 2.0"), null);
  assert.equal(licenceAcceptee("Fair use"), null);
  assert.equal(texteBrut("<a href='x'>Jean&nbsp;Photo</a>"), "Jean Photo");
  const { candidates, ecartees } = candidatesDepuisPages(
    [page(1), page(2, { licence: "CC BY-NC 4.0" }), page(3, { auteur: "" }), page(4, { largeur: 640 }), page(5, { mime: "image/svg+xml" })],
    { slug: "teddy-riner", nom: "Teddy Riner" },
  );
  assert.deepEqual(candidates.map((c) => c.id), ["commons-1"]);
  assert.equal(candidates[0].auteur, "Jean Photo");
  assert.deepEqual(ecartees.map((e) => e.raison), ["licence « CC BY-NC 4.0 »", "auteur absent", "640 px de large", "format image/svg+xml"]);
  assert.match(userAgent(""), /^Perlimpinpin-carrousels\/1\.0 \(https:\/\/perlimpinpin\.ai\)/);
  assert.match(userAgent("contact@exemple.org"), /\(contact@exemple\.org\)/);
  assert.equal(Object.keys(CATEGORIES_COMMONS).length, 12);
});

test("Commons : portraits du candidat d'abord, 2 photos au plus par reportage, 20 au plus", () => {
  const nom = "Teddy Riner";
  assert.ok(scorePhoto({ titre: "File:Teddy Riner 2009.jpg", largeur: 3000, hauteur: 3400, nom }) > scorePhoto({ titre: "File:Rue Teddy Riner - Asnières.jpg", largeur: 4000, hauteur: 3000, nom }));
  assert.ok(scorePhoto({ titre: "File:Teddy Riner (123).jpg", largeur: 2000, hauteur: 1200, nom }) > scorePhoto({ titre: "File:Judo final France vs Corée 08.jpg", largeur: 4000, hauteur: 2600, nom }));
  const serie = Array.from({ length: 6 }, (_, i) => ({ id: `s${i}`, titre: `Judo France Coree ${i}.jpg`, score: 5, largeur: 3000 }));
  const portraits = Array.from({ length: 30 }, (_, i) => ({ id: `p${i}`, titre: `Teddy Riner ${i}.jpg`, score: 4, largeur: 2000 }));
  const retenues = meilleuresCandidates([...serie, ...portraits], 20, 2, nom);
  assert.equal(retenues.length, 20);
  assert.equal(retenues.filter((c) => c.id.startsWith("s")).length, 2);
});

test("bibliothèque de photos : entrées numérotées, liste réécrite, tirage stable, photo suivante en évitant la précédente, crédits", () => {
  const retenues = [
    { id: "commons-1", titre: "Teddy Riner 2009.jpg", auteur: "Nicolas Richoffer", licence: "CC BY-SA 4.0", lienLicence: "x", lien: "https://commons.wikimedia.org/wiki/File:1" },
    { id: "commons-2", titre: "b", auteur: "B", licence: "CC BY 2.0", lien: "l2" },
  ];
  const entrees = entreesPhotos("teddy-riner", retenues, [{ id: "commons-9", slug: "teddy-riner", n: 3 }]);
  assert.deepEqual(entrees.map((e) => [e.n, e.fichier]), [
    [4, "carrousel/candidats/teddy-riner/4.png"],
    [5, "carrousel/candidats/teddy-riner/5.png"],
  ]);
  assert.equal(entrees[0].modification, "photo modifiée : détourage, noir et blanc");
  const source = `a\n${REPERE_DEBUT}\nexport const PHOTOS_CANDIDATS = [];\n${REPERE_FIN}\nb`;
  assert.match(reecrireListePhotos(source, entrees), /^a\n\/\/ DEBUT LISTE PHOTOS\nexport const PHOTOS_CANDIDATS = \[\n {2}\{"id":"commons-1"/);
  const liste = [...entrees, { ...entrees[0], id: "x", n: 1 }, { ...entrees[0], id: "y", n: 2 }, { ...entrees[0], id: "z", slug: "autre", n: 1 }];
  assert.deepEqual(photosDuCandidat("teddy-riner", liste).map((p) => p.n), [1, 2, 4, 5]);
  assert.equal(choisirPhoto({ slug: "teddy-riner", graine: "a", liste }), choisirPhoto({ slug: "teddy-riner", graine: "a", liste }));
  assert.equal(choisirPhoto({ slug: "teddy-riner", demandee: "4", liste }).n, 4);
  assert.equal(choisirPhoto({ slug: "inconnu", liste }), null);
  assert.equal(photoSuivante([1, 2, 4, 5], 1, 2), 4);
  assert.equal(photoSuivante([1, 2, 4, 5], 5, null), 1);
  assert.equal(photoSuivante([3], 3, 3), 3);
  assert.deepEqual(creditsPhoto(entrees[0]), {
    court: "Photo : Nicolas Richoffer / CC BY-SA 4.0 · Wikimedia Commons",
    complet: "Photo : Nicolas Richoffer, CC BY-SA 4.0, via Wikimedia Commons (photo modifiée : détourage, noir et blanc) https://commons.wikimedia.org/wiki/File:1",
  });
  assert.equal(creditsPhoto({ ...entrees[0], auteur: "" }), null);
});


// --- Légende, crédits, mention @ ---------------------------------------------------------

test("légende : 3 paragraphes, appel lien en bio, @ seulement si compte vérifié, hashtags 3 à 5, crédits", () => {
  const legende = legendeRecit({
    legende: { question: "Q {NOM} ?", avis: "Notre avis : A.", effet: "E." },
    candidatNom: "Fabien Roussel",
    theme: "economie",
    mention: "@fabien",
    credits: ["Photo d’illustration : X / Pexels (Licence Pexels)"],
  });
  const blocs = legende.split("\n\n");
  assert.deepEqual(blocs.slice(0, 3), ["Q Fabien Roussel ?", "Notre avis : A.", "E."]);
  assert.match(blocs[3], /lien en bio/);
  assert.equal(blocs[4], "La proposition de @fabien.");
  assert.ok(hashtagsDe(legende).length >= 3 && hashtagsDe(legende).length <= 5);
  assert.equal(controleHashtags(legende), null);
  assert.match(controleHashtags("#a #b"), /2 hashtag\(s\)/);
  assert.match(controleHashtags("#a #b #c #d #e #f"), /6 hashtag\(s\)/);
  assert.match(blocs.at(-1), /^Photo d’illustration/);
  // Table : ancienne écriture lue par le carrousel 6 slides ; @ du détaillé seulement si verifie: true.
  const table = { A: "@a", B: { compte: "@b", verifie: false }, C: { compte: "c_c", verifie: true } };
  assert.equal(handleInstagram("A", table), "@a");
  assert.equal(handleInstagram("B", table), "@b");
  assert.equal(handleInstagramVerifie("A", table), null);
  assert.equal(handleInstagramVerifie("B", table), null);
  assert.equal(handleInstagramVerifie("C", table), "@c_c");
});

function donnees(modifs = {}) {
  const { recit } = controlerRecit(reponse(), CONTEXTE);
  return {
    propositionId: 42,
    analyseId: 7,
    titre: "Smic à 2 200 euros brut",
    candidatNom: "Fabien Roussel",
    theme: "economie",
    score: 51,
    contenu: { ...FICHE, reseaux_recit: recit },
    handlesInstagram: { "Fabien Roussel": { compte: "@fabien_roussel", verifie: true } },
    couleursCarrousel: { "Fabien Roussel": { fond: "#B33A2B", bloc: "#1C2A5E" } },
    photos: [
      { id: "c1", slug: "fabien-roussel", n: 1, fichier: "carrousel/candidats/fabien-roussel/1.png", auteur: "Jean Photo", licence: "CC BY-SA 4.0", lien: "https://commons.wikimedia.org/wiki/File:1", modification: "photo modifiée : détourage, noir et blanc" },
      { id: "c2", slug: "fabien-roussel", n: 2, fichier: "carrousel/candidats/fabien-roussel/2.png", auteur: "Anne Photo", licence: "CC BY 2.0", lien: "https://commons.wikimedia.org/wiki/File:2", modification: "photo modifiée : détourage, noir et blanc" },
    ],
    illustrations: [{ fichier: "illustrations/economie/caisse.jpg", theme: "economie", motsCles: ["caisse"], source: "Pexels", auteur: "A", licence: "Licence Pexels", lien: "https://pexels.com/1" }],
    ...modifs,
  };
}

test("carrousel : photo Commons tirée ou demandée, crédit sur la couverture, la fin, credits.txt et la légende ; zip bloqué sans crédit ; couleur absente → neutre", () => {
  const c = carrouselRecit(donnees({ photoDemandee: 2 }));
  assert.deepEqual(c.couleur, { fond: "#B33A2B", bloc: "#1C2A5E" });
  assert.ok(c.couleurAttribuee);
  assert.deepEqual(c.slides[0].photo, { n: 2, fichier: "carrousel/candidats/fabien-roussel/2.png" });
  assert.deepEqual(c.slides[0].credits, ["Photo : Anne Photo / CC BY 2.0 · Wikimedia Commons"]);
  assert.deepEqual(c.slides.at(-1).credits, c.slides[0].credits);
  assert.match(c.credits, /Photo d’illustration : A \/ Pexels \(Licence Pexels\)/);
  assert.match(c.credits, /Photo : Anne Photo, CC BY 2\.0, via Wikimedia Commons \(photo modifiée : détourage, noir et blanc\) https:\/\/commons\.wikimedia\.org\/wiki\/File:2/);
  assert.match(c.legende, /Photo : Anne Photo, CC BY 2\.0, via Wikimedia Commons/);
  assert.match(c.legende, /La proposition de @fabien_roussel\./);
  assert.deepEqual(c.photos, [1, 2]);
  assert.equal(c.blocageArchive, null);
  assert.equal(c.controles.creditsPresents, true);
  assert.ok(c.avertissements.some((a) => a.cle === "photo" && /Seulement 2 photo\(s\)/.test(a.message)));
  assert.notEqual(carrouselRecit(donnees({ photoDemandee: 1 })).version, c.version);
  assert.equal(carrouselRecit(donnees()).photo.n, carrouselRecit(donnees()).photo.n);
  // Photo sans auteur : archive bloquée.
  const sansCredit = carrouselRecit(donnees({ photos: [{ id: "c3", slug: "fabien-roussel", n: 1, fichier: "f.png", auteur: "", licence: "CC BY 2.0" }] }));
  assert.match(sansCredit.blocageArchive, /Crédit manquant pour la photo 1/);
  assert.equal(sansCredit.controles.creditsPresents, false);
  // Aucune photo : vignette, pas de blocage ; couleur absente : neutre et avertissement fort.
  const sans = carrouselRecit(donnees({ photos: [], couleursCarrousel: {}, handlesInstagram: {} }));
  assert.equal(sans.slides[0].photo, null);
  assert.equal(sans.blocageArchive, null);
  assert.ok(sans.avertissements.some((a) => a.cle === "photo" && /vignette actuelle/.test(a.message)));
  assert.deepEqual(sans.couleur, { fond: "#2B2A33", bloc: "#14131A" });
  assert.equal(sans.couleurAttribuee, false);
  assert.ok(sans.avertissements.some((a) => a.cle === "couleur" && a.fort));
  assert.ok(!/@/.test(sans.legende));
});


test("check-list « À relire » : cochée par le code quand c'est vérifiable, sinon à la main", () => {
  const c = carrouselRecit(donnees());
  const items = listeARelire({ controles: c.controles, debordements: [] });
  assert.deepEqual(items.map((i) => [i.cle, i.auto]), [
    ["constat", true],
    ["sources", true],
    ["note", true],
    ["debordement", true],
    ["couleur", "couleur"],
    ["credits", true],
    ["traitement", null],
  ]);
  assert.equal(listeARelire({ controles: c.controles, debordements: [{}] }).find((i) => i.cle === "debordement").auto, false);
  // Un récit stocké qui ne passe plus les contrôles décoche le point concerné.
  const { recit } = controlerRecit(reponse(), CONTEXTE);
  const fautif = { ...recit, constat: { ...recit.constat, titre: "{NOM} veut un Smic plus haut." } };
  const relu = carrouselRecit(donnees({ contenu: { ...FICHE, reseaux_recit: fautif } }));
  assert.equal(relu.controles.constatAvantProposition, false);
});

// --- Mise en page mesurée --------------------------------------------------------------

const m = mesureurCarrousel();

test("métriques des polices : largeurs réelles, chasse fixe pour la police mono", () => {
  assert.ok(m("mmmm", 100) > m("iiii", 100) * 2);
  assert.equal(Math.round(m("mmmm", 100, "mono")), Math.round(m("iiii", 100, "mono")));
  assert.ok(m("Bonjour", 100, "texte800") > m("Bonjour", 100, "texte500"));
});

test("titres : lignes équilibrées, jamais un mot seul en bout de ligne", () => {
  const mots = (liste) => liste.map((l) => ({ segments: [{ texte: l, gras: false }], largeur: l.length * 10 }));
  const { lignes, malCoupe } = couperEquilibre(mots(["aaaa", "bbbb", "cccc", "dd"]), 160, 10);
  assert.equal(malCoupe, false);
  assert.ok(lignes.at(-1).mots.length >= 2, "pas de mot seul sur la dernière ligne");
  const titre = bloc("Le plan de Fabien Roussel est facile à décider, plus dur à financer.", STYLES.titre, LARGEUR_UTILE, m, { equilibre: true });
  assert.ok(titre.lignes.length >= 2);
  assert.ok(titre.lignes.at(-1).mots.length >= 2);
  const largeurs = titre.lignes.map((l) => l.largeur);
  assert.ok(Math.max(...largeurs) - Math.min(...largeurs) < LARGEUR_UTILE * 0.35, `lignes équilibrées : ${largeurs.map(Math.round)}`);
});

test("débordement : mesuré à taille fixe, signalé par slide, jamais de police réduite", () => {
  const c = carrouselRecit(donnees());
  assert.deepEqual(debordementsCarrousel(c.slides, m), []);
  const { recit } = controlerRecit(reponse(), CONTEXTE);
  const long = { ...recit, constat: { ...recit.constat, explication: Array.from({ length: 12 }, () => "Le Smic brut est de 1 830 euros.").join(" ") } };
  const d = debordementsCarrousel(carrouselRecit(donnees({ contenu: { ...FICHE, reseaux_recit: long } })).slides, m);
  assert.equal(d.length, 1);
  assert.equal(d[0].numero, 2);
  assert.match(d[0].raison, /px de trop/);
  // Les tailles ne bougent pas avec la longueur du texte.
  const slide = carrouselRecit(donnees({ contenu: { ...FICHE, reseaux_recit: long } })).slides[1];
  assert.equal(miseEnPageSlide(slide, m).explication.style.taille, 38);
  // Lisible sur téléphone : texte courant de 36 à 42 px, 24 px au moins partout.
  assert.ok(STYLES.courant.taille >= 36 && STYLES.courant.taille <= 42);
  assert.ok(Object.values(STYLES).every((s) => s.taille >= 24));
});
