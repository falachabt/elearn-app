#!/usr/bin/env python3
"""Lance un par un (workflow « Vidéo de cours », voix sur 4 machines) les cours trop longs pour un lot.

Usage : python lancer_gros.py [--destination test|prod] [--max-en-cours 4]
Reprise : un cours déjà publié (meta.json sur R2) est sauté. Boucle jusqu'à épuisement ; Ctrl+C pour arrêter.
Les lots (petits cours) se lancent à part : gh workflow run video-cours.yml -f cours=LOT:0:868 -f etapes=<16|vide>."""
import argparse
import json
import subprocess
import time
import urllib.request

import planifier_lots

BASE = "https://pub-1b81b49f770447bf8dde7a2a284e2c98.r2.dev"
REF = "claude/project-thread-kw792g"


def gh(*a):
    return subprocess.run(["gh", *a], capture_output=True, text=True)


def publie(cours, dossier):
    try:
        urllib.request.urlopen(f"{BASE}/{dossier}/{cours}/meta.json", timeout=20)
        return True
    except Exception:
        return False


def en_cours():
    total = 0
    for statut in ("in_progress", "queued"):
        r = gh("run", "list", "--workflow", "video-cours.yml", "--status", statut, "--json", "databaseId", "--limit", "100")
        total += len(json.loads(r.stdout or "[]"))
    return total


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--destination", default="test", choices=["test", "prod"])
    ap.add_argument("--max-en-cours", type=int, default=4)
    a = ap.parse_args()
    dossier = "cours" if a.destination == "prod" else "test-victoria/cours"
    for cours in planifier_lots.main()["gros"]:
        if publie(cours, dossier):
            continue
        while en_cours() >= a.max_en_cours:
            time.sleep(120)
        r = gh("workflow", "run", "video-cours.yml", "--ref", REF, "-f", f"cours={cours}", "-f", f"destination={a.destination}")
        print(cours, "lancé" if r.returncode == 0 else r.stderr.strip(), flush=True)
        time.sleep(20)


if __name__ == "__main__":
    main()
