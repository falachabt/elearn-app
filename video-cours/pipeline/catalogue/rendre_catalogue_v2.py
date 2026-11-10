"""Rend le catalogue v2 (32 scènes réalisées, variantes A et B) en vidéo 16:9, 25 images/s.

Chaque variante dure VARIANTE_S secondes. Les images partent directement vers ffmpeg (pas de fichiers intermédiaires).
Usage : python rendre_catalogue_v2.py [sortie.mp4]
"""
import pathlib
import subprocess
import sys
import tempfile
from playwright.sync_api import sync_playwright

ICI = pathlib.Path(__file__).resolve().parent
HTML = ICI / "catalogue_v2.html"
CHROME = "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome"
FPS = 25
VARIANTE_S = 5.0
TITRE_S = 3.0


def encoder_segment(page, sortie_tmp, n_images, fonction):
    """Envoie n_images captures à ffmpeg via un tube, sans fichiers intermédiaires."""
    ff = subprocess.Popen([
        "ffmpeg", "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", str(FPS),
        "-c:v", "mjpeg", "-i", "-", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "21",
        "-r", str(FPS), str(sortie_tmp),
    ], stdin=subprocess.PIPE)
    for f in range(n_images):
        fonction(f / FPS)
        ff.stdin.write(page.locator("#cadre").screenshot(type="jpeg", quality=92))
    ff.stdin.close()
    ff.wait()


def rendre(sortie):
    n_images = round(VARIANTE_S * FPS)
    with tempfile.TemporaryDirectory() as tmp, sync_playwright() as p:
        tmp = pathlib.Path(tmp)
        nav = p.chromium.launch(executable_path=CHROME)
        page = nav.new_page(viewport={"width": 1920, "height": 1080})
        page.goto(HTML.as_uri())
        segments = []
        # Carte de titre : 3 s.
        page.evaluate("""() => { document.getElementById('cadre').innerHTML =
            '<div style="position:absolute;left:120px;top:300px;font-family:Archivo Black;font-size:120px;line-height:1.05">Catalogue<br>des scènes</div>' +
            '<div style="position:absolute;left:120px;top:620px;font-size:44px;font-weight:700">32 scènes · variantes A et B · numéro par numéro</div>'; }""")
        seg = tmp / "titre.mp4"
        encoder_segment(page, seg, round(TITRE_S * FPS), lambda t: None)
        segments.append(seg)
        n = page.evaluate("window.CATALOGUE.length")
        for i in range(n):
            for v in ("A", "B"):
                seg = tmp / f"s{i:02d}{v}.mp4"
                encoder_segment(page, seg, n_images,
                                lambda t, i=i, v=v: page.evaluate("([i,v,t]) => window.montrer(i,v,t)", [i, v, t]))
                segments.append(seg)
                print("segment", i + 1, v, flush=True)
        nav.close()
        liste = tmp / "liste.txt"
        liste.write_text("".join(f"file '{s}'\n" for s in segments), encoding="utf-8")
        subprocess.run([
            "ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(liste),
            "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo", "-shortest",
            "-c:v", "copy", "-c:a", "aac", "-b:a", "96k", str(sortie),
        ], check=True)
    return sortie


if __name__ == "__main__":
    cible = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ICI.parent.parent / "catalogue-scenes" / "catalogue-scenes-16x9-v2.mp4"
    cible.parent.mkdir(parents=True, exist_ok=True)
    print(rendre(cible), flush=True)
