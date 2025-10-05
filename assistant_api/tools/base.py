from __future__ import annotations
from dataclasses import dataclass
from typing import Any, Dict, Callable, Optional, List
import os, pathlib, json

@dataclass
class ToolSpec:
    name: str
    desc: str
    schema: Dict[str, Any]
    run: Callable[[Dict[str, Any]], Dict[str, Any]]
    dangerous: bool = False

_REG: Dict[str, ToolSpec] = {}

def register(spec: ToolSpec):
    _REG[spec.name] = spec

def list_tools() -> List[Dict[str, Any]]:
    return [{"name": t.name, "desc": t.desc, "schema": t.schema, "dangerous": t.dangerous} for t in _REG.values()]

def get_tool(name: str) -> Optional[ToolSpec]:
    return _REG.get(name)

# Guardrails
ALLOW_TOOLS = os.getenv("ALLOW_TOOLS", "0") == "1"  # legacy snapshot; prefer is_allow_tools()
def is_allow_tools() -> bool:
    return os.getenv("ALLOW_TOOLS", "0") == "1"
BASE_DIR = pathlib.Path(os.getenv("REPO_ROOT", ".")).resolve()

def _safe_join(rel_path: str) -> pathlib.Path:
    rel_path = rel_path or ""
    p = (BASE_DIR / rel_path).resolve()
    # Ensure p is inside BASE_DIR
    if p != BASE_DIR and BASE_DIR not in p.parents:
        raise ValueError("Path escapes base dir")
    return p

def persist_audit(entry: Dict[str, Any]):
    path = pathlib.Path(os.getenv("TOOLS_AUDIT", "data/tools_audit.log"))
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")
