from fastapi.testclient import TestClient
from types import SimpleNamespace
from assistant_api.main import app

client = TestClient(app)


def test_router_metrics_faq_increments(monkeypatch):
    # Force faq route
    import assistant_api.main as main
    monkeypatch.setattr(main, "route_query", lambda q: SimpleNamespace(route="faq", reason="test", project_id=None))
    # Ensure no-LLM is off
    monkeypatch.delenv("DEV_ALLOW_NO_LLM", raising=False)

    before = client.get("/metrics").json()
    before_count = int(before.get("router", {}).get("faq", 0)) if isinstance(before, dict) else 0

    client.post("/chat", json={"messages": [{"role": "user", "content": "answer from faq please"}]})

    after = client.get("/metrics").json()
    after_count = int(after.get("router", {}).get("faq", 0)) if isinstance(after, dict) else 0

    assert after_count >= before_count + 1
