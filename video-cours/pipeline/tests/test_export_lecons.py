"""Tests hors réseau de export_lecons : décodage, sorties, clé absente, GET seulement."""
import base64, gzip, json, pathlib, sys, tempfile, unittest
from unittest import mock

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))
import export_lecons as ex  # noqa: E402

PAYLOAD = {"v": 1, "f": "gzip+shortkeys", "d": base64.b64encode(gzip.compress(json.dumps(
    [{"t": "paragraph", "c": [{"t": "text", "text": "Bonjour"}]}]).encode())).decode()}


class FauxReponse:
    def __init__(self, donnees): self.donnees = donnees
    def __enter__(self): return self
    def __exit__(self, *a): return False
    def read(self): return json.dumps(self.donnees).encode()


class TestExport(unittest.TestCase):
    def test_decode_payload_court(self):
        blocs = ex.decoder(PAYLOAD)
        self.assertEqual(blocs[0]["type"], "paragraph")
        self.assertEqual(blocs[0]["content"][0]["text"], "Bonjour")

    def test_export_ecrit_une_sortie_par_lecon(self):
        lignes = {"7266": [{"id": 7266, "courseId": 9, "content_compressed": PAYLOAD}]}
        def faux_urlopen(req, timeout=30):
            self.assertEqual(req.get_method(), "GET")
            lecon = req.full_url.split("eq.")[1].split("&")[0]
            return FauxReponse(lignes.get(lecon, []))
        with tempfile.TemporaryDirectory() as d, mock.patch("urllib.request.urlopen", faux_urlopen):
            bilan = ex.exporter("https://x.supabase.co", "cle", ["7266", "999"], pathlib.Path(d))
            self.assertEqual(bilan["ok"], ["7266"])
            self.assertEqual(bilan["absentes"], ["999"])
            sortie = json.loads((pathlib.Path(d) / "lecon-7266.json").read_text())
            self.assertEqual(sortie["courseId"], 9)
            self.assertEqual(sortie["blocs"][0]["type"], "paragraph")

    def test_cle_absente_refusee(self):
        with mock.patch.dict("os.environ", {}, clear=True):
            self.assertEqual(ex.main(["7266"]), 2)


if __name__ == "__main__":
    unittest.main()
