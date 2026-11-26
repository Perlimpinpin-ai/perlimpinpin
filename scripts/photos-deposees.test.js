import { test } from "node:test";
import assert from "node:assert/strict";
import { appliquerChoixDeposees, choisirPhoto, creditACompleter, creditsPhoto, fichierPhoto, photosGardees, reecrireListeDeposees, REPERE_DEPOSEES_DEBUT, REPERE_DEPOSEES_FIN } from "../src/lib/photos-candidats.js";
import { listeVerifications } from "../src/lib/verifications-charte.js";
import { placementCandidat, PHOTO_COUVERTURE } from "../src/lib/mise-en-page-carrousel.js";

const liste = [
  { slug: "teddy-riner", n: 343338, origine: "a.jpg", prepareLe: "2026-11-26", source: "à compléter", credit: "à compléter", garder: true },
  { slug: "teddy-riner", n: 601730, origine: "b.webp", prepareLe: "2026-11-26", source: "à compléter", credit: "Jean Dupont / AFP", garder: true },
  { slug: "teddy-riner", n: 731757, origine: "c.webp", prepareLe: "2026-11-26", source: "à compléter", credit: "à compléter", garder: false },
  { slug: "marine-le-pen", n: 650395, origine: "d.webp", prepareLe: "2026-11-26", source: "à compléter", credit: "à compléter", garder: false },
];

test("photos déposées : seules les gardées entrent dans le tirage, chaque format a son fichier", () => {
  const gardees = photosGardees(liste);
  assert.deepEqual(gardees.map((p) => p.n), [343338, 601730]);
  assert.equal(choisirPhoto({ slug: "marine-le-pen", liste: gardees }), null);
  const p = gardees[0];
  assert.equal(fichierPhoto(p, "mesure"), "carrousel/candidats/teddy-riner/343338/detoure-liseré-blanc.png");
  assert.equal(fichierPhoto(p, "programme"), "carrousel/candidats/teddy-riner/343338/detoure-liseré-jaune.png");
  assert.equal(fichierPhoto(p, "thematique"), "carrousel/candidats/teddy-riner/343338/medaillon.png");
  assert.equal(fichierPhoto(p, "reel"), "carrousel/candidats/teddy-riner/343338/reel-trame.png");
  assert.equal(fichierPhoto({ fichier: "carrousel/candidats/x/1.png" }, "reel"), "carrousel/candidats/x/1.png");
  // tirage stable pour une même graine, différent selon les graines
  const tirages = new Set(Array.from({ length: 20 }, (_, i) => choisirPhoto({ slug: "teddy-riner", graine: `4512-2026-11-${10 + i}T10:00:00.000Z`, liste: gardees }).n));
  assert.equal(tirages.size, 2);
  assert.equal(choisirPhoto({ slug: "teddy-riner", graine: "x", liste: gardees }), choisirPhoto({ slug: "teddy-riner", graine: "x", liste: gardees }));
});

test("crédits : « Photo : <credit> », « à compléter » avertit sans bloquer", () => {
  const [aCompleter, credite] = photosGardees(liste);
  assert.deepEqual(creditsPhoto(credite), { court: "Photo : Jean Dupont / AFP", complet: "Photo : Jean Dupont / AFP" });
  assert.equal(creditsPhoto(aCompleter).court, "Photo : à compléter");
  assert.equal(creditACompleter(aCompleter), true);
  assert.equal(creditACompleter(credite), false);
  const item = listeVerifications({ controles: { creditsPresents: true, creditPhotoACompleter: true } }).find((i) => i.cle === "credits");
  assert.equal(item.auto, true);
  assert.equal(item.alerte, "Crédit photo à compléter");
});

test("validation : choix appliqués au seul candidat, liste réécrite entre les repères", () => {
  const nouvelle = appliquerChoixDeposees(liste, "teddy-riner", [{ n: 731757, garder: true, credit: "  Photo   X  " }, { n: 343338, garder: false, credit: "" }]);
  assert.equal(nouvelle[2].garder, true);
  assert.equal(nouvelle[2].credit, "Photo X");
  assert.equal(nouvelle[0].garder, false);
  assert.equal(nouvelle[0].credit, "à compléter");
  assert.deepEqual(nouvelle[3], liste[3]);
  const source = `avant\n${REPERE_DEPOSEES_DEBUT}\nexport const PHOTOS_DEPOSEES = [];\n${REPERE_DEPOSEES_FIN}\naprès`;
  const reecrit = reecrireListeDeposees(source, nouvelle);
  assert.match(reecrit, /^avant\n\/\/ DEBUT PHOTOS DEPOSEES\nexport const PHOTOS_DEPOSEES = \[\n {2}\{\n {4}"slug": "teddy-riner"/);
  assert.match(reecrit, /\/\/ FIN PHOTOS DEPOSEES\naprès$/);
});

test("couverture « une mesure » : 47 % de la largeur, en bas à droite, jamais sur le texte", () => {
  const p = placementCandidat({ largeur: 900, hauteur: 1000 });
  assert.equal(p.largeur, PHOTO_COUVERTURE.largeur);
  assert.equal(p.gauche + p.largeur, 1080 - PHOTO_COUVERTURE.droite);
  assert.equal(p.haut + p.hauteur, 1350 - 28);
  // photo très haute : elle descend sous la dernière ligne du sous-titre qu'elle croiserait
  const haute = placementCandidat({ largeur: 600, hauteur: 1400 }, [{ x: 84, y: 600, largeur: 600, hauteur: 62 }, { x: 84, y: 100, largeur: 200, hauteur: 900 }]);
  assert.equal(haute.haut, 600 + 62 + PHOTO_COUVERTURE.ecartTexte);
});
