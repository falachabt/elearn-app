"""Chaîne en une commande à partir du résumé d'un cours (description + objectifs), pas du texte détaillé.

Usage : python chaine_resume.py <cours.json> <dossier_sortie>
Étapes : résumé -> scènes (titre, phrases, objectifs, à retenir) -> script -> voix OmniVoice -> vidéo 16:9.
Le rapport (rapport.json) donne, pour chaque étape, si elle est automatique et son temps.
"""
import json
import pathlib
import re
import subprocess
import sys
import tempfile
import time

ICI = pathlib.Path(__file__).resolve().parent
PIPE = ICI.parent
sys.path.insert(0, str(ICI))
sys.path.insert(0, str(PIPE))
from chaine import PAUSE_S, dit, rendre_video  # noqa: E402

CONFIG = PIPE / "config.json"


def phrases_du_resume(cours):
    """Une phrase par scène : la description est découpée en phrases courtes."""
    morceaux = [m.strip() for m in re.split(r"(?<=[.!?])\s+", cours["description"]) if m.strip()]
    return [m if len(m) <= 180 else m[:177].rsplit(" ", 1)[0] + "…" for m in morceaux]


def scenes_du_cours(cours):
    scenes = [("titre", {"titre": cours["name"]})]
    scenes += [("phrase", {"texte": t}) for t in phrases_du_resume(cours)]
    scenes.append(("points-cles", {"points": cours["goals"]}))
    scenes.append(("recap", {"etapes": cours["goals"]}))
    return scenes


from resume_vers_scenes import scenes_du_resume  # noqa: E402


def main(cours_json, dossier):
    dossier = pathlib.Path(dossier)
    dossier.mkdir(parents=True, exist_ok=True)
    cours = json.loads(pathlib.Path(cours_json).read_text(encoding="utf-8"))
    rapport = {"etapes": {}}
    t0 = time.time()
    if "blocs" in cours:
        scenes = scenes_du_resume(cours)
        source = "resume stocke (course_summaries.content)"
    else:
        scenes = scenes_du_cours(cours)
        source = "description (secours, a ne pas utiliser)"

    types = sorted({s for s, _ in scenes})
    rapport["etapes"]["selection"] = {"auto": True, "secondes": round(time.time() - t0, 2),
                                      "scenes": len(scenes), "types": types, "source": source}
    t0 = time.time()
    phrases, a_relire = [], 0
    for k, (scene, params) in enumerate(scenes):
        texte, nf = dit(scene, params)
        a_relire += nf
        phrases.append({"id": f"c{k:03d}", "scene": scene, "dit": texte, "params": params})
    rapport["etapes"]["script"] = {"auto": True, "secondes": round(time.time() - t0, 2), "formules_a_relire": a_relire}
    (dossier / "script.json").write_text(json.dumps(phrases, ensure_ascii=False, indent=1), encoding="utf-8")
    t0 = time.time()
    from generer_voix import generer
    config = json.loads(CONFIG.read_text(encoding="utf-8"))
    durees_voix = generer({"phrases": phrases}, dossier, config)
    rapport["etapes"]["voix"] = {"auto": True, "secondes": round(time.time() - t0, 2), "clips": len(durees_voix),
                                 "reglage": {"num_step": config["voix"]["etapes_diffusion"], "speed": config["voix"]["vitesse"]}}
    durees = [durees_voix[ph["id"]] + PAUSE_S for ph in phrases]
    audio = dossier / "audio.wav"
    with tempfile.TemporaryDirectory() as tmp:
        tmp = pathlib.Path(tmp)
        liste = tmp / "a.txt"
        morceaux = []
        for ph in phrases:
            morceaux.append(f"file '{dossier / 'voix' / (ph['id'] + '.wav')}'")
            silence = tmp / f"p_{ph['id']}.wav"
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono",
                            "-t", str(PAUSE_S), str(silence)], check=True)
            morceaux.append(f"file '{silence}'")
        liste.write_text("\n".join(morceaux) + "\n", encoding="utf-8")
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(liste),
                        "-ar", "44100", "-ac", "2", str(audio)], check=True)
        t0 = time.time()
        sortie = dossier / f"cours-{cours.get('id', cours.get('course_id'))}-16x9.mp4"
        rendre_video([(s, p) for s, p in scenes], durees, sortie, audio, tmp, libelle=cours["name"])
        rapport["etapes"]["rendu"] = {"auto": True, "secondes": round(time.time() - t0, 2)}
    rapport["duree_video_s"] = round(sum(durees), 1)
    rapport["sortie"] = str(sortie)
    (dossier / "rapport.json").write_text(json.dumps(rapport, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps(rapport, ensure_ascii=False, indent=1), flush=True)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
