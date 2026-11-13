#!/usr/bin/env python3
"""Dérivés (720p, miniature) et envoi R2 d'un cours rendu. Reprend la logique du workflow video-cours.yml.

Variables : AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY (secrets R2), jamais écrites dans un fichier.
Destination : « test » -> test-victoria/cours/<id>, « prod » -> cours/<id> (prod seulement après accord de Benny).
"""
import json
import os
import pathlib
import subprocess
import sys

ICI = pathlib.Path(__file__).resolve().parent
ENDPOINT = "https://9ae82bfac632f6d0ed7b452940e13abd.r2.cloudflarestorage.com"
BASE_PUBLIQUE = "https://pub-1b81b49f770447bf8dde7a2a284e2c98.r2.dev"


def dossier_r2(destination):
    return "cours" if destination == "prod" else "test-victoria/cours"


def aws(*args, check=True):
    env = dict(os.environ, AWS_DEFAULT_REGION="auto")
    return subprocess.run(["aws", *args, "--endpoint-url", ENDPOINT], env=env, check=check,
                          capture_output=True, text=True)


def deja_publie(cours, destination):
    r = aws("s3api", "head-object", "--bucket", "elearn-videos",
            "--key", f"{dossier_r2(destination)}/{cours}/meta.json", check=False)
    return r.returncode == 0


def encoder_derives(cours):
    sorties = ICI / "sorties" / str(cours)
    for f in sorted(sorties.glob("cours-*-16x9.mp4")):
        base = str(f)[:-len("-16x9.mp4")]
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(f), "-vf", "scale=1280:720", "-c:v", "libx264",
                        "-crf", "27", "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", f"{base}-720p.mp4"], check=True)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", "1", "-i", str(f), "-frames:v", "1", "-q:v", "3",
                        f"{base}-miniature.jpg"], check=True)


def envoyer(cours, destination):
    dossier = dossier_r2(destination)
    base = f"s3://elearn-videos/{dossier}/{cours}"
    script = json.loads((ICI / "scripts" / f"{cours}.json").read_text())
    sorties = ICI / "sorties" / str(cours)
    parties = []
    for f in sorted(sorties.glob("cours-*-16x9.mp4")):
        nom = f.name.replace(f"cours-{cours}-", "").replace("-16x9.mp4", "")
        numero = int(nom.split("-")[-1]) if nom.startswith("partie-") else 1
        duree = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0",
                                      str(f)], capture_output=True, text=True).stdout.strip())
        parties.append({"numero": numero, "duree_s": round(duree, 1)})
        b = str(f)[:-len("-16x9.mp4")]
        aws("s3", "cp", str(f), f"{base}/partie-{numero}-1080.mp4", "--content-type", "video/mp4", "--only-show-errors")
        aws("s3", "cp", f"{b}-720p.mp4", f"{base}/partie-{numero}-720.mp4", "--content-type", "video/mp4", "--only-show-errors")
        aws("s3", "cp", f"{b}-miniature.jpg", f"{base}/partie-{numero}-miniature.jpg", "--content-type", "image/jpeg", "--only-show-errors")
        if numero == 1:
            aws("s3", "cp", f"{b}-miniature.jpg", f"{base}/miniature.jpg", "--content-type", "image/jpeg", "--only-show-errors")
    meta = {"cours": int(cours), "titre": script["titre"], "matiere": script["matiere"], "parties": parties,
            "url_base": f"{BASE_PUBLIQUE}/{dossier}/{cours}"}
    (sorties / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1))
    # meta.json en dernier : sa présence = cours complet (sert à la reprise).
    aws("s3", "cp", str(sorties / "meta.json"), f"{base}/meta.json", "--content-type", "application/json", "--only-show-errors")


if __name__ == "__main__":
    envoyer(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "test")
