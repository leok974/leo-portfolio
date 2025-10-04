import os, sqlite3, re
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
        con.execute("""
          CREATE VIRTUAL TABLE IF NOT EXISTS fts_chunks USING fts5(
            content, title, source_path, project_id, chunk_id UNINDEXED, tokenize = 'porter'
          );
        """)
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
        for (_id, path, title, text, meta_json) in rows:
            proj = None
            try:
                meta = __import__('json').loads(meta_json or "{}")
                proj = meta.get("project_id")
            except Exception:
                proj = None
            to_ins.append((text or "", path, title, proj))
        cur.executemany(
            "INSERT INTO chunks(content, source_path, title, project_id) VALUES(?,?,?,?)",
            to_ins
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
        [(r[1] or "", r[2] or "", r[3] or "", r[4] or "", r[0]) for r in rows]
    )
    con.commit(); con.close()
    return {"ok": True, "count": len(rows)}

def _sanitize_match_query(q: str) -> str:
    """Very small sanitizer for FTS MATCH. We cannot use bound parameters with MATCH
    on some SQLite builds. Keep only word-ish tokens and hyphens, join by space.
    """
    toks = re.findall(r"[\w-]+", q.lower())
    return " ".join(toks) or "*"

def bm25_search(query: str, topk: int = 50) -> List[int]:
    con = _db()
    try:
        q = _sanitize_match_query(query)
        # Embed sanitized query directly; keep LIMIT as a bound parameter
        sql = f"SELECT chunk_id FROM fts_chunks WHERE fts_chunks MATCH '{q}' ORDER BY rank LIMIT ?"
        rows = list(con.execute(sql, (topk,)))
        return [r[0] for r in rows]
    finally:
        con.close()
