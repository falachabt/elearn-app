"""Rend le catalogue en vidéo 16:9 : une image par segment (titre, chaque scène, fin), tenue sa durée.

Usage : python rendre_catalogue.py [sortie.mp4]. Pas de voix : les numéros et titres suffisent à valider.
"""
import pathlib
import shutil
import subprocess
import sys
import tempfile
from playwright.sync_api import sync_playwright

from generer_catalogue import generer

ICI = pathlib.Path(__file__).resolve().parent
CHROME = "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome"
DUREE_SCENE = 6.0
DUREE_TITRE = 3.0
DUREE_FIN = 4.0
FPS = 25


def segments(n):
    yield ("intro", None, DUREE_TITRE)
    for i in range(n):
        yield ("scene", i, DUREE_SCENE)
    yield ("outro", None, DUREE_FIN)


def rendre(sortie):
    html, n = generer()
    with tempfile.TemporaryDirectory() as tmp, sync_playwright() as p:
        tmp = pathlib.Path(tmp)
        navigateur = p.chromium.launch(executable_path=CHROME)
        page = navigateur.new_page(viewport={"width": 1920, "height": 1080})
        page.goto(html.as_uri())
        liste = []
        for k, (genre, i, duree) in enumerate(segments(n)):
            if genre == "intro":
                page.evaluate("() => window.intro()")
            elif genre == "scene":
                page.evaluate("i => window.scene(i)", i)
            else:
                page.evaluate("() => window.outro()")
            png = tmp / f"s{k:03d}.png"
            page.locator("#cadre").screenshot(path=str(png))
            mp4 = tmp / f"s{k:03d}.mp4"
            subprocess.run([
                "ffmpeg", "-y", "-loglevel", "error", "-loop", "1", "-i", str(png), "-t", str(duree),
                "-r", str(FPS), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "21", str(mp4),
            ], check=True)
            liste.append(mp4)
        navigateur.close()
        concat = tmp / "liste.txt"
        concat.write_text("".join(f"file '{m}'\n" for m in liste), encoding="utf-8")
        subprocess.run([
            "ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(concat),
            "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo", "-shortest",
            "-c:v", "copy", "-c:a", "aac", "-b:a", "96k", str(sortie),
        ], check=True)
    return sortie


if __name__ == "__main__":
    cible = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ICI.parent.parent / "catalogue-scenes" / "catalogue-scenes-16x9.mp4"
    cible.parent.mkdir(parents=True, exist_ok=True)
    print(rendre(cible))
