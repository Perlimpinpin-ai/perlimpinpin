import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdherent } from "@/lib/relecture-auth";
import MotDePasseOublieForm from "@/components/MotDePasseOublieForm";
import ClubShell from "../ClubShell";
import { demanderNouveauMotDePasse } from "../actions";
import { buttonClass, inputClass, labelClass } from "../ui";

export const metadata = {
  title: "Mot de passe oublié — Club Perlimpinpin",
  robots: { index: false, follow: false },
};

export default async function RelectureMotDePasseOubliePage() {
  if (await getAdherent()) redirect("/relectures");

  return (
    <ClubShell
      titre="Mot de passe oublié"
      intro="Indiquez l'adresse e-mail de votre compte adhérent : nous vous envoyons un lien pour choisir un nouveau mot de passe."
      basDePage={
        <>
          Vous l&apos;avez retrouvé ?{" "}
          <Link href="/relectures/connexion" className="font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-4 hover:decoration-zinc-900">
            Se connecter
          </Link>
        </>
      }
    >
      <MotDePasseOublieForm
        action={demanderNouveauMotDePasse}
        idPrefix="relecture-oubli"
        labelClass={labelClass}
        inputClass={inputClass}
        buttonClass={buttonClass}
      />
    </ClubShell>
  );
}
