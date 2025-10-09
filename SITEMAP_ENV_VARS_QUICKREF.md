# Sitemap Loader Environment Variables — Quick Reference

## Overview
Configure the sitemap loader's behavior via environment variables for flexible page discovery.

## Environment Variables

### `SEO_PUBLIC_DIRS`
**Type**: Comma-separated paths
**Default**: `public,dist,.`
**Purpose**: Specify directories to scan for HTML files

**Examples**:
```bash
# Use only specific directories
export SEO_PUBLIC_DIRS="public,dist"

# Include custom location
export SEO_PUBLIC_DIRS="public,dist,/var/www/html"

# Use only one directory
export SEO_PUBLIC_DIRS="dist"
```

---

### `SEO_SITEMAP_INCLUDE`
**Type**: Comma-separated glob patterns
**Default**: (none - include all)
**Purpose**: Only include paths matching these patterns

**Examples**:
```bash
# Only top-level HTML files
export SEO_SITEMAP_INCLUDE="/*.html"

# Include specific directories
export SEO_SITEMAP_INCLUDE="/*.html,/blog/*,/projects/*"

# Include nested paths with wildcard
export SEO_SITEMAP_INCLUDE="/blog/**/*.html"
```

**Common Patterns**:
- `/*.html` — Top-level files only
- `/blog/*` — All files under /blog (1 level)
- `/blog/**` — All files under /blog (any depth)
- `*.html` — All HTML files anywhere

---

### `SEO_SITEMAP_EXCLUDE`
**Type**: Comma-separated glob patterns
**Default**: (none - exclude nothing)
**Purpose**: Exclude paths matching these patterns

**Examples**:
```bash
# Exclude drafts and temp files
export SEO_SITEMAP_EXCLUDE="/drafts/*,/tmp-e2e/*"

# Exclude test and build artifacts
export SEO_SITEMAP_EXCLUDE="/lhr-*,/.lighthouseci/*,/test-*"

# Exclude private content
export SEO_SITEMAP_EXCLUDE="/private/*,/admin/*"
```

**Common Patterns**:
- `/drafts/*` — Exclude drafts directory
- `/tmp-*` — Exclude temp directories
- `*-test.html` — Exclude test files
- `/private/**` — Exclude all private content

---

### `SEO_SITEMAP_CACHE`
**Type**: Boolean (`0` or `1`)
**Default**: `0`
**Purpose**: Write discovered pages to `agent/artifacts/status.json`

**Examples**:
```bash
# Enable caching
export SEO_SITEMAP_CACHE=1

# Disable caching (default)
export SEO_SITEMAP_CACHE=0
```

**Cache Format** (`agent/artifacts/status.json`):
```json
{
  "pages": [
    {
      "path": "/index.html",
      "title": "Portfolio Home",
      "desc": "Welcome to my portfolio"
    }
  ]
}
```

---

## Combined Usage

### Development (include everything except test files)
```bash
export SEO_PUBLIC_DIRS="public,dist"
export SEO_SITEMAP_EXCLUDE="/tmp-e2e/*,/lhr-*,/.lighthouseci/*"
export SEO_SITEMAP_CACHE=1

curl -X POST http://127.0.0.1:8001/agent/seo/keywords \
  -H "Authorization: Bearer dev" | jq '.items | length'
```

### Production (strict filtering)
```bash
export SEO_PUBLIC_DIRS="dist"
export SEO_SITEMAP_INCLUDE="/*.html,/blog/*.html,/projects/*.html"
export SEO_SITEMAP_EXCLUDE="/drafts/*,/admin/*"
export SEO_SITEMAP_CACHE=1

curl -X POST https://api.example.com/agent/seo/keywords \
  -H "Authorization: Bearer $TOKEN" | jq '.items | map(.page)'
```

### CI/CD (fast, deterministic)
```yaml
env:
  SEO_PUBLIC_DIRS: public
  SEO_SITEMAP_INCLUDE: "/*.html"
  SEO_SITEMAP_EXCLUDE: "/tmp-*,/test-*"
  SEO_SITEMAP_CACHE: "1"
```

---

## Testing

### Test Discovery Locally
```bash
# See all discovered pages
python -c "from assistant_api.utils.sitemap import discover_pages; \
  pages = discover_pages(); \
  print(f'{len(pages)} pages'); \
  [print(f'  {p.path}: {p.title}') for p in pages[:10]]"
```

### Test Filtering
```bash
# Test include filter
export SEO_SITEMAP_INCLUDE="/*.html,/blog/*"
python -c "from assistant_api.utils.sitemap import discover_pages; \
  pages = discover_pages(); \
  print(f'Included: {len(pages)} pages')"

# Test exclude filter
export SEO_SITEMAP_EXCLUDE="/tmp-e2e/*,/lhr-*"
python -c "from assistant_api.utils.sitemap import discover_pages; \
  pages = discover_pages(); \
  excluded = ['/tmp-e2e/index.html', '/lhr-test.html']; \
  paths = [p.path for p in pages]; \
  print(f'Excluded check: {all(e not in paths for e in excluded)}')"
```

### Test Cache
```bash
# Enable cache and verify
export SEO_SITEMAP_CACHE=1
rm -f agent/artifacts/status.json
python -c "from assistant_api.utils.sitemap import discover_pages; discover_pages()"
cat agent/artifacts/status.json | jq '.pages | length'
```

---

## Troubleshooting

### No pages discovered
**Problem**: `discover_pages()` returns empty list or fallback defaults

**Solutions**:
1. Check `SEO_PUBLIC_DIRS` points to correct directories
2. Verify HTML files exist in those directories
3. Check `SEO_SITEMAP_INCLUDE` isn't too restrictive
4. Temporarily disable filters to test:
   ```bash
   unset SEO_SITEMAP_INCLUDE
   unset SEO_SITEMAP_EXCLUDE
   ```

### Pages missing from discovery
**Problem**: Expected pages not in results

**Solutions**:
1. Check `SEO_SITEMAP_EXCLUDE` patterns
2. Verify glob patterns match correctly:
   ```bash
   python -c "import fnmatch; print(fnmatch.fnmatch('/blog/post.html', '/blog/*'))"
   ```
3. Enable cache and inspect `agent/artifacts/status.json`

### Cache not created
**Problem**: `agent/artifacts/status.json` doesn't exist after discovery

**Solutions**:
1. Verify `SEO_SITEMAP_CACHE=1` is set
2. Check write permissions for `agent/artifacts/` directory
3. Look for errors in backend logs

---

## References

- **Source**: `assistant_api/utils/sitemap.py`
- **Tests**: `tests/unit/test_sitemap.py`, `tests/e2e/seo-keywords.discovery.spec.ts`
- **Docs**: `docs/DEVELOPMENT.md`, `docs/API.md`
- **Phase**: 50.6.5 (Sitemap Loader Enhancements)
