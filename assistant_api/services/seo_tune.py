# assistant_api/services/seo_tune.py
from __future__ import annotations
import os
import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, List, Dict, Tuple

# Optional: wire to your existing events/logging bus
try:
    from assistant_api.services.agent_events import emit_event
except Exception:  # pragma: no cover
    def emit_event(**kwargs):
        print("[agent_event]", kwargs)

ARTIFACTS_DIR = Path(os.environ.get("AGENT_ARTIFACTS_DIR", "agent/artifacts"))
OG_DIR = Path("assets/og")
SITEMAP_PATH = Path("sitemap.xml")
SITEMAP_MEDIA_PATH = Path("sitemap-media.xml")

@dataclass
class SeoProposal:
    slug: str
    title_before: str | None
    title_after: str
    desc_before: str | None
    desc_after: str
    og_before: str | None
    og_after: str | None
    reason: str


def _ensure_dirs() -> None:
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    OG_DIR.mkdir(parents=True, exist_ok=True)


def _collect_projects() -> List[Dict]:
    """Collect project content/metadata.
    Replace this with your real loaders (JSON/YAML/MD parsing).
    Must return items with keys: slug, title, description, text.
    """
    # TODO: integrate with your actual content source
    projects_path = Path("projects.json")
    if projects_path.exists():
        return json.loads(projects_path.read_text(encoding="utf-8"))
    # Fallback minimal stub
    return [
        {
            "slug": "siteagent",
            "title": "SiteAgent — Self-updating Portfolio",
            "description": "Agentic website that optimizes layout and SEO automatically.",
            "text": "SiteAgent keeps projects, OG images, and SEO fresh via nightly jobs.",
        }
    ]


def _propose_meta(project: Dict) -> Tuple[str, str, str, str, str]:
    """Return (title_before, title_after, desc_before, desc_after, reason).
    Implement real LLM call here (local-first → fallback)."""
    title_before = project.get("title")
    desc_before = project.get("description")

    # Heuristic + keyword nudge (replace with LLM call)
    slug = project["slug"].replace("-", " ")
    base = project.get("title") or slug.title()
    text = (project.get("text") or "").strip()

    title_after = f"{base} — AI Portfolio · SiteAgent"
    desc_after = (desc_before or text or base).strip()
    if len(desc_after) > 155:
        desc_after = desc_after[:152].rstrip() + "…"

    reason = (
        "Clarified value prop, added brand tail for consistency, kept description within 155 chars. "
        "Heuristic stub; replace with LLM meta generator."
    )
    return title_before, title_after, desc_before, desc_after, reason


def _write_diff_and_reason(proposals: List[SeoProposal]) -> Tuple[Path, Path]:
    _ensure_dirs()
    diff_path = ARTIFACTS_DIR / "seo-tune.diff"
    md_path = ARTIFACTS_DIR / "seo-tune.md"

    lines = []
    reasons = ["# SEO Tune — Reasoning\n"]
    ts = datetime.now(timezone.utc).isoformat()
    for p in proposals:
        lines.append(f"--- a/projects/{p.slug}.meta\n")
        lines.append(f"+++ b/projects/{p.slug}.meta\n")
        if p.title_before != p.title_after:
            lines.append(f"- title: {p.title_before}\n")
            lines.append(f"+ title: {p.title_after}\n")
        if p.desc_before != p.desc_after:
            lines.append(f"- description: {p.desc_before}\n")
            lines.append(f"+ description: {p.desc_after}\n")
        if p.og_before != p.og_after:
            lines.append(f"- og_image: {p.og_before}\n")
            lines.append(f"+ og_image: {p.og_after}\n")
        reasons.append(f"## {p.slug}\n- {p.reason}\n")

    diff_path.write_text("".join(lines), encoding="utf-8")
    md_path.write_text("\n".join([f"_generated: {ts}_", *reasons]), encoding="utf-8")
    return diff_path, md_path


def _regenerate_og(slug: str) -> Tuple[str | None, str | None]:
    """Call your real OG generator; return (before, after) paths as strings.
    Replace stub with import of your existing service."""
    before = str((OG_DIR / f"{slug}.png").as_posix()) if (OG_DIR / f"{slug}.png").exists() else None
    # Stub: touch/update a file to simulate regen
    out = OG_DIR / f"{slug}.png"
    out.write_bytes(b"PNGSTUB")
    after = str(out.as_posix())
    return before, after


def _regenerate_sitemaps() -> None:
    # Replace with real sitemap generator(s)
    SITEMAP_PATH.write_text("""<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<!-- stub sitemap regenerated -->\n""", encoding="utf-8")
    SITEMAP_MEDIA_PATH.write_text("<!-- stub media sitemap regenerated -->\n", encoding="utf-8")


def run_seo_tune(dry_run: bool = False) -> Dict:
    emit_event(task="seo.tune", phase="start")
    projects = _collect_projects()

    proposals: List[SeoProposal] = []
    for proj in projects:
        title_b, title_a, desc_b, desc_a, reason = _propose_meta(proj)
        og_b, og_a = _regenerate_og(proj["slug"])  # swap for real service
        proposals.append(
            SeoProposal(
                slug=proj["slug"],
                title_before=title_b,
                title_after=title_a,
                desc_before=desc_b,
                desc_after=desc_a,
                og_before=og_b,
                og_after=og_a,
                reason=reason,
            )
        )

    # Sitemaps (always rebuild, even in dry-run to validate pathing; swap to guard if needed)
    _regenerate_sitemaps()

    diff_path, md_path = _write_diff_and_reason(proposals)

    if dry_run:
        emit_event(task="seo.tune", phase="dry_run", diff=str(diff_path), md=str(md_path))
        return {"ok": True, "dry_run": True, "diff": str(diff_path), "log": str(md_path)}

    # TODO: apply changes to real meta sources (files or DB) before writing diff
    emit_event(task="seo.tune", phase="commit_ready", diff=str(diff_path), md=str(md_path))
    return {"ok": True, "dry_run": False, "diff": str(diff_path), "log": str(md_path)}
