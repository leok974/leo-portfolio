# New Project Assets - Image Creation Guide

## Overview
Two new projects have been added to the portfolio:
1. **DermaAI (SkinSight)** - Completed project
2. **Pixo Banana Suite** - In-progress project

## Required Images

### DermaAI Thumbnail
- **Location:** `assets/dermaai-thumb.webp` (source)
- **Optimized versions will be generated in:** `assets/optimized/`
- **Required variants:**
  - `dermaai-thumb-xs.webp` (160w)
  - `dermaai-thumb-sm.webp` (400w)
  - `dermaai-thumb-md.webp` (800w)
  - `dermaai-thumb-lg.webp` (1200w)
  - `dermaai-thumb.webp` (base)
  - Also generate: `.avif`, `.jpg`, `.png` versions

### Pixo Banana Suite Thumbnail
- **Location:** `assets/pixo-banana-thumb.webp` (source)
- **Optimized versions will be generated in:** `assets/optimized/`
- **Required variants:**
  - `pixo-banana-thumb-xs.webp` (160w)
  - `pixo-banana-thumb-sm.webp` (400w)
  - `pixo-banana-thumb-md.webp` (800w)
  - `pixo-banana-thumb-lg.webp` (1200w)
  - `pixo-banana-thumb.webp` (base)
  - Also generate: `.avif`, `.jpg`, `.png` versions

## Image Requirements

### Dimensions
- Aspect ratio: 16:9 or similar (matches other project cards)
- Recommended base size: 1200x675px or 1920x1080px
- The optimization script will generate responsive variants

### Content Suggestions

**DermaAI:**
- Screenshot of the UI showing skin condition browsing
- Medical/health-related color scheme
- Clean, professional appearance
- Educational focus

**Pixo Banana Suite:**
- Pixel art sprite examples
- Animation frames or sprite sheet preview
- Retro game aesthetic
- Bright, colorful pixel art style

## Generation Methods

### Option 1: Use Existing Placeholder (Current State)
The projects currently use `hero-placeholder-sm.webp` as temporary images.

### Option 2: Create Custom Images

1. **Create source images:**
   ```bash
   # Place your source images in assets/
   assets/dermaai-thumb.png
   assets/pixo-banana-thumb.png
   ```

2. **Run optimization script:**
   ```bash
   node optimize-media.js
   ```

   This will automatically:
   - Generate responsive size variants (xs, sm, md, lg, xl)
   - Create multiple format versions (webp, avif, jpg, png)
   - Place all outputs in `assets/optimized/`

### Option 3: Use AI Generation
Generate placeholder images using AI tools:
- **Midjourney/DALL-E:** For concept art
- **Stable Diffusion:** For custom styles
- **Screenshot tools:** Capture actual project screenshots

### Option 4: Temporary Placeholders
Use gradient/solid color placeholders:
```bash
# Create simple colored placeholders with ImageMagick
convert -size 1200x675 xc:#4A90E2 assets/dermaai-thumb.png
convert -size 1200x675 xc:#E24A90 assets/pixo-banana-thumb.png
```

## Current Status

### ✅ Completed
- ✅ Project HTML case study pages created
  - `projects/dermaai.html`
  - `projects/pixo-banana-suite.html`
- ✅ Projects added to `projects.json`
- ✅ Projects added to `data/projects_knowledge.json`
- ✅ Project cards added to `index.html`
- ✅ `completed.html` automatically loads from `projects.json` (no manual update needed)

### ⏳ Pending
- ⏳ Create source images for DermaAI and Pixo Banana Suite
- ⏳ Run `node optimize-media.js` to generate responsive variants
- ⏳ Update thumbnail paths in `projects.json` if needed

## Testing

After creating images, verify:

1. **Homepage cards display correctly:**
   - Open `index.html`
   - Check both project cards show proper thumbnails

2. **Case study pages load properly:**
   - Open `projects/dermaai.html`
   - Open `projects/pixo-banana-suite.html`
   - Verify any images referenced in the pages load

3. **Completed page shows DermaAI:**
   - Open `completed.html`
   - Verify DermaAI appears as the only completed project
   - Check thumbnail displays correctly

4. **Responsive images work:**
   - Test on different screen sizes
   - Verify correct variants load (check Network tab)

## Notes

- The optimization script handles all format and size conversions automatically
- WebP and AVIF provide best compression with quality
- JPEG/PNG fallbacks ensure broad browser compatibility
- The current placeholder (`hero-placeholder-sm.webp`) is acceptable for development
- For production, custom project-specific images are recommended

## References

- Optimization script: `optimize-media.js`
- Existing project images for reference: `assets/optimized/ledgermind-cover-*`, `assets/optimized/clarity-companion-*`
- Image format specifications in `optimize-media.js` CONFIG object
