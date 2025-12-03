# Phase 50.4 - Quick Next Steps

**Status:** ✅ Backend stubs committed
**Commit:** Successfully executed
**Next:** Test & integrate real services

---

## 🚀 Quick Copy-Paste Commands

### 1. Install/Refresh Dependencies
```bash
pip install -r assistant_api/requirements.txt
```

**Why:** Ensures all dependencies are installed (if tests need anything new)

---

### 2. Run Unit Tests
```bash
pytest -q
```

**Expected Output:**
```
..                                                                   [100%]
2 passed in 0.5s
```

**Tests:**
- `test_seo_tune_dry_run` - Validates dry run execution
- `test_seo_tune_artifacts_content` - Verifies artifact structure

---

### 3. Manual Smoke Test

**Start backend first:**
```bash
uvicorn assistant_api.main:app --host 127.0.0.1 --port 8001 --reload
```

**Then test API:**
```bash
# Dry run (safe preview mode)
curl -s -X POST "http://127.0.0.1:8001/agent/seo/tune?dry_run=true" | jq

# Expected response:
# {
#   "ok": true,
#   "dry_run": true,
#   "diff": "agent/artifacts/seo-tune.diff",
#   "log": "agent/artifacts/seo-tune.md"
# }

# View generated diff
curl -s "http://127.0.0.1:8001/agent/seo/artifacts/diff"

# Expected: Unified diff showing title/description/OG changes
# --- a/projects/siteagent.meta
# +++ b/projects/siteagent.meta
# - title: ...
# + title: ...

# View reasoning log
curl -s "http://127.0.0.1:8001/agent/seo/artifacts/log"

# Expected: Markdown with reasoning per project
# # SEO Tune — Reasoning
# _generated: ..._
#
# ## siteagent
# - Clarified value prop, added brand tail...
```

---

## 🔧 Wire Real Services

### 1. Replace `_propose_meta` Heuristic

**File:** `assistant_api/services/seo_tune.py`

**Current (stub):**
```python
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
```

**Replace with (example):**
```python
from assistant_api.llm_client import chat as llm_chat

def _propose_meta(project: Dict) -> Tuple[str, str, str, str, str]:
    """Generate optimized meta tags using LLM (local-first → fallback)."""
    title_before = project.get("title")
    desc_before = project.get("description")

    # Build prompt for LLM
    prompt = f"""
Optimize SEO metadata for this project:
- Current title: {title_before}
- Current description: {desc_before}
- Content: {project.get('text', '')[:500]}

Generate:
1. A concise, keyword-rich title (max 60 chars)
2. A compelling description (120-155 chars) optimized for CTR
3. Brief reasoning for your choices

Format as JSON:
{{"title": "...", "description": "...", "reason": "..."}}
"""

    try:
        # Call LLM (local-first with fallback)
        response = llm_chat(
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=300
        )

        # Parse response
        import json
        result = json.loads(response.get("content", "{}"))

        title_after = result.get("title", title_before)
        desc_after = result.get("description", desc_before)
        reason = result.get("reason", "LLM optimization")

        # Validate length constraints
        if len(desc_after) > 155:
            desc_after = desc_after[:152].rstrip() + "…"

        return title_before, title_after, desc_before, desc_after, reason

    except Exception as e:
        # Fallback to heuristic if LLM fails
        emit_event(task="seo.tune", phase="llm_fallback", error=str(e))
        return title_before, title_before, desc_before, desc_before, f"LLM fallback: {e}"
```

---

### 2. Wire `_regenerate_og` Service

**File:** `assistant_api/services/seo_tune.py`

**Current (stub):**
```python
def _regenerate_og(slug: str) -> Tuple[str | None, str | None]:
    """Call your real OG generator; return (before, after) paths as strings.
    Replace stub with import of your existing service."""
    before = str((OG_DIR / f"{slug}.png").as_posix()) if (OG_DIR / f"{slug}.png").exists() else None
    # Stub: touch/update a file to simulate regen
    out = OG_DIR / f"{slug}.png"
    out.write_bytes(b"PNGSTUB")
    after = str(out.as_posix())
    return before, after
```

**Replace with (example):**
```python
from assistant_api.services.og_generate import generate_og_image  # Your existing service

def _regenerate_og(slug: str) -> Tuple[str | None, str | None]:
    """Generate OG image using existing service."""
    before = str((OG_DIR / f"{slug}.png").as_posix()) if (OG_DIR / f"{slug}.png").exists() else None

    try:
        # Call your existing OG generation service
        output_path = generate_og_image(
            project_slug=slug,
            output_dir=str(OG_DIR),
            # Add any other required parameters
        )
        after = str(output_path) if output_path else before
        return before, after

    except Exception as e:
        emit_event(task="seo.tune", phase="og_error", slug=slug, error=str(e))
        return before, before  # Keep existing on error
```

---

### 3. Wire `_regenerate_sitemaps` Service

**File:** `assistant_api/services/seo_tune.py`

**Current (stub):**
```python
def _regenerate_sitemaps() -> None:
    # Replace with real sitemap generator(s)
    SITEMAP_PATH.write_text("""<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<!-- stub sitemap regenerated -->\n""", encoding="utf-8")
    SITEMAP_MEDIA_PATH.write_text("<!-- stub media sitemap regenerated -->\n", encoding="utf-8")
```

**Replace with (example):**
```python
import subprocess

def _regenerate_sitemaps() -> None:
    """Regenerate sitemaps using existing Node.js script."""
    try:
        # Call your existing sitemap generator
        result = subprocess.run(
            ["node", "scripts/generate-sitemap.mjs"],
            capture_output=True,
            text=True,
            timeout=30
        )

        if result.returncode != 0:
            emit_event(task="seo.tune", phase="sitemap_error", stderr=result.stderr)
        else:
            emit_event(task="seo.tune", phase="sitemap_ok")

    except Exception as e:
        emit_event(task="seo.tune", phase="sitemap_exception", error=str(e))
```

---

### 4. Wire `_collect_projects` Loader

**File:** `assistant_api/services/seo_tune.py`

**Current (stub):**
```python
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
```

**Replace with (example):**
```python
import yaml
from pathlib import Path

def _collect_projects() -> List[Dict]:
    """Collect project metadata from projects/ directory."""
    projects = []
    projects_dir = Path("projects")

    if not projects_dir.exists():
        return []

    # Read all YAML/MD files in projects/
    for project_file in projects_dir.glob("*.{yaml,yml,md}"):
        try:
            content = project_file.read_text(encoding="utf-8")

            # Parse YAML frontmatter if markdown
            if project_file.suffix == ".md":
                if content.startswith("---"):
                    parts = content.split("---", 2)
                    metadata = yaml.safe_load(parts[1])
                    text = parts[2].strip()
                else:
                    continue
            else:
                metadata = yaml.safe_load(content)
                text = metadata.get("description", "")

            # Build project dict
            projects.append({
                "slug": metadata.get("slug", project_file.stem),
                "title": metadata.get("title", ""),
                "description": metadata.get("description", ""),
                "text": text[:500],  # First 500 chars
            })

        except Exception as e:
            emit_event(task="seo.tune", phase="parse_error", file=str(project_file), error=str(e))

    return projects
```

---

## 📊 Verification Checklist

After wiring real services:

- [ ] Unit tests still pass: `pytest -q`
- [ ] Dry run works: `curl ... /agent/run?task=seo.tune&dry_run=true`
- [ ] Artifacts generated: `curl ... /agent/artifacts/seo-tune.diff`
- [ ] LLM generates reasonable meta tags
- [ ] OG images regenerate successfully
- [ ] Sitemaps update with new timestamps
- [ ] No errors in backend logs

---

## 🎯 Success Indicators

**Artifact quality:**
- ✅ Titles are keyword-rich but readable
- ✅ Descriptions are 120-155 chars
- ✅ Reasoning explains optimization choices
- ✅ OG images have branded styling
- ✅ Sitemaps include all projects

**Performance:**
- ✅ Dry run completes in < 10 seconds
- ✅ Full run (with OG regen) < 60 seconds
- ✅ No memory leaks or hanging processes

---

## 📚 Documentation

- **[PHASE_50.4_SEO_OG_INTELLIGENCE.md](./docs/PHASE_50.4_SEO_OG_INTELLIGENCE.md)** - Full spec
- **[PHASE_50.4_IMPLEMENTATION_SUMMARY.md](./docs/PHASE_50.4_IMPLEMENTATION_SUMMARY.md)** - Integration guide
- **[PHASE_50.4_READY_TO_COMMIT.md](./PHASE_50.4_READY_TO_COMMIT.md)** - Commit summary

---

**Phase:** 50.4
**Status:** Backend stubs committed, ready for service integration
**Next:** Wire LLM, OG, sitemap services → Test → Deploy
