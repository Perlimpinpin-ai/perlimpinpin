import test from "node:test";
import assert from "node:assert/strict";
import {
  ajouterMarqueurConnexion,
  creerSessionClub,
  lireApresConnexion,
  retirerMarqueurConnexion,
} from "../src/lib/session-club-core.js";
import { retourValide } from "../src/lib/club-retour-core.js";
import { libelleCompte } from "../src/lib/moi-club.js";

// Parcours « je me connecte depuis une fiche et j'y reviens » : l'état
// « visiteur » d'avant la connexion ne doit jamais rester affiché.

const ARNO = { pseudo: null, nomParDefaut: "Arno F.", nom: "Arno F." };

test("retour après connexion : adresse marquée, valide, puis nettoyée en gardant la vue", () => {
  const retour = retourValide("/declarations/79?vue=expert");
  const marquee = ajouterMarqueurConnexion(retour);
  assert.equal(marquee, "/declarations/79?vue=expert&club=connecte");
  assert.equal(ajouterMarqueurConnexion("/declarations/79"), "/declarations/79?club=connecte");
  assert.equal(ajouterMarqueurConnexion("/declarations/79#commenter"), "/declarations/79?club=connecte#commenter");
  assert.equal(retirerMarqueurConnexion(`https://perlimpinpin.ai${marquee}`), "/declarations/79?vue=expert");
  assert.equal(retirerMarqueurConnexion("https://perlimpinpin.ai/declarations/79?vue=expert"), null);
  assert.equal(ajouterMarqueurConnexion("https://ailleurs.example/x"), "https://ailleurs.example/x");
});

test("après connexion, une première réponse « visiteur » ne fige pas l'état", async () => {
  const reponses = [null, ARNO]; // cookie pas encore pris en compte, puis connecté
  let appels = 0;
  const moi = await lireApresConnexion(async () => reponses[Math.min(appels++, reponses.length - 1)], { attendre: async () => {} });
  assert.equal(appels, 2);
  assert.equal(libelleCompte(moi), "Arno");
});

test("visiteur pour de vrai : on n'insiste pas plus de 3 fois", async () => {
  let appels = 0;
  const moi = await lireApresConnexion(async () => (appels++, null), { attendre: async () => {} });
  assert.equal(moi, null);
  assert.equal(appels, 3);
});

test("parcours complet : état visiteur gardé, puis relu (page restaurée, onglet revenu) → en-tête et encadré mis à jour", async () => {
  let connecte = false;
  const session = creerSessionClub({ lire: async () => (connecte ? ARNO : null) });
  const entete = [];
  const encadre = [];
  session.abonner((moi) => entete.push(libelleCompte(moi) ?? "CLUB"));
  session.abonner((moi) => encadre.push(moi ? "Merci de faire partie du Club !" : "Se connecter / Rejoindre le Club"));

  assert.equal(await session.obtenir(), null);
  assert.equal(await session.obtenir(), null); // valeur gardée : pas de nouvel appel nécessaire
  connecte = true; // connexion dans cet onglet ou un autre
  await session.relire(); // déclenché par pageshow / visibilitychange / prerenderingchange
  assert.deepEqual(entete, ["CLUB", "Arno"]);
  assert.deepEqual(encadre, ["Se connecter / Rejoindre le Club", "Merci de faire partie du Club !"]);
});

test("une seule lecture à la fois, une panne compte comme visiteur", async () => {
  let appels = 0;
  const session = creerSessionClub({
    lire: () =>
      new Promise((resolve) => {
        appels++;
        setTimeout(() => resolve(ARNO), 5);
      }),
  });
  const [a, b] = await Promise.all([session.relire(), session.obtenir()]);
  assert.equal(appels, 1);
  assert.equal(a, b);
  const enPanne = creerSessionClub({ lire: async () => { throw new Error("réseau"); } });
  assert.equal(await enPanne.obtenir(), null);
});
