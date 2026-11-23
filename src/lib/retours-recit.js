// Liste des remarques faites sur les carrousels détaillés, toutes fiches
// confondues (page /test/reseaux/retours), pour repérer celles qui reviennent
// et corriger data/prompt-recit.md. Fonctions PURES, testées par scripts/recit.test.js.

// Normalisation pour regrouper les remarques proches : minuscules, sans
// accents, chiffres de slide et ponctuation retirés.
export function cleRemarque(remarque) {
  return String(remarque ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\bslides?\s*\d+\b/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// `lignes` : [{ propositionId, titre, candidat, statut, retours: [...] }].
// Renvoie les remarques (sans les retours arrière), de la plus récente à la
// plus ancienne : [{ date, remarque, cible, slide, resultat, details, propositionId, titre, candidat }].
export function listeRetours(lignes) {
  return (lignes ?? [])
    .flatMap(({ propositionId, titre, candidat, statut, retours }) =>
      (Array.isArray(retours) ? retours : [])
        .filter((r) => r?.remarque)
        .map((r) => ({ ...r, propositionId, titre, candidat, statut })),
    )
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

// Libellé de la cible d'une remarque.
export function libelleCible(retour) {
  if (retour.slide) return `Slide ${retour.slide.numero} · ${retour.slide.libelle}`;
  return retour.cible === "tweet" ? "Tweet long" : retour.cible === "legende" ? "Légende" : "Toutes les slides";
}

// Remarques qui reviennent : regroupées par cible (libellé de slide, sans
// numéro) et par texte normalisé, celles vues au moins `seuil` fois.
export function remarquesFrequentes(retours, seuil = 2) {
  const groupes = new Map();
  for (const r of retours) {
    const cible = r.slide?.libelle ?? (r.cible === "tweet" ? "Tweet long" : r.cible === "legende" ? "Légende" : "Toutes les slides");
    const cle = `${cible}|${cleRemarque(r.remarque)}`;
    const groupe = groupes.get(cle) ?? { cible, remarque: r.remarque, nombre: 0, fiches: new Set() };
    groupe.nombre += 1;
    groupe.fiches.add(r.propositionId);
    groupes.set(cle, groupe);
  }
  return [...groupes.values()]
    .filter((g) => g.nombre >= seuil)
    .sort((a, b) => b.nombre - a.nombre)
    .map((g) => ({ ...g, fiches: [...g.fiches] }));
}
