/** @type {import('next').NextConfig} */
const nextConfig = {
  // /api/live/analyze lit data/prompt-methodologie.md à l'exécution (barème
  // et doctrine, source unique) : sans cette inclusion, le fichier peut être
  // absent du bundle serverless déployé.
  outputFileTracingIncludes: {
    "/api/live/analyze": ["./data/prompt-methodologie.md"],
    // « Envoyer en révision » vérifie que la fiche existe et n'est pas archivée.
    "/api/relectures/revision": ["./data/relectures/*.json"],
    // Aperçu et envoi du mail d'annonce : candidat, parti et titre des fiches en relecture.
    "/api/relectures/annonce/apercu": ["./data/relectures/*.json"],
    "/api/relectures/annonce/envoyer": ["./data/relectures/*.json"],
    // « Mes commentaires » : titre des anciennes fiches relues et réponses archivées.
    "/api/relectures/mes-commentaires": ["./data/relectures/*.json"],
    // Cartes des publications X : police Inter et portraits bleus lus sur disque.
    "/api/carte/[id]": ["./public/fonts/*.otf", "./public/portraits-bleus/*.png"],
  },
  // Next.js ne résout pas automatiquement /relectures vers
  // public/relectures/index.html (pas de fallback "clean URL" sur les
  // fichiers statiques) : réécriture explicite pour que le lien partagé en
  // relecture fonctionne sans /index.html.
  // Adresse courte du Club Perlimpinpin (espace adhérents). Les redirections
  // passent avant le proxy : /club n'est pas protégé en soi, c'est la
  // destination /relectures qui l'est (src/proxy.js).
  async redirects() {
    return [{ source: "/club", destination: "/relectures", permanent: true }];
  },
  async rewrites() {
    return [{ source: "/relectures", destination: "/relectures/index.html" }];
  },
  // Images de public/ (photos des candidats, logo, bannières) : par défaut
  // Next.js les sert avec max-age=0, le navigateur les redemande donc à chaque
  // page (réponse 304, mais une requête CDN quand même). Cache d'un jour, puis
  // réutilisation pendant une semaine le temps de vérifier : pas « immutable »,
  // car les noms de fichiers ne changent pas quand une photo est remplacée.
  // Liste blanche de dossiers : JAMAIS /relectures (page protégée par le proxy).
  async headers() {
    const cacheImages = [
      {
        key: "Cache-Control",
        value: "public, max-age=86400, stale-while-revalidate=604800",
      },
    ];
    return [
      { source: "/photos/:path*", headers: cacheImages },
      { source: "/logo/:path*", headers: cacheImages },
      // Écrit encodé : le navigateur demande /banni%C3%A8re/…, et la règle
      // « /bannière/… » en toutes lettres ne s'applique pas.
      { source: "/banni%C3%A8re/:path*", headers: cacheImages },
      { source: "/avatar-placeholder.svg", headers: cacheImages },
    ];
  },
};

export default nextConfig;
