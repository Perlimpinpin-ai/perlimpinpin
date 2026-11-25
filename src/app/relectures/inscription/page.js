import Link from "next/link";
import { redirect } from "next/navigation";
import { PASSWORD_MIN_LENGTH } from "@/lib/live-password";
import { getAdherent } from "@/lib/relecture-auth";
import { retourValide } from "@/lib/club-retour-core";
import { ajouterMarqueurConnexion } from "@/lib/session-club-core";
import ClubShell from "../ClubShell";
import InscriptionForm from "./InscriptionForm";

export const metadata = {
  title: "Première connexion — Club Perlimpinpin",
  robots: { index: false, follow: false },
};

// ?retour=/declarations/<id>… : retour vers la fiche après l'inscription
// (chemin vérifié par retourValide, fiches du site uniquement).
export default async function RelectureInscriptionPage({ searchParams }) {
  const retour = retourValide((await searchParams)?.retour);
  if (await getAdherent()) redirect(ajouterMarqueurConnexion(retour ?? "/relectures"));
  const suite = retour ? `?retour=${encodeURIComponent(retour)}` : "";

  return (
    <ClubShell
      titre="Première connexion"
      intro="Adhérent de l'association Perlimpinpin ? Choisissez votre mot de passe, avec l'adresse e-mail donnée lors de votre adhésion."
      basDePage={
        <>
          Déjà un mot de passe ?{" "}
          <Link href={`/relectures/connexion${suite}`} className="font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-4 hover:decoration-zinc-900">
            Se connecter
          </Link>
        </>
      }
    >
      <InscriptionForm minLength={PASSWORD_MIN_LENGTH} retour={retour} />
    </ClubShell>
  );
}
