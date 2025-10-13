import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Optional

from .embeddings import embed_texts as embed_texts_local_first

FAQ_PATH = Path(os.getenv("FAQ_PATH", "data/faq.json"))


@dataclass
class FaqHit:
    q: str
    a: str
    project_id: str | None
    score: float


_cache: dict[str, Any] = {"ready": False, "items": [], "E": None}


def _load() -> None:
    if _cache["ready"]:
        return
    if FAQ_PATH.exists():
        items = json.loads(FAQ_PATH.read_text(encoding="utf-8"))
        # normalize
        _cache["items"] = [{"q": i["q"], "a": i["a"], "project_id": i.get("project_id")} for i in items]
    else:
        _cache["items"] = []
    _cache["ready"] = True


def faq_search_best(query: str) -> FaqHit | None:
    _load()
    if not _cache["items"]:
        return None
    texts = [query] + [it["q"] for it in _cache["items"]]
    vecs = embed_texts_local_first(texts)
    qv, docvs = vecs[0], vecs[1:]

    def cos(a, b):
        import numpy as np
        na = float(np.linalg.norm(a))
        nb = float(np.linalg.norm(b))
        return float((a @ b) / (na * nb + 1e-9))

    scores = [cos(qv, dv) for dv in docvs]
    best_i = max(range(len(scores)), key=lambda i: scores[i])
    best = _cache["items"][best_i]
    return FaqHit(q=best["q"], a=best["a"], project_id=best.get("project_id"), score=float(scores[best_i]))
