import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { avertissementsFil, COULEURS_THEMES, couleursTheme, PICTOS_THEMES, contraste, controleRegistre, couleursCandidat, legendeVerdicts, MARQUE, NUANCIER, PICTOS, POLICES, POLICES_INTERDITES_CARROUSEL, proposerCouleurs, REGISTRE_CANDIDATS, seuilsConformes, seuilsDuCode, TAILLES, temperature, verdictDe, VERDICTS } from "../src/lib/charte-rs.js";
import { contientPrenom, decouperNom, ecartsEquite, estRubrique, insecables, moyenneNotes, nomDeFamille, ordreAlphabetique, restesDeMaquette } from "../src/lib/ecriture-charte.js";
import { GRILLES, svgPicto } from "../src/lib/pictos-charte.js";
import { controlerRecit } from "../src/lib/recit.js";
import { STYLES } from "../src/lib/mise-en-page-carrousel.js";
import { assemblerProgramme, assemblerThematique, controlerProgramme, controlerThematique, selectionProgramme, selectionThematique } from "../src/lib/carrousel-formats.js";
import { listeVerifications } from "../src/lib/verifications-charte.js";
import { CONTEXTE, reponse } from "./lib/recit-fixture.js";

// Charte graphique RS (docs/charte-rs.md) : jetons uniques, règles d'écriture,
// formats « programme » et « thématique ».

const RACINE = new URL("..", import.meta.url);
const lire = (chemin) => JSON.parse(readFileSync(new URL(chemin, RACINE), "utf8"));

// --- Jetons --------------------------------------------------------------------------

test("jetons : aucun code hexadécimal dans les composants des carrousels (tout vient de src/lib/charte-rs.js)", () => {
  const dossier = new URL("src/components/carrousels/", RACINE);
  const fichiers = readdirSync(dossier).filter((f) => f.endsWith(".js"));
  assert.ok(fichiers.length >= 4);
  for (const f of fichiers) {
    const code = readFileSync(new URL(f, dossier), "utf8").replace(/\/\/.*$/gm, "");
    assert.deepEqual(code.match(/#[0-9a-f]{3,8}\b/gi) ?? [], [], `${f} : code hexadécimal en dur`);
    for (const police of POLICES_INTERDITES_CARROUSEL) assert.ok(!code.includes(police), `${f} : police ${police} interdite dans les carrousels`);
  }
});

test("jetons : couleurs de la marque, verdicts, registre (12 candidats), nuancier (20)", () => {
  assert.equal(MARQUE.jaune, "#FFD23F");
  assert.equal(MARQUE.creme, "#F1ECE2");
  assert.deepEqual(Object.values(VERDICTS).map((v) => v.couleur), ["#4F7A3A", "#C08A1E", "#C9622B", "#B5432E"]);
  assert.equal(Object.keys(REGISTRE_CANDIDATS).length, 12);
  for (const nom of Object.keys(REGISTRE_CANDIDATS)) {
    const c = couleursCandidat(nom);
    assert.ok(contraste(c.fond, c.texte) >= 4.5, `${nom} : contraste du titre ${contraste(c.fond, c.texte).toFixed(1)}`);
    assert.ok(contraste(c.accentCreme, MARQUE.creme) >= 3, `${nom} : accent lisible sur le papier crème`);
  }
  assert.deepEqual(Object.entries(REGISTRE_CANDIDATS).filter(([, c]) => c.clair).map(([n]) => n), ["David Lisnard", "Dominique de Villepin", "Gabriel Attal", "Marine Le Pen"]);
  assert.equal(couleursCandidat("Gabriel Attal").surlignage, MARQUE.blanc);
  assert.equal(NUANCIER.length, 20);
  assert.deepEqual(NUANCIER.filter((c) => c.temperature === "froide").map((c) => c.n), [9, 10, 11, 12, 13, 14, 15]);
  assert.deepEqual(NUANCIER.filter((c) => c.procheJaune).map((c) => c.n), [5, 6]);
});

test("jetons : tailles et polices de la charte, mono jamais sous 24 px", () => {
  assert.ok(STYLES.couverture.taille >= TAILLES.couverture.min && STYLES.couverture.taille <= TAILLES.couverture.max);
  assert.ok(STYLES.titre.taille >= TAILLES.titre.min && STYLES.titre.taille <= TAILLES.titre.max);
  assert.ok(STYLES.sousTitre.taille >= TAILLES.serif.min && STYLES.sousTitre.taille <= TAILLES.serif.max);
  assert.ok(STYLES.courant.taille >= TAILLES.courant.min && STYLES.courant.taille <= TAILLES.courant.max);
  for (const s of Object.values(STYLES)) assert.ok(s.taille >= TAILLES.minimum);
  for (const s of Object.values(STYLES).filter((x) => x.police === "mono")) assert.ok(s.taille >= TAILLES.mono.min && s.taille <= TAILLES.mono.max);
  assert.equal(STYLES.couverture.espacement, -3.36); // approche −3,5 % de 96 px
  assert.deepEqual([...new Set(Object.values(POLICES).map((p) => p.famille))], ["Inter Display", "DM Serif Display", "JetBrains Mono"]);
});

test("pictos : liste fermée de la charte, une grille par picto, refus hors liste", () => {
  assert.deepEqual(Object.keys(GRILLES).sort(), [...PICTOS].sort());
  assert.match(svgPicto("coin").svg, /^<svg/);
  assert.throws(() => svgPicto("pieces"), /hors de la liste/);
});

test("verdicts : calculés par le code ; seuils du code différents de la charte (70/50/35) signalés, couleurs de charte", () => {
  assert.deepEqual(seuilsDuCode(), [80, 65, 50, 35, 20]);
  assert.equal(seuilsConformes(), false);
  assert.equal(verdictDe(72).couleur, VERDICTS.solide.couleur);
  assert.equal(verdictDe(56).couleur, VERDICTS.plausible.couleur);
  assert.equal(verdictDe(45).couleur, VERDICTS.fragile.couleur);
  assert.equal(verdictDe(30).couleur, VERDICTS.peuRealiste.couleur);
  assert.equal(verdictDe(56).libelle, "Plausible sous condition");
  assert.equal(legendeVerdicts().length, 6);
});

test("registre : candidat absent → refus avec couleurs du nuancier proposées (contraste ≥ 4,5:1), rien d'écrit", () => {
  assert.equal(couleursCandidat("Nouveau Candidat"), null);
  const message = controleRegistre("Nouveau Candidat");
  assert.match(message, /pas dans le registre/);
  assert.match(message, /génération refusée/);
  const options = proposerCouleurs();
  assert.equal(options.length, 3);
  for (const o of options) assert.ok(o.contraste >= 4.5 && !Object.values(REGISTRE_CANDIDATS).some((c) => c.fond === o.fond));
});

test("fil Instagram : même couleur qu'un des 2 derniers posts, deux posts chauds (ou froids) de suite", () => {
  assert.deepEqual(avertissementsFil("#2C6A9E", ["#2D6B9F"]).map((a) => a.cle), ["meme", "temperature"]);
  assert.deepEqual(avertissementsFil("#B5432E", ["#22355C", "#2C6A9E"]).map((a) => a.cle), []);
  assert.deepEqual(avertissementsFil("#B5432E", ["#9A632E"]).map((a) => a.cle), ["temperature"]);
  assert.equal(temperature("#2F6A4C"), "froide");
  assert.equal(temperature("#B04E28"), "chaude");
  assert.deepEqual(avertissementsFil(null, ["#22355C"]), []);
});

// --- Écriture -------------------------------------------------------------------------

test("nombres insécables : dans et autour des nombres", () => {
  const nb = " ";
  assert.equal(insecables("50 000 emplois"), `50${nb}000${nb}emplois`);
  assert.equal(insecables("1 500 000 euros"), `1${nb}500${nb}000${nb}euros`);
  assert.equal(insecables("20 %"), `20${nb}%`);
  assert.equal(insecables("6,8 milliards en 2030"), `6,8${nb}milliards en 2030`);
  assert.equal(insecables("dans 30 à 40 ans."), `dans 30${nb}à${nb}40${nb}ans.`);
  assert.equal(insecables("près de 600 milliards"), `près de${nb}600${nb}milliards`);
  assert.equal(insecables("Chili, 1981 : la réforme"), "Chili, 1981 : la réforme");
});

test("couverture : seulement le nom de famille ; prénom → refus", () => {
  assert.deepEqual(decouperNom("Dominique de Villepin"), { prenom: "Dominique", famille: "Villepin" });
  assert.equal(nomDeFamille("Marine Le Pen"), "Le Pen");
  assert.equal(nomDeFamille("Jean-Luc Mélenchon"), "Mélenchon");
  assert.ok(contientPrenom("Teddy Riner veut-il placer vos retraites en Bourse ?", "Teddy Riner"));
  assert.ok(!contientPrenom("Riner veut-il placer vos retraites en Bourse ?", "Teddy Riner"));
  assert.ok(contientPrenom("Jean-Luc veut-il…", "Jean-Luc Mélenchon"));
  const r = reponse();
  r.couverture.question = "Fabien Roussel veut-il un ==Smic à 2 200 euros== ?";
  const { valide, erreurs } = controlerRecit(r, CONTEXTE);
  assert.equal(valide, false);
  assert.ok(erreurs.some((e) => /couverture : prénom du candidat/.test(e)));
  assert.ok(controlerRecit(reponse(), CONTEXTE).valide, "le marqueur {NOM} (nom de famille) passe");
});

test("titres : intertitre de rubrique → refus ; titre du constat sans chiffre → avertissement", () => {
  for (const t of ["La mesure", "Impact.", "Le constat", "Conclusion", "NOTRE AVIS", "« Court terme »"]) assert.ok(estRubrique(t), t);
  for (const t of ["Retraites : un trou de 6,8 milliards en 2030.", "Notre avis : bonne idée, mais rien n’est chiffré."]) assert.ok(!estRubrique(t), t);
  const r = reponse();
  r.court_terme.titre = "Court terme";
  const refus = controlerRecit(r, CONTEXTE);
  assert.ok(refus.erreurs.some((e) => /slide 4 \(titre\) : « Court terme » est un intertitre de rubrique/.test(e)));
  const r2 = reponse();
  r2.constat.titre = "Les bas salaires peinent à suivre les prix.";
  assert.ok(controlerRecit(r2, CONTEXTE).avertissements.some((a) => /slide 2 \(titre\) : .* sans chiffre/.test(a)));
});

test("restes de maquette : « exemple », « Candidat A », « [crédits à compléter] », « ?/100 » → refus", () => {
  assert.deepEqual(restesDeMaquette("EXEMPLE"), ["badge « exemple »"]);
  assert.deepEqual(restesDeMaquette("[exemple]"), ["badge « exemple »"]);
  assert.deepEqual(restesDeMaquette("Prenons par exemple un salarié."), []);
  assert.deepEqual(restesDeMaquette("La proposition du Candidat A"), ["« Candidat A »"]);
  assert.deepEqual(restesDeMaquette("Photos : [crédits à compléter]"), ["« [crédits à compléter] »"]);
  assert.deepEqual(restesDeMaquette("?/100"), ["« ?/100 »"]);
  assert.deepEqual(restesDeMaquette("?/100", { couverturePrograme: true }), []);
  const r = reponse();
  r.avis.tient = ["Candidat A tient.", "Le diagnostic est juste."];
  assert.ok(controlerRecit(r, CONTEXTE).erreurs.some((e) => /reste de maquette/.test(e)));
});

test("ordre alphabétique (nom de famille) et moyenne calculée par le code", () => {
  const noms = ["Éric Zemmour", "Teddy Riner", "Gabriel Attal", "Dominique de Villepin", "Marine Le Pen", "Raphaël Glucksmann", "Jean-Luc Mélenchon"];
  assert.deepEqual(ordreAlphabetique(noms, (n) => n), ["Gabriel Attal", "Raphaël Glucksmann", "Marine Le Pen", "Jean-Luc Mélenchon", "Teddy Riner", "Dominique de Villepin", "Éric Zemmour"]);
  assert.equal(moyenneNotes([56, 72, 63, 41, 48, 30]), 52);
  assert.equal(moyenneNotes([]), null);
  assert.deepEqual(ecartsEquite({ A: "un deux trois quatre cinq six sept huit", B: "un deux trois quatre cinq six sept huit", C: "un deux trois quatre cinq six sept huit neuf dix onze douze" }).map((e) => e.nom), ["C"]);
});

// --- Formats programme et thématique -------------------------------------------------------

function fichesProgramme() {
  const d = lire("data/demo-carrousel/charte-rs/programme-riner.json");
  const fiches = d.fiches.map(({ fichier, id }) => {
    const brut = lire(fichier);
    return { id, titre: brut.titre_fiche, theme: brut.theme, score: brut.fiche_complete.notation_detaillee.score_total, contenu: brut.fiche_complete };
  });
  return { d, fiches, ordres: Object.fromEntries(d.fiches.map((f) => [f.id, f.ordre])) };
}

test("programme : 6 fiches publiées sur 6 thèmes, ordre du champ de tri ; moyenne et verdicts du code", () => {
  const { d, fiches, ordres } = fichesProgramme();
  const sel = selectionProgramme(fiches, ordres);
  assert.deepEqual(sel.erreurs, []);
  assert.deepEqual(sel.fiches.map((f) => f.theme), ["retraites", "sante", "education", "logement", "emploi", "energie-climat"]);
  assert.match(selectionProgramme(fiches.slice(0, 5), ordres).erreurs[0], /5 fiche\(s\)/);
  assert.ok(selectionProgramme(fiches.map((f) => ({ ...f, theme: "sante" })), ordres).erreurs.some((e) => /Thème\(s\) en double/.test(e)));
  assert.ok(selectionProgramme(fiches, { ...ordres, 9002: 1 }).erreurs.some((e) => /Champ de tri/.test(e)));
  assert.ok(selectionProgramme(fiches.map((f, i) => (i ? f : { ...f, score: null })), ordres).erreurs.some((e) => /pas de note/.test(e)));
  const controle = controlerProgramme(d.reponse, { candidatNom: d.candidat, fiches: sel.fiches });
  assert.deepEqual(controle.erreurs, []);
  const c = assemblerProgramme({ candidatNom: d.candidat, fiches: sel.fiches, programme: controle.programme, credits: ["Portrait : test"] });
  assert.equal(c.slides.length, 10);
  assert.equal(c.moyenne, 52);
  assert.equal(c.slides[0].titre, "On a noté ==6 mesures== de Riner.");
  assert.ok(!/\d+\/100/.test(JSON.stringify(c.slides[0])), "aucune note sur la couverture");
  assert.equal(c.slides[8].solide.themeNom, "Santé");
  assert.equal(c.slides[8].fragile.themeNom, "Climat");
  assert.equal(c.archive, "programme-teddy-riner.zip");
  assert.ok(listeVerifications({ controles: c.controles, format: "programme" }).find((i) => i.cle === "notes").auto);
});

test("programme : nombre absent de sa fiche, niveau du barème ou rubrique → refus ; candidat hors registre → bloqué", () => {
  const { d, fiches, ordres } = fichesProgramme();
  const sel = selectionProgramme(fiches, ordres);
  const r = structuredClone(d.reponse);
  r.mesures[1].tient = "Un coût de 999 millions d'euros.";
  r.mesures[2].titre = "La mesure";
  r.mesures[3].coince = "Une mesure fragile.";
  const { erreurs } = controlerProgramme(r, { candidatNom: d.candidat, fiches: sel.fiches });
  assert.ok(erreurs.some((e) => /mesure 2 \(ce qui tient\) : nombre\(s\) absent\(s\)/.test(e)));
  assert.ok(erreurs.some((e) => /mesure 3 \(titre\) : « La mesure » est un intertitre/.test(e)));
  assert.ok(erreurs.some((e) => /mesure 4 \(ce qui coince\) : niveau « Fragile »/.test(e)));
  const hors = assemblerProgramme({ candidatNom: "Nouveau Candidat", fiches: sel.fiches, programme: controlerProgramme(d.reponse, { candidatNom: d.candidat, fiches: sel.fiches }).programme });
  assert.equal(hors.slides.length, 0);
  assert.match(hors.blocage, /registre/);
});

function donneesThematique() {
  const d = lire("data/demo-carrousel/charte-rs/thematique-retraites.json");
  const candidats = d.candidats.map((c) => {
    if (!c.fiche) return { nom: c.nom, fiche: null };
    const brut = lire(c.fiche.fichier);
    const contenu = brut.fiche_complete ?? brut;
    return { nom: c.nom, fiche: { id: c.fiche.id, titre: brut.titre_fiche ?? contenu.mesure_reformulee.synthese, theme: brut.theme ?? c.fiche.theme, score: contenu.notation_detaillee.score_total, contenu } };
  });
  return { d, candidats };
}
const COULEURS_TEST = { retraites: 11 };

test("thématique : 4 à 8 candidats, ordre alphabétique, candidat sans fiche sans note, classement seulement au comparatif", () => {
  const { d, candidats } = donneesThematique();
  const sel = selectionThematique(d.theme, candidats);
  assert.deepEqual(sel.erreurs, []);
  assert.match(selectionThematique(d.theme, candidats.slice(0, 3)).erreurs[0], /3 candidat\(s\)/);
  const controle = controlerThematique(d.reponse, { theme: d.theme, candidats: sel.candidats });
  assert.deepEqual(controle.erreurs, []);
  const c = assemblerThematique({ theme: d.theme, candidats: sel.candidats, thematique: controle.thematique, couleursThemes: COULEURS_TEST, credits: ["Portraits : test"] });
  const parCandidat = c.slides.filter((s) => s.type === "candidat");
  assert.deepEqual(parCandidat.map((s) => s.nom), ["Gabriel Attal", "Raphaël Glucksmann", "Marine Le Pen", "Teddy Riner", "Dominique de Villepin", "Éric Zemmour"]);
  assert.equal(parCandidat[0].sansProposition, true);
  assert.equal(parCandidat[0].note, undefined);
  const comparatif = c.slides.find((s) => s.type === "comparatif");
  assert.deepEqual(comparatif.classement.map((x) => x.note), [61, 57, 56, 47, 43]);
  assert.equal(c.controles.ordreAlphabetique, true);
  assert.equal(c.slides[0].titre, "Retraites : ce que proposent les ==candidats.==");
  assert.equal(c.archive, "thematique-retraites.zip");
  // Couleur du thème non validée : pas de carrousel.
  assert.match(assemblerThematique({ theme: d.theme, candidats: sel.candidats, thematique: controle.thematique, couleursThemes: {} }).blocage, /Pas de couleur validée/);
});

test("thématique : texte pour un candidat sans fiche → refus ; écart de longueur > 20 % → avertissement d'équité", () => {
  const { d, candidats } = donneesThematique();
  const sel = selectionThematique(d.theme, candidats);
  const r = structuredClone(d.reponse);
  r.candidats.push({ nom: "Gabriel Attal", titre: "Inventé.", proposition: "Inventé.", regard: "Inventé." });
  assert.ok(controlerThematique(r, { theme: d.theme, candidats: sel.candidats }).erreurs.some((e) => /candidat sans fiche/.test(e)));
  const r2 = structuredClone(d.reponse);
  r2.candidats[0].regard = "L'injustice est réelle et documentée, mais mesurer la pénibilité et la bonne santé a déjà échoué en France et en Belgique, et rien ne dit comment faire mieux.";
  assert.ok(controlerThematique(r2, { theme: d.theme, candidats: sel.candidats }).avertissements.some((a) => /Équité : Raphaël Glucksmann/.test(a)));
});

test("check-list de la page 20 : points automatiques et points à cocher à la main", () => {
  const items = listeVerifications({ controles: {}, format: "thematique" });
  assert.deepEqual(items.filter((i) => i.auto === null).map((i) => i.cle), ["lecture", "photo", "traitement"]);
  assert.ok(items.some((i) => i.cle === "notes"));
  assert.ok(!listeVerifications({ controles: {}, format: "mesure" }).some((i) => i.cle === "notes"));
  assert.ok(join);
});

test("illustrations : sources autorisées seulement (Commons, Pexels, Pixabay, Unsplash)", async () => {
  const { ILLUSTRATIONS, sourceAutorisee } = await import("../src/lib/illustrations.js");
  assert.deepEqual(ILLUSTRATIONS.filter((i) => !sourceAutorisee(i.source)).map((i) => i.fichier), []);
  assert.ok(sourceAutorisee("Pixabay") && sourceAutorisee("unsplash"));
  assert.ok(!sourceAutorisee("AFP") && !sourceAutorisee("Capture TF1") && !sourceAutorisee(""));
});

test("thèmes : chaque thème du site a sa couleur du nuancier (texte lisible) et son picto de la liste", async () => {
  const { THEME_SLUGS } = await import("../src/lib/themes.js");
  assert.deepEqual(Object.keys(COULEURS_THEMES).sort(), [...THEME_SLUGS].sort());
  assert.deepEqual(Object.keys(PICTOS_THEMES).sort(), [...THEME_SLUGS].sort());
  for (const slug of THEME_SLUGS) {
    const c = couleursTheme(slug);
    assert.ok(c && contraste(c.fond, c.texte) >= 4.5, `${slug} : contraste`);
    assert.ok(!NUANCIER.find((n) => n.fond === c.fond).procheJaune, `${slug} : pas de couleur proche du jaune`);
    assert.ok(PICTOS.includes(PICTOS_THEMES[slug]), `${slug} : picto hors liste`);
  }
  assert.equal(couleursTheme("retraites").fond, "#1F6A6A");
  assert.equal(PICTOS_THEMES.retraites, "coin");
});
