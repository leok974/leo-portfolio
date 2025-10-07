import json
from pathlib import Path

from assistant_api.agent.tasks import status_write


def test_status_write_includes_brand_from_overrides(monkeypatch, tmp_path: Path):
    monkeypatch.chdir(tmp_path)
    data_dir = tmp_path / "assets" / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    # write overrides with brand
    (data_dir / "og-overrides.json").write_text(
        json.dumps({"brand": "LEO KLEMET — SITEAGENT"}), "utf-8"
    )
    res = status_write("t-run", {"_tasks": ["status.write"]})
    out = json.loads((tmp_path / "assets" / "data" / "siteAgent.json").read_text("utf-8"))
    assert "brand" in out
    assert out["brand"] == "LEO KLEMET — SITEAGENT"
    assert res["file"].endswith("assets/data/siteAgent.json")
