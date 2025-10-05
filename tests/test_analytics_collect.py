from assistant_api.main import app
from fastapi.testclient import TestClient

def test_collect_basic():
    c = TestClient(app)
    r = c.post("/analytics/collect", json={"type":"page_view","path":"/","ref_host":"direct","device":"desktop","theme":"dark"})
    assert r.status_code == 200 and r.json().get("ok") is True

def test_collect_scroll_and_dwell():
    c = TestClient(app)
    c.post("/analytics/collect", json={"type":"scroll_depth","path":"/case","percent":50})
    r = c.post("/analytics/collect", json={"type":"dwell","seconds": 12.3})
    assert r.status_code == 200
