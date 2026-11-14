"""Envoie sur R2 les 24 photos de la Partie 1 des tests 4 à 7 (toeic-audio/images-p1/tN_p1-K.jpg).

Cible : toeic/<test>/img/p1-K.jpg du bucket elearnprepa-public. Le bucket `elearnprepa` est refusé dans le code. Une image
manquante, trop petite ou mal nommée fait échouer le job avant tout envoi.
"""
import os
import re
import subprocess
import sys
from pathlib import Path

BUCKET = "elearnprepa-public"
NOM = re.compile(r"^(t[4-7])_p1-([1-6])\.jpg$")


def main():
    assert BUCKET == "elearnprepa-public"
    endpoint = os.environ["R2_ENDPOINT"]
    dossier = Path(__file__).parent / "images-p1"
    fichiers = sorted(dossier.glob("*.jpg"))
    if len(fichiers) != 24:
        sys.exit(f"24 images attendues, {len(fichiers)} trouvées")
    for f in fichiers:
        m = NOM.match(f.name)
        if not m or f.stat().st_size < 20_000:
            sys.exit(f"image invalide : {f.name}")
    for f in fichiers:
        m = NOM.match(f.name)
        cle = f"toeic/{m.group(1)}/img/p1-{m.group(2)}.jpg"
        subprocess.run(["aws", "s3", "cp", str(f), f"s3://{BUCKET}/{cle}", "--content-type", "image/jpeg",
                        "--only-show-errors", "--endpoint-url", endpoint], check=True)
        print("ok", cle)
    print(f"{len(fichiers)} images envoyées")


if __name__ == "__main__":
    main()
