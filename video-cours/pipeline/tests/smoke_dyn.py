"""Test de fumée des gabarits dynamiques : chaque cas se charge, se dessine
à quelques instants sans erreur JavaScript, et produit un cadre non vide.

Lancer : python3 tests/smoke_dyn.py (depuis pipeline/). Nécessite playwright
(Python) et le Chromium installé dans /opt/pw-browsers."""
import json
import pathlib
import sys
from playwright.sync_api import sync_playwright

RACINE = pathlib.Path(__file__).resolve().parent.parent
GABARIT = RACINE / "gabarits" / "dynamique" / "dyn.html"
CHROME = "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome"


def timing_factice(phrases):
    """Chaque phrase dure 2 s : ids des phrases -> début, _fin -> fin totale."""
    t = {p["id"]: i * 2.0 for i, p in enumerate(phrases)}
    t["_fin"] = len(phrases) * 2.0
    return t


def tester():
    cas = json.loads((RACINE / "gabarits" / "dynamique" / "cas.json").read_text())
    erreurs = []
    with sync_playwright() as p:
        nav = p.chromium.launch(executable_path=CHROME)
        page = nav.new_page(viewport={"width": 1080, "height": 1920})
        page.on("pageerror", lambda e: erreurs.append(str(e)))
        page.goto(GABARIT.as_uri())
        for nom, donnees in cas.items():
            page.evaluate(
                "([d, t, c]) => window.charger(d, t, c)",
                [donnees, timing_factice(donnees["phrases"]), nom],
            )
            fin = len(donnees["phrases"]) * 2.0
            for t in (0.0, fin / 2, fin - 0.1):
                page.evaluate("t => window.frame(t)", t)
            # Un cadre dessiné doit contenir des éléments dans la scène.
            enfants = page.evaluate("() => document.getElementById('scene').children.length")
            if enfants == 0:
                erreurs.append(f"{nom} : scène vide après frame()")
            print(f"{nom}: {enfants} éléments dans la scène")
        nav.close()
    if erreurs:
        print("ÉCHEC :")
        for e in erreurs:
            print(" -", e)
        return 1
    print("OK : 4 cas dessinés sans erreur")
    return 0


if __name__ == "__main__":
    sys.exit(tester())
