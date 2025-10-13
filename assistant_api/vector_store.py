import json
import os
import sqlite3
from typing import List, Optional, Tuple

# Optional FAISS: allow backend to run without faiss installed (Windows-friendly)
try:
    import faiss  # type: ignore
except Exception:  # pragma: no cover - environment-specific
    faiss = None  # type: ignore
from .embeddings import embed_texts, embed_texts_openai
from .metrics import timer

IDX_DIR = os.getenv("RAG_INDEX_DIR", "data")
_DENSE_DISABLED = os.getenv("RAG_DENSE_DISABLE", "0") in {
    "1",
    "true",
    "TRUE",
    "yes",
    "on",
}
IDX_PATH = os.path.join(IDX_DIR, "index.faiss")
MAP_PATH = os.path.join(IDX_DIR, "index.map.json")  # [{rowid, chunk_id}]


def _connect_db() -> sqlite3.Connection:
    path = os.environ.get("RAG_DB")
    if not path:
        raise RuntimeError("RAG_DB not set")
    con = sqlite3.connect(path)
    con.execute("PRAGMA journal_mode=WAL")
    return con


def _fetch_chunks(con, project_id: str | None = None) -> list[tuple[int, str]]:
    q = "SELECT id, content FROM chunks"
    args = []
    if project_id:
        q += " WHERE project_id = ?"
        args = [project_id]
    return list(con.execute(q, args))


def build_index(project_id: str | None = None) -> dict:
    os.makedirs(IDX_DIR, exist_ok=True)
    con = _connect_db()
    rows = _fetch_chunks(con, project_id)
    con.close()
    if not rows:
        return {"ok": False, "reason": "no chunks"}
    if _DENSE_DISABLED:
        return {"ok": False, "reason": "dense disabled"}
    if faiss is None:
        return {"ok": False, "reason": "faiss not installed"}

    ids, texts = zip(*rows)
    ids = list(ids)
    texts = list(texts)
    # Batch with per-batch fallback
    B = int(os.getenv("EMBED_BATCH", "256"))
    vec_list = []
    for i in range(0, len(texts), B):
        batch = texts[i : i + B]
        try:
            v = embed_texts(batch)
        except Exception as e:
            print(
                f"[index] local embed batch failed ({i}:{i+len(batch)}), using OpenAI: {e}"
            )
            v = embed_texts_openai(batch)
        vec_list.append(v)
    import numpy as np

    vecs = np.concatenate(vec_list, axis=0)
    d = vecs.shape[1]
    index = faiss.IndexFlatIP(d)  # type: ignore  # cosine with normalized vectors
    with timer("embeddings", "build-index"):
        index.add(vecs)

    faiss.write_index(index, IDX_PATH)  # type: ignore
    with open(MAP_PATH, "w", encoding="utf-8") as f:
        json.dump([{"rowid": i, "chunk_id": int(cid)} for i, cid in enumerate(ids)], f)
    return {"ok": True, "count": len(ids), "index": IDX_PATH}


def dense_search(query: str, topk: int = 50) -> list[int]:
    if _DENSE_DISABLED or faiss is None:
        return []
    if not (os.path.exists(IDX_PATH) and os.path.exists(MAP_PATH)):
        return []
    index = faiss.read_index(IDX_PATH)  # type: ignore
    with open(MAP_PATH, encoding="utf-8") as f:
        mapping = json.load(f)
    qv = embed_texts([query])
    D, I = index.search(qv, topk)  # ignore scores here (we’ll rerank later)
    ids = []
    for idx in I[0]:
        if idx < 0:
            continue
        ids.append(mapping[idx]["chunk_id"])
    return ids
