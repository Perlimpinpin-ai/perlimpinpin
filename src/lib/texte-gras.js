// Balisage simple des mots en gras dans les textes du carrousel détaillé :
// **mot** ou **groupe de mots**. Écrit par le modèle, rendu par le code
// (src/app/api/carrousel/[id]/slides.js). Fonctions PURES.

export const GRAS_MAX_PAR_SLIDE = 3;

// Morceaux d'un texte : [{ texte, gras }]. Un ** sans fermeture est ignoré
// (texte gardé, sans gras). Au-delà de `max` passages en gras, les suivants
// sont rendus en texte normal.
export function morceauxGras(texte, max = Infinity) {
  const source = String(texte ?? "");
  const morceaux = [];
  let reste = source;
  let gras = 0;
  while (reste.length) {
    const debut = reste.indexOf("**");
    const fin = debut >= 0 ? reste.indexOf("**", debut + 2) : -1;
    if (debut < 0 || fin < 0) {
      morceaux.push({ texte: reste.replace(/\*\*/g, ""), gras: false });
      break;
    }
    if (debut > 0) morceaux.push({ texte: reste.slice(0, debut), gras: false });
    const dedans = reste.slice(debut + 2, fin);
    if (dedans.trim()) {
      morceaux.push({ texte: dedans, gras: gras < max });
      gras += 1;
    }
    reste = reste.slice(fin + 2);
  }
  return morceaux.filter((m) => m.texte);
}

// Texte sans le balisage.
export function sansGras(texte) {
  return morceauxGras(texte).map((m) => m.texte).join("");
}

// Nombre de passages en gras.
export function nombreGras(texte) {
  return morceauxGras(texte).filter((m) => m.gras).length;
}

// Balisage déséquilibré (nombre impair de **).
export function grasDesequilibre(texte) {
  return (String(texte ?? "").match(/\*\*/g)?.length ?? 0) % 2 === 1;
}

// Mots d'un texte avec leur graisse, pour un rendu mot à mot (Satori :
// chaque mot est un bloc flex qui passe à la ligne). Un mot peut mêler les
// deux graisses (« **600 Md€**. ») : [[{ texte, gras }, …], …].
export function motsGras(texte, max = GRAS_MAX_PAR_SLIDE) {
  const mots = [];
  let colle = false; // le morceau précédent finit au milieu d'un mot
  for (const { texte: t, gras } of morceauxGras(texte, max)) {
    const jetons = t.split(/([ \t\n]+)/);
    jetons.forEach((jeton, i) => {
      if (!jeton) return;
      if (/^[ \t\n]+$/.test(jeton)) {
        colle = false;
        return;
      }
      if (i === 0 && colle && mots.length) mots.at(-1).push({ texte: jeton, gras });
      else mots.push([{ texte: jeton, gras }]);
      colle = true;
    });
  }
  return mots;
}

// Mots en gras au plus sur une slide (tous ses textes ensemble).
export const MOTS_GRAS_MAX_PAR_SLIDE = 3;

// Nombre de mots en gras d'un texte.
export function nombreMotsGras(texte) {
  return morceauxGras(texte)
    .filter((m) => m.gras)
    .reduce((total, m) => total + m.texte.split(/\s+/).filter(Boolean).length, 0);
}

// Textes d'une slide (dans l'ordre de lecture) avec 3 mots en gras au plus
// en tout : les passages en gras sont gardés dans l'ordre tant qu'ils tiennent
// dans le quota ; un passage qui le dépasserait passe en texte normal (on ne
// coupe jamais un passage). Renvoie les textes réécrits (balisage ** conservé
// pour les passages gardés).
export function limiterMotsGras(textes, max = MOTS_GRAS_MAX_PAR_SLIDE) {
  let reste = max;
  return textes.map((texte) => {
    if (texte === null || texte === undefined) return texte;
    return morceauxGras(texte)
      .map(({ texte: t, gras }) => {
        if (!gras) return t;
        const mots = t.split(/\s+/).filter(Boolean).length;
        if (mots <= reste) {
          reste -= mots;
          return `**${t}**`;
        }
        reste = 0;
        return t;
      })
      .join("");
  });
}
