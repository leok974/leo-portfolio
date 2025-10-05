from fastapi.testclient import TestClient
from assistant_api.main import app

client = TestClient(app)


def test_router_metrics_chitchat_increments(monkeypatch):
    # Force chitchat route
    import assistant_api.main as main
    monkeypatch.setattr(main, "route_query", lambda q: None)
    # Ensure no-LLM is off so normal path executes
    monkeypatch.delenv("DEV_ALLOW_NO_LLM", raising=False)

    # Baseline metrics snapshot
    before = client.get("/metrics").json()
    before_count = int(before.get("router", {}).get("chitchat", 0)) if isinstance(before, dict) else 0

    # Trigger a chat
    client.post("/chat", json={"messages": [{"role": "user", "content": "hello there"}]})

    # After snapshot
    after = client.get("/metrics").json()
    after_count = int(after.get("router", {}).get("chitchat", 0)) if isinstance(after, dict) else 0

    assert after_count >= before_count + 1
