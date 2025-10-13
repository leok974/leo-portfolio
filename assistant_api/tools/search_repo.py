from __future__ import annotations

import pathlib
import re
from typing import Any, Dict, List

from .base import BASE_DIR, ToolSpec, _safe_join, persist_audit, register

INCLUDE = tuple([".md", ".mdx", ".py", ".ts", ".tsx", ".json", ".yml", ".yaml", ".toml", ".ps1"])  # basic text/code types

def _grep(root: pathlib.Path, query: str, max_hits: int = 20) -> list[dict[str, Any]]:
    hits: list[dict[str, Any]] = []
    try:
        pat = re.compile(re.escape(query), re.IGNORECASE)
    except Exception:
        pat = re.compile(re.escape(str(query)), re.IGNORECASE)
    for p in root.rglob("*"):
        if not p.is_file():
            continue
        if p.suffix.lower() not in INCLUDE:
            continue
        try:
            text = p.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue
        for i, line in enumerate(text.splitlines(), 1):
            try:
                if pat.search(line):
                    snippet = line.strip()
                    hits.append({"path": str(p.relative_to(BASE_DIR)), "line": i, "snippet": snippet})
                    if len(hits) >= max_hits:
                        return hits
            except Exception:
                continue
    return hits

def run_search_repo(args: dict[str, Any]) -> dict[str, Any]:
    q: str = (args.get("query") or "").strip()
    subdir: str = (args.get("subdir") or "").strip()
    if not q:
        return {"ok": False, "error": "missing query"}
    root = _safe_join(subdir) if subdir else BASE_DIR
    k = int(args.get("k") or 20)
    hits = _grep(root, q, max_hits=max(1, min(100, k)))
    persist_audit({"tool": "search_repo", "query": q, "subdir": subdir, "count": len(hits)})
    return {"ok": True, "query": q, "subdir": str(root.relative_to(BASE_DIR)) if subdir else "", "hits": hits}

register(ToolSpec(
    name="search_repo",
    desc="Search repository text files for a query string and return file/line/snippet matches.",
    schema={"type":"object","properties":{
        "query":{"type":"string","description":"Search text"},
        "subdir":{"type":"string","description":"Optional project folder to scope"},
        "k":{"type":"integer","minimum":1,"maximum":100}
      },"required":["query"]},
    run=run_search_repo
))
