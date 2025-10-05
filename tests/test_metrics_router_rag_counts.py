from fastapi.testclient import TestClient
from types import SimpleNamespace
import assistant_api.main as main
from assistant_api.main import app

client = TestClient(app)


async def fake_rag_query_direct(q):  # mimics assistant_api.rag_query.rag_query signature behavior
    # Return a minimal shape the /chat handler merges into data
    return {
        "question": getattr(q, "question", ""),
        "matches": [],
        "count": 0,
        "grounded": False,
        "sources": [],
    }


def test_router_metrics_rag_increments(monkeypatch):
    # Route to RAG and stub the direct query function
    monkeypatch.setattr(main, "route_query", lambda q: SimpleNamespace(route="rag", reason="test", project_id=None))
    monkeypatch.setattr(main, "rag_query_direct", fake_rag_query_direct)
    # Ensure no-LLM path is disabled
    monkeypatch.delenv("DEV_ALLOW_NO_LLM", raising=False)

    before = client.get("/metrics").json()
    before_count = int(before.get("router", {}).get("rag", 0)) if isinstance(before, dict) else 0

    client.post("/chat", json={"messages": [{"role": "user", "content": "ask RAG"}]})

    after = client.get("/metrics").json()
    after_count = int(after.get("router", {}).get("rag", 0)) if isinstance(after, dict) else 0

    assert after_count >= before_count + 1
