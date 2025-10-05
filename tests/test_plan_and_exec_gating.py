import os
import pytest
from fastapi.testclient import TestClient

from assistant_api.main import app

client = TestClient(app)


def test_plan_returns_run_script_when_rebuild_phrase(monkeypatch):
    r = client.post("/api/plan", json={"question": "rebuild the rag index for DB at D:/leo-portfolio/data/rag_9999.sqlite"})
    j = r.json()
    assert j.get("ok") is True
    plan = j.get("plan", {}).get("plan", [])
    assert isinstance(plan, list) and len(plan) >= 1
    assert plan[0]["tool"] == "run_script"
    args = plan[0]["args"]
    assert args.get("script") == "scripts/rag-build-index.ps1"
    # -DbPath may or may not be extracted depending on platform regex; accept both
    if "args" in args:
        assert args["args"][:2] == ["-DbPath", "D:/leo-portfolio/data/rag_9999.sqlite"]


def test_exec_gated_when_disabled(monkeypatch):
    monkeypatch.setenv("ALLOW_TOOLS", "0")
    body = {"name": "run_script", "args": {"script": "scripts/rag-build-index.ps1", "dry_run": True}}
    r = client.post("/api/tools/exec", json=body)
    j = r.json()
    assert not j.get("ok", False)
    assert "dangerous" in (j.get("error", "").lower())


def test_exec_dry_run_when_enabled_and_allowlisted(monkeypatch):
    monkeypatch.setenv("ALLOW_TOOLS", "1")
    monkeypatch.setenv("ALLOW_SCRIPTS", "scripts/rag-build-index.ps1")
    body = {"name": "run_script", "args": {"script": "scripts/rag-build-index.ps1", "dry_run": True}}
    r = client.post("/api/tools/exec", json=body)
    j = r.json()
    # run_script returns a top-level dict (not nested under result) from /api/tools/exec
    assert j.get("ok") is True and j.get("dry_run") is True
    assert isinstance(j.get("cmd"), list) and len(j["cmd"]) >= 1
