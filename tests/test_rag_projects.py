from fastapi.testclient import TestClient
from assistant_api.main import app


def test_rag_projects_endpoint():
    c = TestClient(app)
    r = c.get("/api/rag/projects")
    assert r.status_code == 200
    data = r.json()
    assert data.get("ok") is True
    assert isinstance(data.get("projects"), list)
    # rows (if any) have the right shape
    for item in data["projects"]:
        assert "id" in item and "chunks" in item
        assert isinstance(item["chunks"], int)


def test_rag_projects_include_unknown():
    c = TestClient(app)
    r = c.get("/api/rag/projects?include_unknown=true")
    assert r.status_code == 200
    data = r.json()
    assert data.get("ok") is True
    assert isinstance(data.get("projects"), list)


def test_rag_projects_perf():
    c = TestClient(app)
    import time, statistics
    samples = []
    # warm
    for _ in range(2):
        c.get("/api/rag/projects")
    for _ in range(10):
        t0 = time.perf_counter()
        r = c.get("/api/rag/projects")
        assert r.status_code == 200
        samples.append((time.perf_counter() - t0) * 1000.0)
    # ~p95 via quantiles n=20 -> index 18
    try:
        q = statistics.quantiles(samples, n=20)[18]
    except Exception:
        q = max(samples)
    assert q < 50.0


def test_projects_ingest_and_update(tmp_path, monkeypatch):
    """Test that we can ingest and update projects_knowledge.json."""
    import json
    from fastapi.testclient import TestClient
    from assistant_api.main import app

    pj = tmp_path / "projects_knowledge.json"
    sample = [{"slug": "clarity", "title": "Clarity", "status": "in-progress", "summary": "A Chrome extension."}]
    pj.write_text(json.dumps(sample), encoding="utf-8")

    monkeypatch.setenv('ALLOW_TOOLS', '1')  # Enable admin access for test
    monkeypatch.setenv('PROJECTS_JSON', str(pj))
    monkeypatch.setenv('RAG_DB', str(tmp_path / "rag.sqlite"))

    c = TestClient(app)

    # 1) Ingest
    r = c.post('/api/rag/ingest/projects')
    assert r.status_code == 200
