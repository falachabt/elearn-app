"""Une génération OmniVoice par phrase, reprise après arrêt (les clips déjà faits sont gardés)."""
import json, pathlib, sys, time

def generer(script, sortie, config):
    import torch, soundfile as sf
    from omnivoice import OmniVoice
    dossier = pathlib.Path(sortie) / "voix"; dossier.mkdir(parents=True, exist_ok=True)
    modele = config["voix"]["modeles"][config["voix"]["defaut"]]
    m = OmniVoice.from_pretrained("k2-fsa/OmniVoice", device_map="cpu", dtype=torch.float32)
    durees = {}
    for ph in script["phrases"]:
        f = dossier / f"{ph['id']}.wav"
        if not f.exists():
            t = time.time()
            a = m.generate(text=ph["dit"], ref_audio=modele["ref"], ref_text=modele["ref_texte"],
                           num_step=config["voix"]["etapes_diffusion"], speed=config["voix"]["vitesse"])[0]
            sf.write(str(f), a, 24000)
            print(ph["id"], round(time.time() - t, 1), "s de calcul", flush=True)
        durees[ph["id"]] = round(sf.info(str(f)).duration, 3)
    json.dump(durees, open(pathlib.Path(sortie) / "durees.json", "w"), indent=1)
    return durees

if __name__ == "__main__":
    script = json.load(open(sys.argv[1])); config = json.load(open(sys.argv[2]))
    generer(script, sys.argv[3], config)
