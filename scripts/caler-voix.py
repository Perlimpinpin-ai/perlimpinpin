"""Cale le script d'un Reel sur la voix off enregistrée (en local, jamais sur Vercel).

Usage :
  python scripts/caler-voix.py voix-off.mp3 script.txt [dossier-de-sortie]

1. Transcrit la voix off avec l'horodatage de chaque mot (faster-whisper,
   modèle « small », sur le processeur, en local).
2. Aligne cette transcription sur le texte du script, mot à mot.
3. Écrit dans le dossier de sortie (par défaut, celui du script) :
   - minutage.json   début et fin (en secondes) de chaque mot du script, et
                     la liste des écarts ; à déposer sur /test/reels/<id>
                     (mode B, avec le script) ;
   - sous-titres.srt le texte EXACT du script, calé sur la voix ;
   - ecarts.txt      chaque passage où la voix s'écarte du script. La voix fait
                     foi : corrigez le script pour qu'il dise ce qui est dit,
                     puis relancez.

Installation (une fois) :
  python -m pip install faster-whisper
Le premier lancement télécharge le modèle (environ 500 Mo).
"""
import json
import os
import re
import sys
import difflib
import unicodedata


def norm(mot):
    """Mot comparable : minuscules, sans accents ni ponctuation (« l'IA » → « lia »)."""
    m = unicodedata.normalize("NFD", mot.lower().replace("’", "'"))
    m = "".join(c for c in m if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]", "", m)


def lire_script(chemin):
    """Mots du script, dans l'ordre, avec le numéro de paragraphe (scène)."""
    with open(chemin, encoding="utf-8") as f:
        texte = f.read().replace("\r\n", "\n")
    mots = []
    for p, paragraphe in enumerate(re.split(r"\n\s*\n", texte.strip())):
        for mot in paragraphe.split():
            mots.append((mot, p))
    return mots


def transcrire(audio):
    from faster_whisper import WhisperModel

    modele = WhisperModel("small", device="cpu", compute_type="int8")
    segments, _ = modele.transcribe(audio, language="fr", word_timestamps=True, vad_filter=True)
    return [(w.word.strip(), w.start, w.end) for s in segments for w in s.words]


def aligner(script, voix):
    """Temps de chaque mot du script et écarts (script / voix)."""
    a = [norm(m) for m, _ in script]
    b = [norm(m) for m, _, _ in voix]
    temps = [None] * len(script)
    ecarts = []
    sm = difflib.SequenceMatcher(None, a, b, autojunk=False)
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        if op == "equal":
            for k in range(i2 - i1):
                temps[i1 + k] = (voix[j1 + k][1], voix[j1 + k][2])
            continue
        dit = " ".join(m for m, _ in script[i1:i2])
        entendu = " ".join(m for m, _, _ in voix[j1:j2])
        if dit or entendu:
            debut = voix[j1][1] if j2 > j1 else None
            quand = f"[{debut:6.2f} s] " if debut is not None else ""
            ecarts.append(f"{quand}script : « {dit} »  /  voix : « {entendu} »")
        if j2 > j1 and i2 > i1:  # répartit le temps du passage différent
            d0, d1 = voix[j1][1], voix[j2 - 1][2]
            n = i2 - i1
            for k in range(n):
                temps[i1 + k] = (d0 + (d1 - d0) * k / n, d0 + (d1 - d0) * (k + 1) / n)
    # Mots sans temps (ponctuation seule, mot sauté) : entre leurs voisins.
    for i in range(len(temps)):
        if temps[i] is None:
            avant = next((temps[j] for j in range(i - 1, -1, -1) if temps[j]), (0.0, 0.0))
            apres = next((temps[j] for j in range(i + 1, len(temps)) if temps[j]), avant)
            temps[i] = (avant[1], max(avant[1], apres[0]))
    return temps, ecarts


def srt_temps(s):
    ms = int(round(s * 1000))
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"


def lignes_srt(script, temps, maxi=8):
    """Lignes de 8 mots au plus, coupées à la ponctuation, dans chaque paragraphe."""
    blocs, courant = [], []
    for i, (mot, p) in enumerate(script):
        courant.append(i)
        suivant_autre = i + 1 >= len(script) or script[i + 1][1] != p
        if suivant_autre or len(courant) >= maxi or (re.search(r"[.,;:?!…]$", mot) and len(courant) >= 3):
            blocs.append(courant)
            courant = []
    sortie = []
    for n, bloc in enumerate(blocs, 1):
        debut = temps[bloc[0]][0]
        fin = max(temps[bloc[-1]][1], debut + 0.3)
        texte = " ".join(script[i][0] for i in bloc)
        sortie.append(f"{n}\n{srt_temps(debut)} --> {srt_temps(fin)}\n{texte}\n")
    return "\n".join(sortie)


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    audio, chemin_script = sys.argv[1], sys.argv[2]
    sortie = sys.argv[3] if len(sys.argv) > 3 else os.path.dirname(os.path.abspath(chemin_script))
    os.makedirs(sortie, exist_ok=True)
    script = lire_script(chemin_script)
    voix = transcrire(audio)
    temps, ecarts = aligner(script, voix)
    minutage = {
        "source": f"{os.path.basename(audio)} calé sur {os.path.basename(chemin_script)} (faster-whisper small)",
        "mots": [{"mot": m, "debut": round(d, 2), "fin": round(f, 2)} for (m, _), (d, f) in zip(script, temps)],
        "ecarts": ecarts,
    }
    with open(os.path.join(sortie, "minutage.json"), "w", encoding="utf-8") as f:
        json.dump(minutage, f, ensure_ascii=False, indent=2)
    with open(os.path.join(sortie, "sous-titres.srt"), "w", encoding="utf-8") as f:
        f.write(lignes_srt(script, temps))
    with open(os.path.join(sortie, "ecarts.txt"), "w", encoding="utf-8") as f:
        f.write("La voix off fait foi : corriger le script là où elle s'en écarte.\n\n")
        f.write("\n".join(ecarts) if ecarts else "Aucun écart : la voix off suit le script.")
        f.write("\n")
    duree = temps[-1][1] if temps else 0
    print(f"{len(script)} mots, {duree:.1f} s de voix, {len(ecarts)} écart(s) entre script et voix off.")
    print(f"→ {os.path.join(sortie, 'minutage.json')}, sous-titres.srt, ecarts.txt")


if __name__ == "__main__":
    main()
