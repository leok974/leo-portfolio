# Resume CTA Component - Quick Reference

## TL;DR
Replaced inline resume buttons with a proper Preact component to fix:
- ❌ Multiple phantom buttons all pointing to PDF
- ❌ Nested anchors (CSP violations)
- ❌ Footer text accidentally clickable
- ✅ Now: 1 link + 1 button per section, proper semantics

## Component Location
```
apps/portfolio-ui/src/components/ResumeCta.tsx
```

## Usage
```tsx
/** @jsxImportSource preact */
import { render } from 'preact';
import ResumeCta from './components/ResumeCta';

const mount = document.getElementById('resume-cta-root');
if (mount) render(<ResumeCta />, mount);
```

## HTML Mount Points
```html
<!-- About section -->
<div id="resume-cta-root"></div>

<!-- Contact section -->
<div id="resume-cta-footer-root"></div>
```

## What It Renders
```html
<div data-testid="resume-cta" role="group" aria-label="Resume actions">
  <!-- Real link: navigates to PDF -->
  <a href="/resume/Leo_Klemet_Resume_2025.pdf"
     class="btn-secondary"
     data-testid="resume-link">
    📑 Resume (PDF)
  </a>

  <!-- Real button: copies text -->
  <button type="button"
          class="btn-secondary"
          data-testid="copy-linkedin">
    📋 Copy for LinkedIn
  </button>
</div>
```

## Copy Text Format
```
Leo Klemet — AI Engineer / Full-Stack
Portfolio: https://www.leoklemet.com
Resume (PDF): https://www.leoklemet.com/resume/Leo_Klemet_Resume_2025.pdf
```

## Resume Links After Fix
Total: **3 links** (all intentional)
1. Social icons (About section): 1 link
2. ResumeCta (About section): 1 link
3. ResumeCta (Contact section): 1 link

No phantom buttons, no nested anchors, no wrappers.

## E2E Tests
```bash
npx playwright test tests/e2e/cta.footer.spec.ts --project=chromium
```

Expected:
- ✅ 2 actions per CTA (1 link + 1 button)
- ✅ Footer copyright is `<p>` not `<a>`
- ✅ 0 nested anchors
- ✅ Copy writes to clipboard

## Production
- ✅ Live: https://www.leoklemet.com/
- ✅ Both mount points rendering
- ✅ Image: `ghcr.io/leok974/leo-portfolio/portfolio:latest`
- ✅ Digest: `sha256:d370999394be8e728c4ce1a9d24e772c86bfdb8b177091797fc05574b2a8db83`

## Build
```powershell
pnpm run build:portfolio          # 421ms, 31.46 kB JS
docker build -f Dockerfile.portfolio -t ghcr.io/leok974/leo-portfolio/portfolio:latest .
docker push ghcr.io/leok974/leo-portfolio/portfolio:latest
```

## Deploy
```powershell
docker stop portfolio-nginx; docker rm portfolio-nginx
docker run -d --name portfolio-nginx -p 59446:80 ghcr.io/leok974/leo-portfolio/portfolio:latest
docker network connect infra_net portfolio-nginx --alias portfolio.int
cd deploy; .\cf-cache-purge.ps1
```

## Verify
```powershell
# Local
curl http://localhost:59446/ | Select-String "resume-cta"

# Production (wait 30s after cache purge)
Invoke-WebRequest https://www.leoklemet.com/ | Select-String "resume-cta"
# ✅ resume-cta-root
# ✅ resume-cta-footer-root
```

## Key Implementation Details

### Import Pattern
```tsx
/** @jsxImportSource preact */
import { useCallback } from 'preact/hooks';
```
⚠️ Must use `preact/hooks` not `react`

### Styling
Uses existing CSS classes: `btn-secondary`

### Bundle
All islands bundled into one `main-*.js` file by Vite

### CSP
- No inline handlers ✅
- Nonce added automatically ✅
- External scripts allowed via `script-src-elem` ✅

## Troubleshooting

### Component not rendering?
Check browser console for:
```
ResumeCta component initialized (about section)
ResumeCta component initialized (contact section)
```

### Copy not working?
- Check clipboard permissions
- Verify browser supports `navigator.clipboard`
- Test in secure context (HTTPS or localhost)

### Styling broken?
Verify `btn-secondary` class exists in `portfolio.css`

## Related Files
- `apps/portfolio-ui/src/components/ResumeCta.tsx` - Component
- `apps/portfolio-ui/src/resume-cta.main.tsx` - Entry point
- `apps/portfolio-ui/index.html` - Mount points
- `apps/portfolio-ui/src/main.ts` - Removed old handlers
- `tests/e2e/cta.footer.spec.ts` - E2E tests
- `CTA_FOOTER_FIX_COMPLETE.md` - Full documentation
