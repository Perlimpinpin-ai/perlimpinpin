import nodemailer from "nodemailer";
import { configSmtpClub, EXPEDITEUR } from "./mail-bienvenue.js";
import { STATUT_BLOQUE, envoiMailAutorise } from "./envoi-mail-autorise.js";
import { composerMailProposition } from "./espace-club-core.js";

// Prévient la boîte du Club qu'une mesure a été proposée à l'analyse.
// Mêmes règles que les autres mails du Club : jamais depuis une preview,
// rien si CLUB_SMTP_* est incomplet, jamais d'exception, et seule la
// référence (« proposition n° 12 ») est journalisée.
// L'adresse de l'adhérent sert de « Répondre à » : l'équipe peut lui écrire directement.
export const BOITE_CLUB = "club@perlimpinpin.ai";

export async function envoyerMailProposition(
  { proposition, auteur },
  { env = process.env, creerTransport = (c) => nodemailer.createTransport(c), log = console } = {},
) {
  const etiquette = `[club] mail proposition n° ${proposition?.id ?? "?"}`;
  if (!envoiMailAutorise(env)) {
    log.warn(`${etiquette} non envoyé : envoi bloqué hors production`);
    return { statut: STATUT_BLOQUE };
  }
  const config = configSmtpClub(env);
  if (!config) {
    log.error(`${etiquette} non envoyé : variables CLUB_SMTP_* incomplètes`);
    return { statut: "non-configure" };
  }
  const mail = composerMailProposition({ proposition, auteur });
  try {
    await creerTransport(config).sendMail({
      from: EXPEDITEUR,
      to: BOITE_CLUB,
      replyTo: auteur.email || BOITE_CLUB,
      subject: mail.objet,
      text: mail.texte,
    });
    log.log(`${etiquette} envoyé`);
    return { statut: "envoye" };
  } catch (e) {
    const erreur = `${e?.code ?? "erreur"}${e?.responseCode ? ` ${e.responseCode}` : ""}`;
    log.error(`${etiquette} en échec : ${erreur}`);
    return { statut: "echec", erreur };
  }
}
