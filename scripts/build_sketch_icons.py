"""Build sketch variants from the locally recorded provider SVG originals."""
import json
import re
from copy import deepcopy
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
NS = "http://www.w3.org/2000/svg"
ET.register_namespace("", NS)
INK = "#3b4048"


def tag(name):
    return f"{{{NS}}}{name}"


def pastel(color, pigment=.25):
    if re.fullmatch(r"#[0-9a-fA-F]{3}", color):
        color = "#" + "".join(c * 2 for c in color[1:])
    if not re.fullmatch(r"#[0-9a-fA-F]{6}", color):
        return "#e3e9e9"
    rgb = [int(color[i:i + 2], 16) for i in (1, 3, 5)]
    return "#" + "".join(f"{round(c * pigment + 255 * (1 - pigment)):02x}" for c in rgb)


def local_unit(element, unit):
    for operation, arguments in re.findall(r"(matrix|scale)\(([^)]+)\)", element.get("transform", "")):
        values = [float(v) for v in re.split(r"[\s,]+", arguments.strip())]
        if operation == "matrix":
            a, b, c, d, _, _ = values
            scale = abs(a * d - b * c) ** .5
        else:
            scale = abs(values[0] * values[-1]) ** .5
        if scale:
            unit /= scale
    return unit


def pencil_marks(parent, unit, ink_marks=True):
    """Add restrained, offset pencil contours and hatching to painted shapes."""
    shapes = {tag(t) for t in ("path", "rect", "circle", "polygon", "ellipse", "use")}
    unit = local_unit(parent, unit)
    for element in list(parent):
        if element.tag in {tag(t) for t in ("defs", "clipPath", "mask")}:
            continue
        pencil_marks(element, unit, ink_marks)
        if element.tag not in shapes or element.get("stroke") != INK:
            continue
        if element.get("fill", "none") in ("none", "#fffdf8"):
            continue
        if not ink_marks and element.get("fill") == INK:
            continue
        index = list(parent).index(element)
        stroke_unit = local_unit(element, unit)
        hatch = deepcopy(element)
        echo = deepcopy(element)
        for copy in (hatch, echo):
            copy.attrib.pop("id", None)
        hatch.set("fill", "url(#pencil-hatch)")
        hatch.set("stroke", "none")
        hatch.set("opacity", ".22")
        echo.set("fill", "none")
        echo.set("stroke-width", f"{stroke_unit * .009:g}")
        echo.set("opacity", ".32")
        # Append in local coordinates so transformed symbols remain aligned.
        echo.set("transform", element.get("transform", "") + f" translate({stroke_unit * .012:g} {-stroke_unit * .009:g})")
        parent.insert(index + 1, hatch)
        parent.insert(index + 2, echo)


def build(source, destination):
    svg = ET.parse(source).getroot()
    shared = source.parent.name == "shared"
    gcp = source.parent.name == "gcp"
    aws = source.parent.name == "aws"
    pencil = shared or gcp or aws
    if source.name == "mongodb.svg":
        # Keep the original leaf without the wide wordmark at icon size.
        for child in list(svg)[1:]:
            svg.remove(child)
        svg.set("viewBox", "-6 -6 132 275")
    if shared and source.name == "oracle.svg":
        # Remove empty vertical space around the original wordmark.
        svg.set("viewBox", "-4 50 136 29")
    if source.name == "dbt.svg":
        # Resolve the original light/dark CSS explicitly for the sketch palette.
        for node in svg.iter():
            if node.get("id") == "bg":
                node.set("fill", "#ff694b")
            elif node.get("id") == "bit":
                node.set("fill", "#ffffff")
    x, y, width, height = map(float, svg.attrib["viewBox"].split())
    unit = min(width, height) if pencil else width
    tint = lambda color: pastel(color, .38 if pencil else .25)
    classes = {}
    for style in svg.iter(tag("style")):
        for name, rules in re.findall(r"\.([\w-]+)\s*\{([^}]+)\}", style.text or ""):
            classes[name] = dict(re.findall(r"([\w-]+)\s*:\s*([^;]+)", rules))

    def paint(element, inherited, clipping=False, stroke_unit=unit):
        if pencil:
            stroke_unit = local_unit(element, stroke_unit)
        outline = stroke_unit * (.019 if shared else .016 if gcp or aws else .013)
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
                paint(child, props, clipping, stroke_unit)
        if clipping:
            return
        if element.tag == tag("stop"):
            color = element.get("stop-color", inline.get("stop-color", "#000000"))
            element.set("stop-color", tint(color))
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
        if shared and source.name == "trino.svg":
            # The translucent visor sits above the eyes and mouth.
            if color.lower() == "#8accce":
                element.set("fill", color)
                element.set("opacity", props.get("opacity", "0.2"))
                element.set("stroke", "none")
                return
            # Tiny facial features need solid ink, without extra pencil strokes.
            if color.lower() in ("#10110e", "#e5e5e5", "#f9d8d2"):
                element.set("fill", INK if color.lower() == "#10110e" else tint(color))
                element.set("stroke", "none")
                return
        if color == "none":
            element.set("fill", "none")
            if props.get("stroke", "none") != "none":
                element.set("stroke", INK)
                element.set("stroke-width", str(outline))
                element.set("stroke-linejoin", "round")
                element.set("stroke-linecap", "round")
            return
        if background:
            # A gently uneven paper tile, inset so its ink border cannot clip.
            element.tag = tag("path")
            element.attrib.clear()
            element.set("d", f"M{width*.08} {height*.045}Q{width*.5} {height*.025} {width*.92} {height*.055}Q{width*.965} {height*.06} {width*.955} {height*.12}L{width*.95} {height*.9}Q{width*.96} {height*.955} {width*.9} {height*.955}L{width*.09} {height*.945}Q{width*.035} {height*.95} {width*.045} {height*.89}L{width*.05} {height*.11}Q{width*.045} {height*.05} {width*.08} {height*.045}Z")
            element.set("fill", color if color.startswith("url(") else tint(color))
            element.set("stroke", INK)
            element.set("stroke-width", str(width * .018))
        elif source.parent.name == "shared" and source.name != "dbt.svg" and color.lower() in ("white", "#ffffff", "#fff"):
            element.set("fill", "#fffdf8")
            element.set("stroke", INK if source.name == "trino.svg" else "none")
            if source.name == "trino.svg":
                element.set("stroke-width", str(stroke_unit * .016))
        elif color.lower() in ("white", "#ffffff", "#fff", "#9aa0a6", "#242f3e", "#000000", "#000", "black"):
            element.set("fill", INK)
            element.set("stroke", INK)
            element.set("stroke-width", str(width * .002))
        else:
            element.set("fill", color if color.startswith("url(") else tint(color))
            element.set("stroke", INK)
            element.set("stroke-width", str(outline))
        element.set("stroke-linejoin", "round")
        element.set("stroke-linecap", "round")

    paint(svg, {})
    svg.attrib.pop("id", None)
    padding = unit * .045 if pencil else 0
    svg.set("viewBox", f"{x-padding:g} {y-padding:g} {width+padding*2:g} {height+padding*2:g}")
    if pencil:
        svg.attrib.pop("width", None)
        svg.attrib.pop("height", None)
    defs = ET.Element(tag("defs"))
    if pencil:
        pitch = unit * .105
        hatch = ET.SubElement(defs, tag("pattern"), id="pencil-hatch", patternUnits="userSpaceOnUse", width=f"{pitch:g}", height=f"{pitch:g}")
        ET.SubElement(hatch, tag("path"), d=f"M{-pitch*.2:g} {pitch*.85:g}Q{pitch*.45:g} {pitch*.43:g} {pitch*.85:g} {-pitch*.15:g}M{pitch*.75:g} {pitch*1.15:g}L{pitch*1.15:g} {pitch*.75:g}", fill="none", stroke=INK, **{"stroke-width": f"{unit*.008:g}", "stroke-linecap": "round"})
        pencil_marks(svg, unit, ink_marks=not (gcp or aws))
    texture = ET.SubElement(defs, tag("filter"), id="pencil", x="-5%", y="-5%", width="110%", height="110%")
    ET.SubElement(texture, tag("feTurbulence"), type="fractalNoise", baseFrequency=f"{(3.5 if pencil else 7)/unit:g}", numOctaves="1", seed="12", result="grain")
    irregularity = .03 if shared and source.name == "trino.svg" else (.045 if shared else .035 if gcp or aws else .01)
    ET.SubElement(texture, tag("feDisplacementMap"), **{"in": "SourceGraphic", "in2": "grain", "scale": f"{unit*irregularity:g}", "xChannelSelector": "R", "yChannelSelector": "G"})
    drawing = ET.Element(tag("g"), filter="url(#pencil)")
    for child in list(svg):
        svg.remove(child)
        drawing.append(child)
    svg.extend([defs, drawing])
    destination.parent.mkdir(parents=True, exist_ok=True)
    if pencil:
        data = ET.tostring(svg, encoding="utf-8", xml_declaration=True)
        destination.write_bytes(b"\n".join(line.rstrip() for line in data.splitlines()))
    else:
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
