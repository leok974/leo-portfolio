from fastapi.testclient import TestClient
from assistant_api.main import app

client = TestClient(app)

def test_health_metrics_contains_crypto_reason(monkeypatch):
    # Ensure CRYPTO_MODE=disabled to trigger crypto_disabled info reason
    monkeypatch.setenv('CRYPTO_MODE', 'disabled')
    r = client.get('/metrics/health')
    assert r.status_code == 200
    body = r.text
    assert 'health_reason{reason="crypto_disabled",severity="info"} 1' in body
    assert 'health_overall{status="ok"}' in body or 'health_overall{status="degraded"}' in body
