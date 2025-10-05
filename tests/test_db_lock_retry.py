import sqlite3
from pathlib import Path

import pytest

from assistant_api import db as db_module


class DummyConn:
    def __init__(self):
        self.executes: list[str] = []

    def execute(self, sql: str, *params):
        self.executes.append(sql)
        return self

    def commit(self):
        pass

    def close(self):
        pass


def test_connect_retries_on_locked_db(monkeypatch, tmp_path):
    attempts = {"count": 0}
    original_path = db_module.DB_PATH
    db_module.DB_PATH = str(tmp_path / "rag.sqlite")
    Path(db_module.DB_PATH).parent.mkdir(parents=True, exist_ok=True)

    original_connect = db_module.sqlite3.connect

    def fake_connect(path, timeout, check_same_thread):
        attempts["count"] += 1
        assert path == db_module.DB_PATH
        if attempts["count"] < 3:
            raise sqlite3.OperationalError("database is locked")
        return DummyConn()

    monkeypatch.setattr(db_module.sqlite3, "connect", fake_connect)

    try:
        conn = db_module.connect(retries=5, base_sleep=0.0)
        assert isinstance(conn, DummyConn)
        assert attempts["count"] == 3
    finally:
        monkeypatch.setattr(db_module.sqlite3, "connect", original_connect)
        db_module.DB_PATH = original_path


def test_commit_with_retry_succeeds(monkeypatch):
    class FlakyConn:
        def __init__(self):
            self.attempts = 0

        def commit(self):
            self.attempts += 1
            if self.attempts < 3:
                raise sqlite3.OperationalError("database is locked")

    conn = FlakyConn()
    db_module.commit_with_retry(conn, retries=5, base_sleep=0.0)
    assert conn.attempts == 3


def test_commit_with_retry_raises_after_limit():
    class AlwaysLocked:
        def commit(self):
            raise sqlite3.OperationalError("database is locked")

    with pytest.raises(sqlite3.OperationalError):
        db_module.commit_with_retry(AlwaysLocked(), retries=2, base_sleep=0.0)
