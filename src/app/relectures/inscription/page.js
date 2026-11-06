import Link from "next/link";
import { redirect } from "next/navigation";
import { PASSWORD_MIN_LENGTH } from "@/lib/live-password";
import { getAdherent } from "@/lib/relecture-auth";
import ClubShell from "../ClubShell";
import InscriptionForm from "./InscriptionForm";

export const metadata = {
  title: "Première connexion — Club Perlimpinpin",
  robots: { index: false, follow: false },
};

export default async function RelectureInscriptionPage() {
  if (await getAdherent()) redirect("/relectures");

  return (
    <ClubShell
      titre="Première connexion"
      intro="Adhérent de l'association Perlimpinpin ? Choisissez votre mot de passe, avec l'adresse e-mail donnée lors de votre adhésion."
      basDePage={
        <>
          Déjà un mot de passe ?{" "}
          <Link href="/relectures/connexion" className="font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-4 hover:decoration-zinc-900">
            Se connecter
          </Link>
        </>
      }
    >
      <InscriptionForm minLength={PASSWORD_MIN_LENGTH} />
    </ClubShell>
  );
}
