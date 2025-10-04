import os, pytest
from httpx import AsyncClient, ASGITransport
from assistant_api.main import app

@pytest.mark.asyncio
async def test_chat_grounded_fallback():
    os.environ["DEV_ALLOW_NO_LLM"] = "1"
    rag_db = os.getenv("RAG_DB")
    assert rag_db, "RAG_DB must be set for this test"
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        payload = {"messages":[{"role":"user","content":"Tell me about LedgerMind"}], "include_sources": True}
        r = await ac.post("/chat", json=payload)
        r.raise_for_status()
        data = r.json()
        assert data.get("grounded") is True
        assert isinstance(data.get("sources"), list) and len(data["sources"]) > 0
        assert isinstance(data.get("content",""), str) and data["content"]
