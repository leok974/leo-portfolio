from assistant_api.main import app
from assistant_api.ingest import ingest_direct
from fastapi.testclient import TestClient
import os

def test_pagination_limit_offset(tmp_path, monkeypatch):
    db_path = tmp_path / "rag.sqlite"
    monkeypatch.setenv("RAG_DB", str(db_path))
    # Insert > 25 chunks by creating many small lines
    text = "\n".join([f"line {i} about pagination" for i in range(30)])
    ingest_direct(project_id="demo", doc_id="p1", text=text, meta={})
    c = TestClient(app)
    r1 = c.post("/api/rag/query?project_id=demo&limit=10&offset=0", json={"question": "pagination", "k": 50})
    assert r1.status_code == 200
    b1 = r1.json(); hits1 = b1.get("hits", [])
    assert len(hits1) <= 10
    if len(hits1) == 10:
        assert b1.get("next_offset") == 10
    r2 = c.post("/api/rag/query?project_id=demo&limit=10&offset=10", json={"question": "pagination", "k": 50})
    assert r2.status_code == 200
    b2 = r2.json(); hits2 = b2.get("hits", [])
    assert len(hits2) <= 10
