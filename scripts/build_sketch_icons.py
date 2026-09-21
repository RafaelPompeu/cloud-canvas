"""Build sketch variants from the locally recorded provider SVG originals."""
import json
import re
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
NS = "http://www.w3.org/2000/svg"
ET.register_namespace("", NS)
INK = "#3b4048"


def tag(name):
    return f"{{{NS}}}{name}"


def pastel(color):
    if re.fullmatch(r"#[0-9a-fA-F]{3}", color):
        color = "#" + "".join(c * 2 for c in color[1:])
    if not re.fullmatch(r"#[0-9a-fA-F]{6}", color):
        return "#e3e9e9"
    rgb = [int(color[i:i + 2], 16) for i in (1, 3, 5)]
    return "#" + "".join(f"{round(c * .25 + 255 * .75):02x}" for c in rgb)


def build(source, destination):
    svg = ET.parse(source).getroot()
    if source.name == "mongodb.svg":
        # Keep the original leaf without the wide wordmark at icon size.
        for child in list(svg)[1:]:
            svg.remove(child)
        svg.set("viewBox", "-6 -6 132 275")
    if source.name == "dbt.svg":
        # Resolve the original light/dark CSS explicitly for the sketch palette.
        for node in svg.iter():
            if node.get("id") == "bg":
                node.set("fill", "#ff694b")
            elif node.get("id") == "bit":
                node.set("fill", "#ffffff")
    x, y, width, height = map(float, svg.attrib["viewBox"].split())
    classes = {}
    for style in svg.iter(tag("style")):
        for name, rules in re.findall(r"\.([\w-]+)\s*\{([^}]+)\}", style.text or ""):
            classes[name] = dict(re.findall(r"([\w-]+)\s*:\s*([^;]+)", rules))

    def paint(element, inherited, clipping=False):
        props = {**inherited}
        for name in element.get("class", "").split():
            props.update(classes.get(name, {}))
        props.update({k: element.attrib[k] for k in ("fill", "stroke") if k in element.attrib})
        inline = dict(re.findall(r"([\w-]+)\s*:\s*([^;]+)", element.get("style", "")))
        props.update(inline)
        if inline:
            element.set("style", ";".join(f"{k}:{v}" for k, v in inline.items() if k not in ("fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin")))
        clipping = clipping or element.tag in (tag("clipPath"), tag("mask"))
        for child in list(element):
            if child.tag in (tag("style"), tag("title"), tag("desc")):
                element.remove(child)
            else:
                paint(child, props, clipping)
        if clipping:
            return
        if element.tag == tag("stop"):
            color = element.get("stop-color", inline.get("stop-color", "#000000"))
            element.set("stop-color", pastel(color))
            element.attrib.pop("style", None)
            return
        if element.tag not in {tag(t) for t in ("path", "rect", "circle", "polygon", "ellipse", "line", "polyline", "use")}:
            return
        if element.get("id", "").endswith("_fill") and "fill" not in props:
            # Figma symbols inherit their paint from <use> instances.
            return
        color = props.get("fill", "#000000").strip()
        background = (element.tag == tag("rect") and
                      float(element.get("width", 0)) == width and
                      float(element.get("height", 0)) == height and
                      float(element.get("x", 0)) == x and float(element.get("y", 0)) == y)
        element.attrib.pop("class", None)
        if color == "none":
            element.set("fill", "none")
            if props.get("stroke", "none") != "none":
                element.set("stroke", INK)
                element.set("stroke-width", str(width * .013))
                element.set("stroke-linejoin", "round")
                element.set("stroke-linecap", "round")
            return
        if background:
            # A gently uneven paper tile, inset so its ink border cannot clip.
            element.tag = tag("path")
            element.attrib.clear()
            element.set("d", f"M{width*.08} {height*.045}Q{width*.5} {height*.025} {width*.92} {height*.055}Q{width*.965} {height*.06} {width*.955} {height*.12}L{width*.95} {height*.9}Q{width*.96} {height*.955} {width*.9} {height*.955}L{width*.09} {height*.945}Q{width*.035} {height*.95} {width*.045} {height*.89}L{width*.05} {height*.11}Q{width*.045} {height*.05} {width*.08} {height*.045}Z")
            element.set("fill", color if color.startswith("url(") else pastel(color))
            element.set("stroke", INK)
            element.set("stroke-width", str(width * .018))
        elif source.parent.name == "shared" and source.name != "dbt.svg" and color.lower() in ("white", "#ffffff", "#fff"):
            element.set("fill", "#fffdf8")
            element.set("stroke", "none")
        elif color.lower() in ("white", "#ffffff", "#fff", "#9aa0a6", "#242f3e", "#000000", "#000", "black"):
            element.set("fill", INK)
            element.set("stroke", INK)
            element.set("stroke-width", str(width * .002))
        else:
            element.set("fill", color if color.startswith("url(") else pastel(color))
            element.set("stroke", INK)
            element.set("stroke-width", str(width * .013))
        element.set("stroke-linejoin", "round")
        element.set("stroke-linecap", "round")

    paint(svg, {})
    svg.attrib.pop("id", None)
    svg.set("viewBox", f"{x:g} {y:g} {width:g} {height:g}")
    defs = ET.Element(tag("defs"))
    texture = ET.SubElement(defs, tag("filter"), id="pencil", x="-5%", y="-5%", width="110%", height="110%")
    ET.SubElement(texture, tag("feTurbulence"), type="fractalNoise", baseFrequency=f"{7/width:g}", numOctaves="1", seed="12", result="grain")
    ET.SubElement(texture, tag("feDisplacementMap"), **{"in": "SourceGraphic", "in2": "grain", "scale": f"{width/100:g}", "xChannelSelector": "R", "yChannelSelector": "G"})
    drawing = ET.Element(tag("g"), filter="url(#pencil)")
    for child in list(svg):
        svg.remove(child)
        drawing.append(child)
    svg.extend([defs, drawing])
    destination.parent.mkdir(parents=True, exist_ok=True)
    ET.ElementTree(svg).write(destination, encoding="utf-8", xml_declaration=True)


def main():
    catalog = json.loads((ROOT / "static/catalog.json").read_text(encoding="utf-8"))
    records = {}
    for item in catalog:
        if not item.get("iconAsset"):
            continue
        original = item["iconAsset"].replace("aws-sketch/", "aws/").replace("gcp-sketch/", "gcp/").replace("shared-sketch/", "shared/")
        variant = original.replace(f'/{item["provider"]}/', f'/{item["provider"]}-sketch/')
        if variant in records:
            continue
        build(ROOT / original.lstrip("/"), ROOT / variant.lstrip("/"))
        records[variant] = original
    (ROOT / "static/icons/sketch-sources.json").write_text(json.dumps({
        "description": "Sketch derivatives: original geometry, graphite outlines, pastel fills and subtle pencil irregularity. Original assets and provider source records are preserved.",
        "generator": "scripts/build_sketch_icons.py", "icons": records,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Generated {len(records)} sketch SVGs.")


if __name__ == "__main__":
    main()
