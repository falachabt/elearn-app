#!/usr/bin/env python3
"""Vidéos explicatives TOEIC, en anglais : script d'une notion -> voix OmniVoice -> vidéo 16:9.

Même recette que chaine-cours (METHODE.md) : une phrase parlée = un écran, une génération OmniVoice
par phrase, chronologie d'après les durées mesurées, capture Chromium, montage ffmpeg.
Ce qui change : la voix est anglaise, le gabarit est gabarit/toeic-16x9.html (dialogues, structures,
question TOEIC décortiquée), et la capture pilote Chromium en ligne de commande (pas de Playwright).

Usage :
  python lancer_toeic.py ecrans <code>   # captures de chaque écran + planche de contact (aucune voix)
  python lancer_toeic.py ref             # crée la voix de référence anglaise (une seule fois)
  python lancer_toeic.py voix <code>     # une génération par phrase, reprise automatique
  python lancer_toeic.py monter <code>   # chronologie, captures, MP4 1080p et 720p, sous-titres
  python lancer_toeic.py publier <code>  # envoi sur R2 (CI : R2_ENDPOINT et clés AWS_* dans l'environnement)
  python lancer_toeic.py deja <code>     # code de sortie 0 si la notion est déjà publiée sur R2

`ref` et `voix` demandent torch et omnivoice (environnement de D:\\Projets\\voice-local) ;
`ecrans` et `monter` ne demandent que soundfile, Chromium et ffmpeg.

Variables d'environnement :
  CHAINE_CHROME    binaire Chromium (défaut : Chromium de Playwright dans le profil Windows, sinon /opt/pw-browsers)
  CHAINE_TRAVAIL   dossier de travail (défaut : <tmp>/chaine-toeic)
  CHAINE_ETAPES    pas de diffusion OmniVoice (défaut : 16)
"""
import glob
import json
import os
import pathlib
import shutil
import subprocess
import sys
import tempfile
import time

ICI = pathlib.Path(__file__).resolve().parent
COURS = ICI.parent / "chaine-cours"
POLICES = ICI.parent / "pipeline" / "gabarits" / "ressources" / "node_modules" / "@fontsource"
GABARIT = ICI / "gabarit" / "toeic-16x9.html"
LOGO = COURS / "gabarit" / "logo-symbole.svg"
REF_AUDIO = ICI / "voix" / "ref-en-femme.wav"
REF_TEXTE = ("Hello, and welcome to this lesson. Today, we are going to look at a very common point "
             "in the TOEIC test. Listen carefully, and take your time.")
# Voix de référence : conçue une fois par OmniVoice (design vocal), puis clonée pour chaque phrase,
# pour que le timbre reste le même d'une phrase et d'une notion à l'autre.
REF_CONSIGNE = "female, american accent"
VITESSE = 0.88  # 0,95 au pilote : jugé un peu rapide pour un élève
ETAPES = int(os.environ.get("CHAINE_ETAPES", "16"))
LEAD = 0.4
DECALAGE_ECRAN = 0.15
TYPES = {"titre", "structure", "dialogue", "question", "recap"}
CARACTERES_PAR_SECONDE = 14.0  # anglais posé à 0,95 : estimation avant génération


def chrome():
    if os.environ.get("CHAINE_CHROME"):
        return os.environ["CHAINE_CHROME"]
    locaux = sorted(glob.glob(os.path.expanduser("~/AppData/Local/ms-playwright/chromium-*/chrome-win64/chrome.exe")))
    return locaux[-1] if locaux else "/opt/pw-browsers/chromium"


def travail(code):
    d = pathlib.Path(os.environ.get("CHAINE_TRAVAIL", pathlib.Path(tempfile.gettempdir()) / "chaine-toeic")) / code
    (d / "seg").mkdir(parents=True, exist_ok=True)
    return d


def lire_script(code):
    script = json.loads((ICI / "scripts" / f"{code}.json").read_text(encoding="utf-8"))
    erreurs, ids = [], set()
    for nom, e in script["ecrans"].items():
        if e.get("type") not in TYPES:
            erreurs.append(f"écran {nom} : type inconnu {e.get('type')!r}")
        if not e.get("kicker"):
            erreurs.append(f"écran {nom} : kicker manquant")
    for p in script["phrases"]:
        if p["id"] in ids:
            erreurs.append(f"identifiant de phrase en double : {p['id']}")
        ids.add(p["id"])
        if p["ecran"] not in script["ecrans"]:
            erreurs.append(f"phrase {p['id']} : écran {p['ecran']!r} absent")
        if not p.get("texte"):
            erreurs.append(f"phrase {p['id']} : texte vide")
        # Écriture compacte : sans `dit`, la voix lit le texte de la bande ; pause de 0,7 s par défaut.
        p.setdefault("dit", p.get("texte", ""))
        p.setdefault("pause_apres", 0.7)
    if erreurs:
        sys.exit("Script invalide :\n  " + "\n  ".join(erreurs))
    appliquer_vues(script)
    duree = sum(len(p["dit"]) for p in script["phrases"]) / CARACTERES_PAR_SECONDE
    duree += sum(p.get("pause_apres", 0) for p in script["phrases"])
    print(f"{len(script['phrases'])} phrases, durée estimée {round(duree)} s", flush=True)
    return script


def appliquer_vues(script):
    """Écriture compacte : un écran est décrit une fois dans son état final, et chaque phrase dit
    ce qu'elle en montre par un champ `vue`. La phrase reçoit alors son propre écran dérivé.
      dialogue  : {"montre": n}            n premières bulles ; {"aparte": false} masque l'aparté
      question  : {"options": false}       question seule ; {"juge": ["A", "C"]} verdicts déjà rendus
                                           (les autres options restent neutres, sans raison ni surlignage)
      recap     : {"jusqu": n}             les points après le n-ième sont estompés et sans surlignage
      structure : {"faibles": [i, ...]}    lignes estompées (index à partir de 0)
    Sans `vue`, l'écran est montré tel quel."""
    def nu(texte):
        return texte.replace("**", "").replace("__", "")

    for p in script["phrases"]:
        vue = p.get("vue")
        if not vue:
            continue
        e = json.loads(json.dumps(script["ecrans"][p["ecran"]]))
        if e["type"] == "dialogue":
            if "montre" in vue:
                e["bulles"] = e["bulles"][:vue["montre"]]
            if vue.get("aparte") is False:
                e.pop("aparte", None)
        elif e["type"] == "question":
            if vue.get("options") is False:
                e["options"] = [{"lettre": o["lettre"], "texte": "", "etat": "cache"} for o in e["options"]]
            else:
                juges = vue.get("juge", [])
                e["options"] = [o if o["lettre"] in juges else {"lettre": o["lettre"], "texte": nu(o["texte"])}
                                for o in e["options"]]
        elif e["type"] == "recap":
            n = vue.get("jusqu", len(e["etapes"]))
            e["etapes"] = [x if i < n else {"texte": nu(x["texte"] if isinstance(x, dict) else x), "faible": True}
                           for i, x in enumerate(e["etapes"])]
        elif e["type"] == "structure":
            for i in vue.get("faibles", []):
                e["lignes"][i]["faible"] = True
        cle = f"{p['ecran']}#{p['id']}"
        script["ecrans"][cle] = e
        p["ecran"] = cle


def charger_modele():
    import torch
    from omnivoice import OmniVoice
    return OmniVoice.from_pretrained("k2-fsa/OmniVoice", device_map="cpu", dtype=torch.float32)


def config(etapes=ETAPES):
    from omnivoice.models.omnivoice import OmniVoiceGenerationConfig
    return OmniVoiceGenerationConfig(num_step=etapes)


def creer_reference():
    import soundfile as sf
    if REF_AUDIO.exists():
        print(f"référence déjà présente : {REF_AUDIO}")
        return
    REF_AUDIO.parent.mkdir(parents=True, exist_ok=True)
    modele = charger_modele()
    # La référence n'est générée qu'une fois : 32 pas, pour un timbre propre.
    audio = modele.generate(text=REF_TEXTE, language="en", instruct=REF_CONSIGNE, generation_config=config(32))[0]
    sf.write(str(REF_AUDIO), audio, 24000)
    print(f"référence écrite : {REF_AUDIO} ({len(audio) / 24000:.1f} s)")


def voix(code):
    import soundfile as sf
    script = lire_script(code)
    segs = travail(code) / "seg"
    manquants = [p for p in script["phrases"] if not (segs / f"{p['id']}.wav").exists()]
    print(f"voix : {len(script['phrases']) - len(manquants)} clips présents, {len(manquants)} à générer", flush=True)
    if not manquants:
        return
    if not REF_AUDIO.exists():
        sys.exit("Voix de référence absente : lancer d'abord `python lancer_toeic.py ref`.")
    modele = charger_modele()
    prompt = modele.create_voice_clone_prompt(ref_audio=str(REF_AUDIO), ref_text=REF_TEXTE)
    for p in manquants:
        t0 = time.time()
        audio = modele.generate(text=p["dit"], language="en", voice_clone_prompt=prompt,
                                speed=VITESSE, generation_config=config())[0]
        tmp = segs / f"{p['id']}.part"
        sf.write(str(tmp), audio, 24000, format="WAV")
        tmp.replace(segs / f"{p['id']}.wav")  # écriture atomique : reprise sûre après un arrêt
        print(f"voix {p['id']} : {len(audio) / 24000:.1f} s en {time.time() - t0:.0f} s", flush=True)


def preparer_gabarit(dossier, donnees):
    shutil.copy(GABARIT, dossier / "toeic-16x9.html")
    shutil.copy(LOGO, dossier / "logo-symbole.svg")
    if not (dossier / "fontsource").exists():
        shutil.copytree(POLICES, dossier / "fontsource")
    (dossier / "rendu.js").write_text("window.DONNEES = " + json.dumps(donnees, ensure_ascii=False) + ";",
                                      encoding="utf-8")


def capturer(dossier, n):
    """Une capture 1920x1080 par sous-titre, par Chromium en ligne de commande."""
    images = dossier / "images"
    images.mkdir(exist_ok=True)
    page = (dossier / "toeic-16x9.html").as_uri()
    for i in range(n):
        png = images / f"{i:02d}.png"
        bac = ["--no-sandbox"] if os.environ.get("CHAINE_SANS_BAC") == "1" else []  # runner CI
        subprocess.run([chrome(), "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", *bac,
                        "--force-device-scale-factor=1", "--window-size=1920,1080", "--allow-file-access-from-files",
                        "--virtual-time-budget=4000", f"--screenshot={png}", f"{page}?i={i}"],
                       check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return images


def debordements(images, n):
    """Le gabarit entoure de rouge (#E11D48) un écran qui déborde : on lit le pixel du coin de chaque capture."""
    fautifs = []
    for i in range(n):
        px = subprocess.run(["ffmpeg", "-v", "error", "-i", str(images / f"{i:02d}.png"), "-vf", "crop=1:1:4:4",
                             "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], check=True, capture_output=True).stdout
        if px[:3] == bytes([0xE1, 0x1D, 0x48]):
            fautifs.append(i)
    return fautifs


def ecrans(code):
    """Contrôle visuel sans voix : toutes les captures et une planche de contact."""
    script = lire_script(code)
    d = travail(code)
    sous = [{"t0": 0, "ecran": p["ecran"], "texte": p["texte"]} for p in script["phrases"]]
    preparer_gabarit(d, {"partie": script["partie"], "ecrans": script["ecrans"], "sous_titres": sous})
    images = capturer(d, len(sous))
    final = ICI / "sorties" / code
    final.mkdir(parents=True, exist_ok=True)
    colonnes = 4
    lignes = -(-len(sous) // colonnes)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-framerate", "1", "-i", "%02d.png", "-frames:v", "1",
                    "-vf", f"scale=640:360,tile={colonnes}x{lignes}:padding=8:margin=8:color=0x0A0A0A",
                    str(final / "planche.png")], check=True, cwd=images)
    fautifs = debordements(images, len(sous))
    print(f"planche : {final / 'planche.png'} ; captures : {images}")
    print("DEBORDEMENT aux phrases : " + ", ".join(script["phrases"][i]["id"] for i in fautifs) if fautifs
          else "aucun débordement")


def silence(duree, fichier):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono",
                    "-t", str(duree), str(fichier)], check=True)


def horodatage(t):
    return f"{int(t // 3600):02d}:{int(t % 3600 // 60):02d}:{t % 60:06.3f}"


def monter(code):
    import soundfile as sf
    script = lire_script(code)
    d = travail(code)
    segs = d / "seg"
    absents = [p["id"] for p in script["phrases"] if not (segs / f"{p['id']}.wav").exists()]
    if absents:
        sys.exit(f"Clips absents ({', '.join(absents)}) : lancer `voix {code}`.")
    # Chronologie : voix + pauses ; chaque écran change un peu avant la phrase qui le décrit.
    silence(LEAD, d / "lead.wav")
    morceaux, sous, t = ["lead.wav"], [], LEAD
    for p in script["phrases"]:
        duree = sf.info(str(segs / f"{p['id']}.wav")).duration
        sous.append({"t0": round(t - DECALAGE_ECRAN, 3) if sous else 0.0, "ecran": p["ecran"], "texte": p["texte"]})
        morceaux.append(f"seg/{p['id']}.wav")
        pause = p.get("pause_apres", 0)
        if pause > 0:
            silence(pause, d / f"sil-{p['id']}.wav")
            morceaux.append(f"sil-{p['id']}.wav")
        t += duree + pause
    total = round(t, 3)
    (d / "audio.txt").write_text("".join(f"file '{m}'\n" for m in morceaux), encoding="utf-8")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", "audio.txt",
                    "-ar", "24000", "-ac", "1", "voix.wav"], check=True, cwd=d)
    preparer_gabarit(d, {"partie": script["partie"], "ecrans": script["ecrans"], "sous_titres": sous})
    fautifs = debordements(capturer(d, len(sous)), len(sous))
    if fautifs:
        sys.exit("Texte qui déborde aux phrases : " + ", ".join(script["phrases"][i]["id"] for i in fautifs))
    fins = [c["t0"] for c in sous[1:]] + [total]
    lignes = "".join(f"file 'images/{i:02d}.png'\nduration {fin - c['t0']:.3f}\n" for i, (c, fin) in enumerate(zip(sous, fins)))
    (d / "images.txt").write_text(lignes + f"file 'images/{len(sous) - 1:02d}.png'\n", encoding="utf-8")
    final = ICI / "sorties" / code
    final.mkdir(parents=True, exist_ok=True)
    hd = final / f"notion-{code}-1080.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", "images.txt", "-i", "voix.wav",
                    "-vf", "fps=30,format=yuv420p", "-c:v", "libx264", "-preset", "medium", "-crf", "21",
                    "-c:a", "aac", "-b:a", "128k", "-shortest", "-movflags", "+faststart", str(hd)], check=True, cwd=d)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(hd), "-vf", "scale=1280:720", "-c:v", "libx264",
                    "-crf", "27", "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart",
                    str(final / f"notion-{code}-720.mp4")], check=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(d / "images" / "00.png"), "-vf", "scale=1280:720",
                    "-q:v", "3", str(final / "miniature.jpg")], check=True)
    (final / "meta.json").write_text(json.dumps({"code": code, "titre": script["titre"], "partie": script["partie"],
                                                 "duree": round(total), "phrases": len(sous)}, ensure_ascii=False),
                                     encoding="utf-8")
    vtt = "WEBVTT\n\n" + "".join(f"{horodatage(c['t0'])} --> {horodatage(fin)}\n{c['texte']}\n\n" for c, fin in zip(sous, fins))
    (final / "sous-titres.vtt").write_text(vtt, encoding="utf-8")
    print(f"vidéo : {hd} ({total} s)")


BUCKET = "elearnprepa-public"  # jamais « elearnprepa » (même règle que toeic-audio/generer.py)
BASE_PUBLIQUE = "https://pub-b05c9f45ef884ab2aa345a5763751590.r2.dev"
FICHIERS_PUBLIES = {"video-720.mp4": ("notion-{code}-720.mp4", "video/mp4"),
                    "video-1080.mp4": ("notion-{code}-1080.mp4", "video/mp4"),
                    "miniature.jpg": ("miniature.jpg", "image/jpeg"),
                    "sous-titres.vtt": ("sous-titres.vtt", "text/vtt"),
                    "meta.json": ("meta.json", "application/json")}


def aws(*args, check=True):
    return subprocess.run(["aws", *args, "--endpoint-url", os.environ["R2_ENDPOINT"]], check=check,
                          capture_output=True, text=True)


def deja_publie(code):
    return aws("s3api", "head-object", "--bucket", BUCKET, "--key", f"toeic/videos/{code}/meta.json",
               check=False).returncode == 0


def publier(code):
    """Envoie la vidéo d'une notion sur R2 : toeic/videos/<code>/video-720.mp4, video-1080.mp4,
    miniature.jpg, sous-titres.vtt, puis meta.json en dernier (sa présence vaut « publié »)."""
    final = ICI / "sorties" / code
    for cle, (nom, type_mime) in FICHIERS_PUBLIES.items():
        aws("s3", "cp", str(final / nom.format(code=code)), f"s3://{BUCKET}/toeic/videos/{code}/{cle}",
            "--content-type", type_mime, "--only-show-errors")
    print(f"publié : {BASE_PUBLIQUE}/toeic/videos/{code}/video-720.mp4")


def main(argv):
    if argv and argv[0] == "publier":
        return publier(argv[1])
    if argv and argv[0] == "deja":
        sys.exit(0 if deja_publie(argv[1]) else 1)
    if not argv or argv[0] not in {"ref", "ecrans", "voix", "monter"}:
        sys.exit(__doc__)
    if argv[0] == "ref":
        creer_reference()
    else:
        {"ecrans": ecrans, "voix": voix, "monter": monter}[argv[0]](argv[1])


if __name__ == "__main__":
    main(sys.argv[1:])
