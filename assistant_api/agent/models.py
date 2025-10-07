from dataclasses import dataclass, asdict
from datetime import datetime
from typing import Optional, Dict, Any, List
import sqlite3, json, os

DB_PATH = os.environ.get("RAG_DB", "./data/rag.sqlite")


def _con():
    con = sqlite3.connect(DB_PATH)
    con.execute(
        """CREATE TABLE IF NOT EXISTS agent_jobs(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id TEXT, task TEXT, status TEXT, started_at TEXT, finished_at TEXT,
        meta TEXT
    )"""
    )
    con.execute(
        """CREATE TABLE IF NOT EXISTS agent_events(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id TEXT, ts TEXT, level TEXT, event TEXT, data TEXT
    )"""
    )
    return con


def insert_job(run_id, task, status="queued", meta=None):
    con = _con()
    con.execute(
        "INSERT INTO agent_jobs(run_id,task,status,started_at,meta) VALUES(?,?,?,?,?)",
        (
            run_id,
            task,
            "queued",
            datetime.utcnow().isoformat(),
            json.dumps(meta or {}),
        ),
    )
    con.commit()
    con.close()


def update_job(run_id, task, status, meta=None):
    con = _con()
    con.execute(
        "UPDATE agent_jobs SET status=?, finished_at=?, meta=? WHERE run_id=? AND task=?",
        (status, datetime.utcnow().isoformat(), json.dumps(meta or {}), run_id, task),
    )
    con.commit()
    con.close()


def emit(run_id, level, event, data=None):
    con = _con()
    con.execute(
        "INSERT INTO agent_events(run_id,ts,level,event,data) VALUES(?,?,?,?,?)",
        (
            run_id,
            datetime.utcnow().isoformat(),
            level,
            event,
            json.dumps(data or {}),
        ),
    )
    con.commit()
    con.close()


def recent_runs(limit=10):
    con = _con()
    rows = con.execute(
        """
        SELECT run_id, MIN(started_at), MAX(finished_at),
               SUM(status='ok'), SUM(status='error'), COUNT(*)
        FROM agent_jobs GROUP BY run_id
        ORDER BY MAX(id) DESC LIMIT ?
        """,
        (limit,),
    ).fetchall()
    con.close()
    return rows


def query_events(level: Optional[str] = None, run_id: Optional[str] = None, limit: int = 10):
    """Query agent events with optional filtering by level and run_id."""
    con = _con()
    query = "SELECT run_id, ts, level, event, data FROM agent_events"
    conditions = []
    params = []
    
    if level:
        conditions.append("level = ?")
        params.append(level)
    
    if run_id:
        conditions.append("run_id = ?")
        params.append(run_id)
    
    if conditions:
        query += " WHERE " + " AND ".join(conditions)
    
    query += " ORDER BY id DESC LIMIT ?"
    params.append(limit)
    
    rows = con.execute(query, params).fetchall()
    con.close()
    
    # Convert rows to dictionaries
    events = []
    for r in rows:
        try:
            data_dict = json.loads(r[4]) if r[4] else {}
        except:
            data_dict = {}
        events.append({
            "run_id": r[0],
            "ts": r[1],
            "level": r[2],
            "event": r[3],
            "data": data_dict
        })
    
    return events
