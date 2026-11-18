import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  computeAppreciation,
  checkNotationCoherence,
  validateEtape1Structure,
  validateFicheCompleteStructure,
  CRITERE_ETAPE3_KEYS,
  CRITERE_NOTE_MAX,
  CATEGORIES_OBJECTIF,
  validateVersionBasique,
  checkChiffresVersionBasique,
  checkAncragesVersionBasique,
  reparerAncrages,
  separerProblemesAncrages,
  checkLongueursAccueil,
} from "./scoring.js";

// --- Fabriques -----------------------------------------------------------

function makeNotation(overrides = {}) {
  return {
    operationnalite_juridique: 8,
    qualification_juridique: "SOLIDE",
    operationnalite_budgetaire: 8,
    qualification_budgetaire: "SOLIDE",
    operationnalite_moyens_humains: 8,
    qualification_moyens_humains: "SOLIDE",
    operationnalite_moyens_total: 24,
    plafond_applique: false,
    plafond_declencheur: null,
    efficacite: 24,
    qualification_efficacite: "SOLIDE",
    effets_rebonds_externalites: 16,
    qualification_effets_rebonds: "SOLIDE",
    degre_preparation: 8,
    qualification_preparation: "SOLIDE",
    alignement_logique: 8,
    qualification_alignement: "SOLIDE",
    score_total: 80,
    appreciation: "exemplaire",
    ...overrides,
  };
}

function makeMesureVersObjectif(overrides = {}) {
  return {
    objectif_court: "Réduire le déficit du système de retraites.",
    categorie_objectif: "Retraites",
    objectif_vise: "Assurer la pérennité financière du système par répartition.",
    mecanisme_propose: "Report de l'âge légal de départ à la retraite.",
    lien_causal: "direct",
    ...overrides,
  };
}

// Section en accordéon minimale mais valide (voir AccordionSectionSchema).
function makeAccordion(texte, synthese) {
  return { synthese: synthese ?? `${texte} (synthèse).`, texte };
}

// Champs communs à l'étape 1 et à fiche_complete, minimaux mais complets.
function makeChampsCommuns(overrides = {}) {
  return {
    mesure_reformulee: makeAccordion("Une mesure de test."),
    mesure_vers_objectif: makeMesureVersObjectif(),
    nature_et_existant: "Nature de test.",
    contexte_programme: makeAccordion("Contexte programme de test."),
    contexte_national: makeAccordion("Contexte national de test."),
    contexte_international: makeAccordion("Contexte international de test."),
    impact_environnement: null,
    analyse_longevites: makeAccordion("Analyse longévités de test."),
    impact_temporel_et_sectoriel: null,
    ce_qui_est_etabli: makeAccordion("Établi de test."),
    ce_qui_est_probable: makeAccordion("Probable de test."),
    ce_qui_est_discutable: makeAccordion("Discutable de test."),
    ce_qui_est_inconnu: makeAccordion("Inconnu de test."),
    angles_morts: makeAccordion("Angles morts de test."),
    notation_detaillee: makeNotation(),
    verdict_final: "Verdict de test.",
    sources_utilisees: [],
    niveau_de_confiance: "moyen",
    limites: makeAccordion("Limites de test."),
    ...overrides,
  };
}

function makeEtape1({ champs = {}, ...overrides } = {}) {
  return {
    ...makeChampsCommuns(champs),
    analyse_par_criteres: "Texte libre décrivant les cinq critères.",
    resume_court: "Résumé court de test.",
    phrase_teasing: "Phrase teasing de test.",
    ...overrides,
  };
}

function makeCriteresEtape3(overrides = {}) {
  return [
    {
      critere: "operationnalite_moyens",
      titre: "Opérationnalité & Moyens",
      note: 24,
      note_max: 30,
      plafond_applique: false,
      plafond_declencheur: null,
      texte: "Texte.",
      ...(overrides.operationnalite_moyens ?? {}),
    },
    { critere: "efficacite", titre: "Efficacité", note: 24, note_max: 30, texte: "Texte.", ...(overrides.efficacite ?? {}) },
    {
      critere: "effets_rebonds_externalites",
      titre: "Effets rebonds & Externalités",
      note: 16,
      note_max: 20,
      texte: "Texte.",
      ...(overrides.effets_rebonds_externalites ?? {}),
    },
    { critere: "degre_preparation", titre: "Degré de préparation", note: 8, note_max: 10, texte: "Texte.", ...(overrides.degre_preparation ?? {}) },
    { critere: "alignement_logique", titre: "Alignement & Logique globale", note: 8, note_max: 10, texte: "Texte.", ...(overrides.alignement_logique ?? {}) },
  ];
}

function makeFicheComplete({ champs = {}, criteres, ...overrides } = {}) {
  return {
    ...makeChampsCommuns(champs),
    analyse_par_criteres: criteres ?? makeCriteresEtape3(),
    ...overrides,
  };
}

// --- computeAppreciation ----------------------------------------------------

describe("computeAppreciation", () => {
  test("suit le barème 0-19/20-34/.../80-100", () => {
    assert.equal(computeAppreciation(0), "irréaliste");
    assert.equal(computeAppreciation(19), "irréaliste");
    assert.equal(computeAppreciation(20), "fragile");
    assert.equal(computeAppreciation(34), "fragile");
    assert.equal(computeAppreciation(35), "partiellement fondé");
    assert.equal(computeAppreciation(49), "partiellement fondé");
    assert.equal(computeAppreciation(50), "plausible sous condition");
    assert.equal(computeAppreciation(64), "plausible sous condition");
    assert.equal(computeAppreciation(65), "solide et chiffré");
    assert.equal(computeAppreciation(79), "solide et chiffré");
    assert.equal(computeAppreciation(80), "exemplaire");
    assert.equal(computeAppreciation(100), "exemplaire");
  });
});

// --- checkNotationCoherence : avertissement, jamais un rejet ---------------

describe("checkNotationCoherence", () => {
  test("notation cohérente -> aucune erreur", () => {
    const errors = checkNotationCoherence(makeNotation());
    assert.deepEqual(errors, []);
  });

  test("operationnalite_moyens_total incohérent avec les 3 sous-composantes -> erreur signalée", () => {
    const errors = checkNotationCoherence(makeNotation({ operationnalite_moyens_total: 999 }));
    assert.ok(errors.some((e) => e.includes("operationnalite_moyens_total")));
  });

  test("score_total incohérent avec la somme des 5 critères -> erreur signalée", () => {
    const errors = checkNotationCoherence(makeNotation({ score_total: 999 }));
    assert.ok(errors.some((e) => e.includes("score_total")));
  });

  test("RÈGLE DE PLAFOND : une sous-composante FRAGILE (<3/10) plafonne le total à 10/30", () => {
    const notation = makeNotation({
      operationnalite_juridique: 2,
      qualification_juridique: "FRAGILE",
      operationnalite_moyens_total: 10,
      plafond_applique: true,
      plafond_declencheur: "juridique",
      score_total: 66, // 10 + 24 + 16 + 8 + 8
      appreciation: "solide et chiffré",
    });
    const errors = checkNotationCoherence(notation);
    assert.deepEqual(errors, []);
  });

  test("plafond non appliqué alors qu'une sous-composante est FRAGILE -> erreur signalée", () => {
    const notation = makeNotation({
      operationnalite_juridique: 2,
      operationnalite_moyens_total: 18, // 2+8+8, non plafonné à 10
      plafond_applique: false,
      plafond_declencheur: null,
    });
    const errors = checkNotationCoherence(notation);
    assert.ok(errors.some((e) => e.includes("operationnalite_moyens_total") || e.includes("plafond_applique")));
  });

  test("plafond_declencheur pointe la sous-composante la plus basse si plusieurs sont FRAGILE", () => {
    const notation = makeNotation({
      operationnalite_juridique: 2,
      operationnalite_budgetaire: 1,
      operationnalite_moyens_total: 10,
      plafond_applique: true,
      plafond_declencheur: "budgetaire",
      score_total: 66,
      appreciation: "solide et chiffré",
    });
    const errors = checkNotationCoherence(notation);
    assert.deepEqual(errors, []);
  });

  test("plafond_declencheur incorrect (mauvaise sous-composante) -> erreur signalée", () => {
    const notation = makeNotation({
      operationnalite_juridique: 2,
      operationnalite_budgetaire: 1,
      operationnalite_moyens_total: 10,
      plafond_applique: true,
      plafond_declencheur: "juridique", // devrait être "budgetaire" (le plus bas)
      score_total: 66,
    });
    const errors = checkNotationCoherence(notation);
    assert.ok(errors.some((e) => e.includes("plafond_declencheur")));
  });

  test("appreciation incohérente avec score_total -> erreur signalée", () => {
    const errors = checkNotationCoherence(makeNotation({ appreciation: "solide et chiffré" }));
    assert.ok(errors.some((e) => e.includes("appreciation")));
  });

  test("aucune trace de l'ancien système de malus (ajustement_juridique) dans le calcul", () => {
    // score_total ne doit dépendre que des 5 critères, jamais d'un ajustement
    // séparé : une notation sans aucun champ juridique-malus reste cohérente.
    const notation = makeNotation();
    assert.equal("ajustement_juridique" in notation, false);
    assert.deepEqual(checkNotationCoherence(notation), []);
  });
});

// --- validateEtape1Structure -------------------------------------------------

describe("validateEtape1Structure", () => {
  test("accepte une analyse étape 1 minimale mais complète", () => {
    const result = validateEtape1Structure(makeEtape1());
    assert.equal(result.valid, true, result.errors?.join("; "));
  });

  test("rejette un champ obligatoire manquant (verdict_final)", () => {
    const analyse = makeEtape1();
    delete analyse.verdict_final;
    assert.equal(validateEtape1Structure(analyse).valid, false);
  });

  test("rejette mesure_vers_objectif manquant (nouveau bloc obligatoire)", () => {
    const analyse = makeEtape1();
    delete analyse.mesure_vers_objectif;
    assert.equal(validateEtape1Structure(analyse).valid, false);
  });

  test("rejette une categorie_objectif hors de la liste fermée des 12 domaines", () => {
    const analyse = makeEtape1({ champs: { mesure_vers_objectif: makeMesureVersObjectif({ categorie_objectif: "Culture" }) } });
    assert.equal(validateEtape1Structure(analyse).valid, false);
  });

  test("accepte categorie_objectif = null (aucun domaine ne convient)", () => {
    const analyse = makeEtape1({ champs: { mesure_vers_objectif: makeMesureVersObjectif({ categorie_objectif: null }) } });
    assert.equal(validateEtape1Structure(analyse).valid, true);
  });

  test("rejette un lien_causal hors énumération", () => {
    const analyse = makeEtape1({ champs: { mesure_vers_objectif: makeMesureVersObjectif({ lien_causal: "certain" }) } });
    assert.equal(validateEtape1Structure(analyse).valid, false);
  });

  test("rejette analyse_par_criteres si ce n'est pas une chaîne (schéma étape 1)", () => {
    const analyse = makeEtape1({ analyse_par_criteres: ["pas", "une", "chaîne"] });
    assert.equal(validateEtape1Structure(analyse).valid, false);
  });

  test("rejette une note hors bornes (11/10) sur une sous-composante d'Opérationnalité", () => {
    const analyse = makeEtape1({ champs: { notation_detaillee: makeNotation({ operationnalite_juridique: 11 }) } });
    assert.equal(validateEtape1Structure(analyse).valid, false);
  });

  test("rejette une qualification hors énumération SOLIDE/INCERTAIN/FRAGILE", () => {
    const analyse = makeEtape1({ champs: { notation_detaillee: makeNotation({ qualification_juridique: "MOYEN" }) } });
    assert.equal(validateEtape1Structure(analyse).valid, false);
  });

  test("accepte impact_environnement / impact_temporel_et_sectoriel = null (non applicable)", () => {
    const analyse = makeEtape1({
      champs: { impact_environnement: null, impact_temporel_et_sectoriel: null },
    });
    assert.equal(validateEtape1Structure(analyse).valid, true);
  });

  test("accepte impact_environnement en objet {synthese, texte} quand applicable", () => {
    const analyse = makeEtape1({
      champs: { impact_environnement: makeAccordion("Impact environnemental de test.") },
    });
    assert.equal(validateEtape1Structure(analyse).valid, true);
  });

  test("rejette une section en accordéon rendue en simple chaîne (ancien format)", () => {
    const analyse = makeEtape1({ champs: { angles_morts: "Angles morts de test." } });
    assert.equal(validateEtape1Structure(analyse).valid, false);
  });

  test("rejette une section en accordéon sans synthese", () => {
    const analyse = makeEtape1({ champs: { limites: { texte: "Limites de test." } } });
    assert.equal(validateEtape1Structure(analyse).valid, false);
  });

  test("rejette une section en accordéon sans texte", () => {
    const analyse = makeEtape1({ champs: { limites: { synthese: "Synthèse de test." } } });
    assert.equal(validateEtape1Structure(analyse).valid, false);
  });

  test("accepte le champ texte d'une section en accordéon sous forme de tableau de points", () => {
    const analyse = makeEtape1({
      champs: { angles_morts: makeAccordion(["Premier angle mort.", "Second angle mort."]) },
    });
    assert.equal(validateEtape1Structure(analyse).valid, true);
  });

  test("rejette contexte_national en chaîne nue (n'est plus nullable ni texte libre)", () => {
    const analyse = makeEtape1({ champs: { contexte_national: null } });
    assert.equal(validateEtape1Structure(analyse).valid, false);
  });

  test("rejette l'ancien schéma à 4 critères + ajustement_juridique (barème supprimé)", () => {
    const ancienneNotation = {
      factuel: 20,
      efficacite: 20,
      operationnel: 20,
      cout: 20,
      somme_4_criteres: 80,
      ajustement_juridique: 0,
      niveau_impact_juridique: "neutre",
      confiance_juridique: "haute",
      justification_juridique: "Aucun obstacle identifié.",
      score_total: 80,
      appreciation: "solide et chiffré",
    };
    const analyse = makeEtape1({ champs: { notation_detaillee: ancienneNotation } });
    assert.equal(validateEtape1Structure(analyse).valid, false);
  });
});

// --- validateFicheCompleteStructure (étape 3) -------------------------------

describe("validateFicheCompleteStructure", () => {
  test("accepte une fiche complète minimale mais complète (5 critères du nouveau barème)", () => {
    const result = validateFicheCompleteStructure(makeFicheComplete());
    assert.equal(result.valid, true, result.errors?.join("; "));
  });

  test("rejette moins ou plus de 5 objets dans analyse_par_criteres", () => {
    const fiche = makeFicheComplete({ criteres: makeCriteresEtape3().slice(0, 4) });
    assert.equal(validateFicheCompleteStructure(fiche).valid, false);
  });

  test("rejette un critère dupliqué", () => {
    const criteres = makeCriteresEtape3();
    criteres[4] = { ...criteres[0] };
    const fiche = makeFicheComplete({ criteres });
    assert.equal(validateFicheCompleteStructure(fiche).valid, false);
  });

  test("rejette un critère hors de l'ancien schéma (ex: 'juridique' seul, plus une clé valide)", () => {
    const criteres = makeCriteresEtape3().slice(0, 4);
    criteres.push({ critere: "juridique", titre: "Faisabilité juridique", note: null, note_max: null, texte: "x" });
    const fiche = makeFicheComplete({ criteres });
    assert.equal(validateFicheCompleteStructure(fiche).valid, false);
  });

  test("note_max différent par critère (30/30/20/10/10) est accepté", () => {
    const result = validateFicheCompleteStructure(makeFicheComplete());
    assert.equal(result.valid, true, result.errors?.join("; "));
    const maxParCritere = Object.fromEntries(
      result.fiche.analyse_par_criteres.map((c) => [c.critere, c.note_max]),
    );
    assert.deepEqual(maxParCritere, CRITERE_NOTE_MAX);
  });

  test("rejette un note_max incohérent avec le critère (ex: 25 au lieu de 30 pour efficacite)", () => {
    const criteres = makeCriteresEtape3({ efficacite: { note_max: 25 } });
    const fiche = makeFicheComplete({ criteres });
    assert.equal(validateFicheCompleteStructure(fiche).valid, false);
  });

  test("rejette une note supérieure à note_max", () => {
    const criteres = makeCriteresEtape3({ degre_preparation: { note: 11 } });
    const fiche = makeFicheComplete({ criteres });
    assert.equal(validateFicheCompleteStructure(fiche).valid, false);
  });

  test("accepte plafond_applique/plafond_declencheur sur l'objet operationnalite_moyens", () => {
    const criteres = makeCriteresEtape3({
      operationnalite_moyens: { note: 10, plafond_applique: true, plafond_declencheur: "juridique" },
    });
    const result = validateFicheCompleteStructure(makeFicheComplete({ criteres }));
    assert.equal(result.valid, true, result.errors?.join("; "));
  });

  test("n'exige pas resume_court/phrase_teasing (absents de fiche_complete)", () => {
    const fiche = makeFicheComplete();
    assert.equal("resume_court" in fiche, false);
    assert.equal(validateFicheCompleteStructure(fiche).valid, true);
  });
});

// --- Constantes exposées -----------------------------------------------------

describe("CRITERE_ETAPE3_KEYS / CRITERE_NOTE_MAX", () => {
  test("chaque critère du barème a un note_max défini", () => {
    for (const key of CRITERE_ETAPE3_KEYS) {
      assert.ok(CRITERE_NOTE_MAX[key], `pas de note_max pour ${key}`);
    }
  });

  test("le total des note_max fait bien 100 (30+30+20+10+10)", () => {
    const total = Object.values(CRITERE_NOTE_MAX).reduce((sum, max) => sum + max, 0);
    assert.equal(total, 100);
  });
});

describe("CATEGORIES_OBJECTIF", () => {
  test("contient exactement les 13 domaines de data/objectifs-de-reference.md", () => {
    assert.equal(CATEGORIES_OBJECTIF.length, 13);
  });
});

// --- Version basique (étape 3 bis) ----------------------------------------

function makeVersionBasique(overrides = {}) {
  return {
    resume: "Le candidat propose un compte social unique.",
    contexte: "Fin 2021, environ 560 000 foyers ne demandaient pas le RSA.",
    analyse: "Entre 33 % et 37 % des foyers éligibles ne le demandaient pas.",
    points_forts: ["Simplifie les démarches", "S'appuie sur des outils existants"],
    points_faibles: ["Le coût n'est pas chiffré", "Le calendrier reste flou"],
    faisabilite: "Il faut changer la loi.",
    sources_principales: [2, 3, 4],
    ...overrides,
  };
}

const SOURCES = ["programme", "presse", "DREES", "Cour des comptes", "CNAF"];

const FICHE_FINALE = {
  contexte_national: {
    synthese: "Non-recours au RSA.",
    texte: "Fin 2021, entre 33 % et 37 % des foyers éligibles, soit environ 560 000 foyers.",
  },
  sources_utilisees: SOURCES,
};

describe("validateVersionBasique", () => {
  test("accepte une version basique valide", () => {
    const result = validateVersionBasique(makeVersionBasique(), SOURCES);
    assert.equal(result.valid, true, result.errors.join("\n"));
    assert.deepEqual(result.versionBasique.sources_principales, [2, 3, 4]);
  });

  test("refuse un index de source hors limites", () => {
    const result = validateVersionBasique(makeVersionBasique({ sources_principales: [0, 1, 5] }), SOURCES);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((error) => error.includes("index 5 hors limites")), result.errors.join("\n"));
  });

  test("refuse des index en double ou un nombre de sources différent de 3", () => {
    assert.equal(validateVersionBasique(makeVersionBasique({ sources_principales: [2, 2, 3] }), SOURCES).valid, false);
    assert.equal(validateVersionBasique(makeVersionBasique({ sources_principales: [2, 3] }), SOURCES).valid, false);
  });

  test("refuse moins de 2 points forts ou un champ texte vide", () => {
    assert.equal(validateVersionBasique(makeVersionBasique({ points_forts: ["Un seul"] }), SOURCES).valid, false);
    assert.equal(validateVersionBasique(makeVersionBasique({ resume: "" }), SOURCES).valid, false);
  });
});

describe("checkChiffresVersionBasique", () => {
  test("ne signale rien quand tous les nombres viennent de la fiche (espace insécable compris)", () => {
    assert.deepEqual(checkChiffresVersionBasique(makeVersionBasique(), FICHE_FINALE), []);
  });

  test("détecte un nombre inventé", () => {
    const vb = makeVersionBasique({ faisabilite: "Cela coûterait 227 millions d'euros." });
    assert.deepEqual(checkChiffresVersionBasique(vb, FICHE_FINALE), ["227"]);
  });

  test("ne trouve pas un nombre à l'intérieur d'un autre (200 dans 2000)", () => {
    const fiche = { texte: "Un budget de 2000 euros." };
    const vb = makeVersionBasique({ resume: "Un budget de 200 euros.", contexte: "x", analyse: "x" });
    assert.deepEqual(checkChiffresVersionBasique(vb, fiche), ["200"]);
  });
});

describe("checkAncragesVersionBasique", () => {
  const fiche = {
    ce_qui_est_etabli: {
      synthese: "Le non-recours est massif.",
      texte: "Le **non-recours** au RSA concerne l'un des\nminima sociaux les plus étudiés.",
    },
    sources_utilisees: SOURCES,
  };

  function ancragesPoints(vb, extrait) {
    return [...vb.points_forts, ...vb.points_faibles].map((texte) => ({ texte, extrait }));
  }

  test("trouve un extrait malgré les ** et une apostrophe typographique", () => {
    const vb = makeVersionBasique();
    const ancrages = ancragesPoints(vb, "Le non-recours au RSA concerne l’un des minima sociaux");
    assert.deepEqual(checkAncragesVersionBasique(ancrages, vb, fiche), []);
  });

  test("détecte un extrait inventé", () => {
    const vb = makeVersionBasique();
    const ancrages = ancragesPoints(vb, "Le non-recours au RSA concerne l'un des minima sociaux");
    ancrages[0] = { texte: vb.points_forts[0], extrait: "Le compte réduirait le non-recours de moitié." };
    const errors = checkAncragesVersionBasique(ancrages, vb, fiche);
    assert.equal(errors.length, 1);
    assert.ok(errors[0].includes("ne figure pas mot pour mot"), errors[0]);
  });

  test("détecte un point sans ancrage", () => {
    const vb = makeVersionBasique();
    const ancrages = ancragesPoints(vb, "Le non-recours au RSA concerne l'un des minima sociaux").slice(1);
    const errors = checkAncragesVersionBasique(ancrages, vb, fiche);
    assert.equal(errors.length, 1);
    assert.ok(errors[0].includes(vb.points_forts[0]), errors[0]);
  });

  test("refuse un tableau vide ou un ancrage mal formé", () => {
    const vb = makeVersionBasique();
    assert.ok(checkAncragesVersionBasique([], vb, fiche).length > 0);
    assert.ok(checkAncragesVersionBasique([{ texte: "x" }], vb, fiche).some((e) => e.startsWith("ancrages.0")));
  });
});

describe("checkLongueursAccueil (avertissement non bloquant)", () => {
  test("aucun avertissement dans les limites (35 / 200 caractères)", () => {
    assert.deepEqual(
      checkLongueursAccueil({ titre_fiche: "a".repeat(35), teaser_accueil: "b".repeat(200) }),
      [],
    );
  });

  test("signale chaque champ trop long avec sa longueur réelle", () => {
    const avertissements = checkLongueursAccueil({
      titre_fiche: "Des robots pour remplacer les travailleurs immigrés",
      teaser_accueil: "c".repeat(201),
    });
    assert.equal(avertissements.length, 2);
    assert.match(avertissements[0], /titre_fiche trop long : 51 caractères \(maximum 35\)/);
    assert.match(avertissements[1], /teaser_accueil trop long : 201 caractères \(maximum 200\)/);
  });

  test("champs absents ou non textuels : rien à signaler", () => {
    assert.deepEqual(checkLongueursAccueil({}), []);
    assert.deepEqual(checkLongueursAccueil(), []);
    assert.deepEqual(checkLongueursAccueil({ titre_fiche: null, teaser_accueil: 42 }), []);
  });
});

describe("reparerAncrages", () => {
  const fiche = {
    contexte_national: { texte: "Depuis 2017, **l'accord d'entreprise prime déjà sur la branche dans la plupart des domaines**, et la durée du travail est organisée en trois étages." },
    resume_court: "Le Code du travail compte 11 487 articles au 1er janvier 2025.",
  };
  const vb = { points_forts: [], points_faibles: [] };

  test("corrige un extrait à un mot près (cas Attal, 19/10/2026)", () => {
    const { ancrages, reparations } = reparerAncrages(
      [{ texte: "x", extrait: "Depuis 2017, l'accord d'entreprise prime sur la branche dans la plupart des domaines" }],
      fiche,
    );
    assert.equal(reparations.length, 1);
    assert.equal(reparations[0].ecart, 1);
    assert.deepEqual(checkAncragesVersionBasique(ancrages, vb, fiche), []);
  });

  test("laisse intact un extrait déjà exact", () => {
    const ancrages = [{ texte: "x", extrait: "Le Code du travail compte 11 487 articles" }];
    const r = reparerAncrages(ancrages, fiche);
    assert.deepEqual(r.reparations, []);
    assert.deepEqual(r.ancrages, ancrages);
  });

  test("ne corrige pas un extrait trop éloigné de la fiche", () => {
    const ancrages = [{ texte: "x", extrait: "Le Code du travail compte 12 000 articles et reste illisible pour tout le monde" }];
    const r = reparerAncrages(ancrages, fiche);
    assert.deepEqual(r.reparations, []);
    assert.ok(checkAncragesVersionBasique(r.ancrages, vb, fiche).length > 0);
  });

  test("ne corrige pas un extrait trop court", () => {
    const r = reparerAncrages([{ texte: "x", extrait: "la durée du travail change" }], fiche);
    assert.deepEqual(r.reparations, []);
  });
});

describe("separerProblemesAncrages (contrôle souple, 24/10/2026)", () => {
  test("un extrait reformulé et un point sans ancrage identique ne bloquent pas", () => {
    const fiche = { analyse: "Le gain annoncé sur les agences est près de vingt fois supérieur à ce que le Sénat juge possible." };
    const vb = { resume: "r", points_forts: ["Un point reformulé"], points_faibles: [] };
    const ancrages = [{ texte: "Un autre texte", extrait: "le gain sur les agences dépasse largement ce que le Sénat juge atteignable" }];
    const { bloquants, avertissements } = separerProblemesAncrages(checkAncragesVersionBasique(ancrages, vb, fiche));
    assert.deepEqual(bloquants, []);
    assert.equal(avertissements.length, 2);
  });

  test("des ancrages absents ou mal formés restent bloquants", () => {
    const fiche = { analyse: "texte" };
    const vb = { resume: "r", points_forts: [], points_faibles: [] };
    assert.ok(separerProblemesAncrages(checkAncragesVersionBasique([], vb, fiche)).bloquants.length > 0);
    assert.ok(separerProblemesAncrages(checkAncragesVersionBasique([{ texte: "x" }], vb, fiche)).bloquants.some((e) => e.startsWith("ancrages.0")));
  });
});
