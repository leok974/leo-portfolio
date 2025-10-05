from assistant_api.main import app
from assistant_api.cli import main as cli_main
from fastapi.testclient import TestClient
from assistant_api.db import connect
import os, pathlib, sys


def test_batch_ingest(tmp_path, monkeypatch, capsys):
    db_path = tmp_path / "rag.sqlite"
    monkeypatch.setenv("RAG_DB", str(db_path))
    # Create small fixture folder
    folder = tmp_path / "docs"
    folder.mkdir()
    (folder / "a.txt").write_text("hello world text\nline2", encoding="utf-8")
    (folder / "b.html").write_text("<html><body><h1>hi</h1><p>alpha beta</p></body></html>", encoding="utf-8")
    # Simulate CLI call
    argv = ["assistant_api", "ingest", "--batch", "--project", "demo", "--doc-id", "ignored", str(folder)]
    monkeypatch.setenv("PYTHONWARNINGS", "ignore")
    monkeypatch.setenv("PYTHONIOENCODING", "utf-8")
    monkeypatch.setenv("LC_ALL", "C")
    monkeypatch.setenv("LANG", "C")
    # Patch sys.argv
    old_argv = sys.argv
    sys.argv = argv
    try:
        cli_main()
    finally:
        sys.argv = old_argv
    con = connect()
    n = con.execute("SELECT COUNT(1) FROM chunks").fetchone()[0]
    con.close()
    assert n >= 2
