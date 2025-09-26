# Leo Klemet — Portfolio (HTML/CSS/JS)

A fast, modern, **framework-free** portfolio for **Leo Klemet — AI Engineer · SWE · Generative AI / 3D Artist & Creative Technologist**.

- ✅ Sticky nav + smooth scroll
- ✅ Dark/Light mode (localStorage)
- ✅ Filterable project grid (AI Agents, ML/Analytics, 3D/Art, DevOps)
- ✅ Local `<video>` (WebM/MP4) + YouTube embed (lazy, responsive)
- ✅ Modal case studies (can expand to dedicated pages later)
- ✅ Contact form ready for Netlify Forms
- ✅ Accessible: semantic HTML5, labels, alt, caption tracks
- ✅ Performance: lazy-load, captions support, WebP/AVIF friendly

> Built with **plain HTML, CSS (Grid/Flex), and vanilla JS**. Easy to extend into React/Vite/CMS later.

---

## Quickstart (Local)

1) **Clone** and open the folder in VS Code:
```bash
git clone https://github.com/leok974/leo-portfolio.git
cd leo-portfolio
code .
```

2) **Serve** the static site (pick one):
- VS Code Live Server extension → “Go Live”
- Python: `python -m http.server 5173`
- Node (if installed): `npx http-server -p 5173`

Visit: <http://localhost:5173>

> All assets live under `assets/`. Replace placeholders and posters with your real images/videos (optimized as WebP/AVIF + WebM/MP4).

---

## Deploy

### Option A — GitHub Pages (recommended)
1. Create a new GitHub repo and push this project.
2. In **Settings → Pages**, pick **GitHub Actions**.
3. Keep the provided workflow `.github/workflows/deploy.yml` (already included).
   On push to `main`, Pages will publish the site automatically.

### Option B — Netlify
- Drag‑and‑drop the folder or link your repo.
- **Forms** work out of the box via `data-netlify="true"`.

### Option C — Vercel
- Import the repo as a **static** project.
- Output directory = project root (contains `index.html`).

---

## Copilot Setup (Instructions + Prompts)

This repo is **Copilot‑friendly**. Open VS Code with Copilot Chat enabled and use these prompts:

**Refactor to external CSS/JS**
> _“Copilot, split `index.html` into `styles.css` and `main.js`. Move inline `<style>` and `<script>` into those files and update references. Keep behavior identical.”_

**Add new project cards from a JSON file**
> _“Copilot, create `projects.json` with fields: slug, title, summary, tags[], cats[], thumbnail, poster, sources[], links. Generate JS that loads this JSON and renders the cards + filters.”_

**Generate dedicated project pages**
> _“Copilot, scaffold `/projects/<slug>.html` using the modal content. Reuse the layout/header/footer and link the cards to the new pages.”_

**Performance audits**
> _“Copilot, add a simple `npm run optimize` script that uses `sharp` to convert images to WebP/AVIF and `ffmpeg` commands to make WebM/MP4 previews.”_

**Accessibility checks**
> _“Copilot, audit the site for WCAG 2.1: focus states, ARIA labels, color contrast, and generate a checklist in `docs/a11y.md`.”_

---

## Backend Diagnostics

- `./scripts/Probe-Chat.ps1` runs a minimal `/chat` request (default base `http://127.0.0.1:8001`) and echoes the `_served_by → served path` banner.
- `./scripts/smoke.ps1` covers readiness, health, RAG, metrics, and now invokes the chat probe for parity.

---

## Structure

```
.
├── assets/                 # Place images, videos, posters, captions here
│   └── .gitkeep
├── .github/
│   └── workflows/
│       └── deploy.yml      # GitHub Pages action (no build step needed)
├── .vscode/
│   └── extensions.json     # Suggested VS Code extensions
├── .editorconfig
├── .gitignore
├── LICENSE
├── README.md
└── index.html              # Single-file app (no frameworks required)
```

---

## Customize

- **Branding**: edit meta tags, titles, and `og:image` in `index.html`.
- **Assets**: replace placeholders in `/assets` (optimize to WebP/AVIF, compress videos).
- **Captions**: add `.vtt` files and `<track>` tags for accessibility.
- **Contact**: keep `data-netlify="true"` or wire your own backend later.
- **Detail pages**: either keep modals or add `/projects/<slug>.html` pages.

---

## License

MIT © 2025 Leo Klemet



