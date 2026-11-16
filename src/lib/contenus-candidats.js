// Contenus éditoriaux de la page candidat (/candidats/[id]) : blocs
// « Parcours », « Positions clés » et « Citation marquante ».
// Indexé par le nom exact du candidat, identique à Candidat.nom dans Neon.
// Un candidat absent de cet objet n'affiche aucun de ces blocs.
//
// Forme d'une entrée :
//   parcours  : tableau de paragraphes (texte simple)
//   positions : { intro, items: [{ titre, texte }], conclusion }
//   citation  : { texte, auteur, contexte }

const CONTENUS = {
  // Version du 16 novembre 2026, une semaine après l'annonce de sa
  // candidature. À mettre à jour quand son programme sera publié.
  "Teddy Riner": {
    parcours: [
      "Né le 7 avril 1989 en Guadeloupe, Teddy Riner est judoka (plus de 100 kg, Paris Saint-Germain). Il a été onze fois champion du monde en individuel. Aux Jeux olympiques, il a remporté cinq médailles d'or : Londres 2012, Rio 2016, Tokyo 2020 (par équipes mixtes) et Paris 2024 (en individuel et par équipes mixtes). Le 26 juillet 2024, il a allumé la vasque olympique de Paris avec Marie-José Pérec.",
      "Il n'a jamais exercé de mandat électif. Le 9 novembre 2026, il a annoncé sa candidature à l'élection présidentielle de 2027, sans étiquette partisane et avec le slogan « La France qu'on veut ».",
    ],
    positions: {
      intro:
        "Son programme détaillé n'est pas encore publié. Voici ses premières orientations, aucune n'étant chiffrée :",
      items: [
        {
          titre: "Salaires",
          texte: "augmenter le salaire net en allégeant les charges, pour réduire l'écart entre brut et net.",
        },
        {
          titre: "Temps de travail",
          texte:
            "garder les 35 heures comme référence, mais permettre à ceux qui le souhaitent de gagner plus en travaillant plus.",
        },
        {
          titre: "Retraites",
          texte:
            "une réforme jugée « incontournable », qui garde le système par répartition en y ajoutant une part de capitalisation.",
        },
        {
          titre: "Dépenses publiques",
          texte: "« dépenser moins et réinjecter mieux » pour ne pas « subir la dette ».",
        },
        {
          titre: "Sécurité",
          texte: "rétablir l'autorité de l'État, sans mesure précise à ce stade.",
        },
        {
          titre: "Lutte contre les discriminations",
          texte: "un axe de campagne revendiqué.",
        },
      ],
      conclusion: "Il se présente comme « ni de droite, ni de gauche ».",
    },
    citation: {
      texte: "« Je veux être le Président qui réconcilie et qui fédère. »",
      auteur: "Teddy Riner",
      contexte: "annonce de candidature, 9 novembre 2026",
    },
  },
};

export function getContenuCandidat(nom) {
  return CONTENUS[nom] ?? null;
}
