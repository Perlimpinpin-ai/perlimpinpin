import Header from "@/components/Header";

// Mise en page commune aux pages de connexion de /live (connexion, mot de passe
// oublié, nouveau mot de passe) : titre, intro, carte blanche.
export default function LoginShell({ titre = "Décryptage en direct", intro, children, basDePage }) {
  return (
    <div className="flex min-h-screen flex-col bg-page-gradient font-sans">
      <Header />

      <main className="mx-auto w-full max-w-md flex-1 px-6 py-16 sm:px-8">
        <h1 className="font-sans tracking-[-0.035em] text-3xl font-extrabold leading-tight text-zinc-900">{titre}</h1>
        <p className="mt-2 text-sm text-zinc-500">{intro}</p>

        <div className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6">{children}</div>

        {basDePage && <p className="mt-6 text-center text-sm text-zinc-500">{basDePage}</p>}
      </main>
    </div>
  );
}

// Classes des formulaires de /live (celles de LoginForm).
export const labelClass = "text-sm font-medium text-zinc-700";
export const inputClass =
  "mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-200";
export const buttonClass =
  "mt-1 w-full rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40";
export const lienClass = "font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-4 hover:decoration-zinc-900";
