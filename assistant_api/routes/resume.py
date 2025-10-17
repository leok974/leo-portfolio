"""
Resume generation endpoints
Dynamically generates markdown resume with latest projects from data/projects.json
"""
from fastapi import APIRouter, Response
from datetime import datetime
import pathlib
import json

router = APIRouter()

def load_projects(max_n=7):
    """Load projects from data/projects.json, sorted by updated_at descending"""
    projects_path = pathlib.Path("data/projects.json")
    if not projects_path.exists():
        return []

    with open(projects_path, "r", encoding="utf-8") as f:
        projects = json.load(f)

    # Filter and sort
    projects = [p for p in projects if p.get("show", True)]
    projects.sort(key=lambda p: p.get("updated_at", ""), reverse=True)

    # Ensure fields exist
    for p in projects:
        p.setdefault("stack", [])
        p.setdefault("highlights", [])

    return projects[:max_n]


@router.get("/resume/generate.md")
def resume_md():
    """Generate markdown resume with latest projects"""
    projects = load_projects()

    # Build markdown manually
    lines = [
        "---",
        "name: Leo Klemet",
        "role: AI Engineer / Full-Stack",
        "email: leoklemet.pa@gmail.com",
        "site: https://www.leoklemet.com",
        "github: https://github.com/leok974",
        f"generated_at: {datetime.utcnow().isoformat()}Z",
        "---",
        "",
        "# Leo Klemet",
        "**AI Engineer / Full-Stack**",
        "https://www.leoklemet.com • https://github.com/leok974 • leoklemet.pa@gmail.com",
        "",
        "## Summary",
        "Results-driven AI + full-stack engineer building agentic systems (SiteAgent, ApplyLens, LedgerMind).",
        "",
        "## Skills",
        "Python, TypeScript, FastAPI, React/Preact, Elasticsearch, Postgres, Docker, Playwright, LLMs/Agents",
        "",
        "## Projects (latest)",
    ]

    for p in projects:
        title = p.get("title", "Untitled")
        one_liner = p.get("one_liner", "")
        stack = p.get("stack", [])

        line = f"- **{title}** — {one_liner}"
        if stack:
            line += f" _(Stack: {', '.join(stack)})_"
        lines.append(line)

    lines.extend([
        "",
        "## Experience",
        "See LinkedIn for full history.",
        ""
    ])

    md = "\n".join(lines)
    return Response(content=md, media_type="text/markdown; charset=utf-8")
