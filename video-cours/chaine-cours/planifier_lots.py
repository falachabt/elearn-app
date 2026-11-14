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


# Ordre de traitement voulu par Benny (14/11/2026) : matières scientifiques d'abord (formules, nombres, symboles = prononciation difficile).
SCIENCES = ("math", "phys", "chim", "svt", "biolog", "informatique", "concours polytechnique")


def priorite(matiere):
    m = matiere.lower().replace("é", "e").replace("�", "e")
    return 0 if any(m.startswith(k) for k in SCIENCES) else 1


def minutes(chars):
    return chars / 17.65 * 1.23 * 19 / 60


def main(debut=0, fin=None, deja=(), ids=None):
    cours = []
    for f in sorted(glob.glob(os.path.join(ICI, "scripts", "*.json"))):
        s = json.load(open(f, encoding="utf-8"))
        if "phrases" not in s:
            continue
        chars = sum(len(p.get("dit", "")) for p in s["phrases"]) + sum(len(x.get("pont", {}).get("dit", "")) for x in s.get("parties", []))
        cours.append((os.path.basename(f)[:-5], minutes(chars), priorite(s.get("matiere", ""))))
    cours = [c for c in cours if c[0] in ids] if ids else cours[debut:fin]
    cours = [c for c in cours if c[0] not in deja]
    gros = [c[0] for c in sorted((c for c in cours if c[1] > BUDGET_MIN), key=lambda c: c[2])]
    petits = sorted((c for c in cours if c[1] <= BUDGET_MIN), key=lambda c: (c[2], -c[1]))
    lots = []  # first-fit decreasing, sciences d'abord ; un lot ne mélange pas sciences et autres
    for cid, m, prio in petits:
        for lot in lots:
            if lot["prio"] == prio and lot["min"] + m <= BUDGET_MIN:
                lot["cours"].append(cid); lot["min"] += m
                break
        else:
            lots.append({"cours": [cid], "min": m, "prio": prio})
    lots.sort(key=lambda l: l["prio"])
    return {"lots": [{"nom": f"lot-{i + 1}", "cours": ",".join(l["cours"]), "minutes": round(l["min"])} for i, l in enumerate(lots)],
            "gros": gros}


if __name__ == "__main__":
    a = sys.argv[1:]
    if a and not a[0].isdigit() and a[0]:  # liste d'identifiants : « 6056,7236 »
        print(json.dumps(main(ids=set(a[0].split(",")))))
    else:
        print(json.dumps(main(int(a[0] or 0) if a else 0, int(a[1]) if len(a) > 1 and a[1] else None)))
