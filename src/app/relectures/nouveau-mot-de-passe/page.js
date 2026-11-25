import Link from "next/link";
import { PASSWORD_MIN_LENGTH } from "@/lib/live-password";
import { compteDuLien } from "@/lib/mot-de-passe-oublie";
import NouveauMotDePasseForm from "@/components/NouveauMotDePasseForm";
import ClubShell from "../ClubShell";
import { choisirNouveauMotDePasse } from "../actions";
import { buttonClass, inputClass, labelClass } from "../ui";

export const metadata = {
  title: "Nouveau mot de passe — Club Perlimpinpin",
  robots: { index: false, follow: false },
  // Le lien contient le jeton : il ne doit jamais partir vers un autre site via l'en-tête Referer
  referrer: "no-referrer",
};

const lienClass = "font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-4 hover:decoration-zinc-900";

export default async function RelectureNouveauMotDePassePage({ searchParams }) {
  const { jeton } = await searchParams;
  const valeur = typeof jeton === "string" ? jeton : "";

  let valable = false;
  try {
    valable = Boolean(await compteDuLien("relectures", valeur));
  } catch (error) {
    console.error("[relectures] vérification du lien impossible :", error);
  }

  const basDePage = (
    <Link href="/relectures/connexion" className={lienClass}>
      Retour à la connexion
    </Link>
  );

  if (!valable) {
    return (
      <ClubShell titre="Lien expiré" intro="Ce lien n'est plus valable : il a expiré (1 heure) ou a déjà servi." basDePage={basDePage}>
        <Link href="/relectures/mot-de-passe-oublie" className={`${buttonClass} block text-center`}>
          Demander un nouveau lien
        </Link>
      </ClubShell>
    );
  }

  return (
    <ClubShell titre="Nouveau mot de passe" intro="Choisissez votre nouveau mot de passe. Vous serez connecté directement ensuite." basDePage={basDePage}>
      <NouveauMotDePasseForm
        action={choisirNouveauMotDePasse}
        jeton={valeur}
        minLength={PASSWORD_MIN_LENGTH}
        idPrefix="relecture-nouveau"
        lienNouvelleDemande="/relectures/mot-de-passe-oublie"
        labelClass={labelClass}
        inputClass={inputClass}
        buttonClass={buttonClass}
      />
    </ClubShell>
  );
}
