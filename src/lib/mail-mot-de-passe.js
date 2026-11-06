import nodemailer from "nodemailer";
import { configSmtpClub, prenomDepuisNom } from "./mail-bienvenue.js";

// Mail « mot de passe oublié » de /relectures (adhérents) et de /live (équipe).
// Envoyé depuis la boîte Zimbra du Club, avec les mêmes variables CLUB_SMTP_*
// que le mail de bienvenue (voir configSmtpClub). Si l'une manque, rien n'est
// envoyé (statut « non-configure »).
//
// Règles : un mail = un destinataire ; ni l'adresse, ni le lien (qui contient le
// jeton), ni le mot de passe SMTP ne sont journalisés.

export const EXPEDITEURS = {
  relectures: '"Club Perlimpinpin" <club@perlimpinpin.ai>',
  live: '"Perlimpinpin" <club@perlimpinpin.ai>',
};
export const REPONDRE_A = "club@perlimpinpin.ai";
export const OBJETS = {
  reinitialisation: "Votre nouveau mot de passe Perlimpinpin",
  activation: "Activez votre compte du Club Perlimpinpin",
};
const NOMS_ESPACES = {
  relectures: "le Club Perlimpinpin",
  live: "le Décryptage en direct de Perlimpinpin",
};

const echapperHtml = (s) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// { objet, texte, html } prêts à envoyer.
//   type « reinitialisation » : lien vers la page « nouveau mot de passe » (1 h) ;
//   type « activation » : adhérent qui n'a jamais créé de mot de passe → lien
//   vers /relectures/inscription (rien à réinitialiser).
export function composerMailMotDePasse({ espace, type = "reinitialisation", prenom = null, lien }) {
  const bonjour = prenom ? `Bonjour ${prenom},` : "Bonjour,";
  const nomEspace = NOMS_ESPACES[espace] ?? "Perlimpinpin";

  const paragraphes =
    type === "activation"
      ? [
          `Vous avez demandé à réinitialiser votre mot de passe pour ${nomEspace}. Votre compte n'est pas encore activé : il n'y a donc pas encore de mot de passe à changer.`,
          "Pour choisir votre mot de passe, utilisez ce lien avec la même adresse e-mail :",
        ]
      : [
          `Vous avez demandé à changer votre mot de passe pour ${nomEspace}.`,
          "Pour en choisir un nouveau, cliquez sur ce lien. Il est valable 1 heure et ne sert qu'une seule fois :",
        ];
  const bouton = type === "activation" ? "Créer mon mot de passe" : "Choisir un nouveau mot de passe";
  const fin = [
    "Si vous n'êtes pas à l'origine de cette demande, ignorez simplement ce message : votre mot de passe actuel reste valable.",
    "L'équipe Perlimpinpin",
  ];

  const texte = [bonjour, "", ...paragraphes, "", lien, "", fin[0], "", fin[1], ""].join("\n");

  const p = (t) => `<p style="margin:0 0 16px 0; font-size:15px; line-height:22px; color:#3F3F46;">${echapperHtml(t)}</p>`;
  const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0; padding:24px 12px; background:#F7F7F8; font-family:Helvetica, Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px; background:#FFFFFF; border:1px solid #E4E4E7; border-radius:16px;">
      <tr><td style="padding:28px 28px 8px 28px;">
        <img src="https://perlimpinpin.ai/logo/perlimpinpin-logo.png" alt="Perlimpinpin" width="140" style="display:block; width:140px; height:auto; border:0; margin-bottom:24px;">
        ${p(bonjour)}
        ${paragraphes.map(p).join("\n        ")}
        <p style="margin:8px 0 24px 0;"><a href="${echapperHtml(lien)}" style="display:inline-block; background:#18181B; color:#FFFFFF; text-decoration:none; font-size:14px; font-weight:600; padding:12px 22px; border-radius:999px;">${echapperHtml(bouton)}</a></p>
        <p style="margin:0 0 16px 0; font-size:12px; line-height:18px; color:#71717A;">Le bouton ne marche pas ? Copiez ce lien dans votre navigateur :<br><span style="word-break:break-all;">${echapperHtml(lien)}</span></p>
        ${p(fin[0])}
        ${p(fin[1])}
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;

  return { objet: OBJETS[type] ?? OBJETS.reinitialisation, texte, html };
}

// Envoie le mail. Renvoie { statut: "envoye" | "non-configure" | "echec" | "ignore", erreur? }
// et ne lève jamais d'exception. `creerTransport` est remplaçable en test.
// `ref` (ex. « adhérent n°12 ») est la seule chose journalisée.
export async function envoyerMailMotDePasse(
  { espace, type = "reinitialisation", email, nom = null, lien, ref = "compte" },
  { env = process.env, creerTransport = (c) => nodemailer.createTransport(c), log = console } = {},
) {
  const etiquette = `[${espace}] mail mot de passe (${ref})`;
  if (typeof email !== "string" || !email.includes("@") || typeof lien !== "string") {
    log.warn(`${etiquette} non envoyé : adresse ou lien absent`);
    return { statut: "ignore" };
  }
  const config = configSmtpClub(env);
  if (!config) {
    log.error(`${etiquette} non envoyé : variables CLUB_SMTP_* incomplètes`);
    return { statut: "non-configure" };
  }
  const mail = composerMailMotDePasse({ espace, type, prenom: prenomDepuisNom(nom), lien });
  try {
    const transport = creerTransport(config);
    await transport.sendMail({
      from: EXPEDITEURS[espace] ?? EXPEDITEURS.relectures,
      to: email,
      replyTo: REPONDRE_A,
      subject: mail.objet,
      text: mail.texte,
      html: mail.html,
    });
    log.log(`${etiquette} envoyé`);
    return { statut: "envoye" };
  } catch (e) {
    // Jamais le message complet : il peut contenir l'adresse du destinataire
    const erreur = `${e?.code ?? "erreur"}${e?.responseCode ? ` ${e.responseCode}` : ""}`;
    log.error(`${etiquette} en échec : ${erreur}`);
    return { statut: "echec", erreur };
  }
}
