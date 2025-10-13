import json
import os
import sqlite3
import time
from collections.abc import Generator
from pathlib import Path

import numpy as np
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# SQLAlchemy Base for ORM models (agents_tasks, etc.)
Base = declarative_base()

# Legacy constant kept for backward compatibility, but connect() now resolves RAG_DB dynamically
DB_PATH = os.environ.get("RAG_DB", "./data/rag.sqlite")

# SQLAlchemy engine and session for ORM models
# Default to SQLite, but can be overridden with DATABASE_URL env var for PostgreSQL
DATABASE_URL = os.environ.get("DATABASE_URL") or os.environ.get("DB_URL")
if not DATABASE_URL:
    AGENTS_DB = os.environ.get("AGENTS_DB", DB_PATH)
    Path(AGENTS_DB).parent.mkdir(parents=True, exist_ok=True)
    DATABASE_URL = f"sqlite:///{AGENTS_DB}"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {},
    pool_pre_ping=True,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator:
    """FastAPI dependency for SQLAlchemy database sessions."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


_LOCK_MSG = "database is locked"


def _configure_connection(conn: sqlite3.Connection) -> sqlite3.Connection:
    """Apply pragmas that reduce lock contention and keep WAL on."""
    try:
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA synchronous=NORMAL;")
        conn.execute("PRAGMA busy_timeout=10000;")
    except Exception:
        pass
    return conn


def connect(retries: int = 5, base_sleep: float = 0.2) -> sqlite3.Connection:
    """Connect to the SQLite DB with retry/backoff when the file is locked."""
    attempt = 0
    while True:
        try:
            # Resolve DB path at call time to honor late env overrides in tests/tools
            db_path = os.environ.get("RAG_DB", DB_PATH)
            try:
                Path(db_path).parent.mkdir(parents=True, exist_ok=True)
            except Exception:
                pass
            conn = sqlite3.connect(db_path, timeout=30.0, check_same_thread=False)
            conn = _configure_connection(conn)
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
            # Extend chunks schema for direct ingest if columns are missing (safe ALTERs)
            try:
                cols = {
                    r[1] for r in conn.execute("PRAGMA table_info('chunks')").fetchall()
                }
                to_add = []
                if "doc_id" not in cols:
                    to_add.append("ALTER TABLE chunks ADD COLUMN doc_id TEXT")
                if "ordinal" not in cols:
                    to_add.append("ALTER TABLE chunks ADD COLUMN ordinal INTEGER")
                if "text" not in cols:
                    to_add.append("ALTER TABLE chunks ADD COLUMN text TEXT")
                if "meta" not in cols:
                    to_add.append("ALTER TABLE chunks ADD COLUMN meta TEXT")
                if "created_at" not in cols:
                    to_add.append(
                        "ALTER TABLE chunks ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP"
                    )
                for stmt in to_add:
                    try:
                        conn.execute(stmt)
                    except Exception:
                        pass
            except Exception:
                pass
            # Helpful indexes
            try:
                conn.execute(
                    "CREATE INDEX IF NOT EXISTS idx_chunks_project ON chunks(project_id)"
                )
                conn.execute(
                    "CREATE INDEX IF NOT EXISTS idx_chunks_doc ON chunks(doc_id)"
                )
            except Exception:
                pass
            # Lightweight FTS5 virtual table over chunks.text for offsets() highlighting
            try:
                conn.execute(
                    """
                CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts
                USING fts5(text, content='chunks', content_rowid='id')
                """
                )
                # Triggers to keep in sync
                conn.execute(
                    """
                CREATE TRIGGER IF NOT EXISTS chunks_ai AFTER INSERT ON chunks BEGIN
                  INSERT INTO chunks_fts(rowid, text) VALUES (new.id, COALESCE(new.text, new.content));
                END;
                """
                )
                conn.execute(
                    """
                CREATE TRIGGER IF NOT EXISTS chunks_ad AFTER DELETE ON chunks BEGIN
                  INSERT INTO chunks_fts(chunks_fts, rowid, text) VALUES('delete', old.id, COALESCE(old.text, old.content));
                END;
                """
                )
                conn.execute(
                    """
                CREATE TRIGGER IF NOT EXISTS chunks_au AFTER UPDATE ON chunks BEGIN
                  INSERT INTO chunks_fts(chunks_fts, rowid, text) VALUES('delete', old.id, COALESCE(old.text, old.content));
                  INSERT INTO chunks_fts(rowid, text) VALUES (new.id, COALESCE(new.text, new.content));
                END;
                """
                )
            except Exception:
                pass
            # Answers cache table for fused queries
            try:
                conn.execute(
                    """
                CREATE TABLE IF NOT EXISTS answers_cache(
                  project_id TEXT,
                  query_hash TEXT PRIMARY KEY,
                  answer TEXT,
                  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
                """
                )
            except Exception:
                pass
            return conn
        except sqlite3.OperationalError as exc:
            if _LOCK_MSG not in str(exc) or attempt >= retries:
                raise
            time.sleep(base_sleep * (2**attempt))
            attempt += 1


def commit_with_retry(
    conn: sqlite3.Connection, retries: int = 5, base_sleep: float = 0.2
) -> None:
    """Attempt to commit with exponential backoff when the DB is locked."""
    for attempt in range(retries):
        try:
            conn.commit()
            return
        except sqlite3.OperationalError as exc:
            if _LOCK_MSG not in str(exc) or attempt == retries - 1:
                raise
            time.sleep(base_sleep * (2**attempt))


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
    conn.execute(
        "REPLACE INTO vecs(id,embedding) VALUES(?,?)",
        (id, emb.astype(np.float32).tobytes()),
    )


def insert_chunk(
    conn,
    content: str,
    source_path: str | None,
    title: str | None,
    project_id: str | None,
) -> int:
    cur = conn.execute(
        "INSERT INTO chunks(content, source_path, title, project_id) VALUES(?,?,?,?)",
        (content or "", source_path, title, project_id),
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
        d = conn.execute(
            "SELECT repo,path,title,text,meta FROM docs WHERE id=?", (did,)
        ).fetchone()
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


# Alias used by ingest helpers
def get_conn() -> sqlite3.Connection:
    return connect()


def rebuild_fts(conn: sqlite3.Connection) -> None:
    with conn:
        conn.execute("DELETE FROM chunks_fts;")
        conn.execute(
            "INSERT INTO chunks_fts(rowid, text) SELECT id, COALESCE(text, content) FROM chunks;"
        )
