"""Prépare les photos des candidats déposées à la main (carrousels et Reels).

À lancer en local, jamais sur Vercel :

    py -3.12 -m venv .venv-photos
    .venv-photos\\Scripts\\python -m pip install pillow pillow-avif-plugin numpy rembg onnxruntime opencv-python-headless
    .venv-photos\\Scripts\\python scripts/preparer-photos-candidats.py              # tous les candidats
    .venv-photos\\Scripts\\python scripts/preparer-photos-candidats.py teddy-riner  # un candidat
    ... --forcer   refait aussi les photos déjà traitées (ou écartées)
    ... --mesurer  mesure seulement le cadrage des photos déjà préparées (cadrage.json)

Entrée : photos-sources/<dossier>/ (hors de public/, jamais commité, voir
.gitignore), JPG, WEBP, AVIF ou PNG, noms quelconques. <dossier> est le slug
du candidat (src/lib/carte.js) ou un des anciens noms de DOSSIERS ci-dessous.
Les originaux ne sont JAMAIS modifiés.

Pour chaque photo :
 1. lecture, orientation EXIF corrigée ;
 2. tri automatique (raison dans le rapport) : silhouette détourée de moins
    de 600 px de haut, plusieurs personnes ou plusieurs silhouettes, gros plan
    coupé au-dessus des épaules, doublon (hash perceptuel) ;
 3. détourage (rembg, u2net_human_seg), bords nettoyés, recadrage tête et
    buste, tête dans le tiers haut ;
 4. noir et blanc contrasté (réglage global, AUCUNE retouche du visage) ; le
    grain est ajouté au rendu, pas ici ;
 5. sorties dans public/carrousel/candidats/<slug>/<n>/ (n : numéro stable,
    tiré du hash de l'original) : detoure.png, detoure-liseré-blanc.png,
    detoure-liseré-jaune.png, medaillon.png, reel-trame.png, et cadrage.json
    (tête mesurée sur le détouré : la couverture normalise chaque silhouette,
    même taille de tête, même position) ;
 6. fiche de la photo dans src/lib/photos-candidats.js (entre les repères
    DEBUT/FIN PHOTOS DEPOSEES) : ecarter et credit gardent les valeurs déjà
    saisies sur /test/photos-candidats (onglet « Photos déposées »). Toute
    photo préparée entre dans le tirage, sauf celles marquées « Écarter ».

Rapport (gardées, écartées et raisons) : affiché, et écrit dans
data/photos-candidats/rapport/<slug>.json (local). Relancé, le script ne
traite que les photos qu'il n'a jamais vues (hash absent du rapport).
"""

import argparse
import datetime
import hashlib
import io
import json
import re
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
SOURCES = RACINE / "photos-sources"
SORTIE = RACINE / "public" / "carrousel" / "candidats"
RAPPORTS = RACINE / "data" / "photos-candidats" / "rapport"
FICHE = RACINE / "src" / "lib" / "photos-candidats.js"

# Anciens noms de dossiers → slug du candidat (src/lib/carte.js, slugCandidat).
DOSSIERS = {
    "attal": "gabriel-attal",
    "de-villepin": "dominique-de-villepin",
    "glucksmann": "raphael-glucksmann",
    "le-pen": "marine-le-pen",
    "lisnard": "david-lisnard",
    "melenchon": "jean-luc-melenchon",
    "philippe": "edouard-philippe",
    "retailleau": "bruno-retailleau",
    "rinner": "teddy-riner",
    "roussel": "fabien-roussel",
    "tondelier": "marine-tondelier",
    "zemmour": "eric-zemmour",
}
SLUGS = sorted(set(DOSSIERS.values()))
EXTENSIONS = {".jpg", ".jpeg", ".webp", ".avif", ".png"}

HAUTEUR_MIN = 600  # hauteur minimale de la silhouette détourée dans l'original (px)
HAUTEUR_SORTIE = 1100  # hauteur des détourés (px)
JAUNE = (0xFF, 0xD2, 0x3F)
CHARBON = (0x17, 0x13, 0x0F)
CREME = (0xF2, 0xE8, 0xD5)
# Liseré : environ 11 px pour 1080 px de large, la silhouette occupant environ
# 45 % de la largeur de la slide (486 px) : 11 px à l'affichage.
LISERE_AFFICHE = 11
LARGEUR_AFFICHEE = 0.45 * 1080
# Hauteur de la tête (haut du crâne → bas de la boîte du visage) sur la
# couverture « une mesure » : même valeur que TETE_COUVERTURE de
# src/lib/mise-en-page-carrousel.js.
TETE_COUVERTURE = 300
DOUBLON_MAX = 6  # distance de Hamming maximale entre deux hash perceptuels (64 bits)


def lire_image(chemin: Path):
    from PIL import Image, ImageOps

    try:
        from PIL import AvifImagePlugin, _avif

        # Pillow ≥ 12 : décodeur AVIF intégré ; « auto » peut manquer alors que dav1d est là.
        if not _avif.decoder_codec_available(AvifImagePlugin.DECODE_CODEC_CHOICE) and _avif.decoder_codec_available("dav1d"):
            AvifImagePlugin.DECODE_CODEC_CHOICE = "dav1d"
    except ImportError:
        try:
            import pillow_avif  # noqa: F401  (Pillow plus ancien : le module externe)
        except ImportError:
            pass
    image = Image.open(chemin)
    image = ImageOps.exif_transpose(image)
    if image.mode in ("RGBA", "LA", "P"):
        fond = Image.new("RGB", image.size, (255, 255, 255))
        rgba = image.convert("RGBA")
        fond.paste(rgba, mask=rgba.getchannel("A"))
        return fond
    return image.convert("RGB")


def hash_perceptuel(image) -> int:
    """dHash 64 bits (gradient horizontal sur 9 × 8 en niveaux de gris)."""
    from PIL import Image

    petite = image.convert("L").resize((9, 8), Image.LANCZOS)
    p = list(petite.get_flattened_data()) if hasattr(petite, "get_flattened_data") else list(petite.getdata())
    bits = 0
    for y in range(8):
        for x in range(8):
            bits = (bits << 1) | (1 if p[y * 9 + x] > p[y * 9 + x + 1] else 0)
    return bits


def distance(a: int, b: int) -> int:
    return bin(a ^ b).count("1")


def visages(image_rgb, masque):
    """Visages (x, y, l, h) détectés par OpenCV (face, puis profil), gardés
    seulement s'ils sont sur la silhouette détourée, du plus grand au plus petit."""
    import cv2
    import numpy as np

    gris = cv2.cvtColor(np.array(image_rgb), cv2.COLOR_RGB2GRAY)
    gris = cv2.equalizeHist(gris)
    cote = min(gris.shape)
    trouves = []
    for nom in ("haarcascade_frontalface_default.xml", "haarcascade_profileface.xml"):
        cascade = cv2.CascadeClassifier(cv2.data.haarcascades + nom)
        for (x, y, l, h) in cascade.detectMultiScale(gris, scaleFactor=1.08, minNeighbors=7, minSize=(max(24, cote // 20),) * 2):
            cx, cy = x + l // 2, y + h // 2
            if masque[min(cy, masque.shape[0] - 1), min(cx, masque.shape[1] - 1)] < 128:
                continue
            # pas deux fois le même visage (face + profil)
            if any(abs(cx - (a + c // 2)) < max(l, c) // 2 and abs(cy - (b + d // 2)) < max(h, d) // 2 for (a, b, c, d) in trouves):
                continue
            trouves.append((int(x), int(y), int(l), int(h)))
        if trouves and nom.startswith("haarcascade_frontal"):
            break
    return sorted(trouves, key=lambda v: -v[2] * v[3])


def composantes(masque):
    """Surfaces des silhouettes (composantes connexes du masque), décroissantes."""
    import cv2

    binaire = (masque >= 128).astype("uint8")
    n, _, stats, _ = cv2.connectedComponentsWithStats(binaire, connectivity=8)
    return sorted((int(stats[i, cv2.CC_STAT_AREA]) for i in range(1, n)), reverse=True)


def nettoyer_masque(masque):
    """Garde la plus grande silhouette, bouche les trous, adoucit le bord (1 px)."""
    import cv2
    import numpy as np

    binaire = (masque >= 128).astype("uint8")
    n, etiquettes, stats, _ = cv2.connectedComponentsWithStats(binaire, connectivity=8)
    if n > 1:
        grande = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
        garde = (etiquettes == grande).astype("uint8")
    else:
        garde = binaire
    # trous intérieurs (entre le bras et le corps, ils restent : seuls les petits trous sont bouchés)
    contours, hierarchie = cv2.findContours(garde, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    if hierarchie is not None:
        surface = garde.sum()
        for i, c in enumerate(contours):
            if hierarchie[0][i][3] >= 0 and cv2.contourArea(c) < 0.002 * surface:
                cv2.drawContours(garde, [c], -1, 1, -1)
    # bord : le masque doux de rembg, limité à la silhouette gardée (légèrement érodée), sans halo
    dilate = cv2.dilate(garde, np.ones((3, 3), np.uint8), iterations=1)
    doux = np.where(dilate > 0, masque, 0).astype("float32")
    doux = np.where(garde > 0, np.maximum(doux, 0), doux)
    doux = cv2.GaussianBlur(doux, (3, 3), 0)
    return np.clip(doux, 0, 255).astype("uint8")


def noir_et_blanc(image_rgb):
    """Noir et blanc contrasté, réglage GLOBAL (niveaux et courbe) : aucune
    retouche locale, le visage n'est jamais retouché."""
    from PIL import ImageOps

    gris = ImageOps.grayscale(image_rgb)
    gris = ImageOps.autocontrast(gris, cutoff=(1, 1))
    return gris.point(lambda v: max(0, min(255, round((v - 128) * 1.22 + 128))))


def avec_lisere(rgba, couleur, epaisseur):
    """Silhouette posée sur sa propre forme épaissie (dilatation du masque) dans
    la couleur du liseré ; marge transparente autour, sauf en bas (buste coupé)."""
    import cv2
    import numpy as np
    from PIL import Image

    e = max(2, int(round(epaisseur)))
    l, h = rgba.size
    toile = Image.new("RGBA", (l + 2 * e, h + e), (0, 0, 0, 0))
    toile.paste(rgba, (e, e))
    alpha = np.array(toile.getchannel("A"))
    noyau = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * e + 1, 2 * e + 1))
    epais = cv2.dilate(alpha, noyau)
    epais = cv2.GaussianBlur(epais, (3, 3), 0)
    lisere = Image.new("RGBA", toile.size, couleur + (0,))
    lisere.putalpha(Image.fromarray(epais))
    return Image.alpha_composite(lisere, toile)


def trame(image_rgb, boite, largeur=720, hauteur=900, pixels=72):
    """Photo rectangulaire 4:5 tramée en gros pixels (Bayer 4 × 4), deux tons
    de la charte : charbon et crème."""
    import numpy as np
    from PIL import Image

    x0, y0, x1, y1 = boite
    morceau = noir_et_blanc(image_rgb.crop((x0, y0, x1, y1)))
    colonnes = pixels
    lignes = round(pixels * hauteur / largeur)
    petit = np.array(morceau.resize((colonnes, lignes), Image.LANCZOS), dtype="float32") / 255.0
    petit = np.clip((petit - 0.5) * 1.35 + 0.5, 0, 1)  # trame plus franche
    bayer = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]], dtype="float32") / 16.0 + 1 / 32
    seuil = np.tile(bayer, (lignes // 4 + 1, colonnes // 4 + 1))[:lignes, :colonnes]
    clair = petit > seuil
    sortie = np.zeros((lignes, colonnes, 3), dtype="uint8")
    sortie[clair] = CREME
    sortie[~clair] = CHARBON
    return Image.fromarray(sortie).resize((largeur, hauteur), Image.NEAREST)


def boite_4_5(cx, haut, largeur_voulue, l_img, h_img):
    """Rectangle 4:5 de largeur `largeur_voulue` centré en x, commençant à `haut`,
    ramené dans l'image."""
    l = min(largeur_voulue, l_img, h_img * 4 / 5)
    h = l * 5 / 4
    x0 = min(max(0, cx - l / 2), l_img - l)
    y0 = min(max(0, haut), h_img - h)
    return tuple(int(round(v)) for v in (x0, y0, x0 + l, y0 + h))


def traiter(image, session, cible: Path):
    """Détoure et produit les 5 fichiers. Renvoie (None, infos) si la photo est
    gardée, (raison, infos) si elle est écartée."""
    import numpy as np
    from PIL import Image
    from rembg import remove

    l_img, h_img = image.size
    masque_brut = np.array(remove(image, session=session, only_mask=True))
    surfaces = composantes(masque_brut)
    if not surfaces:
        return "aucune silhouette trouvée par le détourage", {}
    if len(surfaces) > 1 and surfaces[1] >= 0.15 * surfaces[0]:
        return f"plusieurs silhouettes après détourage ({sum(1 for s in surfaces if s >= 0.15 * surfaces[0])})", {}
    masque = nettoyer_masque(masque_brut)
    lignes = np.where(masque.max(axis=1) >= 128)[0]
    colonnes = np.where(masque.max(axis=0) >= 128)[0]
    haut, bas = int(lignes[0]), int(lignes[-1])
    gauche, droite = int(colonnes[0]), int(colonnes[-1])
    hauteur_silhouette = bas - haut + 1
    if hauteur_silhouette < HAUTEUR_MIN:
        return f"candidat trop petit : silhouette de {hauteur_silhouette} px de haut ({HAUTEUR_MIN} au moins)", {"hauteur": hauteur_silhouette}

    trouves = visages(image, masque_brut)
    # Un visage retenu doit être sous le haut du crâne (centre des colonnes de
    # la silhouette sur ses premières lignes) : écarte une oreille ou un motif
    # pris pour un visage. Sinon, tête estimée par la silhouette.
    sommet = np.where((masque[haut : haut + max(2, hauteur_silhouette // 20)] >= 128).any(axis=0))[0]
    crane_x = (sommet[0] + sommet[-1]) / 2 if len(sommet) else (gauche + droite) / 2
    trouves = [v for v in trouves if abs(v[0] + v[2] / 2 - crane_x) <= 0.5 * v[2] and v[1] <= haut + 1.2 * v[3]] or []
    if trouves:
        grand = trouves[0]
        autres = [v for v in trouves[1:] if v[2] >= 0.45 * grand[2]]
        if autres:
            return f"plusieurs personnes détectées ({1 + len(autres)} visages)", {}
        fx, fy, fl, fh = grand
    else:
        # visage non détecté (profil marqué, lunettes) : tête estimée par le haut de la silhouette
        largeurs = (masque[haut : haut + max(1, hauteur_silhouette // 6)] >= 128).sum(axis=1)
        fl = int(np.median(largeurs[len(largeurs) // 2 :])) if len(largeurs) else (droite - gauche) // 3
        fh = int(fl * 1.25)
        cols = np.where(masque[haut + fh // 2] >= 128)[0]
        fx = int((cols[0] + cols[-1]) / 2 - fl / 2) if len(cols) else (gauche + droite) // 2 - fl // 2
        fy = haut + int(0.15 * fh)
    centre_x = fx + fl / 2
    centre_y = fy + fh / 2

    # Gros plan : sous le menton, la silhouette doit descendre d'au moins
    # 0,6 visage et s'y élargir (épaules : 1,25 fois la boîte du visage
    # d'OpenCV, qui comprend déjà les oreilles et le front).
    menton = fy + fh
    sous_menton = bas - menton
    largeur_epaules = int((masque[min(bas, menton) : bas + 1] >= 128).sum(axis=1).max()) if sous_menton > 0 else 0
    if sous_menton < 0.6 * fh or largeur_epaules < 1.25 * fl:
        return "silhouette coupée au-dessus des épaules (gros plan du visage)", {"sousMenton": round(sous_menton / fh, 2), "epaules": round(largeur_epaules / fl, 2)}

    # Recadrage tête et buste : haut du crâne (haut de la silhouette, ou
    # 0,9 visage au-dessus de la boîte), centre du visage au tiers haut (28 %).
    haut_cadre = max(0, haut - 4, int(fy - 0.9 * fh))
    hauteur_cadre = int((centre_y - haut_cadre) / 0.28)
    bas_cadre = min(bas + 1, haut_cadre + hauteur_cadre)
    bande = masque[haut_cadre:bas_cadre] >= 128
    cols = np.where(bande.max(axis=0))[0]
    g_cadre, d_cadre = int(cols[0]), int(cols[-1]) + 1
    infos = {
        "visage": bool(trouves),
        "hauteurSilhouette": hauteur_silhouette,
        "cadre": [g_cadre, haut_cadre, d_cadre, bas_cadre],
    }

    gris = noir_et_blanc(image)
    rgba = Image.merge("RGBA", (gris, gris, gris, Image.fromarray(masque)))
    buste = rgba.crop((g_cadre, haut_cadre, d_cadre, bas_cadre))
    echelle = HAUTEUR_SORTIE / buste.height
    buste = buste.resize((max(1, round(buste.width * echelle)), HAUTEUR_SORTIE), Image.LANCZOS)
    cible.mkdir(parents=True, exist_ok=True)
    buste.save(cible / "detoure.png", "PNG", optimize=True)
    epaisseur = LISERE_AFFICHE * buste.width / LARGEUR_AFFICHEE
    avec_lisere(buste, (255, 255, 255), epaisseur).save(cible / "detoure-liseré-blanc.png", "PNG", optimize=True)
    avec_lisere(buste, JAUNE, epaisseur).save(cible / "detoure-liseré-jaune.png", "PNG", optimize=True)

    # Médaillon : carré centré sur le visage (un peu plus bas, pour le cou), fond transparent.
    cote = 2.0 * fh
    mx0, my0 = centre_x - cote / 2, centre_y - cote / 2 + 0.18 * fh
    medaillon = Image.new("RGBA", (int(cote), int(cote)), (0, 0, 0, 0))
    medaillon.paste(rgba.crop(tuple(int(round(v)) for v in (mx0, my0, mx0 + cote, my0 + cote))), (0, 0))
    medaillon.resize((600, 600), Image.LANCZOS).save(cible / "medaillon.png", "PNG", optimize=True)

    # Reel : photo rectangulaire (fond compris) tramée, cadrée comme le buste.
    largeur_reel = max(d_cadre - g_cadre, 3.2 * fl)
    boite = boite_4_5(centre_x, centre_y - 0.28 * largeur_reel * 5 / 4, largeur_reel, l_img, h_img)
    trame(image, boite).save(cible / "reel-trame.png", "PNG", optimize=True)
    infos["cadrage"] = mesurer_cadrage(cible)
    return None, infos


def mesurer_cadrage(dossier: Path):
    """Tête de la silhouette dans detoure-liseré-blanc.png, écrite dans
    cadrage.json : { largeur, hauteur, sommet (haut du crâne), visage
    { x, y, l, h } (boîte OpenCV, sinon estimée par la silhouette), detecte,
    autresVisages, gauche, droite (étendue de la silhouette) }. La couverture
    du carrousel pose chaque photo à la même taille de tête
    (src/lib/mise-en-page-carrousel.js, placementCandidat)."""
    import numpy as np
    from PIL import Image

    detoure = Image.open(dossier / "detoure.png").convert("RGBA")
    masque = np.array(detoure.getchannel("A"))
    lignes = np.where(masque.max(axis=1) >= 128)[0]
    colonnes = np.where(masque.max(axis=0) >= 128)[0]
    haut = int(lignes[0])
    gauche, droite = int(colonnes[0]), int(colonnes[-1])
    hauteur = int(lignes[-1]) - haut + 1
    gris = detoure.getchannel("R")
    fond = Image.new("RGB", detoure.size, (128, 128, 128))
    fond.paste(Image.merge("RGB", (gris, gris, gris)), mask=detoure.getchannel("A"))
    tous = visages(fond, masque)
    # même filtre qu'au détourage : un visage sous le haut du crâne
    sommet = np.where((masque[haut : haut + max(2, hauteur // 20)] >= 128).any(axis=0))[0]
    crane_x = (sommet[0] + sommet[-1]) / 2 if len(sommet) else (gauche + droite) / 2
    trouves = [v for v in tous if abs(v[0] + v[2] / 2 - crane_x) <= 0.5 * v[2] and v[1] <= haut + 1.2 * v[3]]
    autres = [v for v in tous if trouves and v != trouves[0] and v[2] >= 0.45 * trouves[0][2]]
    if trouves:
        fx, fy, fl, fh = trouves[0]
    else:
        largeurs = (masque[haut : haut + max(1, hauteur // 6)] >= 128).sum(axis=1)
        fl = int(np.median(largeurs[len(largeurs) // 2 :])) if len(largeurs) else (droite - gauche) // 3
        fh = int(fl * 1.0)
        cols = np.where(masque[haut + fh // 2] >= 128)[0]
        fx = int((cols[0] + cols[-1]) / 2 - fl / 2) if len(cols) else (gauche + droite) // 2 - fl // 2
        fy = haut + int(0.3 * fh)
    # Liseré blanc refait à l'échelle où la couverture affichera la photo
    # (tête de TETE_COUVERTURE px, du crâne au bas du visage) : même liseré
    # fin sur toutes les couvertures, quel que soit le cadrage d'origine.
    tete = max(1, fy + fh - haut)
    e = max(2, int(round(LISERE_AFFICHE * tete / TETE_COUVERTURE)))
    lisere = avec_lisere(detoure, (255, 255, 255), e)
    lisere.save(dossier / "detoure-liseré-blanc.png", "PNG", optimize=True)
    ex = ey = e
    cadrage = {
        "largeur": lisere.width,
        "hauteur": lisere.height,
        "sommet": round(haut + ey),
        "visage": {"x": round(fx + ex), "y": round(fy + ey), "l": int(fl), "h": int(fh)},
        "detecte": bool(trouves),
        "autresVisages": len(autres),
        # épaule gauche coupée à la verticale par le cadre de la photo d'origine
        # (portrait serré) : la silhouette touche le bord gauche sur plus de
        # 15 % de sa hauteur ; ce bord se voit sur la couverture (le droit
        # sort de la slide)
        "coteCoupe": bool((masque[:, :2] >= 128).any(axis=1).mean() > 0.15),
        "gauche": round(gauche + ex),
        "droite": round(droite + ex),
    }
    (dossier / "cadrage.json").write_text(json.dumps(cadrage, ensure_ascii=False) + "\n", encoding="utf-8")
    return cadrage


def mesurer_tout(slugs):
    """--mesurer : cadrage.json de chaque photo déjà préparée."""
    for slug in slugs:
        for dossier in sorted(p for p in (SORTIE / slug).glob("*") if p.is_dir() and p.name.isdigit()):
            c = mesurer_cadrage(dossier)
            v = c["visage"]
            alerte = "" if c["detecte"] else "  (visage non détecté : tête estimée)"
            if c["autresVisages"]:
                alerte += f"  ⚠ {c['autresVisages']} autre(s) visage(s)"
            if c["coteCoupe"]:
                alerte += "  ⚠ épaule gauche coupée à la verticale (portrait serré)"
            print(f"{slug} {dossier.name} : sommet {c['sommet']}, visage {v['l']}×{v['h']} en ({v['x']}, {v['y']}), image {c['largeur']}×{c['hauteur']}{alerte}")


# --- Fiche src/lib/photos-candidats.js ----------------------------------------------------

DEBUT = "// DEBUT PHOTOS DEPOSEES"
FIN = "// FIN PHOTOS DEPOSEES"


def lire_fiche():
    texte = FICHE.read_text(encoding="utf-8")
    debut, fin = texte.index(DEBUT), texte.index(FIN)
    bloc = texte[debut + len(DEBUT) : fin]
    m = re.search(r"=\s*(\[.*\]);", bloc, re.S)
    return texte, json.loads(m.group(1)) if m else []


def ecrire_fiche(texte, entrees):
    entrees = sorted(entrees, key=lambda e: (e["slug"], e["n"]))
    corps = json.dumps(entrees, ensure_ascii=False, indent=2)
    debut, fin = texte.index(DEBUT), texte.index(FIN)
    nouveau = texte[: debut + len(DEBUT)] + f"\nexport const PHOTOS_DEPOSEES = {corps};\n" + texte[fin:]
    FICHE.write_text(nouveau, encoding="utf-8")


def numero(empreinte: str) -> int:
    """Numéro stable (6 chiffres) tiré du hash SHA-256 de l'original."""
    return int(empreinte[:12], 16) % 900000 + 100000


def main() -> int:
    parser = argparse.ArgumentParser(description="Préparation des photos déposées des candidats.")
    parser.add_argument("slugs", nargs="*", metavar="SLUG", help="candidats à traiter (aucun : tous)")
    parser.add_argument("--forcer", action="store_true", help="retraiter aussi les photos déjà vues")
    parser.add_argument("--mesurer", action="store_true", help="mesurer seulement le cadrage des photos déjà préparées (cadrage.json)")
    args = parser.parse_args()
    if args.mesurer:
        mesurer_tout(args.slugs or sorted(p.name for p in SORTIE.iterdir() if p.is_dir()))
        return 0

    try:
        from rembg import new_session
    except ImportError:
        print("Il manque des modules : pip install pillow pillow-avif-plugin numpy rembg onnxruntime opencv-python-headless", file=sys.stderr)
        return 1

    if not SOURCES.exists():
        print(f"Dossier absent : {SOURCES}", file=sys.stderr)
        return 1
    dossiers = {}
    for d in sorted(p for p in SOURCES.iterdir() if p.is_dir()):
        slug = d.name if d.name in SLUGS else DOSSIERS.get(d.name)
        if not slug:
            print(f"⚠ dossier inconnu, ignoré : photos-sources/{d.name}")
            continue
        dossiers.setdefault(slug, []).append(d)
    inconnus = [s for s in args.slugs if s not in SLUGS]
    if inconnus:
        print(f"Slug(s) inconnu(s) : {', '.join(inconnus)}. Slugs : {', '.join(SLUGS)}", file=sys.stderr)
        return 1
    voulus = args.slugs or sorted(dossiers)

    texte, entrees = lire_fiche()
    session = new_session("u2net_human_seg")
    RAPPORTS.mkdir(parents=True, exist_ok=True)
    maintenant = datetime.date.today().isoformat()

    for slug in voulus:
        chemin_rapport = RAPPORTS / f"{slug}.json"
        rapport = json.loads(chemin_rapport.read_text(encoding="utf-8")) if chemin_rapport.exists() and not args.forcer else {"slug": slug, "photos": {}}
        vues = rapport["photos"]
        fichiers = [f for d in dossiers.get(slug, []) for f in sorted(d.iterdir()) if f.suffix.lower() in EXTENSIONS]
        print(f"\n=== {slug} : {len(fichiers)} photo(s) déposée(s) ===")
        # Lecture et hash de toutes les photos (les plus grandes d'abord : un doublon garde la meilleure).
        lues = []
        for f in fichiers:
            octets = f.read_bytes()
            empreinte = hashlib.sha256(octets).hexdigest()
            try:
                image = lire_image(f)
            except Exception as erreur:
                vues[empreinte] = {"fichier": f.name, "statut": "écartée", "raison": f"illisible ({erreur})"}
                continue
            lues.append((f, empreinte, image, hash_perceptuel(image)))
        lues.sort(key=lambda t: -(t[2].width * t[2].height))
        hashes_gardes = [(int(v["phash"], 16), v["fichier"]) for v in vues.values() if v.get("statut") == "gardée" and v.get("phash")]
        for f, empreinte, image, phash in lues:
            deja = vues.get(empreinte)
            if deja and not args.forcer:
                continue
            n = numero(empreinte)
            jumeau = next((nom for h, nom in hashes_gardes if distance(h, phash) <= DOUBLON_MAX and nom != f.name), None)
            if jumeau:
                vues[empreinte] = {"fichier": f.name, "statut": "écartée", "raison": f"doublon de {jumeau}", "phash": f"{phash:016x}"}
                continue
            try:
                raison, infos = traiter(image, session, SORTIE / slug / str(n))
            except Exception as erreur:  # une photo en échec n'arrête pas les autres
                raison, infos = f"erreur de traitement ({erreur})", {}
            if raison:
                # écartée (au besoin après un retraitement) : ni fichiers préparés, ni fiche
                ancien = SORTIE / slug / str(n)
                if ancien.is_dir():
                    for fichier in ancien.iterdir():
                        fichier.unlink()
                    ancien.rmdir()
                entrees = [e for e in entrees if not (e["slug"] == slug and e["n"] == n)]
                vues[empreinte] = {"fichier": f.name, "statut": "écartée", "raison": raison, "phash": f"{phash:016x}", "taille": [image.width, image.height]}
                continue
            vues[empreinte] = {"fichier": f.name, "statut": "gardée", "n": n, "phash": f"{phash:016x}", "taille": [image.width, image.height], **infos}
            hashes_gardes.append((phash, f.name))
            ancienne = next((e for e in entrees if e["slug"] == slug and e["n"] == n), None)
            entree = {
                "slug": slug,
                "n": n,
                "origine": f.name,
                "prepareLe": maintenant,
                "source": ancienne["source"] if ancienne else "à compléter",
                "credit": ancienne["credit"] if ancienne else "à compléter",
                "ecarter": ancienne.get("ecarter", False) if ancienne else False,
                **({"raison": ancienne["raison"]} if ancienne and ancienne.get("raison") else {}),
            }
            entrees = [e for e in entrees if not (e["slug"] == slug and e["n"] == n)] + [entree]

        chemin_rapport.write_text(json.dumps(rapport, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        gardees = [v for v in vues.values() if v["statut"] == "gardée"]
        ecartees = [v for v in vues.values() if v["statut"] != "gardée"]
        print(f"  {len(gardees)} préparée(s), {len(ecartees)} écartée(s)")
        for v in sorted(gardees, key=lambda v: v["fichier"]):
            print(f"  ✓ {v['fichier']} → n° {v['n']}{'' if v.get('visage', True) else ' (visage non détecté : tête estimée)'}")
        for v in sorted(ecartees, key=lambda v: v["fichier"]):
            print(f"  ✗ {v['fichier']} : {v['raison']}")

    ecrire_fiche(texte, entrees)
    print(f"\nFiche mise à jour : {FICHE.relative_to(RACINE)}. À valider sur /test/photos-candidats (onglet « Photos déposées »).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
