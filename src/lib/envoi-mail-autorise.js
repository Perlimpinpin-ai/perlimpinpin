// Garde-fou des e-mails du Club : AUCUN mail ne part d'une preview Vercel.
// Les previews partagent la base de production (vrais adhérents, vraies
// adresses) : un mail parti d'une preview atterrirait chez un vrai membre.
// Les variables CLUB_SMTP_* sont censées n'exister qu'en production ; ce
// contrôle ne compte pas là-dessus et bloque lui-même l'envoi.
//
//   - Vercel production            → autorisé ;
//   - Vercel preview / development → bloqué ;
//   - Vercel sans VERCEL_ENV       → bloqué (prudence) ;
//   - `next dev` en local          → bloqué (le .env local pointe vers la prod) :
//                                     le lien est affiché dans le terminal à la place ;
//   - scripts en ligne de commande (node scripts/…, hors Vercel et hors
//     `next dev`) → autorisé : c'est ainsi qu'Arno envoie volontairement
//     un mail de bienvenue en rattrapage (scripts/envoyer-bienvenue.js).
//
// Fonction pure (testée par scripts/envoi-mail-autorise.test.js).

export const STATUT_BLOQUE = "bloque-hors-production";

export function envoiMailAutorise(env = process.env) {
  if (env.VERCEL_ENV) return env.VERCEL_ENV === "production";
  if (env.VERCEL) return false;
  if (env.NODE_ENV === "development") return false;
  return true;
}
