import json
import re
import unittest
from pathlib import Path
from xml.etree import ElementTree as ET

from app import ROOT


class SketchIconTests(unittest.TestCase):
    def test_catalog_assets_and_svg_references_exist(self):
        catalog = json.loads((ROOT / "static/catalog.json").read_text(encoding="utf-8"))
        for asset in {item["iconAsset"] for item in catalog if item.get("iconAsset")}:
            with self.subTest(asset=asset):
                root = ET.parse(ROOT / asset.lstrip("/")).getroot()
                ids = {node.get("id") for node in root.iter() if node.get("id")}
                for node in root.iter():
                    for key, value in node.attrib.items():
                        for reference in re.findall(r"url\(#([^)]*)\)", value):
                            self.assertIn(reference, ids)
                        if key.endswith("href") and value.startswith("#"):
                            self.assertIn(value[1:], ids)

    def test_jupyter_instances_keep_their_colors(self):
        root = ET.parse(ROOT / "static/icons/shared-sketch/jupyter.svg").getroot()
        uses = root.findall(".//{http://www.w3.org/2000/svg}use")
        self.assertTrue(uses)
        self.assertGreater(len({node.get("fill") for node in uses}), 1)
        for node in root.iter():
            if node.get("id", "").endswith("_fill"):
                self.assertIsNone(node.get("fill"))

    def test_postgresql_keeps_internal_outlines(self):
        root = ET.parse(ROOT / "static/icons/shared-sketch/postgresql.svg").getroot()
        lines = [node for node in root.iter() if node.get("fill") == "none" and node.get("stroke") == "#3b4048"]
        self.assertGreaterEqual(len(lines), 2)

    def test_trino_face_and_helmet_remain_visible(self):
        root = ET.parse(ROOT / "static/icons/shared-sketch/trino.svg").getroot()
        visor = root.find(".//{http://www.w3.org/2000/svg}ellipse[@fill='#8accce']")
        self.assertIsNotNone(visor)
        self.assertEqual(float(visor.get("opacity")), .2)
        self.assertEqual(visor.get("stroke"), "none")
        paper = [node for node in root.iter() if node.get("fill") == "#fffdf8"]
        self.assertEqual(len(paper), 2)
        self.assertTrue(all(node.get("stroke") == "#3b4048" for node in paper))
        face = [node for node in root.iter() if node.get("fill") == "#3b4048" and node.get("stroke") == "none"]
        self.assertEqual(len(face), 3)  # Eyes and nose/mouth.


if __name__ == "__main__":
    unittest.main()
