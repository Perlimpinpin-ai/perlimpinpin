import test from "node:test";
import assert from "node:assert/strict";
import {
  DUREE_JETON_MS,
  URL_PRODUCTION,
  analyserJeton,
  creerJeton,
  jetonValide,
  lienAfficheEnLocal,
  lienNouveauMotDePasse,
  urlSite,
} from "../src/lib/mot-de-passe-oublie-core.js";
import { cheminRelectureProtege, creerSession } from "../src/lib/relecture-auth-core.js";
import { EXPEDITEURS, composerMailMotDePasse, envoyerMailMotDePasse } from "../src/lib/mail-mot-de-passe.js";

// « Mot de passe oublié » de /relectures et /live : jetons signés (sans base),
// URL des liens, mail. Aucune base de données, aucun Next.

const SECRET = "secret-de-test-tres-long-pour-hmac";
const T0 = 1_800_000_000_000;
const HASH = "$2b$12$abcdefghijklmnopqrstuuOldHashOfTheCurrentPasswordxxxxxx";
const AUTRE_HASH = "$2b$12$abcdefghijklmnopqrstuuNewHashAfterThePasswordChangeyyy";

function jeton(overrides = {}) {
  return creerJeton({ secret: SECRET, espace: "relectures", id: 12, motDePasseHash: HASH, maintenant: T0, ...overrides });
}

function valide(valeur, overrides = {}) {
  return jetonValide({
    secret: SECRET,
    espace: "relectures",
    jeton: analyserJeton(valeur),
    motDePasseHash: HASH,
    maintenant: T0 + 1000,
    ...overrides,
  });
}

test("un jeton tout juste émis est valable", () => {
  const j = jeton();
  assert.match(j, /^12\.\d+\.[A-Za-z0-9_-]+$/);
  assert.equal(valide(j), true);
  assert.deepEqual({ id: analyserJeton(j).id, expiration: analyserJeton(j).expiration }, { id: 12, expiration: T0 + DUREE_JETON_MS });
});

test("le jeton expire au bout d'une heure", () => {
  const j = jeton();
  assert.equal(valide(j, { maintenant: T0 + DUREE_JETON_MS - 1 }), true);
  assert.equal(valide(j, { maintenant: T0 + DUREE_JETON_MS }), false);
});

test("usage unique : une fois le mot de passe changé, le lien ne vaut plus", () => {
  assert.equal(valide(jeton(), { motDePasseHash: AUTRE_HASH }), false);
});

test("un jeton d'un espace ne vaut pas pour l'autre", () => {
  const j = jeton({ espace: "live" });
  assert.equal(valide(j), false);
  assert.equal(valide(j, { espace: "live" }), true);
});

test("jeton falsifié : autre compte, autre expiration, autre secret, signature modifiée", () => {
  const j = jeton();
  const [, exp, sig] = j.split(".");
  assert.equal(valide(`13.${exp}.${sig}`), false);
  assert.equal(valide(`12.${Number(exp) - 1000}.${sig}`), false);
  assert.equal(valide(j, { secret: "un-autre-secret" }), false);
  const lettre = sig[0] === "A" ? "B" : "A";
  assert.equal(valide(`12.${exp}.${lettre}${sig.slice(1)}`), false);
});

test("une expiration plus lointaine qu'une heure est refusée même bien signée", () => {
  const j = jeton({ maintenant: T0 + 10 * DUREE_JETON_MS });
  assert.equal(valide(j, { maintenant: T0 }), false);
});

test("une session de /relectures n'est jamais acceptée comme jeton", () => {
  const session = creerSession({ secret: SECRET, adherentId: 12, maintenant: T0 });
  assert.equal(valide(session), false);
});

test("fail closed : secret absent, compte sans mot de passe, jeton mal formé", () => {
  assert.equal(valide(jeton(), { secret: "" }), false);
  assert.equal(valide(jeton(), { secret: undefined }), false);
  assert.equal(valide(jeton(), { motDePasseHash: null }), false);
  for (const mauvais of [undefined, null, "", "abc", "12.34", "0.123.abc", "-1.123.abc", "12.123.a.b", "12.x.abc", "x".repeat(500)]) {
    assert.equal(analyserJeton(mauvais), null, String(mauvais).slice(0, 20));
  }
  assert.throws(() => creerJeton({ secret: "", espace: "live", id: 1, motDePasseHash: HASH }));
  assert.throws(() => creerJeton({ secret: SECRET, espace: "autre", id: 1, motDePasseHash: HASH }));
  assert.throws(() => creerJeton({ secret: SECRET, espace: "live", id: 1, motDePasseHash: null }));
});

test("adresse du site : jamais l'en-tête Host, uniquement les variables de Vercel", () => {
  assert.equal(urlSite({ VERCEL_ENV: "production", VERCEL_URL: "x.vercel.app" }), URL_PRODUCTION);
  assert.equal(
    urlSite({ VERCEL_ENV: "preview", VERCEL_BRANCH_URL: "perlimpinpin-git-mdp.vercel.app", VERCEL_URL: "x.vercel.app" }),
    "https://perlimpinpin-git-mdp.vercel.app",
  );
  assert.equal(urlSite({ VERCEL_ENV: "preview", VERCEL_URL: "x.vercel.app" }), "https://x.vercel.app");
  assert.equal(urlSite({ VERCEL_ENV: "development" }), URL_PRODUCTION);
  assert.equal(urlSite({}), "http://localhost:3000");
  assert.equal(urlSite({ SITE_URL_LOCAL: "http://localhost:4000/" }), "http://localhost:4000");
});

test("lien complet de la page « nouveau mot de passe »", () => {
  const env = { VERCEL_ENV: "production" };
  assert.equal(
    lienNouveauMotDePasse({ espace: "relectures", jeton: "12.34.ab_c-d", env }),
    "https://perlimpinpin.ai/relectures/nouveau-mot-de-passe?jeton=12.34.ab_c-d",
  );
  assert.equal(
    lienNouveauMotDePasse({ espace: "live", jeton: "1.2.x", env }),
    "https://perlimpinpin.ai/live/login/nouveau-mot-de-passe?jeton=1.2.x",
  );
});

test("le lien n'est affiché dans le terminal qu'en développement local", () => {
  assert.equal(lienAfficheEnLocal({ NODE_ENV: "development" }), true);
  assert.equal(lienAfficheEnLocal({ NODE_ENV: "production" }), false);
  assert.equal(lienAfficheEnLocal({ NODE_ENV: "development", VERCEL_ENV: "preview" }), false);
  assert.equal(lienAfficheEnLocal({ NODE_ENV: "development", VERCEL: "1" }), false);
});

test("les pages mot de passe oublié de /relectures sont accessibles sans être connecté", () => {
  assert.equal(cheminRelectureProtege("/relectures/mot-de-passe-oublie"), false);
  assert.equal(cheminRelectureProtege("/relectures/nouveau-mot-de-passe"), false);
  assert.equal(cheminRelectureProtege("/relectures/Nouveau-Mot-De-Passe/"), false);
  // Le reste du Club reste protégé
  assert.equal(cheminRelectureProtege("/relectures/mot-de-passe-oublie/autre"), true);
  assert.equal(cheminRelectureProtege("/relectures"), true);
});

test("mail de réinitialisation : lien, durée, prénom, HTML échappé", () => {
  const lien = "https://perlimpinpin.ai/relectures/nouveau-mot-de-passe?jeton=1.2.x&a=<b>";
  const mail = composerMailMotDePasse({ espace: "relectures", prenom: "Camille", lien });
  assert.match(mail.texte, /^Bonjour Camille,/);
  assert.ok(mail.texte.includes(lien));
  assert.match(mail.texte, /1 heure/);
  assert.ok(mail.html.includes("&amp;a=&lt;b&gt;"));
  assert.ok(!mail.html.includes("<b>"));
});

test("mail d'activation : adhérent qui n'a pas encore de mot de passe", () => {
  const mail = composerMailMotDePasse({ espace: "relectures", type: "activation", lien: "https://perlimpinpin.ai/relectures/inscription" });
  assert.match(mail.texte, /^Bonjour,/);
  assert.match(mail.texte, /pas encore activé/);
  assert.match(mail.objet, /Activez/);
});

const ENV_SMTP = {
  CLUB_SMTP_HOST: "smtp.exemple.fr",
  CLUB_SMTP_PORT: "587",
  CLUB_SMTP_USER: "club@perlimpinpin.ai",
  CLUB_SMTP_PASSWORD: "secret",
};
const logMuet = { log() {}, warn() {}, error() {} };

test("envoi : un destinataire, bon expéditeur selon l'espace, rien journalisé de sensible", async () => {
  const envoyes = [];
  const journal = [];
  const log = { log: (m) => journal.push(m), warn: (m) => journal.push(m), error: (m) => journal.push(m) };
  const creerTransport = () => ({ sendMail: async (m) => envoyes.push(m) });
  const lien = "https://perlimpinpin.ai/live/login/nouveau-mot-de-passe?jeton=SECRET";
  const r = await envoyerMailMotDePasse(
    { espace: "live", email: "a@b.fr", nom: "Arno F.", lien, ref: "compte live n°3" },
    { env: ENV_SMTP, creerTransport, log },
  );
  assert.equal(r.statut, "envoye");
  assert.equal(envoyes.length, 1);
  assert.equal(envoyes[0].to, "a@b.fr");
  assert.equal(envoyes[0].from, EXPEDITEURS.live);
  assert.match(envoyes[0].text, /^Bonjour Arno,/);
  assert.ok(journal.every((m) => !m.includes("a@b.fr") && !m.includes("SECRET")));
});

test("envoi : SMTP non configuré ou en échec → statut, jamais d'exception", async () => {
  const lien = "https://x/y";
  assert.equal((await envoyerMailMotDePasse({ espace: "relectures", email: "a@b.fr", lien }, { env: {}, log: logMuet })).statut, "non-configure");
  const creerTransport = () => ({
    sendMail: async () => {
      throw Object.assign(new Error("a@b.fr refusé"), { code: "EENVELOPE", responseCode: 550 });
    },
  });
  const r = await envoyerMailMotDePasse({ espace: "relectures", email: "a@b.fr", lien }, { env: ENV_SMTP, creerTransport, log: logMuet });
  assert.deepEqual(r, { statut: "echec", erreur: "EENVELOPE 550" });
  assert.equal((await envoyerMailMotDePasse({ espace: "relectures", email: "", lien }, { env: ENV_SMTP, log: logMuet })).statut, "ignore");
});
