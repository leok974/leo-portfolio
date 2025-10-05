from fastapi.testclient import TestClient
from assistant_api.main import app
from assistant_api.ingest import ingest_direct
from assistant_api.db import get_conn


def test_snippet_marks(tmp_path, monkeypatch):
    db_path = tmp_path / "rag.sqlite"
    monkeypatch.setenv("RAG_DB", str(db_path))
    # Seed a simple doc containing both words
    ingest_direct(project_id="demo", doc_id="x1", text="Ledger reconciliation is part of accounting. Ledger reconciliation helps.", meta={})
    c = TestClient(app)
    r = c.post("/api/rag/query", json={"question": "ledger reconciliation", "k": 5})
    assert r.status_code == 200
    body = r.json()
    # Prefer hits list (fusion path)
    hits = body.get("hits", [])
    assert any("<mark>" in (h.get("snippet") or "") for h in hits)
