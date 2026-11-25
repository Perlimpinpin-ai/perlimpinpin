// Reel FICTIF, pour voir le style des 9 images sans générer de script
// (aucun appel payant) : /test/reels/0/image?exemple=1&scene=…, réservé aux personnes
// déverrouillées sur /test, jamais en cache. Les chiffres et la mesure sont
// inventés et le candidat n'existe pas : ces images ne doivent jamais être
// publiées.
export const CANDIDAT_EXEMPLE = "Candidat Exemple";
export const SCORE_EXEMPLE = 38;

export const VARIABLES_EXEMPLE = {
  accroche: {
    voix: "Bloquer le prix du carburant à un euro soixante-dix le litre. Vous feriez le plein plus souvent ?",
    sousTitres: "Bloquer le prix du carburant à 1,70 € le litre. Vous feriez le plein plus souvent ?",
    ecran: { titre: "Le carburant bloqué à la pompe", chiffre: "1,70 €" },
    icone: "pompe",
    animation: { entrees: [{ element: "texte", effet: "zoom-impact" }, { element: "chiffre", effet: "compteur" }, { element: "icone", effet: "pop-rebond" }], transition: "allumage-ecran" },
    son: { nom: "blip", moment: "entree" },
  },
  presentation: {
    voix: "",
    sousTitres: "",
    ecran: {},
    icone: null,
    animation: { entrees: [{ element: "icone", effet: "pixel-par-pixel" }, { element: "texte", effet: "machine-a-ecrire" }], transition: "coupe-glitch" },
    son: null,
  },
  tient: {
    voix: "Bonne nouvelle, la loi permet de fixer un prix plafond. Ça s'est déjà fait.",
    sousTitres: "Bonne nouvelle, la loi permet de fixer un prix plafond. Ça s'est déjà fait.",
    ecran: { tampon: "C'EST LÉGAL" },
    icone: "balance",
    animation: { entrees: [{ element: "icone", effet: "glisse-gauche" }, { element: "texte", effet: "zoom-impact" }], transition: "plongee-pixel" },
    son: { nom: "impact", moment: "entree" },
  },
  hic: {
    voix: "Sauf que voilà. Quelqu'un doit payer la différence. Vous voyez le problème ?",
    sousTitres: "Sauf que voilà. Quelqu'un doit payer la différence. Vous voyez le problème ?",
    ecran: { chiffre: "EXEMPLE", legende: "chiffres inventés pour l'aperçu" },
    icone: "attention",
    animation: { entrees: [{ element: "chiffre", effet: "zoom-impact" }, { element: "icone", effet: "glisse-gauche" }, { element: "texte", effet: "machine-a-ecrire" }], transition: "coupe-glitch" },
    son: { nom: "glitch", moment: "chiffre" },
  },
  preuve: {
    voix: "Un pays voisin a essayé. Les stations ont vite manqué de carburant.",
    sousTitres: "Un pays voisin a essayé. Les stations ont vite manqué de carburant.",
    ecran: { titre: "Un pays voisin a déjà essayé" },
    icone: "globe",
    animation: { entrees: [{ element: "icone", effet: "pop-rebond" }, { element: "texte", effet: "glisse-bas" }], transition: "vague-gros-pixels" },
    son: { nom: "whoosh", moment: "transition" },
  },
  facture: {
    voix: "La facture se compte en milliards. Et elle grimpe si le baril s'envole.",
    sousTitres: "La facture se compte en milliards. Et elle grimpe si le baril s'envole.",
    ecran: { chiffre: "12 Md€", legende: "par an, montant fictif d'exemple" },
    icone: "billet",
    animation: { entrees: [{ element: "chiffre", effet: "compteur" }, { element: "icone", effet: "pop-rebond" }, { element: "texte", effet: "machine-a-ecrire" }], transition: "coupe-seche" },
    son: { nom: "piece", moment: "chiffre" },
  },
  nuance: {
    voix: "Si le pétrole baisse, la facture fond. Tout dépend du marché mondial.",
    sousTitres: "Si le pétrole baisse, la facture fond. Tout dépend du marché mondial.",
    ecran: { titre: "Tout dépend du baril" },
    icone: "baril",
    animation: { entrees: [{ element: "texte", effet: "glisse-gauche" }, { element: "icone", effet: "pop-rebond" }], transition: "allumage-ecran" },
    son: null,
  },
  verdict: {
    voix: "La loi le permet… mais à ce prix-là, gare à la panne sèche !",
    sousTitres: "La loi le permet… mais à ce prix-là, gare à la panne sèche !",
    ecran: {},
    icone: null,
    animation: { entrees: [{ element: "texte", effet: "pop-rebond" }], transition: "coupe-glitch" },
    son: null,
  },
};

// Couverture et variantes du Reel fictif (comme rangées par la génération).
export const COUVERTURE_EXEMPLE = { titre: "Le carburant bloqué à 1,70 €", question: "Qui paie ?" };
export const VARIANTES_EXEMPLE = { signature: 1, presentation: 1, verdict: 2, appel: 3 };
