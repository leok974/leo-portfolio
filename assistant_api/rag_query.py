import os, numpy as np, hashlib
from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Dict
from .db import connect, search, index_dim
from .fts import bm25_search
from .vector_store import dense_search
from .reranker import rerank

router = APIRouter()

class QueryIn(BaseModel):
    question: str
    k: int = 8
    project_id: str | None = None

# Auto-match the query embedder to the stored index dimension

def _read_openai_key() -> str | None:
    key = os.getenv("OPENAI_API_KEY")
    if key:
        return key
    p = os.getenv("OPENAI_API_KEY_FILE", "/run/secrets/openai_api_key")
    if os.path.exists(p):
        try:
            return open(p, "r", encoding="utf-8").read().strip()
        except Exception:
            return None
    return None


def _hash_embed(text: str, dim: int | None) -> np.ndarray:
    size = dim if isinstance(dim, int) and dim > 0 else 256
    vec = np.zeros(size, dtype=np.float32)
    for token in text.lower().split():
        digest = hashlib.blake2b(token.encode("utf-8"), digest_size=8).digest()
        idx = int.from_bytes(digest, "big") % size
        vec[idx] += 1.0
    norm = np.linalg.norm(vec) or 1.0
    vec /= norm
    return vec


async def embed_query_matching_dim(text: str, dim: int | None) -> tuple[np.ndarray, str]:
    if dim in (1536, 3072, None):
        api_key = _read_openai_key()
        if not api_key:
            return _hash_embed(text, dim), "local-fallback"
        from openai import OpenAI
        client = OpenAI(api_key=api_key)
        model = "text-embedding-3-small" if dim in (1536, None) else "text-embedding-3-large"
        try:
            r = client.embeddings.create(model=model, input=[text])
            vec = np.array(r.data[0].embedding, dtype=np.float32)
            return vec, "openai"
        except Exception:
            return _hash_embed(text, dim), "local-fallback"
    elif dim in (384, 768):
        from sentence_transformers import SentenceTransformer
        model_id = "intfloat/e5-small-v2" if dim == 384 else "intfloat/e5-base-v2"
        model = SentenceTransformer(model_id)
        vec = model.encode([text], normalize_embeddings=True)[0]
        return np.array(vec, dtype=np.float32), "local-model"
    else:
        return _hash_embed(text, dim), "local-fallback"


@router.post("/rag/query")
async def rag_query(q: QueryIn):
    con = connect()
    try:
        # 1) Recall: BM25 + dense
        bm = bm25_search(q.question, topk=50)
        dn = dense_search(q.question, topk=50)
        pool_ids = list(dict.fromkeys(bm + dn))  # stable dedupe

        # Optional filter by project_id if provided (if chunks table is used)
        if q.project_id and pool_ids:
            ph = ",".join("?" for _ in pool_ids)
            rows = con.execute(f"SELECT id FROM chunks WHERE id IN ({ph}) AND project_id = ?", (*pool_ids, q.project_id)).fetchall()
            pool_ids = [r[0] for r in rows]

        # If no index built yet, fall back to existing brute-force vector search
        if not pool_ids:
            dim = index_dim(con)
            qv, mode = await embed_query_matching_dim(q.question, dim)
            hits = search(con, qv, k=q.k)
            return {
                "matches": [
                    {"repo": h["repo"], "path": h["path"], "score": round(h["score"], 4), "snippet": h["text"][:600]}
                    for h in hits
                ],
                "mode": mode,
            }

        # 2) Load texts from chunks; map metadata via docs when possible
        doc_rows: List[Dict] = []
        for cid in pool_ids:
            c = con.execute("SELECT id, content, title, source_path FROM chunks WHERE id=?", (cid,)).fetchone()
            if not c:
                continue
            # Try to find a docs row to enrich repo/path/title; fallback to chunk fields
            d = con.execute("SELECT repo, path, title, text FROM docs WHERE path=? LIMIT 1", (c[3],)).fetchone() if c[3] else None
            if d:
                doc_rows.append({"id": c[0], "repo": d[0], "path": d[1], "title": d[2] or c[2], "text": d[3] or c[1]})
            else:
                doc_rows.append({"id": c[0], "repo": None, "path": c[3], "title": c[2], "text": c[1]})

        # 3) Rerank by cross-encoder; if unavailable, keep order
        pairs = [(str(d["id"]), d.get("text") or "") for d in doc_rows]
        ranked = rerank(q.question, pairs, topk=max(q.k, 5))
        order = {cid: i for i, (cid, _) in enumerate(ranked)}
        final = [d for d in doc_rows if str(d["id"]) in order]
        final.sort(key=lambda d: order[str(d["id"])])
        final = final[:q.k]
        return {
            "ok": True,
            "matches": [
                {"repo": d["repo"], "path": d["path"], "title": d.get("title"), "snippet": (d.get("text") or "")[:600]}
                for d in final
            ]
        }
    finally:
        con.close()
