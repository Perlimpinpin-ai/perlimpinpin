import test from "node:test";
import assert from "node:assert/strict";
import {
  COMMENTAIRE_MAX,
  PASSAGE_MAX,
  composerAlerteCommentaire,
  dateParis,
  envoyerAlerteCommentaire,
  lienFiche,
  tronquer,
} from "../src/lib/alerte-commentaire.js";

// Alerte e-mail à chaque nouveau commentaire du Club. Ni réseau ni vrai
// serveur SMTP : le transport est simulé.

const ENV = {
  CLUB_SMTP_HOST: "smtp.mail.ovh.net",
  CLUB_SMTP_PORT: "465",
  CLUB_SMTP_USER: "club@perlimpinpin.ai",
  CLUB_SMTP_PASSWORD: "secret-de-test",
  VERCEL_ENV: "production",
};
const DONNEES = {
  commentaire: "Le chiffre de 5 Md€ ne colle pas avec la Cour des comptes.",
  ficheSlug: "fiche-12",
  titreFiche: "Profs augmentés de 10 %",
  candidat: "Raphaël Glucksmann",
  auteur: "Camille D.",
  sectionLabel: "Efficacité",
  passageCite: "coût estimé à 5 milliards",
  date: new Date("2026-11-16T13:05:00Z"),
};

function faux(echec = null) {
  const envoyes = [];
  const configs = [];
  const creerTransport = (c) => {
    configs.push(c);
    return {
      async sendMail(m) {
        if (echec) throw Object.assign(new Error("refusé"), echec);
        envoyes.push(m);
      },
    };
  };
  const lignes = [];
  const log = { log: (m) => lignes.push(m), warn: (m) => lignes.push(m), error: (m) => lignes.push(m) };
  return { envoyes, configs, creerTransport, log, lignes };
}

test("sujet : candidat et titre de la fiche", () => {
  const { objet } = composerAlerteCommentaire(DONNEES);
  assert.equal(objet, "💬 Nouveau commentaire — Raphaël Glucksmann · Profs augmentés de 10 %");
});

test("sujet : pas de retour à la ligne (injection d'en-têtes)", () => {
  const { objet } = composerAlerteCommentaire({ ...DONNEES, titreFiche: "A\r\nBcc: x@y.z" });
  assert.ok(!/[\r\n]/.test(objet));
});

test("corps : auteur, fiche, section, passage, commentaire, date de Paris, lien", () => {
  const { texte, html } = composerAlerteCommentaire(DONNEES);
  for (const morceau of [
    "Camille D.",
    "Raphaël Glucksmann · Profs augmentés de 10 %",
    "Efficacité",
    "coût estimé à 5 milliards",
    "Cour des comptes",
    "lundi 16 novembre 2026 à 14:05",
    "https://perlimpinpin.ai/declarations/12?vue=expert",
  ]) {
    assert.ok(texte.includes(morceau), `texte : ${morceau}`);
    assert.ok(html.includes(morceau.replace("&", "&amp;")), `html : ${morceau}`);
  }
  assert.ok(texte.startsWith("Annotation de Camille D."));
});

test("commentaire de section : pas de bloc « passage surligné »", () => {
  const { texte, html } = composerAlerteCommentaire({ ...DONNEES, passageCite: null });
  assert.ok(!texte.includes("Passage surligné"));
  assert.ok(!html.includes("Passage surligné"));
  assert.ok(texte.startsWith("Commentaire de"));
});

test("accent jaune, jamais d'orange", () => {
  const { html } = composerAlerteCommentaire(DONNEES);
  assert.ok(html.includes("#FFE45C"));
  assert.ok(!/orange|#ff[89a]\d{3}\b|#f97316|#fb923c/i.test(html));
});

test("échappement HTML de tout le texte utilisateur", () => {
  const piege = `<script>alert("x")</script> & 'y'`;
  const { html } = composerAlerteCommentaire({
    ...DONNEES,
    commentaire: piege,
    auteur: piege,
    sectionLabel: piege,
    passageCite: piege,
    titreFiche: piege,
    candidat: piege,
  });
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;y&#39;"));
});

test("troncature : passage à 300, commentaire à 1 500 caractères", () => {
  const { texte } = composerAlerteCommentaire({
    ...DONNEES,
    passageCite: "p".repeat(PASSAGE_MAX + 50),
    commentaire: "c".repeat(COMMENTAIRE_MAX + 50),
  });
  assert.ok(texte.includes(`${"p".repeat(PASSAGE_MAX)}…`));
  assert.ok(!texte.includes("p".repeat(PASSAGE_MAX + 1)));
  assert.ok(texte.includes(`${"c".repeat(COMMENTAIRE_MAX)}…`));
  assert.ok(!texte.includes("c".repeat(COMMENTAIRE_MAX + 1)));
  assert.equal(tronquer("court", 10), "court");
  assert.equal(tronquer("😀😀😀", 2), "😀😀…");
});

test("lien : fiche publiée, relecture, slug invalide", () => {
  assert.equal(lienFiche("fiche-7"), "https://perlimpinpin.ai/declarations/7?vue=expert");
  assert.equal(lienFiche("glucksmann-salaires-enseignants"), "https://perlimpinpin.ai/relectures#glucksmann-salaires-enseignants");
  assert.equal(lienFiche("<x>"), "https://perlimpinpin.ai/relectures");
});

test("date : heure de Paris (heure d'été et d'hiver)", () => {
  assert.equal(dateParis(new Date("2026-07-01T10:00:00Z")), "mercredi 1 juillet 2026 à 12:00");
  assert.equal(dateParis(new Date("2026-12-01T10:00:00Z")), "mardi 1 décembre 2026 à 11:00");
});

test("envoi : destinataire par défaut, expéditeur, TLS direct sur 465", async () => {
  const f = faux();
  const r = await envoyerAlerteCommentaire(DONNEES, { env: ENV, creerTransport: f.creerTransport, log: f.log });
  assert.equal(r.statut, "envoye");
  assert.equal(f.envoyes.length, 1);
  assert.equal(f.envoyes[0].to, "club@perlimpinpin.ai");
  assert.equal(f.envoyes[0].from, '"Perlimpinpin" <club@perlimpinpin.ai>');
  assert.equal(f.configs[0].secure, true);
  assert.ok(!f.lignes.join("\n").includes("secret-de-test"));
});

test("envoi : STARTTLS sur 587 et destinataire ALERTE_COMMENTAIRES_EMAIL", async () => {
  const f = faux();
  await envoyerAlerteCommentaire(DONNEES, {
    env: { ...ENV, CLUB_SMTP_PORT: "587", ALERTE_COMMENTAIRES_EMAIL: "alertes@exemple.org" },
    creerTransport: f.creerTransport,
    log: f.log,
  });
  assert.equal(f.envoyes[0].to, "alertes@exemple.org");
  assert.equal(f.configs[0].secure, false);
  assert.equal(f.configs[0].requireTLS, true);
});

test("pas d'envoi sans SMTP", async () => {
  for (const manque of ["CLUB_SMTP_HOST", "CLUB_SMTP_PORT", "CLUB_SMTP_USER", "CLUB_SMTP_PASSWORD"]) {
    const f = faux();
    const env = { ...ENV };
    delete env[manque];
    const r = await envoyerAlerteCommentaire(DONNEES, { env, creerTransport: f.creerTransport, log: f.log });
    assert.equal(r.statut, "non-configure", manque);
    assert.equal(f.envoyes.length, 0);
    assert.deepEqual(f.lignes, ["[alerte-commentaire] SMTP absent : pas d'e-mail"]);
  }
});

test("pas d'envoi depuis une preview, même avec SMTP", async () => {
  const f = faux();
  const r = await envoyerAlerteCommentaire(DONNEES, {
    env: { ...ENV, VERCEL_ENV: "preview" },
    creerTransport: f.creerTransport,
    log: f.log,
  });
  assert.equal(r.statut, "bloque-hors-production");
  assert.equal(f.envoyes.length, 0);
});

test("échec SMTP : pas d'exception, erreur journalisée sans détail", async () => {
  const f = faux({ code: "EAUTH", responseCode: 535 });
  const r = await envoyerAlerteCommentaire(DONNEES, { env: ENV, creerTransport: f.creerTransport, log: f.log });
  assert.deepEqual(r, { statut: "echec", erreur: "EAUTH 535" });
});
