# Hybrid Architecture: Vanilla + Preact Islands

## Overview

The portfolio uses a **hybrid architecture** that combines:
- **Vanilla HTML/CSS/TypeScript shell** (fast, simple, strict CSP-compatible)
- **Preact islands** for interactive components (modern DX where needed)

This approach gives us:
- ✅ Excellent performance (minimal JS for static content)
- ✅ Strict CSP compliance with nonce-based security
- ✅ Modern component ergonomics where it matters (assistant panel)
- ✅ Easy migration path (can convert to full React/Preact later)
- ✅ Framework-agnostic layout system

## Architecture

```
┌─────────────────────────────────────────────┐
│         index.html (Vanilla Shell)          │
│  - Navigation, hero, projects, contact      │
│  - Social links, Calendly integration       │
│  - Loads: /src/main.ts                      │
└──────────────────┬──────────────────────────┘
                   │
         ┌─────────┴──────────┐
         │                    │
    ┌────▼────┐         ┌─────▼──────┐
    │ Layout  │         │  Preact    │
    │ System  │◄────────┤  Island    │
    │(Vanilla)│         │ (Assistant)│
    └─────────┘         └────────────┘
         │                    │
         └────────┬───────────┘
                  │
            Event Bridge
         ("layout:update")
```

## Key Components

### 1. Layout System (`src/layout.ts`)

**Framework-agnostic** module that manages context-aware layouts:

```typescript
// Load layout from backend
await loadLayout(); // Fetches /api/layout

// Get current layout
const recipe = currentLayout();

// Subscribe to updates
const unsubscribe = onLayoutUpdate((recipe) => {
  console.log("Layout changed:", recipe);
});
```

**Layout Recipe Format:**
```json
{
  "version": "1.0.0",
  "cards": {
    "LedgerMind": {
      "size": "lg",
      "order": 1,
      "hidden": false
    },
    "DataPipeAI": {
      "size": "md",
      "order": 2
    }
  }
}
```

### 2. Vanilla Shell (`src/main.ts`)

Entry point that bootstraps the vanilla shell:

```typescript
import "../portfolio.css";
import { loadLayout } from "./layout";
import "../portfolio"; // Project grid logic

// Load layout on boot
loadLayout();
```

### 3. Preact Island (`src/assistant.main.tsx`)

Interactive component that subscribes to layout events:

```tsx
function AssistantPanel() {
  const [layout, setLayout] = useState(currentLayout());

  useEffect(() => {
    const unsubscribe = onLayoutUpdate((recipe) => {
      setLayout(recipe);
    });
    return unsubscribe;
  }, []);

  // Render UI based on layout state
}
```

### 4. Data Hooks

All project cards have stable hooks that work in both worlds:

```html
<article class="project-card" data-card="LedgerMind">
  <!-- Card content -->
</article>
```

The layout system uses these hooks to apply recipes:

```typescript
// Vanilla applies recipes via DOM manipulation
const el = document.querySelector(`[data-card="LedgerMind"]`);
el.style.order = "1";
el.setAttribute("data-size", "lg");
```

### 5. CSS Grid System

CSS responds to `data-size` attributes:

```css
.portfolio-grid {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
}

.project-card[data-size="sm"] { grid-column: span 4; }
.project-card[data-size="md"] { grid-column: span 6; }
.project-card[data-size="lg"] { grid-column: span 8; }
```

## Event Bridge

The vanilla shell and Preact islands communicate via custom events:

1. **Vanilla loads layout** → Applies DOM changes → Fires `layout:update`
2. **Preact island listens** → Updates reactive state → Re-renders UI

This keeps them loosely coupled but synchronized.

## Build System

### Vite Configuration

Preact compatibility layer for React libraries:

```typescript
// vite.config.ts
resolve: {
  alias: {
    'react': 'preact/compat',
    'react-dom': 'preact/compat',
    'react/jsx-runtime': 'preact/jsx-runtime',
  }
}
```

### Entry Points

```html
<!-- Vanilla shell -->
<script type="module" src="/src/main.ts"></script>

<!-- Preact island -->
<div id="assistant-root"></div>
<script type="module" src="/src/assistant.main.tsx"></script>
```

### Build Output

```
dist-portfolio/
├── index.html (12.64 kB)
├── assets/
│   ├── main-[hash].css (11.43 kB)
│   └── main-[hash].js (19.60 kB)  # Both vanilla + Preact
```

## Security (CSP)

The hybrid architecture works with strict nonce-based CSP:

```nginx
Content-Security-Policy: "
  script-src 'self' 'nonce-$csp_nonce' 'strict-dynamic';
  ...
"
```

Both vanilla and Preact scripts get nonces:

```html
<script nonce="__CSP_NONCE__" type="module" src="/src/main.ts"></script>
<script nonce="__CSP_NONCE__" type="module" src="/src/assistant.main.tsx"></script>
```

## Testing

Tests are framework-agnostic and use stable data hooks:

```typescript
// Works for both vanilla and Preact
await expect(page.locator('[data-card="LedgerMind"]')).toBeVisible();
await expect(page.locator('[data-testid="assistant-panel"]')).toBeVisible();
```

## Backend API

The layout system expects a `/api/layout` endpoint:

### Request
```http
GET /api/layout HTTP/1.1
Host: assistant.ledger-mind.org
```

### Response
```json
{
  "version": "1.0.0",
  "cards": {
    "LedgerMind": { "size": "lg", "order": 1 },
    "DataPipeAI": { "size": "md", "order": 2 },
    "ClarityCompanion": { "size": "sm", "order": 3, "hidden": true }
  }
}
```

## Migration Path

### Adding More Islands

1. Create new `.tsx` file in `src/`
2. Add mount point to `index.html`
3. Import and render with Preact

```tsx
// src/chat.main.tsx
import { render } from "preact";
function ChatPanel() { /* ... */ }
render(<ChatPanel />, document.getElementById("chat-root"));
```

### Converting to Full React/Preact

1. Keep `src/layout.ts` (framework-agnostic)
2. Replace `index.html` with React root
3. Convert vanilla sections to components
4. Reuse existing layout contract

## Development

### Local Dev
```bash
pnpm run dev              # Start dev server (port 5173)
```

### Build
```bash
pnpm run build:portfolio  # Build for production
```

### Test
```bash
pnpm exec playwright test tests/e2e/portfolio.smoke.spec.ts
```

## Benefits

| Aspect | Vanilla | Preact Island |
|--------|---------|---------------|
| **Performance** | ⚡ Minimal JS | 🎯 Only where needed |
| **CSP** | ✅ Nonce-based | ✅ Nonce-based |
| **DX** | 📝 Manual DOM | 🎨 JSX + Hooks |
| **Testing** | ✅ data-testid | ✅ data-testid |
| **Maintenance** | 🔧 Simple | 🛠️ Modern |

## Troubleshooting

### Layout not loading
- Check backend `/api/layout` endpoint returns 200
- Verify response matches `LayoutRecipe` interface
- Check browser console for fetch errors

### Island not mounting
- Verify `#assistant-root` exists in HTML
- Check script tag has correct `src` path
- Look for Preact errors in console

### CSP violations
- Ensure both scripts have `nonce="__CSP_NONCE__"` attribute
- Verify nginx replaces `__CSP_NONCE__` with actual nonce
- Check Calendly domains are whitelisted

## Resources

- [Preact Documentation](https://preactjs.com/)
- [Islands Architecture](https://jasonformat.com/islands-architecture/)
- [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
