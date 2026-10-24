"""Assemble une vidéo 16:9 à partir d'une leçon décodée : chaque bloc devient une scène du catalogue,
et les scènes sont enchaînées avec leur durée. Pas de voix ici : la voix sera calée sur ces durées.

Usage : python lecon_mixte.py <lecon.json> <sortie.mp4> [max_scenes]
"""
import json
import pathlib
import subprocess
import sys
import tempfile
from playwright.sync_api import sync_playwright

from selecteur_scenes import playlist

ICI = pathlib.Path(__file__).resolve().parent
CATALOGUE = ICI.parent / "catalogue" / "catalogue_v2.html"
CHROME = "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome"
FPS = 25
LIBELLES = {"titre": "Titre", "phrase": "Phrase", "points-cles": "Points clés", "tableau": "Tableau"}


def duree(scene, params):
    """Durée de tenue d'une scène, au rythme de lecture (sans voix) : 0,4 s par mot, 4 s minimum."""
    mots = sum(len(str(v).split()) for v in params.values() if isinstance(v, str))
    mots += sum(len(str(x).split()) for v in params.values() if isinstance(v, list) for x in v if isinstance(x, str))
    return max(4.0, 0.4 * mots + 1.5)


def rendre(blocs, sortie, max_scenes=24):
    scenes, coinces = playlist(blocs)
    scenes = scenes[:max_scenes]
    types = sorted({s for s, _ in scenes})
    with tempfile.TemporaryDirectory() as tmp, sync_playwright() as p:
        tmp = pathlib.Path(tmp)
        nav = p.chromium.launch(executable_path=CHROME)
        page = nav.new_page(viewport={"width": 1920, "height": 1080})
        page.goto(CATALOGUE.as_uri())
        segments = []
        for k, (scene, params) in enumerate(scenes):
            d = duree(scene, params)
            n_img = round(d * FPS)
            seg = tmp / f"s{k:03d}.mp4"
            ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", str(FPS),
                                   "-c:v", "mjpeg", "-i", "-", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "21",
                                   "-r", str(FPS), str(seg)], stdin=subprocess.PIPE)
            for f in range(n_img):
                page.evaluate("([s,p,t,k,n,lib]) => { document.getElementById('cadre').innerHTML = `"
                              "<div class=\"entete\"><div class=\"num\">${String(k+1).padStart(2,'0')}</div>"
                              "<div class=\"droite\"><div class=\"famille\">Leçon 7266 · ${lib}</div></div></div>"
                              "<div class=\"corps\">${window.RENDU[s](p, t)}</div>"
                              "<div class=\"pied\">${k+1} / ${n}</div>`; }",
                              [scene, params, f / FPS, k, len(scenes), LIBELLES.get(scene, scene)])
                ff.stdin.write(page.locator("#cadre").screenshot(type="jpeg", quality=92))
            ff.stdin.close()
            ff.wait()
            segments.append(seg)
            print("scène", k + 1, scene, round(d, 1), "s", flush=True)
        nav.close()
        liste = tmp / "liste.txt"
        liste.write_text("".join(f"file '{s}'\n" for s in segments), encoding="utf-8")
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(liste),
                        "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo", "-shortest",
                        "-c:v", "copy", "-c:a", "aac", "-b:a", "96k", str(sortie)], check=True)
    return {"scenes": len(scenes), "types": types, "coinces": coinces}


if __name__ == "__main__":
    lecon = json.loads(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8"))
    sortie = pathlib.Path(sys.argv[2])
    maxi = int(sys.argv[3]) if len(sys.argv) > 3 else 24
    print(rendre(lecon["blocs"], sortie, maxi), flush=True)
