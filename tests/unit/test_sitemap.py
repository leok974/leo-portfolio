"""Unit tests for sitemap loader utility."""
import os
import shutil
import tempfile
from pathlib import Path
import pytest

from assistant_api.utils.sitemap import discover_pages, PageMeta


def write(p: Path, s: str):
    """Helper to write file with parent directory creation."""
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(s, encoding="utf-8")


HTML = """<!doctype html><html><head>
<title>Test Title</title>
<meta name="description" content="Desc here">
</head><body>ok</body></html>"""

SITEMAP = """<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
 <url><loc>https://example.com/index.html</loc></url>
 <url><loc>https://example.com/blog/post/index.html</loc></url>
</urlset>"""


def test_discover_pages_nested_and_meta(monkeypatch):
    """Test nested path discovery and title/desc extraction."""
    tmp = Path(tempfile.mkdtemp())
    try:
        public = tmp / "public"
        write(public / "index.html", HTML)
        write(public / "blog" / "post" / "index.html", HTML)
        write(public / "sitemap.xml", SITEMAP)

        monkeypatch.setenv("SEO_PUBLIC_DIRS", str(public))
        monkeypatch.setenv("SEO_SITEMAP_CACHE", "0")  # Disable cache for test

        # Clear include/exclude filters
        if "SEO_SITEMAP_INCLUDE" in os.environ:
            monkeypatch.delenv("SEO_SITEMAP_INCLUDE")
        if "SEO_SITEMAP_EXCLUDE" in os.environ:
            monkeypatch.delenv("SEO_SITEMAP_EXCLUDE")

        # Force reload of PUBLIC_DIRS
        import assistant_api.utils.sitemap as sitemap_module
        monkeypatch.setattr(sitemap_module, 'PUBLIC_DIRS', [public])
        monkeypatch.setattr(sitemap_module, 'SITEMAP_FILES', [public / "sitemap.xml"])
        monkeypatch.setattr(sitemap_module, 'ROOT', tmp)

        pages = discover_pages()
        paths = [p.path for p in pages]

        assert "/index.html" in paths
        assert "/blog/post/index.html" in paths

        # Verify titles/descs extracted
        meta = {p.path: (p.title, p.desc) for p in pages}
        assert meta["/index.html"][0] == "Test Title"
        assert meta["/index.html"][1] == "Desc here"
        assert meta["/blog/post/index.html"][0] == "Test Title"
        assert meta["/blog/post/index.html"][1] == "Desc here"

    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def test_include_exclude(monkeypatch):
    """Test include/exclude glob filtering."""
    tmp = Path(tempfile.mkdtemp())
    try:
        public = tmp / "public"
        write(public / "index.html", HTML)
        write(public / "blog" / "post" / "index.html", HTML)
        write(public / "drafts" / "secret.html", HTML)

        monkeypatch.setenv("SEO_PUBLIC_DIRS", str(public))
        monkeypatch.setenv("SEO_SITEMAP_INCLUDE", "/index.html,/blog/*")
        monkeypatch.setenv("SEO_SITEMAP_EXCLUDE", "/drafts/*")
        monkeypatch.setenv("SEO_SITEMAP_CACHE", "0")

        # Force reload
        import assistant_api.utils.sitemap as sitemap_module
        monkeypatch.setattr(sitemap_module, 'PUBLIC_DIRS', [public])
        monkeypatch.setattr(sitemap_module, 'SITEMAP_FILES', [])
        monkeypatch.setattr(sitemap_module, 'ROOT', tmp)

        pages = discover_pages()
        paths = [p.path for p in pages]

        assert "/index.html" in paths
        assert "/blog/post/index.html" in paths
        assert "/drafts/secret.html" not in paths

    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def test_fallback_when_no_pages(monkeypatch):
    """Test fallback to default pages when no HTML files found."""
    tmp = Path(tempfile.mkdtemp())
    try:
        empty_dir = tmp / "empty"
        empty_dir.mkdir()

        monkeypatch.setenv("SEO_PUBLIC_DIRS", str(empty_dir))
        monkeypatch.setenv("SEO_SITEMAP_CACHE", "0")

        if "SEO_SITEMAP_INCLUDE" in os.environ:
            monkeypatch.delenv("SEO_SITEMAP_INCLUDE")
        if "SEO_SITEMAP_EXCLUDE" in os.environ:
            monkeypatch.delenv("SEO_SITEMAP_EXCLUDE")

        # Force reload
        import assistant_api.utils.sitemap as sitemap_module
        monkeypatch.setattr(sitemap_module, 'PUBLIC_DIRS', [empty_dir])
        monkeypatch.setattr(sitemap_module, 'SITEMAP_FILES', [])
        monkeypatch.setattr(sitemap_module, 'ROOT', tmp)

        pages = discover_pages()
        paths = [p.path for p in pages]

        # Should return fallback defaults
        assert "/index.html" in paths
        assert "/agent.html" in paths
        assert len(paths) == 2

    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def test_cache_write(monkeypatch):
    """Test that cache file is written when SEO_SITEMAP_CACHE=1."""
    tmp = Path(tempfile.mkdtemp())
    try:
        public = tmp / "public"
        write(public / "index.html", HTML)

        monkeypatch.setenv("SEO_PUBLIC_DIRS", str(public))
        monkeypatch.setenv("SEO_SITEMAP_CACHE", "1")

        if "SEO_SITEMAP_INCLUDE" in os.environ:
            monkeypatch.delenv("SEO_SITEMAP_INCLUDE")
        if "SEO_SITEMAP_EXCLUDE" in os.environ:
            monkeypatch.delenv("SEO_SITEMAP_EXCLUDE")

        # Force reload
        import assistant_api.utils.sitemap as sitemap_module
        monkeypatch.setattr(sitemap_module, 'PUBLIC_DIRS', [public])
        monkeypatch.setattr(sitemap_module, 'SITEMAP_FILES', [])
        monkeypatch.setattr(sitemap_module, 'ROOT', tmp)

        pages = discover_pages()

        # Check cache file was created
        status = tmp / "agent" / "artifacts" / "status.json"
        assert status.exists()

        # Verify cache content
        import json
        cache_data = json.loads(status.read_text())
        assert "pages" in cache_data
        assert len(cache_data["pages"]) > 0
        assert cache_data["pages"][0]["path"] == "/index.html"
        assert cache_data["pages"][0]["title"] == "Test Title"

    finally:
        shutil.rmtree(tmp, ignore_errors=True)
