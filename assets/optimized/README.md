# Media Optimization Results

## Usage Guide

### Images
Use the following HTML pattern for optimized images with broad fallbacks:

```html
<picture>
  <source type="image/avif" srcset="assets/optimized/image-name.avif">
  <source type="image/webp" srcset="assets/optimized/image-name.webp">
  <source type="image/jpeg" srcset="assets/optimized/image-name.jpg">
  <img src="assets/optimized/image-name.png" alt="Description" loading="lazy" width="W" height="H">
</picture>
```

### Responsive Images
For responsive images, use srcset across formats. Example widths: 400/800/1200/1920.

```html
<picture>
  <source type="image/avif" srcset="assets/optimized/image-name-sm.avif 400w, assets/optimized/image-name-md.avif 800w, assets/optimized/image-name-lg.avif 1200w, assets/optimized/image-name-xl.avif 1920w" sizes="(max-width: 600px) 100vw, 50vw">
  <source type="image/webp" srcset="assets/optimized/image-name-sm.webp 400w, assets/optimized/image-name-md.webp 800w, assets/optimized/image-name-lg.webp 1200w, assets/optimized/image-name-xl.webp 1920w" sizes="(max-width: 600px) 100vw, 50vw">
  <source type="image/jpeg" srcset="assets/optimized/image-name-sm.jpg 400w, assets/optimized/image-name-md.jpg 800w, assets/optimized/image-name-lg.jpg 1200w, assets/optimized/image-name-xl.jpg 1920w" sizes="(max-width: 600px) 100vw, 50vw">
  <img src="assets/optimized/image-name-sm.png" alt="Description" loading="lazy" width="W" height="H">
</picture>
```

### Videos
Use multiple sources for broad compatibility:

```html
<video controls preload="metadata" poster="assets/optimized/video-name-poster.jpg">
  <source src="assets/optimized/video-name.webm" type="video/webm">
  <source src="assets/optimized/video-name.mp4" type="video/mp4">
  <track label="English" kind="captions" srclang="en" src="captions.vtt" default>
</video>
```

## Performance Tips
- AVIF offers the best compression but limited browser support
- WebP is well-supported and offers great compression
 - Always provide JPEG and/or PNG fallbacks for images
- Use WebM for videos when possible, MP4 for compatibility
- Add `loading="lazy"` to images below the fold
- Use `preload="metadata"` for videos to load only metadata initially
 - For vector inputs (SVG), raster fallbacks ensure social/embed compatibility

Generated: 2025-09-24T01:07:10.761Z
