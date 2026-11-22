// Tournures qui sonnent « IA » (docs/prompt-reel.md, section 1) : à éviter
// dans les textes destinés au public. Liste commune aux Reels et aux
// carrousels (avertissement, jamais refus). Fonctions PURES.

export const TOURNURES_IA = [
  "en somme",
  "crucial",
  "cruciale",
  "cruciaux",
  "il est important de noter",
  "il est important de souligner",
  "il convient de",
  "force est de constater",
  "en définitive",
  "il est essentiel",
  "un enjeu majeur",
  "enjeux majeurs",
  "dans un contexte de",
  "en outre",
  "par ailleurs",
  "à l'aune de",
  "véritable levier",
  "levier majeur",
  "plonger dans",
  "naviguer dans",
  "paysage politique",
  "en fin de compte",
  "notons que",
  "soulignons que",
];

function normaliser(t) {
  return String(t ?? "")
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/\s+/g, " ");
}

// Tournures trouvées dans un texte (liste, sans doublon), plus les « tirets
// en cascade » (au moins deux tirets cadratins ou demi-cadratins).
export function tournuresIA(texte) {
  const t = ` ${normaliser(texte)} `;
  const trouvees = TOURNURES_IA.filter((tournure) => {
    const motif = new RegExp(`(^|[^\\p{L}])${tournure.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\p{L}]|$)`, "u");
    return motif.test(t);
  });
  if ((String(texte ?? "").match(/[—–]/g) ?? []).length >= 2) trouvees.push("tirets en cascade");
  return trouvees;
}
