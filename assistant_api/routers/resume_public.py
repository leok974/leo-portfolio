# assistant_api/routers/resume_public.py
"""Public resume generation endpoint for LinkedIn optimization."""
from __future__ import annotations

import datetime as dt
import io
import json
import os
import re
from pathlib import Path
from typing import List, Optional, Tuple

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse, PlainTextResponse, Response

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


# ---------- NEW: keyword tuner ----------
def _tune(roles: list[str], seniority: str | None) -> tuple[str, str, list[str]]:
    """Tune headline and about text based on role keywords and seniority."""
    roles = [r.strip().lower() for r in roles if r.strip()]
    seniority = (seniority or "").strip().lower()

    # Headline tuning
    headline = "AI Engineer · SWE · Generative AI / 3D Artist — Building self-updating agents & explainable ML dashboards"
    if "ai" in roles and "swe" in roles:
        headline = "AI Engineer / Software Engineer — Agents, RAG, and resilient backend systems"
    elif "ai" in roles:
        headline = "AI Engineer — Agents, LLM Ops, and Retrieval-Augmented Systems"
    elif "swe" in roles:
        headline = "Software Engineer — DX-first, testable systems with AI features"
    if seniority in {"junior", "mid", "senior"}:
        headline = f"{seniority.capitalize()} {headline}"

    # About tuning (append; keep core paragraph intact)
    about_tail = []
    if "ml" in roles or "ai" in roles:
        about_tail.append("Comfortable with local-first inference (Ollama), vector search (SQLite/pgvector), and latency/throughput trade-offs.")
    if "swe" in roles:
        about_tail.append("Strong DX mindset: CI/CD, coverage gates, CSP/security headers, and Playwright/Vitest suites.")
    if seniority == "senior":
        about_tail.append("Lead-friendly: scoping, simplifying, and shipping increments with measurable outcomes.")
    elif seniority == "junior":
        about_tail.append("Hands-on learner: bias toward iteration, measurable improvements, and code quality.")
    return headline, " ".join(about_tail), roles


# ---------- NEW: achievements from metrics ----------
def _load_achievements() -> list[str]:
    """
    Tries to read achievements metrics from a JSON file path in env:
    RESUME_METRICS_JSON=/path/to/metrics.json
    Expected keys (optional): ttfb_reduction_pct, users, coverage_pct, sse_p95_ms, costs_savings_pct.
    """
    path = os.getenv("RESUME_METRICS_JSON")
    if not path or not os.path.exists(path):
        return []
    try:
        data = json.loads(Path(path).read_text(encoding="utf-8"))
    except Exception:
        return []

    bullets = []
    if isinstance(data, dict):
        ttfb = data.get("ttfb_reduction_pct")
        users = data.get("users")
        cov = data.get("coverage_pct")
        p95 = data.get("sse_p95_ms")
        savings = data.get("costs_savings_pct")
        if ttfb:
            bullets.append(f"Reduced TTFB by {ttfb:.0f}% via caching & CSP tuning.")
        if p95:
            bullets.append(f"Cut streaming p95 latency to {int(p95)} ms with SSE optimizations.")
        if cov:
            bullets.append(f"Increased test coverage to {cov:.0f}%.")
        if users:
            bullets.append(f"Supported {int(users):,} total sessions (stable under load).")
        if savings:
            bullets.append(f"Lowered LLM costs by {savings:.0f}% through local-first inference.")
    return bullets


def _make_markdown(projects: list[dict], roles: list[str] = None, seniority: str | None = None) -> str:
    """Generate complete Markdown resume with optional role/seniority tuning."""
    if roles is None:
        roles = []

    year = dt.date.today().year
    head, tail, _ = _tune(roles, seniority)
    about = _about_blurb()
    if tail:
        about = about + " " + tail

    # prioritize signature projects
    featured_order = ["siteagent", "derma ai", "datapipe ai", "ledgermind"]

    def _rank(p):
        t = p.get("title", "").lower()
        for i, key in enumerate(featured_order):
            if key in t:
                return i
        return len(featured_order)

    projects_sorted = sorted(projects, key=_rank)

    achievements = _load_achievements()
    skills = _skills_from_projects(projects_sorted)

    # Build MD
    lines = []
    lines.append(f"# Leo Klemet — LinkedIn Resume ({year})")
    lines.append("")
    lines.append(f"**Headline:** {head}")
    lines.append("")
    lines.append("## About")
    lines.append(about)
    if achievements:
        lines.append("")
        lines.append("## Achievements")
        for a in achievements:
            lines.append(f"- {a}")
    lines.append("")
    lines.append("## Experience (Selected Projects, 2025)")
    for p in projects_sorted:
        title = p.get("title", "Project")
        lines.append(f"### {title} · 2025")
        for b in _project_bullet(p):
            lines.append(f"- {b}")
        lines.append("")
    lines.append("## Skills")
    # light role bias (bubble up ai/swe/ml keywords first)
    bias = {"ai", "swe", "ml"}.intersection(roles)
    if bias:
        def _prior(s):
            s2 = s.lower()
            return 0 if any(b in s2 for b in bias) else 1
        skills = sorted(set(skills), key=_prior)
    lines.append(", ".join(sorted(set(s.capitalize() for s in skills))))
    lines.append("")
    lines.append("## Links")
    lines.append("- Portfolio: https://assistant.ledger-mind.org")
    lines.append("- GitHub: https://github.com/leok974")
    return "\n".join(lines)


# ---------- NEW: compact LinkedIn text ----------
def _compact_linkedin_text(md: str, limit: int = 2600) -> str:
    """Produce a compact single-block text for LinkedIn 'About' or post body within char limit."""
    # Collapse markdown to plaintext-ish
    text = re.sub(r"^#.*\n?", "", md, flags=re.M)
    text = re.sub(r"^##? .*\n?", "", text, flags=re.M)
    text = re.sub(r"\*\*", "", text)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    # Keep first ~N chars
    if len(text) > limit:
        text = text[: max(0, limit - 1)].rstrip() + "…"
    return text


# ---------- NEW: PDF rendering (guarded) ----------
def _render_pdf(md_text: str) -> bytes:
    """Render markdown text to PDF using ReportLab. Raises 503 if ReportLab not installed."""
    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.lib.units import inch
        from reportlab.pdfgen import canvas
    except Exception:
        raise HTTPException(status_code=503, detail="pdf_unavailable: install reportlab")

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    width, height = letter
    x_margin, y_margin = 0.7 * inch, 0.7 * inch
    max_width = width - 2 * x_margin
    y = height - y_margin

    # simple wrap
    def wrap_lines(text: str, font="Helvetica", size=10.5, leading=13):
        c.setFont(font, size)
        lines = []
        for para in text.split("\n"):
            words = para.split(" ")
            line = ""
            for w in words:
                test = (line + " " + w).strip()
                if c.stringWidth(test, font, size) <= max_width:
                    line = test
                else:
                    lines.append(line)
                    line = w
            lines.append(line)
        return [(ln, leading) for ln in lines]

    # Title
    c.setFont("Helvetica-Bold", 16)
    c.drawString(x_margin, y, "Leo Klemet — LinkedIn Resume")
    y -= 18

    c.setFont("Helvetica", 9)
    c.drawString(x_margin, y, dt.date.today().isoformat())
    y -= 14

    # Body
    for line, leading in wrap_lines(md_text, size=10.5, leading=13):
        if y < y_margin + 20:
            c.showPage()
            y = height - y_margin
        c.drawString(x_margin, y, line)
        y -= leading

    c.showPage()
    c.save()
    return buf.getvalue()


# ---------- ENDPOINTS (updated/new) ----------


@router.get("/generate.md", response_class=PlainTextResponse)
def resume_markdown(roles: str | None = Query(None), seniority: str | None = Query(None)):
    """Public endpoint that returns LinkedIn-optimized Markdown resume derived from site content."""
    projects = _load_projects()
    if not projects:
        raise HTTPException(status_code=404, detail="no_site_content")
    roles_list = (roles or "").split(",") if roles else []
    md = _make_markdown(projects, roles_list, seniority)
    return PlainTextResponse(md, media_type="text/markdown")


@router.get("/copy.txt", response_class=PlainTextResponse)
def resume_copy(
    limit: int = Query(2600, ge=200, le=10000),
    roles: str | None = Query(None),
    seniority: str | None = Query(None)
):
    """Compact LinkedIn-ready text within character limit."""
    projects = _load_projects()
    if not projects:
        raise HTTPException(status_code=404, detail="no_site_content")
    roles_list = (roles or "").split(",") if roles else []
    md = _make_markdown(projects, roles_list, seniority)
    txt = _compact_linkedin_text(md, limit=limit)
    return PlainTextResponse(txt, media_type="text/plain; charset=utf-8")


@router.get("/generate.pdf")
def resume_pdf(roles: str | None = Query(None), seniority: str | None = Query(None)):
    """Generate PDF resume. Requires reportlab (returns 503 if not installed)."""
    projects = _load_projects()
    if not projects:
        raise HTTPException(status_code=404, detail="no_site_content")
    roles_list = (roles or "").split(",") if roles else []
    md = _make_markdown(projects, roles_list, seniority)
    pdf_bytes = _render_pdf(md)
    headers = {"Content-Disposition": 'inline; filename="Leo_Klemet_LinkedIn.pdf"'}
    return Response(content=pdf_bytes, media_type="application/pdf", headers=headers)
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
