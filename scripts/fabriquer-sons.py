#!/usr/bin/env python3
"""Synthétise les sons de retour de l'app (succes, echec, tap) dans assets/sounds/. Python standard uniquement.
Sons courts (< 400 ms), doux : attaque et extinction en cosinus surélevé (pas de clic), harmoniques légères, pic normalisé à -6 dB."""
import math, struct, wave, pathlib

SR = 44100
SORTIE = pathlib.Path(__file__).resolve().parent.parent / 'assets' / 'sounds'

def note(freq, duree, attaque=0.008, extinction=0.12, harmoniques=((1, 1.0), (2, 0.25), (3, 0.08))):
    n = int(SR * duree)
    out = []
    for i in range(n):
        t = i / SR
        env = 1.0
        if t < attaque:
            env = 0.5 - 0.5 * math.cos(math.pi * t / attaque)
        reste = duree - t
        if reste < extinction:
            env *= 0.5 - 0.5 * math.cos(math.pi * reste / extinction)
        out.append(env * sum(a * math.sin(2 * math.pi * freq * h * t) for h, a in harmoniques))
    return out

def melange(pistes):
    total = max(d + len(p) for d, p in pistes)
    out = [0.0] * total
    for d, p in pistes:
        for i, v in enumerate(p):
            out[d + i] += v
    return out

def ecrire(nom, echantillons):
    pic = max(abs(v) for v in echantillons) or 1
    gain = 0.5 / pic  # -6 dB
    with wave.open(str(SORTIE / nom), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(b''.join(struct.pack('<h', int(v * gain * 32767)) for v in echantillons))
    print(nom, round(len(echantillons) / SR * 1000), 'ms')

ms = lambda x: int(SR * x / 1000)
# Succès : deux notes montantes (mi5 -> la5), chaleureuses.
ecrire('succes.wav', melange([(0, note(659.25, 0.16, extinction=0.08)), (ms(110), note(880.0, 0.26, extinction=0.16))]))
# Échec : deux notes descendantes graves et rondes, sans dureté (sinus quasi pur).
ecrire('echec.wav', melange([(0, note(311.13, 0.16, extinction=0.08, harmoniques=((1, 1.0), (2, 0.1)))), (ms(120), note(233.08, 0.26, extinction=0.16, harmoniques=((1, 1.0), (2, 0.1))))]))
# Tap : très bref, doux.
ecrire('tap.wav', note(1046.5, 0.05, attaque=0.006, extinction=0.03, harmoniques=((1, 1.0), (2, 0.15))))
# Récompense : trois notes montantes (do5, mi5, sol5), un peu plus brillantes.
ecrire('recompense.wav', melange([(0, note(523.25, 0.12, extinction=0.06)), (ms(80), note(659.25, 0.12, extinction=0.06)), (ms(160), note(783.99, 0.22, extinction=0.14))]))
# Célébration : arpège do5 mi5 sol5 do6, plus long (toujours < 400 ms).
ecrire('celebration.wav', melange([(ms(i * 70), note(f, 0.12 if i < 3 else 0.12, extinction=0.07 if i < 3 else 0.06)) for i, f in enumerate((523.25, 659.25, 783.99, 1046.5))]))
