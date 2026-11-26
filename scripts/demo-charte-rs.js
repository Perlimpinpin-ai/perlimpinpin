// Démonstration locale des carrousels de la charte RS, SANS base et SANS
// appel payant : réponses du modèle simulées (data/demo-carrousel/), fiches
// locales. Les réponses passent par les vrais contrôles et le vrai rendu
// (composants de src/components/carrousels/, compilés par
// scripts/lib/rendu-jsx.js). Écrit les PNG et une planche par carrousel dans
// tmp/charte-rs/ (ignoré par git).
//
//   node scripts/demo-charte-rs.js mesure --fiche <fiche.json> --reponse <réponse.json> --candidat "Nom" [--theme <slug>] [--titre "…"] [--sortie <nom>]
//   node scripts/demo-charte-rs.js programme --donnees <programme.json> [--sortie <nom>]
//   node scripts/demo-charte-rs.js thematique --donnees <thematique.json> [--sortie <nom>]
// Couleurs et pictos des thèmes : tables validées de src/lib/charte-rs.js.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import sharp from "sharp";
import { chargerComposants, policesCharte, rendrePng } from "./lib/rendu-jsx.js";
import { controlerRecit, recitPourStockage } from "../src/lib/recit.js";
import { fichePourRecit } from "../src/lib/recit-generation.js";
import { valeursReseaux } from "../src/lib/reseaux.js";
import { recitDe } from "../src/lib/carrousel-serveur.js";
import { miseEnPageSlide } from "../src/lib/mise-en-page-carrousel.js";
import { mesureurCarrousel } from "../src/lib/metriques-polices.js";
import { CHEMIN_GRAIN, CHEMIN_PAPIER, cheminIllustrationTraitee, cheminVignetteNb, imageCandidatPrete, imagePrete } from "../src/lib/images-carrousel.js";
import { dataUriPicto } from "../src/lib/pictos-charte.js";
import { piedCarrousel } from "../src/lib/carrousel-recit.js";
import { assemblerProgramme, assemblerThematique, controlerProgramme, controlerThematique, selectionProgramme, selectionThematique } from "../src/lib/carrousel-formats.js";
import { miseEnPageFormat } from "../src/lib/mise-en-page-formats.js";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { themes: { type: "string" }, fiche: { type: "string" }, reponse: { type: "string" }, candidat: { type: "string" }, theme: { type: "string" }, titre: { type: "string" }, sortie: { type: "string" }, donnees: { type: "string" } },
});
const format = positionals[0];
const lire = (f) => JSON.parse(readFileSync(f, "utf8"));
const DOSSIER = join(process.cwd(), "tmp", "charte-rs");

async function planche(pngs, fichier, colonnes = 4) {
  const l = 540;
  const h = 675;
  const g = 24;
  const lignes = Math.ceil(pngs.length / colonnes);
  const reduits = await Promise.all(pngs.map((p) => sharp(p).resize(l, h).png().toBuffer()));
  await sharp({ create: { width: colonnes * l + (colonnes + 1) * g, height: lignes * h + (lignes + 1) * g, channels: 3, background: "#e9e6df" } })
    .composite(reduits.map((input, i) => ({ input, left: g + (i % colonnes) * (l + g), top: g + Math.floor(i / colonnes) * (h + g) })))
    .png()
    .toFile(fichier);
}

function ecrire(nom, pngs, textes = {}) {
  const dossier = join(DOSSIER, nom);
  mkdirSync(dossier, { recursive: true });
  pngs.forEach((png, i) => writeFileSync(join(dossier, `${String(i + 1).padStart(2, "0")}.png`), png));
  for (const [f, t] of Object.entries(textes)) writeFileSync(join(dossier, f), t);
  return dossier;
}

// --- Une mesure ---------------------------------------------------------------------
async function mesure() {
  const brut = lire(values.fiche);
  const fiche = brut.fiche_complete ?? brut;
  const candidatNom = values.candidat;
  const score = fiche.notation_detaillee?.score_total ?? 0;
  const simulation = lire(values.reponse);
  const controle = controlerRecit(simulation.reponse, { ficheFinale: fichePourRecit(fiche), candidatNom, score, valeurs: valeursReseaux({ candidatNom, score, propositionId: 1 }) });
  if (!controle.valide) {
    console.error("Réponse simulée REFUSÉE par le contrôle :");
    controle.erreurs.forEach((e) => console.error(`  ✗ ${e}`));
    process.exit(1);
  }
  const proposition = { id: 1, titre: values.titre ?? brut.titre_fiche ?? fiche.mesure_reformulee?.synthese, texteOriginal: "", theme: values.theme ?? null, candidat: { nom: candidatNom, photoUrl: null } };
  const analyse = { id: 0, statut: "brouillon", scoreFaisabilite: score, contenuComplet: { ...fiche, reseaux_recit: recitPourStockage(controle.recit, { modele: "simulation" }) } };
  const carrousel = recitDe(proposition, analyse);
  const { composants, ImageResponse } = await chargerComposants();
  const polices = await policesCharte();
  const mesurer = mesureurCarrousel();
  const pngs = [];
  for (const slide of carrousel.slides) {
    const couv = slide.type === "couverture";
    const surCouleur = slide.type === "fin";
    const images = {
      grain: await imagePrete(CHEMIN_GRAIN),
      papier: couv ? await imagePrete(CHEMIN_PAPIER) : null,
      candidat: couv ? await imageCandidatPrete({ detoure: slide.photo?.fichier ?? null, vignette: cheminVignetteNb(proposition.candidat) }) : null,
      illustration: couv && slide.illustration ? await imagePrete(cheminIllustrationTraitee(slide.illustration.fichier)) : null,
      picto: composants.PICTOS[slide.type] ? dataUriPicto(composants.PICTOS[slide.type], { taille: 6, fondSombre: surCouleur && !carrousel.couleur.clair, couleur: surCouleur ? carrousel.couleur.accent : carrousel.couleur.accentCreme }) : null,
    };
    const mise = miseEnPageSlide(slide, mesurer);
    pngs.push(await rendrePng(composants.CarrouselMesure({ slide, mise, couleur: carrousel.couleur, images, candidatNom, sujet: carrousel.sujet, pied: piedCarrousel(candidatNom, proposition.theme) }), { ImageResponse, polices }));
  }
  const nom = values.sortie ?? `mesure-${candidatNom}`;
  const dossier = ecrire(nom, pngs, { "legende.txt": carrousel.legende, "credits.txt": carrousel.credits });
  await planche(pngs, join(DOSSIER, `${nom}-planche.png`));
  console.log(`${carrousel.slides.length} slides → ${dossier}`);
  for (const a of carrousel.avertissements) console.log(`  ${a.fort ? "✗" : "⚠"} [${a.cle}] ${a.message}`);
  for (const a of controle.avertissements) console.log(`  ⚠ ${a}`);
}

// Fiche locale → fiche des formats ({ id, titre, theme, score, contenu }).
function ficheLocale({ fichier, id, theme = null }) {
  const brut = lire(fichier);
  const contenu = brut.fiche_complete ?? brut;
  return { id, titre: brut.titre_fiche ?? contenu.mesure_reformulee?.synthese, theme: brut.theme ?? theme, score: contenu.notation_detaillee?.score_total, contenu };
}

function sortieFormat(nom, resultat, controle) {
  if (resultat.blocage && !resultat.slides.length) {
    console.error(`BLOQUÉ : ${resultat.blocage}`);
    process.exit(1);
  }
  for (const a of controle.avertissements) console.log(`  ⚠ ${a}`);
  for (const a of resultat.avertissements) console.log(`  ${a.fort ? "✗" : "⚠"} [${a.cle}] ${a.message}`);
}

async function rendreFormat(nom, resultat, Composant, imagesDe) {
  const { composants, ImageResponse } = await chargerComposants();
  const polices = await policesCharte();
  const mesurer = mesureurCarrousel();
  const grain = await imagePrete(CHEMIN_GRAIN);
  const pngs = [];
  for (const slide of resultat.slides) {
    const mise = miseEnPageFormat(slide, mesurer);
    for (const d of mise.debordements) console.log(`  ✗ slide ${slide.numero} : ${d.bloc}, ${d.raison}${d.champs ? ` (champs : ${d.champs.join(", ")})` : ""}`);
    pngs.push(await rendrePng(composants[Composant]({ slide, mise, couleur: resultat.couleur, images: { grain, ...(await imagesDe(slide)) } }), { ImageResponse, polices }));
  }
  const dossier = ecrire(nom, pngs, { "legende.txt": resultat.legende, "credits.txt": resultat.credits });
  await planche(pngs, join(DOSSIER, `${nom}-planche.png`), 5);
  console.log(`${pngs.length} slides → ${dossier} (archive : ${resultat.archive})`);
}

// --themes <fichier.json> : autre table { couleurs, pictos } à essayer (sinon, tables validées).
const propositionThemes = () => (values.themes ? lire(values.themes) : { couleurs: undefined, pictos: undefined });

// --- Analyse de programme ------------------------------------------------------------
async function programme() {
  const d = lire(values.donnees);
  const fiches = d.fiches.map(ficheLocale);
  const ordres = Object.fromEntries(d.fiches.map((f) => [f.id, f.ordre]));
  const selection = selectionProgramme(fiches, ordres);
  if (selection.erreurs.length) {
    selection.erreurs.forEach((e) => console.error(`  ✗ ${e}`));
    process.exit(1);
  }
  const controle = controlerProgramme(d.reponse, { candidatNom: d.candidat, fiches: selection.fiches });
  if (!controle.valide) {
    console.error("Réponse simulée REFUSÉE :");
    controle.erreurs.forEach((e) => console.error(`  ✗ ${e}`));
    process.exit(1);
  }
  const resultat = assemblerProgramme({ candidatNom: d.candidat, fiches: selection.fiches, programme: controle.programme, pictos: propositionThemes().pictos, credits: d.credits ?? [] });
  sortieFormat("programme", resultat, controle);
  console.log(`Moyenne calculée par le code : ${resultat.moyenne}/100 (notes : ${selection.fiches.map((f) => f.score).join(", ")})`);
  const portrait = await imagePrete(cheminVignetteNb({ nom: d.candidat, photoUrl: null }));
  await rendreFormat(values.sortie ?? "programme-riner", resultat, "CarrouselProgramme", async () => ({ portrait }));
}

// --- Thématique -------------------------------------------------------------------------
async function thematique() {
  const d = lire(values.donnees);
  const candidats = d.candidats.map((c) => ({ nom: c.nom, photoUrl: null, fiche: c.fiche ? ficheLocale(c.fiche) : null }));
  const selection = selectionThematique(d.theme, candidats);
  if (selection.erreurs.length) {
    selection.erreurs.forEach((e) => console.error(`  ✗ ${e}`));
    process.exit(1);
  }
  const controle = controlerThematique(d.reponse, { theme: d.theme, candidats: selection.candidats });
  if (!controle.valide) {
    console.error("Réponse simulée REFUSÉE :");
    controle.erreurs.forEach((e) => console.error(`  ✗ ${e}`));
    process.exit(1);
  }
  const p = propositionThemes();
  const resultat = assemblerThematique({ theme: d.theme, candidats: selection.candidats, thematique: controle.thematique, couleursThemes: p.couleurs, pictos: p.pictos, credits: d.credits ?? [] });
  sortieFormat("thematique", resultat, controle);
  console.log(`Ordre des slides : ${resultat.slides.filter((s) => s.type === "candidat").map((s) => s.nom).join(", ")}`);
  const portraits = Object.fromEntries(await Promise.all(selection.candidats.map(async (c) => [c.nom, await imagePrete(cheminVignetteNb({ nom: c.nom, photoUrl: null }))])));
  await rendreFormat(values.sortie ?? `thematique-${d.theme}`, resultat, "CarrouselThematique", async () => ({ portraits }));
}

const FORMATS = { mesure, programme, thematique };
if (!FORMATS[format]) {
  console.error("Format : mesure, programme ou thematique.");
  process.exit(1);
}
await FORMATS[format]();
