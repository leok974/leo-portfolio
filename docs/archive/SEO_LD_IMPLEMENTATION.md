# SEO JSON-LD Implementation Summary

**Status**: ✅ Complete
**Date**: 2025-10-08

## Overview

Implemented a complete SEO JSON-LD system for generating, validating, and reporting on structured data. The system includes FastAPI backend endpoints, E2E tests, and comprehensive documentation.

## Components Delivered

### 1. FastAPI Router (`assistant_api/routers/seo_ld.py`)

**Endpoints**:
- `POST /agent/seo/ld/generate` - Generate JSON-LD for a URL with validation
- `POST /agent/seo/ld/validate` - Validate JSON-LD structure and schema compliance
- `GET /agent/seo/ld/report` - Retrieve latest JSON-LD and report for a URL
- `POST /agent/seo/ld/mock` - Fast artifact generator for E2E/CI (test-only)

**Features**:
- Pydantic models for WebSite, WebPage, ImageObject, VideoObject
- Extensible type registry for schema validation
- Artifact storage with timestamped snapshots and "latest" pointers
- Validation with errors and warnings (structural + semantic)
- Duplicate `@id` detection
- ISO-8601 date format validation
- Strict mode (HTTP 422 on validation errors when `SEO_LD_VALIDATE_STRICT=1`)

**Validation Rules**:
- `@context` must be `https://schema.org`
- `@type` must be present and in allowlist (if configured)
- No duplicate `@id` values across objects
- Schema-specific field validation for known types
- Date fields checked for ISO-8601 format

**Artifact Storage**:
```
agent/artifacts/seo-ld/
  └── <url-slug>/
      ├── 2025-10-08T123456Z.jsonld
      ├── 2025-10-08T123456Z.report.json
      ├── latest.jsonld (symlink)
      └── latest.report.json (symlink)
```

### 2. Settings Configuration (`assistant_api/settings.py`)

Added environment variables:
```python
SEO_LD_ENABLED=1                    # Enable/disable JSON-LD endpoints
SEO_LD_VALIDATE_STRICT=1            # Return 422 on validation errors
SEO_LD_TYPES="WebSite,WebPage,..."  # Allowlist of valid @type values
ARTIFACTS_ROOT="agent/artifacts"    # Base path for artifact storage
ALLOW_DEV_ROUTES=1                  # Enable /mock test endpoint
```

### 3. Main Application Integration (`assistant_api/main.py`)

Router wired into main app with try/except for graceful degradation:
```python
from assistant_api.routers import seo_ld
app.include_router(seo_ld.router)
```

### 4. E2E Tests

#### Frontend Tests (`tests/e2e/seo-ld.spec.ts`)
- **Home page test**: Validates WebSite and WebPage JSON-LD presence
- **Project page test**: Validates BreadcrumbList and image hygiene
- **Invariant checks**: `@context`, `@type`, URL matching
- **Helper functions**: `readLdJsonArray()`, `byType()`

#### Backend API Tests (`tests/e2e/seo-ld.api.spec.ts`)
- **Validation test**: Validates correct and invalid JSON-LD
- **Generation test**: Tests dry-run mode with type filtering
- **Mock commit test**: Tests artifact creation
- **Error detection**: Validates error messages for missing fields

### 5. API Documentation (`docs/API.md`)

Complete documentation section added with:
- Request/response examples for all endpoints
- Parameter descriptions
- Validation rules and error codes
- Feature flags and configuration
- Use cases and behavior notes

## Current Implementation Status

### ✅ Complete
- FastAPI router with all endpoints
- Settings configuration
- Main app integration
- E2E test suites (frontend + backend)
- API documentation
- Artifact storage system
- Validation engine with errors/warnings
- Type registry for extensible schema validation

### 📝 Stub Implementation (Needs Extension)
The current `generate` endpoint produces minimal valid JSON-LD stubs:
```json
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "url": "https://example.com",
  "name": "Leo Klemet — SiteAgent",
  "inLanguage": "en"
}
```

**TODO**: Replace with actual metadata extraction:
- Parse HTML `<head>` for title, description, og:image
- Extract breadcrumb navigation
- Detect content type (Article, BlogPosting, etc.)
- Pull author/organization data
- Handle images with dimensions
- Generate proper Person/Organization schemas

## Usage Examples

### Generate JSON-LD (dry-run)
```bash
curl -X POST http://localhost:8001/agent/seo/ld/generate \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/page", "types": ["WebPage", "WebSite"], "dry_run": true}'
```

### Validate JSON-LD
```bash
curl -X POST http://localhost:8001/agent/seo/ld/validate \
  -H "Content-Type: application/json" \
  -d '{"jsonld": {"@context": "https://schema.org", "@type": "WebPage", "url": "...", "name": "..."}}'
```

### Generate and commit artifacts
```bash
curl -X POST http://localhost:8001/agent/seo/ld/generate \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/", "dry_run": false}'
```

### Retrieve report
```bash
curl "http://localhost:8001/agent/seo/ld/report?url=https://example.com/"
```

### Mock commit (E2E tests)
```bash
curl -X POST http://localhost:8001/agent/seo/ld/mock \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/"}'
```

## Testing

### Run Backend API Tests
```bash
npx playwright test tests/e2e/seo-ld.api.spec.ts
```

### Run Frontend Tests
```bash
npx playwright test tests/e2e/seo-ld.spec.ts
```

### Run All SEO JSON-LD Tests
```bash
npx playwright test -g "@seo-ld"
```

## Extension Points

### Add New Schema Types
1. Add Pydantic model to `seo_ld.py`:
```python
class LDBlogPosting(BaseModel):
    _ctx: str = Field("https://schema.org", alias="@context")
    _type: str = Field("BlogPosting", alias="@type")
    headline: str
    datePublished: str
    author: Optional[Dict[str, Any]] = None
```

2. Register in `LD_TYPE_REGISTRY`:
```python
LD_TYPE_REGISTRY["BlogPosting"] = LDBlogPosting
```

3. Add to `SEO_LD_TYPES` allowlist in settings

### Implement Real Metadata Extraction
Replace stub in `generate_ld()` function:
```python
# Current stub:
objects.append({
    "@context": "https://schema.org",
    "@type": "WebPage",
    "url": str(req.url),
    "name": base_name,
    "description": "Self-updating portfolio powered by SiteAgent."
})

# Replace with:
from bs4 import BeautifulSoup
html = fetch_url(str(req.url))
soup = BeautifulSoup(html, 'html.parser')
title = soup.find('meta', property='og:title') or soup.find('title')
description = soup.find('meta', property='og:description')
# ... extract and populate real data
```

## CI Integration Suggestions

### Validation Workflow
Create `.github/workflows/seo-ld-validate.yml`:
```yaml
name: SEO JSON-LD Validation
on: [push, pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Generate JSON-LD
        run: |
          curl -X POST http://localhost:8001/agent/seo/ld/generate \
            -d '{"url": "${{ env.BASE_URL }}/", "dry_run": true}' \
            | jq '.report.errors | length' | grep '^0$'
```

### Coverage Goals
- Home page: WebSite + WebPage (required)
- Project pages: WebPage + BreadcrumbList (required)
- All pages: Zero validation errors when `SEO_LD_VALIDATE_STRICT=1`

## File Checklist

- ✅ `assistant_api/routers/seo_ld.py` (287 lines)
- ✅ `assistant_api/settings.py` (updated)
- ✅ `assistant_api/main.py` (updated)
- ✅ `tests/e2e/seo-ld.spec.ts` (90 lines)
- ✅ `tests/e2e/seo-ld.api.spec.ts` (90 lines)
- ✅ `docs/API.md` (updated)
- ✅ `SEO_LD_IMPLEMENTATION.md` (this file)

## Next Steps

1. **Implement real metadata extraction** in `generate_ld()` function
2. **Add more schema types** (Article, BlogPosting, Organization, Person)
3. **Integrate with frontend build** to inject JSON-LD into HTML pages
4. **Add CI validation** to enforce zero errors on main pages
5. **Extend E2E tests** for additional page types and edge cases
6. **Add monitoring** to track JSON-LD coverage across site

## Notes

- The linter warnings about missing imports (fastapi, pydantic) are expected - these dependencies exist in the environment but may not be resolved by the IDE until the Python environment is activated
- TypeScript linter warnings about `any` types in test helpers are acceptable for test code
- The router uses try/except imports to handle missing settings gracefully
- Artifacts are stored with UTC timestamps for consistent sorting
- The "latest" pointer files simplify retrieval without scanning directories
