"""Détoure les photos Wikimedia Commons des candidats (couverture du carrousel
détaillé, fenêtre du candidat des Reels).

À lancer en local (jamais sur Vercel), après
`node scripts/chercher-photos-candidats.js <slug> --telecharger` :

    pip install pillow rembg onnxruntime
    python scripts/detourer-candidats.py --photos teddy-riner   # un candidat
    python scripts/detourer-candidats.py --photos               # tous
    python scripts/detourer-candidats.py --photos --forcer      # refaire celles déjà faites

Chaque photo data/photos-candidats/originaux/<slug>/<n>.jpg est détourée
(rembg), passée en noir et blanc, recadrée au plus près de la silhouette et
enregistrée avec sa transparence dans public/carrousel/candidats/<slug>/<n>.png.
Le PNG sort fini : noir et blanc, grain et liseré blanc y sont déjà (même
traitement que scripts/lib/traitement-images.js) ; le rendu ne fait que le poser. Les crédits (auteur, licence, lien, « photo
modifiée : détourage, noir et blanc ») sont dans src/lib/photos-candidats.js.

Au premier lancement, rembg télécharge son modèle de détourage (environ
170 Mo). Vérifiez chaque résultat à l'œil : cheveux, épaules et col entiers,
aucune autre personne restée dans l'image.
"""

import argparse
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
ORIGINAUX = RACINE / "data" / "photos-candidats" / "originaux"
SORTIE = RACINE / "public" / "carrousel" / "candidats"


HAUTEUR = 900  # hauteur du portrait final (px), comme scripts/lib/traitement-images.js
LISERE = 12  # épaisseur du liseré blanc (px)
GRAIN = 0.47  # force du grain (0 à 1)
CONTRASTE = 1.3


def detourer(source: Path, cible: Path, session) -> None:
    """Détoure, puis applique le traitement final du candidat, comme
    finirCandidat (scripts/lib/traitement-images.js) : noir et blanc contrasté,
    grain, liseré blanc qui suit la silhouette, recadré au plus près. Le rendu
    (next/og) n'a plus qu'à poser le PNG."""
    import random

    from PIL import Image, ImageFilter, ImageOps
    from rembg import remove

    image = ImageOps.exif_transpose(Image.open(source)).convert("RGB")
    detouree = remove(image, session=session)  # RVBA, fond transparent
    boite = detouree.getchannel("A").getbbox()
    if boite:
        detouree = detouree.crop(boite)
    largeur = round(detouree.width * HAUTEUR / detouree.height)
    detouree = detouree.resize((largeur, HAUTEUR), Image.LANCZOS)
    # Marge transparente pour le liseré (pas en bas : le portrait est coupé par le bas de la slide).
    toile = Image.new("RGBA", (largeur + 2 * LISERE, HAUTEUR + LISERE), (0, 0, 0, 0))
    toile.paste(detouree, (LISERE, LISERE))
    alpha = toile.getchannel("A")

    # Noir et blanc contrasté.
    gris = ImageOps.grayscale(toile.convert("RGB"))
    gris = gris.point(lambda v: max(0, min(255, round((v - 128) * CONTRASTE + 128))))
    # Grain : grains clairs et foncés, tirage stable.
    alea = random.Random(11)
    bruit = Image.new("L", gris.size)
    bruit.putdata([alea.choice((20, 255)) for _ in range(gris.width * gris.height)])
    force = Image.new("L", gris.size)
    force.putdata([round((alea.random() ** 2) * GRAIN * 255) for _ in range(gris.width * gris.height)])
    gris = Image.composite(bruit, gris, force)

    # Liseré : la silhouette épaissie, en blanc, sous le portrait.
    epais = alpha.filter(ImageFilter.MaxFilter(2 * (LISERE // 2) + 1)).filter(ImageFilter.MaxFilter(2 * (LISERE // 2) + 1))
    blanc = Image.new("RGBA", toile.size, (255, 255, 255, 0))
    blanc.putalpha(epais)
    portrait = Image.merge("RGBA", (gris, gris, gris, alpha))
    resultat = Image.alpha_composite(blanc, portrait)
    cible.parent.mkdir(parents=True, exist_ok=True)
    resultat.save(cible, "PNG", optimize=True)


def main() -> int:
    parser = argparse.ArgumentParser(description="Détourage des photos Commons des candidats.")
    parser.add_argument("--photos", nargs="*", metavar="SLUG", required=True, help="slugs à traiter (aucun : tous ceux qui ont des originaux)")
    parser.add_argument("--forcer", action="store_true", help="refaire les photos déjà détourées")
    args = parser.parse_args()

    try:
        from rembg import new_session
    except ImportError:
        print("Il manque des modules : pip install pillow rembg onnxruntime", file=sys.stderr)
        return 1

    dossiers = sorted(d for d in ORIGINAUX.iterdir() if d.is_dir()) if ORIGINAUX.exists() else []
    if args.photos:
        dossiers = [d for d in dossiers if d.name in args.photos]
    if not dossiers:
        print("Aucune photo téléchargée : node scripts/chercher-photos-candidats.js <slug> --telecharger")
        return 1

    session = new_session("u2net_human_seg")
    faites = 0
    for dossier in dossiers:
        for source in sorted(dossier.glob("*.jpg"), key=lambda p: int(p.stem) if p.stem.isdigit() else 0):
            cible = SORTIE / dossier.name / f"{source.stem}.png"
            if cible.exists() and not args.forcer:
                print(f"· {dossier.name}/{source.stem} : déjà détourée (--forcer pour refaire)")
                continue
            try:
                detourer(source, cible, session)
            except Exception as erreur:  # une photo en échec n'arrête pas les autres
                print(f"✗ {dossier.name}/{source.stem} : {erreur}", file=sys.stderr)
                continue
            faites += 1
            print(f"✓ {dossier.name}/{source.stem} → {cible.relative_to(RACINE)}")
    print(f"\n{faites} photo(s) détourée(s). Vérifiez-les à l'œil avant de publier.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
