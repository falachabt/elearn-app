"""Choisit une scène du catalogue pour chaque bloc d'une leçon décodée (export de decode_lecon.py).

Règles simples, sans modèle : le type du bloc décide de la scène. Les cas non couverts
ne sont pas inventés : ils passent par la scène de secours ou sont signalés « coince ».
"""


def texte_inline(contenu):
    """Texte d'un bloc avec ses formules : les formules inline deviennent $latex$."""
    if not isinstance(contenu, list):
        return ""
    morceaux = []
    for c in contenu:
        if not isinstance(c, dict):
            continue
        if c.get("type") == "inlineMath":
            morceaux.append("$" + c.get("props", {}).get("latex", "") + "$")
        else:
            morceaux.append(c.get("text", ""))
    return "".join(morceaux).strip()


def choisir(bloc):
    """Retourne (scene, params) ou (None, raison) si le bloc est à traiter à part."""
    t = bloc.get("type")
    texte = texte_inline(bloc.get("content"))
    if t == "heading":
        niveau = bloc.get("props", {}).get("level", 2)
        if niveau == 2:
            return "titre", {"titre": texte}
        return "titre", {"titre": texte, "sousTitre": "Sous-partie"}
    if t == "paragraph":
        if not texte:
            return None, "paragraphe vide"
        return "phrase", {"texte": texte}
    if t in ("bulletListItem", "numberedListItem"):
        return "points-cles", {"points": [texte]}
    if t == "table":
        return "tableau", {"entetes": [], "lignes": [], "surlignee": None}
    if t == "divider":
        return None, "séparateur, pas de scène"
    if t == "math":
        return "formule", {"tex": bloc.get("props", {}).get("latex", "")}
    return None, f"type non couvert : {t}"


def playlist(blocs):
    """Regroupe les puces consécutives en une seule scène points-cles, et les tableaux en lignes lisibles."""
    sortie, coinces, i = [], [], 0
    while i < len(blocs):
        b = blocs[i]
        if b.get("type") in ("bulletListItem", "numberedListItem"):
            points = []
            while i < len(blocs) and blocs[i].get("type") in ("bulletListItem", "numberedListItem"):
                points.append(texte_inline(blocs[i].get("content")))
                i += 1
            sortie.append(("points-cles", {"points": points[:5]}))
            continue
        if b.get("type") == "table":
            rangees = [[texte_inline(c.get("content")) for c in r.get("cells", [])] for r in b.get("content", {}).get("rows", [])]
            entetes = rangees[0] if rangees else []
            sortie.append(("tableau", {"entetes": entetes, "lignes": rangees[1:6], "surlignee": None}))
            i += 1
            continue
        scene, params = choisir(b)
        if scene:
            sortie.append((scene, params))
        elif params and "non couvert" in str(params):
            coinces.append(params)
        i += 1
    return sortie, coinces
