import { test } from "node:test";
import assert from "node:assert/strict";
import { appliquerChoixDeposees, choisirPhoto, creditACompleter, creditsPhoto, fichierPhoto, photosDuTirage, reecrireListeDeposees, REPERE_DEPOSEES_DEBUT, REPERE_DEPOSEES_FIN } from "../src/lib/photos-candidats.js";
import { listeVerifications } from "../src/lib/verifications-charte.js";
import { placementCandidat, PHOTO_COUVERTURE, SILHOUETTE_COUVERTURE, TETE_COUVERTURE } from "../src/lib/mise-en-page-carrousel.js";

const liste = [
  { slug: "teddy-riner", n: 343338, origine: "a.jpg", prepareLe: "2026-11-26", source: "à compléter", credit: "à compléter", ecarter: false },
  { slug: "teddy-riner", n: 601730, origine: "b.webp", prepareLe: "2026-11-26", source: "à compléter", credit: "Jean Dupont / AFP", ecarter: false },
  { slug: "teddy-riner", n: 731757, origine: "c.webp", prepareLe: "2026-11-26", source: "à compléter", credit: "à compléter", ecarter: true, raison: "deuxième personne" },
  { slug: "marine-le-pen", n: 650395, origine: "d.webp", prepareLe: "2026-11-26", source: "à compléter", credit: "à compléter", ecarter: false },
];

test("photos déposées : toutes entrent dans le tirage sauf les écartées, chaque format a son fichier", () => {
  const gardees = photosDuTirage(null, liste).filter((p) => p.slug === "teddy-riner");
  assert.deepEqual(gardees.map((p) => p.n), [343338, 601730]);
  assert.equal(choisirPhoto({ slug: "eric-zemmour", liste: gardees }), null);
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
  const [aCompleter, credite] = photosDuTirage(null, liste);
  assert.deepEqual(creditsPhoto(credite), { court: "Photo : Jean Dupont / AFP", complet: "Photo : Jean Dupont / AFP" });
  assert.equal(creditsPhoto(aCompleter).court, "Photo : à compléter");
  assert.equal(creditACompleter(aCompleter), true);
  assert.equal(creditACompleter(credite), false);
  const item = listeVerifications({ controles: { creditsPresents: true, creditPhotoACompleter: true } }).find((i) => i.cle === "credits");
  assert.equal(item.auto, true);
  assert.equal(item.alerte, "Crédit photo à compléter");
});

test("validation : choix appliqués au seul candidat, liste réécrite entre les repères", () => {
  const nouvelle = appliquerChoixDeposees(liste, "teddy-riner", [{ n: 731757, ecarter: false, credit: "  Photo   X  " }, { n: 343338, ecarter: true, credit: "" }]);
  assert.equal(nouvelle[2].ecarter, false);
  assert.equal(nouvelle[2].raison, undefined);
  assert.equal(nouvelle[2].credit, "Photo X");
  assert.equal(nouvelle[0].ecarter, true);
  assert.equal(nouvelle[0].credit, "à compléter");
  assert.deepEqual(nouvelle[3], liste[3]);
  const source = `avant\n${REPERE_DEPOSEES_DEBUT}\nexport const PHOTOS_DEPOSEES = [];\n${REPERE_DEPOSEES_FIN}\naprès`;
  const reecrit = reecrireListeDeposees(source, nouvelle);
  assert.match(reecrit, /^avant\n\/\/ DEBUT PHOTOS DEPOSEES\nexport const PHOTOS_DEPOSEES = \[\n {2}\{\n {4}"slug": "teddy-riner"/);
  assert.match(reecrit, /\/\/ FIN PHOTOS DEPOSEES\naprès$/);
});

test("couverture « une mesure » sans cadrage : 47 % de la largeur, en bas à droite, jamais sur le texte", () => {
  const p = placementCandidat({ largeur: 900, hauteur: 1000 });
  assert.equal(p.largeur, PHOTO_COUVERTURE.largeur);
  assert.equal(p.gauche + p.largeur, 1080 - PHOTO_COUVERTURE.droite);
  assert.equal(p.haut + p.hauteur, 1350 - 28);
  // photo très haute : elle descend sous la dernière ligne du sous-titre qu'elle croiserait
  const haute = placementCandidat({ largeur: 600, hauteur: 1400 }, [{ x: 84, y: 600, largeur: 600, hauteur: 62 }, { x: 84, y: 100, largeur: 200, hauteur: 900 }]);
  assert.equal(haute.haut, 600 + 62 + PHOTO_COUVERTURE.ecartTexte);
});

test("couverture « une mesure » avec cadrage : même taille de tête et même place, quel que soit le cliché", () => {
  // Deux cadrages très différents : buste large (tête petite) et gros plan (tête grande).
  const large = { largeur: 1900, hauteur: 1120, cadrage: { largeur: 1900, hauteur: 1120, sommet: 25, visage: { x: 800, y: 160, l: 300, h: 300 } } };
  const serre = { largeur: 800, hauteur: 1120, cadrage: { largeur: 800, hauteur: 1120, sommet: 20, visage: { x: 130, y: 100, l: 520, h: 520 } } };
  for (const photo of [large, serre]) {
    const p = placementCandidat(photo);
    const v = photo.cadrage.visage;
    const e = p.image.largeur / photo.cadrage.largeur;
    const tete = (v.y + v.h - photo.cadrage.sommet) * e;
    assert.ok(tete > TETE_COUVERTURE - 2 && tete < TETE_COUVERTURE * 1.15 + 2, "même hauteur de tête (portrait serré : 15 % de plus au plus)");
    assert.ok(Math.abs(p.gauche + p.image.x + (v.x + v.l / 2) * e - SILHOUETTE_COUVERTURE.centreVisage) < 2, "visage au même endroit");
    assert.ok(p.haut + p.image.y + p.image.hauteur >= 1350 - 28, "le buste atteint le bas de la slide");
    assert.ok(p.gauche >= SILHOUETTE_COUVERTURE.gaucheMin);
  }
  assert.equal(placementCandidat(large).hautTete, SILHOUETTE_COUVERTURE.hautTete);
  // Sous-titre qui croise la tête : le crâne passe dessous ; ligne qui s'arrête avant : rien ne bouge.
  assert.equal(placementCandidat(large, [{ x: 84, y: 700, largeur: 760, hauteur: 50 }]).hautTete, 700 + 50 + PHOTO_COUVERTURE.ecartTexte);
  assert.equal(placementCandidat(large, [{ x: 84, y: 700, largeur: 400, hauteur: 50 }]).hautTete, SILHOUETTE_COUVERTURE.hautTete);
});

test("tirage au rendu : photos préparées sur le disque, moins les écartées ; une photo hors liste entre aussi", () => {
  const surDisque = [{ slug: "teddy-riner", n: 343338 }, { slug: "teddy-riner", n: 731757 }, { slug: "teddy-riner", n: 999999 }];
  const tirage = photosDuTirage(surDisque, liste);
  assert.deepEqual(tirage.map((p) => p.n), [343338, 999999]);
  assert.equal(tirage[1].credit, "à compléter");
  assert.equal(tirage[1].fichier, "carrousel/candidats/teddy-riner/999999/detoure-liseré-blanc.png");
  assert.ok(!tirage.some((p) => p.n === 601730), "listée mais absente du disque");
});

test("tirage : évite la photo du carrousel précédent et celle à remplacer, garde la photo mémorisée", () => {
  const photos = photosDuTirage([{ slug: "teddy-riner", n: 1 }, { slug: "teddy-riner", n: 2 }, { slug: "teddy-riner", n: 3 }], []);
  const vues = new Set();
  for (let i = 0; i < 30; i++) {
    const p = choisirPhoto({ slug: "teddy-riner", recentes: [2, 3], graine: String(i), liste: photos });
    assert.notEqual(p.n, 2, "pas celle du carrousel précédent");
    vues.add(p.n);
    assert.equal(choisirPhoto({ slug: "teddy-riner", recentes: [2], eviter: [1], graine: String(i), liste: photos }).n, 3);
  }
  assert.deepEqual([...vues].sort(), [1, 3], "au hasard parmi les autres");
  assert.equal(choisirPhoto({ slug: "teddy-riner", retenue: 2, graine: "x", liste: photos }).n, 2);
  assert.notEqual(choisirPhoto({ slug: "teddy-riner", retenue: 7, graine: "x", liste: photos }), null, "retenue écartée depuis : nouveau tirage");
});
