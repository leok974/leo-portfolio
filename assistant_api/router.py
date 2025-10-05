from dataclasses import dataclass
from typing import Optional, Literal, Dict, Any, List
import os
from .fts import bm25_search_scored
from .faq import faq_search_best

Route = Literal["rag", "faq", "chitchat"]


@dataclass
class RouteOut:
    route: Route
    reason: str
    project_id: Optional[str] = None
    score: float = 0.0


RAG_MIN_SCORE = float(os.getenv("ROUTER_RAG_MIN", "7.0"))  # bm25 score gate
FAQ_MIN_SCORE = float(os.getenv("ROUTER_FAQ_MIN", "0.72"))  # cosine sim gate (0..1)


def _dominant_project(hits: List[Dict[str, Any]]) -> Optional[str]:
    # pick the most frequent project_id among hits (if present)
    tally: Dict[str, int] = {}
    for h in hits:
        pid = h.get("project_id") or (h.get("meta", {}) or {}).get("project_id")
        if not pid:
            continue
        tally[pid] = tally.get(pid, 0) + 1
    if not tally:
        return None
    return max(tally, key=tally.get)


def route_query(question: str) -> RouteOut:
    # 1) try FAQ (fast exact-ish match)
    f = faq_search_best(question)
    if f and f.score >= FAQ_MIN_SCORE:
        return RouteOut(route="faq", reason=f"faq({f.score:.2f})", project_id=f.project_id, score=f.score)

    # 2) try BM25 over chunks (cheap; we already have FTS)
    try:
        bm = bm25_search_scored(question, topk=5)
    except Exception:
        bm = []
    if bm and (float(bm[0].get("score", 0.0)) >= RAG_MIN_SCORE):
        return RouteOut(
            route="rag",
            reason=f"bm25({float(bm[0]['score']):.1f})",
            project_id=_dominant_project(bm),
            score=float(bm[0].get("score", 0.0)),
        )

    # 3) default chit-chat
    return RouteOut(route="chitchat", reason="no strong faq/rag signal", project_id=None, score=0.0)
