import test from "node:test";
import assert from "node:assert/strict";
import {
  bienvenuesAEnvoyer,
  composerMailBienvenue,
  configSmtpClub,
  envoyerBienvenues,
  envoyerMailBienvenue,
  prenomDepuisNom,
} from "../src/lib/mail-bienvenue.js";

// Mail de bienvenue du Club : prénom, contenu, choix des destinataires et envoi.
// Ni réseau ni vrai serveur SMTP : le transport est simulé.

const ENV = {
  CLUB_SMTP_HOST: "smtp.mail.ovh.net",
  CLUB_SMTP_PORT: "587",
  CLUB_SMTP_USER: "club@perlimpinpin.ai",
  CLUB_SMTP_PASSWORD: "secret-de-test",
};
const silencieux = { log() {}, warn() {}, error() {} };

function faux(echec = null) {
  const envoyes = [];
  const creerTransport = () => ({
    async sendMail(m) {
      if (echec) throw Object.assign(new Error(`refusé pour ${m.to}`), echec);
      envoyes.push(m);
    },
  });
  return { envoyes, creerTransport };
}

test("prénom tiré du nom affiché « Prénom I. »", () => {
  assert.equal(prenomDepuisNom("Camille D."), "Camille");
  assert.equal(prenomDepuisNom("Jean-Pierre É."), "Jean-Pierre");
  assert.equal(prenomDepuisNom("Marie Anne L."), "Marie Anne");
  assert.equal(prenomDepuisNom("Matis"), "Matis");
  assert.equal(prenomDepuisNom(""), null);
  assert.equal(prenomDepuisNom(null), null);
});

test("le mail salue par le prénom et ne garde aucun repère du modèle", () => {
  const { objet, html, texte } = composerMailBienvenue({ prenom: "Camille" });
  assert.match(objet, /Bienvenue dans l’aventure Perlimpinpin/);
  assert.match(html, /Bonjour Camille,/);
  assert.match(texte, /^Bonjour Camille,/);
  assert.doesNotMatch(html, /__SALUTATION__|__MASCOTTE__|\{prénom\}/);
  assert.match(html, /https:\/\/perlimpinpin\.ai\/club\/mascotte-bienvenue\.jpg/);
  assert.match(html, /https:\/\/perlimpinpin\.ai\/relectures\/inscription/);
  assert.match(texte, /https:\/\/perlimpinpin\.ai\/nous-rejoindre/);
});

test("sans prénom : « Bonjour, » ; le prénom est échappé dans le HTML", () => {
  assert.match(composerMailBienvenue({}).html, /Bonjour,</);
  assert.match(composerMailBienvenue({ prenom: "  " }).texte, /^Bonjour,/);
  const { html } = composerMailBienvenue({ prenom: "<b>Zoé</b>" });
  assert.match(html, /Bonjour &lt;b&gt;Zoé&lt;\/b&gt;,/);
});

test("configuration SMTP : complète ou rien", () => {
  assert.equal(configSmtpClub({}), null);
  assert.equal(configSmtpClub({ ...ENV, CLUB_SMTP_PORT: "25" }), null);
  assert.equal(configSmtpClub({ ...ENV, CLUB_SMTP_PASSWORD: "" }), null);
  const c587 = configSmtpClub(ENV);
  assert.equal(c587.secure, false);
  assert.equal(c587.requireTLS, true);
  assert.equal(configSmtpClub({ ...ENV, CLUB_SMTP_PORT: "465" }).secure, true);
});

test("seuls les comptes qui viennent d'être créés reçoivent le mail", () => {
  const resultats = [
    { resultat: "creee", adherentId: 7, email: "a@x.fr", nom: "Camille D." },
    { resultat: "dejaPresente", email: "b@x.fr", nom: "Paul B." },
    { resultat: "ignoree", raison: "paiement non validé" },
    { resultat: "aCreer", email: "c@x.fr", nom: "Zoé C." },
  ];
  assert.deepEqual(bienvenuesAEnvoyer(resultats), [{ email: "a@x.fr", nom: "Camille D.", adherentId: 7 }]);
});

test("envoi : un destinataire, expéditeur du Club, prénom dans le mail", async () => {
  const { envoyes, creerTransport } = faux();
  const r = await envoyerMailBienvenue(
    { email: "camille@exemple.fr", nom: "Camille D.", adherentId: 3 },
    { env: ENV, creerTransport, log: silencieux },
  );
  assert.deepEqual(r, { statut: "envoye" });
  assert.equal(envoyes.length, 1);
  assert.equal(envoyes[0].to, "camille@exemple.fr");
  assert.match(envoyes[0].from, /club@perlimpinpin\.ai/);
  assert.match(envoyes[0].html, /Bonjour Camille,/);
});

test("envoi : rien sans configuration, et un échec ne lève pas d'exception", async () => {
  const { envoyes, creerTransport } = faux();
  const sansConfig = await envoyerMailBienvenue({ email: "a@x.fr", nom: "A" }, { env: {}, creerTransport, log: silencieux });
  assert.equal(sansConfig.statut, "non-configure");
  assert.equal(envoyes.length, 0);

  const journal = [];
  const log = { log() {}, warn() {}, error: (m) => journal.push(m) };
  const enPanne = faux({ code: "EAUTH", responseCode: 535 });
  const r = await envoyerMailBienvenue({ email: "a@x.fr", nom: "A", adherentId: 9 }, { env: ENV, creerTransport: enPanne.creerTransport, log });
  assert.deepEqual(r, { statut: "echec", erreur: "EAUTH 535" });
  // Jamais l'adresse du destinataire dans les journaux
  assert.ok(journal.every((m) => !m.includes("a@x.fr")));
  assert.match(journal[0], /adhérent n°9/);
});

test("envois en série : bilan et pause entre deux mails", async () => {
  const { envoyes, creerTransport } = faux();
  const pauses = [];
  const bilan = await envoyerBienvenues(
    [{ email: "a@x.fr", nom: "A" }, { email: "b@x.fr", nom: "B" }, { email: "", nom: "C" }],
    { env: ENV, creerTransport, log: silencieux, attendre: async (ms) => pauses.push(ms) },
  );
  assert.deepEqual(bilan, { envoyes: 2, echecs: 1 });
  assert.equal(envoyes.length, 2);
  assert.deepEqual(pauses, [2000, 2000]);
});
