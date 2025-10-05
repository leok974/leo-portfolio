from assistant_api.db import connect
from assistant_api.ingest import ingest_direct
from assistant_api.main import app
from fastapi.testclient import TestClient
import os

def test_cache_roundtrip(tmp_path, monkeypatch):
    db_path = tmp_path / "rag.sqlite"
    monkeypatch.setenv("RAG_DB", str(db_path))
    # Seed content
    ingest_direct(project_id="demo", doc_id="d1", text="Alpha beta gamma", meta={})
    c = TestClient(app)
    r1 = c.post("/api/rag/query", json={"question": "alpha beta", "k": 5})
    assert r1.status_code == 200
    b1 = r1.json()
    assert b1.get("ok") is True
    assert b1.get("cache") in (False, None)  # first call should not be cache
    r2 = c.post("/api/rag/query", json={"question": "alpha beta", "k": 5})
    assert r2.status_code == 200
    b2 = r2.json()
    assert b2.get("ok") is True
    assert b2.get("cache") is True
