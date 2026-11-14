#!/usr/bin/env python3
"""Exporte les fichiers de jobs audio TOEIC depuis le builder de contenu (dépôt elearn-supabase).

Usage : python exporter_jobs.py <chemin elearn-supabase> [--sortie jobs]

Le script importe build_contenu.py (supabase/seed/toeic/) et appelle les mêmes fonctions que le builder
(new_test_questions puis build_transcripts, avec le même mélange déterministe des options), pour que
l'ordre lu soit exactement l'ordre affiché. Aucune lecture ni écriture en base.

Sorties dans jobs/ :
  t4.json ... t7.json  : groupes d'écoute (parties 1 à 4) des tests toeic_04 à toeic_07
  p2_t2_t3.json        : les 50 groupes de partie 2 des tests 2 et 3 (clips trop courts à régénérer),
                         avec les deux textes corrigés en production (migration 20261022180000).
Chaque entrée : {ref, part, chemin, lignes: [[locuteur, texte], ...]}.
"""
import argparse
import importlib.util
import json
import sys
from pathlib import Path

ICI = Path(__file__).resolve().parent

# (code du test, préfixe de références, fichier source d'écoute)
TESTS = {
    "toeic_02": ("t2", "tests/test_02_listening.json"),
    "toeic_03": ("t3", "tests/test_03_listening.json"),
    "toeic_04": ("t4", "tests/test_04_listening.json"),
    "toeic_05": ("t5", "tests/test_05_listening.json"),
    "toeic_06": ("t6", "tests/test_06_listening.json"),
    "toeic_07": ("t7", "tests/test_07_listening.json"),
}

# Textes corrigés en production après coup (migration 20261022180000_cert_part2_textes_corriges.sql).
# {ref de groupe: (ancien texte, nouveau texte)} ; c'est toujours la « Response A ».
MIGRATION = "20261022180000_cert_part2_textes_corriges.sql"
CORRECTIONS = {
    "t2_p2_31": ("Bring an interview to the office.", "The interviewer is very friendly, I think."),
    "t3_p2_29": ("Tanaka are responsible, I think.", "Mr. Tanaka are responsible, I think."),
}
PREMIER_P2 = "t2_p2_30"  # lancé en premier : sert d'essai (--essai 1)


def charger_builder(chemin):
    """Importe build_contenu.py depuis la racine du dépôt elearn-supabase (ou depuis le dossier seed/toeic)."""
    base = Path(chemin)
    for cand in (base / "supabase" / "seed" / "toeic", base):
        f = cand / "build_contenu.py"
        if f.exists():
            spec = importlib.util.spec_from_file_location("build_contenu", f)
            mod = importlib.util.module_from_spec(spec)
            sys.modules["build_contenu"] = mod
            spec.loader.exec_module(mod)
            return mod, base
    sys.exit(f"build_contenu.py introuvable sous {base}")


def verifier_migration(base):
    """Les textes appliqués ici doivent être ceux de la migration : on contrôle qu'ils y figurent."""
    cand = list((base / "supabase" / "migrations").glob(MIGRATION)) if (base / "supabase").exists() else []
    if not cand:
        print(f"(migration {MIGRATION} introuvable : correspondance des textes non contrôlée)")
        return
    sql = cand[0].read_text(encoding="utf-8")
    for ref, (ancien, nouveau) in CORRECTIONS.items():
        if ref not in sql or ancien not in sql or nouveau not in sql:
            sys.exit(f"CORRECTIONS ne correspond plus à la migration pour {ref}")
    print(f"corrections vérifiées contre {MIGRATION}")


def groupes_ecoute(bc, code):
    """Groupes d'écoute d'un test avec leur transcription finale (après mélange), comme le builder."""
    prefixe, fichier = TESTS[code]
    groupes, questions = bc.new_test_questions(prefixe, code, fichier, None, shuffle_seed=code)
    bc.build_transcripts(groupes, questions)
    sortie = []
    for g in groupes:
        if g["part"] not in (1, 2, 3, 4):
            continue
        if not g.get("transcript"):
            sys.exit(f"groupe {g['ref']} sans transcription")
        if not g.get("audio"):
            sys.exit(f"groupe {g['ref']} sans chemin audio")
        sortie.append({
            "ref": g["ref"],
            "part": g["part"],
            "chemin": f"toeic/{prefixe}/{g['audio']}",
            "lignes": [[loc, txt] for loc, txt in g["transcript"]],
        })
    return sortie


def appliquer_corrections(job):
    ancien_nouveau = CORRECTIONS.get(job["ref"])
    if not ancien_nouveau:
        return
    ancien, nouveau = ancien_nouveau
    trouve = 0
    for ligne in job["lignes"]:
        if ligne[0] == "Response A" and ligne[1] == ancien:
            ligne[1] = nouveau
            trouve += 1
    if trouve != 1:
        sys.exit(f"{job['ref']} : texte à corriger introuvable en Response A ({trouve})")


def ecrire(chemin, jobs):
    chemin.parent.mkdir(parents=True, exist_ok=True)
    chemin.write_text(json.dumps(jobs, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    mots = sum(len(t.split()) for j in jobs for _, t in j["lignes"])
    print(f"{chemin.name} : {len(jobs)} groupes, {mots} mots")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("supabase", help="racine du dépôt elearn-supabase")
    ap.add_argument("--sortie", default=str(ICI / "jobs"))
    args = ap.parse_args()
    bc, base = charger_builder(args.supabase)
    sortie = Path(args.sortie)

    for n in (4, 5, 6, 7):
        jobs = groupes_ecoute(bc, f"toeic_0{n}")
        ecrire(sortie / f"t{n}.json", jobs)

    verifier_migration(base)
    p2 = []
    for code in ("toeic_02", "toeic_03"):
        p2 += [j for j in groupes_ecoute(bc, code) if j["part"] == 2]
    for j in p2:
        appliquer_corrections(j)
    p2.sort(key=lambda j: j["ref"] != PREMIER_P2)  # tri stable : t2_p2_30 en tête, le reste dans l'ordre
    if p2[0]["ref"] != PREMIER_P2:
        sys.exit(f"{PREMIER_P2} absent")
    if len(p2) != 50:
        sys.exit(f"50 groupes de partie 2 attendus, {len(p2)} trouvés")
    ecrire(sortie / "p2_t2_t3.json", p2)


if __name__ == "__main__":
    main()
