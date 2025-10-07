# Typography System - Quick Reference

## 🎨 Font Stack

```css
--font-sans: "Inter"           /* Body text, UI */
--font-display: "Space Grotesk" /* Headings, titles */
```

---

## 📏 Sizing Scale (Fluid)

| Element | Mobile | Desktop | Use Case |
|---------|--------|---------|----------|
| **h1** | 30px | 44px | Hero titles |
| **h2** | 22px | 32px | Section headings |
| **h3** | 19px | 24px | Subsections |
| **p, li** | 16px | 18px | Body text |
| **small** | 15px | 15px | Metadata |

---

## 🎯 Usage

### Headings (Space Grotesk)
```html
<h1>Main Title</h1>           <!-- Space Grotesk, 700, 30-44px -->
<h2>Section Title</h2>        <!-- Space Grotesk, 700, 22-32px -->
<h3>Subsection</h3>           <!-- Space Grotesk, 700, 19-24px -->
```

### Body (Inter)
```html
<p>Paragraph text...</p>      <!-- Inter, 400, 16-18px -->
<li>List item...</li>         <!-- Inter, 400, 16-18px -->
<button>Click Me</button>     <!-- Inter, 600, inherits -->
```

### UI Elements (Space Grotesk)
```html
<div class="brand-text">Leo Klemet</div>        <!-- Space Grotesk, 600 -->
<h2 class="section-title">Projects</h2>         <!-- Space Grotesk, 600 -->
<span class="chip-label">AI Agents</span>       <!-- Space Grotesk, 600 -->
```

### Utility Classes
```html
<small>Metadata</small>       <!-- Inter, 15px, muted color -->
<p class="text-sm">Small</p>  <!-- Inter, 15px, muted color -->
```

---

## 🎨 Colors

```css
--text: #e8eef7    /* Primary text (light on dark) */
--muted: #a7b1c2   /* Secondary text (gray) */

/* Links */
a { color: #8ad8ff; }  /* Cyan, high contrast */
```

---

## ⚙️ CSS Variables

```css
:root {
  --font-sans: "Inter", system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
  --font-display: "Space Grotesk", "Inter", system-ui, sans-serif;
  --text: #e8eef7;
  --muted: #a7b1c2;
}
```

**Apply in custom styles:**
```css
.custom-heading {
  font-family: var(--font-display);
  color: var(--text);
}

.custom-body {
  font-family: var(--font-sans);
  color: var(--muted);
}
```

---

## 🚀 Quick Examples

### Hero Section
```html
<h1>Leo Klemet — AI Engineer</h1>       <!-- Space Grotesk, 44px max -->
<p>Building human-centered AI tools.</p> <!-- Inter, 18px max -->
```

### Project Card
```html
<h2 class="section-title">LedgerMind</h2>  <!-- Space Grotesk, 32px max -->
<p>AI finance assistant.</p>               <!-- Inter, 18px -->
<small>2024 · Production</small>           <!-- Inter, 15px, muted -->
```

### Button
```html
<button class="btn">View Project</button>  <!-- Inter, 600 weight -->
```

---

## 📱 Responsive Behavior

```
Mobile (< 640px)    Tablet (768px)    Desktop (1440px)
─────────────────   ───────────────   ─────────────────
h1: 30px            h1: 35px          h1: 44px
h2: 22px            h2: 26px          h2: 32px
p:  16px            p:  17px          p:  18px
```

**Smooth scaling via `clamp()`** - No breakpoint jumps!

---

## ✅ What Inherits Automatically

- All `<h1>` to `<h6>` use Space Grotesk
- All `<p>`, `<li>`, `<dd>` use Inter
- All `<button>`, `.btn` use Inter semibold
- Links are cyan (#8ad8ff)
- Body has antialiased rendering

**No extra classes needed** - Everything inherits from global system!

---

## 🔧 Override When Needed

```css
/* Keep global styles, just tweak size */
.special-heading {
  font-size: 3rem;  /* Larger than h1 */
  /* Still uses Space Grotesk from h1 inheritance */
}

/* Completely custom */
.custom-text {
  font-family: "Comic Sans MS", cursive;  /* Don't do this 😅 */
}
```

---

## 📋 Font Weights

| Font | Weights Available | Use Case |
|------|-------------------|----------|
| **Inter** | 400, 500, 600, 700 | Body, buttons, UI |
| **Space Grotesk** | 500, 600, 700 | Headings, titles |

```css
/* Inter weights */
font-weight: 400;  /* Regular - body text */
font-weight: 500;  /* Medium - emphasis */
font-weight: 600;  /* Semibold - buttons, labels */
font-weight: 700;  /* Bold - strong emphasis */

/* Space Grotesk weights */
font-weight: 500;  /* Medium - unused by default */
font-weight: 600;  /* Semibold - UI elements (.brand-text) */
font-weight: 700;  /* Bold - all headings (h1-h6) */
```

---

## 🎯 Common Patterns

### Hero Title + Subtitle
```html
<h1>AI Engineer & 3D Artist</h1>            <!-- Space Grotesk, 44px -->
<p class="text-sm">Based in France</p>      <!-- Inter, 15px, muted -->
```

### Section with Description
```html
<h2 class="section-title">Projects</h2>     <!-- Space Grotesk, 32px -->
<p>Explore my portfolio of AI agents...</p>  <!-- Inter, 18px -->
```

### Card with Metadata
```html
<h3>Project Title</h3>                      <!-- Space Grotesk, 24px -->
<p>Project description here...</p>          <!-- Inter, 18px -->
<small>2024 · AI Agents</small>             <!-- Inter, 15px, muted -->
```

---

## 🚨 Troubleshooting

**Problem:** Text looks too small on mobile
**Solution:** Fluid sizing scales automatically. If truly too small, adjust clamp() min value.

**Problem:** Headings not using Space Grotesk
**Solution:** Check for more specific CSS selectors overriding global h1-h6 rules.

**Problem:** Fonts not loading
**Solution:** Verify Google Fonts link in `<head>` and check network tab.

**Problem:** Text looks blurry
**Solution:** Antialiasing is enabled. May look softer on non-retina displays (intentional).

---

## 📚 Related Docs

- `docs/GLOBAL_TYPOGRAPHY_SYSTEM.md` - Full implementation details
- `docs/BRAND_HEADER_IMPLEMENTATION.md` - Header using Space Grotesk
- `docs/ABOUT_SECTION_IMPLEMENTATION.md` - About section typography

---

## ⚡ TL;DR

- **Space Grotesk** = Headings, titles, UI labels (bold & impactful)
- **Inter** = Body text, buttons, lists (readable & clean)
- **Fluid sizing** = Scales from mobile (16px) to desktop (18px)
- **CSS variables** = `--font-sans`, `--font-display`, `--text`, `--muted`
- **No classes needed** = Everything inherits automatically
