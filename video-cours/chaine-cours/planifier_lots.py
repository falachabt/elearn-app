#!/usr/bin/env python3
"""Répartit les cours en lots de ~5 h de calcul voix pour un job GitHub Actions (limite 6 h).

Coût mesuré le 13/11/2026 (cours 6932) : ~19 s de machine par seconde de vidéo ; durée vidéo ≈ 1,23 × caractères / 17,65.
Sortie : JSON {"lots":[{"nom","cours":"id,id"}], "gros":[ids]} sur stdout. Les « gros » (> budget) passent par
le workflow par cours (voix en 4 parties parallèles)."""
import glob
import json
import os
import sys

ICI = os.path.dirname(os.path.abspath(__file__))
BUDGET_MIN = float(os.environ.get("BUDGET_MIN", "330"))


def minutes(chars):
    return chars / 17.65 * 1.23 * 19 / 60


def main(debut=0, fin=None, deja=()):
    cours = []
    for f in sorted(glob.glob(os.path.join(ICI, "scripts", "*.json"))):
        s = json.load(open(f, encoding="utf-8"))
        if "phrases" not in s:
            continue
        chars = sum(len(p.get("dit", "")) for p in s["phrases"]) + sum(len(x.get("pont", {}).get("dit", "")) for x in s.get("parties", []))
        cours.append((os.path.basename(f)[:-5], minutes(chars)))
    cours = cours[debut:fin]
    cours = [c for c in cours if c[0] not in deja]
    gros = [c[0] for c in cours if c[1] > BUDGET_MIN]
    petits = sorted((c for c in cours if c[1] <= BUDGET_MIN), key=lambda c: -c[1])
    lots = []  # first-fit decreasing
    for cid, m in petits:
        for lot in lots:
            if lot["min"] + m <= BUDGET_MIN:
                lot["cours"].append(cid); lot["min"] += m
                break
        else:
            lots.append({"cours": [cid], "min": m})
    return {"lots": [{"nom": f"lot-{i + 1}", "cours": ",".join(l["cours"]), "minutes": round(l["min"])} for i, l in enumerate(lots)],
            "gros": gros}


if __name__ == "__main__":
    a = sys.argv[1:]
    print(json.dumps(main(int(a[0]) if a else 0, int(a[1]) if len(a) > 1 else None)))
