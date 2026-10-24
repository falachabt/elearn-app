"""Mode lot : une liste de leçons, reprise après arrêt (chaque étape se saute si son fichier existe).

Usage : python run.py lecons.json config.json
lecons.json : [{"id": "7266", "source": "exports/7266.json", "titre": "..."}]
"""
import json, pathlib, sys
import decode_lecon, lecon_vers_script, generer_voix, monter

HERE = pathlib.Path(__file__).resolve().parent


def traiter(lecon, config):
    sortie = HERE / config["sortie"] / str(lecon["id"])
    sortie.mkdir(parents=True, exist_ok=True)
    script_path = sortie / "script.json"
    if not script_path.exists():
        blocs = decode_lecon.decoder(json.load(open(HERE / lecon["source"])))
        script = lecon_vers_script.script_depuis_blocs(blocs, lecon.get("titre", "Leçon"))
        script["matiere"] = lecon.get("matiere", "")
        json.dump(script, open(script_path, "w"), ensure_ascii=False, indent=1)
    script = json.load(open(script_path))
    if not (sortie / "durees.json").exists():
        generer_voix.generer(script, sortie, config)
    if not (sortie / "manifest.json").exists():
        monter.monter(script_path, HERE / "config.json", sortie)
    return json.load(open(sortie / "manifest.json"))


if __name__ == "__main__":
    lecons = json.load(open(sys.argv[1])); config = json.load(open(sys.argv[2]))
    for l in lecons:
        print(l["id"], traiter(l, config), flush=True)
