# assistant_api/utils/sitemap.py
from __future__ import annotations
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, List, Tuple, Optional
import fnmatch
import json
import os
import re
import xml.etree.ElementTree as ET

# Root guess (repo root where backend runs). Adjust if needed.
ROOT = Path(".").resolve()

def _split_env_paths(name: str) -> List[Path]:
    """Parse comma-separated paths from environment variable."""
    raw = os.environ.get(name, "").strip()
    return [Path(p).resolve() for p in raw.split(",") if p.strip()]

def _split_env_globs(name: str) -> List[str]:
    """Parse comma-separated glob patterns from environment variable."""
    raw = os.environ.get(name, "").strip()
    return [g.strip() for g in raw.split(",") if g.strip()]

def get_public_dirs() -> List[Path]:
    """Get public directories from env or defaults."""
    # Allow overriding public dirs from env (comma-separated)
    env_dirs = _split_env_paths("SEO_PUBLIC_DIRS")
    if env_dirs:
        return [p for p in env_dirs if p.exists() and p.is_dir()]
    # Default fallback
    return [
        ROOT / "public",              # vite/public
        ROOT / "dist",                # vite build
        ROOT,                         # fallback: repo root (index.html in root)
    ]

PUBLIC_DIRS = get_public_dirs()

SITEMAP_FILES_DEFAULT = [
    ROOT / "public" / "sitemap.xml",
    ROOT / "dist" / "sitemap.xml",
    ROOT / "sitemap.xml",
]
SITEMAP_FILES = [p for p in SITEMAP_FILES_DEFAULT if p.exists()]

HTML_EXT = (".html", ".htm")

TITLE_RE = re.compile(r"<\s*title[^>]*>(.*?)</\s*title\s*>", re.IGNORECASE | re.DOTALL)
TITLE_RE = re.compile(r"<\s*title[^>]*>(.*?)</\s*title\s*>", re.IGNORECASE | re.DOTALL)
DESC_RE = re.compile(
    r'<\s*meta[^>]+name\s*=\s*["\']description["\'][^>]*content\s*=\s*["\'](.*?)["\'][^>]*>',
    re.IGNORECASE | re.DOTALL,
)
HREF_HOST_RE = re.compile(r"^https?://[^/]+")

@dataclass
class PageMeta:
    path: str           # URL path like "/agent.html"
    title: Optional[str]
    desc: Optional[str]

def _read_text(p: Path) -> str:
    try:
        return p.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return ""

def _extract_title_desc(html: str) -> Tuple[Optional[str], Optional[str]]:
    title = None
    desc = None
    m = TITLE_RE.search(html)
    if m:
        title = re.sub(r"\s+", " ", m.group(1)).strip()
    m = DESC_RE.search(html)
    if m:
        desc = re.sub(r"\s+", " ", m.group(1)).strip()
    return title or None, desc or None

def _to_rel_url(path: Path, base: Path) -> str:
    """Convert filesystem path to site-relative URL (supports nested paths)."""
    rel = path.relative_to(base)
    return "/" + str(rel).replace("\\", "/")

def _dedupe_keep_first(items: Iterable[PageMeta]) -> List[PageMeta]:
    seen = set()
    out: List[PageMeta] = []
    for it in items:
        if it.path in seen:
            continue
        seen.add(it.path)
        out.append(it)
    return out

def _apply_globs(paths: List[str]) -> List[str]:
    """Apply include/exclude glob patterns from env to URL paths."""
    includes = _split_env_globs("SEO_SITEMAP_INCLUDE")
    excludes = _split_env_globs("SEO_SITEMAP_EXCLUDE")

    if includes:
        paths = [p for p in paths if any(fnmatch.fnmatch(p, g) for g in includes)]
    if excludes:
        paths = [p for p in paths if not any(fnmatch.fnmatch(p, g) for g in excludes)]

    return list(dict.fromkeys(paths))  # dedupe, preserve order

def _cache_write(pages: List[PageMeta]) -> None:
    """Optionally cache discovered pages to agent/artifacts/status.json."""
    if os.environ.get("SEO_SITEMAP_CACHE", "0") not in ("1", "true", "TRUE"):
        return

    art = ROOT / "agent" / "artifacts"
    art.mkdir(parents=True, exist_ok=True)
    status = art / "status.json"

    blob = {
        "pages": [{"path": p.path, "title": p.title, "desc": p.desc} for p in pages],
    }
    status.write_text(json.dumps(blob, indent=2), encoding="utf-8")

# -------- Sources --------

def load_from_sitemap_files() -> List[str]:
    """Return URL list from any discovered sitemap.xml (absolute or site-relative)."""
    urls: List[str] = []
    for sm in SITEMAP_FILES:
        if not sm.exists():
            continue
        try:
            tree = ET.parse(sm)
            for url in tree.findall(".//{*}url/{*}loc"):
                loc = (url.text or "").strip()
                if not loc:
                    continue
                # Convert absolute to site-relative (strip scheme+host)
                rel = HREF_HOST_RE.sub("", loc)
                rel = rel if rel.startswith("/") else f"/{rel}"
                urls.append(rel)
        except Exception:
            continue
    return _apply_globs(list(dict.fromkeys(urls)))  # dedupe, filter, preserve order

def load_from_public_dirs() -> List[Path]:
    """Scan PUBLIC_DIRS for *.html files (supports nested paths up to 3 levels)."""
    candidates: List[Path] = []
    for base in PUBLIC_DIRS:
        if not base.exists() or not base.is_dir():
            continue
        # Support nested paths: top-level, 1-level deep, 2-levels deep
        for p in list(base.glob("*.html")) + list(base.glob("*/*.html")) + list(base.glob("*/*/*.html")):
            candidates.append(p)

    # dedupe by path
    unique = {}
    for p in candidates:
        unique[p] = True
    return list(unique.keys())

# -------- Orchestrator --------

def discover_pages() -> List[PageMeta]:
    """
    Best-effort page discovery with env-based filtering:
    1) sitemap.xml if present
    2) *.html in public/dist (supports nested paths)
    3) fallback to common pages

    Env knobs:
    - SEO_PUBLIC_DIRS: comma-separated paths (default: public,dist,.)
    - SEO_SITEMAP_INCLUDE: comma-separated globs (e.g., /*.html,/blog/**)
    - SEO_SITEMAP_EXCLUDE: comma-separated globs (e.g., /drafts/*,/private/*)
    - SEO_SITEMAP_CACHE: "1" to write agent/artifacts/status.json
    """
    items: List[PageMeta] = []

    # 1) sitemap.xml
    rel_urls = load_from_sitemap_files()
    if rel_urls:
        for rel in rel_urls:
            # try to map to a file location to extract title/desc
            file_guess: Optional[Path] = None
            for base in PUBLIC_DIRS:
                candidate = (base / rel.lstrip("/")).resolve()
                if candidate.exists() and candidate.is_file():
                    file_guess = candidate
                    break
            title, desc = (None, None)
            if file_guess:
                html = _read_text(file_guess)
                title, desc = _extract_title_desc(html)
            items.append(PageMeta(path=rel, title=title, desc=desc))

    # 2) filesystem scan (adds anything not already found, supports nested paths)
    html_files = load_from_public_dirs()
    for f in html_files:
        # Derive base-relative URL for nested paths
        base_found: Optional[Path] = None
        for base in PUBLIC_DIRS:
            try:
                if f.is_relative_to(base):
                    base_found = base
                    break
            except (ValueError, TypeError):
                continue

        if base_found:
            url_path = _to_rel_url(f, base_found)
        else:
            url_path = "/" + f.name  # fallback

        # Apply glob filters to filesystem-discovered paths
        filtered = _apply_globs([url_path])
        if not filtered:
            continue

        if any(x.path == url_path for x in items):
            continue

        html = _read_text(f)
        title, desc = _extract_title_desc(html)
        items.append(PageMeta(path=url_path, title=title, desc=desc))

    # 3) fallback
    if not items:
        fallback = [
            PageMeta("/index.html", None, None),
            PageMeta("/agent.html", None, None),
        ]
        items.extend(fallback)

    # tidy and cache
    items = _dedupe_keep_first(items)
    _cache_write(items)
    return items


# --- File resolver (dev-only helpers) ---

def resolve_file_for_url_path(url_path: str) -> Optional[Path]:
    """
    Map a site-relative path like "/blog/post/index.html" to a real file
    inside one of SEO_PUBLIC_DIRS. Guards against traversal.
    """
    rel = url_path.lstrip("/")
    for base in get_public_dirs():
        if not base.exists():
            continue
        candidate = (base / rel).resolve()
        try:
            # ensure candidate is inside base (no traversal)
            candidate.relative_to(base.resolve())
        except Exception:
            continue
        if candidate.is_file():
            return candidate
    return None
