// Médias qui parlent de Perlimpinpin (bandeau « Ils parlent de nous » de
// l'accueil, src/components/IlsParlentDeNous.js).
//
// Ajouter un média = ajouter une ligne :
//   nom     : nom du média (texte alternatif du logo)
//   logo    : fichier dans public/presse/ (SVG de préférence, sinon PNG léger)
//   url     : lien vers l'article ou le compte, ouvert dans un nouvel onglet.
//             Laisser "" pour afficher le logo sans lien.
//   ariaLabel : facultatif, ce que lit un lecteur d'écran sur le lien
//             (par défaut « Article de <nom> sur Perlimpinpin »).
//   hauteur : facultatif, hauteur du logo en px (36 par défaut). Sert à
//             donner le même poids visuel à un logo très vertical.
// Une ligne sans `logo` n'est pas affichée.

const presse = [
  {
    nom: "France Inter",
    logo: "/presse/france-inter.svg",
    url: "",
  },
  {
    nom: "Sydo",
    logo: "/presse/sydo.svg",
    url: "https://sydo.fr/sydologie/2026/11/perlimpinpin-ai-analyse-promesses/",
    hauteur: 52,
  },
  {
    nom: "Bonne analyse",
    logo: "", // fichier à fournir : public/presse/bonne-analyse.png
    url: "https://www.instagram.com/bonneanalyse/",
    ariaLabel: "Compte Instagram de Bonne analyse",
  },
];

export default presse;
