import Link from "next/link";
import { cookies } from "next/headers";
import { COOKIE_RETOUR, retourValide } from "@/lib/club-retour-core";
import ClubShell from "../ClubShell";
import { buttonClass } from "../ui";

// Page de retour après le paiement HelloAsso (à régler comme adresse de
// retour du formulaire d'adhésion, si HelloAsso le permet). Page publique :
// le compte n'est pas encore activé à ce stade. Le cookie club_retour n'est
// PAS effacé ici : il sert encore quand l'adhérent choisira son mot de passe
// depuis le mail de bienvenue (/relectures/activer).
export const metadata = {
  title: "Merci pour votre adhésion — Club Perlimpinpin",
  robots: { index: false, follow: false },
};

const lienClass = "font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-4 hover:decoration-zinc-900";

export default async function ClubMerciPage() {
  const retour = retourValide((await cookies()).get(COOKIE_RETOUR)?.value);

  return (
    <ClubShell
      titre="Merci, et bienvenue !"
      intro={
        <>
          <p>Votre adhésion est bien enregistrée. Un e-mail de bienvenue arrive dans quelques minutes, avec un lien pour choisir votre mot de passe.</p>
          <p className="mt-2">Pensez à regarder dans les indésirables.</p>
        </>
      }
      basDePage={
        <>
          Mot de passe déjà choisi ?{" "}
          <Link href="/relectures/connexion" className={lienClass}>
            Se connecter
          </Link>
        </>
      }
    >
      <Link href={retour ?? "/declarations"} className={`${buttonClass} block text-center`}>
        {retour ? "Revenir à l'analyse" : "Découvrir les analyses"}
      </Link>
    </ClubShell>
  );
}
