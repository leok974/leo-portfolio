# Tailwind v4.1 Migration - Status & Next Steps

## ✅ Completed

### 1. Dependencies
- ✅ Removed `tailwindcss-animate` (replaced by `tw-animate-css`)
- ✅ Removed `tailwindcss-filters` (built into Tailwind core)
- ✅ Installed `tw-animate-css`
- ✅ Already have: `@tailwindcss/typography`, `@tailwindcss/aspect-ratio`, `tailwindcss-textshadow`
- ✅ Already have: `framer-motion`, `lottie-react`

### 2. Tailwind Config (`tailwind.config.ts`)
✅ Updated with:
```text
plugins: [
  require("@tailwindcss/typography"),
  require("@tailwindcss/aspect-ratio"),
  require("tailwindcss-textshadow"),
],
theme: {
  extend: {
    borderRadius: { '2xl': '1rem', '3xl': '1.25rem' },
    boxShadow: {
      soft: '0 10px 30px rgba(0,0,0,0.08)',
      glow: '0 0 24px rgba(99,102,241,0.35)'
    }
  }
}
```

### 3. Global CSS (`src/styles/tailwind.css`)
✅ Added:
```css
@import "tailwindcss";
@import "tw-animate-css";

@layer utilities {
  .hover-glow { /* glow on hover */ }
  .card { /* polished card style */ }
  .animate-fade-in { /* fade animation */ }
  .animate-slide-up { /* slide animation */ }
  .pressable { /* scale on press */ }
}
```

### 4. Build Verification
✅ Build successful: `✓ built in 2.27s`

## 📊 Current Setup

**Tailwind Version**: v4.1.14 ✅
- Built-in filter utilities (blur, brightness, contrast, etc.)
- Built-in text-shadow utilities (text-shadow-sm, text-shadow-lg, etc.)

**Project Type**: Vanilla HTML/TypeScript portfolio
- Main entry: `src/main.ts`
- Hero section: `index.html` line 230
- React components: Admin tools only (`src/components/AdminToolsPanel.tsx`, etc.)

## 🎯 Optional Enhancements

### Option 1: Use Built-in Text Shadow (Tailwind v4.1+)

Since you're on v4.1.14, you can use built-in text-shadow utilities:

**Remove plugin** (optional):
```bash
npm uninstall tailwindcss-textshadow
```

**Update tailwind.config.ts**:
```text
plugins: [
  require("@tailwindcss/typography"),
  require("@tailwindcss/aspect-ratio"),
  // Remove: require("tailwindcss-textshadow"),
],
```

**Usage**:
```html
<!-- Old (plugin) -->
<h1 class="text-shadow">Heading</h1>

<!-- New (built-in) -->
<h1 class="text-shadow-sm">Small shadow</h1>
<h1 class="text-shadow-lg">Large shadow</h1>
<h1 class="text-shadow-lg/30">30% opacity</h1>
```

### Option 2: Remove @tailwindcss/aspect-ratio

If you don't need Safari 14 support, use native utilities:

**Remove plugin**:
```bash
npm uninstall @tailwindcss/aspect-ratio
```

**Update tailwind.config.ts**:
```text
plugins: [
  require("@tailwindcss/typography"),
  // Remove: require("@tailwindcss/aspect-ratio"),
  require("tailwindcss-textshadow"),
],
```

**Usage**:
```html
<!-- Old (plugin) -->
<div class="aspect-w-16 aspect-h-9">
  <iframe src="..."></iframe>
</div>

<!-- New (built-in) -->
<div class="aspect-video">
  <iframe src="..."></iframe>
</div>
<div class="aspect-square">...</div>
<div class="aspect-[4/3]">...</div>
```

### Option 3: Apply Polish to Existing HTML

Add new utilities to `index.html`:

**Hero Section** (line 230+):
```html
<!-- Add text-shadow to heading -->
<h1 class="text-5xl font-bold text-shadow-lg md:text-6xl">
  Leo Klemet — AI Engineer
</h1>

<!-- Add hover-glow to buttons -->
<a href="#projects" class="cta-button pressable hover-glow">
  View Projects
</a>
```

**Video/Media Sections**:
```html
<!-- Wrap videos with aspect ratio and shadow -->
<div class="aspect-video rounded-2xl overflow-hidden shadow-soft">
  <video src="..."></video>
</div>
```

**Project Cards**:
```html
<!-- Add card + hover-glow to project cards -->
<div class="project-card card hover-glow">
  <h3>Project Title</h3>
  <p>Description</p>
</div>
```

### Option 4: Add Animations

Add scroll animations to sections:

**In HTML**:
```html
<!-- Add animate classes to sections -->
<section class="animate-fade-in" style="animation-delay: 0.1s">
  ...
</section>

<section class="animate-slide-up" style="animation-delay: 0.2s">
  ...
</section>
```

**Respect reduced motion**:
```css
/* Add to tailwind.css */
@media (prefers-reduced-motion: reduce) {
  .animate-fade-in,
  .animate-slide-up {
    animation: none !important;
    opacity: 1 !important;
  }
}
```

## 📝 Quick Reference

### New Utilities Available

| Class | Purpose | Example |
|-------|---------|---------|
| `.hover-glow` | Adds glow on hover | `<button class="hover-glow">` |
| `.card` | Polished card style | `<div class="card">` |
| `.pressable` | Scale down on press | `<button class="pressable">` |
| `.animate-fade-in` | Fade in animation | `<section class="animate-fade-in">` |
| `.animate-slide-up` | Slide up animation | `<div class="animate-slide-up">` |
| `shadow-soft` | Soft shadow | `<div class="shadow-soft">` |
| `shadow-glow` | Glow shadow | `<div class="shadow-glow">` |
| `rounded-2xl` | 1rem radius | `<div class="rounded-2xl">` |
| `rounded-3xl` | 1.25rem radius | `<div class="rounded-3xl">` |

### Built-in Tailwind v4.1 Utilities

| Category | Examples |
|----------|----------|
| **Text Shadow** | `text-shadow-sm`, `text-shadow-lg`, `text-shadow-xl` |
| **Filters** | `blur-sm`, `brightness-50`, `contrast-125`, `saturate-150` |
| **Aspect Ratio** | `aspect-video`, `aspect-square`, `aspect-[16/9]` |
| **Backdrop** | `backdrop-blur-sm`, `backdrop-brightness-110` |

## 🚀 Commands

```bash
# Development
npm run dev

# Production build
npm run build

# Preview
npm run preview

# Optional: Remove plugins (if using built-ins)
npm uninstall tailwindcss-textshadow @tailwindcss/aspect-ratio
```

## 📚 Resources

- [Tailwind CSS v4 Docs](https://tailwindcss.com)
- [tw-animate-css on npm](https://www.npmjs.com/package/tw-animate-css)
- [Tailwind Text Shadow Docs](https://tailwindcss.com/docs/text-shadow)
- [Tailwind Filter Docs](https://tailwindcss.com/docs/blur)

## ✅ Ready to Use

Your Tailwind setup is fully modernized and ready to use! All the new utilities are available in your HTML.
