"""
Test logo.fetch task and URL-based logo command interpretation.
"""
import pytest
from unittest.mock import patch, MagicMock
from io import BytesIO
from assistant_api.agent.interpret import parse_command


def test_interpret_fetch_logo_for_repo():
    """Test that 'fetch logo from URL' routes to logo.fetch."""
    cmd = "fetch logo for repo leok974/leo-portfolio from https://example.com/logo.png"
    plan, params = parse_command(cmd)
    assert plan == ["logo.fetch", "og.generate", "status.write"]
    assert params["url"] == "https://example.com/logo.png"
    assert params["repo"] == "leok974/leo-portfolio"


def test_interpret_fetch_logo_for_title():
    """Test that 'fetch logo for title from URL' routes to logo.fetch."""
    cmd = "fetch logo for siteAgent from https://example.com/logo.png"
    plan, params = parse_command(cmd)
    assert plan == ["logo.fetch", "og.generate", "status.write"]
    assert params["url"] == "https://example.com/logo.png"
    assert params["title"] == "siteAgent"


def test_interpret_set_logo_local_path():
    """Test that 'set logo to path' (no http) routes to overrides.update."""
    cmd = "set logo for repo leok974/leo-portfolio to assets/logos/local.png"
    plan, params = parse_command(cmd)
    assert plan == ["overrides.update", "og.generate", "status.write"]
    assert params["logo"]["repo"] == "leok974/leo-portfolio"
    assert params["logo"]["path"] == "assets/logos/local.png"


@patch("assistant_api.agent.tasks.emit")
@patch("assistant_api.agent.tasks.urllib.request.urlopen")
def test_logo_fetch_downloads_and_maps(mock_urlopen, mock_emit):
    """Test logo.fetch downloads from URL and updates overrides."""
    # Mock HTTP response
    fake_png = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde"
    mock_response = MagicMock()
    mock_response.headers.get.side_effect = lambda k, default=None: {
        "Content-Type": "image/png",
        "Content-Length": str(len(fake_png))
    }.get(k, default)
    mock_response.read.side_effect = [fake_png, b""]
    mock_response.__enter__ = lambda s: s
    mock_response.__exit__ = lambda *args: None
    mock_urlopen.return_value = mock_response

    from assistant_api.agent.tasks import logo_fetch
    import os
    import json
    import tempfile
    import shutil

    # Create temp directory for test
    test_dir = tempfile.mkdtemp()
    orig_dir = os.getcwd()
    try:
        os.chdir(test_dir)
        os.makedirs("assets/data", exist_ok=True)

        result = logo_fetch("test-run", {
            "url": "https://example.com/logo.png",
            "repo": "leok974/leo-portfolio",
            "title": "siteAgent"
        })

        # Verify file saved
        assert "file" in result
        assert result["file"].endswith(".png")
        assert os.path.exists(result["file"])

        # Verify overrides updated
        with open("assets/data/og-overrides.json", "r") as f:
            ov = json.load(f)
        assert "repo_logo" in ov
        assert ov["repo_logo"]["leok974/leo-portfolio"] == result["file"]
        assert "title_logo" in ov
        assert ov["title_logo"]["siteAgent"] == result["file"]
    finally:
        os.chdir(orig_dir)
        shutil.rmtree(test_dir)


@patch("assistant_api.agent.tasks.emit")
@patch("assistant_api.agent.tasks.urllib.request.urlopen")
def test_logo_fetch_size_limit(mock_urlopen, mock_emit):
    """Test logo.fetch rejects files exceeding max_bytes."""
    # Mock response with oversized Content-Length
    mock_response = MagicMock()
    mock_response.headers.get.side_effect = lambda k, default=None: {
        "Content-Type": "image/png",
        "Content-Length": "10000000"  # 10MB
    }.get(k, default)
    mock_urlopen.return_value.__enter__ = lambda s: mock_response
    mock_urlopen.return_value.__exit__ = lambda *args: None

    from assistant_api.agent.tasks import logo_fetch
    import tempfile
    import os

    test_dir = tempfile.mkdtemp()
    orig_dir = os.getcwd()
    try:
        os.chdir(test_dir)
        os.makedirs("assets/data", exist_ok=True)

        with pytest.raises(ValueError, match="too large"):
            logo_fetch("test-run", {
                "url": "https://example.com/huge.png",
                "repo": "test/repo",
                "max_bytes": 1024  # 1KB limit
            })
    finally:
        os.chdir(orig_dir)
        import shutil
        shutil.rmtree(test_dir)


def test_logo_fetch_blocks_private_ip(monkeypatch, tmp_path):
    """Test logo.fetch rejects private/loopback IPs (SSRF guard)."""
    import socket as _s
    def fake_getaddrinfo(host, *a, **k):
        return [(_s.AF_INET, None, None, "", ("127.0.0.1", 0))]
    monkeypatch.setattr("socket.getaddrinfo", fake_getaddrinfo)
    monkeypatch.chdir(tmp_path)

    from assistant_api.agent.tasks import logo_fetch
    import os
    os.makedirs("assets/data", exist_ok=True)

    with pytest.raises(ValueError, match="blocked non-public IP"):
        logo_fetch("test-run", {
            "url": "https://internal.example/logo.png",
            "repo": "owner/repo"
        })


def test_remove_logo_mapping(monkeypatch, tmp_path):
    """Test overrides.update can remove logo mappings."""
    import json
    from unittest.mock import MagicMock
    monkeypatch.chdir(tmp_path)

    # Mock emit to avoid database dependency
    mock_emit = MagicMock()
    monkeypatch.setattr("assistant_api.agent.tasks.emit", mock_emit)

    # Seed overrides with existing logo mappings
    d = tmp_path / "assets" / "data"
    d.mkdir(parents=True, exist_ok=True)
    (d / "og-overrides.json").write_text(
        json.dumps({
            "repo_logo": {"owner/repo": "assets/logos/r.png"},
            "title_logo": {"ProjectX": "assets/logos/x.png"}
        }),
        "utf-8"
    )

    # Call overrides.update with removal for repo
    from assistant_api.agent.tasks import overrides_update
    res = overrides_update("test-run", {"logo": {"repo": "owner/repo", "remove": True}})

    # Verify repo_logo mapping removed
    ov = json.loads((d / "og-overrides.json").read_text("utf-8"))
    assert "owner/repo" not in ov["repo_logo"]
    assert "ProjectX" in ov["title_logo"]  # Title logo still there

    # Now remove title logo
    res = overrides_update("test-run", {"logo": {"title": "ProjectX", "remove": True}})
    ov = json.loads((d / "og-overrides.json").read_text("utf-8"))
    assert "ProjectX" not in ov["title_logo"]


def test_interpret_remove_logo_for_repo():
    """Test 'remove logo for repo' command parsing."""
    cmd = "remove logo for repo leok974/leo-portfolio"
    plan, params = parse_command(cmd)
    assert plan == ["overrides.update", "og.generate", "status.write"]
    assert params["logo"]["repo"] == "leok974/leo-portfolio"
    assert params["logo"]["remove"] is True


def test_interpret_remove_logo_for_title():
    """Test 'remove logo for title' command parsing."""
    cmd = "remove logo for siteAgent"
    plan, params = parse_command(cmd)
    assert plan == ["overrides.update", "og.generate", "status.write"]
    assert params["logo"]["title"] == "siteAgent"
    assert params["logo"]["remove"] is True

