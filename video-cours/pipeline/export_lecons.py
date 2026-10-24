"""Export en lecture seule des leçons de la base, décodées, vers exports/.

Ne fait que des requêtes GET sur l'API REST Supabase : aucune écriture,
aucune modification de la base. La clé est lue dans la variable d'environnement
EXPORT_SUPABASE_KEY (jamais écrite dans un fichier ni dans les sorties).

Usage (sur le PC de Benny, depuis le dossier pipeline/) :
  set EXPORT_SUPABASE_URL=https://<projet>.supabase.co
  set EXPORT_SUPABASE_KEY=<clé en lecture>
  python export_lecons.py 7266 7267 ... [--sortie ../exports]

Une sortie par leçon : <sortie>/lecon-<id>.json, avec id, courseId et blocs (décodés).
Les ids sont ceux de la table courses_content.
"""
import argparse
import json
import os
import pathlib
import sys
import urllib.parse
import urllib.request

from decode_lecon import decoder

RACINE = pathlib.Path(__file__).resolve().parent


def lire_lecon(url, cle, lecon_id):
    """Un GET par leçon. Aucune autre méthode HTTP n'est utilisée."""
    params = urllib.parse.urlencode({"select": "*", "id": f"eq.{lecon_id}"})
    requete = urllib.request.Request(
        f"{url.rstrip('/')}/rest/v1/courses_content?{params}",
        headers={"apikey": cle, "Authorization": f"Bearer {cle}", "Accept": "application/json"},
        method="GET",
    )
    with urllib.request.urlopen(requete, timeout=30) as reponse:
        lignes = json.loads(reponse.read().decode("utf-8"))
    return lignes[0] if lignes else None


def exporter(url, cle, ids, sortie):
    sortie.mkdir(parents=True, exist_ok=True)
    bilan = {"ok": [], "absentes": [], "erreurs": []}
    for lecon_id in ids:
        try:
            ligne = lire_lecon(url, cle, lecon_id)
        except Exception as erreur:  # un échec réseau ne doit pas arrêter le lot
            bilan["erreurs"].append({"id": lecon_id, "erreur": type(erreur).__name__})
            continue
        if ligne is None:
            bilan["absentes"].append(lecon_id)
            continue
        contenu = ligne.get("content_compressed")
        blocs = decoder(contenu) if contenu is not None else None
        fichier = sortie / f"lecon-{lecon_id}.json"
        fichier.write_text(
            json.dumps({"id": lecon_id, "courseId": ligne.get("courseId"), "blocs": blocs},
                       ensure_ascii=False, indent=1),
            encoding="utf-8",
        )
        bilan["ok"].append(lecon_id)
    return bilan


def main(argv=None):
    parseur = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parseur.add_argument("ids", nargs="+", help="ids de courses_content à exporter")
    parseur.add_argument("--sortie", default=str(RACINE.parent / "exports"))
    args = parseur.parse_args(argv)
    url = os.environ.get("EXPORT_SUPABASE_URL")
    cle = os.environ.get("EXPORT_SUPABASE_KEY")
    if not url or not cle:
        print("Variables EXPORT_SUPABASE_URL et EXPORT_SUPABASE_KEY requises.", file=sys.stderr)
        return 2
    bilan = exporter(url, cle, args.ids, pathlib.Path(args.sortie))
    print(json.dumps(bilan, ensure_ascii=False))
    return 1 if bilan["erreurs"] else 0


if __name__ == "__main__":
    sys.exit(main())
