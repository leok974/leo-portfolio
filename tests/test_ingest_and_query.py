from fastapi.testclient import TestClient
from assistant_api.main import app
from assistant_api.ingest import ingest_direct
from assistant_api.db import get_conn


def test_ingest_direct_creates_chunks(tmp_path, monkeypatch):
    # Use a temp DB
    db_path = tmp_path / "rag.sqlite"
    monkeypatch.setenv("RAG_DB", str(db_path))
    con = get_conn()
    try:
        ingest_direct(project_id="p1", doc_id="d1", text="hello world\nthis is a test", meta={"path": "x.txt"})
        n = con.execute("SELECT COUNT(1) FROM chunks").fetchone()[0]
        assert n >= 1
    finally:
        con.close()


def test_query_project_filtering(tmp_path, monkeypatch):
    db_path = tmp_path / "rag.sqlite"
    monkeypatch.setenv("RAG_DB", str(db_path))
    # seed two projects
    ingest_direct(project_id="alpha", doc_id="a1", text="the quick brown fox jumps", meta={})
    ingest_direct(project_id="beta", doc_id="b1", text="over the lazy dog", meta={})
    c = TestClient(app)
    # default (no filter) should include both in aggregate matches depending on bm25
    r = c.post("/api/rag/query", json={"question": "quick or lazy", "k": 5})
    assert r.status_code == 200
    data = r.json()
    assert data.get("ok") is True or data.get("matches") is not None
    # filter alpha only
    r2 = c.post("/api/rag/query?project_id=alpha", json={"question": "quick", "k": 5})
    assert r2.status_code == 200
    d2 = r2.json()
    assert d2.get("ok") is True
