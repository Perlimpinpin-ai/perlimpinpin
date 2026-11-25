import Link from "next/link";
import ManageCookiesButton from "./ManageCookiesButton";
import ContactFooterButton from "./ContactFooterButton";

// Mêmes routes que la barre de navigation (voir Header.js) : toutes existent.
const platformLinks = [
  { label: "Déclarations", href: "/declarations" },
  { label: "Candidats", href: "/candidats" },
  { label: "Thèmes", href: "/themes" },
  { label: "Dossiers", href: "/dossiers" },
  { label: "Méthode", href: "/methode" },
  { label: "À propos", href: "/a-propos" },
];

// Comptes officiels, ouverts dans un nouvel onglet (voir FooterLink).
const socialLinks = [
  { label: "X (Twitter)", href: "https://x.com/PerlimpinpinAI", icon: XIcon },
  { label: "Instagram", href: "https://www.instagram.com/perlimpinpin.ai", icon: InstagramIcon },
  { label: "LinkedIn", href: "https://www.linkedin.com/company/perlimpinpin-ai", icon: LinkedInIcon },
];

const legalLinks = [
  { label: "Mentions légales", href: "/mentions-legales" },
  { label: "Confidentialité", href: "/confidentialite" },
];

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
      <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9.75h4v11.25H3zM9.5 9.75h3.8v1.54h.05c.53-1 1.83-2.05 3.77-2.05 4.03 0 4.78 2.65 4.78 6.1V21h-4v-5.02c0-1.2-.02-2.74-1.67-2.74-1.67 0-1.93 1.3-1.93 2.65V21h-4z" />
    </svg>
  );
}

// Lien actif si `href` est renseigné, sinon simple texte grisé non cliquable.
function FooterLink({ href, external = false, className, children }) {
  if (!href) {
    return (
      <span aria-disabled="true" className={`${className} cursor-default opacity-60`}>
        {children}
      </span>
    );
  }
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

function ColumnLabel({ children }) {
  return (
    <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
      {children}
    </p>
  );
}

export default function Footer() {
  return (
    <footer className="print:hidden mt-auto w-full bg-zinc-100 px-6 pt-14 pb-10 text-zinc-600 sm:px-8 sm:pt-16">
      <div className="mx-auto w-full max-w-[1280px]">
        <div className="flex flex-col gap-10 md:flex-row md:justify-between">
          <div>
            {/* Logo officiel (public/logo/perlimpinpin-logo.png, 615×72). */}
            <img
              src="/logo/perlimpinpin-logo.png"
              alt="Perlimpinpin"
              width={615}
              height={72}
              className="h-6 w-auto sm:h-7"
            />
            <p className="mt-4 text-base text-zinc-500">
              Ce que valent vraiment les promesses politiques.
            </p>
          </div>

          <div className="flex flex-col gap-10 sm:flex-row sm:gap-24 md:gap-28">
            <nav aria-label="Plateforme">
              <ColumnLabel>Plateforme</ColumnLabel>
              <ul className="mt-4 flex flex-col gap-3">
                {platformLinks.map((link) => (
                  <li key={link.href}>
                    <FooterLink
                      href={link.href}
                      className="text-base text-zinc-700 transition-colors hover:text-zinc-950"
                    >
                      {link.label}
                    </FooterLink>
                  </li>
                ))}
              </ul>
            </nav>

            <div>
              <ColumnLabel>Suivre</ColumnLabel>
              <ul className="mt-4 flex flex-col gap-3">
                {socialLinks.map(({ label, href, icon: Icon }) => (
                  <li key={label}>
                    <FooterLink
                      href={href}
                      external
                      className="flex items-center gap-3 text-base text-zinc-700 transition-colors hover:text-zinc-950"
                    >
                      <Icon />
                      {label}
                    </FooterLink>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t border-zinc-200 pt-8 font-mono text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Perlimpinpin. Tous droits réservés.</p>
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {legalLinks.map((link, index) => (
              <li key={link.label} className="flex items-center gap-5">
                {index > 0 ? (
                  <span aria-hidden="true" className="h-4 w-px bg-zinc-300" />
                ) : null}
                <FooterLink
                  href={link.href}
                  className="transition-colors hover:text-zinc-950"
                >
                  {link.label}
                </FooterLink>
              </li>
            ))}
            <li className="flex items-center gap-5">
              <span aria-hidden="true" className="h-4 w-px bg-zinc-300" />
              <ContactFooterButton className="cursor-pointer transition-colors hover:text-zinc-950" />
            </li>
            <li className="flex items-center gap-5">
              <span aria-hidden="true" className="h-4 w-px bg-zinc-300" />
              <ManageCookiesButton className="cursor-pointer transition-colors hover:text-zinc-950" />
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
