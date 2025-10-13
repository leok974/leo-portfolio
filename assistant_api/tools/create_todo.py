from __future__ import annotations

import json
import pathlib
import time
from typing import Any, Dict

from .base import ToolSpec, persist_audit, register

TODO_PATH = pathlib.Path("data/todos.json")

def run_create_todo(args: dict[str, Any]) -> dict[str, Any]:
    title = (args.get("title") or "").strip()
    project_id = ((args.get("project_id") or "").strip() or None)
    if not title:
        return {"ok": False, "error": "missing title"}
    TODO_PATH.parent.mkdir(parents=True, exist_ok=True)
    items = []
    if TODO_PATH.exists():
        try:
            items = json.loads(TODO_PATH.read_text(encoding="utf-8"))
        except Exception:
            items = []
    item = {"id": int(time.time()*1000), "title": title, "project_id": project_id, "done": False}
    items.append(item)
    TODO_PATH.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")
    persist_audit({"tool": "create_todo", "title": title, "project_id": project_id})
    return {"ok": True, "item": item}

register(ToolSpec(
    name="create_todo",
    desc="Create a local TODO item stored in data/todos.json",
    schema={"type":"object","properties":{
      "title":{"type":"string"},
      "project_id":{"type":"string"}
    },"required":["title"]},
    run=run_create_todo
))
