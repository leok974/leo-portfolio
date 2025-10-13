import os
import re
import sqlite3
from typing import List


def _db():
    path = os.environ.get("RAG_DB")
    if not path:
        raise RuntimeError("RAG_DB not set")
    con = sqlite3.connect(path)
    con.execute("PRAGMA journal_mode=WAL")
    return con


def ensure_fts_schema():
    con = _db()
    try:
        con.execute(
            """
          CREATE VIRTUAL TABLE IF NOT EXISTS fts_chunks USING fts5(
            content, title, source_path, project_id, chunk_id UNINDEXED, tokenize = 'porter'
          );
        """
        )
        con.execute("CREATE INDEX IF NOT EXISTS ix_chunks_id ON chunks(id)")
    finally:
        con.close()


def backfill_chunks_from_docs():
    """Populate chunks from docs if chunks is empty. Extract project_id from docs.meta.
    Useful migration to enable FAISS/FTS without changing ingest immediately.
    """
    con = _db()
    try:
        cur = con.cursor()
        # If chunks already has rows, do nothing
        n = cur.execute("SELECT COUNT(1) FROM chunks").fetchone()[0]
        if n and int(n) > 0:
            return {"ok": True, "skipped": True, "count": int(n)}
        rows = cur.execute("SELECT id, path, title, text, meta FROM docs").fetchall()
        to_ins = []
        for _id, path, title, text, meta_json in rows:
            proj = None
            try:
                meta = __import__("json").loads(meta_json or "{}")
                proj = meta.get("project_id")
            except Exception:
                proj = None
            to_ins.append((text or "", path, title, proj))
        cur.executemany(
            "INSERT INTO chunks(content, source_path, title, project_id) VALUES(?,?,?,?)",
            to_ins,
        )
        con.commit()
        return {"ok": True, "inserted": len(to_ins)}
    finally:
        con.close()


def rebuild_fts():
    con = _db()
    cur = con.cursor()
    cur.execute("DELETE FROM fts_chunks")
    cur.execute("SELECT id, content, title, source_path, project_id FROM chunks")
    rows = cur.fetchall()
    cur.executemany(
        "INSERT INTO fts_chunks(content, title, source_path, project_id, chunk_id) VALUES(?,?,?,?,?)",
        [(r[1] or "", r[2] or "", r[3] or "", r[4] or "", r[0]) for r in rows],
    )
    con.commit()
    con.close()
    return {"ok": True, "count": len(rows)}


def _sanitize_match_query(q: str) -> str:
    """Very small sanitizer for FTS MATCH. We cannot use bound parameters with MATCH
    on some SQLite builds. Keep only word-ish tokens and hyphens, join by space.
    """
    toks = re.findall(r"[\w-]+", q.lower())
    return " ".join(toks) or "*"


def bm25_search(query: str, topk: int = 50) -> list[int]:
    con = _db()
    try:
        q = _sanitize_match_query(query)

        # Prefer legacy fts_chunks when present; else use chunks_fts (rowid maps to chunks.id)
        def _exists(name: str) -> bool:
            try:
                return (
                    con.execute(
                        "SELECT 1 FROM sqlite_master WHERE type IN ('table','view') AND name=?",
                        (name,),
                    ).fetchone()
                    is not None
                )
            except Exception:
                return False

        if _exists("fts_chunks"):
            sql = f"SELECT chunk_id FROM fts_chunks WHERE fts_chunks MATCH '{q}' ORDER BY rank LIMIT ?"
            rows = list(con.execute(sql, (topk,)))
            return [r[0] for r in rows]
        elif _exists("chunks_fts"):
            sql = f"SELECT rowid FROM chunks_fts WHERE chunks_fts MATCH '{q}' ORDER BY bm25(chunks_fts) LIMIT ?"
            rows = list(con.execute(sql, (topk,)))
            return [r[0] for r in rows]
        else:
            return []
    finally:
        con.close()


def bm25_search_scored(query: str, topk: int = 50) -> list[dict]:
    """Return a scored BM25 list with project_id included when available.

    Shape: [{"id": int, "project_id": str|None, "score": float}, ...]
    """
    con = _db()
    try:
        q = _sanitize_match_query(query)

        # Support both legacy fts_chunks and new chunks_fts
        def _exists(name: str) -> bool:
            try:
                return (
                    con.execute(
                        "SELECT 1 FROM sqlite_master WHERE type IN ('table','view') AND name=?",
                        (name,),
                    ).fetchone()
                    is not None
                )
            except Exception:
                return False

        out: list[dict] = []
        if _exists("fts_chunks"):
            sql = (
                f"SELECT chunk_id, project_id, bm25(fts_chunks) AS score "
                f"FROM fts_chunks WHERE fts_chunks MATCH '{q}' ORDER BY score LIMIT ?"
            )
            rows = list(con.execute(sql, (topk,)))
            for r in rows:
                cid = r[0]
                proj = r[1]
                try:
                    sc = float(r[2])
                except Exception:
                    sc = 0.0
                out.append({"id": cid, "project_id": proj, "score": sc})
        elif _exists("chunks_fts"):
            sql = (
                f"SELECT rowid, bm25(chunks_fts) AS score "
                f"FROM chunks_fts WHERE chunks_fts MATCH '{q}' ORDER BY score LIMIT ?"
            )
            rows = list(con.execute(sql, (topk,)))
            for r in rows:
                cid = r[0]
                try:
                    sc = float(r[1])
                except Exception:
                    sc = 0.0
                out.append({"id": cid, "project_id": None, "score": sc})
        return out
    finally:
        con.close()


# --- schema helpers -------------------------------------------------------
def ensure_chunk_indexes(conn=None):
    """
    Ensure useful indexes on chunks. Safe to call repeatedly.
    """
    try:
        from .db import connect  # type: ignore
    except Exception:  # pragma: no cover - fallback import path
        from assistant_api.db import connect  # type: ignore

    con = conn or connect()
    try:
        con.execute(
            "CREATE INDEX IF NOT EXISTS idx_chunks_project ON chunks(project_id)"
        )
        con.commit()
    finally:
        if conn is None:
            try:
                con.close()
            except Exception:
                pass
    return {"ok": True, "indexes": ["idx_chunks_project"]}


# --- FTS highlighting utilities -------------------------------------------
def fts_offsets_to_hits(offsets_str: str) -> list[tuple[int, int]]:
    """Convert FTS5 offsets() string to a list of (start, length) tuples.
    Format: "col term pos off len col term pos off len ...". We only have one
    column in chunks_fts, but multiple hits.
    """
    if not offsets_str:
        return []
    try:
        toks = [int(x) for x in offsets_str.split()]
        return [(toks[i + 3], toks[i + 4]) for i in range(0, len(toks), 5)]
    except Exception:
        return []


def highlight_snippet(
    text: str, hits: list[tuple[int, int]], max_marks: int = 6
) -> str:
    markers: list[tuple[int, str]] = []
    for start, length in hits[:max_marks]:
        markers.append((start, "<mark>"))
        markers.append((start + length, "</mark>"))
    markers.sort(key=lambda x: x[0])
    out: list[str] = []
    i = 0
    for pos, tag in markers:
        out.append((text or "")[i:pos])
        out.append(tag)
        i = pos
    out.append((text or "")[i:])
    return "".join(out)
