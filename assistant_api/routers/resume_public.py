# assistant_api/routers/resume_public.py
"""Public resume generation endpoint for LinkedIn optimization."""
from __future__ import annotations
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse, PlainTextResponse
from pathlib import Path
import re
import json
import datetime as dt

router = APIRouter(prefix="/resume", tags=["resume"])

ROOT = Path(__file__).resolve().parents[2]  # repo root
SITE_INDEX = ROOT / "index.html"
PROJECTS_JSON = ROOT / "projects.json"


def _load_projects() -> list[dict]:
    """Try to read projects.json; fallback to parsing index.html cards."""
    if PROJECTS_JSON.exists():
        try:
            data = json.loads(PROJECTS_JSON.read_text(encoding="utf-8"))
            # normalize shape: expect [{slug,title,summary,tags,cats,links,year?}, ...]
            out = []
            for p in data:
                out.append({
                    "title": p.get("title") or p.get("name") or "Untitled Project",
                    "slug": p.get("slug") or "",
                    "summary": p.get("summary") or "",
                    "tags": p.get("tags") or p.get("labels") or [],
                    "cats": p.get("cats") or p.get("categories") or [],
                    "links": p.get("links") or p.get("sources") or [],
                    "year": p.get("year") or p.get("date") or "2025",
                })
            return out
        except Exception:
            pass

    # fallback: light DOM-less scrape for cards in index.html
    if not SITE_INDEX.exists():
        return []
    html = SITE_INDEX.read_text(encoding="utf-8")
    # naive capture: card blocks with data-title="..." or <h3>...</h3>
    titles = re.findall(r'data-title="([^"]+)"', html) or re.findall(r"<h3[^>]*>([^<]+)</h3>", html)
    # tags from data-tags='ai,ml,...'
    tag_groups = re.findall(r"data-tags=['\"]([^'\"]+)['\"]", html)
    summaries = re.findall(r'data-summary="([^"]+)"', html)
    out = []
    for i, t in enumerate(titles):
        tags = [x.strip() for x in (tag_groups[i] if i < len(tag_groups) else "").split(",") if x.strip()]
        out.append({
            "title": t.strip(),
            "slug": "",
            "summary": (summaries[i] if i < len(summaries) else "").strip(),
            "tags": tags,
            "cats": [],
            "links": [],
            "year": "2025",
        })
    return out


def _skills_from_projects(projects: list[dict]) -> list[str]:
    """Extract and deduplicate skills from project tags."""
    bag = set()
    for p in projects:
        for t in p.get("tags", []):
            if 1 <= len(t) <= 40:
                bag.add(t.lower())
    # add core stack keywords you consistently use
    core = {
        "AI Engineering", "FastAPI", "Python", "Postgres", "Docker", "Nginx",
        "Ollama", "OpenAI", "RAG", "Playwright", "Vite/React", "Tailwind",
        "Cloudflare", "KMS", "GitHub Actions", "Testing/CI", "Prometheus",
        "Generative AI", "3D/Blender", "ZBrush"
    }
    return sorted({*bag, *{c.lower() for c in core}})


def _linkedin_headline() -> str:
    """Generate LinkedIn headline."""
    return "AI Engineer · SWE · Generative AI / 3D Artist — Building self-updating agents & explainable ML dashboards"


def _about_blurb() -> str:
    """Generate about/summary section."""
    return (
        "I build agentic, self-maintaining apps that combine reliable backend engineering with "
        "AI/ML workflows. My recent work focuses on local-first inference (Ollama), RAG search, "
        "explainable finance analytics, and an autonomous portfolio 'SiteAgent' that updates content, media, "
        "and SEO via safe, auditable tasks. I care about DX, security (KMS, tokens-with-least-privilege), and testable CI."
    )


def _project_bullet(p: dict) -> list[str]:
    """Generate bullet points for a project."""
    t = p.get("title", "Project")
    s = p.get("summary", "")
    tags = p.get("tags", [])
    points = []
    if s:
        points.append(f"{s}")
    if tags:
        points.append("Tech: " + ", ".join(sorted(set(tags))[:8]))
    return points


def _make_markdown(projects: list[dict]) -> str:
    """Generate complete Markdown resume."""
    year = dt.date.today().year
    featured_order = ["siteAgent", "derma ai", "datapipe ai", "ledgermind"]
    
    # crude prioritization by title keywords
    def _rank(p):
        t = p.get("title", "").lower()
        for i, key in enumerate(featured_order):
            if key in t:
                return i
        return len(featured_order)
    
    projects_sorted = sorted(projects, key=_rank)

    # Build MD
    lines = []
    lines.append(f"# Leo Klemet — LinkedIn Resume ({year})")
    lines.append("")
    lines.append(f"**Headline:** {_linkedin_headline()}")
    lines.append("")
    lines.append("## About")
    lines.append(_about_blurb())
    lines.append("")
    lines.append("## Experience (Selected Projects, 2025)")
    for p in projects_sorted:
        title = p.get("title", "Project")
        lines.append(f"### {title} · 2025")
        for b in _project_bullet(p):
            lines.append(f"- {b}")
        lines.append("")
    lines.append("## Skills")
    skills = _skills_from_projects(projects_sorted)
    lines.append(", ".join(sorted(set(s.capitalize() for s in skills))))
    lines.append("")
    lines.append("## Links")
    lines.append("- Portfolio: https://assistant.ledger-mind.org (Agent Tools, live overlays)")
    lines.append("- GitHub: https://github.com/leok974")
    return "\n".join(lines)


@router.get("/generate.md", response_class=PlainTextResponse)
def resume_markdown():
    """Public endpoint that returns LinkedIn-optimized Markdown resume derived from site content."""
    projects = _load_projects()
    if not projects:
        raise HTTPException(status_code=404, detail="no_site_content")
    md = _make_markdown(projects)
    return PlainTextResponse(md, media_type="text/markdown")


@router.get("/generate.json")
def resume_json():
    """Same content in JSON for programmatic use (e.g., page export, future PDF)."""
    projects = _load_projects()
    if not projects:
        raise HTTPException(status_code=404, detail="no_site_content")
    md = _make_markdown(projects)
    return JSONResponse({
        "headline": _linkedin_headline(),
        "about": _about_blurb(),
        "projects": projects,
        "markdown": md,
        "year": dt.date.today().year
    })
