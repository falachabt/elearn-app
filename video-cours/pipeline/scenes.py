"""Registre des scènes et validation des balises de scène d'un script (étape 1)."""

STATIQUES = {"titre", "formule", "etape", "cas", "recap", "phrase"}
REGISTRE = {
    "titre": {"statique": True, "obligatoires": {"titre": str}},
    "formule": {"statique": True, "obligatoires": {"tex": str}},
    "etape": {"statique": True, "obligatoires": {"tex": list}},
    "cas": {"statique": True, "obligatoires": {"actif": int}},
    "recap": {"statique": True, "obligatoires": {"etapes": list}},
    "phrase": {"statique": True, "obligatoires": {"texte": str}},
    "graphique-parabole": {"statique": False, "obligatoires": {"a": (int, float), "b": (int, float), "c": (int, float)}},
    "mouvement-chute": {"statique": False, "obligatoires": {"hauteur_m": (int, float)}},
    "reaction-neutralisation": {"statique": False, "obligatoires": {}},
    "dialogue-2-voix": {"statique": False, "obligatoires": {"repliques": list}},
}


def valider_scene(scene):
    """Renvoie la liste des erreurs de la balise (vide si valide)."""
    erreurs = []
    if not isinstance(scene, dict) or "type" not in scene:
        return ["balise de scène sans type"]
    type_ = scene["type"]
    if type_ not in REGISTRE:
        return [f"type de scène inconnu : {type_}"]
    params = scene.get("params", {})
    for nom, attendu in REGISTRE[type_]["obligatoires"].items():
        if nom not in params:
            erreurs.append(f"{type_} : paramètre manquant « {nom} »")
        elif not isinstance(params[nom], attendu):
            erreurs.append(f"{type_} : « {nom} » de mauvais type")
    return erreurs


def valider_script(script):
    """Valide toutes les balises d'un script. Renvoie (ok, erreurs)."""
    erreurs = []
    for ph in script.get("phrases", []):
        if "scene" in ph:
            for e in valider_scene(ph["scene"]):
                erreurs.append(f"{ph.get('id', '?')} : {e}")
    return (not erreurs), erreurs
