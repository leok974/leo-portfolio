from fastapi.testclient import TestClient
from assistant_api.main import app
from datetime import datetime, timezone
import os
import tempfile


def test_ingest_and_analyze(monkeypatch):
    tmp = tempfile.TemporaryDirectory()
    monkeypatch.setenv("ANALYTICS_DIR", tmp.name)
    client = TestClient(app)

    now = datetime.now(timezone.utc).isoformat()
    payload = {
        "events": [
            {
                "session_id": "abc12345",
                "visitor_id": "v1234567",
                "section": "projects",
                "event_type": "view",
                "ts": now,
                "viewport_pct": 0.8,
            },
            {
                "session_id": "abc12345",
                "visitor_id": "v1234567",
                "section": "projects",
                "event_type": "click",
                "ts": now,
            },
            {
                "session_id": "abc12345",
                "visitor_id": "v1234567",
                "section": "about",
                "event_type": "view",
                "ts": now,
                "viewport_pct": 0.4,
            },
            {
                "session_id": "abc12345",
                "visitor_id": "v1234567",
                "section": "about",
                "event_type": "dwell",
                "ts": now,
                "dwell_ms": 9000,
            },
        ]
    }
    r = client.post("/agent/metrics/ingest", json=payload)
    assert r.status_code == 200 and r.json()["count"] == 4

    r2 = client.post("/agent/analyze/behavior")
    assert r2.status_code == 200
    data = r2.json()
    assert "order" in data and isinstance(data["order"], list)
    assert set(data["weights"].keys()) >= {"projects", "about"}
