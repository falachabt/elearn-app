#!/usr/bin/env python3
"""QA rapide d'un script de cours : une capture FIXE par écran, sans voix
ni montage vidéo. Le rendu complet (lancer.py) capture 12 images/seconde
pour les écrans animés puis encode tout le MP4 — plusieurs minutes par
cours. Ici : Chromium charge le gabarit une fois, affiche chaque écran à
son état final (animation à 95 %), signale les débordements via le même
contrôle que lancer.py (window.chevauchement) et photographie l'écran.

Usage : qa_ecrans.py <cours> [ecran1,ecran2,...]
Sortie : ~/workspace/video-cours-env/travail-test/<cours>/qa/<ecran>.png
"""
import json
import pathlib
import shutil
import sys

ICI = pathlib.Path(__file__).parent
sys.path.insert(0, str(ICI))
import lancer  # noqa: E402

GABARIT = ICI / "gabarit"
CHROME = pathlib.Path.home() / ".cache/ms-playwright/chromium-1243/chrome-linux64/chrome"


def donnees_qa(sous_script):
    """Construit l'équivalent d'un rendu.json avec des durées estimées."""
    sous, t = [], lancer.LEAD
    for p in sous_script["phrases"]:
        duree = max(2.0, len(p["dit"]) / 17.65)
        sous.append({"t0": round(t - lancer.DECALAGE_ECRAN, 3) if sous else 0.0,
                     "ecran": p["ecran"], "texte": p["texte"], "duree": duree})
        t += duree + p.get("pause_apres", 0)
    return {"titre": sous_script["titre"], "matiere": sous_script["matiere"], "cas": [],
            "ecrans": sous_script["ecrans"], "sous_titres": sous,
            "audio": "", "audio_duree": round(t, 3)}


def main():
    cours = sys.argv[1]
    filtre = set(sys.argv[2].split(",")) if len(sys.argv) > 2 else None
    script = json.loads((ICI / "scripts" / f"{cours}.json").read_text())
    lancer.valider(script)
    base = pathlib.Path.home() / f"workspace/video-cours-env/travail-test/{cours}/qa"
    base.mkdir(parents=True, exist_ok=True)
    modules = base / "node_modules"
    if not modules.exists():
        shutil.copytree(lancer.PIPE / "gabarits" / "ressources" / "node_modules", modules)
    (base / "lecon-16x9.html").write_text((GABARIT / "lecon-16x9.html").read_text())
    (base / "logo-symbole.svg").write_bytes((GABARIT / "logo-symbole.svg").read_bytes())

    from playwright.sync_api import sync_playwright
    with sync_playwright() as pw:
        b = pw.chromium.launch(executable_path=str(CHROME),
                               args=["--allow-file-access-from-files"])
        pg = b.new_page(viewport={"width": 1920, "height": 1080})
        for sous_script in lancer.decouper(script):
            data = donnees_qa(sous_script)
            pg.goto((base / "lecon-16x9.html").as_uri() + "?theme=clair")
            pg.evaluate("d => window.charger(d)", data)
            for i, c in enumerate(data["sous_titres"]):
                if filtre and c["ecran"] not in filtre:
                    continue
                pg.evaluate("i => window.afficher(i)", i)
                pg.evaluate("() => document.fonts.ready")
                anime = bool(data["ecrans"][c["ecran"]].get("anim"))
                if anime:
                    pg.evaluate("t => window.animer(t)", c["duree"] * 0.95)
                deb = pg.evaluate("() => window.chevauchement()")
                f = base / f"{c['ecran']}.png"
                pg.locator("#cadre").screenshot(path=str(f))
                print(("DEBORDE " if deb else "ok      ") + f"{c['ecran']:18s} -> {f}", flush=True)
        b.close()


if __name__ == "__main__":
    main()
