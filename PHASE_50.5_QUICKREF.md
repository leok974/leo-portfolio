# Phase 50.5 — Quick Reference

**Status:** ✅ Complete  
**Extends:** Phase 50.4 (SEO backend)

---

## 🚀 Quick Start

### 1. Setup (One-Time)

```bash
# Configure GitHub token
export GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxx

# Start backend
uvicorn assistant_api.main:app --host 127.0.0.1 --port 8001

# Enable dev overlay
curl -X POST http://127.0.0.1:8001/agent/dev/enable

# Start frontend
pnpm dev
```

### 2. Access Tools Page

```
http://localhost:5173/tools.html
→ Scroll to "SEO & OG Intelligence" section
```

### 3. Run Workflow

```
1. Click "Dry Run" → generates diff
2. Review preview cards (before/after)
3. Click "Approve → PR" → creates GitHub PR
4. Visit PR URL and merge
```

---

## 📍 API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/agent/seo/tune?dry_run=true` | POST | Generate artifacts |
| `/agent/seo/artifacts/diff` | GET | Get unified diff |
| `/agent/seo/artifacts/log` | GET | Get reasoning log |
| `/agent/seo/act?action=seo.pr` | POST | Create GitHub PR |

---

## 🧪 Test Commands

```bash
# E2E test
npx playwright test tests/e2e/seo-pr-preview.spec.ts --project=chromium

# Full test suite
pnpm playwright test --project=chromium
```

---

## 🔧 Troubleshooting

| Error | Solution |
|-------|----------|
| "GITHUB_TOKEN not set" | `export GITHUB_TOKEN=ghp_...` |
| "seo-tune.diff not found" | Click "Dry Run" first |
| "Failed to apply patch" | Re-run dry run (diff outdated) |
| PR button disabled | Run dry run to enable |

---

## 📁 Key Files

**Backend:**
- `assistant_api/services/seo_pr.py` - PR automation
- `assistant_api/routers/seo.py` - API endpoints

**Frontend:**
- `src/components/SeoTunePanel.tsx` - UI component
- `src/components/AgentToolsPanel.tsx` - Integration

**Tests:**
- `tests/e2e/seo-pr-preview.spec.ts` - E2E smoke test

**Docs:**
- `docs/PHASE_50.5_SEO_PR_PREVIEW.md` - Full spec
- `PHASE_50.5_IMPLEMENTATION_SUMMARY.md` - Details

---

## ⚡ Copy-Paste Commands

**Backend setup:**
```bash
export GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxx
uvicorn assistant_api.main:app --host 127.0.0.1 --port 8001
```

**Test endpoint:**
```bash
# Dry run
curl -X POST "http://127.0.0.1:8001/agent/seo/tune?dry_run=true"

# Create PR
curl -X POST "http://127.0.0.1:8001/agent/seo/act?action=seo.pr"

# View artifacts
curl "http://127.0.0.1:8001/agent/seo/artifacts/diff"
curl "http://127.0.0.1:8001/agent/seo/artifacts/log"
```

**Run tests:**
```bash
npx playwright test tests/e2e/seo-pr-preview.spec.ts --project=chromium --headed
```

---

## 🎯 Status

- ✅ Backend (PR automation)
- ✅ Frontend (preview cards)
- ✅ E2E tests
- ✅ Documentation
- ⏳ Manual testing pending

---

See **PHASE_50.5_IMPLEMENTATION_SUMMARY.md** for complete details.
