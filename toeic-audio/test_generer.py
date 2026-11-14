"""Tests légers de generer.py (sans modèle ni réseau) : python -m unittest toeic-audio/test_generer.py."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import generer as g  # noqa: E402


def job(part, lignes, ref="t9_p%d_1"):
    return {"ref": ref % part if "%" in ref else ref, "part": part, "chemin": "toeic/t9/audio/x.mp3", "lignes": lignes}


P1 = job(1, [["Speaker", "(A) Boxes are stacked."], ["Speaker", "(B) Workers eat."],
             ["Speaker", "(C) A man reads."], ["Speaker", "(D) A worker adjusts a machine."]])
P2 = job(2, [["Question", "Where is the kitchen?"], ["Response A", "On the second floor."],
             ["Response B", "At twelve."], ["Response C", "Yes, it is ready."]])
P3 = job(3, [["Man (US)", "Hi Sarah."], ["Woman (UK)", "Hello."], ["Man (US)", "Any news?"]])
P4 = job(4, [["Speaker (Woman (AU))", " ".join(["This is a sentence with eight words in it."] * 12)]])


class Segments(unittest.TestCase):
    def test_lettre_parlee(self):
        self.assertEqual(g.texte_lettre("(B) Workers eat."), "B. Workers eat.")
        self.assertEqual(g.texte_lettre("No letter"), "No letter")

    def test_partie1_pauses_et_lettres(self):
        s = g.construire_segments(P1)
        self.assertEqual([x["texte"][:2] for x in s], ["A.", "B.", "C.", "D."])
        self.assertEqual([x["pause"] for x in s], [0.0, 1.5, 1.5, 1.5])
        self.assertEqual({x["loc"] for x in s}, {"Speaker"})

    def test_partie2_question_puis_reponses(self):
        s = g.construire_segments(P2)
        self.assertEqual([x["loc"] for x in s], ["Question", "Response", "Response", "Response"])
        self.assertEqual([x["texte"] for x in s[1:]], ["A. On the second floor.", "B. At twelve.", "C. Yes, it is ready."])
        self.assertEqual([x["pause"] for x in s], [0.0, 1.5, 1.5, 1.5])

    def test_partie3_pause_repliques(self):
        s = g.construire_segments(P3)
        self.assertEqual([x["pause"] for x in s], [0.0, 0.6, 0.6])

    def test_longue_replique_decoupee(self):
        s = g.construire_segments(P4)
        self.assertGreater(len(s), 1)
        self.assertEqual(s[0]["pause"], 0.0)
        self.assertTrue(all(x["pause"] == g.PAUSE_PHRASE for x in s[1:]))
        self.assertTrue(all(g.nb_mots(x["texte"]) <= g.MAX_MOTS_MORCEAU + 5 for x in s))

    def test_assemblage_duree(self):
        import numpy as np
        clips = [np.ones(g.SR, dtype=np.float32), np.ones(g.SR // 2, dtype=np.float32)]
        a = g.assembler(clips, [0.0, 1.5])
        attendu = 1.0 + 1.5 + 0.5 + g.SILENCE_FIN
        self.assertAlmostEqual(len(a) / g.SR, attendu, places=3)
        self.assertEqual(float(a[0]), 1.0)
        self.assertEqual(float(a[g.SR + 10]), 0.0)  # silence entre les deux clips


class Voix(unittest.TestCase):
    def test_stables(self):
        self.assertEqual(g.voix_du_groupe(P2), g.voix_du_groupe(dict(P2)))
        self.assertEqual(g.voix_du_groupe(P3), g.voix_du_groupe(P3))

    def test_partie1_une_seule_voix(self):
        self.assertEqual(list(g.voix_du_groupe(P1)), ["Speaker"])

    def test_partie2_deux_voix_differentes(self):
        for n in range(60):
            v = g.voix_du_groupe(job(2, P2["lignes"], ref=f"t2_p2_{n}"))
            self.assertEqual(set(v), {"Question", "Response"})
            self.assertNotEqual(v["Question"], v["Response"])

    def test_partie3_genre_et_accent_de_l_etiquette(self):
        v = g.voix_du_groupe(P3)
        self.assertTrue(v["Man (US)"].startswith("male") and v["Man (US)"].endswith("american accent"))
        self.assertTrue(v["Woman (UK)"].startswith("female") and v["Woman (UK)"].endswith("british accent"))

    def test_partie4_etiquette_speaker(self):
        v = g.voix_du_groupe(P4)
        (desc,) = v.values()
        self.assertTrue(desc.startswith("female") and "australian accent" in desc)

    def test_lire_etiquette(self):
        self.assertEqual(g.lire_etiquette("Speaker (Man (UK))"), ("male", "british"))
        self.assertEqual(g.lire_etiquette("Woman (US)"), ("female", "american"))
        self.assertEqual(g.lire_etiquette("Speaker"), (None, None))

    def test_diversite_accents_et_genres(self):
        descs = {g.voix_du_groupe(job(2, P2["lignes"], ref=f"t2_p2_{n}"))["Question"] for n in range(60)}
        self.assertTrue(any("british" in d for d in descs) and any("female" in d for d in descs))
        self.assertTrue(any("male," in d for d in descs) and any("australian" in d or "canadian" in d for d in descs))


class Controle(unittest.TestCase):
    def test_partie2_trop_courte(self):
        self.assertEqual(g.controler(2, 5.9, 4.0, 10)[0], "echec")
        self.assertEqual(g.controler(2, 6.0, 4.0, 10)[0], "ok")

    def test_debit(self):
        self.assertEqual(g.controler(3, 20, 10.0, 25)[0], "ok")        # 2,5 mots/s
        self.assertEqual(g.controler(3, 20, 10.0, 36)[0], "alerte")    # 3,6 > 3,5
        self.assertEqual(g.controler(3, 20, 10.0, 14)[0], "alerte")    # 1,4 < 1,5
        self.assertEqual(g.controler(3, 20, 10.0, 15)[0], "ok")

    def test_reprise_duree_depuis_taille(self):
        self.assertAlmostEqual(g.duree_depuis_taille(8000), 1.0)       # 64 kb/s = 8000 octets/s
        self.assertEqual(g.duree_mini(2, 30), 6.0)
        self.assertGreaterEqual(g.duree_mini(3, 300), 80)


class Planification(unittest.TestCase):
    def test_petit_fichier_une_tranche(self):
        self.assertEqual(g.planifier([P1, P2, P3])["tranches"], 1)

    def test_gros_fichier_plusieurs_tranches(self):
        p = g.planifier([P4] * 400, rtf=8)
        self.assertGreater(p["tranches"], 1)
        self.assertEqual([m["i"] for m in p["matrice"]], list(range(1, p["tranches"] + 1)))

    def test_tranches_couvrent_tout_dans_l_ordre(self):
        jobs = [job(3, P3["lignes"], ref=f"t9_p3_{n}") for n in range(30)]
        parts = g.decouper_tranches(jobs, 3)
        self.assertEqual(len(parts), 3)
        self.assertEqual([j["ref"] for t in parts for j in t], [j["ref"] for j in jobs])
        self.assertTrue(all(parts))

    def test_bucket_public_seulement(self):
        self.assertEqual(g.BUCKET, "elearnprepa-public")
        g.verifier_bucket()


if __name__ == "__main__":
    unittest.main()
