import Link from "next/link";
import { PASSWORD_MIN_LENGTH } from "@/lib/live-password";
import { compteDuLien } from "@/lib/mot-de-passe-oublie";
import NouveauMotDePasseForm from "@/components/NouveauMotDePasseForm";
import { choisirNouveauMotDePasse } from "../actions";
import LoginShell, { buttonClass, inputClass, labelClass, lienClass } from "../LoginShell";

export const metadata = {
  title: "Nouveau mot de passe — Décryptage en direct",
  robots: { index: false, follow: false },
  // Le lien contient le jeton : il ne doit jamais partir vers un autre site via l'en-tête Referer
  referrer: "no-referrer",
};

export default async function LiveNouveauMotDePassePage({ searchParams }) {
  const { jeton } = await searchParams;
  const valeur = typeof jeton === "string" ? jeton : "";

  let valable = false;
  try {
    valable = Boolean(await compteDuLien("live", valeur));
  } catch (error) {
    console.error("[live] vérification du lien impossible :", error);
  }

  const basDePage = (
    <Link href="/live/login" className={lienClass}>
      Retour à la connexion
    </Link>
  );

  if (!valable) {
    return (
      <LoginShell titre="Lien expiré" intro="Ce lien n'est plus valable : il a expiré (1 heure) ou a déjà servi." basDePage={basDePage}>
        <Link href="/live/login/mot-de-passe-oublie" className={`${buttonClass} block text-center`}>
          Demander un nouveau lien
        </Link>
      </LoginShell>
    );
  }

  return (
    <LoginShell titre="Nouveau mot de passe" intro="Choisissez votre nouveau mot de passe. Vous serez connecté directement ensuite." basDePage={basDePage}>
      <NouveauMotDePasseForm
        action={choisirNouveauMotDePasse}
        jeton={valeur}
        minLength={PASSWORD_MIN_LENGTH}
        idPrefix="live-nouveau"
        lienNouvelleDemande="/live/login/mot-de-passe-oublie"
        labelClass={labelClass}
        inputClass={inputClass}
        buttonClass={buttonClass}
      />
    </LoginShell>
  );
}
