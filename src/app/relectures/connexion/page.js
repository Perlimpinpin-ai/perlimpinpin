import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdherent } from "@/lib/relecture-auth";
import { retourValide } from "@/lib/club-retour-core";
import ClubShell from "../ClubShell";
import ConnexionForm from "./ConnexionForm";

export const metadata = {
  title: "Connexion — Club Perlimpinpin",
  robots: { index: false, follow: false },
};

const lienClass = "font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-4 hover:decoration-zinc-900";

// ?retour=/declarations/<id>… : venu d'une fiche (« Commenter cette analyse »),
// on y revient après la connexion, l'inscription ou l'adhésion. Chemin vérifié
// par retourValide (fiches du site uniquement).
export default async function RelectureConnexionPage({ searchParams }) {
  const retour = retourValide((await searchParams)?.retour);

  // Déjà connecté : pas de formulaire, on va directement au Club (ou à la fiche)
  if (await getAdherent()) redirect(retour ?? "/relectures");

  const suite = retour ? `?retour=${encodeURIComponent(retour)}` : "";

  return (
    <ClubShell
      titre="Connexion"
      intro={
        <>
          <p>
            Le Club, c&apos;est l&apos;espace où les adhérents annotent et challengent les analyses de
            Perlimpinpin. Un chiffre douteux, une source oubliée, un argument mal interprété ?
            Signalez-le : l&apos;équipe vous répond sous 7 jours, et si votre remarque change
            l&apos;analyse, la fiche est révisée et vous gagnez des PerlimpinPOINTS.
          </p>
          <p className="mt-3">
            Réservé aux adhérents de l&apos;association Perlimpinpin. Pas encore membre ?{" "}
            {retour ? (
              <a href={`/relectures/adherer${suite}`} className={lienClass}>
                Adhérer dès 2 € →
              </a>
            ) : (
              <a
                href="https://www.helloasso.com/associations/perlimpinpin-ai"
                target="_blank"
                rel="noopener noreferrer"
                className={lienClass}
              >
                Adhérer sur HelloAsso →
              </a>
            )}
          </p>
        </>
      }
      basDePage={
        <>
          Première connexion ?{" "}
          <Link href={`/relectures/inscription${suite}`} className={lienClass}>
            Créer mon mot de passe
          </Link>
        </>
      }
    >
      <ConnexionForm retour={retour} />
    </ClubShell>
  );
}
