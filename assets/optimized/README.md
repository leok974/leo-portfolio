# Media Optimization Results

## Usage Guide

### Images
Use the following HTML pattern for optimized images:

```html
<picture>
  <source srcset="assets/optimized/image-name.avif" type="image/avif">
  <source srcset="assets/optimized/image-name.webp" type="image/webp">
  <img src="assets/optimized/image-name.jpg" alt="Description" loading="lazy">
</picture>
```

### Responsive Images
For responsive images, use srcset:

```html
<picture>
  <source media="(min-width: 1200px)" srcset="assets/optimized/image-name-xl.webp" type="image/webp">
  <source media="(min-width: 800px)" srcset="assets/optimized/image-name-lg.webp" type="image/webp">
  <source media="(min-width: 400px)" srcset="assets/optimized/image-name-md.webp" type="image/webp">
  <img src="assets/optimized/image-name-sm.webp" alt="Description" loading="lazy">
</picture>
```

### Videos
Use multiple sources for broad compatibility:

```html
<video controls preload="metadata" poster="assets/optimized/poster.webp">
  <source src="assets/optimized/video-name.webm" type="video/webm">
  <source src="assets/optimized/video-name.mp4" type="video/mp4">
  <track label="English" kind="captions" srclang="en" src="captions.vtt" default>
</video>
```

## Performance Tips
- AVIF offers the best compression but limited browser support
- WebP is well-supported and offers great compression
- Always provide JPEG fallbacks for images
- Use WebM for videos when possible, MP4 for compatibility
- Add `loading="lazy"` to images below the fold
- Use `preload="metadata"` for videos to load only metadata initially

Generated: 2025-09-24T00:36:42.189Z
