# Gallery

**Data-driven creative showcase with consent-aware embeds.**

## Overview

The Gallery page (`/gallery.html`) displays a filterable grid of creative projects:
- **Local videos** with HTML5 `<video>` controls
- **Images** with lazy loading
- **YouTube/Vimeo embeds** with consent gating
- **Workflow breakdowns** under expandable `<details>`

All content is driven by `public/gallery.json` — no hardcoded HTML.

## Data Structure

**`public/gallery.json`:**
```json
{
  "items": [
    {
      "id": "unique_id",
      "title": "Project Title",
      "description": "Brief description for search/SEO",
      "date": "2025-10-02",
      "type": "video-local | image | youtube | vimeo",
      "src": "/assets/video/demo.mp4",
      "poster": "/assets/video/thumb.jpg",
      "mime": "video/mp4",
      "alt": "Alternative text for images",
      "tools": ["ComfyUI", "Blender"],
      "workflow": [
        "Step 1: Generate base",
        "Step 2: Refine",
        "Step 3: Export"
      ],
      "tags": ["animation", "shader"]
    }
  ]
}
```

### Field Reference

| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | Unique identifier |
| `title` | Yes | Display title |
| `description` | No | For search and SEO |
| `date` | No | Display date (YYYY-MM-DD) |
| `type` | Yes | `video-local`, `image`, `youtube`, `vimeo` |
| `src` | Yes | Asset path or embed URL |
| `poster` | No | Thumbnail for videos |
| `mime` | No | MIME type for local videos (default: `video/mp4`) |
| `alt` | No | Alt text for images |
| `tools` | No | Array of tool tags (renders as filter pills) |
| `workflow` | No | Array of workflow steps (renders as `<ol>`) |
| `tags` | No | Additional tags for search |

## Consent Integration

**YouTube/Vimeo embeds** require `consent.embeds = true`:

- **Embeds disabled:** Shows placeholder with "Enable embeds now" button
- **Embeds enabled:** Renders `<iframe>` directly
- **Real-time toggling:** Listens to `consent:changed` event

This ensures compliance with privacy policies and CSP directives.

## SEO & Sitemap

**Gallery media is auto-ingested from `gallery.json`** — you don't need to manually add entries to `sitemap.media.json`. The sitemap generator automatically includes:

- `type: image` → Image sitemap via `src`
- `type: video-local` → Video sitemap via `poster` (thumbnail) and `src` (content)
- `type: youtube|vimeo` → Video sitemap via `poster` (thumbnail) and `src` (player)

**Important:** Videos require a `poster` field to be included in video sitemaps.

### Generating Video Posters

Use the built-in script to extract poster frames from local videos:

```powershell
# Extract frame at 1 second (default)
npm run poster -- dist/assets/video/demo.mp4 public/assets/video/demo.jpg

# Extract frame at specific time
npm run poster -- dist/assets/video/demo.mp4 public/assets/video/demo.jpg 00:00:05

# For YouTube videos, use thumbnail download service or screenshot
```

**Workflow:**
1. Add video to `public/gallery.json` without poster
2. Build to get the video file in dist
3. Run `npm run poster` to extract a frame
4. Add `"poster": "/assets/video/filename.jpg"` to gallery.json
5. Rebuild and validate

### Manual Sitemap Entries (Optional)

If you need additional control, you can still add entries to `public/sitemap.media.json`:

```json
{
  "/gallery.html": {
    "images": [
      {
        "loc": "/assets/gallery/render.jpg",
        "caption": "Project title"
      }
    ],
    "videos": [
      {
        "thumbnail_loc": "/assets/video/thumb.jpg",
        "title": "Video title",
        "description": "Brief description",
        "content_loc": "/assets/video/demo.mp4"
      }
    ]
  }
}
```

**Note:** The sitemap generator automatically de-duplicates entries by URL, so manual and auto-ingested entries won't create duplicates.

**Validation:**
```powershell
npm run sitemap:lint        # Warnings only
npm run sitemap:lint:strict # Fails on missing assets
```

The linter verifies:
- Required fields are present
- Asset files exist in `dist/`
- URLs are properly formatted
- Videos have posters (warns if missing)

## Features

### Filtering & Search

- **Tool filters:** Click a tool tag (e.g., "ComfyUI") to show only matching items
- **Search:** Type to filter by title, description, tools, or tags
- **Reset:** Click "All" to clear filters

### Workflow Breakdown

Each card includes a `<details>` element with workflow steps:
```html
<details class="workflow">
  <summary>Workflow</summary>
  <ol class="steps">
    <li>Step 1</li>
    <li>Step 2</li>
  </ol>
</details>
```

Closed by default; click to expand.

### Accessibility

- `aria-live="polite"` on grid for dynamic updates
- `aria-pressed` on filter buttons
- `role="toolbar"` on tag bar
- Semantic HTML (`<article>`, `<details>`, `<summary>`)

## Styling

**File:** `public/assets/css/gallery.css`

Key variables:
```css
:root {
  --gap: 1rem;
  --muted: #7a7a7a;
}
```

**Responsive grid:**
```css
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--gap);
}
```

**Card layout:**
- 16:9 aspect ratio media container
- Dark theme with `#111` background
- Pills for tool tags
- Rounded corners (14px border-radius)

### Customization

Edit `gallery.css` directly:
- Change grid breakpoints via `minmax(280px, 1fr)`
- Adjust card backgrounds/borders
- Modify pill styles for tool tags
- Update placeholder text/colors

## Testing

**Playwright tests:** `tests/e2e/gallery.spec.ts`

Tests verify:
1. Gallery loads and renders cards
2. Embed placeholders show when consent disabled
3. Iframes show when consent enabled
4. Tool filters work correctly
5. Search filters items
6. Workflow details are expandable

**Run tests:**
```powershell
npx playwright test -g "@gallery" --project=chromium
```

## Build Integration

Gallery assets are validated automatically:

```json
{
  "scripts": {
    "postbuild": "npm run build:sri && npm run sitemap:gen && npm run sitemap:lint"
  }
}
```

1. **Vite build** → generates `dist/`
2. **SRI hashes** → `sri-manifest.json`
3. **Sitemap generation** → `sitemap.xml`, `sitemap-images.xml`, `sitemap-videos.xml`
4. **Media validation** → checks gallery assets exist

## Adding New Items

1. **Add entry to `public/gallery.json`:**
   ```json
   {
     "id": "new_project",
     "title": "New Project",
     "type": "image",
     "src": "/assets/gallery/new.jpg",
     "tools": ["Blender"],
     "workflow": ["Step 1", "Step 2"]
   }
   ```

2. **Add assets to `public/assets/gallery/` or `public/assets/video/`**

3. **Update `public/sitemap.media.json`:**
   ```json
   "/gallery.html": {
     "images": [
       { "loc": "/assets/gallery/new.jpg", "caption": "New Project" }
     ]
   }
   ```

4. **Build and validate:**
   ```powershell
   npm run build
   npm run sitemap:lint:strict
   ```

5. **Test:**
   ```powershell
   npx playwright test -g "@gallery"
   ```

## CI/CD Integration

Enable strict validation in CI to prevent broken deploys:

```yaml
# .github/workflows/ci.yml
- name: Build and validate
  run: |
    npm run build
    npm run sitemap:lint:strict
  env:
    SITE_URL: ${{ secrets.SITE_URL }}
```

This fails the build if:
- Gallery manifest references missing assets
- Sitemap media entries point to non-existent files
- Required fields are missing

## Performance

- **Lazy loading:** Images use `loading="lazy"`
- **Video preload:** Set to `metadata` only
- **JSON caching:** `cache:'no-store'` ensures fresh data
- **CSP-compliant:** No inline scripts or styles

## JSON-LD (SEO)

The gallery includes structured data for enhanced search engine visibility:

**What's generated:**
- `public/assets/js/gallery-schema.js` injects:
  - `BreadcrumbList` for Home → Gallery navigation
  - `CollectionPage` with `hasPart` entries per `gallery.json` item

**Mapping:**
- `type: image` → `ImageObject` (contentUrl = src, thumbnailUrl = src)
- `type: video-local` → `VideoObject` (contentUrl = src, thumbnailUrl = poster)
- `type: youtube|vimeo` → `VideoObject` (embedUrl = src, thumbnailUrl = poster)

**Features:**
- Runs client-side (no inline script; CSP-safe)
- Auto-includes tools and tags as keywords
- Creator attribution (Leo Klemet)
- ISO 8601 duration for local videos
- Rich snippets for search results

**Testing:**
```powershell
npx playwright test tests/e2e/gallery-schema.spec.ts --project=chromium
```

**Validation:**
- Use Google's [Rich Results Test](https://search.google.com/test/rich-results)
- Check Schema.org markup at [Schema Markup Validator](https://validator.schema.org/)

## Future Enhancements

**Optional improvements:**
- Pagination for large galleries (>50 items)
- Category tabs (e.g., "Videos", "Images", "Tutorials")
- Lightbox/modal for full-screen images
- Sort by date/title
- Share buttons (Twitter, LinkedIn)
- View count tracking (analytics integration)

## Troubleshooting

**Gallery doesn't load:**
- Check browser console for `gallery.json not found` error
- Verify `public/gallery.json` exists and is valid JSON
- Check network tab for 404 errors

**Embeds not showing:**
- Verify consent is enabled: `window.consent.get('embeds')`
- Check browser console for CSP errors
- Ensure embed URLs are valid (HTTPS)

**Linter fails:**
- Run `npm run sitemap:lint` to see specific errors
- Check that all `src`, `poster`, and `thumbnail_loc` paths exist in `dist/`
- Verify paths start with `/` (site-relative, not filesystem paths)

**Filters don't work:**
- Check that `tools` array is present in items
- Verify `window.__galleryReady` is `true`
- Check console for JavaScript errors

## File Summary

| File | Purpose |
|------|---------|
| `public/gallery.html` | Main page structure |
| `public/assets/js/gallery.js` | Manifest loading, filtering, rendering |
| `public/assets/css/gallery.css` | Styles and layout |
| `public/gallery.json` | Content manifest |
| `public/sitemap.media.json` | SEO media references |
| `tests/e2e/gallery.spec.ts` | Playwright tests |
| `docs/GALLERY.md` | This documentation |
