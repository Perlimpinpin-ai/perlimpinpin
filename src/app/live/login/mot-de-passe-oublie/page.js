import Link from "next/link";
import { redirect } from "next/navigation";
import { getLiveUser } from "@/lib/live-auth";
import MotDePasseOublieForm from "@/components/MotDePasseOublieForm";
import { demanderNouveauMotDePasse } from "../actions";
import LoginShell, { buttonClass, inputClass, labelClass, lienClass } from "../LoginShell";

export const metadata = {
  title: "Mot de passe oublié — Décryptage en direct",
  robots: { index: false, follow: false },
};

export default async function LiveMotDePasseOubliePage() {
  if (await getLiveUser()) redirect("/live");

  return (
    <LoginShell
      titre="Mot de passe oublié"
      intro="Indiquez l'adresse e-mail de votre compte : nous vous envoyons un lien pour choisir un nouveau mot de passe."
      basDePage={
        <>
          Vous l&apos;avez retrouvé ?{" "}
          <Link href="/live/login" className={lienClass}>
            Se connecter
          </Link>
        </>
      }
    >
      <MotDePasseOublieForm
        action={demanderNouveauMotDePasse}
        idPrefix="live-oubli"
        labelClass={labelClass}
        inputClass={inputClass}
        buttonClass={buttonClass}
      />
    </LoginShell>
  );
}
