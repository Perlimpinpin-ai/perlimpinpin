import nodemailer from "nodemailer";
import { MODELE_HTML_BIENVENUE } from "./mail-bienvenue-modele.js";

// Mail de bienvenue envoyé automatiquement à chaque nouvel adhérent du Club,
// juste après la création de son compte depuis HelloAsso
// (/api/helloasso/notification et /api/helloasso/sync). Envoyé depuis la boîte
// Zimbra du Club, en SMTP.
//
// Variables d'environnement (les mêmes que pour les appels à relecture) :
// CLUB_SMTP_HOST (OVH : smtp.mail.ovh.net), CLUB_SMTP_PORT (587 ou 465),
// CLUB_SMTP_USER (club@perlimpinpin.ai), CLUB_SMTP_PASSWORD.
// Si l'une manque, rien n'est envoyé (statut « non-configure ») : la création du
// compte n'est jamais bloquée par le mail.
//
// Règles : un mail = un destinataire ; le mot de passe SMTP et les adresses
// e-mail ne sont jamais journalisés (seulement le numéro d'adhérent).

export const EXPEDITEUR = '"Club Perlimpinpin" <club@perlimpinpin.ai>';
export const OBJET_BIENVENUE = "Bienvenue dans l’aventure Perlimpinpin !";
const DELAI_CONNEXION_MS = 10_000;
const DELAI_ENVOI_MS = 20_000;

// « Camille D. » → « Camille », « Jean-Pierre » → « Jean-Pierre ».
// Le nom affiché des comptes HelloAsso est « Prénom I. » (helloasso-core.js).
export function prenomDepuisNom(nom) {
  if (typeof nom !== "string") return null;
  const prenom = nom.replace(/\s+\p{L}\.$/u, "").replace(/\s+/g, " ").trim();
  return /\p{L}/u.test(prenom) ? prenom : null;
}

const echapperHtml = (s) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const salutation = (prenom) => (prenom ? `Bonjour ${prenom},` : "Bonjour,");

// { objet, html, texte } prêts à envoyer.
export function composerMailBienvenue({ prenom } = {}) {
  const p = typeof prenom === "string" && prenom.trim() ? prenom.trim() : null;
  const html = MODELE_HTML_BIENVENUE.replace(
    "__SALUTATION__",
    echapperHtml(salutation(p)),
  );
  return { objet: OBJET_BIENVENUE, html, texte: texteBienvenue(p) };
}

function texteBienvenue(prenom) {
  return `${salutation(prenom)}

Ça y est, tu fais partie de l’aventure. Bienvenue au Club Perlimpinpin !

Pendant cette campagne, des centaines de promesses vont circuler. Des chiffres lancés en plateau, des mesures « financées » sans qu’on sache comment, des slogans qui sonnent bien mais ne tiennent pas. Très peu seront examinées sérieusement.

Perlimpinpin existe pour changer ça. Notre objectif : une politique fondée sur les faits, pas sur les discours. Chaque proposition est passée au crible, sources à l’appui, pour que chacun puisse savoir ce qui tient la route… et ce qui relève de la poudre de Perlimpinpin. Sans parti pris, quel que soit le candidat.

En nous rejoignant, tu deviens l’un des gardiens de cette exigence.

CE QU’ON FAIT ENSEMBLE
Aucune analyse n’est publiée sur perlimpinpin.ai sans être passée par le Club :
1. Une nouvelle fiche arrive dans l’espace du Club, et chacun reçoit un e-mail avec un court résumé.
2. On la lit et on la commente pendant quelques jours : une source à ajouter, un chiffre discutable, un argument oublié…
3. La fiche est reprise à partir de tous les commentaires, et chacun reçoit une réponse.
4. La version finale est publiée, plus solide grâce à tous ceux qui l’ont relue.
Pas besoin d’être expert : un « je n’ai pas compris ce passage » compte autant qu’une référence de la Cour des comptes.

ACTIVE TON COMPTE (2 MINUTES)
1. Rends-toi sur https://perlimpinpin.ai/relectures/inscription
2. Saisis l’adresse e-mail utilisée pour ton adhésion HelloAsso.
3. Choisis ton mot de passe et confirme-le.
Ensuite, il suffira de te connecter sur https://perlimpinpin.ai/relectures/connexion

LES PERLIMPINPOINTS
Chaque relecture fait avancer la mission, et ça mérite d’être reconnu :
- +10 points pour chaque commentaire (jusqu’à 5 par fiche) ;
- +20 points en bonus quand ton commentaire est retenu dans la version finale.
Tous les 150 points, tu gagnes un rang : Bronze, Silver, Gold… et la suite reste une surprise. Les membres les plus actifs seront mis à l’honneur dans le Club.

ET CE N’EST QU’UN DÉBUT
- Des rendez-vous réguliers, en visio ou en vrai, pour se retrouver, parler des analyses en cours et choisir ensemble les prochaines propositions à passer au crible.
- Des événements tout au long de la campagne (débats, soirées, rencontres), où chaque membre est invité, et qu’on pourra aussi organiser ensemble.
- Une communauté engagée : des échanges entre membres et des coups de main sur les fiches, selon les envies et les compétences de chacun.

FAISONS CONNAISSANCE
Si tu le souhaites, n’hésite pas à répondre à ce message pour te présenter en quelques mots : ce qui t’a amené ici, les sujets qui te tiennent à cœur, la proposition de candidat que tu aimerais voir analysée. On lit tout, et tes idées orientent les prochaines fiches.

Un souci à l’inscription ? Réponds simplement à ce message, on s’en occupe.

FAIS GRANDIR LE CLUB
Une politique sur les faits, ça ne se construit pas à quelques-uns. Plus on est nombreux à relire, plus les analyses sont solides, et plus elles pèsent dans le débat.
Tu connais quelqu’un qui en a assez des promesses en l’air ? Transfère-lui ce mail, ou envoie-lui ce lien : https://perlimpinpin.ai/nous-rejoindre

Très heureux de t’avoir avec nous. À très vite sur les fiches !
Arno, au nom du Club Perlimpinpin
`;
}

// Réglages SMTP, ou null si une variable manque ou si le port n'est pas 587/465.
export function configSmtpClub(env = process.env) {
  const host = env.CLUB_SMTP_HOST?.trim();
  const user = env.CLUB_SMTP_USER?.trim();
  const pass = env.CLUB_SMTP_PASSWORD;
  const port = Number(env.CLUB_SMTP_PORT);
  if (!host || !user || !pass || (port !== 587 && port !== 465)) return null;
  return {
    host,
    port,
    secure: port === 465, // 465 : TLS direct ; 587 : STARTTLS exigé
    requireTLS: port === 587,
    auth: { user, pass },
    connectionTimeout: DELAI_CONNEXION_MS,
    greetingTimeout: DELAI_CONNEXION_MS,
    socketTimeout: DELAI_ENVOI_MS,
  };
}

// Envoie le mail de bienvenue à un adhérent.
// Renvoie { statut: "envoye" | "non-configure" | "echec" | "ignore", erreur? }
// et ne lève jamais d'exception. `creerTransport` est remplaçable en test.
export async function envoyerMailBienvenue(
  { email, nom, adherentId = null },
  { env = process.env, creerTransport = (c) => nodemailer.createTransport(c), log = console } = {},
) {
  const ref = adherentId != null ? `adhérent n°${adherentId}` : "adhérent";
  if (typeof email !== "string" || !email.includes("@")) {
    log.warn(`[club] mail de bienvenue non envoyé (${ref}) : adresse absente`);
    return { statut: "ignore" };
  }
  const config = configSmtpClub(env);
  if (!config) {
    log.error(`[club] mail de bienvenue non envoyé (${ref}) : variables CLUB_SMTP_* incomplètes`);
    return { statut: "non-configure" };
  }
  const mail = composerMailBienvenue({ prenom: prenomDepuisNom(nom) });
  try {
    const transport = creerTransport(config);
    await transport.sendMail({
      from: EXPEDITEUR,
      to: email,
      replyTo: "club@perlimpinpin.ai",
      subject: mail.objet,
      text: mail.texte,
      html: mail.html,
    });
    log.log(`[club] mail de bienvenue envoyé (${ref})`);
    return { statut: "envoye" };
  } catch (e) {
    // Jamais le message complet : il peut contenir l'adresse du destinataire
    const erreur = `${e?.code ?? "erreur"}${e?.responseCode ? ` ${e.responseCode}` : ""}`;
    log.error(`[club] mail de bienvenue en échec (${ref}) : ${erreur}`);
    return { statut: "echec", erreur };
  }
}

// Résultats de enregistrerAdhesion (helloasso-core.js) → mails à envoyer :
// seulement les comptes qui viennent d'être créés, jamais les comptes déjà là.
export function bienvenuesAEnvoyer(resultats) {
  return resultats
    .filter((r) => r?.resultat === "creee")
    .map((r) => ({ email: r.email, nom: r.nom, adherentId: r.adherentId }));
}

// Envoie une liste de mails de bienvenue un par un (pause entre deux envois).
export async function envoyerBienvenues(destinataires, { pauseMs = 2000, attendre, ...options } = {}) {
  const pause = attendre ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const bilan = { envoyes: 0, echecs: 0 };
  for (let i = 0; i < destinataires.length; i++) {
    if (i > 0) await pause(pauseMs);
    const { statut } = await envoyerMailBienvenue(destinataires[i], options);
    if (statut === "envoye") bilan.envoyes += 1;
    else bilan.echecs += 1;
  }
  return bilan;
}
