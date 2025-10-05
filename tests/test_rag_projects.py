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
