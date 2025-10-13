import os
import re

import httpx

from .db import connect, index_dim, search
from .rag_query import embed_query_matching_dim

# Default to the backend service URL in containerized/prod; allow override via env.
# Local dev keeps using 127.0.0.1:8001 when RAG_URL is set by tasks.
RAG_URL = os.getenv("RAG_URL", "http://backend:8000/api/rag/query")
PROJECT_HINTS = [
    r"\bledgermind\b",
    r"\bportfolio\b",
    r"\bassistant chip\b",
    r"\brag\b",
    r"\bfastapi\b",
    r"\brelay\b",
]


def needs_repo_context(user_text: str) -> bool:
    t = (user_text or "").lower()
    return any(re.search(p, t) for p in PROJECT_HINTS) or ("repo" in t) or ("code" in t)


async def fetch_context(question: str, k=6):
    # Try HTTP first (works in prod/compose), else fall back to in-process search.
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(RAG_URL, json={"question": question, "k": k})
            r.raise_for_status()
            return (r.json() or {}).get("matches", [])[:k]
    except Exception:
        pass
    conn = None
    try:
        conn = connect()
        dim = index_dim(conn)
        qv, _mode = await embed_query_matching_dim(question, dim)
        hits = search(conn, qv, k=k)
        # Shape to match external API: include snippet
        out = []
        for h in hits:
            out.append(
                {
                    "id": h.get("id"),
                    "repo": h.get("repo"),
                    "path": h.get("path"),
                    "score": float(h.get("score", 0.0)),
                    "snippet": (h.get("text") or "")[:600],
                }
            )
        return out
    except Exception:
        return []
    finally:
        try:
            if conn is not None:
                conn.close()
        except Exception:
            pass


def build_context_message(matches):
    cites = [f"- {m['repo']}/{m['path']}" for m in matches]
    snippets = "\n\n".join([m.get("snippet", "") for m in matches])
    content = (
        "Use the following repo snippets to answer precisely. "
        "Cite file paths inline like [repo/path].\n\n"
        + "Sources:\n"
        + "\n".join(cites)
        + "\n\nSnippets:\n"
        + snippets
    )
    return {"role": "system", "content": content}
