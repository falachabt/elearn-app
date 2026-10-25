#!/usr/bin/env python3
"""Reconstruit index.json du bucket elearn-videos depuis les meta.json présents.

Pensé pour tourner en CI (job « index » du workflow video-cours.yml, dispatch
avec l'entrée INDEX) après des rendus parallèles : aucun rendu ne touche plus
index.json, donc plus de course entre envois simultanés. L'index est une vue
dérivée du bucket : on lit chaque cours/<id>/meta.json et on réécrit l'index
complet, au format historique {<id>: {dossier, titre, matiere, parties}}.

Variables d'environnement : AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY,
R2_ENDPOINT (défaut : endpoint du compte Cloudflare du projet).
"""
import json
import os
import pathlib
import re
import subprocess
import sys
import tempfile

BUCKET = "elearn-videos"
ENDPOINT = os.environ.get(
    "R2_ENDPOINT",
    "https://9ae82bfac632f6d0ed7b452940e13abd.r2.cloudflarestorage.com")


def aws(*args, capture=True):
    cmd = ["aws", "s3", *args, "--endpoint-url", ENDPOINT, "--only-show-errors"]
    r = subprocess.run(cmd, capture_output=capture, text=True)
    if r.returncode != 0:
        raise RuntimeError(f"aws s3 {' '.join(args)} : {r.stderr.strip()}")
    return r.stdout


def main():
    listing = aws("ls", f"s3://{BUCKET}/cours/", "--recursive")
    ids = sorted({m.group(1) for m in
                  (re.search(r"cours/(\d+)/meta\.json$", ligne.strip())
                   for ligne in listing.splitlines()) if m}, key=int)
    print(f"{len(ids)} cours avec meta.json : {ids}")
    index = {}
    for cid in ids:
        brut = aws("cp", f"s3://{BUCKET}/cours/{cid}/meta.json", "-")
        meta = json.loads(brut)
        index[cid] = {"dossier": f"cours/{cid}", "titre": meta["titre"],
                      "matiere": meta["matiere"],
                      "parties": [p["numero"] for p in meta["parties"]]}
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False,
                                     encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, indent=1, sort_keys=True)
        chemin = f.name
    aws("cp", chemin, f"s3://{BUCKET}/index.json",
        "--content-type", "application/json", capture=False)
    print(f"index.json reconstruit : {len(index)} cours.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
