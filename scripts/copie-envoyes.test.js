import test from "node:test";
import assert from "node:assert/strict";
import {
  avecMention,
  configImapClub,
  copierDansEnvoyes,
  mentionEnvoi,
  messageBrut,
  PORT_IMAP,
} from "../src/lib/copie-envoyes.js";

// Copie des mails envoyés dans le dossier Envoyés du Club : serveur IMAP
// simulé, aucune connexion réseau.

const ENV = {
  CLUB_IMAP_HOST: "imap.exemple.test",
  CLUB_SMTP_HOST: "smtp.exemple.test",
  CLUB_SMTP_PORT: "587",
  CLUB_SMTP_USER: "club@exemple.test",
  CLUB_SMTP_PASSWORD: "mot-de-passe-factice",
};
const PROD = { ...ENV, VERCEL: "1", VERCEL_ENV: "production" };

const MESSAGE = {
  from: '"Club" <club@exemple.test>',
  to: "camille@exemple.test",
  replyTo: "club@exemple.test",
  subject: "Sujet de test",
  text: "Bonjour Camille,\n\nhttps://exemple.test/activer?jeton=12.34.abc",
  html: '<!doctype html><html><body style="margin:0"><p>Bonjour Camille,</p></body></html>',
  messageId: "<identifiant-unique@exemple.test>",
};

// Boîte simulée : « Sent » n'a pas l'attribut \Sent, c'est « Envoyés » qui l'a.
const DOSSIERS = [
  { path: "INBOX", flags: new Set() },
  { path: "Sent", flags: new Set() },
  { path: "Envoyés", flags: new Set(["\\Sent"]), specialUse: "\\Sent" },
];

function fauxImap({ dossiers = DOSSIERS, echoue = null, bloque = false } = {}) {
  const etat = { config: null, creations: 0, depots: [], deconnecte: false, ferme: false };
  etat.creer = (config) => {
    etat.config = config;
    etat.creations += 1;
    return {
      connect: async () => {
        if (bloque) return new Promise(() => {});
        if (echoue === "connect") throw Object.assign(new Error(`échec pour ${config.auth.user} / ${config.auth.pass}`), { code: "ECONNREFUSED" });
      },
      list: async () => dossiers,
      append: async (path, contenu, flags, date) => {
        if (echoue === "append") throw Object.assign(new Error("refus"), { code: "NoConnection" });
        etat.depots.push({ path, contenu: contenu.toString(), flags, date });
      },
      logout: async () => { etat.deconnecte = true; },
      close: () => { etat.ferme = true; },
    };
  };
  return etat;
}

function journal() {
  const lignes = [];
  return { lignes, log: { log: (m) => lignes.push(m), warn: (m) => lignes.push(m), error: (m) => lignes.push(m) } };
}

test("configuration IMAP : CLUB_IMAP_HOST, identifiants SMTP, port 993 en TLS, délai 10 s", () => {
  const c = configImapClub(ENV);
  assert.equal(c.host, "imap.exemple.test");
  assert.equal(c.port, PORT_IMAP);
  assert.equal(c.port, 993);
  assert.equal(c.secure, true);
  assert.deepEqual(c.auth, { user: "club@exemple.test", pass: "mot-de-passe-factice" });
  assert.equal(c.logger, false);
  assert.equal(c.connectionTimeout, 10_000);
  // CLUB_IMAP_HOST obligatoire : pas de repli sur le serveur SMTP
  assert.equal(configImapClub({ ...ENV, CLUB_IMAP_HOST: "" }), null);
  assert.equal(configImapClub({ ...ENV, CLUB_SMTP_PASSWORD: "" }), null);
  assert.equal(configImapClub({ ...ENV, CLUB_SMTP_USER: undefined }), null);
});

test("message brut RFC 822 : mêmes en-têtes que le mail envoyé, Date et Message-ID", async () => {
  const brut = (await messageBrut(MESSAGE)).toString();
  assert.match(brut, /^From: "?Club"? <club@exemple\.test>/m);
  assert.match(brut, /^To: camille@exemple\.test/m);
  assert.match(brut, /^Reply-To: club@exemple\.test/m);
  assert.match(brut, /^Subject: Sujet de test/m);
  assert.match(brut, /^Date: /m);
  assert.match(brut, /^Message-ID: <identifiant-unique@exemple\.test>/m);
  assert.match(brut, /text\/plain/);
  assert.match(brut, /text\/html/);
  // Sans Message-ID fourni, un identifiant est créé quand même
  const sansId = (await messageBrut({ ...MESSAGE, messageId: undefined })).toString();
  assert.match(sansId, /^Message-ID: <.+@.+>/m);
});

test("dépôt dans le dossier \\Sent (pas par le nom), marqué lu, puis déconnexion", async () => {
  const imap = fauxImap();
  const r = await copierDansEnvoyes(MESSAGE, { env: PROD, creerClient: imap.creer, log: journal().log });
  assert.deepEqual(r, { statut: "copie" });
  assert.equal(imap.depots.length, 1);
  assert.equal(imap.depots[0].path, "Envoyés");
  assert.deepEqual(imap.depots[0].flags, ["\\Seen"]);
  assert.match(imap.depots[0].contenu, /Subject: Sujet de test/);
  assert.match(imap.depots[0].contenu, /To: camille@exemple\.test/);
  assert.ok(imap.deconnecte);
});

test("dossier repéré aussi par l'attribut seul (sans specialUse)", async () => {
  const imap = fauxImap({ dossiers: [{ path: "INBOX", flags: new Set() }, { path: "Sent", flags: new Set(["\\Sent"]) }] });
  const r = await copierDansEnvoyes(MESSAGE, { env: PROD, creerClient: imap.creer, log: journal().log });
  assert.deepEqual(r, { statut: "copie" });
  assert.equal(imap.depots[0].path, "Sent");
});

test("aucune connexion IMAP sans variables : statut non-configure", async () => {
  for (const env of [{}, { ...PROD, CLUB_IMAP_HOST: "" }, { ...PROD, CLUB_SMTP_PASSWORD: "" }]) {
    const imap = fauxImap();
    const j = journal();
    const r = await copierDansEnvoyes(MESSAGE, { env, creerClient: imap.creer, log: j.log, ref: "adhérent n°3" });
    assert.deepEqual(r, { statut: "non-configure" });
    assert.equal(imap.creations, 0);
    assert.equal(j.lignes.length, 1);
    assert.match(j.lignes[0], /^\[club\] copie dans Envoyés non faite \(adhérent n°3\)/);
  }
});

test("aucune connexion IMAP hors production (preview, next dev), même avec les variables", async () => {
  for (const env of [
    { ...ENV, VERCEL: "1", VERCEL_ENV: "preview" },
    { ...ENV, VERCEL: "1", VERCEL_ENV: "development" },
    { ...ENV, VERCEL: "1" },
    { ...ENV, NODE_ENV: "development" },
  ]) {
    const imap = fauxImap();
    const j = journal();
    const r = await copierDansEnvoyes(MESSAGE, { env, creerClient: imap.creer, log: j.log });
    assert.deepEqual(r, { statut: "non-configure" });
    assert.equal(imap.creations, 0);
    assert.match(j.lignes[0], /bloquée hors production/);
  }
});

test("échec de connexion : statut echec, journal avec le code seulement", async () => {
  const imap = fauxImap({ echoue: "connect" });
  const j = journal();
  const r = await copierDansEnvoyes(MESSAGE, { env: PROD, creerClient: imap.creer, log: j.log, ref: "adhérent n°7" });
  assert.deepEqual(r, { statut: "echec" });
  assert.deepEqual(j.lignes, ["[club] copie dans Envoyés en échec (adhérent n°7) : ECONNREFUSED"]);
  const tout = j.lignes.join("\n");
  for (const secret of ["mot-de-passe-factice", "club@exemple.test", "camille@exemple.test", "jeton"]) {
    assert.ok(!tout.includes(secret), `« ${secret} » ne doit pas apparaître dans le journal`);
  }
  assert.ok(imap.ferme);
});

test("pas de dossier \\Sent ou dépôt refusé : echec, sans exception", async () => {
  const sansSent = fauxImap({ dossiers: [{ path: "INBOX", flags: new Set() }] });
  const j1 = journal();
  assert.deepEqual(await copierDansEnvoyes(MESSAGE, { env: PROD, creerClient: sansSent.creer, log: j1.log }), { statut: "echec" });
  assert.match(j1.lignes[0], /SANS_DOSSIER_SENT/);

  const refus = fauxImap({ echoue: "append" });
  const j2 = journal();
  assert.deepEqual(await copierDansEnvoyes(MESSAGE, { env: PROD, creerClient: refus.creer, log: j2.log }), { statut: "echec" });
  assert.match(j2.lignes[0], /NoConnection/);
});

test("serveur qui ne répond pas : abandon après le délai", async () => {
  const imap = fauxImap({ bloque: true });
  const j = journal();
  const r = await copierDansEnvoyes(MESSAGE, { env: PROD, creerClient: imap.creer, log: j.log, delaiMs: 20 });
  assert.deepEqual(r, { statut: "echec" });
  assert.match(j.lignes[0], /: DELAI$/);
});

test("annonces : mention « Envoyé à N adhérents » en tête, texte et HTML", () => {
  assert.equal(mentionEnvoi(["a@x.fr"]), "Envoyé à 1 adhérent : a@x.fr");
  assert.equal(mentionEnvoi(["a@x.fr", "b@x.fr"]), "Envoyé à 2 adhérents : a@x.fr, b@x.fr");
  const m = avecMention(MESSAGE, ["a@x.fr", "b@x.fr"]);
  assert.ok(m.text.startsWith("Envoyé à 2 adhérents : a@x.fr, b@x.fr\n\nBonjour Camille,"));
  assert.match(m.html, /<body style="margin:0">\n<p [^>]*>Envoyé à 2 adhérents : a@x\.fr, b@x\.fr<\/p>/);
  assert.equal(m.subject, MESSAGE.subject);
  assert.equal(avecMention({ ...MESSAGE, html: undefined }, ["a@x.fr"]).html, undefined);
});
