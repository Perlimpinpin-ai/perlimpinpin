import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SCENES_REEL,
  TEXTES_FIXES,
  assemblerReel,
  cheminImageReel,
  controlerReel,
  deCandidat,
  formatDuree,
  lireReponseReel,
  nombreDeMots,
  nombreDePhrases,
  palierReel,
  reelPourStockage,
  variablesDuReel,
  versionReel,
} from "../src/lib/reel.js";
import { appreciationCarte } from "../src/lib/carte.js";

const FICHE = {
  titre_fiche: "Bloquer le carburant à 1,70 €",
  verdict_final: "La loi permet un prix plafond, mais le coût atteint 12 milliards d'euros par an. Le Portugal a essayé en 2022.",
  sources_utilisees: [{ titre: "Rapport 2023" }],
};

// Réponse valide du modèle, environ 200 mots une fois assemblée.
function reponseValide() {
  return {
    scenes: [
      {
        id: "accroche",
        voix: "Bloquer le prix du carburant à un euro soixante-dix, c'est possible ?",
        sousTitres: "Bloquer le prix du carburant à 1,70 €, c'est possible ?",
        ecran: { titre: "Le carburant bloqué à 1,70 €", chiffre: "1,70 €" },
        icone: "pompe",
      },
      { id: "presentation", voix: "qu'elle porte depuis deux mille vingt-deux", sousTitres: "qu'elle porte depuis 2022", ecran: {} },
      {
        id: "tient",
        voix: "Bonne nouvelle, la loi permet de fixer un prix plafond. L'État l'a déjà fait par le passé.",
        sousTitres: "Bonne nouvelle, la loi permet de fixer un prix plafond. L'État l'a déjà fait par le passé.",
        ecran: { tampon: "C'EST LÉGAL" },
        icone: "balance",
      },
      {
        id: "hic",
        voix: "Sauf que voilà. Bloquer le prix, ça coûte douze milliards d'euros par an. Qui paie la différence ? Vous voyez le problème ?",
        sousTitres: "Sauf que voilà. Bloquer le prix, ça coûte 12 milliards d'euros par an. Qui paie la différence ? Vous voyez le problème ?",
        ecran: { chiffre: "12 Md€", legende: "par an pour bloquer le prix" },
        icone: "pieces",
      },
      {
        id: "preuve",
        voix: "Le Portugal a essayé en deux mille vingt-deux. Les stations ont vite manqué de carburant.",
        sousTitres: "Le Portugal a essayé en 2022. Les stations ont vite manqué de carburant.",
        ecran: { titre: "Le Portugal, 2022" },
        icone: "globe",
      },
      {
        id: "facture",
        voix: "Douze milliards par an, c'est la facture pour l'État. Et elle grimpe si le baril s'envole.",
        sousTitres: "12 milliards par an, c'est la facture pour l'État. Et elle grimpe si le baril s'envole.",
        ecran: { chiffre: "12 milliards", legende: "par an, payés par l'État" },
        icone: "billet",
      },
      {
        id: "nuance",
        voix: "Si le prix du pétrole baisse, la facture fond d'autant. Tout dépend donc du marché mondial.",
        sousTitres: "Si le prix du pétrole baisse, la facture fond d'autant. Tout dépend donc du marché mondial.",
        ecran: { titre: "Tout dépend du baril" },
        icone: "baril",
      },
      {
        id: "verdict",
        voix: "La loi le permet… mais à ce prix-là, gare à la panne sèche !",
        sousTitres: "La loi le permet… mais à ce prix-là, gare à la panne sèche !",
        ecran: {},
      },
    ],
  };
}

const CONTEXTE = { ficheFinale: FICHE, candidatNom: "Marine Le Pen", score: 38 };

test("les 9 scènes, dans l'ordre", () => {
  assert.deepEqual(
    SCENES_REEL.map((s) => s.id),
    ["accroche", "presentation", "tient", "hic", "preuve", "facture", "nuance", "verdict", "appel"],
  );
});

test("petits outils : mots, phrases, durée, « de » / « d' »", () => {
  assert.equal(nombreDeMots("Alors, verdict ? Ici, trente-huit sur cent."), 6);
  assert.equal(nombreDePhrases("Sauf que voilà. Vous voyez le problème ? Oui !"), 3);
  assert.equal(nombreDePhrases("La loi le permet… mais à ce prix-là, gare !"), 2);
  assert.equal(formatDuree(88), "1 min 28 s");
  assert.equal(formatDuree(60), "1 min");
  assert.equal(formatDuree(45), "45 s");
  assert.equal(deCandidat("Marine Le Pen"), "de Marine Le Pen");
  assert.equal(deCandidat("Édouard Philippe"), "d’Édouard Philippe");
});

test("palier et couleur viennent du barème et de la table des cartes X", () => {
  const palier = palierReel(38);
  assert.equal(palier.label, "Partiellement fondé");
  assert.equal(palier.couleur, appreciationCarte(38).score);
  assert.equal(palierReel(22).label, "Fragile");
  assert.equal(palierReel(80).label, "Exemplaire");
  assert.equal(palierReel(79).label, "Solide et chiffré");
});

test("réponse valide : acceptée, assemblée avec les fixes", () => {
  const resultat = controlerReel(reponseValide(), CONTEXTE);
  assert.deepEqual(resultat.erreurs, []);
  assert.equal(resultat.valide, true);
  const { scenes, texteVoix, texteSousTitres } = resultat.assemble;
  assert.equal(scenes.length, 9);
  assert.ok(scenes[0].voix.startsWith(TEXTES_FIXES.accroche));
  assert.equal(
    scenes[1].voix,
    `Une promesse de Marine Le Pen, qu'elle porte depuis deux mille vingt-deux. ${TEXTES_FIXES.presentation}`,
  );
  assert.ok(scenes[7].voix.includes("Ici, trente-huit sur cent. Partiellement fondé."));
  assert.ok(scenes[7].sousTitres.includes("Ici, 38 sur 100. Partiellement fondé."));
  assert.ok(scenes[7].voix.endsWith("gare à la panne sèche !"));
  assert.equal(scenes[8].voix, TEXTES_FIXES.appel);
  assert.equal(texteVoix.split("\n\n").length, 9);
  assert.equal(texteSousTitres.split("\n\n").length, 9);
  assert.equal(scenes[7].ecran.couleur, appreciationCarte(38).score);
});

test("le score en lettres gère une décimale", () => {
  const { assemble } = controlerReel(reponseValide(), { ...CONTEXTE, score: 38.5 });
  assert.ok(assemble.scenes[7].voix.includes("trente-huit virgule cinq sur cent"));
  assert.ok(assemble.scenes[7].sousTitres.includes("38,5 sur 100"));
});

test("présentation sans précision", () => {
  const raw = reponseValide();
  raw.scenes[1] = { id: "presentation", voix: "", sousTitres: "", ecran: {} };
  const { valide, assemble } = controlerReel(raw, CONTEXTE);
  assert.equal(valide, true);
  assert.equal(assemble.scenes[1].voix, `Une promesse de Marine Le Pen. ${TEXTES_FIXES.presentation}`);
});

test("refus : nombre des sous-titres absent de la fiche", () => {
  const raw = reponseValide();
  raw.scenes[3].sousTitres = raw.scenes[3].sousTitres.replace("12 milliards", "15 milliards");
  const { valide, erreurs } = controlerReel(raw, CONTEXTE);
  assert.equal(valide, false);
  assert.ok(erreurs.some((e) => e.includes("« 15 »")));
});

test("refus : nombre à l'écran absent de la fiche", () => {
  const raw = reponseValide();
  raw.scenes[5].ecran.chiffre = "40 milliards";
  const { valide, erreurs } = controlerReel(raw, CONTEXTE);
  assert.equal(valide, false);
  assert.ok(erreurs.some((e) => e.includes("« 40 »")));
});

test("refus : deux-points ou tiret cadratin dans la voix", () => {
  const raw = reponseValide();
  raw.scenes[2].voix = "Bonne nouvelle : la loi permet un plafond. L'État l'a déjà fait.";
  raw.scenes[4].voix = "Le Portugal a essayé — et ça a coincé. Les stations ont manqué de carburant.";
  const { valide, erreurs } = controlerReel(raw, CONTEXTE);
  assert.equal(valide, false);
  assert.ok(erreurs.some((e) => e.includes("deux-points")));
  assert.ok(erreurs.some((e) => e.includes("tiret cadratin")));
});

test("refus : icône hors liste ou manquante", () => {
  const raw = reponseValide();
  raw.scenes[0].icone = "fusee";
  delete raw.scenes[2].icone;
  const { valide, erreurs } = controlerReel(raw, CONTEXTE);
  assert.equal(valide, false);
  assert.ok(erreurs.some((e) => e.includes("« fusee » hors de la liste")));
  assert.ok(erreurs.some((e) => e.includes("« tient » : icône manquante")));
});

test("refus : JSON invalide (pas de scenes, scène manquante, doublon, id inconnu)", () => {
  assert.equal(controlerReel(null, CONTEXTE).valide, false);
  assert.equal(controlerReel({ scenes: "non" }, CONTEXTE).valide, false);
  const manquante = reponseValide();
  manquante.scenes.splice(4, 1);
  assert.ok(lireReponseReel(manquante).erreurs.some((e) => e.includes("« preuve » manque")));
  const doublon = reponseValide();
  doublon.scenes.push(doublon.scenes[0]);
  assert.ok(lireReponseReel(doublon).erreurs.some((e) => e.includes("deux fois")));
  const inconnue = reponseValide();
  inconnue.scenes.push({ id: "bonus", voix: "x", sousTitres: "x" });
  assert.ok(lireReponseReel(inconnue).erreurs.some((e) => e.includes("« bonus » inconnu")));
  const vide = reponseValide();
  vide.scenes[3].voix = "";
  assert.equal(controlerReel(vide, CONTEXTE).valide, false);
});

test("avertissements (sans refus) : écran trop long, champ manquant, chiffres dans la voix, phrases", () => {
  const raw = reponseValide();
  raw.scenes[0].ecran.titre = "Un titre beaucoup trop long pour tenir sur l'écran du téléphone";
  delete raw.scenes[2].ecran.tampon;
  raw.scenes[4].voix = "Le Portugal a essayé en 2022. Les stations ont vite manqué de carburant.";
  raw.scenes[2].voix = "La loi permet de fixer un prix plafond.";
  const { valide, avertissements } = controlerReel(raw, CONTEXTE);
  assert.equal(valide, true);
  assert.ok(avertissements.some((a) => a.includes("« titre » trop long")));
  assert.ok(avertissements.some((a) => a.includes("« tampon » manque")));
  assert.ok(avertissements.some((a) => a.includes("chiffres dans la voix")));
  assert.ok(avertissements.some((a) => a.includes("« tient » : 1 phrase(s)")));
});

test("avertissement de durée hors de 1 min 15 à 1 min 45", () => {
  const raw = reponseValide();
  const long = " Et ce n'est pas tout, il faut aussi compter les effets sur les finances publiques pendant des années.".repeat(12);
  raw.scenes[6].voix += long;
  raw.scenes[6].sousTitres += long;
  const { valide, avertissements, assemble } = controlerReel(raw, CONTEXTE);
  assert.equal(valide, true);
  assert.ok(assemble.dureeEstimee > 105);
  assert.ok(avertissements.some((a) => a.startsWith("Durée estimée")));
});

test("avertissement si le candidat n'est pas nommé", () => {
  const { avertissements, assemble } = controlerReel(reponseValide(), { ...CONTEXTE, candidatNom: "" });
  assert.ok(avertissements.some((a) => a.startsWith("Candidat non nommé")));
  assert.ok(assemble.scenes[1].voix.startsWith("Une promesse de ce candidat"));
});

test("stockage puis réassemblage : même script", () => {
  const resultat = controlerReel(reponseValide(), CONTEXTE);
  const reel = reelPourStockage(resultat, { candidatNom: "Marine Le Pen", score: 38, date: new Date("2026-11-17T10:00:00Z") });
  assert.equal(reel.scenes.length, 8);
  assert.equal(reel.genereLe, "2026-11-17T10:00:00.000Z");
  assert.equal(reel.score, 38);
  const rejoue = assemblerReel(variablesDuReel(JSON.parse(JSON.stringify(reel))), { candidatNom: "Marine Le Pen", score: 38 });
  assert.equal(rejoue.texteVoix, reel.texteVoix);
  assert.equal(rejoue.nbMots, reel.nbMots);
  assert.equal(variablesDuReel(null), null);
});

test("version et chemin des images", () => {
  const resultat = controlerReel(reponseValide(), CONTEXTE);
  const reel = reelPourStockage(resultat, { candidatNom: "Marine Le Pen", score: 38 });
  const v1 = versionReel({ analyseId: 7, candidatNom: "Marine Le Pen", score: 38, reel });
  const v2 = versionReel({ analyseId: 7, candidatNom: "Marine Le Pen", score: 39, reel });
  assert.match(v1, /^7-[0-9a-f]{8}$/);
  assert.notEqual(v1, v2);
  assert.equal(
    cheminImageReel({ propositionId: 93, scene: 8, theme: "clair", brouillon: true, version: v1 }),
    `/test/reels/93/image?scene=8&theme=clair&v=${v1}&brouillon=1`,
  );
});
