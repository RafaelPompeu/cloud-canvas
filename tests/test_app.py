import copy
import json
import tempfile
import unittest
from pathlib import Path

from app import ROOT, create_app, validate_diagram


class DiagramTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.client = create_app({
            "TESTING": True,
            "DATABASE": str(Path(self.directory.name) / "test.sqlite3"),
        }).test_client()
        self.diagram = json.loads((ROOT / "static/example.json").read_text(encoding="utf-8"))

    def test_health_and_editor(self):
        self.assertEqual(self.client.get("/api/health").json, {"status": "ok"})
        self.assertEqual(self.client.get("/").status_code, 200)

    def test_connection_options_survive_save(self):
        for color in ("data", "trigger", "green", "orange"):
            for dash in ("solid", "dashed", "dotted"):
                with self.subTest(color=color, dash=dash):
                    diagram = copy.deepcopy(self.diagram)
                    diagram["edges"][0].update(kind=color, dash=dash, sourceArrow=True,
                                              targetArrow=False, sourcePort="bottom", targetPort="left")
                    saved = self.client.post("/api/diagrams", json=diagram)
                    self.assertEqual(saved.status_code, 201)
                    loaded = self.client.get("/api/diagrams/" + saved.json["id"]).json["diagram"]
                    self.assertEqual(loaded["edges"][0], validate_diagram(diagram)["edges"][0])

    def test_annotations_and_catalog_types(self):
        for kind in ("text", "note", "oracle", "mariadb", "shared-api"):
            node = {"id": "item", "type": kind, "x": 0, "y": 0, "w": 280, "h": 220}
            if kind in ("text", "note"):
                node.update(detail="Primeira linha\n<texto literal>\n" + "a" * 1000, textAlign="center")
            diagram = {"version": 1, "name": "Teste", "nodes": [node], "edges": []}
            saved = self.client.post("/api/diagrams", json=diagram)
            self.assertEqual(saved.status_code, 201)
            loaded = self.client.get("/api/diagrams/" + saved.json["id"]).json["diagram"]
            self.assertEqual(loaded, validate_diagram(diagram))

    def test_legacy_defaults_and_invalid_values(self):
        clean = validate_diagram(self.diagram)
        self.assertFalse(clean["edges"][0]["sourceArrow"])
        self.assertTrue(clean["edges"][0]["targetArrow"])
        for key, value in (("sourceArrow", "true"), ("dash", "invalid"), ("targetPort", "invalid")):
            diagram = copy.deepcopy(self.diagram)
            diagram["edges"][0][key] = value
            self.assertEqual(self.client.post("/api/validate", json=diagram).status_code, 400)


if __name__ == "__main__":
    unittest.main()
