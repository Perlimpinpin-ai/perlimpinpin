import { redirect } from "next/navigation";
import { getLiveUser } from "@/lib/live-auth";
import { postLoginPath } from "@/lib/live-redirect";
import LoginForm from "./LoginForm";
import LoginShell from "./LoginShell";

export const metadata = {
  title: "Connexion — Décryptage en direct",
  robots: { index: false, follow: false },
};

export default async function LiveLoginPage({ searchParams }) {
  // Page à rouvrir après connexion (?next=), validée : uniquement une page interne de /live
  const { next } = await searchParams;
  const redirectTo = postLoginPath(typeof next === "string" ? next : null);

  // Déjà connecté : pas de formulaire, on va directement à la page demandée
  if (await getLiveUser()) redirect(redirectTo);

  return (
    <LoginShell intro="Accès réservé à l'équipe éditoriale. Connectez-vous avec votre compte personnel.">
      <LoginForm next={redirectTo} />
    </LoginShell>
  );
}
