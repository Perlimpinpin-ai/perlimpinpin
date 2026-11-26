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
    // Alerte e-mail à chaque nouveau commentaire : titre et candidat des fiches en relecture.
    "/api/relectures/comments": ["./data/relectures/*.json"],
    // Cartes des publications X : police Inter et portraits bleus lus sur disque.
    "/api/carte/[id]": ["./public/fonts/*.otf", "./public/portraits-bleus/*.png"],
    // Slides des carrousels Instagram : polices Source Serif 4 et Geist Mono
    // (.ttf), Inter (.otf), portraits bleus (repli),
    // et les illustrations des candidats (celles des vignettes du site, prises
    // en pleine taille dans public/photos/ ; dossier des vignettes embarqué aussi),
    // et la couverture en collage : portraits noir et blanc, photos et
    // stickers des thèmes (scripts/images-couverture.js).
    // Charte RS : Inter Display et JetBrains Mono (public/fonts/reel/), DM Serif
    // Display (public/fonts/carrousel/), grain, papier, vignettes noir et blanc.
    "/api/carrousel/[id]": [
      "./public/fonts/reel/*",
      "./public/fonts/carrousel/*",
      "./public/carrousel/*.png",
      "./public/carrousel/vignettes-nb/*.jpg",
      "./public/fonts/*.ttf",
      "./public/fonts/*.otf",
      "./public/portraits-bleus/*.png",
      "./public/portraits-nb/*.png",
      "./public/carrousel/themes/*",
      "./public/photos/*.jpg",
      "./public/photos/vignettes/*.webp",
    ],
    // Bouton « Générer le récit » (Server Action de la page) : prompt lu à
    // l'exécution ; la page vérifie aussi la présence des images du candidat.
    "/test/reseaux/[id]": [
      "./data/prompt-recit.md",
      "./public/photos/*.jpg",
      "./public/portraits-bleus/*.png",
      "./public/portraits-nb/*.png",
      "./public/carrousel/themes/*",
    ],
    // Carrousels « analyse de programme » et « thématique » (charte RS) :
    // prompts lus par les Server Actions, polices et images par les routes.
    "/test/reseaux/programme/[slug]": ["./data/prompt-programme.md", "./public/carrousel/candidats/**/*.png"],
    "/test/reseaux/thematique/[theme]": ["./data/prompt-thematique.md", "./public/carrousel/candidats/**/*.png"],
    "/api/carrousel/programme/[slug]": ["./public/fonts/reel/*", "./public/fonts/carrousel/*", "./public/carrousel/*.png", "./public/carrousel/vignettes-nb/*.jpg", "./public/carrousel/candidats/**/*.png"],
    "/api/carrousel/thematique/[theme]": ["./public/fonts/reel/*", "./public/fonts/carrousel/*", "./public/carrousel/*.png", "./public/carrousel/vignettes-nb/*.jpg", "./public/carrousel/candidats/**/*.png"],
    // Images des Reels : polices Geist, fonds et portraits bleus lus sur disque.
    "/test/reels/[id]/image": ["./public/fonts/*.ttf", "./public/reel/*.png", "./public/portraits-bleus/*.png"],
    // Bouton « Générer le Reel » (Server Actions de ces pages) : prompt lu à
    // l'exécution ; la page d'une fiche vérifie aussi la présence du portrait.
    "/test/reels": ["./data/prompt-reel.md", "./public/reel/cartes/*.json"],
    // Storyboard v4 : la page contrôle le storyboard (cartes disponibles,
    // photos tramées, crédits, simulations de data/reel-demo/) ; la route des
    // images lit en plus les polices et les fonds (scripts/reel-ressources.js).
    "/test/reels/[id]": [
      "./data/prompt-reel.md",
      "./data/reel-demo/**/*",
      "./public/portraits-bleus/*.png",
      "./public/reel/cartes/*.json",
      "./public/reel/photos/**/*.png",
      "./public/illustrations/credits.json",
    ],
    "/test/reels/[id]/storyboard": [
      "./data/reel-demo/**/*",
      "./public/fonts/reel/*",
      "./public/reel/v4/*.png",
      "./public/reel/cartes/*.json",
      "./public/reel/photos/**/*.png",
      "./public/illustrations/credits.json",
    ],
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
