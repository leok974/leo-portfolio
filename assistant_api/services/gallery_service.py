"""
Gallery Service - Manages gallery.json, uploads, and sitemap integration.

Handles:
- File uploads to public/assets/{uploads,video}
- Gallery item CRUD operations
- FFmpeg poster generation for videos
- Sitemap refresh and validation
"""
from __future__ import annotations

import json
import re
import shutil
import subprocess
import uuid
from datetime import datetime
from pathlib import Path
from typing import Literal, Optional

ROOT = Path(__file__).resolve().parent.parent.parent
PUBLIC = ROOT / 'public'
ASSETS = PUBLIC / 'assets'
UPLOADS = ASSETS / 'uploads'
VIDEOS = ASSETS / 'video'
GALLERY_JSON = PUBLIC / 'gallery.json'
NODE = shutil.which('node') or 'node'

SAFE_NAME_RE = re.compile(r"[^a-zA-Z0-9._-]+")


def slugify(name: str) -> str:
    """Convert name to safe filesystem/URL slug."""
    name = name.strip().replace(' ', '-')
    return SAFE_NAME_RE.sub('-', name).strip('-')


def ensure_dirs():
    """Ensure required directories exist."""
    for p in [ASSETS, UPLOADS, VIDEOS]:
        p.mkdir(parents=True, exist_ok=True)


def save_upload(file_bytes: bytes, filename: str, kind: Literal['image', 'video']) -> dict:
    """
    Save uploaded file to public/assets/{uploads,video}/YYYY/MM/filename.

    Returns:
        dict with 'path' (absolute) and 'url' (site-relative)
    """
    ensure_dirs()
    ts = datetime.utcnow()
    ym = ts.strftime('%Y/%m')
    base = slugify(filename)
    dest_dir = (VIDEOS if kind == 'video' else UPLOADS) / ym
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest_path = dest_dir / base

    with open(dest_path, 'wb') as f:
        f.write(file_bytes)

    # Site-root relative URL
    url = '/' + dest_path.relative_to(PUBLIC).as_posix()
    return {'path': str(dest_path), 'url': url}


def ffmpeg_poster(video_path: str, out_jpg_path: str) -> bool:
    """
    Extract poster frame from video using ffmpeg.

    Args:
        video_path: Path to source video
        out_jpg_path: Path to output JPG

    Returns:
        True if successful, False if ffmpeg unavailable or fails
    """
    ffmpeg = shutil.which('ffmpeg')
    if not ffmpeg:
        return False

    out = Path(out_jpg_path)
    out.parent.mkdir(parents=True, exist_ok=True)

    # Extract 1 frame at 1 second, scale to 1280px wide (preserve aspect)
    cmd = [
        ffmpeg, '-y', '-ss', '00:00:01.000', '-i', video_path,
        '-vframes', '1', '-vf', 'scale=1280:-2', out_jpg_path
    ]

    try:
        subprocess.run(
            cmd, check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        return out.exists() and out.stat().st_size > 0
    except subprocess.CalledProcessError:
        return False


def read_gallery() -> dict:
    """Read gallery.json, return empty structure if missing/invalid."""
    if not GALLERY_JSON.exists():
        return {'items': []}
    try:
        return json.loads(GALLERY_JSON.read_text('utf-8'))
    except Exception:
        return {'items': []}


def write_gallery(data: dict) -> None:
    """Write gallery.json with formatting."""
    GALLERY_JSON.parent.mkdir(parents=True, exist_ok=True)
    GALLERY_JSON.write_text(
        json.dumps(data, indent=2, ensure_ascii=False),
        'utf-8'
    )


def add_gallery_item(
    *,
    title: str,
    description: str = '',
    date: str | None = None,
    typ: Literal['image', 'video-local', 'youtube', 'vimeo'],
    src: str,
    poster: str | None = None,
    mime: str | None = None,
    tools: list[str] | None = None,
    workflow: list[str] | None = None,
    tags: list[str] | None = None
) -> dict:
    """
    Add new item to gallery.json (prepends to items array).

    Returns:
        The created item dict
    """
    data = read_gallery()
    item = {
        'id': slugify(f"{title}-{uuid.uuid4().hex[:6]}"),
        'title': title,
        'description': description or '',
        'date': date or datetime.utcnow().date().isoformat(),
        'type': typ,
        'src': src,
        **({'poster': poster} if poster else {}),
        **({'mime': mime} if mime else {}),
        **({'tools': tools} if tools else {}),
        **({'workflow': workflow} if workflow else {}),
        **({'tags': tags} if tags else {}),
    }
    data.setdefault('items', []).insert(0, item)
    write_gallery(data)
    return item


def run_sitemap_refresh() -> None:
    """Run sitemap generator script (non-blocking)."""
    script = ROOT / 'scripts' / 'generate-sitemap.mjs'
    if script.exists():
        subprocess.run([NODE, str(script)], check=False)


def run_media_lint(strict: bool = False) -> bool:
    """
    Run media validation linter.

    Args:
        strict: If True, return False on validation errors

    Returns:
        True if validation passed (or warnings only)
    """
    script = ROOT / 'scripts' / 'validate-sitemap-media.mjs'
    if not script.exists():
        return True

    cmd = [NODE, str(script)] + (['--strict'] if strict else [])
    try:
        subprocess.run(cmd, check=True)
        return True
    except subprocess.CalledProcessError:
        return False
