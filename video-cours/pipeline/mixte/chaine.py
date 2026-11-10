"""Chaîne complète, en une commande : leçon décodée -> scènes -> script -> voix OmniVoice -> vidéo 16:9.

Usage : python chaine.py <lecon.json> <dossier_sortie> [max_scenes]
Chaque étape écrit son résultat et son temps dans <dossier_sortie>/rapport.json.
Les étapes qui demandent une retouche (formules à relire, types non couverts) sont listées dans le rapport.
"""
import json
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile
import time


ICI = pathlib.Path(__file__).resolve().parent
PIPE = ICI.parent
sys.path.insert(0, str(ICI))
sys.path.insert(0, str(PIPE))
from selecteur_scenes import playlist
CONFIG = PIPE / "config.json"
CATALOGUE = PIPE / "catalogue" / "catalogue_v2.html"
CHROME = "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome"
FPS = 25
PAUSE_S = 0.7
REMPLACEMENTS = [(r"\\(\w+)", " "), (r"_\{?\w+\}?", ""), (r"\^2", " au carré"), (r"\^3", " au cube"),
                 (r"=", " égale "), (r"\+", " plus "), (r"-", " moins "), (r"[()\[\]{}]", " "), (r"\s+", " ")]


def dire_formule(tex):
    """Lecture simple d'une formule LaTeX en français. Une formule complexe reste à relire."""
    s = tex
    s = s.replace("\\leq", " inférieur ou égal à ").replace("\\geq", " supérieur ou égal à ")
    for motif, rempl in REMPLACEMENTS:
        s = re.sub(motif, rempl, s)
    return s.strip()


def dit(scene, params):
    """Texte parlé d'une scène. Retourne (texte, nombre de formules à relire)."""
    if scene == "titre":
        t = params["titre"] + "."
        if params.get("sousTitre"):
            t += " " + params["sousTitre"] + "."
        return t, 0
    if scene == "phrase":
        formules = re.findall(r"\$([^$]+)\$", params["texte"])
        return re.sub(r"\$([^$]+)\$", lambda m: " " + dire_formule(m.group(1)) + " ", params["texte"]), len(formules)
    if scene == "points-cles":
        return "Points clés : " + " ".join(dire_formule(p).rstrip(".") + "." for p in params["points"]), 0
    if scene == "formule":
        return "Formule : " + dire_formule(params["tex"]) + ".", 0
    if scene == "recap":
        return "À retenir : " + " ".join(e.rstrip(".") + "." for e in params["etapes"]), 0
    if scene == "tableau":
        return "Voici un tableau avec les colonnes " + ", ".join(params["entetes"]) + ".", 0
    return "", 0


def fichier_scene_html(scene, params, t):
    return None


def rendre_video(scenes, durees, sortie_mp4, audio_wav, tmp, libelle="Cours"):
    """Image par image, chaque scène tient la durée de sa voix (plus la pause)."""
    from playwright.sync_api import sync_playwright
    segments = []
    with sync_playwright() as p:
        nav = p.chromium.launch(executable_path=CHROME)
        page = nav.new_page(viewport={"width": 1920, "height": 1080})
        page.goto(CATALOGUE.as_uri())
        for k, ((scene, params), d) in enumerate(zip(scenes, durees)):
            n_img = round(d * FPS)
            seg = tmp / f"v{k:03d}.mp4"
            ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", str(FPS),
                                   "-c:v", "mjpeg", "-i", "-", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "21",
                                   "-r", str(FPS), str(seg)], stdin=subprocess.PIPE)
            for f in range(n_img):
                page.evaluate("([s,p,t,k,n,lib]) => { document.getElementById('cadre').innerHTML = `"
                              "<div class=\"entete\"><div class=\"num\">${String(k+1).padStart(2,'0')}</div>"
                              "<div class=\"droite\"><div class=\"famille\">${lib}</div></div></div>"
                              "<div class=\"corps\">${window.RENDU[s](p, t)}</div>"
                              "<div class=\"pied\">${k+1} / ${n}</div>`; }",
                              [scene, params, f / FPS, k, len(scenes), libelle])
                ff.stdin.write(page.locator("#cadre").screenshot(type="jpeg", quality=92))
            ff.stdin.close(); ff.wait()
            segments.append(seg)
        nav.close()
    liste = tmp / "liste_v.txt"
    liste.write_text("".join(f"file '{s}'\n" for s in segments), encoding="utf-8")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(liste),
                    "-i", str(audio_wav), "-shortest", "-c:v", "copy", "-c:a", "aac", "-b:a", "96k",
                    str(sortie_mp4)], check=True)


def main(lecon_json, dossier, maxi=20):
    dossier = pathlib.Path(dossier)
    dossier.mkdir(parents=True, exist_ok=True)
    rapport = {"etapes": {}}
    # 1. Export : déjà fait par export_lecons.py ; ici on lit le JSON décodé.
    t0 = time.time()
    blocs = json.loads(pathlib.Path(lecon_json).read_text(encoding="utf-8"))["blocs"]
    rapport["etapes"]["export"] = {"auto": True, "secondes": round(time.time() - t0, 2), "blocs": len(blocs)}
    # 2. Sélection des scènes (règles simples).
    t0 = time.time()
    scenes, coinces = playlist(blocs)
    scenes = scenes[:maxi]
    types = sorted({s for s, _ in scenes})
    rapport["etapes"]["selection"] = {"auto": True, "secondes": round(time.time() - t0, 2), "scenes": len(scenes),
                                      "types": types, "non_couverts": coinces}
    # 3. Script : texte parlé par scène, formules à relire signalées.
    t0 = time.time()
    phrases, a_relire = [], 0
    for k, (scene, params) in enumerate(scenes):
        texte, nf = dit(scene, params)
        a_relire += nf
        phrases.append({"id": f"s{k:03d}", "scene": scene, "dit": texte, "params": params})
    rapport["etapes"]["script"] = {"auto": True, "secondes": round(time.time() - t0, 2), "formules_a_relire": a_relire}
    (dossier / "script.json").write_text(json.dumps(phrases, ensure_ascii=False, indent=1), encoding="utf-8")
    # 4. Voix OmniVoice, une clip par scène.
    t0 = time.time()
    import soundfile as sf
    from generer_voix import generer
    config = json.loads(CONFIG.read_text(encoding="utf-8"))
    durees_voix = generer({"phrases": phrases}, dossier, config)
    rapport["etapes"]["voix"] = {"auto": True, "secondes": round(time.time() - t0, 2), "clips": len(durees_voix)}
    # 5. Durées de scène = voix + pause ; audio concaténé avec silences.
    durees = [durees_voix[ph["id"]] + PAUSE_S for ph in phrases]
    audio = dossier / "audio.wav"
    with tempfile.TemporaryDirectory() as tmp:
        tmp = pathlib.Path(tmp)
        liste = tmp / "a.txt"
        morceaux = []
        for ph in phrases:
            morceaux.append(f"file '{dossier / 'voix' / (ph['id'] + '.wav')}'")
            silence = tmp / f"p_{ph['id']}.wav"
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i",
                            f"anullsrc=r=24000:cl=mono", "-t", str(PAUSE_S), str(silence)], check=True)
            morceaux.append(f"file '{silence}'")
        liste.write_text("\n".join(morceaux) + "\n", encoding="utf-8")
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(liste),
                        "-ar", "44100", "-ac", "2", str(audio)], check=True)
        # 6. Vidéo 16:9 : chaque scène tient sa durée, l'audio est posé dessus.
        t0 = time.time()
        sortie = dossier / "lecon-7266-16x9.mp4"
        rendre_video(scenes, durees, sortie, audio, tmp)
        rapport["etapes"]["rendu"] = {"auto": True, "secondes": round(time.time() - t0, 2)}
    rapport["duree_video_s"] = round(sum(durees), 1)
    rapport["sortie"] = str(sortie)
    (dossier / "rapport.json").write_text(json.dumps(rapport, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps(rapport, ensure_ascii=False, indent=1), flush=True)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 20)
