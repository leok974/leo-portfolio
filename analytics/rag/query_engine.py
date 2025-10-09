"""
Vector store using SQLite for RAG-based query and context retrieval.

Phase 51.0 — Analytics Loop
"""
from __future__ import annotations
from pathlib import Path
import sqlite3
import json
import numpy as np
from datetime import datetime

DDL = """
CREATE TABLE IF NOT EXISTS vectors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  d DATE NOT NULL,
  text TEXT NOT NULL,
  embedding BLOB NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_vectors_d ON vectors(d);
"""


class VectorStore:
    """SQLite-based vector storage for analytics snippets."""

    def __init__(self, path: Path):
        """
        Initialize vector store.

        Args:
            path: Path to SQLite database file
        """
        self.path = Path(path)

    def create(self):
        """Create database schema if it doesn't exist."""
        con = sqlite3.connect(self.path)
        con.executescript(DDL)
        con.commit()
        con.close()

    def index_daily_snippets(self, data_dir: Path, embedder, lookback_days: int = 7):
        """
        Index snippets from recent daily files.

        Args:
            data_dir: Directory containing nightly JSON files
            embedder: Embedding function
            lookback_days: Number of days to index
        """
        con = sqlite3.connect(self.path)
        cur = con.cursor()

        files = sorted(data_dir.glob("*.json"))[-lookback_days:]

        for f in files:
            d = f.stem  # Date from filename

            try:
                blob = json.loads(f.read_text(encoding="utf-8"))
                snippets = _snippets_from_blob(blob)

                if not snippets:
                    continue

                # Generate embeddings
                texts = [s["text"] for s in snippets]
                embs = embedder(texts)

                # Insert into database
                for s, e in zip(snippets, embs):
                    cur.execute(
                        "INSERT INTO vectors(d, text, embedding) VALUES (?, ?, ?)",
                        (d, s["text"], e.tobytes())
                    )
            except Exception as e:
                # Skip problematic files
                print(f"Warning: Failed to index {f}: {e}")
                continue

        con.commit()
        con.close()

    def search(self, embedder, query: str, k: int = 6) -> list[dict]:
        """
        Search for similar snippets using cosine similarity.

        Args:
            embedder: Embedding function
            query: Query text
            k: Number of results to return

        Returns:
            List of {score, date, text} dictionaries
        """
        con = sqlite3.connect(self.path)

        # Generate query embedding
        qv = embedder(["query: " + query])[0]

        # Load all vectors (for small datasets this is fine)
        rows = con.execute("SELECT d, text, embedding FROM vectors").fetchall()

        scored = []
        for d, text, emb_blob in rows:
            # Deserialize embedding
            v = np.frombuffer(emb_blob, dtype=np.float32)

            # Cosine similarity (vectors are normalized)
            score = float(np.dot(qv, v))
            scored.append((score, d, text))

        con.close()

        # Sort by score descending
        scored.sort(reverse=True)

        return [
            {"score": round(s, 4), "date": d, "text": t}
            for s, d, t in scored[:k]
        ]


def _snippets_from_blob(blob: dict) -> list[dict]:
    """
    Extract text snippets from a merged nightly JSON blob.

    Args:
        blob: Merged nightly data

    Returns:
        List of {text} dictionaries
    """
    snippets = []
    d = blob.get("date", "unknown")

    # Extract KPI if available
    kpi = blob.get("kpi", {})

    # If no KPI pre-computed, try to extract
    if not kpi and any(k in blob for k in ["seo", "playwright", "autofix", "prometheus"]):
        try:
            from ..collectors.kpi_extractor import extract_kpis
            kpi = extract_kpis(blob)
        except Exception:
            pass

    # Generate snippets from KPIs
    seo_cov = kpi.get("seo_coverage_pct")
    pw_pass = kpi.get("playwright_pass_pct")
    auto_delta = kpi.get("autofix_delta_count")
    p95 = kpi.get("avg_p95_ms")

    if seo_cov is not None:
        snippets.append({"text": f"On {d}, SEO coverage was {seo_cov}%."})

    if pw_pass is not None:
        snippets.append({"text": f"On {d}, Playwright pass rate was {pw_pass}%."})

    if auto_delta is not None:
        snippets.append({"text": f"On {d}, autofix detected {auto_delta} changes."})

    if p95 is not None:
        snippets.append({"text": f"On {d}, average P95 latency was {p95}ms."})

    return snippets
