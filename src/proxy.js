import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { LIVE_COOKIE_NAME } from "@/lib/live-auth-config";
import { loginUrl } from "@/lib/live-redirect";
import {
  RELECTURE_COOKIE_NAME,
  cheminRelectureProtege,
  lectureComiteAutorisee,
  lireSession,
} from "@/lib/relecture-auth-core";

// Next 16 : la convention `middleware` est renommée `proxy` (Node.js runtime par défaut).
// Deux espaces protégés, avec deux sessions indépendantes :
//   - /live (équipe éditoriale, Auth.js) ;
//   - /relectures (adhérents, cookie signé relecture_auth).
export async function proxy(request) {
  const { pathname } = request.nextUrl;
  if (pathname.toLowerCase().startsWith("/relectures")) return proxyRelectures(request);
  return proxyLive(request);
}

// Protège tout /relectures (y compris /relectures/index.html, fichier de public/ :
// le proxy passe avant les fichiers statiques) sauf connexion, inscription,
// déconnexion et mot de passe oublié. Contrôle « optimiste » : signature et expiration du cookie, sans
// base. Le vrai contrôle (compte toujours activé) est fait par getAdherent().
function proxyRelectures(request) {
  if (!cheminRelectureProtege(request.nextUrl.pathname)) return NextResponse.next();

  // AUTH_SECRET absent : lireSession renvoie null, personne n'entre (fail closed)
  const session = lireSession({
    secret: process.env.AUTH_SECRET,
    valeur: request.cookies.get(RELECTURE_COOKIE_NAME)?.value,
  });
  if (session) return NextResponse.next();

  // Lecture seule de la page par le comité (scripts/relecture.js lancer) : voir
  // lectureComiteAutorisee. Aucun cookie posé, et le code n'est jamais journalisé.
  const lectureComite = lectureComiteAutorisee({
    methode: request.method,
    pathname: request.nextUrl.pathname,
    codeRecu: request.headers.get("x-relecture-admin-code"),
    codeAdmin: process.env.RELECTURE_ADMIN_CODE,
  });
  if (lectureComite) return NextResponse.next();

  return NextResponse.redirect(new URL("/relectures/connexion", request.url));
}

// Protège tout /live sauf /live/login et ses sous-pages (mot de passe oublié).
// Contrôle « optimiste » : on vérifie seulement que
// le cookie de session Auth.js est valide (signature, chiffrement, expiration), sans
// requête en base. Le vrai contrôle (compte toujours existant) est fait au plus près du
// contenu, par getLiveUser() dans chaque page et chaque route API.
async function proxyLive(request) {
  const { pathname } = request.nextUrl;

  if (pathname === "/live/login" || pathname.startsWith("/live/login/")) {
    return NextResponse.next();
  }

  let token = null;
  try {
    token = await getToken({
      req: request,
      secret: process.env.AUTH_SECRET,
      cookieName: LIVE_COOKIE_NAME,
      salt: LIVE_COOKIE_NAME,
    });
  } catch (error) {
    // Ex. AUTH_SECRET absent : fail closed, personne n'est connecté
    console.error("[live] lecture de la session (proxy) impossible :", error);
  }

  if (!token?.sub) {
    // Mémorise la page demandée pour y revenir après connexion (voir
    // src/lib/live-redirect.js : seules les pages internes de /live sont suivies).
    const wanted = new URL(request.nextUrl);
    wanted.searchParams.delete("_rsc"); // paramètre interne des navigations client
    return NextResponse.redirect(new URL(loginUrl(wanted.pathname + wanted.search), request.url));
  }

  return NextResponse.next();
}

// /relectures en majuscules/minuscules indifférentes : sur un système de fichiers
// insensible à la casse (Windows en local), /RELECTURES/INDEX.HTML sert le même
// fichier et ne doit pas échapper au proxy. Chaînes écrites en toutes lettres : Next
// lit ce `config` par analyse statique (une variable ou un gabarit `${…}` le rend
// illisible, et le proxy s'appliquerait alors à TOUTES les pages).
export const config = {
  matcher: [
    "/live",
    "/live/:path*",
    "/([Rr][Ee][Ll][Ee][Cc][Tt][Uu][Rr][Ee][Ss])",
    "/([Rr][Ee][Ll][Ee][Cc][Tt][Uu][Rr][Ee][Ss])/:path*",
  ],
};
