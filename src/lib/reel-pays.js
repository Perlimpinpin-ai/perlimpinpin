// Pays que le Reel peut montrer en carte pixel (scène `pays`). Pour chacun :
// la clé (nom du fichier public/reel/cartes/<cle>.json et .png), le code ISO
// numérique (scripts/carte-pays.js), le nom affiché et les façons de le citer
// dans la voix off (détection « pays cité sans carte »). `cadrage` : bornes
// lonMin,lonMax,latMin,latMax pour écarter l'outre-mer ou les îles lointaines.
// Fonctions PURES.

export const PAYS_REEL = [
  { cle: "fr", iso: 250, nom: "France", motifs: ["france"], cadrage: "-5.5,9.8,41.2,51.2" },
  { cle: "nl", iso: 528, nom: "Pays-Bas", motifs: ["pays-bas", "pays bas", "hollande"], cadrage: "3.2,7.3,50.7,53.6" },
  { cle: "dk", iso: 208, nom: "Danemark", motifs: ["danemark"], cadrage: "8,13,54.5,57.8" },
  { cle: "cl", iso: 152, nom: "Chili", motifs: ["chili"], cadrage: "-76,-66,-56,-17.5" },
  { cle: "se", iso: 752, nom: "Suède", motifs: ["suède", "suede"] },
  { cle: "no", iso: 578, nom: "Norvège", motifs: ["norvège", "norvege"], cadrage: "4.5,31.5,57.8,71.3" },
  { cle: "fi", iso: 246, nom: "Finlande", motifs: ["finlande"] },
  { cle: "de", iso: 276, nom: "Allemagne", motifs: ["allemagne"] },
  { cle: "it", iso: 380, nom: "Italie", motifs: ["italie"] },
  { cle: "es", iso: 724, nom: "Espagne", motifs: ["espagne"], cadrage: "-9.5,3.4,35.9,43.9" },
  { cle: "pt", iso: 620, nom: "Portugal", motifs: ["portugal"], cadrage: "-9.6,-6.1,36.9,42.2" },
  { cle: "gb", iso: 826, nom: "Royaume-Uni", motifs: ["royaume-uni", "royaume uni", "angleterre", "grande-bretagne"], cadrage: "-8.7,1.8,49.9,58.7" },
  { cle: "ie", iso: 372, nom: "Irlande", motifs: ["irlande"] },
  { cle: "be", iso: 56, nom: "Belgique", motifs: ["belgique"] },
  { cle: "ch", iso: 756, nom: "Suisse", motifs: ["suisse"] },
  { cle: "at", iso: 40, nom: "Autriche", motifs: ["autriche"] },
  { cle: "hu", iso: 348, nom: "Hongrie", motifs: ["hongrie"] },
  { cle: "pl", iso: 616, nom: "Pologne", motifs: ["pologne"] },
  { cle: "cz", iso: 203, nom: "Tchéquie", motifs: ["tchéquie", "république tchèque"] },
  { cle: "sk", iso: 703, nom: "Slovaquie", motifs: ["slovaquie"] },
  { cle: "gr", iso: 300, nom: "Grèce", motifs: ["grèce", "grece"] },
  { cle: "us", iso: 840, nom: "États-Unis", motifs: ["états-unis", "etats-unis", "amérique"], cadrage: "-125,-66.5,24.5,49.5" },
  { cle: "ca", iso: 124, nom: "Canada", motifs: ["canada"], cadrage: "-141,-52,41.7,70" },
  { cle: "au", iso: 36, nom: "Australie", motifs: ["australie"], cadrage: "113,154,-39.2,-10.5" },
  { cle: "nz", iso: 554, nom: "Nouvelle-Zélande", motifs: ["nouvelle-zélande", "nouvelle zélande"], cadrage: "166,179,-47.5,-34" },
  { cle: "jp", iso: 392, nom: "Japon", motifs: ["japon"] },
];

export const CLES_PAYS = PAYS_REEL.map((p) => p.cle);

export function paysParCle(cle) {
  return PAYS_REEL.find((p) => p.cle === cle) ?? null;
}

function normaliser(t) {
  return ` ${String(t ?? "")
    .toLowerCase()
    .replace(/\*\*/g, "")
    .replace(/[’']/g, " ")
    .replace(/[^\p{L}\p{N}-]+/gu, " ")} `;
}

// Pays de la liste cités dans un texte (clés, dans l'ordre de la liste).
// « Pays-Bas » n'est pas compté comme « pays » ; « Nouvelle-Zélande » ne
// compte pas « Zélande ».
export function paysCites(texte) {
  const t = normaliser(texte);
  return PAYS_REEL.filter((pays) =>
    pays.motifs.some((motif) => {
      const m = normaliser(motif).trim();
      return t.includes(` ${m} `);
    }),
  ).map((p) => p.cle);
}
