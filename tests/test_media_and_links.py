import json, os
from pathlib import Path
from assistant_api.agent.tasks import media_scan, media_optimize, links_suggest

def _write_fake_png(p: Path):
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_bytes(b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc`\x00\x00\x00\x02\x00\x01E\x8a\x1b\x0e\x00\x00\x00\x00IEND\xaeB`\x82")

def test_media_scan_writes_index(monkeypatch, tmp_path: Path):
    monkeypatch.chdir(tmp_path)
    # Create data dir for DB
    (tmp_path / "data").mkdir(parents=True, exist_ok=True)
    monkeypatch.setenv("RAG_DB", str(tmp_path / "data" / "test.db"))
    _write_fake_png(tmp_path / "public" / "img" / "a.png")
    res = media_scan("t", {})
    assert (tmp_path / "assets" / "data" / "media-index.json").exists()
    j = json.loads((tmp_path / "assets" / "data" / "media-index.json").read_text("utf-8"))
    assert j["count"] >= 1

def test_links_suggest_creates_file(monkeypatch, tmp_path: Path):
    monkeypatch.chdir(tmp_path)
    # Create data dir for DB
    (tmp_path / "data").mkdir(parents=True, exist_ok=True)
    monkeypatch.setenv("RAG_DB", str(tmp_path / "data" / "test.db"))
    # seed missing and an existing close match
    (tmp_path / "public" / "img").mkdir(parents=True, exist_ok=True)
    (tmp_path / "public" / "img" / "hero-final.png").write_bytes(b"x")
    (tmp_path / "assets" / "data").mkdir(parents=True, exist_ok=True)
    (tmp_path / "assets" / "data" / "link-check.json").write_text(json.dumps({"missing":[{"file":"public/index.html","url":"img/hero.png"}]}), "utf-8")
    res = links_suggest("t", {})
    out = json.loads((tmp_path / "assets" / "data" / "link-suggest.json").read_text("utf-8"))
    assert out["count"] >= 1
