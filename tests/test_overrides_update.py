import json
from pathlib import Path

from assistant_api.agent.tasks import overrides_update


def test_overrides_update_brand_shortcut(monkeypatch, tmp_path: Path):
    """Test brand shortcut parameter."""
    monkeypatch.chdir(tmp_path)
    # Setup agent database path
    db_dir = tmp_path / "data"
    db_dir.mkdir(exist_ok=True)
    monkeypatch.setenv("RAG_DB", str(db_dir / "rag.sqlite"))

    data_dir = tmp_path / "assets" / "data"
    data_dir.mkdir(parents=True, exist_ok=True)

    res = overrides_update("t-run", {"brand": "CUSTOM BRAND"})

    out = json.loads((data_dir / "og-overrides.json").read_text("utf-8"))
    assert out["brand"] == "CUSTOM BRAND"
    assert res["changed"]["brand"] == "CUSTOM BRAND"
    assert res["brand"] == "CUSTOM BRAND"


def test_overrides_update_rename_by_repo(monkeypatch, tmp_path: Path):
    """Test rename convenience using repo path."""
    monkeypatch.chdir(tmp_path)
    # Setup agent database path
    db_dir = tmp_path / "data"
    db_dir.mkdir(exist_ok=True)
    monkeypatch.setenv("RAG_DB", str(db_dir / "rag.sqlite"))

    data_dir = tmp_path / "assets" / "data"
    data_dir.mkdir(parents=True, exist_ok=True)

    res = overrides_update("t-run", {
        "rename": {"repo": "leok974/leo-portfolio", "to": "siteAgent"}
    })

    out = json.loads((data_dir / "og-overrides.json").read_text("utf-8"))
    assert out["repo_alias"]["leok974/leo-portfolio"] == "siteAgent"
    assert res["changed"]["repo_alias"]["leok974/leo-portfolio"] == "siteAgent"


def test_overrides_update_rename_by_title(monkeypatch, tmp_path: Path):
    """Test rename convenience using title."""
    monkeypatch.chdir(tmp_path)
    # Setup agent database path
    db_dir = tmp_path / "data"
    db_dir.mkdir(exist_ok=True)
    monkeypatch.setenv("RAG_DB", str(db_dir / "rag.sqlite"))

    data_dir = tmp_path / "assets" / "data"
    data_dir.mkdir(parents=True, exist_ok=True)

    res = overrides_update("t-run", {
        "rename": {"from": "leo-portfolio", "to": "siteAgent"}
    })

    out = json.loads((data_dir / "og-overrides.json").read_text("utf-8"))
    assert out["title_alias"]["leo-portfolio"] == "siteAgent"
    assert res["changed"]["title_alias"]["leo-portfolio"] == "siteAgent"


def test_overrides_update_full_merge(monkeypatch, tmp_path: Path):
    """Test full overrides block merge."""
    monkeypatch.chdir(tmp_path)
    # Setup agent database path
    db_dir = tmp_path / "data"
    db_dir.mkdir(exist_ok=True)
    monkeypatch.setenv("RAG_DB", str(db_dir / "rag.sqlite"))

    data_dir = tmp_path / "assets" / "data"
    data_dir.mkdir(parents=True, exist_ok=True)

    res = overrides_update("t-run", {
        "overrides": {
            "brand": "LEO KLEMET — SITEAGENT",
            "title_alias": {"leo-portfolio": "siteAgent", "other-project": "otherAlias"},
            "repo_alias": {"leok974/leo-portfolio": "siteAgent"}
        }
    })

    out = json.loads((data_dir / "og-overrides.json").read_text("utf-8"))
    assert out["brand"] == "LEO KLEMET — SITEAGENT"
    assert out["title_alias"]["leo-portfolio"] == "siteAgent"
    assert out["title_alias"]["other-project"] == "otherAlias"
    assert out["repo_alias"]["leok974/leo-portfolio"] == "siteAgent"
    assert len(res["changed"]["title_alias"]) == 2


def test_overrides_update_preserves_existing(monkeypatch, tmp_path: Path):
    """Test that existing aliases are preserved when adding new ones."""
    monkeypatch.chdir(tmp_path)
    # Setup agent database path
    db_dir = tmp_path / "data"
    db_dir.mkdir(exist_ok=True)
    monkeypatch.setenv("RAG_DB", str(db_dir / "rag.sqlite"))

    data_dir = tmp_path / "assets" / "data"
    data_dir.mkdir(parents=True, exist_ok=True)

    # Create initial overrides
    initial = {
        "brand": "ORIGINAL BRAND",
        "title_alias": {"project-a": "Project A"},
        "repo_alias": {"org/repo-a": "Repo A"}
    }
    (data_dir / "og-overrides.json").write_text(json.dumps(initial), "utf-8")

    # Add new alias without touching brand
    res = overrides_update("t-run", {
        "rename": {"from": "project-b", "to": "Project B"}
    })

    out = json.loads((data_dir / "og-overrides.json").read_text("utf-8"))
    # Original values preserved
    assert out["brand"] == "ORIGINAL BRAND"
    assert out["title_alias"]["project-a"] == "Project A"
    assert out["repo_alias"]["org/repo-a"] == "Repo A"
    # New value added
    assert out["title_alias"]["project-b"] == "Project B"


def test_overrides_update_creates_file_if_missing(monkeypatch, tmp_path: Path):
    """Test that file is created if it doesn't exist."""
    monkeypatch.chdir(tmp_path)
    # Setup agent database path
    db_dir = tmp_path / "data"
    db_dir.mkdir(exist_ok=True)
    monkeypatch.setenv("RAG_DB", str(db_dir / "rag.sqlite"))

    data_dir = tmp_path / "assets" / "data"
    data_dir.mkdir(parents=True, exist_ok=True)

    assert not (data_dir / "og-overrides.json").exists()

    res = overrides_update("t-run", {"brand": "NEW BRAND"})

    assert (data_dir / "og-overrides.json").exists()
    out = json.loads((data_dir / "og-overrides.json").read_text("utf-8"))
    assert out["brand"] == "NEW BRAND"


def test_overrides_update_logo_for_repo(monkeypatch, tmp_path: Path):
    """Test setting logo for a repository."""
    monkeypatch.chdir(tmp_path)
    # Setup agent database path
    db_dir = tmp_path / "data"
    db_dir.mkdir(exist_ok=True)
    monkeypatch.setenv("RAG_DB", str(db_dir / "rag.sqlite"))

    data_dir = tmp_path / "assets" / "data"
    data_dir.mkdir(parents=True, exist_ok=True)

    res = overrides_update("t-run", {
        "logo": {"repo": "leok974/leo-portfolio", "path": "assets/logos/siteAgent.png"}
    })

    out = json.loads((data_dir / "og-overrides.json").read_text("utf-8"))
    assert out["repo_logo"]["leok974/leo-portfolio"] == "assets/logos/siteAgent.png"
    assert res["changed"]["repo_logo"]["leok974/leo-portfolio"] == "assets/logos/siteAgent.png"


def test_overrides_update_logo_for_title(monkeypatch, tmp_path: Path):
    """Test setting logo for a title."""
    monkeypatch.chdir(tmp_path)
    # Setup agent database path
    db_dir = tmp_path / "data"
    db_dir.mkdir(exist_ok=True)
    monkeypatch.setenv("RAG_DB", str(db_dir / "rag.sqlite"))

    data_dir = tmp_path / "assets" / "data"
    data_dir.mkdir(parents=True, exist_ok=True)

    res = overrides_update("t-run", {
        "logo": {"title": "siteAgent", "path": "assets/logos/siteAgent.png"}
    })

    out = json.loads((data_dir / "og-overrides.json").read_text("utf-8"))
    assert out["title_logo"]["siteAgent"] == "assets/logos/siteAgent.png"
    assert res["changed"]["title_logo"]["siteAgent"] == "assets/logos/siteAgent.png"
