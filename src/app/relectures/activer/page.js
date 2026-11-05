import Link from "next/link";
import { PASSWORD_MIN_LENGTH } from "@/lib/live-password";
import { etatDuLienActivation } from "@/lib/club-activation";
import NouveauMotDePasseForm from "@/components/NouveauMotDePasseForm";
import ClubShell from "../ClubShell";
import { activerMonCompte } from "../actions";
import { buttonClass, inputClass, labelClass } from "../ui";

// Lien « Choisir mon mot de passe » du mail de bienvenue (nouvel adhérent
// HelloAsso). Page publique (voir PAGES_PUBLIQUES, relecture-auth-core.js).
export const metadata = {
  title: "Choisir mon mot de passe — Club Perlimpinpin",
  robots: { index: false, follow: false },
  // Le lien contient le jeton : il ne doit jamais partir vers un autre site via l'en-tête Referer
  referrer: "no-referrer",
};

const lienClass = "font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-4 hover:decoration-zinc-900";

export default async function ClubActiverPage({ searchParams }) {
  const { jeton } = await searchParams;
  const valeur = typeof jeton === "string" ? jeton : "";

  let etat = "invalide";
  try {
    etat = (await etatDuLienActivation(valeur)).etat;
  } catch (error) {
    console.error("[club] vérification du lien d'activation impossible :", error?.message ?? error);
  }

  const basDePage = (
    <Link href="/relectures/connexion" className={lienClass}>
      Se connecter
    </Link>
  );

  if (etat === "dejaActive") {
    return (
      <ClubShell titre="Compte déjà activé" intro="Votre mot de passe est déjà choisi : connectez-vous pour rejoindre le Club." basDePage={null}>
        <Link href="/relectures/connexion" className={`${buttonClass} block text-center`}>
          Se connecter
        </Link>
      </ClubShell>
    );
  }

  if (etat !== "valable") {
    return (
      <ClubShell
        titre="Lien expiré"
        intro="Ce lien n'est plus valable : il a expiré (7 jours) ou a déjà servi. Vous pouvez choisir votre mot de passe avec l'adresse e-mail de votre adhésion."
        basDePage={basDePage}
      >
        <Link href="/relectures/inscription" className={`${buttonClass} block text-center`}>
          Choisir mon mot de passe
        </Link>
      </ClubShell>
    );
  }

  return (
    <ClubShell
      titre="Bienvenue au Club"
      intro="Choisissez votre mot de passe. Vous serez connecté directement, et ramené à l'analyse d'où vous veniez."
      basDePage={basDePage}
    >
      <NouveauMotDePasseForm
        action={activerMonCompte}
        jeton={valeur}
        minLength={PASSWORD_MIN_LENGTH}
        idPrefix="club-activer"
        lienNouvelleDemande="/relectures/inscription"
        labelClass={labelClass}
        inputClass={inputClass}
        buttonClass={buttonClass}
        libelleMotDePasse="Mot de passe"
        libelleBouton="Choisir mon mot de passe"
      />
    </ClubShell>
  );
}
