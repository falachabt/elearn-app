"""Publie sur R2 les mp3 TOEIC produits par des runs « Audio TOEIC » sans envoi.

Pour chaque run : télécharge ses artefacts (`gh run download`), contrôle chaque clip (durée avec ffprobe, partie 2 au
moins 6 s, au plus 300 s), puis envoie sur `toeic/<test>/audio/<ref>.mp3` du bucket elearnprepa-public. Le bucket
`elearnprepa` (sauvegardes, journaux) est refusé dans le code. Un clip invalide n'est pas envoyé et fait échouer le job.
"""
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

BUCKET = "elearnprepa-public"
REF = re.compile(r"^(t[2-7])_p([1-4])_[0-9]+$")


def sh(*cmd, **kw):
    return subprocess.run(cmd, check=True, text=True, capture_output=True, **kw)


def duree(chemin):
    return float(sh("ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(chemin)).stdout)


def cible(chemin):
    m = REF.match(chemin.stem)
    if not m:
        raise ValueError(f"nom de clip inattendu : {chemin.name}")
    return f"toeic/{m.group(1)}/audio/{chemin.stem}.mp3", int(m.group(2))


def main(runs):
    import os

    assert BUCKET == "elearnprepa-public"
    endpoint = os.environ["R2_ENDPOINT"]
    bilan, echecs = [], 0
    with tempfile.TemporaryDirectory() as tmp:
        for run in runs:
            dossier = Path(tmp) / run
            sh("gh", "run", "download", run, "-D", str(dossier))
            for mp3 in sorted(dossier.rglob("*.mp3")):
                try:
                    cle, partie = cible(mp3)
                    d = duree(mp3)
                    if partie == 2 and d < 6:
                        raise ValueError(f"partie 2 trop courte ({d:.1f} s)")
                    if not 1 < d < 300:
                        raise ValueError(f"durée hors limites ({d:.1f} s)")
                    sh("aws", "s3", "cp", str(mp3), f"s3://{BUCKET}/{cle}", "--content-type", "audio/mpeg",
                       "--only-show-errors", "--endpoint-url", endpoint)
                    bilan.append({"clip": mp3.stem, "chemin": cle, "duree": round(d, 1), "statut": "ok"})
                except Exception as e:  # un clip en échec n'arrête pas les autres
                    echecs += 1
                    bilan.append({"clip": mp3.stem, "statut": "echec", "message": str(e)[:300]})
    print(json.dumps(bilan, ensure_ascii=False, indent=1))
    print(f"{len(bilan) - echecs} envoyés, {echecs} en échec")
    if echecs:
        sys.exit(1)


if __name__ == "__main__":
    main(sys.argv[1:])
