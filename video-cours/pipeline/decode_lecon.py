"""Décode une leçon de la base (content_compressed, gzip+shortkeys) ou lit un export JSON déjà décodé.

Format du codec (elearn/src/lib/blocknote-codec.ts) : {"v":1,"f":"gzip+shortkeys","d":"<base64 gzip>"},
les clés courtes t/p/c/s/ch redonnent type/props/content/styles/children. Les ids de blocs sont absents.
Usage : python decode_lecon.py lecon.json > blocs.json
"""
import base64, gzip, json, sys

CLES = {"t": "type", "p": "props", "c": "content", "s": "styles", "ch": "children"}


def developper(n):
    if isinstance(n, list):
        return [developper(x) for x in n]
    if isinstance(n, dict):
        return {CLES.get(k, k): developper(v) for k, v in n.items()}
    return n


def decoder(objet):
    if isinstance(objet, str):
        objet = json.loads(objet)
    if isinstance(objet, dict) and objet.get("f") == "gzip+shortkeys":
        brut = gzip.decompress(base64.b64decode(objet["d"]))
        return developper(json.loads(brut))
    return objet  # déjà décodé


if __name__ == "__main__":
    print(json.dumps(decoder(json.load(open(sys.argv[1]))), ensure_ascii=False, indent=1))
