#!/usr/bin/env python3
"""Chaîne vidéo de cours, en une commande : cours de la base -> leçons -> script -> voix -> vidéo 16:9.

Usage :
  python lancer.py <courseId>            # tout : extraction si besoin, voix, rendu
  python lancer.py extraire <courseId>   # seulement lire les leçons (écrit lecons.txt pour rédiger le script)

Le script (scripts/<courseId>.json) est la seule étape rédigée à la main, à partir de lecons.txt.
Tout le reste est automatique et reprend là où il s'est arrêté (voix déjà générée non refaite).

Variables d'environnement (lecture seule, jamais écrites dans un fichier) :
  CHAINE_SUPABASE_URL   https://<projet>.supabase.co
  CHAINE_SUPABASE_KEY   clé publishable ou anon de lecture
  CHAINE_CHROME         chemin du binaire Chromium (défaut : /opt/pw-browsers/…)
  CHAINE_TRAVAIL        dossier de travail (défaut : /tmp/chaine-cours)

Usage CI (GitHub Actions, voir .github/workflows/video-cours.yml) :
  python lancer.py voix <courseId> <partie> <total>   # voix des phrases de cette partie seulement
"""
import json
import os
import pathlib
import re
import shutil
import subprocess
import sys
import time
import urllib.parse
import urllib.request

ICI = pathlib.Path(__file__).resolve().parent
PIPE = ICI.parent / "pipeline"
sys.path.insert(0, str(PIPE))
sys.path.insert(0, str(PIPE / "mixte"))
from decode_lecon import decoder  # noqa: E402
from selecteur_scenes import texte_inline  # noqa: E402

# Voix unique de production : la voix initiale de la chaîne (clonage de
# ref-femme-4s.wav). « Homme 1 » a été essayée puis abandonnée sur décision
# de Benny (25/10/2026, 23 h 50) — l'alternance des voix également.
REF_AUDIO = ICI / "voix" / "ref-femme-4s.wav"
REF_TEXTE = "Bonjour à tous, aujourd hui nous allons apprendre à résoudre une équation du second degré."
VITESSE = 0.92
GABARIT = ICI / "gabarit"
CHROME = os.environ.get("CHAINE_CHROME", "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome")
TYPES = {"titre", "formule", "etape", "lignes", "phrase", "recap"}
# Intonation (choix de Benny, 25/10/2026) : débit légèrement plus posé sur les
# écrans qui portent le sens — titres, formules clés, récapitulatifs — et
# naturel ailleurs ; la ponctuation des « dit » fait le reste. Le facteur
# s'applique à la vitesse de base de la voix.
FACTEURS_VITESSE = {"titre": 0.96, "formule": 0.95, "recap": 0.95, "etape": 0.98, "phrase": 1.0, "lignes": 1.0}
ETAPES = 16
LEAD = 0.4
DECALAGE_ECRAN = 0.15
IMAGES_ANIMATION = 12  # images par seconde pour les écrans animés


def sortie(cours):
    return ICI / "sorties" / str(cours)


def lire_api(chemin, params):
    url = os.environ.get("CHAINE_SUPABASE_URL")
    cle = os.environ.get("CHAINE_SUPABASE_KEY")
    if not url or not cle:
        sys.exit("Définir CHAINE_SUPABASE_URL et CHAINE_SUPABASE_KEY (lecture seule).")
    requete = urllib.request.Request(f"{url}/rest/v1/{chemin}?{urllib.parse.urlencode(params)}",
                                     headers={"apikey": cle, "Authorization": f"Bearer {cle}"})
    with urllib.request.urlopen(requete, timeout=60) as r:
        return json.loads(r.read())


def extraire(cours):
    """Lit les leçons du cours (GET seulement), les décode, écrit lecons/ et lecons.txt."""
    dossier = sortie(cours) / "lecons"
    dossier.mkdir(parents=True, exist_ok=True)
    lignes = []
    lecons = lire_api("courses_content", {"select": "id,content_compressed", "courseId": f"eq.{cours}", "order": "id"})
    if not lecons:
        sys.exit(f"Aucune leçon pour le cours {cours}.")
    for lecon in lecons:
        blocs = decoder(lecon["content_compressed"])
        (dossier / f"lecon-{lecon['id']}.json").write_text(json.dumps(blocs, ensure_ascii=False, indent=1))
        lignes.append(f"===== leçon {lecon['id']} ({len(blocs)} blocs)")
        for b in blocs:
            texte = texte_inline(b.get("content")) if b.get("content") is not None else ""
            if b.get("type") and texte.strip():
                lignes.append(f"[{b['type']}] {texte}")
    (sortie(cours) / "lecons.txt").write_text("\n".join(lignes), encoding="utf-8")
    print(f"{len(lecons)} leçons -> {sortie(cours) / 'lecons.txt'}")
    return len(lecons)


CARACTERES_PAR_SECONDE = 17.65  # calibration mesurée sur 5908 (5 576 caractères -> 315,91 s de voix)


def estimer_duree(script):
    """Durée théorique estimée (secondes) d'après les caractères parlés, ponts compris."""
    total = sum(len(p.get("dit", "")) for p in script["phrases"])
    total += sum(len(partie.get("pont", {}).get("dit", "")) for partie in script.get("parties", []))
    return total / CARACTERES_PAR_SECONDE


def parties_attendues(duree):
    """Règle de Benny (25 octobre 2026) : ≤ 4 min -> 1 partie ; > 4 min -> 2 ; > 7 min -> 3."""
    if duree <= 240:
        return 1
    if duree <= 420:
        return 2
    return 3


def phrase_pont(partie, i):
    pont = partie["pont"]
    return {"id": f"pont{i + 1}", "ecran": f"titre-partie-{i + 1}",
            "texte": pont["texte"], "dit": pont["dit"], "pause_apres": 0.7}


def phrases_completes(script):
    """Toutes les phrases à synthétiser, dans l'ordre : celles du script + les phrases-ponts
    des parties 2+, chacune juste avant la première phrase de sa partie."""
    parties = script.get("parties") or []
    if not parties:
        return list(script["phrases"])
    phrases = []
    for i, partie in enumerate(parties):
        if i > 0:
            phrases.append(phrase_pont(partie, i))
        debut = partie["debut"]
        fin = parties[i + 1]["debut"] if i + 1 < len(parties) else None
        ids = [p["id"] for p in script["phrases"]]
        phrases.extend(script["phrases"][ids.index(debut): ids.index(fin) if fin else len(ids)])
    return phrases


def decouper(script):
    """Découpe le script en un sous-script par partie (ou [script] sans champ `parties`).
    Chaque partie reçoit son écran-titre « Partie N » ; la première phrase de la partie 1
    et les phrases-ponts pointent dessus, les autres phrases gardent leur écran."""
    parties = script.get("parties") or []
    if not parties:
        return [script]
    ids = [p["id"] for p in script["phrases"]]
    sous_scripts = []
    for i, partie in enumerate(parties):
        fin = parties[i + 1]["debut"] if i + 1 < len(parties) else None
        phrases = list(script["phrases"][ids.index(partie["debut"]): ids.index(fin) if fin else len(ids)])
        titre_cle = f"titre-partie-{i + 1}"
        if i == 0:
            phrases[0] = dict(phrases[0], ecran=titre_cle)
        else:
            phrases.insert(0, phrase_pont(partie, i))
        ecran_titre = {"type": "titre", "kicker": f"Partie {i + 1}",
                       "titre": script["titre"], "sous": partie["sous_titre"]}
        # L'écran-titre de chaque partie hérite de la figure signature du
        # cours (anim de l'écran « titre » du script) : titre illustré et
        # miniature de la partie alignés (METHODE.md).
        anim_titre = script["ecrans"].get("titre", {}).get("anim")
        if anim_titre:
            ecran_titre["anim"] = anim_titre
        ecrans = {titre_cle: ecran_titre}
        for p in phrases:
            if p["ecran"] != titre_cle:
                ecrans[p["ecran"]] = script["ecrans"][p["ecran"]]
        sous_scripts.append({"titre": f"{script['titre']} — Partie {i + 1}", "matiere": script["matiere"],
                             "cas": script.get("cas", []), "ecrans": ecrans, "phrases": phrases})
    return sous_scripts


def valider(script):
    erreurs = []
    ecrans = script.get("ecrans", {})
    cles_requises = {"titre": ("kicker", "titre", "sous"), "phrase": ("kicker", "texte"),
                     "formule": ("kicker", "tex"), "etape": ("kicker", "tex"),
                     "lignes": ("kicker", "tex"), "recap": ("kicker", "etapes")}
    for nom, e in ecrans.items():
        if e.get("type") not in TYPES:
            erreurs.append(f"écran {nom} : type inconnu {e.get('type')!r}")
            continue
        for cle in cles_requises.get(e["type"], ()):
            if not e.get(cle):
                erreurs.append(f"écran {nom} ({e['type']}) : clé {cle!r} manquante ou vide (format du gabarit)")
        anim = e.get("anim") or {}
        if anim.get("nom"):
            gabarit_html = (GABARIT / "lecon-16x9.html")
            if gabarit_html.exists():
                noms = set(re.findall(r"^\s{2}(\w+)\(t(?:, o)?\) \{",
                                      gabarit_html.read_text(encoding="utf-8"), re.M))
                if anim["nom"] not in noms:
                    erreurs.append(f"écran {nom} : animation {anim['nom']!r} absente du gabarit "
                                   f"(disponibles : {', '.join(sorted(noms))})")
    ids = set()
    for p in script["phrases"]:
        if p["id"] in ids:
            erreurs.append(f"identifiant de phrase en double : {p['id']}")
        ids.add(p["id"])
        if p["ecran"] not in ecrans:
            erreurs.append(f"phrase {p['id']} : écran {p['ecran']!r} absent")
        if not p.get("dit"):
            erreurs.append(f"phrase {p['id']} : texte parlé vide")
    parties = script.get("parties") or []
    if parties:
        if parties[0].get("debut") != script["phrases"][0]["id"]:
            erreurs.append("parties : la première partie doit commencer à la première phrase")
        positions = []
        for i, partie in enumerate(parties):
            if partie.get("debut") not in ids:
                erreurs.append(f"parties : début {partie.get('debut')!r} absent des phrases")
            else:
                positions.append([p["id"] for p in script["phrases"]].index(partie["debut"]))
            if not partie.get("sous_titre"):
                erreurs.append(f"parties : sous-titre manquant pour la partie {i + 1}")
            if i > 0:
                pont = partie.get("pont") or {}
                if not pont.get("texte") or not pont.get("dit"):
                    erreurs.append(f"parties : phrase-pont (texte + dit) manquante pour la partie {i + 1}")
        if positions != sorted(positions):
            erreurs.append("parties : les débuts doivent être dans l'ordre des phrases")
    if erreurs:
        sys.exit("Script invalide :\n  " + "\n  ".join(erreurs))
    duree = estimer_duree(script)
    attendues = parties_attendues(duree)
    declarees = len(parties) or 1
    print(f"durée estimée : {round(duree)} s -> {attendues} partie(s) attendue(s), {declarees} déclarée(s)")
    if attendues != declarees:
        print("ATTENTION : le nombre de parties déclarées ne suit pas la règle de découpage (voir METHODE.md)")
    # Audit visuel (règle de Benny : jamais « juste du texte et une voix ») :
    # un écran a un visuel s'il porte une animation/figure ou une carte KaTeX
    # (formule, etape). Les écrans titre sont des enchaînements, hors audit.
    sans_visuel = []
    for p in script["phrases"]:
        e = ecrans.get(p["ecran"], {})
        if e.get("type") in ("titre", "formule", "etape"):
            continue
        if not (e.get("anim") or {}).get("nom"):
            sans_visuel.append(f"{p['id']} ({p['ecran']})")
    if sans_visuel:
        print(f"AUDIT VISUEL : {len(sans_visuel)} écran(s) sans visuel ni carte : "
              + ", ".join(sans_visuel)
              + " — ajouter une figure (METHODE.md) ou assumer un écran d'enchaînement.")
    else:
        print("AUDIT VISUEL : tous les écrans ont un visuel ou une carte.")


def voix(script, dossier):
    """Une génération OmniVoice par phrase, réglages du 16:9 validé. Reprise : les clips existants ne sont pas refaits.
    Les imports lourds (torch, OmniVoice) ne se font que s'il manque des clips : un poste
    qui ne fait que le montage peut donc tourner sans torch installé."""
    segs = dossier / "seg"
    segs.mkdir(exist_ok=True)
    manquants = [p for p in script["phrases"] if not (segs / f"{p['id']}.wav").exists()]
    presents = len(script["phrases"]) - len(manquants)
    print(f"voix : {presents} clips présents, {len(manquants)} à générer"
          + (f" ({', '.join(p['id'] for p in manquants)})" if manquants else ""), flush=True)
    if not manquants:
        return
    from omnivoice import OmniVoice
    import soundfile as sf
    import torch
    modele = OmniVoice.from_pretrained("k2-fsa/OmniVoice", device_map="cpu", dtype=torch.float32)
    for p in manquants:
        cle_ecran = p["ecran"]
        if cle_ecran.startswith("titre-partie"):
            type_ecran = "titre"
        else:
            type_ecran = script["ecrans"].get(cle_ecran, {}).get("type", "phrase")
        a = modele.generate(text=p["dit"], ref_audio=str(REF_AUDIO), ref_text=REF_TEXTE,
                            num_step=ETAPES, speed=VITESSE * FACTEURS_VITESSE.get(type_ecran, 1.0))[0]
        sf.write(str(segs / f"{p['id']}.wav"), a, 24000)
        print("voix", p["id"], flush=True)


def monter(script, dossier):
    """Chronologie d'après les durées mesurées : voix + pauses, sous-titres et écrans calés."""
    import soundfile as sf

    segs = dossier / "seg"
    parts, sous, t = [], [], LEAD
    lead = dossier / "lead.wav"
    silence(LEAD, lead)
    parts.append(lead)
    for p in script["phrases"]:
        wav = segs / f"{p['id']}.wav"
        duree = sf.info(str(wav)).duration
        sous.append({"t0": round(t - DECALAGE_ECRAN, 3) if sous else 0.0, "ecran": p["ecran"], "texte": p["texte"]})
        parts.append(wav)
        if p.get("pause_apres", 0) > 0:
            sil = dossier / f"sil-{p['id']}.wav"
            silence(p["pause_apres"], sil)
            parts.append(sil)
        t += duree + p.get("pause_apres", 0)
    lst = dossier / "list.txt"
    lst.write_text("".join(f"file '{x}'\n" for x in parts))
    wav = dossier / "voix.wav"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(lst),
                    "-ar", "24000", "-ac", "1", str(wav)], check=True)
    data = {"titre": script["titre"], "matiere": script["matiere"], "cas": [], "ecrans": script["ecrans"],
            "sous_titres": sous, "audio": str(wav), "audio_duree": round(t, 3)}
    (dossier / "rendu.json").write_text(json.dumps(data, ensure_ascii=False, indent=1))
    return round(t, 2)


def silence(duree, fichier):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono",
                    "-t", str(duree), str(fichier)], check=True)


def rendre(dossier, cours):
    """Chromium capture un écran par phrase, ffmpeg monte le MP4 (16:9, clair)."""
    from playwright.sync_api import sync_playwright

    data = json.loads((dossier / "rendu.json").read_text())
    caps = data["sous_titres"]
    fins = [c["t0"] for c in caps[1:]] + [data["audio_duree"]]
    frames = dossier / "frames"
    frames.mkdir(exist_ok=True)
    modules = dossier / "node_modules"
    if not modules.exists():
        shutil.copytree(PIPE / "gabarits" / "ressources" / "node_modules", modules)
    gabarit = dossier / "lecon-16x9.html"
    gabarit.write_text((GABARIT / "lecon-16x9.html").read_text())
    (dossier / "logo-symbole.svg").write_bytes((GABARIT / "logo-symbole.svg").read_bytes())
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=CHROME, args=["--allow-file-access-from-files"])
        pg = b.new_page(viewport={"width": 1920, "height": 1080})
        pg.goto(gabarit.as_uri() + "?theme=clair")
        pg.evaluate("d => window.charger(d)", data)
        concat = []
        for i, c in enumerate(caps):
            pg.evaluate("i => window.afficher(i)", i)
            pg.evaluate("() => document.fonts.ready")
            duree = fins[i] - c["t0"]
            anime = bool(data["ecrans"][c["ecran"]].get("anim"))
            if anime:
                pg.evaluate("t => window.animer(t)", 0)
            if pg.evaluate("() => window.chevauchement()"):
                print("ATTENTION : texte qui déborde à l'écran", i, flush=True)
            if anime:
                n = max(1, round(duree * IMAGES_ANIMATION))
                for k in range(n):
                    pg.evaluate("t => window.animer(t)", k / n * duree)
                    f = frames / f"{i:02d}-{k:03d}.png"
                    pg.locator("#cadre").screenshot(path=str(f))
                    concat.append((f, duree / n))
            else:
                f = frames / f"{i:02d}.png"
                pg.locator("#cadre").screenshot(path=str(f))
                concat.append((f, duree))
        b.close()
    lst = dossier / "frames.txt"
    with open(lst, "w") as fh:
        for f, d in concat:
            fh.write(f"file '{f}'\nduration {d:.3f}\n")
        fh.write(f"file '{concat[-1][0]}'\n")
    mp4 = dossier / f"cours-{cours}-16x9.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(lst),
                    "-i", data["audio"], "-vf", "fps=30,format=yuv420p", "-c:v", "libx264", "-preset", "medium",
                    "-crf", "21", "-c:a", "aac", "-b:a", "128k", "-shortest", "-movflags", "+faststart",
                    str(mp4)], check=True)
    return mp4


def vtt(rendu):
    """Sous-titres de référence (fichier séparé : la bande jaune est déjà incrustée dans la vidéo)."""
    data = json.loads(pathlib.Path(rendu).read_text())
    caps = data["sous_titres"]
    fins = [c["t0"] for c in caps[1:]] + [data["audio_duree"]]

    def ts(t):
        h, m, s = int(t // 3600), int(t % 3600 // 60), t % 60
        return f"{h:02d}:{m:02d}:{s:06.3f}"

    corps = "WEBVTT\n\n" + "".join(f"{ts(c['t0'])} --> {ts(e)}\n{c['texte']}\n\n" for c, e in zip(caps, fins))
    return corps


def dossier_travail(cours):
    return pathlib.Path(os.environ.get("CHAINE_TRAVAIL", "/tmp/chaine-cours")) / str(cours)


def main(argv):
    if not argv:
        sys.exit(__doc__)
    if argv[0] == "extraire":
        extraire(argv[1])
        return
    if argv[0] == "voix":
        # Génère les voix d'une partie des phrases (travail réparti entre machines).
        cours, partie, total = argv[1], int(argv[2]), int(argv[3])
        script = json.loads((ICI / "scripts" / f"{cours}.json").read_text())
        valider(script)
        script["phrases"] = [p for i, p in enumerate(phrases_completes(script)) if i % total == partie]
        travail = dossier_travail(cours)
        travail.mkdir(parents=True, exist_ok=True)
        voix(script, travail)
        print(f"voix partie {partie}/{total} : {len(script['phrases'])} phrases traitées")
        return
    cours = argv[0]
    script_fichier = ICI / "scripts" / f"{cours}.json"
    if not (sortie(cours) / "lecons.txt").exists():
        extraire(cours)
    if not script_fichier.exists():
        sys.exit(f"Script absent : rédiger {script_fichier} à partir de {sortie(cours) / 'lecons.txt'}")
    script = json.loads(script_fichier.read_text())
    valider(script)
    # Le calcul se fait en local (le montage réseau ne gère pas les liens symboliques ni les fichiers lourds) ;
    # seuls les produits finis reviennent dans sorties/<cours>/.
    travail = dossier_travail(cours)
    travail.mkdir(parents=True, exist_ok=True)
    debut = time.time()
    complet = dict(script, phrases=phrases_completes(script))
    voix(complet, travail)
    final = sortie(cours)
    final.mkdir(parents=True, exist_ok=True)
    morceaux = decouper(script)
    for i, morceau in enumerate(morceaux):
        if len(morceaux) == 1:
            pdir, nom, suffixe = travail, str(cours), ""
        else:
            pdir = travail / f"partie-{i + 1}"
            pdir.mkdir(parents=True, exist_ok=True)
            (pdir / "seg").mkdir(exist_ok=True)
            for p in morceau["phrases"]:
                shutil.copy(travail / "seg" / f"{p['id']}.wav", pdir / "seg" / f"{p['id']}.wav")
            nom, suffixe = f"{cours}-partie-{i + 1}", f"-partie-{i + 1}"
        duree = monter(morceau, pdir)
        mp4 = rendre(pdir, nom)
        shutil.copy(pdir / "voix.wav", final / f"voix{suffixe}.wav")
        (final / f"sous-titres{suffixe}.vtt").write_text(vtt(pdir / "rendu.json"))
        shutil.copy(mp4, final / mp4.name)
        print(f"vidéo {final / mp4.name} ({duree} s de voix, {round(time.time() - debut)} s écoulées)")


if __name__ == "__main__":
    main(sys.argv[1:])
