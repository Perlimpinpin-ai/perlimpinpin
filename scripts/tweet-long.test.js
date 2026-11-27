import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  articleDepuisFiche,
  assemblerTweetLong,
  construireMessageTweetLong,
  contenuAvecTweetLong,
  controlerTweetLong,
  EXEMPLE_CORPS,
  genererTweetLongCore,
  introDe,
  ligneScore,
  normaliserCorps,
  pastilleTweetLong,
  signature,
  tweetLongAffiche,
  urlTweetLong,
} from "../src/lib/tweet-long.js";
import { estimerTweetLongCore, genererTweetLongPourFicheCore } from "../src/lib/tweet-long-action-core.js";
import { FICHE } from "./lib/recit-fixture.js";

// Texte final exact visé (prompt Claude Code, section 2 bis) : fiche
// Retailleau, heures supplémentaires, 51/100.
const TEXTE_RETAILLEAU = `Bruno Retailleau veut supprimer les cotisations sur les heures supplémentaires. Problème : les salariés en sont déjà largement exonérés.

Avec sa proposition de supprimer les cotisations sociales, hors CSG et CRDS, au-delà de 1 623 heures de travail par an, le candidat entend remettre au goût du jour le « travailler plus pour gagner plus ». À la clé, un gain annoncé de 230 € par mois.

Mais que changerait réellement cette réforme ? L'intelligence artificielle Perlimpinpin a passé la proposition au crible.

→ Pour les salariés, peu de nouveautés. Les 230 € annoncés viendraient essentiellement des heures travaillées en plus, et non de la réforme elle-même.

→ Pour les entreprises, en revanche, un véritable avantage. Elles paieraient moins de cotisations, y compris sur les heures supplémentaires qu'elles font déjà effectuer. De quoi les inciter à en proposer davantage.

Reste à savoir si elles le feront. En 2007, la France avait déjà expérimenté la défiscalisation des heures supplémentaires, sans augmentation démontrée du temps de travail effectif. La proposition de Retailleau se distingue toutefois par une incitation financière plus forte pour les employeurs.

Sur le papier, la mesure est réalisable. Mais son succès repose sur un pari : que les entreprises proposent suffisamment d'heures supplémentaires pour augmenter le pouvoir d'achat des salariés et compenser les pertes de recettes publiques.

Rien ne permet aujourd'hui de garantir que ce pari sera réussi.

🟠 Score Perlimpinpin : 51/100 — Plausible sous condition.

Notre analyse complète, nos calculs et toutes nos sources sont accessibles gratuitement ici : https://perlimpinpin.ai

Perlimpinpin est une association indépendante et apartisane, qui développe une intelligence artificielle en constante évolution pour éclairer le débat public par les faits. Vos retours contribuent à nous améliorer !`;

// Corps valide pour la fiche Roussel « Smic à 2 200 euros brut » (fixture),
// tous ses nombres présents dans la fiche.
const CORPS_ROUSSEL = `Fabien Roussel veut porter le Smic à 2 200 euros brut par mois. Une hausse de 20 % d'un coup, pour 3 millions de salariés.

Aujourd'hui, le Smic brut est de 1 830 euros. Le candidat veut redonner du pouvoir d'achat aux bas salaires, sans attendre.

Mais une hausse aussi rapide est-elle tenable ? Nous avons soumis la proposition à l'intelligence artificielle Perlimpinpin, qui a épluché les chiffres.

→ Pour les salariés au Smic, le gain serait réel et immédiat sur la fiche de paie.

→ Pour les petites entreprises, la facture n'est pas chiffrée. C'est le principal angle mort de la proposition.

En Espagne, le salaire minimum est passé de 736 à 900 euros en 2019. L'emploi y a ensuite moins progressé, sans que l'effet soit tranché.

Concrètement, la mesure tiendrait mieux avec une hausse par paliers annuels, une étude d'impact publiée et un allègement ciblé pour les PME.

Le gain pour les salariés est réel. Reste à savoir qui paiera la facture.`;

const CONTEXTE_ROUSSEL = { article: articleDepuisFiche(FICHE), candidatNom: "Fabien Roussel", score: 51, url: "https://perlimpinpin.ai/declarations/42" };
const PROMPT = readFileSync(new URL("../data/prompt-tweet-long.md", import.meta.url), "utf-8");

// --- Ce que le code écrit -------------------------------------------------------------

test("ligne de score : pastilles et paliers aux bornes du barème du 16 nov. 2026", () => {
  assert.equal(ligneScore(34), "🔴 Score Perlimpinpin : 34/100 — Fragile.");
  assert.equal(ligneScore(35), "🟠 Score Perlimpinpin : 35/100 — Partiellement fondé.");
  assert.equal(ligneScore(64), "🟠 Score Perlimpinpin : 64/100 — Plausible sous condition.");
  assert.equal(ligneScore(65), "🟢 Score Perlimpinpin : 65/100 — Solide et chiffré.");
  assert.equal(pastilleTweetLong(0), "🔴");
  assert.equal(pastilleTweetLong(100), "🟢");
  assert.equal(ligneScore(51.5), "🟠 Score Perlimpinpin : 51.5/100 — Plausible sous condition.");
});

test("assemblage : le corps Retailleau + 51 + perlimpinpin.ai donnent exactement le texte final visé, sans avertissement de longueur", () => {
  const texte = assemblerTweetLong(EXEMPLE_CORPS, { score: 51, url: "https://perlimpinpin.ai" });
  assert.equal(texte, TEXTE_RETAILLEAU);
  const controle = controlerTweetLong(EXEMPLE_CORPS, { article: EXEMPLE_CORPS, candidatNom: "Bruno Retailleau", score: 51, url: "https://perlimpinpin.ai" });
  assert.equal(controle.valide, true, controle.erreurs.join(" | "));
  assert.equal(controle.texte, TEXTE_RETAILLEAU);
  assert.ok(!controle.avertissements.some((a) => a.startsWith("Texte final")), controle.avertissements.join(" | "));
});

test("prompt : l'exemple de référence du fichier est bien le corps Retailleau, placeholders remplacés", () => {
  const exemple = PROMPT.replace(/\r\n/g, "\n").split("\n---\n")[1];
  assert.equal(exemple.trim(), EXEMPLE_CORPS);
  const message = construireMessageTweetLong(PROMPT, FICHE, "https://perlimpinpin.ai/declarations/42");
  assert.ok(!message.includes("[ARTICLE_COMPLET]") && !message.includes("[URL_ARTICLE]"));
  assert.match(message, /LIEN DE L'ANALYSE :\nhttps:\/\/perlimpinpin\.ai\/declarations\/42$/);
  assert.match(message, /accessibles gratuitement ici : \[URL\]/);
  assert.match(message, /Fabien Roussel veut porter le Smic à 2 200 euros brut/);
});

test("article : texte public de la fiche, jamais le score, les sous-notes ni le palier", () => {
  const article = articleDepuisFiche({
    ...FICHE,
    titre_fiche: "Smic à 2 200 euros brut",
    resume_court: "Roussel veut un Smic à 2 200 euros.",
    analyse_par_criteres: [{ critere: "efficacite", titre: "Efficacité", note: 12, note_max: 30, texte: "Le gain est réel." }],
    notation_detaillee: { ...FICHE.notation_detaillee, score_total: 51, appreciation: "plausible sous condition" },
    reseaux_recit: { tweet: { accroche: "ancien" } },
  });
  for (const attendu of ["## Résumé", "## La mesure", "## Raisonnement par critère\nEfficacité : Le gain est réel.", "## Verdict (forces et faiblesses)", "## Ce qui la ferait tenir\n- Étaler la hausse", "## Sources\n- Ministère du Travail, montants du Smic 2026"]) {
    assert.ok(article.includes(attendu), attendu);
  }
  assert.ok(!/score_total|51|plausible sous condition|INCERTAIN|ancien|https?:/i.test(article), article);
  // Ancien format : une chaîne, sous-notes retirées.
  const ancien = articleDepuisFiche({ analyse_par_criteres: "Opérationnalité & Moyens (16/30, sans plafond). Un décret suffit. D'où 5/10 INCERTAIN. Efficacité (9/30, FRAGILE). Gain modeste." });
  assert.equal(ancien, "## Raisonnement par critère\nOpérationnalité & Moyens. Un décret suffit. Efficacité. Gain modeste.");
});

test("lien : URL canonique de la fiche publiée, accueil du site sinon (avec avertissement)", () => {
  assert.equal(urlTweetLong({ propositionId: 42, publie: true }), "https://perlimpinpin.ai/declarations/42");
  assert.equal(urlTweetLong({ propositionId: 42, publie: false }), "https://perlimpinpin.ai");
  const controle = controlerTweetLong(CORPS_ROUSSEL, { ...CONTEXTE_ROUSSEL, url: "https://perlimpinpin.ai", publie: false });
  assert.ok(controle.avertissements.some((a) => a.startsWith("Fiche pas encore publiée")));
  assert.ok(controle.texte.endsWith(signature("https://perlimpinpin.ai")));
});

// --- Mise en page -------------------------------------------------------------------------

test("mise en page : une ligne vide entre paragraphes, pas d'espace final, flèches → isolées et conservées", () => {
  const brut = "```\nAccroche.  \n\n\n\nPromesse.\n→ Premier point.\n→ Second point.\nConclusion.   \n```";
  assert.equal(normaliserCorps(brut), "Accroche.\n\nPromesse.\n\n→ Premier point.\n\n→ Second point.\n\nConclusion.");
  assert.equal(normaliserCorps("---\nTexte.\n---"), "Texte.");
});

// --- Contrôles : refus ------------------------------------------------------------------

test("fiche Roussel « Smic à 2 200 euros brut » en simulation : accepté, ligne de score et signature du code", () => {
  const controle = controlerTweetLong(CORPS_ROUSSEL, CONTEXTE_ROUSSEL);
  assert.equal(controle.valide, true, controle.erreurs.join(" | "));
  assert.ok(controle.texte.startsWith(`${CORPS_ROUSSEL}\n\n🟠 Score Perlimpinpin : 51/100 — Plausible sous condition.\n\nNotre analyse complète`));
  assert.ok(controle.texte.includes("ici : https://perlimpinpin.ai/declarations/42\n\nPerlimpinpin est une association"));
  assert.equal(controle.texte.match(/→/g).length, 2);
  assert.deepEqual(controle.avertissements, []);
});

test("refus : « 51/100 » écrit par le modèle", () => {
  const controle = controlerTweetLong(CORPS_ROUSSEL.replace("Le gain pour les salariés est réel.", "Verdict : 51/100."), CONTEXTE_ROUSSEL);
  assert.equal(controle.valide, false);
  assert.ok(controle.erreurs.some((e) => /Score ou note sur 100/.test(e)));
});

test("refus : palier écrit par le modèle, score « sur 100 »", () => {
  assert.ok(controlerTweetLong(`${CORPS_ROUSSEL} Une mesure plausible sous condition.`, CONTEXTE_ROUSSEL).erreurs.some((e) => /Palier « Plausible sous condition »/.test(e)));
  assert.equal(controlerTweetLong(CORPS_ROUSSEL.replace("20 %", "20 sur 100"), CONTEXTE_ROUSSEL).valide, false);
});

test("refus : chiffre inventé (absent de la fiche)", () => {
  const controle = controlerTweetLong(CORPS_ROUSSEL.replace("3 millions de salariés", "3,4 millions de salariés"), CONTEXTE_ROUSSEL);
  assert.equal(controle.valide, false);
  assert.ok(controle.erreurs.some((e) => e === "Nombre(s) absent(s) de la fiche : 3,4."));
});

test("refus : hashtag « #Presidentielle2027 »", () => {
  const controle = controlerTweetLong(`${CORPS_ROUSSEL}\n\n#Presidentielle2027`, CONTEXTE_ROUSSEL);
  assert.equal(controle.valide, false);
  assert.ok(controle.erreurs.some((e) => /Hashtag .*#Presidentielle2027/.test(e)));
});

test("refus : lien écrit par le modèle (adresse complète ou nom de domaine)", () => {
  assert.ok(controlerTweetLong(`${CORPS_ROUSSEL}\n\nhttps://perlimpinpin.ai/declarations/42`, CONTEXTE_ROUSSEL).erreurs.some((e) => /Lien écrit/.test(e)));
  assert.equal(controlerTweetLong(`${CORPS_ROUSSEL} À lire sur perlimpinpin.ai.`, CONTEXTE_ROUSSEL).valide, false);
});

// --- Corrections automatiques ------------------------------------------------------------

test("emoji et drapeau : retirés, avertissement ; flèches conservées", () => {
  const controle = controlerTweetLong(CORPS_ROUSSEL.replace("Fabien Roussel veut", "🚨 Fabien Roussel veut").replace("En Espagne,", "En Espagne 🇪🇸,"), CONTEXTE_ROUSSEL);
  assert.equal(controle.valide, true, controle.erreurs.join(" | "));
  assert.ok(controle.corps.startsWith("Fabien Roussel veut"));
  assert.ok(controle.corps.includes("En Espagne,"));
  assert.ok(!/\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(controle.corps));
  assert.equal(controle.corps.match(/→/g).length, 2);
  assert.ok(controle.avertissements.includes("Emoji ou drapeau dans le texte : retiré."));
});

test("tiret cadratin dans le corps : remplacé par une virgule ; celui de la ligne de score reste", () => {
  const controle = controlerTweetLong(CORPS_ROUSSEL.replace("Une hausse de 20 % d'un coup", "Une hausse de 20 % — d'un coup"), CONTEXTE_ROUSSEL);
  assert.ok(controle.corps.includes("Une hausse de 20 %, d'un coup"));
  assert.ok(!controle.corps.includes("—"));
  assert.ok(controle.texte.includes("51/100 — Plausible"));
  assert.ok(controle.avertissements.includes("Tiret cadratin dans le texte : remplacé par une virgule."));
});

// --- Avertissements ----------------------------------------------------------------------

test("avertissements : longueur, candidat absent des deux premières phrases, accroche générique, IA non mentionnée", () => {
  const court = controlerTweetLong("Nouvelle analyse. Le Smic à 2 200 euros. Une hausse de 20 %.", CONTEXTE_ROUSSEL);
  assert.equal(court.valide, true, court.erreurs.join(" | "));
  const texte = court.avertissements.join(" | ");
  assert.match(texte, /Texte final de \d[\d\s]* caractères \(cible 1\s200 à 2\s000\)/);
  assert.match(texte, /Fabien Roussel n’est pas nommé dans les deux premières phrases/);
  assert.match(texte, /formule générique/);
  assert.match(texte, /L’intelligence artificielle Perlimpinpin n’est pas mentionnée/);
  assert.match(controlerTweetLong(`Perlimpinpin a analysé la proposition de Fabien Roussel. ${CORPS_ROUSSEL}`, CONTEXTE_ROUSSEL).avertissements.join(" | "), /formule générique/);
});

test("avertissements : introduction identique à celle du dernier tweet long ; formulation de l'exemple reprise", () => {
  const intro = introDe(CORPS_ROUSSEL);
  assert.equal(intro, "Nous avons soumis la proposition à l'intelligence artificielle Perlimpinpin, qui a épluché les chiffres.");
  const meme = controlerTweetLong(CORPS_ROUSSEL, { ...CONTEXTE_ROUSSEL, introPrecedente: intro });
  assert.ok(meme.avertissements.some((a) => a.startsWith("Introduction de l’analyse identique")));
  const reprise = controlerTweetLong(
    CORPS_ROUSSEL.replace("Nous avons soumis la proposition à l'intelligence artificielle Perlimpinpin, qui a épluché les chiffres.", "L'intelligence artificielle Perlimpinpin a passé la proposition au crible."),
    CONTEXTE_ROUSSEL,
  );
  assert.ok(reprise.avertissements.some((a) => a.startsWith("Formulation de l’exemple reprise telle quelle") && a.includes("au crible")), reprise.avertissements.join(" | "));
  // Une transition courte conseillée (« Sur le papier, la mesure est réalisable ») ne compte pas.
  assert.ok(!controlerTweetLong(`${CORPS_ROUSSEL} Sur le papier, la mesure est réalisable.`, CONTEXTE_ROUSSEL).avertissements.some((a) => a.startsWith("Formulation")));
});

// --- Génération, stockage, affichage -------------------------------------------------

test("génération : second essai après refus, avec les raisons ; coût additionné", async () => {
  const messages = [];
  const reponses = [`${CORPS_ROUSSEL} 51/100.`, CORPS_ROUSSEL];
  const resultat = await genererTweetLongCore({
    contenu: FICHE,
    candidatNom: "Fabien Roussel",
    score: 51,
    propositionId: 42,
    publie: true,
    prompt: PROMPT,
    appeler: async (message) => {
      messages.push(message);
      return { texte: reponses.shift(), usage: { input_tokens: 3000, output_tokens: 600 } };
    },
    journal: { error() {} },
    date: () => "2026-11-27T10:00:00.000Z",
  });
  assert.equal(messages.length, 2);
  assert.match(messages[1], /ATTENTION : ton texte précédent a été refusé/);
  assert.match(messages[1], /Score ou note sur 100/);
  assert.deepEqual(Object.keys(resultat.tweetLong), ["texte", "corps_modele", "date", "cout", "avertissements"]);
  assert.equal(resultat.tweetLong.corps_modele, CORPS_ROUSSEL);
  assert.ok(resultat.cout > 0);
});

test("génération : deux refus, rien à enregistrer", async () => {
  const resultat = await genererTweetLongCore({ contenu: FICHE, candidatNom: "Fabien Roussel", score: 51, propositionId: 42, publie: true, prompt: PROMPT, appeler: async () => ({ texte: "#Smic", usage: {} }), journal: { error() {} } });
  assert.equal(resultat.tweetLong, null);
  assert.ok(resultat.errors.some((e) => /Hashtag/.test(e)));
});

test("stockage : seule la clé reseaux_tweet_long change ; affichage : le nouveau en priorité, l'ancien sinon", () => {
  const contenu = { ...FICHE, reseaux_recit: { couverture: {} } };
  const stocke = { texte: "x", corps_modele: CORPS_ROUSSEL, date: "2026-11-27T10:00:00.000Z", cout: 0.02, avertissements: ["Fiche pas encore publiée : …"] };
  const apres = contenuAvecTweetLong(contenu, stocke);
  assert.deepEqual(Object.keys(apres).filter((k) => apres[k] !== contenu[k]), ["reseaux_tweet_long"]);
  const affiche = tweetLongAffiche(apres, { score: 51, propositionId: 42, publie: true, ancienTweet: "ancien" });
  assert.equal(affiche.source, "tweet-long");
  assert.ok(affiche.texte.endsWith(signature("https://perlimpinpin.ai/declarations/42")));
  assert.deepEqual(affiche.avertissements, []);
  assert.equal(tweetLongAffiche(contenu, { score: 51, propositionId: 42, publie: true, ancienTweet: "ancien" }).source, "carrousel");
  assert.equal(tweetLongAffiche(FICHE, { score: 51, propositionId: 42, publie: true }), null);
});

// --- Bouton (dépendances injectées, sans base ni appel payant) ------------------------

function fauxPrisma({ statut = "publie" } = {}) {
  const ecrits = [];
  return {
    ecrits,
    proposition: {
      async findUnique() {
        return { id: 42, theme: "economie", candidat: { nom: "Fabien Roussel" }, analyses: [{ id: 7, statut, scoreFaisabilite: 51, updatedAt: "t0", contenuComplet: FICHE }] };
      },
    },
    analyse: {
      async updateMany(arg) {
        ecrits.push(arg);
        return { count: 1 };
      },
    },
  };
}

test("bouton : mode édition requis ; estimation sans appel ; génération écrite après sauvegarde", async () => {
  const commun = { brouillon: false, isEditor: async () => true, lirePrompt: async () => PROMPT };
  assert.equal((await estimerTweetLongCore(42, { ...commun, isEditor: async () => false, prisma: fauxPrisma() })).ok, false);
  const estimation = await estimerTweetLongCore(42, { ...commun, prisma: fauxPrisma() });
  assert.ok(estimation.ok && estimation.min > 0 && estimation.max > estimation.min && estimation.publie === true);

  const prisma = fauxPrisma({ statut: "brouillon" });
  const sauvegardes = [];
  let recu = null;
  const resultat = await genererTweetLongPourFicheCore(42, {
    ...commun,
    prisma,
    dryRun: false,
    cleConfiguree: true,
    sauvegarder: async (ligne) => sauvegardes.push(ligne) && "logs/sauvegardes/x.json",
    introPrecedente: async () => "Phrase d'avant.",
    generer: async (contenu, options) => {
      recu = options;
      return { tweetLong: { texte: "t", corps_modele: CORPS_ROUSSEL, date: "d", cout: 0.02, avertissements: [] }, cout: 0.02, avertissements: [] };
    },
  });
  assert.equal(resultat.ok, true, resultat.erreur);
  assert.deepEqual(recu, { candidatNom: "Fabien Roussel", score: 51, propositionId: 42, publie: false, introPrecedente: "Phrase d'avant." });
  assert.equal(sauvegardes.length, 1);
  assert.deepEqual(Object.keys(prisma.ecrits[0].data.contenuComplet).filter((k) => !(k in FICHE)), ["reseaux_tweet_long"]);
  assert.deepEqual(prisma.ecrits[0].where, { id: 7, updatedAt: "t0" });
});

test("bouton : texte refusé → rien n'est écrit ; TEST_DRY_RUN → aucun appel", async () => {
  const prisma = fauxPrisma();
  const commun = { brouillon: false, isEditor: async () => true, prisma, cleConfiguree: true, sauvegarder: async () => null };
  const refuse = await genererTweetLongPourFicheCore(42, { ...commun, dryRun: false, generer: async () => ({ tweetLong: null, cout: 0.03, errors: ["Hashtag écrit par le modèle."] }) });
  assert.equal(refuse.ok, false);
  assert.match(refuse.erreur, /refusé après deux essais, rien n’est enregistré\. Hashtag/);
  let appele = false;
  const simule = await genererTweetLongPourFicheCore(42, { ...commun, dryRun: true, generer: async () => (appele = true) });
  assert.equal(simule.simulation, true);
  assert.equal(appele, false);
  assert.equal(prisma.ecrits.length, 0);
});
