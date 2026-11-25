import { ImapFlow } from "imapflow";
import MailComposer from "nodemailer/lib/mail-composer/index.js";
import { envoiMailAutorise } from "./envoi-mail-autorise.js";

// Copie des mails envoyés par le site dans le dossier « Envoyés » de la boîte
// du Club (club@perlimpinpin.ai, Zimbra), en IMAP. Les mails partent en SMTP
// direct : sans cette copie, ils n'apparaîtraient nulle part dans la boîte.
//   - mail de bienvenue (mail-bienvenue.js) : une copie identique au mail
//     envoyé, lien personnel compris ;
//   - annonce des relectures (relecture-annonce-envoi.js) : une seule copie
//     par envoi réel, précédée de « Envoyé à N adhérents : … » (avecMention).
//
// Variables d'environnement : CLUB_IMAP_HOST (serveur IMAP), CLUB_SMTP_USER et
// CLUB_SMTP_PASSWORD (mêmes identifiants qu'en SMTP). Port 993, TLS direct.
// Le dossier est repéré par son attribut spécial \Sent, jamais par son nom
// (« Sent » sur Zimbra, affiché « Envoyés »).
//
// Règles :
//   - ne lève jamais d'exception : renvoie { statut: "copie" | "non-configure" | "echec" } ;
//   - aucune connexion IMAP hors production (même garde que l'envoi :
//     envoi-mail-autorise.js) ;
//   - journal : seulement un code d'erreur et la référence (« adhérent n°X »),
//     jamais une adresse, un identifiant, un mot de passe ni un lien personnel.

export const PORT_IMAP = 993;
const DELAI_CONNEXION_MS = 10_000;
const DELAI_SOCKET_MS = 10_000;
// Plafond de toute l'opération (connexion + dépôt + déconnexion).
export const DELAI_TOTAL_MS = 15_000;

// Réglages IMAP, ou null si une variable manque.
export function configImapClub(env = process.env) {
  const host = env.CLUB_IMAP_HOST?.trim();
  const user = env.CLUB_SMTP_USER?.trim();
  const pass = env.CLUB_SMTP_PASSWORD;
  if (!host || !user || !pass) return null;
  return {
    host,
    port: PORT_IMAP,
    secure: true,
    auth: { user, pass },
    logger: false, // imapflow journalise sinon les échanges, identifiant compris
    connectionTimeout: DELAI_CONNEXION_MS,
    greetingTimeout: DELAI_CONNEXION_MS,
    socketTimeout: DELAI_SOCKET_MS,
  };
}

const echapperHtml = (s) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function mentionEnvoi(adresses) {
  const n = adresses.length;
  return `Envoyé à ${n} adhérent${n > 1 ? "s" : ""} : ${adresses.join(", ")}`;
}

// Annonces seulement : message nodemailer → même message précédé de la
// mention « Envoyé à N adhérents : … », en texte et en HTML.
export function avecMention(message, adresses) {
  const mention = mentionEnvoi(adresses);
  const bloc = `<p style="margin:0 0 16px;padding:8px 12px;background:#f4f4f5;font-size:12px;color:#52525b">${echapperHtml(mention)}</p>`;
  const html = message.html
    ? /<body[^>]*>/i.test(message.html)
      ? message.html.replace(/<body[^>]*>/i, (b) => `${b}\n${bloc}`)
      : `${bloc}\n${message.html}`
    : undefined;
  return { ...message, text: `${mention}\n\n${message.text ?? ""}`, html };
}

// Message nodemailer → message brut RFC 822 (Buffer), avec Date et Message-ID.
export async function messageBrut(message, date = new Date()) {
  const { from, to, cc, replyTo, subject, text, html, messageId } = message;
  const composeur = new MailComposer({ from, to, cc, replyTo, subject, text, html, date, messageId });
  return composeur.compile().build();
}

// Dépose `message` (format nodemailer : from, to, replyTo, subject, text, html)
// dans le dossier \Sent de la boîte du Club, marqué comme lu.
// Options : `ref` (« adhérent n°12 », pour le journal), `prefixe` (« [club] »),
// `creerClient` (remplaçable en test), `delaiMs`.
export async function copierDansEnvoyes(
  message,
  {
    env = process.env,
    log = console,
    ref = null,
    prefixe = "[club]",
    creerClient = (c) => new ImapFlow(c),
    delaiMs = DELAI_TOTAL_MS,
  } = {},
) {
  const suffixe = ref ? ` (${ref})` : "";
  if (!envoiMailAutorise(env)) {
    log.warn(`${prefixe} copie dans Envoyés non faite${suffixe} : bloquée hors production`);
    return { statut: "non-configure" };
  }
  const config = configImapClub(env);
  if (!config) {
    log.warn(`${prefixe} copie dans Envoyés non faite${suffixe} : CLUB_IMAP_HOST ou identifiants CLUB_SMTP_* absents`);
    return { statut: "non-configure" };
  }
  let client = null;
  let minuteur;
  const depot = async () => {
    const brut = await messageBrut(message);
    client = creerClient(config);
    await client.connect();
    const dossiers = await client.list();
    const envoyes = dossiers.find((d) => d.specialUse === "\\Sent" || d.flags?.has("\\Sent"));
    if (!envoyes) throw Object.assign(new Error("pas de dossier \\Sent"), { code: "SANS_DOSSIER_SENT" });
    await client.append(envoyes.path, brut, ["\\Seen"], new Date());
    await client.logout();
  };
  try {
    await Promise.race([
      depot(),
      new Promise((_, refuse) => {
        minuteur = setTimeout(() => refuse(Object.assign(new Error("délai dépassé"), { code: "DELAI" })), delaiMs);
      }),
    ]);
    return { statut: "copie" };
  } catch (e) {
    // Jamais le message de l'erreur : il peut contenir l'identifiant.
    const code = e?.code ?? (e?.authenticationFailed ? "AUTHENTIFICATION" : "erreur");
    log.error(`${prefixe} copie dans Envoyés en échec${suffixe} : ${code}`);
    try {
      client?.close();
    } catch {}
    return { statut: "echec" };
  } finally {
    clearTimeout(minuteur);
  }
}
