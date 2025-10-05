from fastapi.testclient import TestClient
import assistant_api.main as main
from assistant_api.main import app

client = TestClient(app)


async def fake_generate(prompt: str):  # type: ignore[override]
    # Keep it deterministic and avoid external LLM call
    return ("summary from tools", "fallback")


def test_chitchat_tools_smoke(monkeypatch):
    # Ensure normal chitchat path (router None) and real generate replaced
    monkeypatch.delenv("DEV_ALLOW_NO_LLM", raising=False)
    monkeypatch.setattr(main, "route_query", lambda q: None)
    monkeypatch.setattr(main, "generate_brief_answer", fake_generate)

    q = "Where is the SAFE_LIFESPAN flag defined? show file + lines"
    res = client.post("/chat", json={"messages": [{"role": "user", "content": q}], "include_sources": True})
    body = res.json()
    assert body.get("content")  # summarized answer present
    actions = body.get("actions") or {}
    steps = actions.get("steps") or []
    assert steps, "expected tool steps in chitchat tools path"
    tools = [s.get("tool") for s in steps]
    assert "search_repo" in tools
    # ensure search_repo returned hits with path+line
    search_steps = [s for s in steps if s.get("tool") == "search_repo"]
    assert search_steps and search_steps[0].get("result", {}).get("ok")
    hits = (search_steps[0].get("result", {}) or {}).get("hits") or []
    assert isinstance(hits, list) and hits
    first = hits[0]
    assert isinstance(first.get("path"), str) and isinstance(first.get("line"), int)
    # Also ensure read_file ran and returned a slice
    read_steps = [s for s in steps if s.get("tool") == "read_file"]
    assert read_steps and read_steps[0].get("result", {}).get("ok") is True
    rf_content = (read_steps[0].get("result", {}) or {}).get("content") or ""
    assert isinstance(rf_content, str) and len(rf_content) > 0
