import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdherent } from "@/lib/relecture-auth";
import ClubShell from "../ClubShell";
import ConnexionForm from "./ConnexionForm";

export const metadata = {
  title: "Connexion — Club Perlimpinpin",
  robots: { index: false, follow: false },
};

export default async function RelectureConnexionPage() {
  // Déjà connecté : pas de formulaire, on va directement au Club
  if (await getAdherent()) redirect("/relectures");

  return (
    <ClubShell
      titre="Connexion"
      intro={
        <>
          <p>
            Le Club, c&apos;est l&apos;espace où les adhérents améliorent les analyses de Perlimpinpin.
            Un chiffre douteux, une source oubliée, un argument mal interprété ? Proposez une
            modification : l&apos;IA l&apos;examine, et si elle est jugée pertinente, l&apos;analyse
            est corrigée et vous gagnez des PerlimpinPOINTS.
          </p>
          <p className="mt-3">
            Réservé aux adhérents de l&apos;association Perlimpinpin. Pas encore membre ?{" "}
            <a
              href="https://www.helloasso.com/associations/perlimpinpin-ai"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-4 hover:decoration-zinc-900"
            >
              Adhérer sur HelloAsso →
            </a>
          </p>
        </>
      }
      basDePage={
        <>
          Première connexion ?{" "}
          <Link href="/relectures/inscription" className="font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-4 hover:decoration-zinc-900">
            Créer mon mot de passe
          </Link>
        </>
      }
    >
      <ConnexionForm />
    </ClubShell>
  );
}
