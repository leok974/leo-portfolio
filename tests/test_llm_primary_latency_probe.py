import os, time
import pytest
from fastapi.testclient import TestClient
from assistant_api.main import app

RUN_LAT = os.getenv("RUN_LATENCY_TESTS")
CI = os.getenv("CI")

pytestmark = pytest.mark.skipif(
    (not RUN_LAT) or CI,
    reason="Latency probe test skipped unless RUN_LATENCY_TESTS=1 and not in CI"
)

client = TestClient(app)

def test_primary_latency_probe_stats_shape():
    # Smaller sample for speed
    resp = client.get("/llm/primary/latency2?count=6&warmup=2&timeout_ms=800")
    assert resp.status_code == 200
    payload = resp.json()
    assert "stats" in payload and "probes" in payload
    stats = payload["stats"]
    assert set(["count","ok_rate","min_ms","p50_ms","p95_ms","p99_ms","max_ms","avg_ms"]).issubset(stats.keys())
    # If we have samples, basic sanity checks
    if stats["count"] > 0:
        assert stats["min_ms"] <= stats["max_ms"]
        assert 0 <= stats["ok_rate"] <= 1

def test_primary_latency_probe_reasonable_p95():
    # Mild upper bound heuristic (adjust if backend slower)
    resp = client.get("/llm/primary/latency2?count=8&warmup=2&timeout_ms=1200")
    assert resp.status_code == 200
    p95 = resp.json()["stats"]["p95_ms"]
    # Allow generous threshold; tweak as environment evolves
    assert p95 < 1500
