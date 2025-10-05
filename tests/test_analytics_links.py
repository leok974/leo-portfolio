from assistant_api.main import app
from fastapi.testclient import TestClient


def test_collect_link_clicks_and_metrics_exposure():
    c = TestClient(app)
    # Post several link_click events with different kinds and domains
    r1 = c.post("/analytics/collect", json={"type":"link_click","kind":"github","href":"https://github.com/leok974"})
    assert r1.status_code == 200 and r1.json().get("ok") is True

    r2 = c.post("/analytics/collect", json={"type":"link_click","kind":"artstation","href":"https://www.artstation.com/"})
    assert r2.status_code == 200

    # Unknown kind coerces to other, netloc extracted
    r3 = c.post("/analytics/collect", json={"type":"link_click","kind":"unknown","href":"https://example.com/profile"})
    assert r3.status_code == 200

    # Metrics should expose the counter with labels
    m = c.get("/metrics").text
    assert "link_click_total" in m
    assert "kind=\"github\"" in m
    assert "href_domain=\"github.com\"" in m
    assert "kind=\"artstation\"" in m
    assert "href_domain=\"www.artstation.com\"" in m or "href_domain=\"artstation.com\"" in m
    assert "kind=\"other\"" in m
    assert "href_domain=\"example.com\"" in m
