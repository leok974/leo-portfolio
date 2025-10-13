import hashlib
import json
import math
import os
import time
from datetime import datetime
from typing import Dict, List

import numpy as np
from fastapi import APIRouter, Query
from pydantic import BaseModel

from .db import connect, index_dim, search
from .fts import _sanitize_match_query, bm25_search
from .guardrails import sanitize_snippet
from .reranker import rerank
from .vector_store import dense_search

router = APIRouter()

# Feature flags and limits
RAG_ENABLE_CACHE: bool = os.getenv("RAG_ENABLE_CACHE", "1") != "0"
RAG_ENABLE_FUSION: bool = os.getenv("RAG_ENABLE_FUSION", "1") != "0"
MAX_LIMIT: int = int(os.getenv("RAG_MAX_LIMIT", "100"))

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
            return open(p, encoding="utf-8").read().strip()
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


def _qkey(project_ids: list[str], q: str) -> tuple[str, str]:
    pj = ",".join(sorted(project_ids or []))
    return pj, hashlib.sha1((pj + "|" + q).encode()).hexdigest()


def _get_cache(con, pj: str, h: str):
    row = con.execute("SELECT answer FROM answers_cache WHERE project_id=? AND query_hash=?", (pj, h)).fetchone()
    return row and json.loads(row[0])


def _put_cache(con, pj: str, h: str, ans: dict) -> None:
    con.execute("REPLACE INTO answers_cache(project_id,query_hash,answer) VALUES (?,?,?)", (pj, h, json.dumps(ans)))
    try:
        con.commit()
    except Exception:
        pass


def _build_snippet(con, chunk_id: int, txt: str, match_expr: str) -> str:
    try:
        q = _sanitize_match_query(match_expr)
        # Use FTS5 highlight() to wrap matching terms
        sql = (
            "SELECT highlight(chunks_fts, 0, '<mark>', '</mark>') AS snip "
            "FROM chunks_fts WHERE rowid = ? AND chunks_fts MATCH '" + q + "'"
        )
        row = con.execute(sql, (chunk_id,)).fetchone()
        snip = (row and row[0]) or ""
        if not snip:
            return sanitize_snippet((txt or "")[:300])
        # Crop around first highlight to keep snippet compact
        i = snip.find("<mark>")
        if i == -1:
            return sanitize_snippet(snip[:300])
        start = max(0, i - 80)
        end = min(len(snip), i + 220)
        return sanitize_snippet(snip[start:end])
    except Exception:
        # fallback: sanitized prefix
        return sanitize_snippet((txt or "")[:300])


@router.post("/rag/query")
async def rag_query(
    q: QueryIn,
    project_id: list[str] = Query(default=[]),
    limit: int = Query(20, ge=1, le=MAX_LIMIT),
    offset: int = Query(0, ge=0),
    phrase_boost: float = Query(0.6, ge=0, le=2.0),
    near_boost: float = Query(0.4, ge=0, le=2.0),
    k: int = Query(30, ge=1, le=200),
):
    con = connect()
    try:
        # If explicit project_id list provided via query param, it overrides body single project_id
        projects: list[str] = project_id or ([q.project_id] if q.project_id else [])
        # Cache key
        pj, h = _qkey(projects, q.question)
        cached = None
        if RAG_ENABLE_CACHE:
            try:
                cached = _get_cache(con, pj, h)
            except Exception:
                cached = None
            if cached:
                try:
                    cached["cache"] = True
                except Exception:
                    pass
                return cached
        t0 = time.perf_counter()
        # 1) Recall: BM25 + dense
        bm = bm25_search(q.question, topk=50)
        dn = dense_search(q.question, topk=50)
        pool_ids = list(dict.fromkeys(bm + dn))  # stable dedupe

        # Optional filter by project_id(s) if provided (if chunks table exists)
        if projects and pool_ids:
            ph = ",".join("?" for _ in pool_ids)
            pph = ",".join("?" for _ in projects)
            rows = con.execute(
                f"SELECT id FROM chunks WHERE id IN ({ph}) AND project_id IN ({pph})",
                (*pool_ids, *projects),
            ).fetchall()
            pool_ids = [r[0] for r in rows]

        # If no index built yet, fall back to existing brute-force vector search
        if not pool_ids:
            dim = index_dim(con)
            qv, mode = await embed_query_matching_dim(q.question, dim)
            hits = search(con, qv, k=q.k)
            return {
                "ok": True,
                "matches": [
                    {"repo": h["repo"], "path": h["path"], "score": round(h["score"], 4), "snippet": sanitize_snippet(h["text"][:600])}
                    for h in hits
                ],
                "mode": mode,
            }

        # 2) Load texts from chunks; map metadata via docs when possible
        doc_rows: list[dict] = []
        for cid in pool_ids:
            c = con.execute("SELECT id, content, title, source_path, text FROM chunks WHERE id= ?", (cid,)).fetchone()
            if not c:
                continue
            # Try to find a docs row to enrich repo/path/title; fallback to chunk fields
            d = con.execute("SELECT repo, path, title, text FROM docs WHERE path=? LIMIT 1", (c[3],)).fetchone() if c[3] else None
            if d:
                doc_rows.append({"id": c[0], "repo": d[0], "path": d[1], "title": d[2] or c[2], "text": d[3] or (c[4] or c[1])})
            else:
                doc_rows.append({"id": c[0], "repo": None, "path": c[3], "title": c[2], "text": (c[4] or c[1])})

        # 3) Rerank by cross-encoder; if unavailable, keep order
        pairs = [(str(d["id"]), d.get("text") or "") for d in doc_rows]
        ranked = rerank(q.question, pairs, topk=max(q.k, 5))
        order = {cid: i for i, (cid, _) in enumerate(ranked)}
        final = [d for d in doc_rows if str(d["id"]) in order]
        final.sort(key=lambda d: order[str(d["id"])])
        final = final[:q.k]
        # Also compute fused scores via simple rewrite on chunks_fts for snippet-highlights and experimentation
        base = q.question.strip()
        variants: list[tuple[str, float]] = []
        scores: dict[int, float] = {}
        if RAG_ENABLE_FUSION:
            # Build variants
            variants = [(base, 1.0)]
            tokens = base.split()
            if len(tokens) >= 2:
                variants += [(f'"{base}"', phrase_boost)]
                near_expr = f"{tokens[0]} NEAR {tokens[-1]}"
                variants += [(near_expr, near_boost)]
            # Fuse
            if variants:
                and_proj = ""
                proj_params: list[str] = []
                if projects:
                    and_proj = " AND c.project_id IN (" + ",".join(["?"] * len(projects)) + ")"
                    proj_params = list(projects)
                for expr, w in variants:
                    sql = (
                        "SELECT c.id as id, bm25(chunks_fts) as s "
                        "FROM chunks_fts f JOIN chunks c ON c.id=f.rowid "
                        "WHERE chunks_fts MATCH ?" + and_proj + " LIMIT ?"
                    )
                    params = [expr] + proj_params + [k]
                    for rid, s in con.execute(sql, params):
                        # FTS5 bm25() returns a rank where lower is better; clamp and use a safe inverse
                        try:
                            sv = float(s)
                        except Exception:
                            continue
                        if not math.isfinite(sv):
                            continue
                        # Ensure non-negative and avoid zero denominator
                        sv = max(0.0, sv)
                        denom = 1.0 + sv  # 1 at best (sv=0), grows with worse rank
                        contrib = (1.0 / denom) * float(w)
                        scores[int(rid)] = scores.get(int(rid), 0.0) + contrib
        # Tie-break stability: order by score DESC, ordinal ASC, created_at DESC
        ids_all = list(scores.keys()) if scores else [d["id"] for d in final]
        ord_map: dict[int, int | None] = {}
        ts_map: dict[int, float] = {}
        if ids_all:
            # Check if created_at exists
            has_created = False
            try:
                cols = {row[1] for row in con.execute("PRAGMA table_info('chunks')").fetchall()}
                has_created = 'created_at' in cols
            except Exception:
                has_created = False
            placeholders = ",".join(["?"] * len(ids_all))
            if has_created:
                rows_meta = con.execute(
                    f"SELECT id, ordinal, created_at FROM chunks WHERE id IN ({placeholders})",
                    ids_all,
                ).fetchall()
                for r in rows_meta:
                    cid = int(r[0]); ord_map[cid] = r[1]
                    ts = 0.0
                    try:
                        if r[2]:
                            ts = datetime.strptime(str(r[2]), "%Y-%m-%d %H:%M:%S").timestamp()
                    except Exception:
                        ts = 0.0
                    ts_map[cid] = ts
            else:
                rows_meta = con.execute(
                    f"SELECT id, ordinal FROM chunks WHERE id IN ({placeholders})",
                    ids_all,
                ).fetchall()
                for r in rows_meta:
                    cid = int(r[0]); ord_map[cid] = r[1]
                    ts_map[cid] = 0.0
        def _sort_key(cid: int):
            score = scores.get(cid, 0.0)
            ordv = ord_map.get(cid)
            ordv_num = ordv if (isinstance(ordv, int)) else 1_000_000_000
            tsv = ts_map.get(cid, 0.0)
            return (-float(score), ordv_num, -float(tsv))
        ids_sorted = sorted(ids_all, key=_sort_key)
        # Pagination
        paged_ids = ids_sorted[offset: offset + limit]
        rows = (
            con.execute(
                "SELECT id, project_id, doc_id, COALESCE(text, content) FROM chunks WHERE id IN ("
                + ",".join(["?"] * len(paged_ids))
                + ")",
                paged_ids,
            ).fetchall()
            if paged_ids
            else []
        )
        hits = []
        for r in rows:
            cid, pid, did, txt = int(r[0]), r[1], r[2], r[3]
            hits.append(
                {
                    "id": cid,
                    "project_id": pid,
                    "doc_id": did,
                    "snippet": _build_snippet(con, cid, txt, base),
                    "text": None,
                }
            )
        elapsed_ms = (time.perf_counter() - t0) * 1000.0
        resp = {
            "ok": True,
            "matches": [
                {"repo": d["repo"], "path": d["path"], "title": d.get("title"), "snippet": sanitize_snippet((d.get("text") or "")[:600])}
                for d in final
            ],
            "hits": hits,
            "count": len(hits),
            "next_offset": (offset + len(hits)) if len(hits) == limit else None,
            "meta": {"elapsed_ms": round(elapsed_ms, 2), "variants": len(variants or []), "candidates": k},
        }
        if RAG_ENABLE_CACHE:
            try:
                _put_cache(con, pj, h, resp | {"cache": False})
            except Exception:
                pass
        return resp
    finally:
        con.close()
