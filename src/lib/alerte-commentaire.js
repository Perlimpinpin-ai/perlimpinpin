import nodemailer from "nodemailer";
import { configSmtpClub } from "./mail-bienvenue.js";
import { envoiMailAutorise } from "./envoi-mail-autorise.js";

// Alerte e-mail envoyée à l'équipe à chaque nouveau commentaire ou annotation
// du Club (POST /api/relectures/comments, statut 201), via after() pour ne
// pas ralentir la réponse.
//
// SMTP : variables CLUB_SMTP_* (les mêmes que le mail de bienvenue).
// Destinataire : ALERTE_COMMENTAIRES_EMAIL, sinon club@perlimpinpin.ai.
// Jamais d'envoi hors production (preview, `next dev`) : voir envoi-mail-autorise.js.
// L'adresse e-mail de l'auteur n'apparaît jamais dans le mail ni dans les logs.
//
// La composition du mail (composerAlerteCommentaire) est pure et testée par
// scripts/alerte-commentaire.test.js.

export const DESTINATAIRE_PAR_DEFAUT = "club@perlimpinpin.ai";
export const SITE = "https://perlimpinpin.ai";
export const PASSAGE_MAX = 300;
export const COMMENTAIRE_MAX = 1500;
const JAUNE = "#FFE45C";

export const echapperHtml = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );

// Coupe à `max` caractères (points de code, pas d'emoji coupé en deux) + « … ».
export function tronquer(texte, max) {
  const s = String(texte ?? "").trim();
  const car = Array.from(s);
  return car.length > max ? `${car.slice(0, max).join("").trimEnd()}…` : s;
}

// Date et heure de Paris : « lundi 16 novembre 2026 à 14:05 ».
export function dateParis(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const jour = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
  const heure = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
  return `${jour} à ${heure}`;
}

// Lien vers la fiche commentée : fiche publiée « fiche-<id> » → vue experte de
// /declarations/<id> ; sinon fiche en relecture → /relectures#<slug>.
// (Les sections de la vue experte n'ont pas d'ancre id : pas d'ancre possible.)
export function lienFiche(ficheSlug) {
  const m = /^fiche-([1-9]\d{0,9})$/.exec(String(ficheSlug ?? ""));
  if (m) return `${SITE}/declarations/${m[1]}?vue=expert`;
  if (/^[a-z0-9][a-z0-9-]{0,120}$/.test(String(ficheSlug ?? ""))) {
    return `${SITE}/relectures#${ficheSlug}`;
  }
  return `${SITE}/relectures`;
}

// { objet, texte, html } prêts à envoyer.
export function composerAlerteCommentaire({
  commentaire,
  ficheSlug,
  titreFiche,
  candidat,
  auteur,
  sectionLabel,
  passageCite,
  date = new Date(),
}) {
  const titre = String(titreFiche ?? "").trim() || String(ficheSlug ?? "").trim() || "Fiche";
  const cand = String(candidat ?? "").trim() || "Candidat inconnu";
  const qui = String(auteur ?? "").trim() || "Membre du Club";
  const section = String(sectionLabel ?? "").trim() || "Section non précisée";
  const passage = passageCite ? tronquer(passageCite, PASSAGE_MAX) : null;
  const corps = tronquer(commentaire, COMMENTAIRE_MAX);
  const quand = dateParis(date);
  const lien = lienFiche(ficheSlug);
  // Pas de retour à la ligne dans le sujet (injection d'en-têtes)
  const objet = `💬 Nouveau commentaire — ${cand} · ${titre}`.replace(/[\r\n]+/g, " ");
  const nature = passage ? "Annotation" : "Commentaire";

  const texte = [
    `${nature} de ${qui}`,
    `Fiche : ${cand} · ${titre}`,
    `Section : ${section}`,
    ...(passage ? ["", "Passage surligné :", `« ${passage} »`] : []),
    "",
    "Commentaire :",
    corps,
    "",
    `Posté le ${quand} (heure de Paris)`,
    `Voir la fiche : ${lien}`,
    "",
  ].join("\n");

  const e = echapperHtml;
  const ligne = (label, valeur) =>
    `<tr><td style="padding:4px 12px 4px 0;color:#6E7080;white-space:nowrap;vertical-align:top">${label}</td><td style="padding:4px 0;color:#111114">${valeur}</td></tr>`;
  const html = `<!doctype html>
<html lang="fr"><body style="margin:0;padding:24px;background:#EEECE8;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#111114">
<div style="max-width:600px;margin:0 auto;background:#FFFFFF;border-top:6px solid ${JAUNE};padding:24px">
<h1 style="margin:0 0 16px;font-size:20px">💬 ${nature} de ${e(qui)}</h1>
<table style="border-collapse:collapse;margin-bottom:16px">
${ligne("Fiche", `${e(cand)} · ${e(titre)}`)}
${ligne("Section", e(section))}
${ligne("Date", `${e(quand)} (heure de Paris)`)}
</table>
${
  passage
    ? `<p style="margin:0 0 4px;color:#6E7080">Passage surligné</p>
<blockquote style="margin:0 0 16px;padding:8px 12px;background:${JAUNE};white-space:pre-wrap">${e(passage)}</blockquote>`
    : ""
}<p style="margin:0 0 4px;color:#6E7080">Commentaire</p>
<div style="margin:0 0 24px;padding:12px;border-left:4px solid ${JAUNE};background:#F7F6F3;white-space:pre-wrap">${e(corps)}</div>
<a href="${e(lien)}" style="display:inline-block;background:${JAUNE};color:#111114;text-decoration:none;font-weight:bold;padding:10px 18px;border-radius:6px">Voir la fiche</a>
</div>
</body></html>`;

  return { objet, texte, html };
}

// Envoie l'alerte. Ne lève jamais d'exception : renvoie
// { statut: "envoye" | "non-configure" | "bloque-hors-production" | "echec" }.
// `creerTransport`, `env` et `log` sont remplaçables en test.
export async function envoyerAlerteCommentaire(
  donnees,
  { env = process.env, creerTransport = (c) => nodemailer.createTransport(c), log = console } = {},
) {
  try {
    const config = configSmtpClub(env);
    if (!config) {
      log.log("[alerte-commentaire] SMTP absent : pas d'e-mail");
      return { statut: "non-configure" };
    }
    if (!envoiMailAutorise(env)) {
      log.log("[alerte-commentaire] hors production : pas d'e-mail");
      return { statut: "bloque-hors-production" };
    }
    const mail = composerAlerteCommentaire(donnees);
    const destinataire = env.ALERTE_COMMENTAIRES_EMAIL?.trim() || DESTINATAIRE_PAR_DEFAUT;
    await creerTransport(config).sendMail({
      from: `"Perlimpinpin" <${config.auth.user}>`,
      to: destinataire,
      subject: mail.objet,
      text: mail.texte,
      html: mail.html,
    });
    log.log(`[alerte-commentaire] e-mail envoyé (${donnees?.ficheSlug ?? "?"})`);
    return { statut: "envoye" };
  } catch (e) {
    // Jamais le message complet (il peut contenir des adresses)
    const erreur = `${e?.code ?? "erreur"}${e?.responseCode ? ` ${e.responseCode}` : ""}`;
    log.error(`[alerte-commentaire] échec de l'envoi : ${erreur}`);
    return { statut: "echec", erreur };
  }
}
