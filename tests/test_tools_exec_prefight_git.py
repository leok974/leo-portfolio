import os
from fastapi.testclient import TestClient
import assistant_api.main as main

client = TestClient(main.app)


def test_prefight_blocks_when_dirty(monkeypatch):
    # Enable dangerous tools but do not allow dirty
    monkeypatch.setenv("ALLOW_TOOLS", "1")
    monkeypatch.delenv("ALLOW_DIRTY_TOOLS", raising=False)
    monkeypatch.delenv("ALLOW_BEHIND_TOOLS", raising=False)

    # Monkeypatch git_status to simulate dirty repo
    def fake_run_git_status(args):
        return {"ok": True, "dirty": {"modified": 1, "added": 0, "deleted": 0, "renamed": 0, "untracked": 0}, "ahead_behind": {"behind": 0, "ahead": 0, "base": "origin/main"}}

    monkeypatch.setattr("assistant_api.tools.git_status.run_git_status", fake_run_git_status)

    body = {"name": "run_script", "args": {"script": "scripts/rag-build-index.ps1", "dry_run": True}}
    r = client.post("/api/tools/exec", json=body)
    j = r.json()
    assert not j.get("ok", False)
    assert "repo dirty" in (j.get("error", "").lower())


def test_prefight_allows_when_overridden(monkeypatch):
    monkeypatch.setenv("ALLOW_TOOLS", "1")
    monkeypatch.setenv("ALLOW_DIRTY_TOOLS", "1")
    monkeypatch.setenv("ALLOW_BEHIND_TOOLS", "1")
    monkeypatch.setenv("ALLOW_SCRIPTS", "scripts/rag-build-index.ps1")

    def fake_run_git_status(args):
        return {"ok": True, "dirty": {"modified": 5, "added": 1, "deleted": 0, "renamed": 0, "untracked": 2}, "ahead_behind": {"behind": 7, "ahead": 0, "base": "origin/main"}}

    monkeypatch.setattr("assistant_api.tools.git_status.run_git_status", fake_run_git_status)

    body = {"name": "run_script", "args": {"script": "scripts/rag-build-index.ps1", "dry_run": True}}
    r = client.post("/api/tools/exec", json=body)
    j = r.json()
    assert j.get("ok") is True and j.get("dry_run") is True
