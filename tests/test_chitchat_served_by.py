from fastapi.testclient import TestClient
import assistant_api.main as main
from assistant_api.main import app

client = TestClient(app)


async def fake_generate(prompt: str):  # type: ignore[override]
    # Return content and a provider tag; shape matches generate.generate_brief_answer
    return ("short answer", "primary")


def test_chitchat_propagates_served_by(monkeypatch):
    # Force chitchat path by ensuring router returns None and DEV_ALLOW_NO_LLM disabled
    monkeypatch.delenv("DEV_ALLOW_NO_LLM", raising=False)
    monkeypatch.setattr(main, "route_query", lambda q: None)
    monkeypatch.setattr(main, "generate_brief_answer", fake_generate)

    res = client.post("/chat", json={"messages": [{"role": "user", "content": "hello"}]})
    body = res.json()
    assert body.get("_served_by") == "primary"
    assert body.get("content")  # ensure content surfaced for convenience


async def fake_generate_fallback(prompt: str):  # type: ignore[override]
    return ("short answer", "fallback")


def test_chitchat_propagates_served_by_fallback(monkeypatch):
    monkeypatch.delenv("DEV_ALLOW_NO_LLM", raising=False)
    monkeypatch.setattr(main, "route_query", lambda q: None)
    monkeypatch.setattr(main, "generate_brief_answer", fake_generate_fallback)

    res = client.post("/chat", json={"messages": [{"role": "user", "content": "hello"}]})
    body = res.json()
    assert body.get("_served_by") == "fallback"
    assert body.get("content")
