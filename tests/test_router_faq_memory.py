import json
import os
import asyncio
import pytest

from assistant_api.router import route_query
from assistant_api.faq import faq_search_best
from assistant_api.memory import remember, recall, clear


def test_faq_search_best(tmp_path, monkeypatch):
    p = tmp_path / "faq.json"
    p.write_text(json.dumps([
        {"q": "What is LedgerMind?", "a": "LM one-liner", "project_id": "ledgermind"},
        {"q": "How to run backend?", "a": "Use run_cmddev", "project_id": "core"}
    ]), encoding="utf-8")
    monkeypatch.setenv("FAQ_PATH", str(p))

    hit = faq_search_best("What's LedgerMind")
    assert hit is not None
    assert hit.project_id == "ledgermind"
    assert 0.0 <= hit.score <= 1.0


def test_memory_roundtrip():
    user = "u1"
    clear(user)
    remember(user, "user", "Hi")
    remember(user, "assistant", "Hello!")
    mem = recall(user)
    assert mem[-2:] == [("user", "Hi"), ("assistant", "Hello!")]


def test_route_query_chitchat(monkeypatch):
    # Make faq empty
    monkeypatch.setenv("FAQ_PATH", str((pytest.Path.cwd() / "nonexistent.json") if hasattr(pytest, 'Path') else "nonexistent.json"))
    r = route_query("How's your day?")
    assert r.route in ("chitchat", "rag", "faq")
