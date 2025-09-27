# Leo Klemet — Portfolio (HTML/CSS/JS)

[![Smoke](https://github.com/leok974/leo-portfolio/actions/workflows/smoke.yml/badge.svg)](https://github.com/leok974/leo-portfolio/actions/workflows/smoke.yml)

A fast, modern, **framework-free** portfolio for **Leo Klemet — AI Engineer · SWE · Generative AI / 3D Artist & Creative Technologist**.

- ✅ Sticky nav + smooth scroll
- ✅ Dark/Light mode (localStorage)
- ✅ Filterable project grid (AI Agents, ML/Analytics, 3D/Art, DevOps)
- ✅ Local `<video>` (WebM/MP4) + YouTube embed (lazy, responsive)
- ✅ Contact form ready for Netlify Forms
- ✅ Accessible: semantic HTML5, labels, alt, caption tracks
- ✅ Performance: lazy-load, captions support, WebP/AVIF friendly

> Built with **plain HTML, CSS (Grid/Flex), and vanilla JS**. Easy to extend into React/Vite/CMS later.

---

## Quickstart (Local)

1) **Clone** and open the folder in VS Code:
```bash
cd leo-portfolio
code .
```

2) **Serve** the static site (pick one):
- VS Code Live Server extension → “Go Live”
- Python: `python -m http.server 5173`
Visit: <http://localhost:5173>

> All assets live under `assets/`. Replace placeholders and posters with your real images/videos (optimized as WebP/AVIF + WebM/MP4).

## Deploy

### Option A — GitHub Pages (recommended)
3. Keep the provided workflow `.github/workflows/deploy.yml` (already included).
   On push to `main`, Pages will publish the site automatically.

- **Forms** work out of the box via `data-netlify="true"`.

### Option C — Vercel

## Copilot Setup (Instructions + Prompts)

> _“Copilot, split `index.html` into `styles.css` and `main.js`. Move inline `<style>` and `<script>` into those files and update references. Keep behavior identical.”_

**Add new project cards from a JSON file**
> _“Copilot, create `projects.json` with fields: slug, title, summary, tags[], cats[], thumbnail, poster, sources[], links. Generate JS that loads this JSON and renders the cards + filters.”_

**Generate dedicated project pages**
> _“Copilot, scaffold `/projects/<slug>.html` using the modal content. Reuse the layout/header/footer and link the cards to the new pages.”_

**Performance audits**
> _“Copilot, add a simple `npm run optimize` script that uses `sharp` to convert images to WebP/AVIF and `ffmpeg` commands to make WebM/MP4 previews.”_

**Accessibility checks**
> _“Copilot, audit the site for WCAG 2.1: focus states, ARIA labels, color contrast, and generate a checklist in `docs/a11y.md`.”_


## Backend Diagnostics

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

---

## Backend Latency Endpoints

Two latency measurement modes are exposed for the primary LLM path:

| Endpoint | Purpose | Notes |
|----------|---------|-------|
| `GET /llm/primary/latency` | Direct backend probe hitting the primary `/models` endpoint repeatedly | Returns statistical distribution: `stats` (min/p50/p95/p99/max/avg, count, ok_rate) plus raw statuses. Low overhead. |
| `GET /llm/primary/chat-latency` | (DEPRECATED) Micro chat pipeline latency including minimal message build and provider call | Response adds `deprecated: true` and a `replacement` pointer. Will be removed after comparison period. |

The probe endpoint is preferred for tracking provider/network performance in isolation; the deprecated chat-latency helps differentiate application overhead from provider regression while both coexist.


---

## Windows: Server starts then immediately shuts down

If `uvicorn` or `hypercorn` appears to start and then exits cleanly within a few seconds (no traceback, exit code 0/1):

### Why this happens
It's almost always environmental: an integrated terminal or task wrapper sending an early Ctrl+C/SIGTERM, an aggressive AV/EDR product terminating short‑lived child processes, or a PowerShell profile script that invokes cleanup logic (e.g. `Stop-Process`). The FastAPI app itself is fine—minimal repros show the same pattern.

### Fast fixes (try in order)
1. Use a plain external **Command Prompt (cmd.exe)** instead of the VS Code integrated terminal.
2. Double‑click the provided **`run_dev.bat`** in Explorer (keeps console open, enforces a selector loop policy indirectly via `run_cmddev.py`).
3. Temporarily disable your PowerShell profile:
   - Run `notepad $PROFILE` and comment out custom cleanup / job / process code, or rename the profile file and start a fresh PowerShell.
4. Try the alternate server: `hypercorn assistant_api.main:app --bind 127.0.0.1:8010`.
5. Free a stuck port if reuse messages occur:
   - `netstat -ano | findstr :8010` then `taskkill /PID <PID> /F`.

### Diagnostics
- Check for background subscribers: `Get-EventSubscriber` and running jobs: `Get-Job`.
- Look for short‑lived `python.exe` siblings in Task Manager.
- If on corporate endpoint protection, whitelist Python + repo directory (if policy permits).

### Batch launcher
`run_dev.bat` auto‑detects `.venv` and invokes `assistant_api\run_cmddev.py`. Edit `PORT` or `HOST` inside if needed.

---

## Docker: Export / container I/O errors (Windows)

If a Docker build (especially multi‑stage with Python wheels) fails near the export phase with vague containerd / I/O errors:

### Recovery sequence
```powershell
# 1) Reset WSL & Docker Desktop
wsl --shutdown
Stop-Process -Name "Docker Desktop" -Force
Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"

# 2) Clean caches & free space
docker system df
docker buildx prune --all --force
docker system prune -a --volumes -f

# 3) Recreate builder (repairs corrupted cache metadata)
docker buildx rm default
docker buildx create --name default --use

# 4) Rebuild with plain progress (more verbose)
$env:DOCKER_BUILDKIT="1"
docker build -f assistant_api/Dockerfile -t leo-portfolio-backend --progress=plain .
```

Check disk headroom; `%LOCALAPPDATA%\Docker\wsl\data\ext4.vhdx` may have grown large. Ensure ≥10–15 GB free on drive `C:`. Security tools can also block the final export—add Docker to allowed applications if possible.

---

## WSL Quick Start (stable dev environment)

Running inside WSL (e.g. Ubuntu) avoids Windows terminal signal quirks and path issues:

```bash
cd /mnt/d/leo-portfolio
python3 -m venv .venv
source .venv/bin/activate
pip install -U pip
pip install -r assistant_api/requirements.txt

# Run the server
python -m uvicorn assistant_api.main:app --host 127.0.0.1 --port 8010 --log-level info
```

Access from Windows: http://127.0.0.1:8010 (WSL forwards localhost automatically).

---

## Optional Developer Helpers

### PowerShell shim to launch batch dev
```powershell
function Dev-Cmd { Start-Process cmd.exe "/k `"%CD%\run_dev.bat`"" }
```

### Port sanity one-liner (PowerShell)
```powershell
netstat -ano | Select-String ":8010" ; `
  Get-Process -Id (netstat -ano ^| findstr :8010 ^| ForEach-Object { ($_ -split '\s+')[-1] } | Select-Object -Unique)
```

---


## Docs Policy

All code changes must be reflected in project documentation:

- Update `README.md` for any usage, quick start, or command changes.
- Update `docs/` (e.g. `ARCHITECTURE.md`, `DEPLOY.md`, `DEVELOPMENT.md`, `SECURITY.md`, `API.md`) for architecture, deployment, security, or endpoint changes.
- Add or adjust endpoint descriptions in both `README.md` and `docs/API.md` when new routes are introduced.
- Record meaningful changes (features, fixes, refactors) in `docs/CHANGELOG.md` using a concise semantic style.
- Note added tests or tooling in `DEVELOPMENT.md`.

Copilot is configured (see `.github/copilot-instructions.md`) to nudge for doc updates whenever code impacts setup, APIs, or deployment. PRs without necessary doc updates may be flagged.

---



