from __future__ import annotations
from typing import Dict, Any
import pathlib
from .base import register, ToolSpec, _safe_join, persist_audit

def run_read_file(args: Dict[str, Any]) -> Dict[str, Any]:
    rel = (args.get("path") or "").strip()
    start = int(args.get("start") or 1)
    end   = int(args.get("end")   or (start + 80))
    p: pathlib.Path = _safe_join(rel)
    if not p.exists() or not p.is_file():
        return {"ok": False, "error": "not found"}
    try:
        text = p.read_text(encoding="utf-8", errors="ignore").splitlines()
    except Exception as e:
        return {"ok": False, "error": f"read error: {e}"}
    if not text:
        return {"ok": True, "path": rel, "start": 0, "end": 0, "content": ""}
    start = max(1, start); end = min(len(text), max(start, end))
    lines = text[start-1:end]
    persist_audit({"tool": "read_file", "path": rel, "start": start, "end": end})
    return {"ok": True, "path": rel, "start": start, "end": end, "content": "\n".join(lines)}

register(ToolSpec(
    name="read_file",
    desc="Read a small slice of a file by line numbers.",
    schema={"type":"object","properties":{
      "path":{"type":"string","description":"Relative path (inside repo)"},
      "start":{"type":"integer","minimum":1},
      "end":{"type":"integer","minimum":1}
    },"required":["path"]},
    run=run_read_file
))
