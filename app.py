"""Cloud Canvas: a local Flask editor for cloud architecture diagrams."""
from __future__ import annotations

import json
import math
import os
import sqlite3
from pathlib import Path

from flask import Flask, abort, g, jsonify, render_template, request
from werkzeug.exceptions import HTTPException

ROOT = Path(__file__).resolve().parent
CATALOG = json.loads((ROOT / "static" / "catalog.json").read_text(encoding="utf-8"))
TYPES = {item["type"]: item for item in CATALOG}


def number(value, low, high, name):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError(f"{name}: informe um número finito.")
    if not low <= value <= high:
        raise ValueError(f"{name}: valor fora do intervalo permitido.")
    return value


def label(value, default="", limit=120):
    if value is None:
        return default
    if not isinstance(value, str) or len(value) > limit:
        raise ValueError(f"Texto inválido (máximo de {limit} caracteres).")
    return value


def validate_diagram(data):
    """Normalize imported/saved data; never trust graph references or dimensions."""
    if not isinstance(data, dict) or data.get("version") != 1:
        raise ValueError("Formato inválido. Use um diagrama Cloud Canvas versão 1.")
    nodes, edges = data.get("nodes"), data.get("edges")
    if not isinstance(nodes, list) or not isinstance(edges, list):
        raise ValueError("O diagrama precisa de listas de componentes e conexões.")
    if len(nodes) > 400 or len(edges) > 1200:
        raise ValueError("Limite por diagrama: 400 componentes e 1.200 conexões.")
    clean, ids = [], set()
    for node in nodes:
        if not isinstance(node, dict):
            raise ValueError("Componente inválido.")
        nid = label(node.get("id"), limit=80)
        kind = node.get("type")
        if not nid or nid in ids or not isinstance(kind, str) or kind not in TYPES:
            raise ValueError("Componente com ID duplicado ou tipo desconhecido.")
        ids.add(nid)
        is_group = TYPES[kind]["group"]
        parent = node.get("parent")
        if parent is not None and not isinstance(parent, str):
            raise ValueError("Contêiner inválido.")
        text_align = node.get("textAlign", "left")
        if text_align not in ("left", "center", "right"):
            raise ValueError("Alinhamento de texto invalido.")
        clean.append({"textAlign": text_align, "id": nid, "type": kind, "label": label(node.get("label"), TYPES[kind]["name"]),
                      "detail": label(node.get("detail"), limit=2000 if kind in ("text", "note") else 180), "parent": parent,
                      "x": number(node.get("x"), -100000, 100000, "X"),
                      "y": number(node.get("y"), -100000, 100000, "Y"),
                      "w": number(node.get("w", 300 if is_group else 148), 210 if is_group else 2 if kind == "text" else 148, 10000, "Largura"),
                      "h": number(node.get("h", 220 if is_group else 76), 150 if is_group else 2 if kind == "text" else 76, 10000, "Altura")})
        if kind == "text" and "fontSize" in node:
            clean[-1]["fontSize"] = number(node["fontSize"], 1, 2000, "Tamanho do texto")
    by_id = {node["id"]: node for node in clean}
    for node in clean:
        seen = {node["id"]}
        parent = node["parent"]
        while parent is not None:
            if parent not in by_id or not TYPES[by_id[parent]["type"]]["group"] or parent in seen:
                raise ValueError("Hierarquia inválida: contêiner inexistente ou ciclo.")
            seen.add(parent)
            if len(seen) > 12:
                raise ValueError("Limite de 12 níveis de contêineres.")
            parent = by_id[parent]["parent"]
        if node["parent"]:
            p = by_id[node["parent"]]
            if node["x"] < 16 or node["y"] < 48 or node["x"] + node["w"] > p["w"] - 16.0 + .001 or node["y"] + node["h"] > p["h"] - 16.0 + .001:
                raise ValueError("Há componentes fora dos limites do contêiner.")
    clean_edges, edge_ids = [], set()
    for edge in edges:
        if not isinstance(edge, dict):
            raise ValueError("Conexão inválida.")
        eid = label(edge.get("id"), limit=80)
        source, target = edge.get("source"), edge.get("target")
        if not isinstance(source, str) or not isinstance(target, str) or source not in ids or target not in ids or source == target or not eid or eid in edge_ids or eid in ids:
            raise ValueError("Conexão com referência inválida ou ID duplicado.")
        edge_ids.add(eid)
        style = edge.get("style", "curve")
        if style not in ("curve", "straight", "orthogonal"):
            raise ValueError("Estilo de conexão inválido.")
        kind = edge.get("kind", "data")
        dash = edge.get("dash", "dashed" if kind == "trigger" else "solid")
        if dash not in ("solid", "dashed", "dotted"):
            raise ValueError("Padrao de linha invalido.")
        source_arrow = edge.get("sourceArrow", False)
        target_arrow = edge.get("targetArrow", True)
        if not isinstance(source_arrow, bool) or not isinstance(target_arrow, bool):
            raise ValueError("Ponta de seta invalida.")
        source_port = edge.get("sourcePort", "auto")
        target_port = edge.get("targetPort", "auto")
        if kind not in ("data", "trigger", "green", "orange"):
            raise ValueError("Tipo de conexão inválido.")
        if source_port not in ("auto", "top", "right", "bottom", "left") or target_port not in ("auto", "top", "right", "bottom", "left"):
            raise ValueError("Ponto de conexão inválido.")
        clean_edges.append({"id": eid, "source": source, "target": target,
                            "label": label(edge.get("label")), "style": style, "kind": kind, "dash": dash,
                            "sourcePort": source_port, "targetPort": target_port,
                            "sourceArrow": source_arrow, "targetArrow": target_arrow,
                            "bendX": number(edge.get("bendX", 0), -10000, 10000, "Curvatura horizontal"),
                            "bendY": number(edge.get("bendY", 0), -10000, 10000, "Curvatura vertical"),
                            "labelPosition": None if edge.get("labelPosition") is None else number(edge["labelPosition"], 0, 1, "Posição do rótulo")})
    return {"version": 1, "name": label(data.get("name"), "Arquitetura sem título") or "Arquitetura sem título",
            "notes": label(data.get("notes"), limit=2000), "nodes": clean, "edges": clean_edges}


def create_app(config=None):
    app = Flask(__name__, instance_relative_config=True)
    app.config.update(MAX_CONTENT_LENGTH=2 * 1024 * 1024,
                      DATABASE=str(ROOT / "instance" / "diagrams.sqlite3"))
    if config:
        app.config.update(config)
    def database():
        if "db" not in g:
            g.db = sqlite3.connect(Path(app.config["DATABASE"]).resolve().as_uri() + "?mode=ro", uri=True, timeout=10)
            g.db.row_factory = sqlite3.Row
        return g.db

    @app.teardown_appcontext
    def close_db(error=None):
        db = g.pop("db", None)
        if db:
            db.close()

    @app.before_request
    def same_origin():
        if request.method in ("POST", "PUT", "DELETE"):
            origin = request.headers.get("Origin")
            if origin and origin != request.host_url.rstrip("/"):
                abort(403, "Origem não permitida.")
            if request.headers.get("Sec-Fetch-Site") == "cross-site":
                abort(403, "Origem não permitida.")

    @app.after_request
    def headers(response):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "same-origin"
        response.headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
        if request.path == "/" or request.path.startswith(("/api/", "/static/")):
            response.headers["Cache-Control"] = "no-store"
        return response

    @app.errorhandler(ValueError)
    def validation_error(error):
        return jsonify(error=str(error)), 400

    @app.errorhandler(HTTPException)
    def http_error(error):
        return jsonify(error=error.description), error.code

    @app.get("/")
    def index():
        return render_template("index.html")

    @app.get("/api/health")
    def health():
        return jsonify(status="ok")

    @app.get("/api/diagrams")
    def list_diagrams():
        if not Path(app.config["DATABASE"]).is_file():
            return jsonify([])
        rows = database().execute("SELECT id, name, updated_at FROM diagrams ORDER BY updated_at DESC").fetchall()
        return jsonify([dict(row) for row in rows])

    @app.get("/api/diagrams/<diagram_id>")
    def get_diagram(diagram_id):
        if not Path(app.config["DATABASE"]).is_file():
            abort(404, "Diagrama antigo não encontrado. Abra um arquivo JSON.")
        row = database().execute("SELECT * FROM diagrams WHERE id = ?", (diagram_id,)).fetchone()
        if not row:
            abort(404, "Diagrama não encontrado.")
        return jsonify(id=row["id"], updated_at=row["updated_at"], diagram=validate_diagram(json.loads(row["data"])))

    @app.post("/api/validate")
    def validate():
        return jsonify(validate_diagram(request.get_json()))

    return app


if __name__ == "__main__":
    create_app().run(host="127.0.0.1", port=int(os.environ.get("PORT", "5000")), debug=False)
