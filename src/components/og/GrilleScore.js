// Grille de 100 carrés (10 × 10) dont les N premiers sont allumés, N étant
// le score arrondi. Pour les images next/og (flexbox seulement) : carrousel
// Instagram, réutilisable ailleurs. Même principe que la scène 8 des Reels
// (src/app/test/reels/[id]/image/scenes.js), qui garde sa propre version animée.
// `couleur` : couleur du palier (appreciationCarte, src/lib/carte.js).
export default function GrilleScore({ score, couleur, eteinte = "rgba(27,31,74,0.10)", taille = 54, ecart = 8 }) {
  const allumees = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));
  return (
    <div style={{ display: "flex", flexWrap: "wrap", width: taille * 10 + ecart * 9, gap: ecart }}>
      {Array.from({ length: 100 }, (_, i) => (
        <div
          key={i}
          style={{ width: taille, height: taille, borderRadius: Math.round(taille / 9), backgroundColor: i < allumees ? couleur : eteinte }}
        />
      ))}
    </div>
  );
}
