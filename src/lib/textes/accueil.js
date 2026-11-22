// Textes modifiables de la page d'accueil (voir src/lib/textes-site.js).
// Ne sont PAS ici : les données (déclarations, candidats, scores) et les
// libellés des tranches de score (src/lib/score.js, liés à la méthodologie).

const page = {
  nom: "Accueil",
  chemin: "/",
  champs: [
    // Bandeau principal (src/components/HeroText.js)
    { cle: "hero.etiquette", groupe: "Bandeau principal", libelle: "Petite étiquette au-dessus du titre", defaut: "Présidentielles 2027" },
    {
      cle: "hero.titre",
      groupe: "Bandeau principal",
      libelle: "Grand titre",
      defaut: "Ce que valent vraiment les promesses politiques",
    },
    {
      cle: "hero.texte",
      groupe: "Bandeau principal",
      libelle: "Texte sous le titre",
      defaut:
        "Perlimpinpin analyse et note les propositions politiques grâce à l’IA, à une communauté contributive et à des sources transparentes. Analysez, commentez, améliorez.",
    },

    // Barre de recherche (src/components/SearchBar.js)
    {
      cle: "recherche.placeholder",
      groupe: "Barre de recherche",
      libelle: "Texte grisé dans la barre",
      defaut: "Rechercher une proposition, un candidat, un thème…",
    },
    { cle: "recherche.exemples.titre", groupe: "Barre de recherche", libelle: "Mot avant les exemples", defaut: "Exemples :" },
    {
      cle: "recherche.exemples",
      groupe: "Barre de recherche",
      libelle: "Exemples cliquables (un par ligne)",
      defaut: "prix du carburant\nretraites\nimmigration\npouvoir d'achat",
    },

    // Les 3 atouts sous le bandeau (src/components/HeroAtouts.js)
    { cle: "hero.atout1.titre", groupe: "Les 3 atouts", libelle: "Atout 1 — titre", defaut: "Analyses par l’IA" },
    {
      cle: "hero.atout1.texte",
      groupe: "Les 3 atouts",
      libelle: "Atout 1 — texte",
      defaut: "À partir de sources publiques.",
    },
    { cle: "hero.atout2.titre", groupe: "Les 3 atouts", libelle: "Atout 2 — titre", defaut: "Vos commentaires" },
    {
      cle: "hero.atout2.texte",
      groupe: "Les 3 atouts",
      libelle: "Atout 2 — texte",
      defaut: "Pour corriger, nuancer, compléter.",
    },
    { cle: "hero.atout3.titre", groupe: "Les 3 atouts", libelle: "Atout 3 — titre", defaut: "Une IA qui progresse" },
    {
      cle: "hero.atout3.texte",
      groupe: "Les 3 atouts",
      libelle: "Atout 3 — texte",
      defaut: "Grâce à la communauté (le Club).",
    },

    // Les 3 colonnes (src/components/BottomColumns.js)
    { cle: "colonnes.declarations.titre", groupe: "Les 3 colonnes", libelle: "Colonne 1 — titre", defaut: "Dernières déclarations" },
    { cle: "colonnes.declarations.lien", groupe: "Les 3 colonnes", libelle: "Colonne 1 — lien en bas", defaut: "Voir toutes les analyses →" },
    {
      cle: "colonnes.declarations.vide",
      groupe: "Les 3 colonnes",
      libelle: "Colonne 1 — message s'il n'y a aucune déclaration",
      defaut: "Aucune déclaration analysée pour le moment.",
    },
    { cle: "colonnes.score.titre", groupe: "Les 3 colonnes", libelle: "Colonne 2 — titre", defaut: "Le score Perlimpinpin IA" },
    {
      cle: "colonnes.score.texte",
      groupe: "Les 3 colonnes",
      libelle: "Colonne 2 — texte",
      defaut: "Chaque proposition est notée sur 100 points.",
    },
    { cle: "colonnes.score.lien", groupe: "Les 3 colonnes", libelle: "Colonne 2 — lien en bas", defaut: "Voir la méthode détaillée →" },
    { cle: "colonnes.candidats.titre", groupe: "Les 3 colonnes", libelle: "Colonne 3 — titre", defaut: "Indice de fiabilité des candidats" },
    {
      cle: "colonnes.candidats.soustitre",
      groupe: "Les 3 colonnes",
      libelle: "Colonne 3 — sous-titre",
      defaut: "Moyenne arithmétique des propositions des candidats",
    },
    { cle: "colonnes.candidats.lien", groupe: "Les 3 colonnes", libelle: "Colonne 3 — lien en bas", defaut: "Voir tous les candidats →" },
    {
      cle: "colonnes.candidats.vide",
      groupe: "Les 3 colonnes",
      libelle: "Colonne 3 — message s'il n'y a aucun candidat",
      defaut: "Aucun candidat enregistré.",
    },
    {
      cle: "colonnes.candidats.note",
      groupe: "Les 3 colonnes",
      libelle: "Colonne 3 — note en bas",
      defaut:
        "Ce score est une moyenne faite par l’IA qui ne constitue ni un jugement sur la personne, ni un indice général de crédibilité politique, et évolue au fur et à mesure des analyses.",
    },

    // Bandeau « Rejoindre » (src/components/SupportBanner.js)
    {
      cle: "bandeau.titre",
      groupe: "Bandeau « Rejoignez-nous »",
      libelle: "Titre (une ligne par morceau)",
      defaut: "L’objectivité ne se décrète pas.\nElle se construit.",
    },
    {
      cle: "bandeau.texte",
      groupe: "Bandeau « Rejoignez-nous »",
      libelle: "Texte",
      defaut:
        "Relisez, commentez et challengez les analyses avant leur publication en adhérant à l'association pour 2€.",
    },
    { cle: "bandeau.bouton", groupe: "Bandeau « Rejoignez-nous »", libelle: "Texte du bouton", defaut: "Rejoignez-nous →" },

    // Encadré du bas
    { cle: "transparence.titre", groupe: "Encadré du bas", libelle: "Titre", defaut: "Transparence et indépendance" },
    {
      cle: "transparence.texte",
      groupe: "Encadré du bas",
      libelle: "Texte",
      defaut:
        "Perlimpinpin est un projet éditorial indépendant. Nos analyses sont gratuites, sans publicité et sans influence politique.",
    },
    { cle: "transparence.lien", groupe: "Encadré du bas", libelle: "Lien", defaut: "En savoir plus sur nous →" },

    // Logos des médias (src/components/IlsParlentDeNous.js, liste dans src/lib/presse.js)
    { cle: "presse.titre", groupe: "Ils parlent de nous", libelle: "Titre au-dessus des logos", defaut: "Ils parlent de nous" },
  ],
};

export default page;
