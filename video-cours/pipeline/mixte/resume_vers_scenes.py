"""Transforme le résumé d'un cours (course_summaries.content, lu dans exports/resume-<id>.json)
en scènes de vidéo : une poignée de scènes qui reprennent le fil du résumé, pas tout le texte.

Règles (automatiques, sans modèle) :
- titre : le titre du résumé (le préfixe « Fiche de révision : » est retiré) ;
- phrase : première phrase d'un paragraphe de chapitre (introduction, idée du principe) ;
- formule : première formule contenant « = » dans un paragraphe du chapitre ;
- points-cles : au plus 4 puces d'un chapitre ;
- recap : les définitions de la section « À retenir ».
Les sections choisies sont listées dans SECTIONS_RETENUES ; tout le reste est écarté, sans être récité.
"""
import json
import pathlib
import re

SECTIONS_RETENUES = {
    "Introduction aux ajustements linéaires": ["phrase"],
    "Le principe des moindres carrés": ["phrase", "formule"],
    "Calcul de l'équation de la droite de régression": ["formule"],
    "Interprétation du coefficient de corrélation linéaire": ["points-cles"],
    "Interprétation à éviter": [],
    "À retenir": ["recap"],
}
PREFIXE = re.compile(r"^Fiche de révision\s*:\s*")


def _premiere_phrase(texte, longueur=170):
    texte = re.sub(r"\$([^$]+)\$", r"\1", texte).strip()
    morceau = re.split(r"(?<=[.!?])\s+", texte)[0]
    return morceau if len(morceau) <= longueur else morceau[: longueur - 3].rsplit(" ", 1)[0] + "…"


def _sections(blocs):
    """Regroupe les blocs par titre de niveau 2 (chapitre) et niveau 3 (sous-partie)."""
    sections, courante, sous = [], None, None
    for b in blocs:
        if b["type"] == "heading" and b.get("niveau") == 2:
            courante = {"titre": b["texte"], "blocs": []}
            sections.append(courante)
            sous = None
        elif courante is not None:
            if b["type"] == "heading":
                sous = b["texte"]
            courante["blocs"].append({**b, "sous": sous})
    return sections


def scenes_du_resume(resume):
    blocs = resume["blocs"]
    titre = next((b["texte"] for b in blocs if b["type"] == "heading" and b.get("niveau") == 1), resume["name"])
    scenes = [("titre", {"titre": PREFIXE.sub("", titre)})]
    for section in _sections(blocs):
        types = SECTIONS_RETENUES.get(section["titre"], [])
        for t in types:
            if t == "phrase":
                premier = next((b for b in section["blocs"] if b["type"] == "paragraph" and len(b["texte"]) > 30), None)
                if premier:
                    scenes.append(("phrase", {"texte": _premiere_phrase(premier["texte"])}))
            elif t == "formule":
                for b in section["blocs"]:
                    if b["type"] != "paragraph":
                        continue
                    f = next((m for m in re.findall(r"\$([^$]+)\$", b["texte"]) if "=" in m), None)
                    if f:
                        scenes.append(("formule", {"tex": f}))
                        break
            elif t == "points-cles":
                points = [re.sub(r"\$([^$]+)\$", r"\1", b["texte"]) for b in section["blocs"]
                          if b["type"] in ("bulletListItem", "numberedListItem")]
                scenes.append(("points-cles", {"points": [p[:90] for p in points[:4]]}))
            elif t == "recap":
                definitions = [re.sub(r"\$([^$]+)\$", r"\1", b["texte"]) for b in section["blocs"]
                               if b["type"] == "bulletListItem" and b.get("sous") == "Définitions essentielles"]
                scenes.append(("recap", {"etapes": [d[:95] for d in definitions[:3]]}))
    return scenes


if __name__ == "__main__":
    import sys
    resume = json.loads(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8"))
    for s, p in scenes_du_resume(resume):
        print(s, json.dumps(p, ensure_ascii=False)[:150])
