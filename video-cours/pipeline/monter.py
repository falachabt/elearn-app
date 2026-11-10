"""Script + durées mesurées -> MP4 clair et sombre 9:16, sous-titres VTT, extrait réseaux, manifest."""
import json, pathlib, subprocess, sys
from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).resolve().parent
RESSOURCES = HERE / "gabarits" / "ressources"   # node_modules (katex, polices) et logo


def silence(duree, sortie):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono",
                    "-t", str(duree), str(sortie)], check=True)
    return sortie


def chronologie(script, durees, config, sortie):
    rythme = config["rythme"]
    t = rythme["debut_s"]; parts = []; sous = []
    lead = silence(rythme["debut_s"], sortie / "silence-debut.wav"); parts.append(lead)
    for ph in script["phrases"]:
        sous.append({"t0": round(max(0.0, t - 0.15), 3), "ecran": ph["id"], "texte": ph["texte"]})
        parts.append(sortie / "voix" / f"{ph['id']}.wav")
        pause = ph.get("pause", rythme["pause_phrase_s"])
        parts.append(silence(pause, sortie / f"silence-{ph['id']}.wav"))
        t += durees[ph["id"]] + pause
    liste = sortie / "voix-liste.txt"
    liste.write_text("".join(f"file '{p}'\n" for p in parts))
    voix = sortie / "voix.wav"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(liste),
                    "-ar", "24000", "-ac", "1", str(voix)], check=True)
    return sous, round(t, 3), voix


CHEVAUCHEMENTS = []


def rendre(script, sous, duree, voix, theme, sortie, config, format_):
    html = (HERE / "gabarits" / format_["gabarit"]).read_text().replace("RESSOURCES/", RESSOURCES.as_posix() + "/")
    page = sortie / format_["gabarit"]; page.write_text(html)
    nom = f"{format_['gabarit'][:-5]}-{theme}"
    data = {"titre": script["titre"], "matiere": script.get("matiere", ""), "cas": [],
            "ecrans": {ph["id"]: ph["ecran"] for ph in script["phrases"]},
            "sous_titres": sous, "audio": str(voix), "audio_duree": duree}
    # Les gabarits ne connaissent que des écrans nommés : on remplace l'id par la clé d'écran.
    for s in data["sous_titres"]:
        s["ecran"] = s["ecran"]
    images = sortie / f"frames-{nom}"; images.mkdir(exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path="/opt/pw-browsers/chromium-1243/chrome-linux64/chrome",
                              args=["--allow-file-access-from-files"])
        pg = b.new_page(viewport={"width": format_["largeur"], "height": format_["hauteur"]})
        pg.goto(page.as_uri() + f"?theme={theme}")
        pg.evaluate("t => document.documentElement.classList.toggle('sombre', t === 'sombre')", theme)
        pg.evaluate("d => window.charger(d)", data)
        for i in range(len(sous)):
            pg.evaluate("i => window.afficher(i)", i)
            pg.evaluate("() => document.fonts.ready")
            if pg.evaluate("() => window.chevauchement()"):
                CHEVAUCHEMENTS.append({"theme": theme, "phrase": sous[i]["ecran"]})
            pg.locator("#cadre").screenshot(path=str(images / f"{i:03d}.png"))
        b.close()
    fins = [s["t0"] for s in sous[1:]] + [duree]
    lst = sortie / f"images-{nom}.txt"
    with open(lst, "w") as fh:
        for i, s in enumerate(sous):
            fh.write(f"file '{images / f'{i:03d}.png'}'\nduration {fins[i] - s['t0']:.3f}\n")
        fh.write(f"file '{images / f'{len(sous)-1:03d}.png'}'\n")
    mp4 = sortie / f"{nom}.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(lst), "-i", str(voix),
                    "-vf", "fps=%d,format=yuv420p" % config["format"]["fps"], "-c:v", "libx264", "-preset", "medium",
                    "-crf", "21", "-c:a", "aac", "-b:a", "128k", "-shortest", "-movflags", "+faststart", str(mp4)], check=True)
    return mp4


def sous_titres_vtt(sous, duree, sortie):
    def ts(t):
        return f"{int(t // 3600):02d}:{int(t % 3600 // 60):02d}:{t % 60:06.3f}"
    fins = [s["t0"] for s in sous[1:]] + [duree]
    with open(sortie / "sous-titres.vtt", "w") as fh:
        fh.write("WEBVTT\n\n")
        for s, f in zip(sous, fins):
            fh.write(f"{ts(s['t0'])} --> {ts(f)}\n{s['texte']}\n\n")


def extrait(mp4, duree_s, sortie):
    sortie_mp4 = sortie / "extrait-reseaux-9x16.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(mp4), "-t", str(duree_s), "-c:v", "libx264",
                    "-crf", "21", "-c:a", "aac", "-movflags", "+faststart", str(sortie_mp4)], check=True)
    return sortie_mp4


def monter(script_path, config_path, sortie):
    script = json.load(open(script_path)); config = json.load(open(config_path))
    sortie = pathlib.Path(sortie); sortie.mkdir(parents=True, exist_ok=True)
    durees = json.load(open(sortie / "durees.json"))
    sous, duree, voix = chronologie(script, durees, config, sortie)
    cours = config["format"]["cours"]
    clair = rendre(script, sous, duree, voix, "clair", sortie, config, cours)
    sombre = rendre(script, sous, duree, voix, "sombre", sortie, config, cours)
    sous_titres_vtt(sous, duree, sortie)
    fichiers = [clair.name, sombre.name, "sous-titres.vtt"]
    reseaux = config["format"]["reseaux"]
    if reseaux.get("activee"):
        verticale = rendre(script, sous, duree, voix, "clair", sortie, config, reseaux)
        fichiers.append(extrait(verticale, config["extrait_reseaux"]["duree_s"], sortie).name)
    statut = config["statut_initial"] if not CHEVAUCHEMENTS else "a_verifier"
    manifest = {"titre": script["titre"], "statut": statut, "duree_s": duree,
                "phrases": len(script["phrases"]), "fichiers": fichiers, "chevauchements": CHEVAUCHEMENTS}
    json.dump(manifest, open(sortie / "manifest.json", "w"), ensure_ascii=False, indent=1)
    return manifest


if __name__ == "__main__":
    print(monter(sys.argv[1], sys.argv[2], sys.argv[3]))
