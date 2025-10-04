# tests/test_chat_rag_grounded.py
import json
import pathlib
import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client(monkeypatch, tmp_path):
    """
    Keep RAG index isolated per-test and enable no-LLM synthetic replies,
    then import the app (ensures DB_PATH picks up our env overrides).
    """
    monkeypatch.setenv("RAG_DB", str(tmp_path / "rag.db"))
    monkeypatch.setenv("DEV_ALLOW_NO_LLM", "1")
    from assistant_api.main import app
    return TestClient(app)


def _repo_root() -> str:
    # repo root = one level up from /tests
    return str(pathlib.Path(__file__).resolve().parents[1])


def test_chat_is_grounded_after_fs_ingest(client: TestClient):
    # 1) Minimal FS ingest (reset index, include only small docs that name LedgerMind)
    ingest_payload = {
        "reset": True,
        "repos": [
            {
                "type": "fs",
                "path": _repo_root(),
                "include": [
                    "README.md",
                    "docs/ARCHITECTURE.md",
                    "docs/DEPLOY.md",
                    "docs/DEVELOPMENT.md",
                    "SECURITY.md",
                ],
            }
        ],
    }
    r = client.post("/api/rag/ingest", json=ingest_payload)
    assert r.status_code == 200, r.text
    jr = r.json()
    # If your endpoint returns {ok:bool, ...} assert it; otherwise keep it soft.
    assert jr.get("ok", True) is True

    # 2) Query chat with include_sources and visitor audience
    chat_req = {
        "messages": [
            {"role": "user", "content": "Tell me about LedgerMind."}
        ],
        "include_sources": True,
        "audience": "visitor",
    }
    c = client.post("/chat", json=chat_req)
    assert c.status_code == 200, c.text
    cj = c.json()

    # 3) Grounding assertions
    assert cj.get("grounded") is True, f"expected grounded:true, got: {json.dumps(cj, ensure_ascii=False)[:600]}"
    sources = cj.get("sources") or []
    assert len(sources) > 0, f"expected sources>0, got: {sources}"

    # 4) Content sanity — no hallucinated stacks/metrics
    text = (cj.get("content") or "").lower()
    for banned in ("hyperledger", "go-based microservices", "cut fraud losses by 35"):
        assert banned not in text, f"hallucination detected: {banned}"

    # 5) Visitor voice — third person, not owner-addressing
    assert "your project" not in text
    assert "ledgermind" in text or "leo" in text

    # 6) Conversational close — ends with a question mark
    assert (cj.get("content") or "").strip().endswith(("?", "？"))
