from fastapi.testclient import TestClient
from assistant_api.main import app
from assistant_api.services.geo import anonymize_prefix
from datetime import datetime, timezone
import os, tempfile

def test_anonymize_prefix_v4_v6():
    assert anonymize_prefix("8.8.8.8") == "8.8.8.0/24"
    # basic IPv6 sample
    assert anonymize_prefix("2001:db8::1").endswith("/48")

def test_ingest_with_enrichment(monkeypatch):
    tmp = tempfile.TemporaryDirectory()
    monkeypatch.setenv("ANALYTICS_DIR", tmp.name)
    monkeypatch.setenv("LOG_IP_ENABLED", "true")
    # Allow missing db path (country may be None), but anon prefix should set
    client = TestClient(app)
    now = datetime.now(timezone.utc).isoformat()
    payload = {"events":[
        {"session_id":"abc12345","visitor_id":"v1234567","section":"hero","event_type":"view","ts":now}
    ]}
    r = client.post("/agent/metrics/ingest", json=payload, headers={"X-Forwarded-For":"8.8.8.8"})
    assert r.status_code == 200 and r.json()["count"] == 1
