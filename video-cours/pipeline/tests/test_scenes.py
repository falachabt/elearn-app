"""Tests du registre de scènes et de la validation (étape 1). Lancer : python -m unittest tests/test_scenes.py"""
import unittest, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))
import scenes


class TestValidation(unittest.TestCase):
    def test_scene_statique_valide(self):
        self.assertEqual(scenes.valider_scene({"type": "formule", "params": {"tex": "x^2"}}), [])

    def test_scene_dynamique_valide(self):
        s = {"type": "graphique-parabole", "params": {"a": 1, "b": -4, "c": 3}}
        self.assertEqual(scenes.valider_scene(s), [])

    def test_type_inconnu_refuse(self):
        self.assertTrue(scenes.valider_scene({"type": "inconnu", "params": {}}))

    def test_parametre_manquant_refuse(self):
        erreurs = scenes.valider_scene({"type": "graphique-parabole", "params": {"a": 1, "b": 2}})
        self.assertTrue(any("« c »" in e for e in erreurs))

    def test_mauvais_type_refuse(self):
        erreurs = scenes.valider_scene({"type": "graphique-parabole", "params": {"a": "un", "b": 2, "c": 3}})
        self.assertTrue(any("« a »" in e for e in erreurs))

    def test_script_avec_une_scene_invalide(self):
        script = {"phrases": [{"id": "p001", "scene": {"type": "mouvement-chute", "params": {}}}]}
        ok, erreurs = scenes.valider_script(script)
        self.assertFalse(ok)
        self.assertTrue(erreurs[0].startswith("p001"))

    def test_script_sans_scene_est_valide(self):
        self.assertEqual(scenes.valider_script({"phrases": [{"id": "p001"}]}), (True, []))


if __name__ == "__main__":
    unittest.main()
