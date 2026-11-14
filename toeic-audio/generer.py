#!/usr/bin/env python3
"""Génère les clips audio TOEIC (OmniVoice, CPU) pour un fichier de jobs et les envoie sur R2.

Usage :
  python generer.py p2_t2_t3                       # jobs/p2_t2_t3.json, tout, envoi R2
  python generer.py t4 --essai 1                   # les N premiers groupes seulement
  python generer.py t4 --forcer                    # régénère même si le fichier est déjà sur R2
  python generer.py t4 --tranche 2/3               # tranche 2 sur 3 (machines en parallèle)
  python generer.py t4 --plan                      # imprime la matrice des tranches (JSON), ne génère rien
  python generer.py t4 --sans-envoi --dossier out  # mp3 en local, rien sur R2

Règles :
  - Bucket R2 : « elearnprepa-public » UNIQUEMENT (le bucket « elearnprepa » est refusé).
  - Aucune écriture en base : les chemins audio sont posés par la migration de contenu.
  - Le modèle n'est chargé qu'une fois ; torch et OmniVoice ne sont importés qu'à ce moment-là.
Variables : AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY (secrets R2), R2_ENDPOINT (facultatif).
"""
import argparse
import hashlib
import json
import math
import os
import re
import subprocess
import sys
import tempfile
import time
from pathlib import Path

ICI = Path(__file__).resolve().parent

BUCKET = "elearnprepa-public"
BUCKET_INTERDIT = "elearnprepa"
ENDPOINT = os.environ.get("R2_ENDPOINT", "https://9ae82bfac632f6d0ed7b452940e13abd.r2.cloudflarestorage.com")
BASE_PUBLIQUE = "https://pub-b05c9f45ef884ab2aa345a5763751590.r2.dev"

SR = 24000                 # fréquence native d'OmniVoice
KBPS = 64                  # mp3 mono 64 kb/s
PAUSE_REPLIQUE = 0.6       # s entre deux répliques
PAUSE_LETTRE = 1.5         # s avant chaque réponse lettrée (A)(B)(C)(D), parties 1 et 2
PAUSE_PHRASE = 0.2         # s entre deux morceaux d'une même réplique longue
SILENCE_FIN = 0.3
MAX_MOTS_MORCEAU = 45      # une réplique plus longue est découpée par phrases
DUREE_MIN_P2 = 6.0         # s : en dessous, le clip est trop court (échec)
DEBIT_CIBLE = 2.5          # mots par seconde de parole
ECART_DEBIT = 0.40         # écart relatif toléré
REF_MIN, REF_MAX = 1.5, 12.0   # durée (s) d'un clip utilisable comme référence de voix
BUDGET_TRANCHE_MIN = 300   # min de CPU par tranche (limite GitHub : 6 h)
RTF_DEFAUT = 8.0           # estimation : secondes de CPU par seconde d'audio (à recaler après l'essai)

ACCENTS = ["american"] * 4 + ["british"] * 2 + ["australian", "canadian"]
CODE_ACCENT = {"US": "american", "UK": "british", "AU": "australian", "CA": "canadian"}


# --- Voix --------------------------------------------------------------------------------------
def graine(*parts):
    return int(hashlib.sha256("|".join(parts).encode("utf-8")).hexdigest()[:12], 16)


def description_voix(genre, accent, g):
    """Description OmniVoice (sans clonage) : genre, âge, hauteur, accent. Stable pour une graine donnée."""
    age = ("young adult", "middle-aged")[(g >> 3) & 1]
    hauteurs = ("low pitch", "moderate pitch") if genre == "male" else ("moderate pitch", "high pitch")
    return f"{genre}, {age}, {hauteurs[(g >> 5) & 1]}, {accent} accent"


def lire_etiquette(etiquette):
    """('female'|'male'|None, accent|None) d'après « Woman (UK) », « Speaker (Man (US)) », etc."""
    genre = "female" if re.search(r"\bWoman\b", etiquette) else "male" if re.search(r"\bMan\b", etiquette) else None
    m = re.findall(r"\((US|UK|AU|CA)\)", etiquette)
    return genre, (CODE_ACCENT[m[-1]] if m else None)


def voix_du_groupe(job):
    """{locuteur: description de voix}, stable pour un groupe.

    Partie 1 : une seule voix. Partie 2 : une voix pour la question, une autre pour les trois réponses.
    Parties 3 et 4 : une voix par étiquette de locuteur (homme/femme et accent lus dans l'étiquette)."""
    ref, part = job["ref"], job["part"]
    locuteurs = []
    for loc, _ in job["lignes"]:
        cle = "Response" if loc.startswith("Response") else loc
        if cle not in locuteurs:
            locuteurs.append(cle)
    voix = {}
    if part == 2:
        gq = graine(ref, "question")
        genre_q = ("male", "female")[gq & 1]
        accent_q = ACCENTS[(gq >> 1) % len(ACCENTS)]
        gr = graine(ref, "reponses")
        genre_r = genre_q if gr % 3 == 0 else ("female" if genre_q == "male" else "male")
        accent_r = ACCENTS[(gr >> 2) % len(ACCENTS)]
        if (genre_r, accent_r) == (genre_q, accent_q):
            accent_r = "british" if accent_q != "british" else "american"
        voix["Question"] = description_voix(genre_q, accent_q, gq)
        voix["Response"] = description_voix(genre_r, accent_r, gr)
        return voix
    for loc in locuteurs:
        g = graine(ref, loc)
        genre, accent = lire_etiquette(loc) if part in (3, 4) else (None, None)
        genre = genre or ("male", "female")[g & 1]
        accent = accent or ACCENTS[(g >> 1) % len(ACCENTS)]
        voix[loc] = description_voix(genre, accent, g)
    return voix


# --- Texte lu et assemblage --------------------------------------------------------------------
def nb_mots(texte):
    return len(texte.split())


def texte_lettre(texte):
    """« (A) Some boxes... » -> « A. Some boxes... »."""
    m = re.match(r"^\(([A-D])\)\s*(.*)$", texte.strip(), re.S)
    return f"{m.group(1)}. {m.group(2)}" if m else texte.strip()


def decouper(texte, max_mots=MAX_MOTS_MORCEAU):
    """Découpe une longue réplique en morceaux (fin de phrase) de max_mots mots environ."""
    if nb_mots(texte) <= max_mots:
        return [texte]
    phrases = re.split(r"(?<=[.!?])\s+", texte.strip())
    morceaux, courant = [], []
    for p in phrases:
        if courant and nb_mots(" ".join(courant + [p])) > max_mots:
            morceaux.append(" ".join(courant))
            courant = []
        courant.append(p)
    if courant:
        morceaux.append(" ".join(courant))
    return morceaux


def construire_segments(job):
    """Liste de {loc, texte, pause} : texte à dire, locuteur (clé de voix) et silence AVANT le segment (s)."""
    part = job["part"]
    segments = []
    for i, (loc, texte) in enumerate(job["lignes"]):
        if part == 1:
            cle, dit, pause = loc, texte_lettre(texte), (PAUSE_LETTRE if i else 0.0)
        elif part == 2:
            if loc.startswith("Response"):
                cle, dit, pause = "Response", f"{loc.split()[-1]}. {texte.strip()}", PAUSE_LETTRE
            else:
                cle, dit, pause = "Question", texte.strip(), 0.0
        else:
            cle, dit, pause = loc, texte.strip(), (PAUSE_REPLIQUE if i else 0.0)
        for k, morceau in enumerate(decouper(dit)):
            segments.append({"loc": cle, "texte": morceau, "pause": pause if k == 0 else PAUSE_PHRASE})
    return segments


def assembler(clips, pauses, sr=SR, fin=SILENCE_FIN):
    """Concatène des clips (tableaux 1D) avec un silence (s) avant chacun, plus un silence final."""
    import numpy as np
    morceaux = []
    for clip, pause in zip(clips, pauses):
        if pause > 0:
            morceaux.append(np.zeros(int(round(pause * sr)), dtype=np.float32))
        morceaux.append(np.asarray(clip, dtype=np.float32).reshape(-1))
    if fin > 0:
        morceaux.append(np.zeros(int(round(fin * sr)), dtype=np.float32))
    return np.concatenate(morceaux) if morceaux else np.zeros(0, dtype=np.float32)


# --- Contrôle de durée -------------------------------------------------------------------------
def controler(part, duree, parole, mots):
    """(statut, message, mots par seconde de parole). 'echec' : partie 2 sous 6 s. 'alerte' : débit hors cible."""
    wps = mots / parole if parole > 0 else 0.0
    if part == 2 and duree < DUREE_MIN_P2:
        return "echec", f"partie 2 trop courte ({duree:.1f} s < {DUREE_MIN_P2:.0f} s)", wps
    if abs(wps - DEBIT_CIBLE) / DEBIT_CIBLE > ECART_DEBIT:
        return "alerte", f"débit {wps:.2f} mots/s, cible {DEBIT_CIBLE} (+-{int(ECART_DEBIT * 100)} %)", wps
    return "ok", "", wps


def duree_mini(part, mots):
    """Durée (s) en dessous de laquelle un clip déjà sur R2 est jugé incorrect (reprise)."""
    return DUREE_MIN_P2 if part == 2 else max(4.0, mots / 3.5)


def duree_depuis_taille(octets):
    return octets * 8 / (KBPS * 1000)


# --- Estimation et tranches --------------------------------------------------------------------
def audio_estime(job):
    """Durée audio estimée (s) : parole au débit cible + silences."""
    seg = construire_segments(job)
    return sum(nb_mots(s["texte"]) for s in seg) / DEBIT_CIBLE + sum(s["pause"] for s in seg) + SILENCE_FIN


def decouper_tranches(jobs, n):
    """n tranches contiguës, de charge (durée estimée) équilibrée. Renvoie une liste de n listes de jobs."""
    if n <= 1:
        return [list(jobs)]
    total = sum(audio_estime(j) for j in jobs)
    tranches = [[] for _ in range(n)]
    cumul = 0.0
    for j in jobs:
        d = audio_estime(j)
        k = min(n - 1, int((cumul + d / 2) / total * n))
        tranches[k].append(j)
        cumul += d
    return tranches


def planifier(jobs, rtf=RTF_DEFAUT, budget=BUDGET_TRANCHE_MIN):
    audio = sum(audio_estime(j) for j in jobs)
    cpu_min = audio * rtf / 60 + 5  # +5 min : installation et chargement du modèle
    n = max(1, min(len(jobs), math.ceil(cpu_min / budget))) if jobs else 1
    return {"matrice": [{"i": k + 1, "n": n} for k in range(n)], "groupes": len(jobs),
            "audio_min": round(audio / 60, 1), "cpu_min": round(cpu_min), "tranches": n}


# --- R2 ----------------------------------------------------------------------------------------
def verifier_bucket():
    if BUCKET == BUCKET_INTERDIT or BUCKET != "elearnprepa-public":
        sys.exit(f"bucket refusé : {BUCKET}")


def aws(*args, check=True):
    env = dict(os.environ, AWS_DEFAULT_REGION="auto")
    return subprocess.run(["aws", *args, "--endpoint-url", ENDPOINT], env=env, check=check,
                          capture_output=True, text=True)


def taille_r2(chemin):
    """Taille (octets) du fichier sur R2, ou None s'il est absent."""
    verifier_bucket()
    r = aws("s3api", "head-object", "--bucket", BUCKET, "--key", chemin, check=False)
    if r.returncode != 0:
        return None
    try:
        return int(json.loads(r.stdout)["ContentLength"])
    except (ValueError, KeyError):
        return None


def envoyer_r2(fichier, chemin):
    verifier_bucket()
    aws("s3", "cp", str(fichier), f"s3://{BUCKET}/{chemin}", "--content-type", "audio/mpeg", "--only-show-errors")


# --- Audio -------------------------------------------------------------------------------------
def encoder_mp3(wav, mp3):
    """Volume normalisé (loudnorm), mono, 64 kb/s."""
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav),
                    "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-ac", "1", "-ar", "44100",
                    "-c:a", "libmp3lame", "-b:a", f"{KBPS}k", str(mp3)], check=True)


def duree_mp3(mp3):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                        "-of", "default=nw=1:nk=1", str(mp3)], check=True, capture_output=True, text=True)
    return float(r.stdout.strip())


def charger_modele():
    import torch
    from omnivoice import OmniVoice
    t0 = time.time()
    modele = OmniVoice.from_pretrained("k2-fsa/OmniVoice", device_map="cpu", dtype=torch.float32)
    print(f"[modèle chargé en {time.time() - t0:.0f} s]", flush=True)
    return modele


def synthetiser(modele, segments, voix, etapes, vitesse, reference, tmp):
    """Un clip par segment. La voix d'un locuteur reste stable : après son premier clip utilisable,
    les suivants sont générés avec ce clip comme référence (sinon une description seule donne une voix
    un peu différente à chaque appel)."""
    import numpy as np
    import soundfile as sf
    prompts, clips = {}, []
    for k, seg in enumerate(segments):
        kw = {"text": seg["texte"], "language": "en", "num_step": etapes}
        if vitesse and vitesse != 1.0:
            kw["speed"] = vitesse
        if seg["loc"] in prompts:
            kw["voice_clone_prompt"] = prompts[seg["loc"]]
        else:
            kw["instruct"] = voix[seg["loc"]]
        a = modele.generate(**kw)
        a = np.asarray(a[0] if isinstance(a, list) else a).squeeze()
        clips.append(a)
        d = len(a) / SR
        if reference and seg["loc"] not in prompts and REF_MIN <= d <= REF_MAX:
            ref = Path(tmp) / f"ref{k}.wav"
            sf.write(str(ref), a, SR)
            prompts[seg["loc"]] = modele.create_voice_clone_prompt(ref_audio=str(ref), ref_text=seg["texte"])
    return clips


# --- Traitement d'un groupe --------------------------------------------------------------------
def traiter(job, modele, args, dossier_local):
    segments = construire_segments(job)
    mots = sum(nb_mots(s["texte"]) for s in segments)
    ligne = {"ref": job["ref"], "part": job["part"], "chemin": job["chemin"], "mots": mots}
    voix = voix_du_groupe(job)

    # Reprise : fichier déjà là avec une durée correcte -> sauté.
    if not args.forcer:
        if args.sans_envoi:
            f = dossier_local / f"{job['ref']}.mp3"
            taille = f.stat().st_size if f.exists() else None
        else:
            taille = taille_r2(job["chemin"])
        if taille is not None and duree_depuis_taille(taille) >= duree_mini(job["part"], mots):
            ligne.update(statut="saute", duree=round(duree_depuis_taille(taille), 1), message="déjà présent")
            return ligne

    t0 = time.time()
    import soundfile as sf
    with tempfile.TemporaryDirectory() as tmp:
        for tentative in (1, 2):
            clips = synthetiser(modele, segments, voix, args.etapes, args.vitesse, not args.sans_reference, tmp)
            audio = assembler(clips, [s["pause"] for s in segments])
            wav, mp3 = Path(tmp) / "a.wav", Path(tmp) / "a.mp3"
            sf.write(str(wav), audio, SR)
            encoder_mp3(wav, mp3)
            duree = duree_mp3(mp3)
            parole = sum(len(c) for c in clips) / SR
            statut, message, wps = controler(job["part"], duree, parole, mots)
            if statut != "echec":
                break
            print(f"  {job['ref']} tentative {tentative} : {message}", flush=True)
        ligne.update(duree=round(duree, 1), mots_par_s=round(wps, 2), statut=statut, message=message,
                     voix=voix, generation_s=round(time.time() - t0))
        if statut == "echec":
            return ligne  # rien n'est envoyé
        if args.sans_envoi:
            dossier_local.mkdir(parents=True, exist_ok=True)
            (dossier_local / f"{job['ref']}.mp3").write_bytes(mp3.read_bytes())
        else:
            envoyer_r2(mp3, job["chemin"])
    return ligne


# --- Programme ---------------------------------------------------------------------------------
def chemin_jobs(nom):
    p = Path(nom)
    if p.suffix == ".json" and p.exists():
        return p
    return ICI / "jobs" / f"{nom}.json"


def ecrire_rapport(chemin, lignes):
    chemin.parent.mkdir(parents=True, exist_ok=True)
    tmp = chemin.with_suffix(".part")
    tmp.write_text(json.dumps(lignes, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    tmp.replace(chemin)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("jobs", help="nom (p2_t2_t3, t4...) ou chemin d'un fichier de jobs")
    ap.add_argument("--essai", type=int, default=None, help="ne traite que les N premiers groupes")
    ap.add_argument("--forcer", action="store_true", help="régénère même si le fichier est déjà sur R2")
    ap.add_argument("--tranche", default="1/1", help="i/n : tranche i sur n")
    ap.add_argument("--plan", action="store_true", help="imprime la matrice des tranches (JSON) et s'arrête")
    ap.add_argument("--etapes", type=int, default=16, help="pas de diffusion OmniVoice (16 = valeur de la chaîne vidéo)")
    ap.add_argument("--vitesse", type=float, default=1.0)
    ap.add_argument("--sans-reference", action="store_true", help="description de voix seule, sans clip de référence")
    ap.add_argument("--sans-envoi", action="store_true", help="mp3 en local (--dossier), rien sur R2")
    ap.add_argument("--dossier", default=str(ICI / "sortie"))
    ap.add_argument("--rapport", default=None)
    args = ap.parse_args(argv)

    jobs = json.loads(chemin_jobs(args.jobs).read_text(encoding="utf-8"))
    if args.essai:
        jobs = jobs[:args.essai]
    if args.plan:
        rtf = float(os.environ.get("TOEIC_RTF", RTF_DEFAUT))
        print(json.dumps(planifier(jobs, rtf), ensure_ascii=False))
        return 0

    i, n = (int(x) for x in args.tranche.split("/"))
    jobs = decouper_tranches(jobs, n)[i - 1]
    nom = chemin_jobs(args.jobs).stem
    rapport = Path(args.rapport) if args.rapport else ICI / "rapport" / f"{nom}-{i}sur{n}.json"
    print(f"{nom} tranche {i}/{n} : {len(jobs)} groupes, bucket {BUCKET}"
          + (" (sans envoi)" if args.sans_envoi else ""), flush=True)
    if not args.sans_envoi:
        verifier_bucket()

    lignes = []
    modele = None
    for k, job in enumerate(jobs, 1):
        try:
            if modele is None:
                modele = charger_modele()
            ligne = traiter(job, modele, args, Path(args.dossier))
        except Exception as e:  # un groupe en erreur n'arrête pas le lot
            ligne = {"ref": job["ref"], "part": job["part"], "chemin": job["chemin"], "statut": "erreur",
                     "message": f"{type(e).__name__}: {e}"}
        lignes.append(ligne)
        print(f"[{k}/{len(jobs)}] {ligne['ref']} {ligne['statut']}"
              + (f" {ligne['duree']} s" if "duree" in ligne else "")
              + (f" - {ligne['message']}" if ligne.get("message") else ""), flush=True)
        ecrire_rapport(rapport, lignes)

    bilan = {}
    for l in lignes:
        bilan[l["statut"]] = bilan.get(l["statut"], 0) + 1
    print("bilan :", bilan, "| rapport :", rapport, flush=True)
    return 1 if bilan.get("echec") or bilan.get("erreur") else 0


if __name__ == "__main__":
    sys.exit(main())
