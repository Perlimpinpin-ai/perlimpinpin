import { readFileSync } from "node:fs";
import { join } from "node:path";
import nodemailer from "nodemailer";
import { EXPEDITEUR, configSmtpClub } from "./mail-bienvenue.js";
import { isAdmin } from "./relecture-admin.js";
import { NOM_APERCU, fichesAAnnoncer, lirePersonnalisation, prenomDepuisNom, redigerAnnonce } from "./relecture-annonce.js";
import { SLUG_PATTERN } from "./relecture-revision.js";

// Envoi du mail d'annonce des fiches en relecture (/relectures, mode comité,
// fenêtre « Aperçu du mail ») : POST /api/relectures/annonce/envoyer.
// Même texte que l'aperçu (redigerAnnonce), retouché ou non par le comité
// (body { sujet, corps }, vérifié par lirePersonnalisation), même boîte SMTP que le mail de
// bienvenue (CLUB_SMTP_*, expéditeur club@perlimpinpin.ai).
// Règles : un mail = un destinataire, seul dans « À » ; ni les réglages SMTP
// ni les adresses ne sont journalisés. Prisma, le transport et la pause sont
// passés en paramètres (tests : scripts/relecture-annonce-envoi.test.js).

// Adhérents qui reçoivent l'annonce : ceux qui ne se sont pas désinscrits.
export const ADHERENTS_ELIGIBLES = { desinscritMailsRelectureAt: null };
export const REPONDRE_A = "club@perlimpinpin.ai";
export const PAUSE_MS = 500;
// Marge sous maxDuration (60 s, Vercel) : au-delà, on s'arrête proprement et
// on renvoie le nombre de mails non tentés plutôt que d'être coupé en plein envoi.
export const BUDGET_MS = 50_000;

// Contenu de data/relectures/<slug>.json, ou null.
export function lireFicheRelecture(ficheSlug) {
  // Slug vérifié par SLUG_PATTERN : pas de chemin arbitraire.
  if (!SLUG_PATTERN.test(ficheSlug)) return null;
  try {
    return JSON.parse(readFileSync(join(process.cwd(), "data", "relectures", `${ficheSlug}.json`), "utf8"));
  } catch {
    return null;
  }
}

// Fiches dont le chrono est en cours, lues en base et sur disque (aperçu et envoi).
export async function chargerFiches(prisma, lireFiche = lireFicheRelecture, maintenant = new Date()) {
  const chronos = await prisma.relectureFiche.findMany({ where: { reviewDeadline: { not: null } } });
  return fichesAAnnoncer({ chronos, lireFiche, maintenant });
}

const refus = (status, error) => ({ status, body: { error } });

// Renvoie { status, body } : body = { envoyes, echecs: [adresses], restants } ou { error }.
export async function traiterEnvoi({
  request,
  prisma,
  lireFiche = lireFicheRelecture,
  env = process.env,
  creerTransport = (config) => nodemailer.createTransport(config),
  attendre = (ms) => new Promise((r) => setTimeout(r, ms)),
  horloge = () => Date.now(),
  log = console,
}) {
  if (!isAdmin(request)) return refus(401, "Code admin absent ou invalide.");

  const data = await request.json().catch(() => null);
  const mode = data?.mode;
  if (mode !== "test" && mode !== "reel") return refus(400, "Mode invalide (test ou reel).");
  if (mode === "reel" && data.confirmation !== "oui") return refus(400, "Confirmation manquante : tapez « oui ».");
  const { perso, error } = lirePersonnalisation(data);
  if (error) return refus(400, error);

  const config = configSmtpClub(env);
  if (!config) return refus(500, "Configuration SMTP incomplète.");

  const fiches = await chargerFiches(prisma, lireFiche);
  if (!fiches.length) return refus(409, "Aucune fiche avec chrono en cours.");

  let destinataires;
  if (mode === "test") {
    const email = env.ANNONCE_TEST_EMAIL?.trim();
    if (!email?.includes("@")) return refus(500, "Adresse de test absente (ANNONCE_TEST_EMAIL).");
    destinataires = [{ email, nom: NOM_APERCU }];
  } else {
    const adherents = await prisma.adherent.findMany({
      where: ADHERENTS_ELIGIBLES,
      select: { email: true, nom: true, desinscritMailsRelectureAt: true },
      orderBy: { id: "asc" },
    });
    // Double contrôle : jamais un désinscrit, quoi que renvoie la requête.
    destinataires = adherents.filter((a) => !a.desinscritMailsRelectureAt && a.email);
  }

  const debut = horloge();
  const transport = creerTransport(config);
  let envoyes = 0;
  const echecs = [];
  let i = 0;
  for (; i < destinataires.length; i++) {
    if (i > 0) {
      if (horloge() - debut > BUDGET_MS) break;
      await attendre(PAUSE_MS);
    }
    const { email, nom } = destinataires[i];
    const mail = redigerAnnonce({ fiches, prenom: prenomDepuisNom(nom), perso });
    try {
      await transport.sendMail({
        from: EXPEDITEUR,
        to: email,
        replyTo: REPONDRE_A,
        subject: mail.sujet,
        text: mail.texte,
        html: mail.html,
      });
      envoyes += 1;
    } catch (e) {
      echecs.push(email);
      // Jamais le message complet : il peut contenir l'adresse du destinataire.
      log.error(`[annonce] échec du mail n°${i + 1} : ${e?.code ?? "erreur"}${e?.responseCode ? ` ${e.responseCode}` : ""}`);
    }
  }
  transport.close?.();
  const restants = destinataires.length - i;
  log.log(`[annonce] mode ${mode} : ${envoyes} envoyé(s), ${echecs.length} échec(s), ${restants} non tenté(s)`);
  return { status: 200, body: { envoyes, echecs, restants } };
}
