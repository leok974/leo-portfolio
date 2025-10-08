# Phase 50.4 — SEO & OG Intelligence

> Introduces automatic, explainable SEO optimization with OG image regeneration and PR-ready diffs.

---

## 🧭 Overview

**Goal:**
Continuously optimize project titles, descriptions, and Open Graph (OG) previews to keep the portfolio fresh, relevant, and visually consistent.

**Core Idea:**
An autonomous `seo.tune` task periodically reviews site content, updates SEO tags, and regenerates OG images with reasoning logs and PR diffs — ensuring every page remains optimized without manual edits.

---

## ⚙️ Mechanics

### Task: `seo.tune`

**Run Modes:**
- Nightly (default: `02:30`)
- Manual trigger → `/agent/run?task=seo.tune`
- Optional dry-run flag (`dry_run=true`) for preview-only mode

**Pipeline Steps:**

1. **Collect Content**
   - Parses `projects/` metadata and content blocks.
   - Extracts text from markdown, YAML, or JSON.
   - Detects stale or missing meta fields (title, description, og:image).

2. **Generate Meta Tags**
   - Invokes the LLM pipeline to propose refreshed:
     - `<title>` — concise, keyword-rich but human-readable.
     - `<meta name="description">` — 120–155 char summaries tuned for CTR.
   - Reuses local-first generation (Ollama → fallback OpenAI if disabled).

3. **Regenerate OG Assets**
   - Calls existing `og.generate` service.
   - Ensures branded overlay (logo, background consistency).
   - Writes to `/assets/og/<slug>.png` and updates `<meta property="og:image">`.

4. **Update Sitemap**
   - Rebuilds `/sitemap.xml` and `/sitemap-media.xml` with new modification timestamps.
   - Ensures canonical URLs and priorities reflect featured weights.

5. **PR Diff + Explanation**
   - Generates two artifacts:
     - `seo-tune.diff` — text patch showing title/description/OG changes.
     - `seo-tune.md` — human-readable reasoning log per update.
   - Stored under `/agent/artifacts/seo-tune.*`.
   - Optionally committed via CI token (`GITHUB_TOKEN`) or queued for manual approval.

---

## 🧩 Endpoints

| Endpoint | Method | Purpose |
|-----------|--------|----------|
| `/agent/run?task=seo.tune` | POST | Runs full SEO tune pipeline |
| `/agent/artifacts/seo-tune.diff` | GET | Returns unified diff |
| `/agent/artifacts/seo-tune.md` | GET | Returns reasoning log |
| `/agent/events?task=seo.tune` | GET (SSE) | Streams live progress and logs |

---

## 🧰 Artifacts

| File | Description |
|------|--------------|
| `seo-tune.diff` | Unified patch with meta and OG tag changes |
| `seo-tune.md` | Plaintext explanation of optimizations (why, before/after) |
| `sitemap.xml`, `sitemap-media.xml` | Regenerated sitemap files |
| `og/<slug>.png` | Updated OG preview images |
| `events.log` | Recorded task events and performance stats |

---

## 📊 Outcome

- **Self-maintaining SEO layer** — no stale metadata.
- **Explainable optimization** — PR diff shows rationale for each edit.
- **Visual consistency** — OG previews refreshed nightly.
- **Improved discoverability & CTR** — cleaner snippets, modern share cards.

---

## 🔒 Safety & Governance

- Admin-only task (`APP_ENV=prod` disables auto-runs unless whitelisted).
- CF Access or HMAC required for manual triggers.
- PR diffs reviewed before merge to prevent unvetted metadata changes.

---

## 🧠 Future Enhancements

1. **CTR Feedback Loop**
   Integrate Phase 50.3 analytics (CTR trends) to bias SEO updates.
2. **External Keyword Insights**
   Optionally enrich meta generation with Google Trends or Ahrefs data.
3. **Structured Data**
   Inject `application/ld+json` schema for projects and person profile.
4. **Tone Presets**
   Add `style:` parameter (`professional`, `creative`, `technical`) for brand-aware rewrites.
5. **Preview Dashboard**
   Side-by-side before/after cards in overlay (approve/commit).

---

## 🧩 Integration Notes

- Extends the existing **scheduler** and **og.generate** services.
- Shares artifact workflow with **links.apply**.
- Uses `agent_events` for live progress and reasoning.
- Tested via Playwright (admin-only SEO run and artifact preview).

---

**Phase Owner:** Leo Klemet
**Version:** 50.4.0
**Date:** 2025-10-08
**Next Phase:** 50.5 — Automated PR Orchestration & Branding Intelligence
