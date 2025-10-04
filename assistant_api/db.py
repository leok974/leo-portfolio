from pathlib import Path
import sqlite3, numpy as np, json, os

DB_PATH = os.environ.get("RAG_DB", "./data/rag.sqlite")
Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)

def connect():
        # Use a small timeout and WAL to reduce lock contention; allow cross-thread use from async contexts
        conn = sqlite3.connect(DB_PATH, timeout=5.0, check_same_thread=False)
        try:
                conn.execute("PRAGMA journal_mode=WAL;")
                conn.execute("PRAGMA busy_timeout=3000;")
        except Exception:
                pass
        # Base tables: docs + vecs (Phase 1)
        conn.execute(
                """CREATE TABLE IF NOT EXISTS docs(
            id TEXT PRIMARY KEY, repo TEXT, path TEXT, sha TEXT,
            title TEXT, text TEXT, meta TEXT
        )"""
        )
        conn.execute(
                """CREATE TABLE IF NOT EXISTS vecs(
            id TEXT PRIMARY KEY, embedding BLOB
        )"""
        )
        # Hybrid retrieval helper table (Phase 2)
        conn.execute(
                """
            CREATE TABLE IF NOT EXISTS chunks(
                id INTEGER PRIMARY KEY,
                content TEXT NOT NULL,
                source_path TEXT,
                title TEXT,
                project_id TEXT
            )
        """
        )
        return conn

def upsert_doc(conn, row):
    conn.execute(
        "REPLACE INTO docs(id,repo,path,sha,title,text,meta) VALUES(?,?,?,?,?,?,?)",
        (
            row["id"],
            row["repo"],
            row["path"],
            row["sha"],
            row["title"],
            row["text"],
            json.dumps(row.get("meta", {})),
        ),
    )

def upsert_vec(conn, id, emb: np.ndarray):
    conn.execute("REPLACE INTO vecs(id,embedding) VALUES(?,?)", (id, emb.astype(np.float32).tobytes()))

def insert_chunk(conn, content: str, source_path: str | None, title: str | None, project_id: str | None) -> int:
    cur = conn.execute(
        "INSERT INTO chunks(content, source_path, title, project_id) VALUES(?,?,?,?)",
        (content or "", source_path, title, project_id)
    )
    return int(cur.lastrowid)

def search(conn, query_vec: np.ndarray, k=8):
    # brute-force cosine (fast enough <50k chunks). Swap later for FAISS index table.
    cur = conn.execute("SELECT id, embedding FROM vecs")
    rows = cur.fetchall()
    if not rows:
        return []
    ids, mats = zip(*rows)
    X = np.vstack([np.frombuffer(b, dtype=np.float32) for b in mats])
    q = query_vec / (np.linalg.norm(query_vec) + 1e-9)
    Xn = X / (np.linalg.norm(X, axis=1, keepdims=True) + 1e-9)
    sims = Xn @ q
    top = np.argsort(-sims)[:k]
    res = []
    for i in top:
        did = ids[int(i)]
        sim = float(sims[int(i)])
        d = conn.execute("SELECT repo,path,title,text,meta FROM docs WHERE id=?", (did,)).fetchone()
        if d:
            res.append(
                {
                    "id": did,
                    "score": sim,
                    "repo": d[0],
                    "path": d[1],
                    "title": d[2],
                    "text": d[3],
                    "meta": json.loads(d[4] or "{}"),
                }
            )
    return res

def index_dim(conn) -> int | None:
    """Return the dominant embedding dimension stored in the index, or None if empty.
    Uses SQL LENGTH aggregation to avoid loading all blobs.
    """
    # Prefer the most frequent length; tie-break by larger length
    cur = conn.execute(
        "SELECT LENGTH(embedding) AS L, COUNT(*) AS C FROM vecs GROUP BY L ORDER BY C DESC, L DESC LIMIT 1"
    )
    row = cur.fetchone()
    if not row:
        return None
    try:
        return int(row[0] // 4)
    except Exception:
        return None
