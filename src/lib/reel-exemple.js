// Reel FICTIF, pour voir le style des 9 images sans générer de script
// (aucun appel payant) : /test/reels/0/image?exemple=1&scene=…, réservé aux personnes
// déverrouillées sur /test, jamais en cache. Les chiffres et la mesure sont
// inventés et le candidat n'existe pas : ces images ne doivent jamais être
// publiées.
export const CANDIDAT_EXEMPLE = "Candidat Exemple";
export const SCORE_EXEMPLE = 38;

export const VARIABLES_EXEMPLE = {
  accroche: {
    voix: "Bloquer le prix du carburant à un euro soixante-dix le litre.",
    sousTitres: "Bloquer le prix du carburant à 1,70 € le litre.",
    ecran: { titre: "Le carburant bloqué à la pompe", chiffre: "1,70 €" },
    icone: "pompe",
  },
  presentation: { voix: "", sousTitres: "", ecran: {}, icone: null },
  tient: {
    voix: "Bonne nouvelle, la loi permet de fixer un prix plafond. Ça s'est déjà fait.",
    sousTitres: "Bonne nouvelle, la loi permet de fixer un prix plafond. Ça s'est déjà fait.",
    ecran: { tampon: "C'EST LÉGAL" },
    icone: "balance",
  },
  hic: {
    voix: "Sauf que voilà. Quelqu'un doit payer la différence. Vous voyez le problème ?",
    sousTitres: "Sauf que voilà. Quelqu'un doit payer la différence. Vous voyez le problème ?",
    ecran: { chiffre: "EXEMPLE", legende: "chiffres inventés pour l'aperçu" },
    icone: "attention",
  },
  preuve: {
    voix: "Un pays voisin a essayé. Les stations ont vite manqué de carburant.",
    sousTitres: "Un pays voisin a essayé. Les stations ont vite manqué de carburant.",
    ecran: { titre: "Un pays voisin a déjà essayé" },
    icone: "globe",
  },
  facture: {
    voix: "La facture se compte en milliards. Et elle grimpe si le baril s'envole.",
    sousTitres: "La facture se compte en milliards. Et elle grimpe si le baril s'envole.",
    ecran: { chiffre: "12 Md€", legende: "par an, montant fictif d'exemple" },
    icone: "billet",
  },
  nuance: {
    voix: "Si le pétrole baisse, la facture fond. Tout dépend du marché mondial.",
    sousTitres: "Si le pétrole baisse, la facture fond. Tout dépend du marché mondial.",
    ecran: { titre: "Tout dépend du baril" },
    icone: "baril",
  },
  verdict: {
    voix: "La loi le permet… mais à ce prix-là, gare à la panne sèche !",
    sousTitres: "La loi le permet… mais à ce prix-là, gare à la panne sèche !",
    ecran: {},
    icone: null,
  },
};
