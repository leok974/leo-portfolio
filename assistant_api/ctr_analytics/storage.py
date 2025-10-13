# assistant_api/analytics/storage.py
from __future__ import annotations

import sqlite3
from collections.abc import Iterable
from dataclasses import dataclass
from typing import List


@dataclass
class CTRRow:
    url: str
    impressions: int
    clicks: int
    ctr: float
    last_seen: str
    source: str

def _conn(db_path: str):
    return sqlite3.connect(db_path, check_same_thread=False)

def ensure_tables(db_path: str):
    with _conn(db_path) as c:
        c.execute("""
        CREATE TABLE IF NOT EXISTS analytics_ctr (
          url TEXT PRIMARY KEY,
          impressions INTEGER NOT NULL,
          clicks INTEGER NOT NULL,
          ctr REAL NOT NULL,
          last_seen TEXT NOT NULL,
          source TEXT NOT NULL
        )
        """)
        c.commit()

def upsert_ctr_rows(db_path: str, rows: Iterable[CTRRow]) -> int:
    with _conn(db_path) as c:
        c.executemany("""
        INSERT INTO analytics_ctr (url, impressions, clicks, ctr, last_seen, source)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(url) DO UPDATE SET
          impressions = excluded.impressions,
          clicks = excluded.clicks,
          ctr = excluded.ctr,
          last_seen = excluded.last_seen,
          source = excluded.source
        """, [(r.url, r.impressions, r.clicks, r.ctr, r.last_seen, r.source) for r in rows])
        c.commit()
        return c.total_changes

def fetch_below_ctr(db_path: str, threshold: float) -> list[CTRRow]:
    with _conn(db_path) as c:
        cur = c.execute("""
        SELECT url, impressions, clicks, ctr, last_seen, source
        FROM analytics_ctr
        WHERE ctr < ?
        ORDER BY ctr ASC
        """, (threshold,))
        out = []
        for url, imp, clk, ctr, last_seen, source in cur.fetchall():
            out.append(CTRRow(url=url, impressions=imp, clicks=clk, ctr=ctr, last_seen=last_seen, source=source))
        return out
