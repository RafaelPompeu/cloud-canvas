import copy
import json
import sqlite3
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

    def test_connection_options_survive_json_roundtrip(self):
        for color in ("data", "trigger", "green", "orange"):
            for dash in ("solid", "dashed", "dotted"):
                with self.subTest(color=color, dash=dash):
                    diagram = copy.deepcopy(self.diagram)
                    diagram["edges"][0].update(kind=color, dash=dash, sourceArrow=True,
                                              targetArrow=False, sourcePort="bottom", targetPort="left")
                    saved = self.client.post("/api/validate", json=diagram)
                    self.assertEqual(saved.status_code, 200)
                    loaded = json.loads(json.dumps(saved.json))
                    self.assertEqual(loaded["edges"][0], validate_diagram(diagram)["edges"][0])

    def test_edge_route_and_label_position_roundtrip(self):
        diagram = copy.deepcopy(self.diagram)
        diagram["edges"][0].update(bendX=-120.5, bendY=85, labelPosition=0.82)
        response = self.client.post("/api/validate", json=diagram)
        self.assertEqual(response.status_code, 200)
        edge = response.json["edges"][0]
        self.assertEqual((edge["bendX"], edge["bendY"], edge["labelPosition"]), (-120.5, 85, 0.82))
        self.assertEqual(validate_diagram(response.json), response.json)
        legacy = validate_diagram(self.diagram)["edges"][0]
        self.assertEqual((legacy["bendX"], legacy["bendY"], legacy["labelPosition"]), (0, 0, None))
        diagram["edges"][0]["bendX"] = "invalid"
        self.assertEqual(self.client.post("/api/validate", json=diagram).status_code, 400)

    def test_annotations_and_catalog_types(self):
        for kind in ("text", "note", "oracle", "mariadb", "shared-api"):
            node = {"id": "item", "type": kind, "x": 0, "y": 0, "w": 280, "h": 220}
            if kind in ("text", "note"):
                node.update(detail="Primeira linha\n<texto literal>\n" + "a" * 1000, textAlign="center")
            diagram = {"version": 1, "name": "Teste", "nodes": [node], "edges": []}
            saved = self.client.post("/api/validate", json=diagram)
            self.assertEqual(saved.status_code, 200)
            loaded = json.loads(json.dumps(saved.json))
            self.assertEqual(loaded, validate_diagram(diagram))

    def test_fitted_text_dimensions_and_font_survive_json(self):
        diagram = {"version": 1, "name": "Texto justo", "edges": [], "nodes": [
            {"id": "text", "type": "text", "label": "Texto", "detail": "Oi",
             "x": 0, "y": 0, "w": 18.5, "h": 17.25, "fontSize": 14,
             "parent": None, "textAlign": "center"}]}
        response = self.client.post("/api/validate", json=diagram)
        self.assertEqual(response.status_code, 200)
        node = response.json["nodes"][0]
        self.assertEqual((node["w"], node["h"], node["fontSize"]), (18.5, 17.25, 14))
        self.assertEqual(validate_diagram(response.json), response.json)
        del diagram["nodes"][0]["fontSize"]
        self.assertEqual(self.client.post("/api/validate", json=diagram).status_code, 200)
        diagram["nodes"][0]["fontSize"] = "invalid"
        self.assertEqual(self.client.post("/api/validate", json=diagram).status_code, 400)

    def test_no_database_created_or_written(self):
        self.assertEqual(self.client.get("/api/diagrams").json, [])
        self.assertEqual(self.client.get("/api/diagrams/missing").status_code, 404)
        self.assertEqual(self.client.post("/api/diagrams", json=self.diagram).status_code, 405)
        self.assertEqual(self.client.put("/api/diagrams/old", json=self.diagram).status_code, 405)
        self.assertFalse((Path(self.directory.name) / "test.sqlite3").exists())

    def test_legacy_diagram_is_read_only(self):
        path = Path(self.directory.name) / "test.sqlite3"
        db = sqlite3.connect(path)
        db.execute("CREATE TABLE diagrams (id TEXT PRIMARY KEY, name TEXT, data TEXT, updated_at TEXT)")
        db.execute("INSERT INTO diagrams VALUES (?, ?, ?, ?)",
                   ("old", self.diagram["name"], json.dumps(self.diagram), "2026-01-01"))
        db.commit()
        db.close()
        original = path.read_bytes()
        self.assertEqual(self.client.get("/api/diagrams/old").json["diagram"], validate_diagram(self.diagram))
        self.assertEqual(len(self.client.get("/api/diagrams").json), 1)
        self.assertEqual(self.client.put("/api/diagrams/old", json=self.diagram).status_code, 405)
        self.assertEqual(path.read_bytes(), original)

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
