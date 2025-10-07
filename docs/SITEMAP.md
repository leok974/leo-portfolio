# Sitemap & robots.txt Generation

This project includes an enhanced generator (`scripts/generate-sitemap.mjs`) that builds sitemaps with image/video support, gzip compression, and updates `robots.txt` using `SITE_URL`.

## Generated Files

We now generate:

- **sitemap.xml** (+ **sitemap.xml.gz**) - Main sitemap with all pages and optional media
- **sitemap-images.xml** - Image-only sitemap
- **sitemap-videos.xml** - Video-only sitemap
- **sitemap-index.xml** - Index pointing to all sitemaps (robots.txt references this)

All files are written to both `public/` and `dist/`.

## Usage

### One-off
```bash
SITE_URL="https://leok.dev" node scripts/generate-sitemap.mjs
```

### During build (recommended)
`package.json` scripts:
```json
{
  "scripts": {
    "build": "vite build",
    "build:sitemap": "node ./scripts/generate-sitemap.mjs",
    "postbuild": "npm run build:sitemap"
  }
}
```
Now just run:
```bash
SITE_URL="https://leok.dev" npm run build
```

## What it does

- Discovers HTML pages from `./dist` (preferred) or `./public`.
- Writes `sitemap.xml` to both `public/` and `dist/` when they exist.
- **NEW:** Creates gzipped version `sitemap.xml.gz` for bandwidth savings
- **NEW:** Reads `public/sitemap.media.json` for image/video metadata
- **NEW:** Generates split sitemaps: `sitemap-images.xml`, `sitemap-videos.xml`
- **NEW:** Creates `sitemap-index.xml` that references all sitemaps
- Adds/updates a `Sitemap:` line in `robots.txt` to point at `${SITE_URL}/sitemap-index.xml`

## Media Manifest (Optional)

To add images or videos to your sitemap, create `public/sitemap.media.json`:

```json
{
  "/": {
    "images": [
      {
        "loc": "/assets/og/preview.png",
        "caption": "Portfolio preview",
        "title": "Leo Klemet Portfolio"
      }
    ],
    "videos": []
  },
  "/book.html": {
    "images": [
      {
        "loc": "/assets/og/preview.png",
        "caption": "Book a consultation"
      }
    ],
    "videos": []
  }
}
```

### Video Example

```json
{
  "/projects/demo.html": {
    "videos": [
      {
        "thumbnail_loc": "/assets/video/thumb.jpg",
        "title": "Project Demo",
        "description": "Short demonstration of features",
        "content_loc": "/assets/video/demo.mp4",
        "publication_date": "2025-10-01",
        "duration": 120,
        "family_friendly": true,
        "tag": ["demo", "tutorial"]
      }
    ]
  }
}
```

**Supported image fields:**
- `loc` (required) - Image URL
- `caption` - Brief description
- `title` - Image title
- `geo_location` - Geographic location (e.g., "San Francisco, CA")
- `license` - License URL

**Supported video fields:**
- `thumbnail_loc` (required) - Thumbnail image URL
- `title` (required) - Video title
- `description` (required) - Video description
- `content_loc` - Direct video file URL
- `player_loc` - Embeddable player URL
- `duration` - Length in seconds
- `publication_date` - ISO date (YYYY-MM-DD)
- `family_friendly` - Boolean
- `tag` - String or array of tags

## Heuristics

- `/` → `weekly`, priority `0.9`
- `/book.html` → `monthly`, `0.8`
- `/privacy.html` → `yearly`, `0.6`
- `/projects/*` → `weekly`, `0.7`
- others → `monthly`, `0.5`

`lastmod` is taken from the file's `mtime`.

## CI tip

In GitHub Actions or any CI/CD:
```yaml
- name: Build
  run: npm ci && npm run build
  env:
    SITE_URL: https://leok.dev
```

### Ping search engines after deploy

After publishing your site, notify Google and Bing that a fresh sitemap exists. This helps crawlers discover changes faster.

Add this as a final step in your deployment workflow (e.g., `.github/workflows/deploy.yml`):

```yaml
- name: Ping search engines
  if: success()
  env:
    SITE: ${{ env.SITE_URL }}
  run: |
    curl -s -o /dev/null "https://www.google.com/ping?sitemap=${SITE}/sitemap-index.xml" || true
    curl -s -o /dev/null "https://www.bing.com/ping?sitemap=${SITE}/sitemap-index.xml" || true
```

**Notes:**
- Uses `|| true` to prevent workflow failure if ping fails
- Only runs if previous deploy steps succeeded
- Safe and quick (no blocking)

## Nginx cache headers (optional but recommended)

Make `robots.txt` and sitemaps cacheable but revalidate quickly on change:

```nginx
# In your nginx site config

# Enable gzip compression
gzip on;
gzip_comp_level 5;
gzip_types application/xml text/xml text/plain application/json text/css application/javascript;
gzip_vary on;

# Serve precompressed .gz files when available (no CPU cost at request time)
gzip_static on;

location = /robots.txt {
  add_header Cache-Control "public, max-age=3600, must-revalidate";
  default_type text/plain;
}

location = /sitemap.xml {
  add_header Cache-Control "public, max-age=3600, must-revalidate";
  default_type application/xml;
  # Nginx will automatically serve sitemap.xml.gz if it exists and client accepts gzip
}

location = /sitemap-images.xml {
  add_header Cache-Control "public, max-age=3600, must-revalidate";
  default_type application/xml;
}

location = /sitemap-videos.xml {
  add_header Cache-Control "public, max-age=3600, must-revalidate";
  default_type application/xml;
}

location = /sitemap-index.xml {
  add_header Cache-Control "public, max-age=3600, must-revalidate";
  default_type application/xml;
}
```

**Benefits:**
- Reduces server load (1 hour cache)
- Forces revalidation to catch updates quickly
- Correct `application/xml` content-type for sitemaps
- Precompressed gzip saves bandwidth (sitemap.xml.gz served automatically)
- Works with Cloudflare Tunnel (origin → tunnel benefits from gzip)

## Quick validation (PowerShell)

Test your sitemap locally or in production:

```powershell
# Set your site URL
$env:SITE_URL = "https://leok.dev"

# Basic XML validation
(Invoke-WebRequest "$env:SITE_URL/sitemap.xml").Content -match '<urlset' | Out-Null; $?
# Returns: True if valid XML

# Count URLs in sitemap
([xml](Invoke-WebRequest "$env:SITE_URL/sitemap.xml").Content).urlset.url.Count
# Returns: 3 (or however many pages)

# Check lastmod timestamps are present
([xml](Get-Content dist/sitemap.xml)).urlset.url | % { $_.lastmod } | ? { $_ } | Measure-Object
# Returns: Count : 3 (all URLs have lastmod)

# Verify robots.txt references sitemap-index
(Invoke-WebRequest "$env:SITE_URL/robots.txt").Content -match "Sitemap:\s*$env:SITE_URL/sitemap-index\.xml"
# Returns: True if correctly configured

# Check gzipped file exists and is smaller
Get-Item dist/sitemap.xml | % Length
Get-Item dist/sitemap.xml.gz | % Length
# Should show .gz is significantly smaller

# Verify all sitemap files exist
ls dist/sitemap*.xml*
# Should show: sitemap.xml, sitemap.xml.gz, sitemap-images.xml, sitemap-videos.xml, sitemap-index.xml
```

**Local testing** (before deploy):
```powershell
# Build first
npm run build

# Test local files
([xml](Get-Content dist/sitemap.xml)).urlset.url | Select-Object loc, priority, changefreq, lastmod | Format-Table

# Verify all lastmod timestamps
([xml](Get-Content dist/sitemap.xml)).urlset.url.lastmod | ForEach-Object { [datetime]$_ } | Sort-Object

# Check if images are in the sitemap
([xml](Get-Content dist/sitemap-images.xml)).urlset.url | % { $_.image.image } | Select-Object loc, caption

# Verify sitemap index
([xml](Get-Content dist/sitemap-index.xml)).sitemapindex.sitemap.loc
```

## Troubleshooting

- **Wrong domain in sitemap** → ensure `SITE_URL` is set in the environment where the build runs.
- **No `dist/`** → the generator will fall back to `public/` automatically.
- **Missing pages** → confirm the HTML files exist at build time (pre-render or copy to `public/`).
- **No images in sitemap** → verify `public/sitemap.media.json` exists and has valid JSON.
- **Gzip not served** → ensure nginx has `gzip_static on;` and client sends `Accept-Encoding: gzip`.
- **Video tags missing required fields** → check that `thumbnail_loc`, `title`, and `description` are present.

## Example Output

**sitemap.xml** (with media namespaces):
```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
  <url>
    <loc>https://leok.dev/</loc>
    <priority>0.9</priority>
    <changefreq>weekly</changefreq>
    <lastmod>2025-10-06T12:34:56.789Z</lastmod>
    <image:image>
      <image:loc>https://leok.dev/assets/og/preview.png</image:loc>
      <image:caption>Portfolio preview</image:caption>
    </image:image>
  </url>
  <url>
    <loc>https://leok.dev/book.html</loc>
    <priority>0.8</priority>
    <changefreq>monthly</changefreq>
    <lastmod>2025-10-06T12:34:56.789Z</lastmod>
  </url>
</urlset>
```

**sitemap-index.xml:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://leok.dev/sitemap.xml</loc>
  </sitemap>
  <sitemap>
    <loc>https://leok.dev/sitemap-images.xml</loc>
  </sitemap>
  <sitemap>
    <loc>https://leok.dev/sitemap-videos.xml</loc>
  </sitemap>
</sitemapindex>
```

**robots.txt:**
```
User-agent: *
Allow: /

Sitemap: https://leok.dev/sitemap-index.xml
```

## Optional nice-to-haves

Future enhancements you might consider:

1. ~~**Sitemap index for large sites**~~ ✅ **IMPLEMENTED** - Now generates `sitemap-index.xml` automatically
2. ~~**Image/video sitemaps**~~ ✅ **IMPLEMENTED** - Use `public/sitemap.media.json` to add images/videos
3. **News sitemap** - For time-sensitive content, use Google News sitemap format
4. **Alternative languages (hreflang)** - Add `<xhtml:link rel="alternate"` for i18n sites
5. **Automatic lastmod from git** - Use `git log -1 --format=%cI -- <file>` for commit-based timestamps
6. **CDN invalidation** - Trigger CloudFlare/Fastly cache purge after sitemap changes
7. **Analytics integration** - Track sitemap.xml requests to measure crawler activity

Most of these are only needed at scale or for specialized content types.

## File Summary

After running the generator, you'll have these files in both `public/` and `dist/`:

- `sitemap.xml` - Main sitemap with all pages (includes image/video if media.json present)
- `sitemap.xml.gz` - Gzip-compressed version (serves bandwidth-optimized sitemap)
- `sitemap-images.xml` - Separate image-only sitemap
- `sitemap-videos.xml` - Separate video-only sitemap
- `sitemap-index.xml` - Index referencing all sitemaps
- `robots.txt` - Updated to point to sitemap-index.xml

The gzipped version can save ~70-80% bandwidth for large sitemaps.

## Media Linter

**Script:** `scripts/validate-sitemap-media.mjs`

Validates `public/sitemap.media.json` to ensure:

### Image Validation
- **Required fields:** `loc`
- **Asset checks:** File must exist under `dist/` unless `loc` is an absolute URL
- **Optional fields:** `caption`, `title`, `geo_location`, `license` (license should be a URL)

### Video Validation
- **Required fields:** `thumbnail_loc`, `title`, `description`
- **At least one of:** `content_loc` OR `player_loc`
- **Asset checks:**
  - `thumbnail_loc` must exist under `dist/` unless absolute URL
  - `content_loc` is checked under `dist/` if relative; skipped if absolute URL
  - `player_loc` should be an absolute URL
- **Optional validation:**
  - `duration` should be a positive integer (seconds)
  - `publication_date` must be valid ISO date (YYYY-MM-DD)
  - `family_friendly` should be boolean
  - `tag` can be string or array of strings

### Usage

**Run locally (warnings only):**
```bash
npm run sitemap:lint
```

**Strict mode (fails on errors):**
```bash
npm run sitemap:lint:strict
```

**Custom dist directory:**
```bash
DIST_DIR=dist npm run sitemap:lint:strict
```

**In CI/CD:**
```yaml
- name: Build and validate sitemap
  run: |
    npm run build
    npm run sitemap:lint:strict  # Fail build on media errors
```

### Example Output

```
[media-lint:ERROR] page "/" image[0] loc: asset not found in dist: "/assets/og/preview.png"
[media-lint:WARN]  page "/book.html" video[0]: duration should be a positive integer (seconds)
[media-lint] 1 error(s), 1 warning(s). DIST="dist" MANIFEST="public/sitemap.media.json"
```

**Exit codes:**
- Normal mode: Always exits 0 (reports issues only)
- Strict mode (`--strict`): Exits 1 if any errors found

### Integration with Build

The linter runs automatically after `npm run build` via `postbuild` hook. To fail builds on errors, update `package.json`:

```json
{
  "scripts": {
    "postbuild": "npm run build:sri && npm run sitemap:gen && npm run sitemap:lint:strict"
  }
}
```

### Gallery auto-ingest

- `public/gallery.json` is auto-merged into the sitemap media for `/gallery.html`:
  - `type: image` → image sitemap entry via `src`
  - `type: video-local` → video sitemap entry using `poster` as `thumbnail_loc` and `src` as `content_loc` (poster required)
  - `type: youtube|vimeo` → video sitemap entry using `poster` as `thumbnail_loc` and `src` as `player_loc` (poster required)
- The media linter validates gallery assets too. Run `npm run sitemap:lint[:strict]` after build.
- **De-duplication:** If both `sitemap.media.json` and `gallery.json` reference the same asset URL, only one entry is created.

### Generating video posters

Use the `poster` script to extract frames from local videos:

```bash
# Extract frame at 1 second (default)
npm run poster -- dist/assets/video/demo.mp4 public/assets/video/demo.jpg

# Extract at specific timecode
npm run poster -- dist/assets/video/demo.mp4 public/assets/video/demo.jpg 00:00:05
```

**Requirements:** ffmpeg must be installed and available in PATH.

**Workflow:**
1. Add video to gallery.json (can omit poster initially)
2. Build project to get video in dist/
3. Run poster script to extract a good frame
4. Add `"poster": "/assets/video/filename.jpg"` to gallery item
5. Rebuild — video now appears in video sitemap
