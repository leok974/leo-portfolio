# assistant_api/tests/test_seo_tune.py
from pathlib import Path

from assistant_api.services.seo_tune import run_seo_tune


def test_seo_tune_dry_run(tmp_path, monkeypatch):
    monkeypatch.setenv("AGENT_ARTIFACTS_DIR", str(tmp_path / "artifacts"))
    res = run_seo_tune(dry_run=True)
    assert res["ok"] is True
    assert res["dry_run"] is True
    assert Path(res["diff"]).exists()
    assert Path(res["log"]).exists()


def test_seo_tune_artifacts_content(tmp_path, monkeypatch):
    monkeypatch.setenv("AGENT_ARTIFACTS_DIR", str(tmp_path / "artifacts"))
    res = run_seo_tune(dry_run=True)
    diff_text = Path(res["diff"]).read_text(encoding="utf-8")
    md_text = Path(res["log"]).read_text(encoding="utf-8")
    assert "title:" in diff_text or "description:" in diff_text
    assert "SEO Tune — Reasoning" in md_text
