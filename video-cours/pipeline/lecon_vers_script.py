"""Leçon (blocs BlockNote décodés) -> script : une phrase par écran, texte parlé et texte affiché.

Règles simples, à relire par un humain (statut « à relire ») :
- titre de niveau 1 -> écran titre ; titres 2 et 3 -> nom de l'étape (kicker) ;
- paragraphe et puces -> une phrase par écran ;
- une phrase qui contient du LaTeX ($...$) -> écran formule, et la phrase parlée est traduite en français oral.
"""
import re

REMPLACEMENTS = [
    (r"\\frac\{([^{}]+)\}\{([^{}]+)\}", r"\1 sur \2"),
    (r"\^2", " au carré"), (r"\^3", " au cube"),
    (r"\\sqrt\{([^{}]+)\}", r"racine carrée de \1"),
    (r"\\Delta", "delta"), (r"\\times", " fois "), (r"\\neq", " différent de "),
    (r"\\leq", " inférieur ou égal à "), (r"\\geq", " supérieur ou égal à "),
    (r"\+", " plus "), (r"(?<=[\w\)\}]) ?- ?", " moins "), (r"^-", "moins "), (r"(?<=[(=]) ?-", " moins "),
    (r"=", " égale "), (r">", " supérieur à "), (r"<", " inférieur à "),
]


def texte_de(bloc):
    morceaux = []
    for c in bloc.get("content") or []:
        if isinstance(c, dict):
            morceaux.append(c.get("text", ""))
        elif isinstance(c, str):
            morceaux.append(c)
    return "".join(morceaux).strip()


def en_francais_oral(latex):
    s = latex.replace("\\,", " ")
    for motif, rempl in REMPLACEMENTS:
        s = re.sub(motif, rempl, s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


AFFICHAGE = [
    (r"\\Delta", "Δ"), (r"\\neq", "≠"), (r"\\times", "×"), (r"\\leq", "≤"), (r"\\geq", "≥"),
    (r"\\sqrt\{([^{}]+)\}", r"√\1"), (r"\^2", "²"), (r"\^3", "³"), (r"\\frac\{([^{}]+)\}\{([^{}]+)\}", r"(\1)/(\2)"),
    (r"[{}]", ""), (r"\\", ""), (r"\s*\*\s*", "·"),
]


def affichage_de(latex):
    s = latex.replace("\\,", " ")
    for motif, rempl in AFFICHAGE:
        s = re.sub(motif, rempl, s)
    return s.strip()


def phrases(texte):
    return [p.strip() for p in re.split(r"(?<=[.!?])\s+", texte) if p.strip()]


def script_depuis_blocs(blocs, titre_defaut="Leçon"):
    titre, etape, sortie, n = titre_defaut, "", [], 0
    for b in blocs:
        t = b.get("type")
        txt = texte_de(b)
        if not txt:
            continue
        if t == "heading":
            niveau = (b.get("props") or {}).get("level", 2)
            if niveau == 1 and n == 0:
                titre = txt
                sortie.append({"id": f"p{n+1:03d}", "ecran": {"type": "titre", "kicker": "Leçon", "titre": txt, "sous": ""}, "texte": txt, "dit": txt, "pause": 0.9})
                n += 1
            else:
                etape = txt
            continue
        for ph in phrases(txt):
            n += 1
            if "$" in ph:
                formules = re.findall(r"\$(.+?)\$", ph)
                ecran = {"type": "etape", "kicker": etape or titre, "titre": "", "tex": formules}
                dit = re.sub(r"\$(.+?)\$", lambda m: en_francais_oral(m.group(1)), ph)
                sortie.append({"id": f"p{n:03d}", "ecran": ecran, "texte": re.sub(r"\$(.+?)\$", lambda m: affichage_de(m.group(1)), ph), "dit": dit, "pause": 1.0})
            else:
                ecran = {"type": "phrase", "kicker": etape or titre, "texte": ph}
                sortie.append({"id": f"p{n:03d}", "ecran": ecran, "texte": ph, "dit": ph, "pause": 0.7})
    return {"titre": titre, "matiere": "", "phrases": sortie, "statut": "a_relire"}
