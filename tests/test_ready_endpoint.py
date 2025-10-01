import json
from fastapi.testclient import TestClient

try:
    from assistant_api.main import app
except ImportError:
    # Fallback if path differs; adjust as needed.
    from assistant_api.main import app  # noqa

client = TestClient(app)

def test_ready_endpoint():
    r = client.get('/ready')
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get('ok') is True


def test_status_summary_endpoint():
    r = client.get('/status/summary')
    assert r.status_code == 200, r.text
    data = r.json()
    # Basic shape checks
    assert 'ok' in data
    assert 'rag' in data or 'checks' in data  # depending on aggregator shape
