// Check-list « Vérifications avant publication » (page 20 de la charte RS,
// docs/charte-rs.md), commune aux trois formats de carrousel. Chaque point :
//   auto : true / false (coché ou non par le code, non modifiable),
//          null (à cocher à la main),
//          "couleur" (vérifié dans le navigateur d'après les derniers posts).
// `controles` : ce que l'assemblage du carrousel a vérifié ; `format` :
// "mesure", "programme" ou "thematique". Fonction PURE.
export function listeVerifications({ controles = {}, debordements = [], format = "mesure" }) {
  const ok = (cle) => controles[cle] === true;
  const groupe = format !== "mesure";
  return [
    { cle: "chiffres", libelle: "Chaque chiffre vient de l’analyse ou d’une source citée.", auto: ok("chiffresSources") },
    { cle: "sousNotes", libelle: "La somme des sous-notes égale la note.", auto: ok("sommeSousNotes") },
    { cle: "note", libelle: "La note n’est pas en couverture.", auto: ok("noteHorsCouverture") },
    { cle: "constat", libelle: "Le constat vient avant la proposition ; le texte parle de sa proposition.", auto: ok("constatAvantProposition") },
    { cle: "titres", libelle: "Chaque titre apporte une information ; la couverture n’a que le nom de famille.", auto: ok("titresInformatifs") && ok("nomFamilleCouverture") },
    { cle: "lecture", libelle: "Le texte se comprend en une lecture, sans jargon.", auto: null },
    { cle: "debordement", libelle: "Aucun texte ne déborde, aucun titre mal coupé, nombres insécables.", auto: debordements.length === 0 && ok("insecables") },
    { cle: "couleur", libelle: "La couleur est celle du registre ; le grain est visible sur tous les fonds.", auto: ok("couleurRegistre") && ok("grain") ? "couleur" : false },
    { cle: "credits", libelle: "Photos créditées sur la slide de fin, dans la légende et dans credits.txt.", auto: ok("creditsPresents"), alerte: controles.creditPhotoACompleter ? "Crédit photo à compléter" : null },
    { cle: "photo", libelle: "Photo conforme : fournie par l’équipe, en N&B, liseré conforme au format.", auto: null },
    { cle: "traitement", libelle: "Même traitement que pour les autres candidats.", auto: null },
    ...(groupe ? [{ cle: "notes", libelle: "Notes réelles, moyenne exacte, ordre alphabétique.", auto: ok("notesReelles") && (format === "programme" ? ok("moyenneExacte") : ok("ordreAlphabetique")) }] : []),
    { cle: "restes", libelle: "Aucun reste de maquette (badges « exemple », « Candidat A », « [crédits à compléter] »).", auto: ok("sansResteMaquette") },
    { cle: "fin", libelle: "La fin présente l’IA Perlimpinpin, invite à corriger l’analyse sur le site et à rejoindre l’association.", auto: ok("finConforme") },
  ];
}
