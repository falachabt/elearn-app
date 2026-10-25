#!/usr/bin/env python3
"""Inscrire des vidéos de la chaîne dans public.course_videos, SANS migration.

Décision de Benny (25/10/2026) : plus de migration par lot pour les vidéos ;
les lignes sont insérées directement via PostgREST avec la clé de la chaîne
(secret GitHub CHAINE_SUPABASE_KEY, rôle de service).

Usage : python inscrire_videos.py <fichier-inscriptions.json> [...]
Format d'un fichier : { "<course_id>": {"titre": ..., "parties": [
  {"numero": 1, "titre_video": ..., "duree_s": 199, "filesize": 3721659,
   "url": "https://.../partie-1-720.mp4", "url_1080": "...", "miniature": "..."} ] } }

Semantique (la même que les anciennes migrations, PR elearn-supabase #166-#169) :
- idempotent : un cours dont une URL est déjà inscrite est sauté ;
- les vidéos pré-existantes du cours sont décalées (order_index += nb parties),
  les vidéos de la chaîne prennent la tête (order_index = partie - 1) ;
- status 'ready', mime_type 'video/mp4', métadonnées de provenance.
"""
import json
import os
import sys
import urllib.parse
import urllib.request

URL = os.environ.get("CHAINE_SUPABASE_URL", "").rstrip("/")
CLE = os.environ.get("CHAINE_SUPABASE_KEY", "")


def requete(methode, chemin, params=None, corps=None):
    url = f"{URL}/rest/v1/{chemin}"
    if params:
        url += "?" + urllib.parse.urlencode(params)
    data = json.dumps(corps).encode() if corps is not None else None
    req = urllib.request.Request(url, data=data, method=methode, headers={
        "apikey": CLE,
        "Authorization": f"Bearer {CLE}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    })
    with urllib.request.urlopen(req, timeout=60) as r:
        brut = r.read().decode()
        return json.loads(brut) if brut else []


def inscrire_cours(course_id, bloc):
    parties = sorted(bloc["parties"], key=lambda p: p["numero"])
    urls = [p["url"] for p in parties]
    cours = requete("GET", "courses", {"id": f"eq.{course_id}", "select": "id"})
    if not cours:
        print(f"  cours {course_id} : INTROUVABLE dans courses, sauté")
        return "absent"
    existantes = requete("GET", "course_videos",
                         {"course_id": f"eq.{course_id}", "select": "id,url,order_index"})
    if any(l["url"] in urls for l in existantes):
        print(f"  cours {course_id} : déjà inscrit, sauté")
        return "deja"
    n = len(parties)
    for l in existantes:
        requete("PATCH", "course_videos", {"id": f"eq.{l['id']}"},
                {"order_index": l["order_index"] + n})
    lignes = []
    for p in parties:
        lignes.append({
            "course_id": int(course_id),
            "title": p["titre_video"],
            "filename": p["url"].rsplit("/", 1)[-1],
            "filesize": p["filesize"],
            "duration": int(round(p["duree_s"])),
            "url": p["url"],
            "order_index": p["numero"] - 1,
            "status": "ready",
            "mime_type": "video/mp4",
            "metadata": {
                "source": "chaine-video-cours",
                "bucket": "elearn-videos",
                "partie": p["numero"],
                "url_1080": p["url_1080"],
                "miniature": p["miniature"],
            },
        })
    creees = requete("POST", "course_videos", corps=lignes)
    print(f"  cours {course_id} : {len(creees)} vidéo(s) inscrite(s), "
          f"{len(existantes)} pré-existante(s) décalée(s)")
    return "ok"


def main():
    if not URL or not CLE:
        sys.exit("Définir CHAINE_SUPABASE_URL et CHAINE_SUPABASE_KEY.")
    if len(sys.argv) < 2:
        sys.exit("Usage : inscrire_videos.py <fichier.json> [...]")
    compte = {"ok": 0, "deja": 0, "absent": 0}
    for chemin in sys.argv[1:]:
        print(f"== {chemin}")
        data = json.load(open(chemin, encoding="utf-8"))
        for course_id, bloc in data.items():
            compte[inscrire_cours(course_id, bloc)] += 1
    print(f"BILAN : {compte['ok']} cours inscrits, {compte['deja']} déjà inscrits, "
          f"{compte['absent']} introuvables")


if __name__ == "__main__":
    main()
