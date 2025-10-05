def test_projects_p95():
    import time, statistics
    import os
    from fastapi.testclient import TestClient
    from assistant_api.main import app
    c = TestClient(app)
    times = []
    for _ in range(12):
        t0 = time.perf_counter()
        r = c.get("/api/rag/projects")
        assert r.status_code == 200
        times.append((time.perf_counter()-t0)*1000)
    times.sort()
    p95 = times[int(len(times)*0.95)-1]
    assert p95 < 60
