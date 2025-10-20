# Resume and Logo Update - October 18, 2025

## Summary

Updated resume PDF and prepared for LedgerMind logo replacement.

## Changes Made

### 1. Resume PDF Update ✅

**New File Added**: `apps/portfolio-ui/public/resume/Leo_Klemet_Resume_2025.pdf`

- **Location**: `d:\leo-portfolio\apps\portfolio-ui\public\resume\Leo_Klemet_Resume_2025.pdf`
- **Source**: Clean 2025 resume template provided by user
- **Size**: 5,723 bytes (compact, optimized)
- **Format**: PDF 1.4 (ReportLab generated)

**Old File Preserved**: `Leo_Klemet_Resume.pdf` (70KB) kept for reference

### 2. LedgerMind Logo (Manual Step Required) ⏳

**Provided**: Beautiful LedgerMind logo with:
- Brain icon in center
- Radiating arrows in geometric pattern
- Cyan/green color scheme
- "LedgerMind" text below

**Target Location**: `apps/portfolio-ui/public/assets/ledgermind-logo.png`

**Current Status**: Logo image provided in attachment, needs to be manually saved

#### Steps to Complete:

1. Save the LedgerMind logo image (from chat attachment) to:
   ```
   d:\leo-portfolio\apps\portfolio-ui\public\assets\ledgermind-logo.png
   ```

2. Update `apps/portfolio-ui/public/projects.json` to reference the new logo:
   ```json
   {
     "ledgermind": {
       "title": "LedgerMind",
       "slug": "ledgermind",
       "tags": ["ai", "finance", "ml"],
       "thumbnail": "assets/ledgermind-logo.png",  // Changed from ledgermind-thumb.svg
       ...
     }
   }
   ```

3. Rebuild frontend:
   ```powershell
   pnpm build:portfolio
   ```

4. Test locally:
   ```powershell
   # Serve built files
   npx serve apps/portfolio-ui/dist-portfolio
   # Or run full container
   docker build -f Dockerfile.portfolio -t portfolio-test .
   docker run --rm -p 8090:80 portfolio-test
   ```

## File Structure

```
apps/portfolio-ui/public/
├── assets/
│   ├── ledgermind-thumb.svg          # Old SVG placeholder (can remove)
│   ├── ledgermind-logo.png           # ⏳ NEW: Save logo here
│   └── leo-avatar-md.png
├── resume/
│   ├── Leo_Klemet_Resume_2025.pdf    # ✅ NEW: Updated resume
│   ├── Leo_Klemet_Resume.pdf         # Old resume (can remove)
│   └── README.md
└── og/
    └── ... (Open Graph images)
```

## Resume Access

The resume can be accessed via these endpoints:

1. **Direct Download**: `/resume/Leo_Klemet_Resume_2025.pdf`
2. **Legacy Path**: `/resume/Leo_Klemet_Resume.pdf` (still works)
3. **Shortlink** (if configured): `/dl/resume`

## Portfolio Card Display

Once the logo PNG is saved, the LedgerMind project card will display:
- **Thumbnail**: New logo with brain and arrows
- **Fallback**: If PNG fails to load, falls back to `/og/og.png` with gradient background
- **Styling**: Uses `.project-thumbnail` CSS with `object-fit: cover` (or `contain` for fallback)

## Testing Checklist

After saving the logo PNG:

- [ ] Logo appears on LedgerMind project card
- [ ] Image loads correctly (200 status, no CSP violations)
- [ ] Fallback works if PNG is missing
- [ ] Resume PDF downloads correctly
- [ ] E2E tests pass (including new `projects.images.spec.ts`)

## Quick Commands

```powershell
# Build portfolio
pnpm build:portfolio

# Run E2E image tests
npx playwright test tests/e2e/portfolio/projects.images.spec.ts

# Deploy to production
docker build -f Dockerfile.portfolio -t ghcr.io/leok974/leo-portfolio/portfolio:latest .
docker push ghcr.io/leok974/leo-portfolio/portfolio:latest
```

## Notes

- The new resume is much smaller (5.7KB vs 70KB) - excellent for performance
- Logo image should be optimized for web (recommend max 400x300px, ~20-50KB)
- SVG would be ideal for sharp rendering at any size, but PNG works well too
- Consider converting logo to SVG in the future for best quality

## Related Files

- Resume endpoint handler: `assistant_api/routers/resume_public.py` (backend)
- Download link: `root.html` line 153-156
- Projects config: `apps/portfolio-ui/public/projects.json`
- Thumbnail rendering: `apps/portfolio-ui/portfolio.ts` line 171
- Image fallback CSS: `apps/portfolio-ui/portfolio.css` line 144-149
