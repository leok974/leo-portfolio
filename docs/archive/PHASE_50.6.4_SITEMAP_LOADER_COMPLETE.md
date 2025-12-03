# Phase 50.6.4: Sitemap Loader Integration — COMPLETE ✅

**Date**: October 8, 2025
**Status**: ✅ Complete
**Branch**: LINKEDIN-OPTIMIZED

## Summary

Implemented a dependency-free sitemap loader utility that auto-discovers portfolio pages from `sitemap.xml` and filesystem scans, extracting metadata for the SEO keywords intelligence router.

## What Was Implemented

### 1. Sitemap Loader Utility (`assistant_api/utils/sitemap.py`)

**Features**:
- **Multi-Source Discovery** (in priority order):
  1. Parse `sitemap.xml` from `public/`, `dist/`, or repo root
  2. Scan filesystem for `*.html` files (top-level + one level deep)
  3. Fallback to hardcoded defaults (`/index.html`, `/agent.html`)

- **Metadata Extraction**:
  - Title: Regex extraction from `<title>...</title>` tags
  - Description: Regex extraction from `<meta name="description" content="...">`
  - Returns `PageMeta` dataclass with `path`, `title`, `desc`

- **Implementation Details**:
  - **Dependencies**: None (stdlib only: `xml.etree.ElementTree`, `re`, `pathlib`)
  - **Deduplication**: Preserves first occurrence of each page path
  - **Error Handling**: Graceful degradation on missing files or parse errors
  - **Path Normalization**: Converts absolute URLs to site-relative paths

**Key Functions**:
```python
@dataclass
class PageMeta:
    path: str           # URL path like "/agent.html"
    title: Optional[str]
    desc: Optional[str]

def discover_pages() -> List[PageMeta]:
    """Best-effort page discovery from sitemap.xml, filesystem, or defaults."""
```

### 2. Integration with SEO Keywords Router

**Changes in `assistant_api/routers/seo_keywords.py`**:

**Before** (hardcoded 3 pages):
```python
pages: List[Tuple[str, str, str]] = [
    ("/", "SiteAgent — Autonomous Portfolio Agent", "Self-maintaining..."),
    ("/agent.html", "Vision Manifesto — Agentic Website Builder", "Explore..."),
    ("/projects.html", "Projects — AI Automation Showcase", "Portfolio...")
]
```

**After** (auto-discovery):
```python
from assistant_api.utils.sitemap import discover_pages, PageMeta

discovered: List[PageMeta] = discover_pages()
pages: List[Tuple[str, str, str]] = [
    (p.path, p.title or "", p.desc or "") for p in discovered
]
```

**Impact**:
- Discovers **22+ pages** automatically (vs 3 hardcoded)
- Extracts real titles/descriptions from built HTML
- Eliminates manual maintenance of page list

### 3. Documentation Updates

**CHANGELOG.md**:
- Added "Sitemap Loader" entry under "Added" section
- Added "SEO Keywords Auto-Discovery" entry under "Changed" section
- Documents multi-source discovery and extraction capabilities

**docs/API.md**:
- Updated `/agent/seo/keywords` endpoint documentation
- Added "Page Discovery" section explaining auto-discovery process
- Updated request description (no longer mentions "defaults from settings/sitemap")

**docs/DEVELOPMENT.md**:
- Added "Sitemap Auto-Discovery" subsection under SEO keywords mock tests
- Includes quick test command for developers
- Documents discovery order and extraction method

## Test Results

### Discovery Test
```bash
$ python -c "from assistant_api.utils.sitemap import discover_pages; pages = discover_pages(); print(f'Found {len(pages)} pages')"
Found 22 pages
```

**Discovered Pages** (sample):
- `/gallery.html` — "Gallery · Creative Workflows"
- `/tools.html` — "Site Agent Tools - Admin Dashboard"
- `/agent.html` — "The Agent Behind This Site — Vision Manifesto"
- `/book.html` — "Book a call — Leo Klemet"
- `/completed.html` — "Completed Projects — Leo Klemet"
- `/clarity.html` — "Clarity Companion — Leo Klemet Portfolio"
- `/datapipe-ai.html` — "DataPipe AI — Leo Klemet Portfolio"
- `/dermaai.html` — "DermaAI (SkinSight) — Leo Klemet Portfolio"
- `/ledgermind.html` — "LedgerMind — Leo Klemet Portfolio"
- `/pixo-banana-suite.html` — "Pixo Banana Suite — Leo Klemet Portfolio"
- ...and 12 more pages

### End-to-End Integration Test
```bash
$ curl -s -X POST http://127.0.0.1:8001/agent/seo/keywords -H "Authorization: Bearer dev" | jq '{mode, total_pages: (.items | length)}'
{
  "mode": "llm",
  "total_pages": 22
}
```

✅ Successfully generates keywords for all 22 auto-discovered pages

### E2E Test Suite
```bash
$ npx playwright test tests/e2e/seo-keywords.mock.spec.ts tests/e2e/seo-keywords.fallback.spec.ts --project=chromium
Running 5 tests using 5 workers
  5 passed (1.1s)
```

✅ All tests pass with no modifications needed

## Technical Details

### Sitemap Loader Architecture

**Discovery Pipeline**:
```
sitemap.xml → load_from_sitemap_files() → ["/page1.html", "/page2.html", ...]
    ↓ (for each URL path)
    └─→ Find matching HTML file in PUBLIC_DIRS
        └─→ Extract title/desc via regex
            └─→ PageMeta(path="/page1.html", title="...", desc="...")

filesystem → load_from_public_dirs() → [Path("public/index.html"), ...]
    ↓ (for each HTML file)
    └─→ Read HTML content
        └─→ Extract title/desc via regex
            └─→ PageMeta(path="/index.html", title="...", desc="...")

fallback → [PageMeta("/index.html", None, None), PageMeta("/agent.html", None, None)]

All sources → _dedupe_keep_first() → Final List[PageMeta]
```

**Regex Patterns**:
```python
TITLE_RE = re.compile(r"<\s*title[^>]*>(.*?)</\s*title\s*>", re.IGNORECASE | re.DOTALL)
DESC_RE = re.compile(
    r'<\s*meta[^>]+name\s*=\s*["\']description["\'][^>]*content\s*=\s*["\'](.*?)["\'][^>]*>',
    re.IGNORECASE | re.DOTALL
)
```

**Error Handling**:
- Missing files: Returns empty string from `_read_text()`
- XML parse errors: Skips to next sitemap file
- Missing metadata: Returns `None` for title/desc
- No pages found: Falls back to defaults

## Benefits

### Before (Hardcoded Pages)
- ❌ Manual maintenance required
- ❌ Only 3 pages covered
- ❌ No metadata extraction
- ❌ Brittle (breaks when pages added/renamed)

### After (Auto-Discovery)
- ✅ Zero maintenance
- ✅ 22+ pages discovered automatically
- ✅ Real titles/descriptions from HTML
- ✅ Resilient to page additions/changes
- ✅ Graceful fallback on missing sources
- ✅ Dependency-free (stdlib only)

## Usage Examples

### Test Discovery Locally
```bash
# See what pages are discovered
python -c "from assistant_api.utils.sitemap import discover_pages; [print(f'{p.path}: {p.title}') for p in discover_pages()]"
```

### Generate Keywords for All Pages
```bash
curl -s -X POST http://127.0.0.1:8001/agent/seo/keywords \
  -H "Authorization: Bearer dev" | jq '.items | map({page, title, desc})'
```

### Check Artifact
```bash
cat agent_artifacts/seo-keywords.json | jq '.items | length'
# Expected: 22 (or however many pages exist)
```

## Files Changed

### New Files
- ✅ `assistant_api/utils/sitemap.py` (167 lines)
- ✅ `PHASE_50.6.4_SITEMAP_LOADER_COMPLETE.md` (this document)

### Modified Files
- ✅ `assistant_api/routers/seo_keywords.py` (added import + auto-discovery)
- ✅ `CHANGELOG.md` (Added + Changed sections)
- ✅ `docs/API.md` (Page Discovery section)
- ✅ `docs/DEVELOPMENT.md` (Sitemap Auto-Discovery subsection)

## Next Steps (Optional Enhancements)

### 1. Nested Path Handling
Currently uses simple `"/" + f.name` for filesystem paths. Could add base-relative logic:
```python
def _to_url_path(file_path: Path, base_dir: Path) -> str:
    """Convert filesystem path to site-relative URL."""
    rel = file_path.relative_to(base_dir)
    return "/" + str(rel).replace("\\", "/")
```

### 2. Google Trends Integration
The current mock returns deterministic trend scores. Real implementation could:
- Use `pytrends` library
- Query Google Trends API for actual interest scores
- Cache results to avoid rate limiting

### 3. Analytics Integration
Could enhance underperformer detection:
- Read from Cloudflare Analytics API
- Identify pages with CTR < 2%
- Boost keyword confidence for those pages

### 4. Sitemap Generation
Add a companion utility to **generate** sitemap.xml:
```python
def generate_sitemap(pages: List[PageMeta], base_url: str) -> str:
    """Generate sitemap.xml from PageMeta list."""
```

## Verification Checklist

- [x] Sitemap loader created with stdlib-only dependencies
- [x] Multi-source discovery (sitemap.xml → filesystem → fallback)
- [x] Metadata extraction (title, description) via regex
- [x] Integration with SEO keywords router
- [x] 22+ pages discovered automatically
- [x] All E2E tests pass (5/5)
- [x] Documentation updated (CHANGELOG, API, DEVELOPMENT)
- [x] Manual testing verified
- [x] Completion summary documented

## Conclusion

✅ **Phase 50.6.4 Complete**

The sitemap loader provides a robust, dependency-free solution for auto-discovering portfolio pages with metadata extraction. The SEO keywords router now automatically processes all portfolio pages without manual configuration.

**Key Achievement**: Replaced 3 hardcoded pages with auto-discovery of 22+ pages, with real titles/descriptions extracted from HTML.

---

**Ready for**: Commit and deployment
**Pattern**: Reusable for other routes that need page discovery (e.g., sitemap generation, link checking, A/B testing)
